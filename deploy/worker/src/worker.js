/**
 * 富满微官网 · 海外边缘 Worker（v1.2 §6.5 + 评审 #1/#2 落地）
 *
 * 职责：
 *  1) 边缘缓存（Cache API）：对 GET 的 HTML/静态资源做边缘缓存，降低回源率。
 *  2) 缓存 MISS 回落反代国内源站（核心）：关闭「海外新页面 404」缺口。
 *     国内 Next.js（BUILD_TARGET=cn）Node 运行时可 ISR 按需生成新料号页，
 *     边缘未命中时回源拿到 200 并写入边缘缓存，后续海外访问即命中。
 *  3) 写面屏蔽：/admin 与 /api/v1/admin 为「国内唯一写点」，海外公开边缘一律 403，
 *     杜绝把后台/写接口暴露到公网。
 *  4) Server Action / API：非 GET 请求（如带 Next-Action 头的页面 POST、/api/* 写接口）
 *     不缓存，直接反代到源站。说明：本站点公开表单统一走显式 /api/v1/* Route Handler，
 *     Server Action 仅用于国内可达后台，海外无需处理；此处仍对未知 POST 兜底反代。
 */

const BLOCK_PREFIXES = ["/admin", "/api/v1/admin"];

function isBlocked(pathname) {
  return BLOCK_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function buildOriginRequest(request, originHost) {
  const url = new URL(request.url);
  url.hostname = originHost;
  url.protocol = "https:";
  // 反代时改写 Host/Origin 为源站，确保国内源站识别正确的虚拟主机与 CORS。
  const headers = new Headers(request.headers);
  headers.set("Host", originHost);
  headers.set("Origin", `https://${originHost}`);
  headers.set("X-Forwarded-For", request.headers.get("cf-connecting-ip") || "");
  return new Request(url.toString(), {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    redirect: "follow",
  });
}

function isCacheable(request, response) {
  if (request.method !== "GET") return false;
  if (!response.ok) return false; // 不缓存 4xx/5xx（尤其 404 新页面未生成时）
  const ct = response.headers.get("content-type") || "";
  // 仅缓存 HTML 页面与静态资源；API/JSON 不缓存（避免 Accept 头缓存陷阱）。
  if (ct.includes("application/json")) return false;
  return true; // html / js / css / 图片 等
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const originHost = env.ORIGIN_HOST;
    const ttl = Number(env.CACHE_TTL || 300);

    // 写面屏蔽（评审：保护国内唯一写点）
    if (isBlocked(url.pathname)) {
      return new Response("Forbidden", { status: 403 });
    }

    // 非 GET 一律直接反代（Server Action / 写接口），不缓存
    if (request.method !== "GET" && request.method !== "HEAD") {
      return fetch(buildOriginRequest(request, originHost));
    }

    const cache = caches.default;
    const cacheKey = new Request(url.toString(), { method: "GET", headers: { Accept: "text/html" } });

    // 尝试边缘命中
    let response = await cache.match(cacheKey);
    if (response) {
      const h = new Headers(response.headers);
      h.set("CF-Cache-Status", "HIT");
      return new Response(response.body, { status: response.status, headers: h });
    }

    // MISS → 回源（关闭新页面 404 缺口）
    response = await fetch(buildOriginRequest(request, originHost));
    const h = new Headers(response.headers);
    h.set("CF-Cache-Status", "MISS");

    if (isCacheable(request, response)) {
      h.set("Cache-Control", `public, max-age=${ttl}, stale-while-revalidate=60`);
      // 克隆后再 put，避免消费 body
      await cache.put(cacheKey, response.clone());
    }
    return new Response(response.body, { status: response.status, headers: h });
  },
};
