import type { Article, Product, Series } from "@fmw/data/types";

/**
 * 搜索同步模块（v1.2 §6.2 Meilisearch 管线 + 评审：PG→Meili 同步触发方式需定案）。
 *
 * 设计定案：
 * - 同步触发：在「国内唯一写点」的写接口提交成功后同步调用本模块（写后即索引），
 *   不再额外跑定时全量（除非首次建库，见 reindexAll）。
 * - 双语索引：同一文档同时存 zh/en 字段，前端按 locale 选取检索字段。
 * - env 网关：未配置 MEILI_HOST / MEILI_API_KEY 时全部 no-op，不阻断发布主流程。
 */

const MEILI_HOST = process.env.MEILI_HOST ?? "";
const MEILI_API_KEY = process.env.MEILI_API_KEY ?? "";
const MEILI_ENABLED = Boolean(MEILI_HOST && MEILI_API_KEY);

const INDEX_PRODUCTS = "products";
const INDEX_ARTICLES = "articles";
const INDEX_SERIES = "series";

function headers(): HeadersInit {
  return {
    Authorization: `Bearer ${MEILI_API_KEY}`,
    "Content-Type": "application/json",
  };
}

async function addDocuments(index: string, docs: unknown[]): Promise<void> {
  if (!MEILI_ENABLED || docs.length === 0) return;
  const res = await fetch(`${MEILI_HOST}/indexes/${index}/documents`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(docs),
  });
  if (!res.ok) {
    console.error("[search] upsert failed", index, res.status, await safeText(res));
  }
}

async function deleteDocument(index: string, id: string): Promise<void> {
  if (!MEILI_ENABLED) return;
  const res = await fetch(`${MEILI_HOST}/indexes/${index}/documents/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: headers(),
  });
  if (!res.ok) {
    console.error("[search] delete failed", index, id, res.status, await safeText(res));
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return "";
  }
}

/* ------------------------------- 文档映射 ------------------------------- */

export function toProductDoc(p: Product): Record<string, unknown> {
  return {
    id: p.mpn,
    mpn: p.mpn,
    category: p.category,
    seriesId: p.seriesId ?? null,
    nameZh: p.name,
    nameEn: p.name,
    summaryZh: p.summary,
    summaryEn: p.summary,
    // 检索用合并字段（中英文都进 searchable）
    searchable: [p.mpn, p.name, p.summary, p.category].join(" "),
    verificationLevel: p.verificationLevel,
  };
}

export function toArticleDoc(a: Article): Record<string, unknown> {
  return {
    id: a.slug,
    slug: a.slug,
    titleZh: a.title,
    titleEn: a.title,
    excerptZh: a.excerpt,
    excerptEn: a.excerpt,
    bodyZh: a.body,
    bodyEn: a.body,
    publishedAt: a.publishedAt,
    searchable: [a.title, a.excerpt, a.body].join(" "),
  };
}

export function toSeriesDoc(s: Series): Record<string, unknown> {
  return {
    id: s.slug,
    slug: s.slug,
    nameZh: s.name,
    nameEn: s.name,
    descriptionZh: s.description ?? "",
    descriptionEn: s.description ?? "",
    searchable: [s.name, s.description ?? ""].join(" "),
  };
}

/* ------------------------------- 对外 API ------------------------------- */

export async function upsertProducts(items: Product[]): Promise<void> {
  await addDocuments(INDEX_PRODUCTS, items.map(toProductDoc));
}

export async function removeProduct(mpn: string): Promise<void> {
  await deleteDocument(INDEX_PRODUCTS, mpn);
}

export async function upsertArticles(items: Article[]): Promise<void> {
  await addDocuments(INDEX_ARTICLES, items.map(toArticleDoc));
}

export async function removeArticle(slug: string): Promise<void> {
  await deleteDocument(INDEX_ARTICLES, slug);
}

export async function upsertSeries(items: Series[]): Promise<void> {
  await addDocuments(INDEX_SERIES, items.map(toSeriesDoc));
}

export async function removeSeries(slug: string): Promise<void> {
  await deleteDocument(INDEX_SERIES, slug);
}

export function isSearchEnabled(): boolean {
  return MEILI_ENABLED;
}
