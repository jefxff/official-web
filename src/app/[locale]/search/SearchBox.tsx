"use client";

import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/routing";
import { useState } from "react";

/**
 * 全站搜索框：做成一条占满版心的「命令行」。
 * 搜索是全站唯一需要用户主动输入文字的入口，值得给它最大的视觉权重。
 */
export default function SearchBox({
  placeholder,
  initial = "",
}: {
  placeholder: string;
  initial?: string;
}) {
  const t = useTranslations("search");
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(initial);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    router.push(query ? `${pathname}?q=${encodeURIComponent(query)}` : pathname);
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full" role="search">
      <label className="sr-only" htmlFor="site-search">
        {t("title")}
      </label>
      <div className="relative flex-1">
        <span
          aria-hidden
          className="mono pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[15px] text-[var(--color-amber)]"
        >
          &gt;
        </span>
        <input
          id="site-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          className="input mono h-14 rounded-none pl-10 text-[15px]"
        />
      </div>
      <button
        type="submit"
        className="mono h-14 shrink-0 bg-[var(--color-amber)] px-6 text-[12px] font-semibold tracking-[0.14em] text-[var(--color-on-brand)] uppercase transition-colors hover:bg-[var(--color-amber-2)]"
      >
        {t("submit")}
      </button>
    </form>
  );
}
