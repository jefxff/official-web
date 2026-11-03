import { getTranslations, setRequestLocale } from "next-intl/server";
import { getArticles } from "@/packages/data";
import ArticleCard from "@/components/ArticleCard";
import { buildMetadata } from "@/packages/seo";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return params.then(async ({ locale }) => {
    const t = await getTranslations({ locale, namespace: "news" });
    return buildMetadata({
      locale: locale as "zh" | "en",
      path: "/news",
      title: t("title"),
      description: t("subtitle"),
    });
  });
}

export default async function NewsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const l = locale as "zh" | "en";
  const t = await getTranslations({ locale, namespace: "news" });
  const articles = await getArticles(l);

  return (
    <div className="container-page py-10">
      <h1 className="text-2xl font-semibold mb-2">{t("title")}</h1>
      <p className="text-[var(--color-sub)] mb-8">{t("subtitle")}</p>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {articles.map((a) => (
          <ArticleCard key={a.id} article={a} />
        ))}
      </div>
    </div>
  );
}
