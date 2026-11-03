/**
 * 字段级国际化校验（双语站的「隐性返工」防线）。
 *
 * 背景：后台曾出过一次事故——编辑页把中文字段同时写进 `nameEn/summaryEn`，
 * 保存后英文站整页是中文，且线上没有任何报错（zod 只校验「非空」，非空≠已翻译）。
 * 这类问题不会被类型系统或 schema 拦住，只能靠内容层校验。
 *
 * 三类判定（全部基于纯函数，可在 CI 中断言）：
 *  1. `missing`：中文已填、英文为空；
 *  2. `identical`：英文与中文完全一致（复制粘贴未翻译的最典型特征）；
 *  3. `untranslated`：英文字段里出现 CJK 字符（半翻译 / 整段漏翻）。
 *
 * 有意做成「可确认放行」而非硬阻断：品牌名、料号、型号等在中英两栏本就相同，
 * 硬阻断会逼着编辑写无意义的差异内容，反而降低数据质量。
 */

export type I18nIssueKind = "missing" | "identical" | "untranslated";

export interface I18nIssue {
  /** 表单字段名（与 payload 键一致，便于直接定位输入框） */
  field: string;
  /** 中文对应字段，便于 UI 提示「对照 zh 字段」 */
  counterpart: string;
  kind: I18nIssueKind;
  message: string;
}

/** 中文 / 日文假名 / 全角标点。命中即认为该「英文」字段未真正英译。 */
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3040-\u30ff\uff00-\uffef]/;

/** 中英字段对：`[中文字段, 英文字段, 人类可读名称]` */
export type FieldPair = readonly [string, string, string];

const ZH_LABEL = "中文";

/**
 * 校验一组中英字段对。
 * @param values 表单当前值（缺失键按空串处理）
 * @param pairs  字段对定义
 */
export function collectI18nIssues<T extends object>(
  values: T,
  pairs: readonly FieldPair[]
): I18nIssue[] {
  const bag = values as Record<string, unknown>;
  const issues: I18nIssue[] = [];

  for (const [zhKey, enKey, label] of pairs) {
    const zh = asText(bag[zhKey]);
    const en = asText(bag[enKey]);

    if (zh && !en) {
      issues.push({
        field: enKey,
        counterpart: zhKey,
        kind: "missing",
        message: `${label}：${ZH_LABEL}已填写，英文为空`,
      });
      continue;
    }

    if (zh && en && zh === en) {
      issues.push({
        field: enKey,
        counterpart: zhKey,
        kind: "identical",
        message: `${label}：英文与中文完全相同，疑似未翻译`,
      });
      continue;
    }

    if (en && CJK.test(en)) {
      issues.push({
        field: enKey,
        counterpart: zhKey,
        kind: "untranslated",
        message: `${label}：英文字段中含中文字符，请确认是否漏翻`,
      });
    }
  }

  return issues;
}

function asText(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** 按字段聚合，供表单高亮使用：{ titleEn: [issue, ...] } */
export function groupIssuesByField(issues: I18nIssue[]): Record<string, I18nIssue[]> {
  const out: Record<string, I18nIssue[]> = {};
  for (const issue of issues) {
    (out[issue.field] ??= []).push(issue);
  }
  return out;
}

/** 内容类字段的中英对（产品 / 资讯 / 系列共用同一套判定口径）。 */
export const PRODUCT_I18N_PAIRS: readonly FieldPair[] = [
  ["nameZh", "nameEn", "名称"],
  ["summaryZh", "summaryEn", "摘要"],
  ["descriptionZh", "descriptionEn", "详情"],
  ["verifiedEvidence", "verifiedEvidenceEn", "验证证据"],
];

export const ARTICLE_I18N_PAIRS: readonly FieldPair[] = [
  ["titleZh", "titleEn", "标题"],
  ["excerptZh", "excerptEn", "摘要"],
  ["bodyZh", "bodyEn", "正文"],
];

export const SERIES_I18N_PAIRS: readonly FieldPair[] = [
  ["nameZh", "nameEn", "系列名称"],
  ["descriptionZh", "descriptionEn", "系列描述"],
];
