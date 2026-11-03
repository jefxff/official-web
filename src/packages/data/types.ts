import type { Locale } from "@/i18n/routing";

export type VerificationLevel = "INTERNAL" | "DATASHEET" | "BENCH_TESTED" | "CERTIFIED";

export interface SpecItem {
  label: string;
  labelEn: string;
  value: string;
}

export interface Product {
  id: string;
  mpn: string;
  category: string;
  seriesId?: string;
  name: string; // 已按 locale 选取
  summary: string;
  description: string;
  specs: SpecItem[]; // 已按 locale 选取 label
  datasheetUrl?: string;
  appNoteUrl?: string;
  verificationLevel: VerificationLevel;
  verifiedEvidence?: string; // 已按 locale 选取（英文缺失时回落中文原文）
  verifiedEvidenceEn?: string; // 英文证据原文（后台编辑用）
}

export interface Series {
  id: string;
  slug: string;
  name: string;
  description?: string;
}

/** 后台编辑用：一次取全中英字段，避免保存时用中文覆盖英文。 */
export interface ProductAdminView {
  mpn: string;
  category: string;
  seriesId?: string;
  nameZh: string;
  nameEn: string;
  summaryZh: string;
  summaryEn: string;
  descriptionZh: string;
  descriptionEn: string;
  specs: SpecItem[];
  datasheetUrl?: string;
  appNoteUrl?: string;
  verificationLevel: VerificationLevel;
  verifiedEvidence?: string;
  verifiedEvidenceEn?: string;
}

export interface Article {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  coverImage?: string;
  publishedAt: string;
}

export type { Locale };
