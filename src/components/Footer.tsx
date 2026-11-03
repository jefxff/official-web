import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";

/**
 * 页脚：墨黑段收底。
 *
 * 亮场页面如果一路白到底，翻到最后会觉得「没结束」。国内做得好的一线官网
 * 通常用一个深色页脚把页面压住 —— 这里用同一套令牌的 .on-ink 作用域，
 * 内部的 text-[var(--color-bone)] 会自动变成浅色，不需要单独写一套颜色。
 *
 * 封底的巨型 FMW 是字标而不是装饰：它给整页一个明确的底边重量。
 */
export default function Footer() {
  const t = useTranslations("footer");
  const tn = useTranslations("nav");
  const ts = useTranslations("site");

  return (
    <footer className="on-ink mt-0">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.5fr_1fr_1fr_1fr] md:gap-8 lg:py-16">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-[2px] bg-[var(--color-amber)] text-[12.5px] font-bold text-white">
              FM
            </span>
            <span className="text-[16px] font-bold text-[var(--color-bone)]">
              {ts("name")}
            </span>
          </div>
          <p className="mt-5 max-w-[34ch] text-[13px] leading-relaxed text-[var(--color-muted)]">
            {ts("description")}
          </p>
          <Link href="/contact" className="arrow-link mt-6">
            {tn("contact")}
          </Link>
        </div>

        <div>
          <div className="label mb-4">{t("links")}</div>
          <ul className="space-y-2.5 text-[13.5px]">
            {[
              { href: "/products", label: tn("products") },
              { href: "/series", label: tn("series") },
              { href: "/news", label: tn("news") },
              { href: "/about", label: tn("about") },
            ].map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="link-sweep text-[var(--color-bone-2)] transition-colors hover:text-[var(--color-bone)]"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="label mb-4">{t("contact")}</div>
          <ul className="space-y-2.5 text-[13.5px] text-[var(--color-bone-2)]">
            <li className="mono text-[13px]">sales@fmw.example</li>
            <li className="mono text-[13px]">+86 400-000-0000</li>
            <li className="text-[var(--color-muted)]">深圳市 · 福田区</li>
            <li className="pt-1">
              <Link
                href="/search"
                className="mono text-[11px] tracking-[0.1em] text-[var(--color-muted)] uppercase transition-colors hover:text-[var(--color-amber)]"
              >
                {tn("search")} ↗
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <div className="label mb-4">Capability</div>
          <ul className="space-y-2.5 text-[13px] text-[var(--color-muted)]">
            <li>模拟 · 电源管理</li>
            <li>功率器件</li>
            <li>信号链</li>
            <li>封装与测试</li>
          </ul>
        </div>
      </div>

      {/* 封底字标：全宽描边，只做底边重量，不承载信息 */}
      <div aria-hidden className="pointer-events-none select-none overflow-hidden px-2">
        <div className="mono stroke-type leading-[0.74] font-extrabold tracking-[-0.04em] text-[clamp(4.5rem,21vw,16rem)] opacity-70">
          FMW
        </div>
      </div>

      <div className="border-t border-[var(--color-line)]">
        <div className="container-page flex flex-col gap-2 py-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="mono text-[11px] tracking-[0.04em] text-[var(--color-muted)]">
            {t("copyright")}
          </p>
          <p className="mono text-[10px] tracking-[0.16em] text-[var(--color-muted)] uppercase">
            Shenzhen · CN — Analog &amp; Power Semiconductor
          </p>
        </div>
      </div>
    </footer>
  );
}
