import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import {
  assetOriginsFromEnv,
  buildCsp,
  cspModeForPath,
  generateNonce,
} from "./packages/security/csp";

/**
 * 中间件：语言路由 + 内容安全策略（CSP）。
 *
 * 执行顺序有意如此：
 *   1. 先按路径判定 CSP 档位（公开页 static / 后台 dynamic，理由见 packages/security/csp.ts）；
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

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const mode = isDev ? "static" : cspModeForPath(pathname);

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
