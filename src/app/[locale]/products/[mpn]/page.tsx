import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getProductByMpn, getProducts, getSeriesList } from "@/packages/data";
import { buildMetadata } from "@/packages/seo";
import { Link } from "@/i18n/routing";
import VerificationChip from "@/components/VerificationChip";
import ProductRow from "@/components/ProductRow";
import ChipPackage from "@/components/ChipPackage";

export async function generateStaticParams() {
  const products = await getProducts("zh");
  return products.map((p) => ({ mpn: p.mpn }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; mpn: string }>;
}) {
  const { locale, mpn } = await params;
  const product = await getProductByMpn(mpn, locale as "zh" | "en");
  if (!product) return {};
  return buildMetadata({
    locale: locale as "zh" | "en",
    path: `/products/${mpn}`,
    title: product.name,
    description: product.summary,
  });
}

const LEVEL_INDEX: Record<string, string> = {
  INTERNAL: "L0",
  DATASHEET: "L1",
  BENCH_TESTED: "L2",
  CERTIFIED: "L3",
};

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ locale: string; mpn: string }>;
}) {
  const { locale, mpn } = await params;
  setRequestLocale(locale);
  const l = locale as "zh" | "en";
  const t = await getTranslations({ locale, namespace: "products" });

  const product = await getProductByMpn(mpn, l);
  if (!product) notFound();

  const seriesList = await getSeriesList(l);
  const series = seriesList.find((s) => s.id === product.seriesId);

  // 同系列的其他料号：详情页底部给出「替代/相邻型号」，这是选型时最常走的一步
  const siblings = product.seriesId
    ? (await getProducts(l)).filter((p) => p.seriesId === product.seriesId && p.mpn !== product.mpn)
    : [];

  return (
    <article>
      {/* ── 料号标头：左文右图。左栏像数据手册封面把 MPN 放到最大，
             右栏是这颗料的封装示意 —— 有「产品照」的页面才像卖芯片的。 */}
      <header className="border-b border-[var(--color-line)] bg-[var(--color-void)]">
        <div className="container-page pt-6 pb-10 md:pt-8 md:pb-14">
          <nav className="mono flex items-center gap-2 text-[11px] tracking-[0.06em] text-[var(--color-muted)]">
            <Link href="/products" className="transition-colors hover:text-[var(--color-amber)]">
              {t("title")}
            </Link>
            <span className="opacity-40">/</span>
            {series && (
              <>
                <Link
                  href={`/series/${series.slug}`}
                  className="transition-colors hover:text-[var(--color-amber)]"
                >
                  {series.name}
                </Link>
                <span className="opacity-40">/</span>
              </>
            )}
            <span className="text-[var(--color-bone-2)]">{product.mpn}</span>
          </nav>

          <div className="mt-7 grid gap-9 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-center lg:gap-14">
            <div className="min-w-0">
              <div className="enter enter-1 flex flex-wrap items-center gap-3">
                <span className="mono text-[12px] tracking-[0.12em] text-[var(--color-amber)]">
                  {product.category} · {LEVEL_INDEX[product.verificationLevel]}
                </span>
                <span className="h-px w-7 bg-[var(--color-line)]" aria-hidden />
                <VerificationChip level={product.verificationLevel} />
              </div>

              <h1 className="enter enter-2 display mt-4 text-[clamp(2.1rem,4.4vw,3.3rem)] text-[var(--color-bone)]">
                {product.mpn}
              </h1>
              <p className="enter enter-3 mt-2.5 text-[17px] text-[var(--color-bone-2)]">
                {product.name}
              </p>
              <p className="enter enter-4 mt-4 max-w-[56ch] text-[14px] leading-relaxed text-[var(--color-muted)]">
                {product.summary}
              </p>

              <div className="enter enter-5 mt-8 flex flex-wrap gap-3">
                {product.datasheetUrl ? (
                  <a href={product.datasheetUrl} className="btn btn-primary">
                    {t("datasheet")}
                    <span className="arw">↓</span>
                  </a>
                ) : (
                  <Link href="/contact" className="btn btn-primary">
                    {t("ctaQuote")}
                    <span className="arw">→</span>
                  </Link>
                )}
                <Link href="/contact" className="btn btn-ghost">
                  {t("ctaQuote")}
                </Link>
              </div>
            </div>

            {/* 封装示意 */}
            <div className="enter enter-3 relative">
              <div className="studio relative aspect-square w-full overflow-hidden border border-[var(--color-line)]">
                <div aria-hidden className="grid-paper absolute inset-0 opacity-60" />
                <ChipPackage
                  mpn={product.mpn}
                  callouts={false}
                  className="absolute inset-0 h-full w-full p-6"
                />
                <span className="mono absolute top-3 left-3 border border-[var(--color-line)] bg-white/85 px-2 py-1 text-[10px] tracking-[0.1em] text-[var(--color-bone-2)] backdrop-blur">
                  PACKAGE
                </span>
              </div>
              <p className="mono mt-2.5 text-[10.5px] leading-relaxed text-[var(--color-muted)]">
                封装示意 · 尺寸与引脚以数据手册为准
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="container-page grid gap-12 py-12 lg:grid-cols-[minmax(0,1fr)_336px] lg:gap-16 lg:py-16">
        <div className="min-w-0">
          {/* 技术参数 */}
          <section>
            <div className="mb-5 flex items-baseline justify-between border-b border-[var(--color-bone)]/20 pb-3">
              <h2 className="h2-display text-[20px] text-[var(--color-bone)]">{t("specs")}</h2>
              <span className="mono text-[11px] tracking-[0.1em] text-[var(--color-muted)]">
                {String(product.specs.length).padStart(2, "0")} PARAMS
              </span>
            </div>
            {/* 两列排：参数普遍 5 条左右，单列会在宽屏上拉成一条细长的空表 */}
            <div className="grid gap-x-10 sm:grid-cols-2 sm:divide-x sm:divide-[var(--color-line-soft)]">
              {[
                product.specs.slice(0, Math.ceil(product.specs.length / 2)),
                product.specs.slice(Math.ceil(product.specs.length / 2)),
              ].map((col, ci) => (
                <dl key={ci} className={ci === 1 ? "sm:pl-10" : "sm:pr-10"}>
                  {col.map((s, i) => (
                    <div
                      key={`${ci}-${i}`}
                      className="flex items-baseline justify-between gap-6 border-b border-[var(--color-line-soft)] py-3.5"
                    >
                      <dt className="text-[13px] text-[var(--color-muted)]">{s.label}</dt>
                      <dd className="mono text-right text-[14px] text-[var(--color-bone)]">
                        {s.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              ))}
            </div>
          </section>

          {/* 产品描述 */}
          <section className="mt-12">
            <h2 className="h2-display mb-4 text-[20px] text-[var(--color-bone)]">
              {t("colProduct")}
            </h2>
            <p className="max-w-[68ch] text-[15px] leading-[1.85] text-[var(--color-bone-2)]">
              {product.description}
            </p>
          </section>

          {/* 资料下载：方角「文件行」，右侧标注 PDF，不做成一排彩色按钮 */}
          <section className="mt-12">
            <h2 className="h2-display mb-4 text-[20px] text-[var(--color-bone)]">
              {t("documentation")}
            </h2>
            <div className="border-t border-[var(--color-line)]">
              {[
                { url: product.datasheetUrl, label: t("datasheet") },
                { url: product.appNoteUrl, label: t("appNote") },
              ]
                .filter((d) => Boolean(d.url))
                .map((d) => (
                  <a
                    key={d.label}
                    href={d.url}
                    className="group flex items-center justify-between gap-4 border-b border-[var(--color-line-soft)] py-4 transition-colors hover:bg-[var(--color-surface-2)]"
                  >
                    <span className="flex items-center gap-3">
                      <span className="mono grid h-8 w-8 place-items-center border border-[var(--color-line)] text-[9.5px] text-[var(--color-muted)] transition-colors group-hover:border-[var(--color-amber)] group-hover:text-[var(--color-amber)]">
                        PDF
                      </span>
                      <span className="text-[14.5px] text-[var(--color-bone)]">{d.label}</span>
                    </span>
                    <span className="mono flex items-center gap-2 text-[10.5px] tracking-[0.1em] text-[var(--color-muted)] transition-all group-hover:translate-x-1 group-hover:text-[var(--color-amber)]">
                      DOWNLOAD ↓
                    </span>
                  </a>
                ))}
              {!product.datasheetUrl && !product.appNoteUrl && (
                <p className="py-4 text-sm text-[var(--color-muted)]">—</p>
              )}
            </div>
          </section>

          {/* 同系列料号 */}
          {siblings.length > 0 && (
            <section className="mt-14">
              <div className="mb-3 flex items-baseline justify-between border-b border-[var(--color-bone)]/20 pb-3">
                <h2 className="h2-display text-[20px] text-[var(--color-bone)]">
                  {t("series")}
                </h2>
                {series && (
                  <Link
                    href={`/series/${series.slug}`}
                    className="mono text-[11px] tracking-[0.1em] text-[var(--color-muted)] uppercase transition-colors hover:text-[var(--color-amber)]"
                  >
                    {series.name} →
                  </Link>
                )}
              </div>
              {siblings.map((p) => (
                <ProductRow key={p.id} product={p} />
              ))}
            </section>
          )}
        </div>

        {/* 侧栏：验证证据 + 询价入口，随滚动粘住 */}
        <aside className="lg:sticky lg:top-[92px] lg:self-start">
          <div className="border border-[var(--color-line)] bg-white shadow-[var(--shadow-2)]">
            <div className="border-b border-[var(--color-line)] px-5 py-4">
              <div className="label">{t("verification")}</div>
              <div className="mt-3">
                <VerificationChip level={product.verificationLevel} />
              </div>
            </div>

            <div className="border-b border-[var(--color-line)] px-5 py-4">
              <div className="label mb-2">{t("evidence")}</div>
              <p className="text-[13px] leading-relaxed text-[var(--color-bone-2)]">
                {product.verifiedEvidence || "—"}
              </p>
            </div>

            <div className="px-5 py-4">
              <div className="label mb-2">{t("category")}</div>
              <div className="mono text-[13px] text-[var(--color-bone)]">{product.category}</div>
              <div className="label mt-4 mb-2">{t("series")}</div>
              <div className="text-[13px] text-[var(--color-bone)]">{series?.name ?? "—"}</div>
            </div>

            <Link
              href="/contact"
              className="flex items-center justify-between border-t border-[var(--color-line)] px-5 py-4 text-[13.5px] font-semibold text-[var(--color-amber)] transition-colors hover:bg-[var(--color-surface-2)]"
            >
              {t("ctaQuote")}
              <span>→</span>
            </Link>
          </div>
        </aside>
      </div>
    </article>
  );
}
