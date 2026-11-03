/**
 * 内容层回归测试：Markdown 渲染器 + 双语字段校验。
 *
 * 这两块的风险都不在「功能跑不通」，而在「输出不合预期还看不出来」：
 *  - Markdown 渲染器一旦透传原始 HTML，就是存储型 XSS；
 *  - 双语校验一旦漏判，「英文站显示中文」这类事故会重新回归。
 *
 * 运行：npx tsx scripts/test-content.ts
 */
import { renderToStaticMarkup } from "react-dom/server";
import { Markdown, renderMarkdown } from "../src/packages/markdown";
import {
  ARTICLE_I18N_PAIRS,
  PRODUCT_I18N_PAIRS,
  collectI18nIssues,
  groupIssuesByField,
} from "../src/packages/i18n-validate";

let pass = 0;
let fail = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    pass += 1;
    console.log(`  PASS  ${name}`);
  } else {
    fail += 1;
    console.log(
      `  FAIL  ${name}\n        expected: ${JSON.stringify(expected)}\n        actual:   ${JSON.stringify(actual)}`
    );
  }
}

function html(src: string): string {
  return renderToStaticMarkup(Markdown({ source: src }));
}

console.log("=== Markdown：块级语法 ===");
{
  const h = html("## 产品公告\n\n正文第一段。");
  check("二级标题渲染为 h2", h.includes("<h2"), true);
  check("段落渲染为 p", h.includes("<p"), true);

  const list = html("- LDO 稳压器\n- DC-DC 转换器\n");
  check("无序列表", list.includes("<ul") && list.includes("<li"), true);

  const ol = html("1. 第一步\n2. 第二步\n");
  check("有序列表", ol.includes("<ol"), true);

  const quote = html("> 备注：仅限工程样片\n");
  check("引用块", quote.includes("<blockquote"), true);

  const code = html("```ts\nconst a = 1 < 2;\n```\n");
  check("围栏代码块", code.includes("<pre") && code.includes("<code"), true);
  check("代码内容被转义", code.includes("&lt;"), true);

  const hr = html("---\n");
  check("分割线", hr.includes("<hr"), true);
}

console.log("=== Markdown：行内语法 ===");
{
  check("加粗", html("这是**重点**内容").includes("<strong"), true);
  check("斜体", html("这是*强调*内容").includes("<em"), true);
  check("行内代码", html("执行 `npm run dev` 启动").includes("<code"), true);

  const link = html("参见[数据手册](https://cdn.fmw.example/ds.pdf)。");
  check("外链渲染", link.includes('href="https://cdn.fmw.example/ds.pdf"'), true);
  check("外链带 noopener", link.includes('rel="noopener noreferrer"'), true);

  const rel = html("参见[站内页](/zh/products)。");
  check("站内相对链接", rel.includes('href="/zh/products"'), true);
}

console.log("=== Markdown：安全边界 ===");
{
  const xss = html('<script>alert("x")</script>\n\n正常文字');
  check("原始 script 标签被转义", xss.includes("&lt;script&gt;"), true);
  check("渲染结果不含可执行 script 标签", /<script/i.test(xss), false);

  const img = html('<img src=x onerror="alert(1)">');
  check("原始 img 标签不被解析", /<img/i.test(img), false);

  const jsLink = html("[点我](javascript:alert(1))");
  check("javascript: 链接不产生 href", /href="javascript:/i.test(jsLink), false);
  check("降级后仍保留可读文本", jsLink.includes("点我"), true);

  const dataLink = html("[点我](data:text/html;base64,PHNjcmlwdD4=)");
  check("data: 链接被拒", dataLink.includes("href="), false);

  const attrInject = html('正常文字 " onmouseover="alert(1)');
  check("属性注入不生效（不落入任何标签属性）", /<[^>]+onmouseover=/i.test(attrInject), false);
}

console.log("=== Markdown：边界输入 ===");
{
  check("空串返回空", renderMarkdown("").length, 0);
  check("纯空白返回空", renderMarkdown("   \n\n  ").length, 0);
  check("未闭合围栏不抛错", typeof html("```\ncode").toString(), "string");
  check("CRLF 换行兼容", html("第一段\r\n\r\n第二段").includes("<p"), true);
}

console.log("=== 双语字段校验 ===");
{
  const ok = collectI18nIssues(
    {
      titleZh: "富满微发布新一代快充协议芯片",
      titleEn: "FMW Releases Next-Generation Fast-Charging Protocol IC",
    },
    ARTICLE_I18N_PAIRS
  );
  check("正常的双语内容无告警", ok.length, 0);

  const missing = collectI18nIssues(
    { titleZh: "新闻标题", titleEn: "", excerptZh: "摘要", excerptEn: "Summary" },
    ARTICLE_I18N_PAIRS
  );
  check("英文为空被识别为 missing", missing[0]?.kind, "missing");
  check("恰好一条告警", missing.length, 1);

  const identical = collectI18nIssues(
    { titleZh: "新闻标题", titleEn: "新闻标题" },
    ARTICLE_I18N_PAIRS
  );
  check("中英完全相同被识别为 identical", identical[0]?.kind, "identical");
  check("提示里点名英文与中文相同", identical[0]?.message.includes("完全相同"), true);

  const untranslated = collectI18nIssues(
    { titleZh: "新闻标题", titleEn: "FMW 发布新闻标题" },
    ARTICLE_I18N_PAIRS
  );
  check("英文含中文被识别为 untranslated", untranslated[0]?.kind, "untranslated");

  const product = collectI18nIssues(
    {
      nameZh: "低噪声 LDO",
      nameEn: "Low-Noise LDO",
      summaryZh: "",
      summaryEn: "",
      descriptionZh: "适用于射频前端供电",
      descriptionEn: "适用于射频前端供电",
      verifiedEvidence: "报告 CN-2024-001",
      verifiedEvidenceEn: "",
    },
    PRODUCT_I18N_PAIRS
  );
  check("两栏都空不告警", product.some((i) => i.field === "summaryEn"), false);
  check("描述未翻被识别", product.some((i) => i.field === "descriptionEn" && i.kind === "identical"), true);
  check("英文证据缺失被识别", product.some((i) => i.field === "verifiedEvidenceEn" && i.kind === "missing"), true);

  const grouped = groupIssuesByField(product);
  check("按字段聚合可用于高亮", Object.keys(grouped).sort(), ["descriptionEn", "verifiedEvidenceEn"]);
}

console.log("");
console.log(`总计 ${pass + fail} 项：PASS ${pass} / FAIL ${fail}`);
if (fail > 0) {
  console.error("内容层测试未通过。");
  process.exit(1);
}
console.log("Markdown 渲染与双语校验测试全部通过。");
