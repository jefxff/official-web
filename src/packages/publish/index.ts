import type { Article, Product, Series } from "@fmw/data/types";
import { invalidateOnPublish, type CacheTag } from "@fmw/cache";
import * as search from "@fmw/search";

/**
 * 发布管线（v1.2 §6 / §11 + 评审：PG→Meili 同步触发 + tag→URL 集中失效）。
 *
 * 单一职责：任何「国内唯一写点」的写操作成功后，统一调用本管线，
 * 完成 (1) 边缘缓存失效 (2) 搜索索引重建。两件事都失败不阻断发布，但记录告警。
 * 保证失效/索引逻辑集中，避免散落调用点导致漏 Purge / 漏索引。
 */

async function run(tags: CacheTag[], indexTask: () => Promise<void>): Promise<void> {
  // 缓存失效与搜索索引互不阻塞：任一方失败只告警，不影响另一方与主流程。
  const [, purgeResult] = await Promise.allSettled([
    indexTask(),
    invalidateOnPublish(tags),
  ]);
  if (purgeResult.status === "rejected") {
    console.error("[publish] cache purge failed:", purgeResult.reason);
  }
}

export async function afterProductChange(p: Product): Promise<void> {
  await run(
    [
      { kind: "product", mpn: p.mpn },
      { kind: "home" },
      { kind: "sitemap" },
    ],
    () => search.upsertProducts([p])
  );
}

export async function afterProductDelete(mpn: string): Promise<void> {
  await run(
    [
      { kind: "product", mpn },
      { kind: "home" },
      { kind: "sitemap" },
    ],
    () => search.removeProduct(mpn)
  );
}

export async function afterArticleChange(a: Article): Promise<void> {
  await run(
    [
      { kind: "article", slug: a.slug },
      { kind: "home" },
      { kind: "sitemap" },
    ],
    () => search.upsertArticles([a])
  );
}

export async function afterArticleDelete(slug: string): Promise<void> {
  await run(
    [{ kind: "article", slug }, { kind: "sitemap" }],
    () => search.removeArticle(slug)
  );
}

export async function afterSeriesChange(s: Series): Promise<void> {
  await run(
    [
      { kind: "series", slug: s.slug },
      { kind: "home" },
      { kind: "sitemap" },
    ],
    () => search.upsertSeries([s])
  );
}

export async function afterSeriesDelete(slug: string): Promise<void> {
  await run(
    [{ kind: "series", slug }, { kind: "sitemap" }],
    () => search.removeSeries(slug)
  );
}
