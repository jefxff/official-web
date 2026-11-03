/**
 * 内容安全策略（CSP）构造器 —— v1.2 §12 安全基线的落地实现。
 *
 * ## 为什么分两档，而不是全站 nonce
 *
 * 「nonce + strict-dynamic」是最强策略，但它要求 HTML 在**每次请求**时重新生成
 * 才能把 nonce 写进 `<script>` 标签。这会带来两个与本项目架构正面冲突的后果：
 *
 *  1. 公开页面被迫退化为动态渲染（`ƒ`），失去 SSG/ISR；
 *  2. 失去静态产物就无法被 Cloudflare 边缘缓存命中，海外「缓存 MISS → 回源国内」
 *     的整条链路退化为「每次请求穿透回源」，双区域架构的核心收益消失。
 *
 * 因此按路由类型分档（这是权衡后的取舍，不是遗漏）：
 *
 *  - `dynamic`（后台 / 登录 / 设置等）：本来就动态渲染、不可缓存、且是唯一写入口，
 *    采用 `nonce + strict-dynamic` 严格策略，XSS 收益最大化。
 *  - `static`（全部公开页面）：保留 SSG/ISR 与边缘缓存，`script-src` 使用
 *    `'self' 'unsafe-inline'`。作为补偿，本站**不渲染任何用户输入的 HTML**
 *    （资讯正文按纯文本输出，`dangerouslySetInnerHTML` 全仓库零使用），
 *    内联脚本注入面收敛到 Next 自身产物。
 *
 * 后续若监管要求全站 nonce，正确路径是把公开页迁到「SSR + CDN stale-while-revalidate」，
 * 需要同时重估双区域缓存收益，属于架构级变更，不在本次范围内。
 */

/** 依赖注入用：dev 环境的额外放行项（HMR / React Refresh 需要 eval）。 */
const DEV_SCRIPT_EXTRA = ["'unsafe-eval'", "'unsafe-inline'"] as const;
const DEV_CONNECT_EXTRA = ["ws:", "wss:"] as const;

export type CspMode = "static" | "dynamic";

export interface BuildCspOptions {
  mode: CspMode;
  /** mode=dynamic 时必传；Next.js 会自动把它注入框架脚本标签 */
  nonce?: string;
  /** 是否开发环境（放宽 HMR 所需指令） */
  dev?: boolean;
  /** 额外的资源域名（CDN / 对象存储），用于 img-src 与 connect-src */
  assetOrigins?: string[];
}

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

/**
 * 生成一次性 nonce。使用 Web Crypto，Node 与 Edge Runtime 通用。
 * 16 字节随机 + base64，符合 CSP 对 nonce 的熵要求。
 */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/** 由 NEXT_PUBLIC_ASSET_PREFIX 推导 CDN 源，避免策略与实际资源域名漂移。 */
export function assetOriginsFromEnv(): string[] {
  const prefix = process.env.NEXT_PUBLIC_ASSET_PREFIX;
  if (!prefix) return [];
  try {
    return [new URL(prefix).origin];
  } catch {
    return [];
  }
}

export function buildCsp({
  mode,
  nonce,
  dev = false,
  assetOrigins = [],
}: BuildCspOptions): string {
  const origins = uniq(assetOrigins);

  let scriptSrc: string[];
  if (mode === "dynamic" && nonce) {
    scriptSrc = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"];
    if (dev) scriptSrc.push(...DEV_SCRIPT_EXTRA);
  } else {
    scriptSrc = ["'self'", "'unsafe-inline'"];
    if (dev) scriptSrc.push("'unsafe-eval'");
  }

  const connectSrc = ["'self'", ...origins];
  if (dev) connectSrc.push(...DEV_CONNECT_EXTRA);

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": scriptSrc,
    // Tailwind v4 与 Next 都会输出内联 <style>，样式层不做 nonce 化（收益低、破坏面大）。
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", ...origins],
    "font-src": ["'self'", "data:"],
    "connect-src": connectSrc,
    "media-src": ["'self'", ...origins],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'self'"],
    "frame-src": ["'none'"],
    "manifest-src": ["'self'"],
    "worker-src": ["'self'", "blob:"],
  };

  return Object.entries(directives)
    .map(([key, values]) => `${key} ${uniq(values).join(" ")}`)
    .join("; ");
}

/** 语义化辅助：给定路径判断采用哪一档策略。 */
export function cspModeForPath(pathname: string): CspMode {
  // 后台全部动态渲染（admin/layout.tsx 已置 force-dynamic），可用 nonce 严格策略。
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "dynamic";
  return "static";
}
