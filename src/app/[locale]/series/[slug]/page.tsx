import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getSeriesBySlug, getProductsBySeries } from "@/packages/data";
import { buildMetadata } from "@/packages/seo";
import { Link } from "@/i18n/routing";
import ProductRow from "@/components/ProductRow";
import PageHeader from "@/components/PageHeader";
import ChipPackage from "@/components/ChipPackage";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const series = await getSeriesBySlug(slug, locale as "zh" | "en");
  if (!series) return {};
  return buildMetadata({
    locale: locale as "zh" | "en",
    path: `/series/${slug}`,
    title: series.name,
    description: series.description ?? series.name,
  });
}

export default async function SeriesDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const l = locale as "zh" | "en";
  const t = await getTranslations({ locale, namespace: "products" });
  const tn = await getTranslations({ locale, namespace: "nav" });

  const series = await getSeriesBySlug(slug, l);
  if (!series) notFound();
  const products = await getProductsBySeries(series.id, l);

  // 概览用它真实的数据：料号数、类别数、已实测/已认证料号数
  const categories = new Set(products.map((p) => p.category));
  const verified = products.filter(
    (p) => p.verificationLevel === "BENCH_TESTED" || p.verificationLevel === "CERTIFIED"
  ).length;

  return (
    <>
      <PageHeader
        index="02"
        title={series.name}
        subtitle={series.description}
        meta={[
          { label: t("mpn"), value: String(products.length).padStart(2, "0") },
          {
            label: t("category"),
            value: String(new Set(products.map((p) => p.category)).size).padStart(2, "0"),
          },
        ]}
      />

      <div className="container-page py-10 md:py-14">
        <Link
          href="/series"
          className="mono inline-flex items-center gap-2 text-[11px] tracking-[0.12em] text-[var(--color-muted)] uppercase transition-colors hover:text-[var(--color-amber)]"
        >
          ← {tn("series")}
        </Link>

        {/* 概览：左数据、右封装示意。没有这一块，系列页就只剩一张光秃秃的表格 */}
        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
          <div>
            <div className="label">Series overview</div>
            <dl className="mt-4 grid grid-cols-3 border-t border-[var(--color-line)]">
              {[
                { label: t("mpn"), value: products.length },
                { label: t("category"), value: categories.size },
                { label: t("vBenchTested"), value: verified },
              ].map((s2, i) => (
                <div
                  key={s2.label}
                  className={`py-5 ${i > 0 ? "border-l border-[var(--color-line)] pl-5" : "pr-5"}`}
                >
                  <dd className="num text-[32px] leading-none font-semibold text-[var(--color-bone)]">
                    {String(s2.value).padStart(2, "0")}
                  </dd>
                  <dt className="mt-2 text-[11.5px] text-[var(--color-muted)]">{s2.label}</dt>
                </div>
              ))}
            </dl>

            <div className="mt-7 flex flex-wrap gap-1.5">
              {Array.from(categories).map((cat) => (
                <span key={cat} className="chip">
                  {cat}
                </span>
              ))}
            </div>
          </div>

          <div className="studio relative aspect-[4/3] w-full overflow-hidden border border-[var(--color-line)]">
            <div aria-hidden className="grid-paper absolute inset-0 opacity-60" />
            <ChipPackage
              mpn={series.slug.toUpperCase().slice(0, 6)}
              packageName="SERIES"
              batch="01"
              callouts={false}
              className="absolute inset-0 h-full w-full p-4"
            />
          </div>
        </div>

        <div className="mt-12">
          {products.length === 0 ? (
            <p className="py-16 text-center text-sm text-[var(--color-muted)]">{t("noResult")}</p>
          ) : (
            <>
              <div className="hidden grid-cols-[140px_minmax(0,1fr)_200px_126px_24px] gap-6 border-b border-[var(--color-line)] py-2.5 md:grid">
                <span className="label">{t("mpn")}</span>
                <span className="label">{t("colProduct")}</span>
                <span className="label">{t("colSpec")}</span>
                <span className="label">{t("verification")}</span>
                <span />
              </div>
              {products.map((p) => (
                <ProductRow key={p.id} product={p} />
              ))}
            </>
          )}
        </div>
      </div>
    </>
  );
}
