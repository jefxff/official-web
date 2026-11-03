import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getArticleBySlug, getArticles } from "@/packages/data";
import { Link } from "@/i18n/routing";
import { buildMetadata } from "@/packages/seo";
import dayjs from "dayjs";

export async function generateStaticParams() {
  const articles = await getArticles("zh");
  return articles.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const article = await getArticleBySlug(slug, locale as "zh" | "en");
  if (!article) return {};
  return buildMetadata({
    locale: locale as "zh" | "en",
    path: `/news/${slug}`,
    title: article.title,
    description: article.excerpt,
  });
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const l = locale as "zh" | "en";
  const t = await getTranslations({ locale, namespace: "news" });

  const article = await getArticleBySlug(slug, l);
  if (!article) notFound();

  return (
    <article className="container-page py-10 max-w-3xl">
      <Link href="/news" className="text-sm text-[var(--color-brand)] hover:underline">
        ← {t("backToList")}
      </Link>
      <div className="text-xs text-[var(--color-sub)] mt-4 mb-2">
        {t("publishedOn")} {dayjs(article.publishedAt).format("YYYY-MM-DD")}
      </div>
      <h1 className="text-2xl font-semibold mb-6">{article.title}</h1>
      <div className="prose-page text-[var(--color-ink)] leading-relaxed">
        <p>{article.body}</p>
      </div>
    </article>
  );
}
