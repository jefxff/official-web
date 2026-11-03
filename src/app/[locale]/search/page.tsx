import { getTranslations, setRequestLocale } from "next-intl/server";
import { searchProducts, getArticles } from "@/packages/data";
import { Link } from "@/i18n/routing";
import { buildMetadata } from "@/packages/seo";
import PageHeader from "@/components/PageHeader";
import ProductRow from "@/components/ProductRow";
import ArticleCard from "@/components/ArticleCard";
import SearchBox from "./SearchBox";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return params.then(async ({ locale }) => {
    const t = await getTranslations({ locale, namespace: "search" });
    return buildMetadata({
      locale: locale as "zh" | "en",
      path: "/search",
      title: t("title"),
      description: t("title"),
      noIndex: true,
    });
  });
}

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const l = locale as "zh" | "en";
  const t = await getTranslations({ locale, namespace: "search" });
  const tp = await getTranslations({ locale, namespace: "products" });
  const tn = await getTranslations({ locale, namespace: "nav" });
  const { q } = await searchParams;

  const query = (q ?? "").trim();
  const products = query ? await searchProducts(query, l) : [];
  const articles = query
    ? (await getArticles(l)).filter(
        (a) =>
          a.title.toLowerCase().includes(query.toLowerCase()) ||
          a.excerpt.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  const count = products.length + articles.length;

  return (
    <>
      <PageHeader index="07" title={t("title")} subtitle={t("placeholder")} />

      <div className="container-page py-10 md:py-14">
        <div className="max-w-3xl">
          <SearchBox placeholder={t("placeholder")} initial={query} />
        </div>

        {query && (
          <p className="mono mt-6 text-[11.5px] tracking-[0.1em] text-[var(--color-muted)]">
            <span className="text-[var(--color-amber)]">QUERY</span> “{query}” ·{" "}
            {t("resultCount", { count })}
          </p>
        )}

        {query && count === 0 && (
          <div className="mt-10 border border-[var(--color-line)] px-6 py-12 text-center">
            <p className="text-sm text-[var(--color-muted)]">{t("noResult")}</p>
            <Link href="/products" className="btn btn-ghost mt-6">
              {tp("title")}
            </Link>
          </div>
        )}

        {products.length > 0 && (
          <section className="mt-12">
            <div className="mb-2 flex items-baseline justify-between border-b border-[var(--color-line)] pb-3">
              <h2 className="h2-display text-[18px] text-[var(--color-bone)]">{tp("title")}</h2>
              <span className="label">
                {String(products.length).padStart(2, "0")}
              </span>
            </div>
            {products.map((p) => (
              <ProductRow key={p.id} product={p} />
            ))}
          </section>
        )}

        {articles.length > 0 && (
          <section className="mt-12">
            <div className="mb-2 flex items-baseline justify-between border-b border-[var(--color-line)] pb-3">
              <h2 className="h2-display text-[18px] text-[var(--color-bone)]">
                {tn("news")}
              </h2>
              <span className="label">{String(articles.length).padStart(2, "0")}</span>
            </div>
            {articles.map((a, i) => (
              <ArticleCard key={a.id} article={a} index={i} />
            ))}
          </section>
        )}
      </div>
    </>
  );
}
