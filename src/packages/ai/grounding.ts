import type { Locale } from "@/i18n/routing";
import {
  getProductByMpn,
  getProducts,
  searchProducts,
} from "@fmw/data";
import type { Product, VerificationLevel } from "@fmw/data/types";
import type { AiContext, Intent, QuestionAnalysis } from "./types";

/**
 * 接地引擎（v1.2 修订核心：「AI 数值校验 → 槽位填充」）。
 *
 * 原则：AI 助手不臆造任何电气参数。所有数值必须来自已验证产品库
 * （seed 或 PG），由本模块抽取真实字段填充到回答模板。
 * 未命中库的料号 / 参数一律如实说明「查不到」，不猜测。
 */

// 类别关键词（中英文）→ category 字段值
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  LDO: ["ldo", "稳压", "线性稳压", "低压差", "低压差线性"],
  PMIC: [
    "pmic",
    "电源管理",
    "电源",
    "降压",
    "buck",
    "升压",
    "boost",
    "充电",
    "锂电",
    "charger",
    "电池",
  ],
  MOSFET: ["mosfet", "mos", "场效应", "mos管", "功率管", "mosfet"],
};

const CONTACT_KEYWORDS = [
  "联系",
  "询价",
  "报价",
  "样品",
  "采购",
  "买",
  "contact",
  "quote",
  "sample",
  "purchase",
  "buy",
  "price",
  "pricing",
];

// 参数关键词 → spec label（用于识别用户关心的某个参数）
const SPEC_KEYWORDS: Record<string, string[]> = {
  输入电压: ["输入电压", "输入", "input voltage", "vin", "input"],
  输出电流: ["输出电流", "电流", "output current", "current", "iod"],
  压差: ["压差", "dropout"],
  输出噪声: ["噪声", "noise", "纹波", "ripple"],
  PSRR: ["psrr", "电源抑制", "psr"],
  "Rds(on)": ["rds", "导通电阻", "导通", "rdson"],
  VDS: ["vds", "耐压", "击穿", "bvdss"],
  ID: ["id", "漏极电流", "最大电流", "idrain"],
};

const MPN_RE = /([A-Za-z]{2}\d{3,})/;

export function analyzeQuestion(question: string): QuestionAnalysis {
  const q = question.trim();
  const lower = q.toLowerCase();
  const mpnMatch = q.match(MPN_RE);
  const mpn = mpnMatch ? mpnMatch[1].toUpperCase() : undefined;

  let category: string | undefined;
  for (const [cat, kws] of Object.entries(CATEGORY_KEYWORDS)) {
    if (kws.some((k) => lower.includes(k.toLowerCase()))) {
      category = cat;
      break;
    }
  }

  let intent: Intent = "general";
  if (mpn) intent = "product_detail";
  else if (category) intent = "product_find";
  else if (CONTACT_KEYWORDS.some((k) => lower.includes(k.toLowerCase())))
    intent = "contact";

  return { mpn, category, intent };
}

function detectSpec(
  products: Product[],
  question: string
): { label: string; value: string } | undefined {
  if (products.length === 0) return undefined;
  const lower = question.toLowerCase();
  for (const p of products) {
    for (const spec of p.specs) {
      const matcher = SPEC_KEYWORDS[spec.label];
      if (matcher && matcher.some((k) => lower.includes(k.toLowerCase()))) {
        return { label: spec.label, value: spec.value };
      }
    }
  }
  return undefined;
}

/** 组装 AI 上下文：分析意图 + 取真实料号 + 命中参数。 */
export async function prepareContext(
  question: string,
  locale: Locale
): Promise<AiContext> {
  const analysis = analyzeQuestion(question);
  let products: Product[] = [];

  if (analysis.mpn) {
    const p = await getProductByMpn(analysis.mpn, locale);
    if (p) products = [p];
  } else if (analysis.category) {
    const all = await getProducts(locale);
    products = all.filter((p) => p.category === analysis.category);
    if (products.length === 0) {
      products = await searchProducts(analysis.category, locale);
    }
  } else {
    // 一般问题也尝试关键字召回，提升命中
    products = await searchProducts(question, locale);
  }

  const matchedSpec = detectSpec(products, question);
  return { analysis, products, matchedSpec, locale };
}

function verificationText(
  level: VerificationLevel,
  locale: Locale,
  evidence?: string
): string {
  const base: Record<VerificationLevel, string> = {
    INTERNAL:
      locale === "zh"
        ? "该料号目前为内部验证等级。"
        : "This part is at INTERNAL verification level.",
    DATASHEET:
      locale === "zh"
        ? "该料号依据数据手册参数提供。"
        : "Specs are provided per the datasheet.",
    BENCH_TESTED:
      locale === "zh"
        ? "该料号已完成 bench 实测验证。"
        : "This part is bench-test verified.",
    CERTIFIED:
      locale === "zh"
        ? "该料号已通过第三方认证。"
        : "This part is third-party certified.",
  };
  let s = base[level] ?? "";
  if ((level === "BENCH_TESTED" || level === "CERTIFIED") && evidence) {
    s +=
      locale === "zh"
        ? `验证证据：${evidence}`
        : ` Evidence: ${evidence}`;
  }
  return s;
}

/** 槽位填充：用真实字段填充回答模板，返回完整文本（由调用方做句子级分片）。 */
export function slotFillAnswer(ctx: AiContext): string {
  const { locale, products, analysis, matchedSpec } = ctx;

  if (analysis.intent === "contact") {
    return locale === "zh"
      ? "关于商务合作、样品申请或技术询价，请通过页面底部的「联系我们」提交需求，我们的销售与技术团队会尽快对接。AI 助手仅基于已公开验证的产品资料作答，无法处理订单与报价。"
      : "For business cooperation, samples or pricing, please use the Contact page at the bottom of the site — our sales and FAE team will follow up. The AI assistant only answers from published, verified product data and cannot process orders or quotes.";
  }

  if (products.length === 0) {
    if (analysis.mpn) {
      return locale === "zh"
        ? `抱歉，我在已公开验证的产品库中未找到料号 ${analysis.mpn}。请确认料号拼写，或前往「产品中心」浏览全系列。所有对外参数均来自实测 / 数据手册，未收录的料号我不会臆测其规格。`
        : `Sorry, I couldn't find part ${analysis.mpn} in the published, verified catalog. Please check the MPN, or browse the Products page. All specs I share come from bench tests / datasheets — I won't guess specs for parts not listed.`;
    }
    return locale === "zh"
      ? "抱歉，我暂时无法从已验证的产品库中找到匹配您问题的内容。您可以告诉我具体的料号（如 FM8001），或前往「产品中心」浏览；涉及订单与报价请走「联系我们」。我不会提供未经验证的参数。"
      : "Sorry, I couldn't match your question to the verified catalog. Tell me a specific part number (e.g. FM8001), or browse Products. For orders/quotes, use Contact. I don't share unverified specs.";
  }

  if (analysis.intent === "product_detail" && products.length === 1) {
    const p = products[0];
    const lines: string[] = [];
    lines.push(
      locale === "zh"
        ? `${p.name}（料号 ${p.mpn}）属于 ${p.category} 类别。`
        : `${p.name} (part ${p.mpn}) belongs to the ${p.category} family.`
    );
    if (matchedSpec) {
      lines.push(
        locale === "zh"
          ? `您关注的「${matchedSpec.label}」为 ${matchedSpec.value}。`
          : `The ${matchedSpec.label} you asked about is ${matchedSpec.value}.`
      );
    } else {
      const top = p.specs.slice(0, 3);
      lines.push(
        locale === "zh"
          ? `关键参数：${top.map((s) => `${s.label} ${s.value}`).join("、")}。`
          : `Key specs: ${top.map((s) => `${s.label} ${s.value}`).join(", ")}.`
      );
    }
    lines.push(verificationText(p.verificationLevel, locale, p.verifiedEvidence));
    lines.push(
      locale === "zh"
        ? `完整资料见产品页与数据手册（${p.datasheetUrl ?? "产品页内"}）。`
        : `Full docs on the product page and datasheet (${p.datasheetUrl ?? "product page"}).`
    );
    // 中文不加空格，英文需空格分隔，避免出现 "family.The" 这类粘连
    return lines.join(locale === "zh" ? "" : " ");
  }

  // product_find：列出命中类别的料号
  const names = products
    .slice(0, 6)
    .map((p) =>
      locale === "zh"
        ? `${p.mpn}（${p.name}）`
        : `${p.mpn} (${p.name})`
    )
    .join(locale === "zh" ? "、" : ", ");
  return locale === "zh"
    ? `${analysis.category ?? ""} 类别下已验证的料号包括：${names}。如需某一颗的具体参数，请直接告诉我料号。`
    : `Verified parts in the ${analysis.category ?? ""} family include: ${products
        .slice(0, 6)
        .map((p) => p.mpn)
        .join(", ")}. Tell me a specific MPN for its specs.`;
}
