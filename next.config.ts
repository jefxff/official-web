import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/**
 * 双区域构建配置（依据 v1.2 §6.3 / §11）。
 * 通过 env 驱动，避免为 CN / Global 维护两套代码：
 *   BUILD_TARGET = cn | global
 *   NEXT_PUBLIC_SITE_URL  —— 当前区域对外域名（用于 canonical / sitemap / OGP）
 *   NEXT_PUBLIC_ASSET_PREFIX —— 可选：CDN 资源前缀（global 走 CF，cn 走阿里云 CDN）
 */
const buildTarget = process.env.BUILD_TARGET ?? "cn";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.fmw.example";
const assetPrefix = process.env.NEXT_PUBLIC_ASSET_PREFIX ?? "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  assetPrefix: assetPrefix || undefined,
  // 部署镜像按 standalone 产出（Dockerfile 复制 .next/standalone）：
  // 不开这一项时该目录根本不存在，镜像会缺 server.js 而启动失败。
  output: "standalone",
  env: {
    BUILD_TARGET: buildTarget,
    NEXT_PUBLIC_SITE_URL: siteUrl,
  },
  experimental: {
    // 海外 global 构建需产出可被边缘静态服务的产物；保留 ISR 能力供国内使用。
    optimizePackageImports: ["react", "react-dom"],
  },
  images: {
    // 仅允许受信任的图片源；第三方图床一律走自有 CDN（见 v1.2 §12 安全基线）。
    remotePatterns: [
      { protocol: "https", hostname: "cdn.fmw.example" },
    ],
  },
  async headers() {
    // CSP 由 middleware 逐请求下发（分档策略见 src/packages/security/csp.ts），
    // 这里只放与请求无关、可长期静态生效的响应头。
    const baseHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
      // 隔离跨源窗口引用：防止被第三方站点通过 window.opener 反向操纵。
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      { key: "X-DNS-Prefetch-Control", value: "off" },
    ];

    // HSTS 只在生产开启：本地下发会让浏览器强制 https，污染开发环境的 localhost。
    if (process.env.NODE_ENV === "production") {
      baseHeaders.push({
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains",
      });
    }

    return [
      { source: "/:path*", headers: baseHeaders },
      {
        // 后台与写接口一律禁止任何中间层缓存（含 CDN 的边缘缓存）。
        source: "/admin/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
      },
      {
        source: "/api/v1/admin/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
