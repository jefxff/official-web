"use client";

import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/routing";
import { useState } from "react";

export default function ProductsSearch({ placeholder }: { placeholder: string }) {
  const t = useTranslations("products");
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    router.push(query ? `${pathname}?q=${encodeURIComponent(query)}` : pathname);
  }

  return (
    <form onSubmit={onSubmit} className="mb-8 flex gap-2 max-w-lg">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className="flex-1 rounded-lg border border-[var(--color-line)] px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--color-brand)]"
      />
      <button
        type="submit"
        className="rounded-lg bg-[var(--color-brand)] text-white px-5 py-2.5 text-sm font-medium hover:opacity-90"
      >
        {t("search")}
      </button>
    </form>
  );
}
