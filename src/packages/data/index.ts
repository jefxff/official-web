import type { Locale } from "@/i18n/routing";
import type { Article, Product, ProductAdminView, Series, SpecItem, VerificationLevel } from "./types";
import productsSeed from "./seed/products.json";
import seriesSeed from "./seed/series.json";
import articlesSeed from "./seed/articles.json";

/**
 * 数据访问层（v1.2 §4）。
 * 默认读取本地 seed JSON —— 保证无 PostgreSQL 也能 `next dev` / `next build` 渲染。
 * 接入真实库时：设置 DATABASE_URL 且 DATA_SOURCE=db，将走 Prisma（见下方 db 分支）。
 */

const DATA_SOURCE = process.env.DATA_SOURCE ?? "seed";

type RawProduct = (typeof productsSeed)[number];
type RawSeries = (typeof seriesSeed)[number];
type RawArticle = (typeof articlesSeed)[number];

function pickSpecs(raw: RawProduct, locale: Locale): SpecItem[] {
  const arr = (locale === "zh" ? raw.specsZh : raw.specsEn) as Array<{
    label: string;
    labelEn: string;
    value: string;
  }>;
  return arr.map((s) => ({
    label: locale === "zh" ? s.label : s.labelEn,
    labelEn: s.labelEn,
    value: s.value,
  }));
}

function mapProduct(raw: RawProduct, locale: Locale): Product {
  return {
    id: raw.id,
    mpn: raw.mpn,
    category: raw.category,
    seriesId: raw.seriesId,
    name: locale === "zh" ? raw.nameZh : raw.nameEn,
    summary: locale === "zh" ? raw.summaryZh : raw.summaryEn,
    description: locale === "zh" ? raw.descriptionZh : raw.descriptionEn,
    specs: pickSpecs(raw, locale),
    datasheetUrl: raw.datasheetUrl,
    appNoteUrl: raw.appNoteUrl,
    verificationLevel: raw.verificationLevel as VerificationLevel,
    verifiedEvidence:
      raw.verificationLevel === "BENCH_TESTED" || raw.verificationLevel === "CERTIFIED"
        ? locale === "zh"
          ? raw.verifiedEvidence ?? undefined
          : // 英文证据缺失时回落中文原文，避免英文站出现空白
            raw.verifiedEvidenceEn ?? raw.verifiedEvidence ?? undefined
        : undefined,
    verifiedEvidenceEn: raw.verifiedEvidenceEn ?? undefined,
  };
}

function mapSeries(raw: RawSeries, locale: Locale): Series {
  return {
    id: raw.id,
    slug: raw.slug,
    name: locale === "zh" ? raw.nameZh : raw.nameEn,
    description: locale === "zh" ? raw.descriptionZh : raw.descriptionEn,
  };
}

function mapArticle(raw: RawArticle, locale: Locale): Article {
  return {
    id: raw.id,
    slug: raw.slug,
    title: locale === "zh" ? raw.titleZh : raw.titleEn,
    excerpt: locale === "zh" ? raw.excerptZh : raw.excerptEn,
    body: locale === "zh" ? raw.bodyZh : raw.bodyEn,
    coverImage: raw.coverImage,
    publishedAt: raw.publishedAt,
  };
}

/* ----------------------------- 查询接口 ----------------------------- */

export async function getProducts(locale: Locale): Promise<Product[]> {
  if (DATA_SOURCE === "db") return dbGetProducts(locale);
  return (productsSeed as RawProduct[]).map((p) => mapProduct(p, locale));
}

export async function getProductByMpn(
  mpn: string,
  locale: Locale
): Promise<Product | null> {
  if (DATA_SOURCE === "db") return dbGetProductByMpn(mpn, locale);
  const raw = (productsSeed as RawProduct[]).find(
    (p) => p.mpn.toLowerCase() === mpn.toLowerCase()
  );
  return raw ? mapProduct(raw, locale) : null;
}

export async function getSeriesList(locale: Locale): Promise<Series[]> {
  if (DATA_SOURCE === "db") return dbGetSeriesList(locale);
  return (seriesSeed as RawSeries[]).map((s) => mapSeries(s, locale));
}

export async function getSeriesBySlug(
  slug: string,
  locale: Locale
): Promise<Series | null> {
  if (DATA_SOURCE === "db") return dbGetSeriesBySlug(slug, locale);
  const raw = (seriesSeed as RawSeries[]).find((s) => s.slug === slug);
  return raw ? mapSeries(raw, locale) : null;
}

export async function getProductsBySeries(
  seriesId: string,
  locale: Locale
): Promise<Product[]> {
  const all = await getProducts(locale);
  return all.filter((p) => p.seriesId === seriesId);
}

export async function getArticles(locale: Locale): Promise<Article[]> {
  if (DATA_SOURCE === "db") return dbGetArticles(locale);
  return (articlesSeed as RawArticle[])
    .map((a) => mapArticle(a, locale))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export async function getArticleBySlug(
  slug: string,
  locale: Locale
): Promise<Article | null> {
  if (DATA_SOURCE === "db") return dbGetArticleBySlug(slug, locale);
  const raw = (articlesSeed as RawArticle[]).find((a) => a.slug === slug);
  return raw ? mapArticle(raw, locale) : null;
}

export async function searchProducts(
  query: string,
  locale: Locale
): Promise<Product[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const all = await getProducts(locale);
  return all.filter(
    (p) =>
      p.mpn.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q) ||
      p.summary.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
  );
}

/**
 * 后台编辑专用：一次取全中英字段。
 * 前台接口按 locale 选取单语字段，后台表单需要同时编辑 zh/en，
 * 否则保存时会把英文文案覆盖成中文。
 */
export async function getProductAdminView(
  mpn: string
): Promise<ProductAdminView | null> {
  if (DATA_SOURCE === "db") {
    const { prisma } = await import("@fmw/db");
    const r = await prisma.product.findUnique({ where: { mpn } });
    if (!r) return null;
    return {
      mpn: r.mpn,
      category: r.category,
      seriesId: r.seriesId ?? undefined,
      nameZh: r.nameZh,
      nameEn: r.nameEn,
      summaryZh: r.summaryZh,
      summaryEn: r.summaryEn,
      descriptionZh: r.descriptionZh,
      descriptionEn: r.descriptionEn,
      specs: (r.specsZh as unknown as SpecItem[]) ?? [],
      datasheetUrl: r.datasheetUrl ?? undefined,
      appNoteUrl: r.appNoteUrl ?? undefined,
      verificationLevel: r.verificationLevel,
      verifiedEvidence: r.verifiedEvidence ?? undefined,
      verifiedEvidenceEn: r.verifiedEvidenceEn ?? undefined,
    };
  }
  const raw = (productsSeed as RawProduct[]).find(
    (p) => p.mpn.toLowerCase() === mpn.toLowerCase()
  );
  if (!raw) return null;
  return {
    mpn: raw.mpn,
    category: raw.category,
    seriesId: raw.seriesId,
    nameZh: raw.nameZh,
    nameEn: raw.nameEn,
    summaryZh: raw.summaryZh,
    summaryEn: raw.summaryEn,
    descriptionZh: raw.descriptionZh,
    descriptionEn: raw.descriptionEn,
    specs: pickSpecs(raw, "zh"),
    datasheetUrl: raw.datasheetUrl,
    appNoteUrl: raw.appNoteUrl,
    verificationLevel: raw.verificationLevel as VerificationLevel,
    verifiedEvidence: raw.verifiedEvidence ?? undefined,
    verifiedEvidenceEn: raw.verifiedEvidenceEn ?? undefined,
  };
}

/* ----------------------- PG 分支（接入真实库时启用） ----------------------- */// 仅当 DATA_SOURCE=db 时调用；读取时按 locale 选取 zh/en 字段，与 seed 分支保持一致。

async function dbGetProducts(locale: Locale): Promise<Product[]> {
  const { prisma } = await import("@fmw/db");
  const rows = await prisma.product.findMany({ orderBy: { mpn: "asc" } });
  return rows.map((r) => ({
    id: r.id,
    mpn: r.mpn,
    category: r.category,
    seriesId: r.seriesId ?? undefined,
    name: locale === "zh" ? r.nameZh : r.nameEn,
    summary: locale === "zh" ? r.summaryZh : r.summaryEn,
    description: locale === "zh" ? r.descriptionZh : r.descriptionEn,
    specs: (locale === "zh" ? r.specsZh : r.specsEn) as unknown as SpecItem[],
    datasheetUrl: r.datasheetUrl ?? undefined,
    appNoteUrl: r.appNoteUrl ?? undefined,
    verificationLevel: r.verificationLevel,
    verifiedEvidence:
      r.verificationLevel === "BENCH_TESTED" || r.verificationLevel === "CERTIFIED"
        ? locale === "zh"
          ? (r.verifiedEvidence ?? undefined)
          : (r.verifiedEvidenceEn ?? r.verifiedEvidence ?? undefined)
        : undefined,
    verifiedEvidenceEn: r.verifiedEvidenceEn ?? undefined,
  }));
}

async function dbGetProductByMpn(
  mpn: string,
  locale: Locale
): Promise<Product | null> {
  const { prisma } = await import("@fmw/db");
  const r = await prisma.product.findUnique({ where: { mpn } });
  if (!r) return null;
  return {
    id: r.id,
    mpn: r.mpn,
    category: r.category,
    seriesId: r.seriesId ?? undefined,
    name: locale === "zh" ? r.nameZh : r.nameEn,
    summary: locale === "zh" ? r.summaryZh : r.summaryEn,
    description: locale === "zh" ? r.descriptionZh : r.descriptionEn,
    specs: (locale === "zh" ? r.specsZh : r.specsEn) as unknown as SpecItem[],
    datasheetUrl: r.datasheetUrl ?? undefined,
    appNoteUrl: r.appNoteUrl ?? undefined,
    verificationLevel: r.verificationLevel,
    verifiedEvidence:
      r.verificationLevel === "BENCH_TESTED" || r.verificationLevel === "CERTIFIED"
        ? locale === "zh"
          ? (r.verifiedEvidence ?? undefined)
          : (r.verifiedEvidenceEn ?? r.verifiedEvidence ?? undefined)
        : undefined,
    verifiedEvidenceEn: r.verifiedEvidenceEn ?? undefined,
  };
}

async function dbGetSeriesList(locale: Locale): Promise<Series[]> {
  const { prisma } = await import("@fmw/db");
  const rows = await prisma.series.findMany();
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: locale === "zh" ? r.nameZh : r.nameEn,
    description: locale === "zh" ? (r.descriptionZh ?? undefined) : (r.descriptionEn ?? undefined),
  }));
}

async function dbGetSeriesBySlug(
  slug: string,
  locale: Locale
): Promise<Series | null> {
  const { prisma } = await import("@fmw/db");
  const r = await prisma.series.findUnique({ where: { slug } });
  if (!r) return null;
  return {
    id: r.id,
    slug: r.slug,
    name: locale === "zh" ? r.nameZh : r.nameEn,
    description: locale === "zh" ? (r.descriptionZh ?? undefined) : (r.descriptionEn ?? undefined),
  };
}

async function dbGetArticles(locale: Locale): Promise<Article[]> {
  const { prisma } = await import("@fmw/db");
  const rows = await prisma.article.findMany({ orderBy: { publishedAt: "desc" } });
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: locale === "zh" ? r.titleZh : r.titleEn,
    excerpt: locale === "zh" ? r.excerptZh : r.excerptEn,
    body: locale === "zh" ? r.bodyZh : r.bodyEn,
    coverImage: r.coverImage ?? undefined,
    publishedAt: r.publishedAt.toISOString(),
  }));
}

async function dbGetArticleBySlug(
  slug: string,
  locale: Locale
): Promise<Article | null> {
  const { prisma } = await import("@fmw/db");
  const r = await prisma.article.findUnique({ where: { slug } });
  if (!r) return null;
  return {
    id: r.id,
    slug: r.slug,
    title: locale === "zh" ? r.titleZh : r.titleEn,
    excerpt: locale === "zh" ? r.excerptZh : r.excerptEn,
    body: locale === "zh" ? r.bodyZh : r.bodyEn,
    coverImage: r.coverImage ?? undefined,
    publishedAt: r.publishedAt.toISOString(),
  };
}
