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
    return [
      {
        source: "/:path*",
        headers: [
          // 基础安全头；CSP 在 S3 前结合 Next 内联脚本 nonce 方案细化（见评审意见）。
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
