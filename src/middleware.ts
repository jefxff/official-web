import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import {
  assetOriginsFromEnv,
  buildCsp,
  cspModeForPath,
  generateNonce,
} from "./packages/security/csp";
import { ADMIN_COOKIE, verifySessionTokenEdge } from "./packages/auth/edge";

/**
 * 中间件：语言路由 + 内容安全策略（CSP）。
 *
 * 执行顺序有意如此：
 *   0. 先拦后台：/admin/**（登录页除外）无有效会话时**在渲染前**跳登录，
 *      避免页面内容被渲染进 307 响应的 RSC payload（详见 isProtectedAdminPath 注释）；
 *   1. 再按路径判定 CSP 档位（公开页 static / 后台 dynamic，理由见 packages/security/csp.ts）；
 *   2. dynamic 档生成 nonce，并通过**请求头**把 `content-security-policy` 交给 Next，
 *      Next 会解析其中的 nonce 并注入到框架自身的 `<script>` 标签；
 *   3. static 档交给 next-intl 做语言重写/重定向（其内部会复制请求头，故可安全串联）。
 *
 * 注意：开发环境统一走 static 档。React Refresh / HMR 依赖 eval 与动态注入，
 * 强行上 nonce 会让本地调试频繁白屏；nonce 的正确性由生产构建（`next start`）验证。
 */

const intlMiddleware = createMiddleware(routing);

const isDev = process.env.NODE_ENV !== "production";
const assetOrigins = assetOriginsFromEnv();

/**
 * 后台路径的鉴权必须在这里做，而不是只靠 (protected)/layout.tsx。
 *
 * 原因（实测过）：App Router 的布局与页面是并行渲染的，layout 里的 redirect()
 * 虽然让浏览器拿到 307，但页面内容已被渲染并序列化进该 307 的 RSC payload ——
 * 未登录者用普通 HTTP 客户端即可读到后台数据；/admin/setup 更会把 TOTP 种子
 * （otpauth://...?secret=XXX）一起带出去。中间件在渲染前拦截，响应体里什么都没有。
 */
function isProtectedAdminPath(pathname: string): boolean {
  if (pathname !== "/admin" && !pathname.startsWith("/admin/")) return false;
  return pathname !== "/admin/login";
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const mode = isDev ? "static" : cspModeForPath(pathname);

  if (isProtectedAdminPath(pathname)) {
    const token = request.cookies.get(ADMIN_COOKIE)?.value;
    const valid = token ? await verifySessionTokenEdge(token) : false;
    if (!valid) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      url.search = "";
      const redirect = NextResponse.redirect(url, 307);
      // 跳转响应同样不允许被缓存，且携带 nonce 档 CSP
      redirect.headers.set("Cache-Control", "no-store");
      redirect.headers.set(
        "Content-Security-Policy",
        buildCsp({ mode: "dynamic", nonce: generateNonce(), dev: isDev, assetOrigins })
      );
      return redirect;
    }
  }

  if (mode === "dynamic") {
    const nonce = generateNonce();
    const csp = buildCsp({ mode, nonce, dev: isDev, assetOrigins });

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("content-security-policy", csp);

    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("Content-Security-Policy", csp);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  const csp = buildCsp({ mode: "static", assetOrigins });
  const response = intlMiddleware(request) as NextResponse;
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // 跳过 API（JSON 响应无需 CSP）、Next 内部资源与静态文件；后台纳入以覆盖动态档策略。
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
