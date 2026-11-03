import { getTranslations, setRequestLocale } from "next-intl/server";
import { getArticles, getProducts, getSeriesList } from "@fmw/data";
import { buildMetadata } from "@/packages/seo";
import PageHeader from "@/components/PageHeader";
import { Link } from "@/i18n/routing";
import Wafer from "@/components/Wafer";

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
  const tn = await getTranslations({ locale, namespace: "nav" });
  const l = locale as "zh" | "en";

  // 指标直接来自数据层，不写死数字 —— 后台新增料号后这里会自动变化，
  // 也就不会出现「官网写 6 款、实际 9 款」这类对不上的尴尬。
  const [products, series, articles] = await Promise.all([
    getProducts(l),
    getSeriesList(l),
    getArticles(l),
  ]);

  const stats = [
    { value: products.length, label: t("statParts") },
    { value: series.length, label: t("statSeries") },
    { value: articles.length, label: t("statArticles") },
  ];

  const sections = [
    { key: "mission", title: t("mission"), body: t("missionBody") },
    { key: "quality", title: t("quality"), body: t("qualityBody") },
    { key: "global", title: t("global"), body: t("globalBody") },
    { key: "culture", title: t("culture"), body: t("cultureBody") },
  ] as const;

  return (
    <>
      <PageHeader index="05" title={t("title")} subtitle={t("subtitle")} />

      <div className="container-page grid gap-14 py-12 lg:grid-cols-[360px_minmax(0,1fr)] lg:gap-20 lg:py-16">
        {/* 左栏：数字 + 装置。lg 以上粘住，右栏读长文时它一直在 */}
        <aside className="lg:sticky lg:top-[96px] lg:self-start">
          <div className="grid grid-cols-3 gap-px border border-[var(--color-line)] bg-[var(--color-line)]">
            {stats.map((s) => (
              <div key={s.label} className="bg-[var(--color-surface)] px-4 py-5">
                <div className="num text-[30px] leading-none font-semibold text-[var(--color-amber)]">
                  {String(s.value).padStart(2, "0")}
                </div>
                <div className="label mt-2 leading-tight">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="mt-8 hidden lg:block">
            <Wafer annotations={false} />
          </div>

          <Link
            href="/contact"
            className="mono mt-8 inline-flex items-center gap-2 border-b border-[var(--color-line)] pb-1 text-[11px] tracking-[0.12em] text-[var(--color-bone-2)] uppercase transition-colors hover:border-[var(--color-amber)] hover:text-[var(--color-amber)]"
          >
            {tn("contact")} →
          </Link>
        </aside>

        {/* 右栏：四段正文，编号 + 大标题 + 行宽受控的段落 */}
        <div>
          {sections.map((s, i) => (
            <section
              key={s.key}
              data-reveal
              className="grid gap-4 border-t border-[var(--color-line)] py-9 md:grid-cols-[64px_minmax(0,1fr)] md:gap-8 md:py-11"
            >
              <span className="num text-[12px] text-[var(--color-muted)]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <h2 className="h2-display text-[clamp(1.25rem,2vw,1.65rem)] text-[var(--color-bone)]">
                  {s.title}
                </h2>
                <p className="mt-3 max-w-[62ch] text-[15px] leading-[1.9] text-[var(--color-bone-2)]">
                  {s.body}
                </p>
              </div>
            </section>
          ))}

          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[var(--color-line)] pt-8">
            <Link href="/products" className="btn btn-primary">
              {tn("products")}
              <span className="arw">→</span>
            </Link>
            <Link href="/contact" className="btn btn-ghost">
              {tn("contact")}
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
