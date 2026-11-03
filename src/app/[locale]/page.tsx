import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { getProducts, getArticles } from "@/packages/data";
import ProductCard from "@/components/ProductCard";
import ArticleCard from "@/components/ArticleCard";
import { buildMetadata } from "@/packages/seo";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return params.then(async ({ locale }) => {
    const t = await getTranslations({ locale, namespace: "site" });
    return buildMetadata({
      locale: locale as "zh" | "en",
      path: "",
      title: t("name") + " · " + t("tagline"),
      description: t("description"),
    });
  });
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const l = locale as "zh" | "en";
  const t = await getTranslations({ locale, namespace: "home" });

  const products = (await getProducts(l)).slice(0, 4);
  const articles = (await getArticles(l)).slice(0, 3);

  return (
    <div className="container-page py-10">
      {/* Hero */}
      <section
        className="rounded-2xl text-white p-10 md:p-14"
        style={{ background: "linear-gradient(135deg, var(--color-brand-dark), var(--color-brand))" }}
      >
        <h1 className="text-3xl md:text-4xl font-bold mb-4">{t("heroTitle")}</h1>
        <p className="text-white/80 max-w-2xl mb-8">{t("heroSubtitle")}</p>
        <div className="flex gap-4">
          <Link
            href="/products"
            className="px-5 py-2.5 rounded-lg bg-white text-[var(--color-brand-dark)] font-medium hover:bg-white/90"
          >
            {t("ctaProducts")}
          </Link>
          <Link
            href="/contact"
            className="px-5 py-2.5 rounded-lg border border-white/40 text-white hover:bg-white/10"
          >
            {t("ctaContact")}
          </Link>
        </div>
      </section>

      {/* Advantages */}
      <section className="mt-12">
        <h2 className="text-xl font-semibold mb-6">{t("advantageTitle")}</h2>
        <div className="grid gap-5 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-[var(--color-line)] bg-white p-6">
              <h3 className="font-medium mb-2">
                {t(`adv${i}Title` as "adv1Title")}
              </h3>
              <p className="text-sm text-[var(--color-sub)]">{t(`adv${i}Desc` as "adv1Desc")}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Featured products */}
      <section className="mt-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">{t("featuredProducts")}</h2>
          <Link href="/products" className="text-sm text-[var(--color-brand)] hover:underline">
            {t("viewAll")} →
          </Link>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      {/* Latest news */}
      <section className="mt-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">{t("latestNews")}</h2>
          <Link href="/news" className="text-sm text-[var(--color-brand)] hover:underline">
            {t("viewAll")} →
          </Link>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {articles.map((a) => (
            <ArticleCard key={a.id} article={a} />
          ))}
        </div>
      </section>
    </div>
  );
}
