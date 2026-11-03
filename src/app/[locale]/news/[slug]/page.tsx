import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getArticleBySlug, getArticles } from "@/packages/data";
import { Link } from "@/i18n/routing";
import { buildMetadata } from "@/packages/seo";
import { Markdown } from "@fmw/markdown";
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
  const tn = await getTranslations({ locale, namespace: "nav" });

  const article = await getArticleBySlug(slug, l);
  if (!article) notFound();

  const date = dayjs(article.publishedAt).format("YYYY.MM.DD");
  const rawDate = dayjs(article.publishedAt).format("YYYY-MM-DD");

  return (
    <article>
      <header className="border-b border-[var(--color-line)]">
        <div className="container-narrow pt-10 pb-10 md:pt-14 md:pb-12">
          <Link
            href="/news"
            className="mono inline-flex items-center gap-2 text-[11px] tracking-[0.12em] text-[var(--color-muted)] uppercase transition-colors hover:text-[var(--color-amber)]"
          >
            ← {t("backToList")}
          </Link>

          <div className="mono mt-8 flex items-center gap-3 text-[11px] tracking-[0.1em] text-[var(--color-muted)]">
            <span className="text-[var(--color-amber)]">{t("title")}</span>
            <span className="h-px w-8 bg-[var(--color-line)]" aria-hidden />
            <time dateTime={rawDate}>
              {t("publishedOn")} {date}
            </time>
          </div>

          <h1 className="enter enter-1 display mt-5 text-[clamp(1.9rem,4vw,3rem)] text-[var(--color-bone)]">
            {article.title}
          </h1>
          <p className="mt-5 max-w-[58ch] text-[15.5px] leading-relaxed text-[var(--color-bone-2)]">
            {article.excerpt}
          </p>
        </div>
      </header>

      <div className="container-narrow py-10 md:py-14">
        <div className="prose-page">
          <Markdown source={article.body} />
        </div>

        <div className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--color-line)] pt-6">
          <Link
            href="/news"
            className="mono text-[11px] tracking-[0.12em] text-[var(--color-muted)] uppercase transition-colors hover:text-[var(--color-amber)]"
          >
            ← {t("backToList")}
          </Link>
          <Link href="/contact" className="btn btn-ghost">
            {tn("contact")}
            <span className="arw">→</span>
          </Link>
        </div>
      </div>
    </article>
  );
}
