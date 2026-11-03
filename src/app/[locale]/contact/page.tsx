import { getTranslations, setRequestLocale } from "next-intl/server";
import { buildMetadata } from "@/packages/seo";
import PageHeader from "@/components/PageHeader";
import ContactForm from "./ContactForm";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return params.then(async ({ locale }) => {
    const t = await getTranslations({ locale, namespace: "contact" });
    return buildMetadata({
      locale: locale as "zh" | "en",
      path: "/contact",
      title: t("title"),
      description: t("subtitle"),
    });
  });
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "contact" });
  const th = await getTranslations({ locale, namespace: "home" });

  const rows = [
    { label: t("address"), value: "深圳市 · 福田区", mono: false },
    { label: t("phone"), value: "+86 400-000-0000", mono: true },
    { label: t("emailLabel"), value: "sales@fmw.example", mono: true },
  ];

  return (
    <>
      <PageHeader index="06" title={t("title")} subtitle={t("subtitle")} />

      <div className="container-page grid gap-14 py-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20 lg:py-16">
        <div>
          <dl className="border-t border-[var(--color-line)]">
            {rows.map((r) => (
              <div
                key={r.label}
                className="flex items-baseline justify-between gap-6 border-b border-[var(--color-line-soft)] py-5"
              >
                <dt className="label">{r.label}</dt>
                <dd
                  className={`text-right text-[14.5px] text-[var(--color-bone)] ${
                    r.mono ? "mono" : ""
                  }`}
                >
                  {r.value}
                </dd>
              </div>
            ))}
          </dl>

          <p className="mt-8 max-w-[38ch] text-[13.5px] leading-relaxed text-[var(--color-muted)]">
            {th("ctaDesc")}
          </p>

          {/* 三个方角括线，呼应首屏 CTA 的框形，保持「表单 = 规格书」的隐喻 */}
          <div className="relative mt-10 hidden border border-[var(--color-line)] px-6 py-6 lg:block">
            {[
              "top-0 left-0 border-t-2 border-l-2",
              "top-0 right-0 border-t-2 border-r-2",
              "bottom-0 left-0 border-b-2 border-l-2",
              "bottom-0 right-0 border-b-2 border-r-2",
            ].map((pos) => (
              <span
                key={pos}
                aria-hidden
                className={`absolute h-4 w-4 border-[var(--color-amber)] ${pos}`}
              />
            ))}
            <div className="label">{t("sla")}</div>
            <div className="mt-3 flex items-baseline gap-3">
              <span className="num text-[38px] leading-none font-semibold text-[var(--color-amber)]">
                24h
              </span>
              <span className="text-[13px] text-[var(--color-muted)]">{t("reply")}</span>
            </div>
          </div>
        </div>

        <div className="border border-[var(--color-line)] bg-white p-6 shadow-[var(--shadow-2)] md:p-9">
          <div className="mono mb-7 flex items-center justify-between text-[10.5px] tracking-[0.16em] text-[var(--color-muted)] uppercase">
            <span>Inquiry form</span>
            <span className="text-[var(--color-amber)]">01</span>
          </div>
          <ContactForm />
        </div>
      </div>
    </>
  );
}
