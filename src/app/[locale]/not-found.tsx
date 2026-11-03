"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";

export default function NotFound() {
  const t = useTranslations("common");
  return (
    <div className="container-page py-24 text-center">
      <h1 className="text-3xl font-semibold mb-3">{t("notFound")}</h1>
      <p className="text-[var(--color-sub)] mb-6">{t("notFoundDesc")}</p>
      <Link
        href="/"
        className="inline-block rounded-lg bg-[var(--color-brand)] text-white px-5 py-2.5 text-sm font-medium hover:opacity-90"
      >
        {t("backHome")}
      </Link>
    </div>
  );
}
