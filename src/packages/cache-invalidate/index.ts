import { routing, type Locale } from "@/i18n/routing";

/**
 * 缓存失效模块（v1.2 §6 / §11 + 评审意见）。
 *
 * 设计要点：
 * 1) tag → URL 清单的映射集中在本文件，禁止散落在各调用点（避免漏 Purge）。
 * 2) 双语路径：每个内容 URL 同时生成 /zh 与 /en 两份。
 * 3) 海外（global）构建走 Cloudflare 边缘缓存，发布事件触发 Purge by URL。
 * 4) 海外「新页面可达性」（评审指出的最大缺口）：边缘只含构建时产物，
 *    新料号页发布后海外会 404。缓解由 Cloudflare Worker 负责——
 *    对边缘 cache MISS 回落反代到国内源站（见 §6.5 Worker 配置），
 *    本模块仅负责 URL 清单的生成与 Purge 调用。
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.fmw.example";
const CF_ZONE_ID = process.env.CF_ZONE_ID;
const CF_API_TOKEN = process.env.CF_API_TOKEN;

export type CacheTag =
  | { kind: "home" }
  | { kind: "product"; mpn: string }
  | { kind: "series"; slug: string }
  | { kind: "article"; slug: string }
  | { kind: "sitemap" };

function localized(path: string): string[] {
  return ([...routing.locales] as Locale[]).map((l) => `${SITE_URL}/${l}${path}`);
}

/** 将缓存标签展开为需要失效的完整 URL 列表（集中映射规则） */
export function expandTagToUrls(tag: CacheTag): string[] {
  switch (tag.kind) {
    case "home":
      return localized("");
    case "product":
      return localized(`/products/${tag.mpn}`);
    case "series":
      return localized(`/series/${tag.slug}`);
    case "article":
      return localized(`/news/${tag.slug}`);
    case "sitemap":
      return [`${SITE_URL}/sitemap.xml`, `${SITE_URL}/robots.txt`];
  }
}

export function expandTagsToUrls(tags: CacheTag[]): string[] {
  const set = new Set<string>();
  for (const t of tags) for (const u of expandTagToUrls(t)) set.add(u);
  return [...set];
}

/**
 * 调用 Cloudflare 按 URL 批量失效（仅 global 构建需要）。
 * 文档：POST /client/v4/zones/{zone_id}/purge_cache  body { files: [...] }
 * 注意单次最多 30 个 URL（CF 限制），超出需分批。
 */
export async function purgeByUrls(urls: string[]): Promise<{ ok: boolean; purged: number; error?: string }> {
  if (!CF_ZONE_ID || !CF_API_TOKEN) {
    // 未配置 CF 凭证（例如纯本地 dev / cn 构建）→ 视为 no-op，不阻断发布流程。
    return { ok: true, purged: 0, error: "CF credentials not configured (no-op)" };
  }

  const BATCH = 30;
  let purged = 0;
  for (let i = 0; i < urls.length; i += BATCH) {
    const batch = urls.slice(i, i + BATCH);
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/purge_cache`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${CF_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ files: batch }),
      }
    );
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, purged, error: `CF purge failed: ${res.status} ${text}` };
    }
    purged += batch.length;
  }
  return { ok: true, purged };
}

/** 内容发布后的标准失效流程 */
export async function invalidateOnPublish(tags: CacheTag[]): Promise<void> {
  const urls = expandTagsToUrls(tags);
  if (urls.length === 0) return;
  const result = await purgeByUrls(urls);
  if (!result.ok) {
    console.error("[cache-invalidate]", result.error);
    // 按 v1.2 故障演练，Purge 失败不应阻断发布，但需告警。
  }
}
