import { getTranslations, setRequestLocale } from "next-intl/server";
import { getArticles } from "@/packages/data";
import ArticleCard from "@/components/ArticleCard";
import PageHeader from "@/components/PageHeader";
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

  const [lead, ...rest] = articles;

  return (
    <>
      <PageHeader
        index="03"
        title={t("title")}
        subtitle={t("subtitle")}
        meta={[{ label: t("items"), value: String(articles.length).padStart(2, "0") }]}
      />

      <div className="container-page py-10 md:py-14">
        <div className="grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
          {lead && <ArticleCard article={lead} variant="feature" />}

          <div className="self-start border-t border-[var(--color-line)]">
            {rest.map((a, i) => (
              <ArticleCard key={a.id} article={a} index={i} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
