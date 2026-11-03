import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import type { Article } from "@/packages/data/types";
import dayjs from "dayjs";

/**
 * 资讯条目，两种形态：
 *
 *  - feature：带封面的大条目，用于首页与资讯页的头条（图在上，标题在下）
 *  - row：无图的编辑式列表行，靠序号与日期对齐，适合扫读
 *
 * 图片用原生 img：这些封面来自自有静态目录，走 next/image 会引入额外
 * 优化服务与域名白名单，在「国内单区域、先不上 CDN」的前提下是净负担。
 *
 * 封面是无文字的图版（栅格 + 同心环 + 期号），所以标题必须放在图外 ——
 * 一套素材要在中英两站共用，把标题烙进图片会让另一站露出错语言。
 */
export default function ArticleCard({
  article,
  variant = "row",
  index,
}: {
  article: Article;
  variant?: "feature" | "row";
  index?: number;
}) {
  const t = useTranslations("news");
  const date = dayjs(article.publishedAt).format("YYYY.MM.DD");
  const rawDate = dayjs(article.publishedAt).format("YYYY-MM-DD");

  if (variant === "feature") {
    return (
      <Link href={`/news/${article.slug}`} className="group block">
        <div className="relative aspect-[16/10] overflow-hidden border border-[var(--color-line)] bg-[var(--color-surface-2)]">
          {article.coverImage && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={article.coverImage}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-[900ms] group-hover:scale-[1.03]"
              style={{ transitionTimingFunction: "cubic-bezier(0.16,1,0.3,1)" }}
            />
          )}
          <span className="mono absolute top-4 left-4 bg-white/90 px-2 py-1 text-[10px] tracking-[0.14em] text-[var(--color-bone)] uppercase backdrop-blur">
            {t("title")}
          </span>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <time
            dateTime={rawDate}
            className="mono text-[11px] tracking-[0.08em] text-[var(--color-muted)]"
          >
            {date}
          </time>
          <span className="h-px w-6 bg-[var(--color-line)]" aria-hidden />
          <span className="mono text-[11px] text-[var(--color-amber)]">FMW NEWS</span>
        </div>

        <h3 className="h2-display mt-3 max-w-[26ch] text-[clamp(1.25rem,2.1vw,1.7rem)] text-[var(--color-bone)] transition-colors group-hover:text-[var(--color-amber)]">
          {article.title}
        </h3>
        <p className="mt-2.5 line-clamp-2 max-w-[54ch] text-[13.5px] leading-relaxed text-[var(--color-muted)]">
          {article.excerpt}
        </p>
        <span className="mt-4 inline-flex items-center gap-2 text-[13px] font-medium text-[var(--color-amber)]">
          {t("readMore")}
          <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
        </span>
      </Link>
    );
  }

  return (
    <Link
      href={`/news/${article.slug}`}
      className="group grid grid-cols-[auto_1fr_auto] items-baseline gap-4 border-b border-[var(--color-line-soft)] py-5 transition-colors hover:border-[var(--color-line)] md:gap-6"
    >
      {typeof index === "number" && (
        <span className="mono text-[11px] text-[var(--color-muted)] transition-colors group-hover:text-[var(--color-amber)]">
          {String(index + 1).padStart(2, "0")}
        </span>
      )}
      <div className="min-w-0">
        <h3 className="text-[15px] leading-snug font-medium text-[var(--color-bone)] transition-colors group-hover:text-[var(--color-amber)]">
          {article.title}
        </h3>
        <p className="mt-1.5 line-clamp-1 text-[12.5px] text-[var(--color-muted)]">
          {article.excerpt}
        </p>
      </div>
      <time
        dateTime={rawDate}
        className="mono hidden shrink-0 text-[11px] tracking-[0.06em] text-[var(--color-muted)] sm:block"
      >
        {date}
      </time>
    </Link>
  );
}
