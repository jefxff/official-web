"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/routing";
import { routing, localeNames, type Locale } from "@/i18n/routing";
import { useEffect, useState } from "react";

const NAV = [
  { key: "products", href: "/products" },
  { key: "series", href: "/series" },
  { key: "news", href: "/news" },
  { key: "about", href: "/about" },
  { key: "contact", href: "/contact" },
] as const;

/**
 * 页头：白底 + 发丝线 + 朱砂下划线。
 *
 * 上一版是暗底 + 等宽编号导航，那是「设备面板」的语汇，读起来像开发者工具。
 * 这一版参考国内一线硬件官网的做法：干净的横向导航、一个明确的询价按钮，
 * 唯一的强调只出现在激活项的下划线与 CTA 上。滚动 8px 后才加投影，
 * 首屏保持完全平的一张白纸。
 */
export default function Header() {
  const t = useTranslations("nav");
  const ts = useTranslations("site");
  const pathname = usePathname();
  const router = useRouter();
  const currentLocale = useLocale();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // 路由变化后自动收起移动端菜单（含浏览器前进/后退）
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // 移动端菜单打开时锁滚动，并支持 Esc 关闭
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function switchLocale(next: Locale) {
    router.replace(pathname, { locale: next });
  }

  return (
    <header
      className={`sticky top-0 z-40 bg-[color-mix(in_srgb,var(--color-void)_86%,transparent)] backdrop-blur-xl transition-shadow duration-300 ${
        scrolled
          ? "border-b border-[var(--color-line)] shadow-[0_1px_0_rgba(20,22,26,0.06),0_10px_30px_-24px_rgba(20,22,26,0.4)]"
          : "border-b border-transparent"
      }`}
    >
      <div className="container-page flex h-[68px] items-center justify-between gap-6">
        {/* 字标 */}
        <Link href="/" className="group flex shrink-0 items-center gap-2.5" aria-label={ts("name")}>
          <span className="grid h-8 w-8 place-items-center rounded-[2px] bg-[var(--color-amber)] text-[12.5px] font-bold tracking-[0.04em] text-white transition-transform duration-300 group-hover:scale-[1.04]">
            FM
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-[16px] font-bold tracking-[-0.01em] text-[var(--color-bone)]">
              {ts("name")}
            </span>
            <span className="mt-1 hidden text-[9.5px] tracking-[0.2em] text-[var(--color-muted)] uppercase sm:block">
              FMW Semiconductor
            </span>
          </span>
        </Link>

        <nav className="hidden md:flex md:items-center md:gap-1" aria-label={t("home")}>
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-[44px] items-center px-3.5 text-[14px] transition-colors ${
                  active
                    ? "font-semibold text-[var(--color-bone)]"
                    : "text-[var(--color-bone-2)] hover:text-[var(--color-bone)]"
                }`}
              >
                {t(item.key)}
                <span
                  aria-hidden
                  className={`absolute inset-x-3.5 bottom-[6px] h-[2px] origin-left bg-[var(--color-amber)] transition-transform duration-300 ${
                    active ? "scale-x-100" : "scale-x-0"
                  }`}
                  style={{ transitionTimingFunction: "cubic-bezier(0.16,1,0.3,1)" }}
                />
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-1.5">
          {/* 语言：两个裸文字 + 一段分隔，比方框控件更轻 */}
          <div className="hidden items-center gap-1 sm:flex" role="group" aria-label="language">
            {routing.locales.map((l, i) => (
              <span key={l} className="flex items-center">
                {i > 0 && (
                  <span aria-hidden className="mx-1 h-3 w-px bg-[var(--color-line)]" />
                )}
                <button
                  onClick={() => switchLocale(l)}
                  aria-pressed={l === currentLocale}
                  aria-label={localeNames[l]}
                  className={`mono min-h-[36px] px-1.5 text-[11.5px] tracking-[0.06em] transition-colors ${
                    l === currentLocale
                      ? "text-[var(--color-amber)]"
                      : "text-[var(--color-muted)] hover:text-[var(--color-bone)]"
                  }`}
                >
                  {l === "zh" ? "中文" : "EN"}
                </button>
              </span>
            ))}
          </div>

          <Link
            href="/search"
            className="grid h-10 w-10 place-items-center text-[var(--color-bone-2)] transition-colors hover:text-[var(--color-amber)]"
            aria-label={t("search")}
          >
            <svg width="17" height="17" viewBox="0 0 16 16" fill="none" aria-hidden>
              <circle cx="6.8" cy="6.8" r="4.6" stroke="currentColor" strokeWidth="1.4" />
              <path d="M10.4 10.4 14 14" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          </Link>

          <Link
            href="/contact"
            className="hidden h-10 items-center gap-2 bg-[var(--color-amber)] px-5 text-[13px] font-semibold text-white transition-colors hover:bg-[var(--color-amber-2)] lg:inline-flex"
          >
            索取样品
            <span className="text-[11px]">↗</span>
          </Link>

          <button
            type="button"
            className="grid h-10 w-10 place-items-center text-[var(--color-bone)] md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "关闭菜单" : "打开菜单"}
          >
            <span className="relative block h-[10px] w-[20px]">
              <span
                className={`absolute left-0 h-[1.5px] w-full bg-current transition-all duration-300 ${
                  open ? "top-[4px] rotate-45" : "top-0"
                }`}
              />
              <span
                className={`absolute left-0 h-[1.5px] w-full bg-current transition-all duration-300 ${
                  open ? "top-[4px] -rotate-45" : "top-[9px]"
                }`}
              />
            </span>
          </button>
        </div>
      </div>

      {/* 移动端：白纸面板，大字导航 + 底部询价入口 */}
      <div
        id="mobile-nav"
        hidden={!open}
        className="fixed inset-x-0 top-[68px] bottom-0 z-30 overflow-y-auto bg-[var(--color-void)] md:hidden"
      >
        <nav className="container-page flex flex-col pt-2">
          {NAV.map((item, i) => (
            <Link
              key={item.key}
              href={item.href}
              className="flex items-center justify-between border-b border-[var(--color-line)] py-4"
            >
              <span className="text-[24px] font-bold tracking-[-0.02em] text-[var(--color-bone)]">
                {t(item.key)}
              </span>
              <span className="mono text-[11px] text-[var(--color-muted)]">
                {String(i + 1).padStart(2, "0")}
              </span>
            </Link>
          ))}

          <Link
            href="/contact"
            className="mt-6 flex h-12 items-center justify-center bg-[var(--color-amber)] text-[14px] font-semibold text-white"
          >
            索取样品 / 询价
          </Link>

          <div className="mt-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {routing.locales.map((l) => (
                <button
                  key={l}
                  onClick={() => switchLocale(l)}
                  aria-pressed={l === currentLocale}
                  aria-label={localeNames[l]}
                  className={`mono text-[12px] ${
                    l === currentLocale
                      ? "text-[var(--color-amber)]"
                      : "text-[var(--color-muted)]"
                  }`}
                >
                  {l === "zh" ? "中文" : "EN"}
                </button>
              ))}
            </div>
            <Link
              href="/search"
              className="text-[12.5px] text-[var(--color-muted)]"
            >
              {t("search")} ↗
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
