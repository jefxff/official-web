import { getTranslations, setRequestLocale } from "next-intl/server";
import { getProducts, getSeriesList } from "@/packages/data";
import { Link } from "@/i18n/routing";
import PageHeader from "@/components/PageHeader";
import ChipPackage from "@/components/ChipPackage";
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
  const tp = await getTranslations({ locale, namespace: "products" });
  const th = await getTranslations({ locale, namespace: "home" });
  const [series, products] = await Promise.all([getSeriesList(l), getProducts(l)]);

  // 每个系列下真实料号数与涉及类别：直接统计，不写死，后台新增料号后自动更新
  const countBySeries = new Map<string, number>();
  const catsBySeries = new Map<string, Set<string>>();
  for (const p of products) {
    if (!p.seriesId) continue; // 未归入系列（后台允许留空）的料号不计入
    countBySeries.set(p.seriesId, (countBySeries.get(p.seriesId) ?? 0) + 1);
    const set = catsBySeries.get(p.seriesId) ?? new Set<string>();
    set.add(p.category);
    catsBySeries.set(p.seriesId, set);
  }

  return (
    <>
      <PageHeader
        index="02"
        title={t("series")}
        subtitle={th("seriesDesc")}
        meta={[
          { label: tp("series"), value: String(series.length).padStart(2, "0") },
          { label: tp("mpn"), value: String(products.length).padStart(2, "0") },
        ]}
      />

      <div className="container-page py-2 md:py-4">
        {series.map((s, i) => (
          <Link
            key={s.id}
            href={`/series/${s.slug}`}
            data-reveal
            className="group grid gap-5 border-b border-[var(--color-line)] py-7 transition-colors hover:bg-[var(--color-surface-2)] md:grid-cols-[136px_minmax(0,1fr)_auto] md:items-center md:gap-9 md:py-8"
          >
            {/* 缩略展台：一行一个系列，与首页系列卡共用同一套芯片素材 */}
            <div className="studio relative aspect-[4/3] w-full max-w-[136px] overflow-hidden border border-[var(--color-line)]">
              <div aria-hidden className="grid-paper absolute inset-0 opacity-50" />
              <ChipPackage
                mpn={s.slug.toUpperCase().slice(0, 6)}
                batch={`0${i + 1}`}
                callouts={false}
                className="absolute inset-0 h-full w-full p-2 transition-transform duration-500 group-hover:scale-[1.05]"
              />
            </div>

            <div className="min-w-0">
              <div className="mono text-[10.5px] tracking-[0.14em] text-[var(--color-amber)]">
                SERIES {String(i + 1).padStart(2, "0")}
              </div>
              <h2 className="h2-display mt-1.5 text-[clamp(1.5rem,2.8vw,2.2rem)] text-[var(--color-bone)] transition-colors group-hover:text-[var(--color-amber)]">
                {s.name}
              </h2>
              {s.description && (
                <p className="mt-2 max-w-[58ch] text-[13.5px] leading-relaxed text-[var(--color-muted)]">
                  {s.description}
                </p>
              )}
              <div className="mt-3.5 flex flex-wrap gap-1.5">
                {Array.from(catsBySeries.get(s.id) ?? []).map((cat) => (
                  <span key={cat} className="chip">
                    {cat}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-8 md:justify-end">
              <div className="text-right">
                <div className="num text-[30px] leading-none font-semibold text-[var(--color-bone)]">
                  {String(countBySeries.get(s.id) ?? 0).padStart(2, "0")}
                </div>
                <div className="label mt-2">{tp("mpn")}</div>
              </div>
              <span
                aria-hidden
                className="grid h-9 w-9 place-items-center rounded-full border border-[var(--color-line)] text-[13px] text-[var(--color-muted)] transition-all duration-300 group-hover:border-[var(--color-amber)] group-hover:bg-[var(--color-amber)] group-hover:text-white"
              >
                →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
