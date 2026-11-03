import { getTranslations, setRequestLocale } from "next-intl/server";
import { buildMetadata } from "@/packages/seo";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return params.then(async ({ locale }) => {
    const t = await getTranslations({ locale, namespace: "about" });
    return buildMetadata({
      locale: locale as "zh" | "en",
      path: "/about",
      title: t("title"),
      description: t("subtitle"),
    });
  });
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "about" });

  return (
    <div className="container-page py-10 max-w-3xl">
      <h1 className="text-2xl font-semibold mb-2">{t("title")}</h1>
      <p className="text-[var(--color-sub)] mb-8">{t("subtitle")}</p>

      <section className="mb-8">
        <h2 className="text-lg font-medium mb-3">{t("mission")}</h2>
        <p className="text-[var(--color-ink)]">{t("missionBody")}</p>
      </section>

      <section>
        <h2 className="text-lg font-medium mb-3">{t("culture")}</h2>
        <p className="text-[var(--color-ink)]">{t("cultureBody")}</p>
      </section>
    </div>
  );
}
