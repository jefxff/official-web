import { getTranslations, setRequestLocale } from "next-intl/server";
import { getProducts, searchProducts, getSeriesList } from "@/packages/data";
import ProductRow from "@/components/ProductRow";
import PageHeader from "@/components/PageHeader";
import { Link } from "@/i18n/routing";
import { buildMetadata } from "@/packages/seo";
import ProductsSearch from "./ProductsSearch";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return params.then(async ({ locale }) => {
    const t = await getTranslations({ locale, namespace: "products" });
    return buildMetadata({
      locale: locale as "zh" | "en",
      path: "/products",
      title: t("title"),
      description: t("subtitle"),
    });
  });
}

export default async function ProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; c?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const l = locale as "zh" | "en";
  const t = await getTranslations({ locale, namespace: "products" });
  const { q, c } = await searchParams;

  const all = await getProducts(l);
  const series = await getSeriesList(l);

  // 类别筛选用 URL 承载（?c=LDO），不引入客户端状态：
  // 结果可分享、可被搜索引擎收录，也少一个 hydration 分支。
  const categories = Array.from(new Set(all.map((p) => p.category))).sort();
  const activeCategory = c && categories.includes(c) ? c : undefined;

  const base = q ? await searchProducts(q, l) : all;
  const list = activeCategory ? base.filter((p) => p.category === activeCategory) : base;

  const countByCategory = new Map<string, number>();
  for (const p of all) countByCategory.set(p.category, (countByCategory.get(p.category) ?? 0) + 1);

  const qs = (next?: { q?: string; c?: string }) => {
    const params = new URLSearchParams();
    if (next?.q ?? q) params.set("q", (next?.q ?? q) as string);
    if (next?.c) params.set("c", next.c);
    const s = params.toString();
    return s ? `/products?${s}` : "/products";
  };

  return (
    <>
      <PageHeader
        index="01"
        title={t("title")}
        subtitle={t("subtitle")}
        meta={[
          { label: t("mpn"), value: String(all.length).padStart(2, "0") },
          { label: t("series"), value: String(series.length).padStart(2, "0") },
        ]}
      />

      <div className="container-page py-10 md:py-14">
        <div className="grid gap-10 lg:grid-cols-[196px_minmax(0,1fr)] lg:gap-14">
          {/* 左侧筛选栏：类别 + 系列。移动端折到顶部横向滚动 */}
          <aside className="lg:sticky lg:top-[92px] lg:self-start">
            <div className="lg:border-t lg:border-[var(--color-bone)]/20 lg:pt-4">
              <div className="label mb-3">{t("filter")}</div>

              <div className="-mx-1 flex gap-3 overflow-x-auto pb-2 lg:mx-0 lg:flex-col lg:gap-0 lg:overflow-visible lg:pb-0">
                <Link
                  href={qs({ c: undefined, q })}
                  className={`flex shrink-0 items-center justify-between gap-3 border-b border-[var(--color-line-soft)] py-2 pr-1 text-[13.5px] transition-colors ${
                    !activeCategory
                      ? "font-semibold text-[var(--color-amber)]"
                      : "text-[var(--color-bone-2)] hover:text-[var(--color-bone)]"
                  }`}
                >
                  <span>{t("all")}</span>
                  <span className="mono text-[11px] text-[var(--color-muted)]">
                    {all.length}
                  </span>
                </Link>
                {categories.map((cat) => (
                  <Link
                    key={cat}
                    href={qs({ c: cat })}
                    className={`flex shrink-0 items-center justify-between gap-3 border-b border-[var(--color-line-soft)] py-2 pr-1 text-[13.5px] transition-colors ${
                      activeCategory === cat
                        ? "font-semibold text-[var(--color-amber)]"
                        : "text-[var(--color-bone-2)] hover:text-[var(--color-bone)]"
                    }`}
                  >
                    <span className="mono">{cat}</span>
                    <span className="mono text-[11px] text-[var(--color-muted)]">
                      {countByCategory.get(cat) ?? 0}
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="mt-8 hidden border border-[var(--color-line)] bg-white p-4 lg:block">
              <div className="label">{t("ctaQuote")}</div>
              <p className="mt-2 text-[12px] leading-relaxed text-[var(--color-muted)]">
                {t("emptyHint")}
              </p>
              <Link href="/contact" className="arrow-link mt-3 text-[12px]">
                {t("ctaQuote")}
              </Link>
            </div>

            <div className="mt-8 hidden lg:block">
              <div className="label mb-3">{t("series")}</div>
              <div className="border-t border-[var(--color-line)]">
                {series.map((s) => (
                  <Link
                    key={s.id}
                    href={`/series/${s.slug}`}
                    className="group flex items-center justify-between border-b border-[var(--color-line-soft)] py-2.5 text-[13px] text-[var(--color-bone-2)] transition-colors hover:text-[var(--color-amber)]"
                  >
                    <span className="truncate">{s.name}</span>
                    <span className="text-[11px] opacity-0 transition-opacity group-hover:opacity-100">
                      →
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </aside>

          {/* 列表 */}
          <div className="min-w-0">
            <div className="flex flex-col gap-5 border-b border-[var(--color-line)] pb-5 md:flex-row md:items-center md:justify-between">
              <ProductsSearch
                placeholder={t("searchPlaceholder")}
                category={activeCategory}
                initial={q}
              />
              <div className="mono shrink-0 text-[11px] tracking-[0.08em] text-[var(--color-muted)]">
                {q ? `“${q}” · ` : ""}
                {list.length} / {all.length}
                <span className="ml-1 uppercase">parts</span>
              </div>
            </div>

            {list.length === 0 ? (
              <div className="py-20 text-center">
                <p className="text-[15px] font-medium text-[var(--color-bone)]">{t("noResult")}</p>
                <p className="mt-2 text-[13px] text-[var(--color-muted)]">{t("emptyHint")}</p>
                <Link href="/contact" className="btn btn-ghost mt-6">
                  {t("ctaQuote")}
                </Link>
              </div>
            ) : (
              <>
                <div className="hidden grid-cols-[140px_minmax(0,1fr)_200px_126px_24px] gap-6 border-b border-[var(--color-line-soft)] py-2.5 md:grid">
                  <span className="label">{t("mpn")}</span>
                  <span className="label">{t("colProduct")}</span>
                  <span className="label">{t("colSpec")}</span>
                  <span className="label">{t("verification")}</span>
                  <span />
                </div>
                <div>
                  {list.map((p) => (
                    <ProductRow key={p.id} product={p} />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
