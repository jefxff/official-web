import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getSeriesBySlug, getProductsBySeries } from "@/packages/data";
import { buildMetadata } from "@/packages/seo";
import ProductCard from "@/components/ProductCard";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const series = await getSeriesBySlug(slug, locale as "zh" | "en");
  if (!series) return {};
  return buildMetadata({
    locale: locale as "zh" | "en",
    path: `/series/${slug}`,
    title: series.name,
    description: series.description ?? series.name,
  });
}

export default async function SeriesDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const l = locale as "zh" | "en";

  const series = await getSeriesBySlug(slug, l);
  if (!series) notFound();
  const products = await getProductsBySeries(series.id, l);

  return (
    <div className="container-page py-10">
      <h1 className="text-2xl font-semibold mb-2">{series.name}</h1>
      {series.description && (
        <p className="text-[var(--color-sub)] mb-8 max-w-2xl">{series.description}</p>
      )}

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </div>
  );
}
