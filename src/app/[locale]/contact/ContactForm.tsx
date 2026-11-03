"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

/**
 * 联系表单。
 *
 * 提交行为保持不变（真 POST /api/v1/contact，含蜜罐与限流），这里只换视觉：
 * 字段标签走等宽微标签，输入框方角内凹，错误用琥珀左框而不是整片红色 ——
 * 红底白字在暗色界面上会显得像系统崩溃，而不是「这一项没填」。
 */
export default function ContactForm() {
  const t = useTranslations("contact");
  const locale = useLocale();
  const [done, setDone] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending) return;
    const fd = new FormData(e.currentTarget);
    setSending(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(fd.get("name") ?? "").trim(),
          email: String(fd.get("email") ?? "").trim(),
          company: String(fd.get("company") ?? "").trim() || undefined,
          message: String(fd.get("message") ?? "").trim(),
          website: String(fd.get("website") ?? ""),
          locale,
        }),
      });

      if (res.ok) {
        setDone(true);
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      setError(data.message ?? t("error"));
    } catch {
      setError(t("error"));
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <div className="border border-[var(--color-line)] bg-[var(--color-surface)] p-8">
        <div className="mono mb-4 text-[11px] tracking-[0.16em] text-[var(--color-bench)] uppercase">
          200 OK
        </div>
        <p className="text-[15px] text-[var(--color-bone)]">{t("submitted")}</p>
      </div>
    );
  }

  const field = "input";
  const label = "label mb-2 block";

  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="contact-name">
            {t("name")}
          </label>
          <input id="contact-name" name="name" required maxLength={80} className={field} />
        </div>
        <div>
          <label className={label} htmlFor="contact-email">
            {t("email")}
          </label>
          <input
            id="contact-email"
            name="email"
            type="email"
            required
            maxLength={200}
            className={field}
          />
        </div>
      </div>

      <div>
        <label className={label} htmlFor="contact-company">
          {t("company")}
        </label>
        <input id="contact-company" name="company" maxLength={120} className={field} />
      </div>

      <div>
        <label className={label} htmlFor="contact-message">
          {t("message")}
        </label>
        <textarea
          id="contact-message"
          name="message"
          rows={5}
          required
          maxLength={4000}
          className={`${field} resize-y`}
        />
      </div>

      {/* 蜜罐：对用户不可见、不可聚焦，机器人按 DOM 顺序填表会踩中 */}
      <div aria-hidden="true" className="hidden">
        <label htmlFor="contact-website">Website</label>
        <input id="contact-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {error && (
        <p
          role="alert"
          className="border-l-2 border-[var(--color-amber)] bg-[var(--color-surface)] px-4 py-3 text-[13px] text-[var(--color-bone-2)]"
        >
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4 pt-1">
        <button type="submit" disabled={sending} className="btn btn-primary">
          {sending ? t("sending") : t("submit")}
          <span className="arw">→</span>
        </button>
        <span className="mono text-[10.5px] tracking-[0.12em] text-[var(--color-muted)] uppercase">
          {t("emailLabel")} · sales@fmw.example
        </span>
      </div>
    </form>
  );
}
