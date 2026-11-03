import { getTranslations, setRequestLocale } from "next-intl/server";
import { getSeriesList } from "@/packages/data";
import { Link } from "@/i18n/routing";
import { buildMetadata } from "@/packages/seo";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return params.then(async ({ locale }) => {
    const t = await getTranslations({ locale, namespace: "nav" });
    return buildMetadata({
      locale: locale as "zh" | "en",
      path: "/series",
      title: t("series"),
      description: t("series"),
    });
  });
}

export default async function SeriesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const l = locale as "zh" | "en";
  const t = await getTranslations({ locale, namespace: "nav" });
  const series = await getSeriesList(l);

  return (
    <div className="container-page py-10">
      <h1 className="text-2xl font-semibold mb-6">{t("series")}</h1>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {series.map((s) => (
          <Link
            key={s.id}
            href={`/series/${s.slug}`}
            className="block rounded-xl border border-[var(--color-line)] bg-white p-6 hover:shadow-md hover:border-[var(--color-brand)] transition"
          >
            <h3 className="font-medium text-[var(--color-ink)] mb-2">{s.name}</h3>
            {s.description && (
              <p className="text-sm text-[var(--color-sub)] line-clamp-3">{s.description}</p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
