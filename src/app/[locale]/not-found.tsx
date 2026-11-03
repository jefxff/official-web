"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";

/**
 * 404：把错误码本身做成展示字（描边大字），比插画更符合这套「仪表」语汇，
 * 也省掉一个永远不会被优化的图片资源。
 */
export default function NotFound() {
  const t = useTranslations("common");
  const tn = useTranslations("nav");

  return (
    <section className="relative overflow-hidden bg-[var(--color-void)]">
      <div aria-hidden className="grid-paper absolute inset-0 opacity-70" />
      <div className="container-page relative z-10 flex flex-col items-center py-24 text-center md:py-32">
        <div className="label flex items-center gap-2">
          <span className="text-[var(--color-amber)]">Error</span>
          <span className="h-px w-5 bg-[var(--color-line)]" aria-hidden />
          <span>404</span>
        </div>
        <div className="mono stroke-type-dark mt-4 text-[clamp(5rem,18vw,12rem)] leading-none font-extrabold tracking-[-0.04em]">
          404
        </div>
        <div className="mt-2 h-px w-16 bg-[var(--color-amber)]" aria-hidden />
        <h1 className="h2-display mt-4 text-[clamp(1.5rem,3vw,2.2rem)] text-[var(--color-bone)]">
          {t("notFound")}
        </h1>
        <p className="mt-3 max-w-[42ch] text-sm leading-relaxed text-[var(--color-muted)]">
          {t("notFoundDesc")}
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Link href="/" className="btn btn-primary">
            {t("backHome")}
            <span className="arw">→</span>
          </Link>
          <Link href="/products" className="btn btn-ghost">
            {tn("products")}
          </Link>
        </div>
      </div>
    </section>
  );
}
