"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

export default function ContactForm() {
  const t = useTranslations("contact");
  const [done, setDone] = useState(false);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    // 脚手架阶段：此处后续接入 /api/contact（国内唯一写点 + TOTP 二次确认，见 v1.2 §10）
    setDone(true);
  }

  if (done) {
    return (
      <div className="rounded-lg bg-green-50 border border-green-200 p-5 text-green-800 text-sm">
        {t("submitted")}
      </div>
    );
  }

  const field =
    "w-full rounded-lg border border-[var(--color-line)] px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--color-brand)]";
  const label = "block text-sm text-[var(--color-sub)] mb-1.5";

  return (
    <form onSubmit={onSubmit} className="grid gap-4 max-w-lg">
      <div>
        <label className={label}>{t("name")}</label>
        <input required className={field} />
      </div>
      <div>
        <label className={label}>{t("email")}</label>
        <input type="email" required className={field} />
      </div>
      <div>
        <label className={label}>{t("company")}</label>
        <input className={field} />
      </div>
      <div>
        <label className={label}>{t("message")}</label>
        <textarea rows={4} required className={field} />
      </div>
      <button
        type="submit"
        className="justify-self-start rounded-lg bg-[var(--color-brand)] text-white px-6 py-2.5 text-sm font-medium hover:opacity-90"
      >
        {t("submit")}
      </button>
    </form>
  );
}
