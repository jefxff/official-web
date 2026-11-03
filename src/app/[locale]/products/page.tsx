import { getTranslations, setRequestLocale } from "next-intl/server";
import { getProducts, searchProducts } from "@/packages/data";
import ProductCard from "@/components/ProductCard";
import { buildMetadata } from "@/packages/seo";
import ProductsSearch from "./ProductsSearch";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return params.then(async ({ locale }) => {
    const t = await getTranslations({ locale, namespace: "products" });
    return buildMetadata({
      locale: locale as "zh" | "en",
      path: "/products",
      title: t("title"),
      description: t("subtitle"),
    });
  });
}

export default async function ProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const l = locale as "zh" | "en";
  const t = await getTranslations({ locale, namespace: "products" });
  const { q } = await searchParams;

  const list = q ? await searchProducts(q, l) : await getProducts(l);

  return (
    <div className="container-page py-10">
      <h1 className="text-2xl font-semibold mb-2">{t("title")}</h1>
      <p className="text-[var(--color-sub)] mb-6">{t("subtitle")}</p>

      <ProductsSearch placeholder={t("searchPlaceholder")} />

      {list.length === 0 ? (
        <p className="text-[var(--color-sub)] py-12 text-center">{t("noResult")}</p>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {list.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
