import { getTranslations, setRequestLocale } from "next-intl/server";
import { searchProducts, getArticles } from "@/packages/data";
import { Link } from "@/i18n/routing";
import { buildMetadata } from "@/packages/seo";
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
    <div className="container-page py-10 max-w-3xl">
      <h1 className="text-2xl font-semibold mb-6">{t("title")}</h1>
      <SearchBox placeholder={t("placeholder")} initial={query} />

      {query && (
        <p className="text-sm text-[var(--color-sub)] mt-4">
          {t("resultCount", { count })}
        </p>
      )}

      {query && count === 0 && (
        <p className="text-[var(--color-sub)] py-8 text-center">{t("noResult")}</p>
      )}

      <div className="mt-6 space-y-3">
        {products.map((p) => (
          <Link
            key={p.id}
            href={`/products/${p.mpn}`}
            className="block rounded-lg border border-[var(--color-line)] bg-white p-4 hover:border-[var(--color-brand)]"
          >
            <div className="font-mono text-sm text-[var(--color-brand)]">{p.mpn}</div>
            <div className="font-medium">{p.name}</div>
          </Link>
        ))}
        {articles.map((a) => (
          <Link
            key={a.id}
            href={`/news/${a.slug}`}
            className="block rounded-lg border border-[var(--color-line)] bg-white p-4 hover:border-[var(--color-brand)]"
          >
            <div className="font-medium">{a.title}</div>
            <div className="text-sm text-[var(--color-sub)]">{a.excerpt}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
