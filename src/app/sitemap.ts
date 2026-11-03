import type { MetadataRoute } from "next";
import { routing, type Locale } from "@/i18n/routing";
import { getProducts, getArticles, getSeriesList } from "@/packages/data";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.fmw.example";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const locales = [...routing.locales] as Locale[];
  const staticPaths = ["", "/products", "/series", "/news", "/about", "/contact", "/search"];

  const products = await getProducts("zh");
  const articles = await getArticles("zh");
  const series = await getSeriesList("zh");

  const entries: MetadataRoute.Sitemap = [];

  const push = (path: string) => {
    const languages: Record<string, string> = {};
    for (const l of locales) languages[l] = `${SITE_URL}/${l}${path}`;
    entries.push({
      url: `${SITE_URL}/${routing.defaultLocale}${path}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: path === "" ? 1 : 0.7,
      alternates: { languages },
    });
  };

  staticPaths.forEach(push);
  products.forEach((p) => push(`/products/${p.mpn}`));
  series.forEach((s) => push(`/series/${s.slug}`));
  articles.forEach((a) => push(`/news/${a.slug}`));

  return entries;
}
