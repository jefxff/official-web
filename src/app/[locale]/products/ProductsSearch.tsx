"use client";

import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/routing";
import { useState } from "react";

/**
 * 料号检索框。
 *
 * 视觉上刻意做成「命令行输入」的样子：等宽字占位、方角、右侧一个箭头方块，
 * 而不是圆角搜索条 + 放大镜图标 —— 后者在任何模板里都长一样。
 *
 * 保留当前类别筛选：搜索时不能把用户刚选的类别清掉（hidden input 带回 c）。
 */
export default function ProductsSearch({
  placeholder,
  category,
  initial,
}: {
  placeholder: string;
  category?: string;
  initial?: string;
}) {
  const t = useTranslations("products");
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(initial ?? "");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    const query = q.trim();
    if (query) params.set("q", query);
    if (category) params.set("c", category);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-xl" role="search">
      <label className="sr-only" htmlFor="parts-q">
        {t("search")}
      </label>
      <div className="relative flex-1">
        <span
          aria-hidden
          className="mono pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[12px] text-[var(--color-amber)]"
        >
          /
        </span>
        <input
          id="parts-q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          className="input mono h-12 rounded-none pl-7 text-[13px]"
          autoComplete="off"
        />
      </div>
      {category && <input type="hidden" name="c" value={category} />}
      <button
        type="submit"
        className="mono grid h-12 w-12 shrink-0 place-items-center bg-[var(--color-amber)] text-[15px] text-[var(--color-on-brand)] transition-colors hover:bg-[var(--color-amber-2)]"
        aria-label={t("search")}
      >
        →
      </button>
    </form>
  );
}
