"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/routing";
import { routing, localeNames, type Locale } from "@/i18n/routing";
import { useState } from "react";

const NAV = [
  { key: "products", href: "/products" },
  { key: "series", href: "/series" },
  { key: "news", href: "/news" },
  { key: "about", href: "/about" },
  { key: "contact", href: "/contact" },
] as const;

export default function Header() {
  const t = useTranslations("nav");
  const ts = useTranslations("site");
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  function switchLocale(next: Locale) {
    router.replace(pathname, { locale: next });
  }

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-[var(--color-line)]">
      <div className="container-page flex items-center justify-between h-16">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg text-[var(--color-brand-dark)]">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-brand)] text-white text-sm font-bold">
            F
          </span>
          <span>{ts("name")}</span>
        </Link>

        <nav className="hidden md:flex items-center gap-7 text-sm">
          {NAV.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={`text-[var(--color-ink)] hover:text-[var(--color-brand)] transition ${
                pathname.startsWith(item.href) ? "text-[var(--color-brand)] font-medium" : ""
              }`}
            >
              {t(item.key)}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <div className="flex items-center text-xs rounded-full border border-[var(--color-line)] overflow-hidden">
            {routing.locales.map((l, i) => (
              <button
                key={l}
                onClick={() => switchLocale(l)}
                className={`px-2.5 py-1 ${
                  i > 0 ? "border-l border-[var(--color-line)]" : ""
                } hover:bg-[var(--color-bg)]`}
              >
                {localeNames[l]}
              </button>
            ))}
          </div>
          <button
            className="md:hidden text-[var(--color-ink)]"
            onClick={() => setOpen((v) => !v)}
            aria-label="menu"
          >
            ☰
          </button>
        </div>
      </div>

      {open && (
        <nav className="md:hidden border-t border-[var(--color-line)] bg-white">
          <div className="container-page flex flex-col py-2 text-sm">
            {NAV.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className="py-2 hover:text-[var(--color-brand)]"
                onClick={() => setOpen(false)}
              >
                {t(item.key)}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
