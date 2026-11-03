/**
 * zod v4 迁移后的行为回归测试。
 * 目的：确认 schema 在 v4 下的运行时语义与 v3 一致（校验通过/拒绝路径不变），
 * 尤其是 v4 中 API 迁移过的部分：url 校验、optional().or() 联合、
 * superRefine 自定义 issue、default() 缺省填充。
 * 运行：npx tsx scripts/test-zod-behavior.ts
 */
import {
  productInputSchema,
  seriesInputSchema,
  articleInputSchema,
  specItemSchema,
} from "../src/app/api/v1/admin/schemas";

let pass = 0;
let fail = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    pass += 1;
    console.log(`  PASS  ${name}`);
  } else {
    fail += 1;
    console.log(`  FAIL  ${name}\n        expected: ${JSON.stringify(expected)}\n        actual:   ${JSON.stringify(actual)}`);
  }
}

function issues(result: { success: boolean; error?: { issues: unknown[] } }) {
  if (result.success) return [];
  return (result.error?.issues ?? []).map((i) => {
    const it = i as { path?: unknown[]; message?: string };
    return { path: it.path ?? [], message: it.message };
  });
}

const validProduct = {
  mpn: "FM8001",
  category: "LDO",
  nameZh: "低压差稳压器",
  nameEn: "LDO Regulator",
  summaryZh: "摘要",
  summaryEn: "Summary",
  descriptionZh: "描述",
  descriptionEn: "Description",
  specs: [{ label: "输入电压", labelEn: "Input Voltage", value: "2.2V – 5.5V" }],
  datasheetUrl: "https://cdn.fmw.example/fm8001.pdf",
  appNoteUrl: "",
  verificationLevel: "BENCH_TESTED",
  verifiedEvidence: "BR-2026-0142",
};

console.log("=== productInputSchema ===");

// 1) 正常产品应通过
{
  const r = productInputSchema.safeParse(validProduct);
  check("合法产品通过", r.success, true);
}

// 2) url 校验必须真的生效（v4 中 z.string().url() 已迁移，此处验证行为未失效）
{
  const r = productInputSchema.safeParse({ ...validProduct, datasheetUrl: "not-a-url" });
  check("非法 datasheetUrl 被拒", r.success, false);
  check(
    "非法 url 的报错 path 指向 datasheetUrl",
    issues(r).some((i) => i.path.includes("datasheetUrl")),
    true
  );
}

// 3) 空字符串 url 应被接受（.optional().or(z.literal(""))）
{
  const r = productInputSchema.safeParse({ ...validProduct, datasheetUrl: "" });
  check("空字符串 url 被接受", r.success, true);
}

// 4) url 字段整体缺省应被接受
{
  const rest = { ...validProduct };
  delete (rest as Partial<typeof validProduct>).datasheetUrl;
  const r = productInputSchema.safeParse(rest);
  check("缺省 url 被接受", r.success, true);
}

// 5) 分级验证约束：BENCH_TESTED 缺证据必须被拒
{
  const rest = { ...validProduct };
  delete (rest as Partial<typeof validProduct>).verifiedEvidence;
  const r = productInputSchema.safeParse(rest);
  check("BENCH_TESTED 缺证据被拒", r.success, false);
  check(
    "报错 path 指向 verifiedEvidence",
    issues(r).some((i) => i.path.includes("verifiedEvidence")),
    true
  );
}

// 6) 分级验证约束：空白字符串等同于缺失，应被拒
{
  const r = productInputSchema.safeParse({ ...validProduct, verifiedEvidence: "   " });
  check("空白证据被拒", r.success, false);
}

// 7) CERTIFIED 缺证据必须被拒
{
  const r = productInputSchema.safeParse({
    ...validProduct,
    verificationLevel: "CERTIFIED",
    verifiedEvidence: undefined,
  });
  check("CERTIFIED 缺证据被拒", r.success, false);
}

// 8) INTERNAL 等级不要求证据
{
  const rest = { ...validProduct };
  delete (rest as Partial<typeof validProduct>).verifiedEvidence;
  const r = productInputSchema.safeParse({ ...rest, verificationLevel: "INTERNAL" });
  check("INTERNAL 缺证据被接受", r.success, true);
}

// 9) default() 缺省填充仍然生效
{
  const r = productInputSchema.safeParse({
    mpn: "FM9001",
    category: "PMIC",
    nameZh: "n",
    nameEn: "n",
    summaryZh: "s",
    summaryEn: "s",
    verificationLevel: "INTERNAL",
  });
  check("缺省 description 通过", r.success, true);
  if (r.success) {
    check("descriptionZh 默认填充", r.data.descriptionZh, "");
    check("descriptionEn 默认填充", r.data.descriptionEn, "");
    check("specs 默认填充", r.data.specs, []);
  }
}

// 10) mpn 超长必须被拒
{
  const r = productInputSchema.safeParse({ ...validProduct, mpn: "x".repeat(65) });
  check("超长 mpn 被拒", r.success, false);
}

// 11) 非法 verificationLevel 必须被拒
{
  const r = productInputSchema.safeParse({ ...validProduct, verificationLevel: "BOGUS" });
  check("非法验证等级被拒", r.success, false);
}

// 12) specs 内层字段校验
{
  const r = productInputSchema.safeParse({
    ...validProduct,
    specs: [{ label: "", labelEn: "x", value: "y" }],
  });
  check("specs 空 label 被拒", r.success, false);
}

console.log("=== seriesInputSchema ===");
{
  const r = seriesInputSchema.safeParse({
    slug: "ldo",
    nameZh: "低压差",
    nameEn: "LDO",
  });
  check("合法系列通过", r.success, true);
  if (r.success) {
    check("descriptionZh 默认填充", r.data.descriptionZh, "");
  }
  const bad = seriesInputSchema.safeParse({ slug: "", nameZh: "x", nameEn: "y" });
  check("空 slug 被拒", bad.success, false);
}

console.log("=== articleInputSchema ===");
{
  const r = articleInputSchema.safeParse({
    slug: "news-1",
    titleZh: "标题",
    titleEn: "Title",
    excerptZh: "摘要",
    excerptEn: "Excerpt",
  });
  check("合法资讯通过", r.success, true);
  if (r.success) {
    check("bodyZh 默认填充", r.data.bodyZh, "");
  }
  const bad = articleInputSchema.safeParse({
    slug: "n",
    titleZh: "t",
    titleEn: "t",
    excerptZh: "e",
    excerptEn: "e",
    coverImage: "not-a-url",
  });
  check("非法 coverImage 被拒", bad.success, false);
}

console.log("=== specItemSchema ===");
{
  const r = specItemSchema.safeParse({ label: "a", labelEn: "b", value: "c" });
  check("合法规格项通过", r.success, true);
}

console.log("");
console.log(`总计 ${pass + fail} 项：PASS ${pass} / FAIL ${fail}`);
if (fail > 0) {
  console.error("存在行为回归，zod v4 迁移未通过。");
  process.exit(1);
}
console.log("zod v4 行为回归全部通过。");
