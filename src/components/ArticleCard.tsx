import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import type { Article } from "@/packages/data/types";
import dayjs from "dayjs";

export default function ArticleCard({ article }: { article: Article }) {
  const t = useTranslations("news");
  const date = dayjs(article.publishedAt).format("YYYY-MM-DD");

  return (
    <Link
      href={`/news/${article.slug}`}
      className="block rounded-xl border border-[var(--color-line)] bg-white p-5 hover:shadow-md hover:border-[var(--color-brand)] transition"
    >
      <div className="text-xs text-[var(--color-sub)] mb-2">{date}</div>
      <h3 className="font-medium text-[var(--color-ink)] leading-snug mb-1">{article.title}</h3>
      <p className="text-sm text-[var(--color-sub)] line-clamp-2">{article.excerpt}</p>
      <div className="mt-3 text-xs text-[var(--color-brand)]">{t("readMore")} →</div>
    </Link>
  );
}
