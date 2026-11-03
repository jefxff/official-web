import type { Metadata } from "next";
import { routing, type Locale } from "@/i18n/routing";

/**
 * 统一的 SEO/Metadata 构造器（v1.2 §7 / §12）。
 * - canonical 指向当前区域对外域名（NEXT_PUBLIC_SITE_URL）
 * - 自动输出双语 hreflang 互链 + x-default
 * - OGP 基础字段
 */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.fmw.example";

export function absoluteUrl(path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${clean}`;
}

export interface BuildMetaInput {
  locale: Locale;
  /** 不含 locale 前缀的路径，例如 /products/FM123 */
  path: string;
  title: string;
  description: string;
  /** 可选：覆盖默认 OG 图 */
  ogImage?: string;
  keywords?: string[];
  noIndex?: boolean;
}

export function buildMetadata({
  locale,
  path,
  title,
  description,
  ogImage,
  keywords,
  noIndex,
}: BuildMetaInput): Metadata {
  const localizedPaths = routing.locales.map((l) => ({
    locale: l,
    url: absoluteUrl(`/${l}${path}`),
  }));

  const languages: Record<string, string> = {};
  for (const { locale: l, url } of localizedPaths) {
    languages[l] = url;
  }
  languages["x-default"] = absoluteUrl(`/${routing.defaultLocale}${path}`);

  const canonical = absoluteUrl(`/${locale}${path}`);

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical,
      languages,
    },
    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "FMW",
      locale: locale === "zh" ? "zh_CN" : "en_US",
      type: "website",
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}
