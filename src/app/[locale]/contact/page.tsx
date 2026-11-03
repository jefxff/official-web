import { getTranslations, setRequestLocale } from "next-intl/server";
import { buildMetadata } from "@/packages/seo";
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

  return (
    <div className="container-page py-10 max-w-3xl">
      <h1 className="text-2xl font-semibold mb-2">{t("title")}</h1>
      <p className="text-[var(--color-sub)] mb-8">{t("subtitle")}</p>

      <div className="grid gap-8 md:grid-cols-2">
        <div className="text-sm space-y-2 text-[var(--color-sub)]">
          <div>
            <span className="text-[var(--color-ink)] font-medium">{t("address")}:</span> 深圳市
          </div>
          <div>
            <span className="text-[var(--color-ink)] font-medium">{t("phone")}:</span> +86 400-000-0000
          </div>
          <div>
            <span className="text-[var(--color-ink)] font-medium">{t("emailLabel")}:</span> sales@fmw.example
          </div>
        </div>
        <ContactForm />
      </div>
    </div>
  );
}
