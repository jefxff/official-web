import type { Article, Product, Series, SpecItem } from "@fmw/data/types";

/**
 * Prisma 行 → 对外视图映射（后台接口返回 & 发布管线消费）。
 * 后台为内部工具，默认取 zh 字段；搜索/缓存以 mpn/slug 为键，与 locale 无关。
 */

type ProductRow = {
  id: string;
  mpn: string;
  category: string;
  seriesId: string | null;
  nameZh: string;
  nameEn: string;
  summaryZh: string;
  summaryEn: string;
  descriptionZh: string;
  descriptionEn: string;
  specsZh: unknown;
  specsEn: unknown;
  datasheetUrl: string | null;
  appNoteUrl: string | null;
  verificationLevel: Product["verificationLevel"];
  verifiedEvidence: string | null;
  verifiedEvidenceEn: string | null;
};

type SeriesRow = {
  id: string;
  slug: string;
  nameZh: string;
  nameEn: string;
  descriptionZh: string | null;
  descriptionEn: string | null;
};

type ArticleRow = {
  id: string;
  slug: string;
  titleZh: string;
  titleEn: string;
  excerptZh: string;
  excerptEn: string;
  bodyZh: string;
  bodyEn: string;
  coverImage: string | null;
  publishedAt: Date;
};

function mapSpecs(specs: unknown): SpecItem[] {
  const arr = (Array.isArray(specs) ? specs : []) as Array<{
    label: string;
    labelEn: string;
    value: string;
  }>;
  return arr.map((s) => ({
    label: s.label,
    labelEn: s.labelEn,
    value: s.value,
  }));
}

export function mapProductToView(r: ProductRow): Product {
  return {
    id: r.id,
    mpn: r.mpn,
    category: r.category,
    seriesId: r.seriesId ?? undefined,
    name: r.nameZh,
    summary: r.summaryZh,
    description: r.descriptionZh,
    specs: mapSpecs(r.specsZh),
    datasheetUrl: r.datasheetUrl ?? undefined,
    appNoteUrl: r.appNoteUrl ?? undefined,
    verificationLevel: r.verificationLevel,
    verifiedEvidence:
      r.verificationLevel === "BENCH_TESTED" || r.verificationLevel === "CERTIFIED"
        ? r.verifiedEvidence ?? undefined
        : undefined,
    verifiedEvidenceEn: r.verifiedEvidenceEn ?? undefined,
  };
}

export function mapSeriesToView(r: SeriesRow): Series {
  return {
    id: r.id,
    slug: r.slug,
    name: r.nameZh,
    description: r.descriptionZh ?? undefined,
  };
}

export function mapArticleToView(r: ArticleRow): Article {
  return {
    id: r.id,
    slug: r.slug,
    title: r.titleZh,
    excerpt: r.excerptZh,
    body: r.bodyZh,
    coverImage: r.coverImage ?? undefined,
    publishedAt: r.publishedAt.toISOString(),
  };
}
