import type { ReactNode } from "react";

/**
 * 页头（内页通用）：编号 + 展示字标题 + 右侧规格元数据。
 *
 * 所有内页共用同一个页头骨架，是为了让「标题在同一个高度出现」这件事变成
 * 全站纪律：翻页时视线不需要重新找标题。右侧的元数据条则让每页带一点
 * 只有这页才有的信息（料号数、系列数），避免模板感。
 */
export default function PageHeader({
  index,
  title,
  subtitle,
  meta,
  aside,
}: {
  index: string;
  title: string;
  subtitle?: string;
  meta?: { label: string; value: string }[];
  aside?: ReactNode;
}) {
  return (
    <section className="border-b border-[var(--color-line)] bg-[var(--color-void)]">
      <div className="container-page flex flex-col gap-8 pt-9 pb-9 md:flex-row md:items-end md:justify-between md:gap-10 md:pt-12 md:pb-11">
        <div className="min-w-0">
          <div className="enter enter-1 label flex items-center gap-2">
            <span className="text-[var(--color-amber)]">{index}</span>
            <span className="h-px w-5 bg-[var(--color-line)]" aria-hidden />
            <span>FMW</span>
          </div>
          <h1 className="enter enter-2 display mt-4 text-[clamp(2.1rem,4.2vw,3.3rem)] text-[var(--color-bone)]">
            {title}
          </h1>
          {subtitle && (
            <p className="enter enter-3 mt-4 max-w-[54ch] text-[14.5px] leading-relaxed text-[var(--color-muted)]">
              {subtitle}
            </p>
          )}
        </div>

        {aside}

        {meta && meta.length > 0 && (
          <dl className="enter enter-4 flex shrink-0 flex-wrap items-start gap-x-10 gap-y-4 border-t border-[var(--color-line)] pt-5 md:border-t-0 md:border-l md:pt-0 md:pl-10">
            {meta.map((m) => (
              <div key={m.label}>
                <dt className="label">{m.label}</dt>
                <dd className="num mt-1.5 text-[26px] leading-none font-semibold text-[var(--color-bone)]">
                  {m.value}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
}
