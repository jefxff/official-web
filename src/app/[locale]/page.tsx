import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { getProducts, getArticles, getSeriesList } from "@/packages/data";
import ArticleCard from "@/components/ArticleCard";
import ProductRow from "@/components/ProductRow";
import ChipPackage from "@/components/ChipPackage";
import { buildMetadata } from "@/packages/seo";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return params.then(async ({ locale }) => {
    const t = await getTranslations({ locale, namespace: "site" });
    return buildMetadata({
      locale: locale as "zh" | "en",
      path: "",
      title: t("name") + " · " + t("tagline"),
      description: t("description"),
    });
  });
}

/** 板块标头：小序号 + 标题 + 右侧动作。全站内页与小节共用同一套节奏。 */
function SectionHead({
  index,
  title,
  desc,
  action,
}: {
  index: string;
  title: string;
  desc?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-x-8 gap-y-4 md:mb-10">
      <div>
        <div className="label mb-3 flex items-center gap-2">
          <span className="text-[var(--color-amber)]">{index}</span>
          <span className="h-px w-5 bg-[var(--color-line)]" aria-hidden />
          <span>FMW</span>
        </div>
        <h2 className="h2-display text-[clamp(1.55rem,2.5vw,2.15rem)] text-[var(--color-bone)]">
          {title}
        </h2>
        {desc && (
          <p className="mt-2.5 max-w-[58ch] text-[14px] leading-relaxed text-[var(--color-muted)]">
            {desc}
          </p>
        )}
      </div>
      {action && (
        <Link href={action.href} className="group flex items-center gap-2 text-[13.5px] text-[var(--color-bone-2)] transition-colors hover:text-[var(--color-amber)]">
          {action.label}
          <span className="grid h-7 w-7 place-items-center rounded-full border border-[var(--color-line)] text-[12px] transition-colors group-hover:border-[var(--color-amber)]">
            →
          </span>
        </Link>
      )}
    </div>
  );
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const l = locale as "zh" | "en";
  const t = await getTranslations({ locale, namespace: "home" });
  const ts = await getTranslations({ locale, namespace: "site" });
  const tProducts = await getTranslations({ locale, namespace: "products" });

  const products = await getProducts(l);
  const series = await getSeriesList(l);
  const articles = await getArticles(l);

  const featured = products.slice(0, 5);
  const hero = featured[0];
  const docs = products.filter((p) => p.datasheetUrl || p.appNoteUrl).length;
  const [heroLine1, heroLine2] = t("heroTitle").split(/[，,]/);
  const ticker = t.raw("ticker") as string[];

  // 系列下的真实料号数：与系列页同一口径，后台加料号后首页自动跟着变
  const countBySeries = new Map<string, number>();
  for (const p of products) {
    if (p.seriesId) countBySeries.set(p.seriesId, (countBySeries.get(p.seriesId) ?? 0) + 1);
  }

  const [lead, ...restNews] = articles;

  return (
    <>
      {/* ── 01 首屏 ──────────────────────────────────────────────
          左文右「产品照」。右侧展台用 .studio 做出棚拍的冷白地光，
          芯片本体是 SVG 绘的（换料号不用重拍照片），下方压一张规格卡，
          让首屏第一眼看到的就是「料号 + 参数」，而不是形容词。 */}
      <section className="relative overflow-hidden bg-[var(--color-void)]">
        <div className="container-page relative grid items-center gap-12 pt-10 pb-14 lg:grid-cols-[1.06fr_0.94fr] lg:gap-10 lg:pt-16 lg:pb-28">
          <div className="min-w-0">
            <div className="enter enter-1 eyebrow">{ts("tagline")}</div>

            <h1 className="enter enter-2 display mt-5 text-[clamp(2.6rem,5.4vw,4.15rem)]">
              <span className="block text-[var(--color-bone)]">{heroLine1}</span>
              <span className="block text-[var(--color-amber)]">{heroLine2 ?? "连接未来"}</span>
            </h1>

            <p className="enter enter-3 mt-6 max-w-[42ch] text-[15.5px] leading-[1.75] text-balance text-[var(--color-bone-2)]">
              {t("heroSubtitle")}
            </p>

            <div className="enter enter-4 mt-8 flex flex-wrap items-center gap-3">
              <Link href="/products" className="btn btn-primary">
                {t("ctaProducts")}
                <span className="arw">→</span>
              </Link>
              <Link href="/contact" className="btn btn-ghost">
                {t("ctaContact")}
              </Link>
            </div>

            {/* 规格条：真实数据来自数据层，不写死 */}
            <dl className="enter enter-5 mt-12 grid max-w-lg grid-cols-3 border-t border-[var(--color-line)] pt-6">
              {[
                { v: products.length, l: t("statParts") },
                { v: series.length, l: t("statSeries") },
                { v: docs, l: t("statDocs") },
              ].map((s, i) => (
                <div key={s.l} className={i > 0 ? "border-l border-[var(--color-line)] pl-6" : ""}>
                  <dd className="num text-[30px] leading-none font-semibold text-[var(--color-bone)]">
                    {String(s.v).padStart(2, "0")}
                  </dd>
                  <dt className="mt-2 text-[12px] text-[var(--color-muted)]">{s.l}</dt>
                </div>
              ))}
            </dl>
          </div>

          {/* 展台 */}
          <div className="enter enter-3 relative mx-auto w-full max-w-[540px] lg:mr-0 lg:ml-auto">
            <div className="studio relative aspect-square w-full overflow-hidden border border-[var(--color-line)]">
              <div aria-hidden className="grid-paper absolute inset-0 opacity-70" />

              {/* 四角括线：像样片托盘上的定位标记 */}
              {[
                "top-3 left-3 border-t border-l",
                "top-3 right-3 border-t border-r",
                "bottom-3 left-3 border-b border-l",
                "bottom-3 right-3 border-b border-r",
              ].map((pos) => (
                <span
                  key={pos}
                  aria-hidden
                  className={`absolute h-4 w-4 border-[var(--color-bone)]/25 ${pos}`}
                />
              ))}

              <ChipPackage
                mpn={hero?.mpn ?? "FM8001"}
                batch="2536"
                packageName="QFN-28"
                callouts={false}
                className="float-y absolute inset-0 h-full w-full p-7 md:p-9"
              />

              <div className="absolute top-4 left-4">
                <span className="mono border border-[var(--color-line)] bg-white/85 px-2 py-1 text-[10px] tracking-[0.12em] text-[var(--color-bone-2)] backdrop-blur">
                  QFN · 5 × 5 mm
                </span>
              </div>
            </div>

            {/* 规格卡：首屏唯一的浮层，压住展台左下角，制造层次 */}
            {hero && (
              <div className="relative mt-4 w-full max-w-[300px] border border-[var(--color-line)] bg-white p-4 shadow-[var(--shadow-2)] md:absolute md:-bottom-10 md:left-5 md:mt-0 md:w-[248px] md:shadow-[var(--shadow-3)]">
                <div className="flex items-center justify-between">
                  <span className="mono text-[12px] font-semibold text-[var(--color-bone)]">
                    {hero.mpn}
                  </span>
                  <span className="mono text-[10px] text-[var(--color-amber)]">
                    {hero.category}
                  </span>
                </div>
                <p className="mt-1.5 line-clamp-1 text-[12px] text-[var(--color-muted)]">
                  {hero.name}
                </p>
                <div className="mt-3 space-y-1.5 border-t border-[var(--color-line-soft)] pt-2.5">
                  {hero.specs.slice(0, 2).map((s) => (
                    <div key={s.label} className="flex items-baseline justify-between gap-3">
                      <span className="text-[11px] text-[var(--color-muted)]">{s.label}</span>
                      <span className="mono text-[11.5px] text-[var(--color-bone)]">{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── 能力带：一条持续滚动的等宽字带，像仪器上的状态栏 ────── */}
      <div className="overflow-hidden border-y border-[var(--color-line)] bg-[var(--color-surface-2)] py-3">
        <div className="flex w-max" style={{ animation: "marquee 48s linear infinite" }}>
          {[0, 1].map((copy) => (
            <ul key={copy} aria-hidden={copy === 1} className="flex shrink-0 items-center">
              {ticker.map((word) => (
                <li
                  key={`${copy}-${word}`}
                  className="mono flex items-center gap-6 pr-6 text-[11px] tracking-[0.16em] whitespace-nowrap text-[var(--color-bone-2)] uppercase"
                >
                  {word}
                  <span className="h-1 w-1 rounded-full bg-[var(--color-amber)]" aria-hidden />
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>

      {/* ── 02 产品系列（纯白段，与首屏纸白分开）───────────────── */}
      <section className="border-b border-[var(--color-line)] bg-white">
        <div className="container-page section">
          <SectionHead
            index="02"
            title={t("seriesTitle")}
            desc={t("seriesDesc")}
            action={{ href: "/series", label: t("viewAll") }}
          />

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-12">
            {series.map((s, i) => (
              <Link
                key={s.id}
                href={`/series/${s.slug}`}
                data-reveal
                className={`group relative flex flex-col overflow-hidden border border-[var(--color-line)] bg-white transition-all duration-300 hover:border-[var(--color-amber)] hover:shadow-[var(--shadow-3)] ${
                  i === 0 ? "lg:col-span-5 lg:row-span-2" : "sm:flex-row lg:col-span-7"
                }`}
              >
                {/* 展台：芯片按真实比例放在右侧，左侧留给巨型系列号，
                    小卡也不会出现「一个迷你方块飘在大片空白里」 */}
                <div
                  className={`studio relative shrink-0 overflow-hidden border-[var(--color-line)] ${
                    i === 0
                      ? "aspect-[5/4] w-full border-b"
                      : "h-[150px] w-full border-b sm:h-auto sm:w-[208px] sm:border-r sm:border-b-0"
                  }`}
                >
                  <div aria-hidden className="grid-paper absolute inset-0 opacity-50" />
                  {i === 0 && (
                    <span
                      aria-hidden
                      className="num pointer-events-none absolute top-3 left-4 text-[clamp(3.2rem,5.6vw,5rem)] leading-none font-semibold text-[var(--color-bone)]/[0.07]"
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  )}
                  <ChipPackage
                    mpn={s.slug.toUpperCase().slice(0, 6)}
                    packageName="SERIES"
                    batch={`0${i + 1}`}
                    callouts={false}
                    className={`absolute transition-transform duration-700 group-hover:scale-[1.05] ${
                      i === 0
                        ? "inset-0 h-full w-full p-7"
                        : "top-1/2 left-1/2 h-[88%] w-auto -translate-x-1/2 -translate-y-1/2"
                    }`}
                  />
                </div>

                <div className="flex flex-1 flex-col justify-between gap-4 p-6">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="mono text-[10.5px] tracking-[0.14em] text-[var(--color-amber)]">
                        SERIES {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="mono ml-auto text-[10.5px] text-[var(--color-muted)]">
                        {String(countBySeries.get(s.id) ?? 0).padStart(2, "0")} {t("statParts")}
                      </span>
                    </div>
                    <h3
                      className={`h2-display mt-2.5 text-[var(--color-bone)] transition-colors group-hover:text-[var(--color-amber)] ${
                        i === 0 ? "text-[clamp(1.4rem,2.2vw,1.9rem)]" : "text-[19px]"
                      }`}
                    >
                      {s.name}
                    </h3>
                    {s.description && (
                      <p className="mt-2 max-w-[44ch] text-[13px] leading-relaxed text-[var(--color-muted)]">
                        {s.description}
                      </p>
                    )}
                  </div>
                  <span className="arrow-link text-[12.5px]">{tProducts("series")}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── 03 重点产品：规格表式列表 ─────────────────────────── */}
      <section className="bg-[var(--color-void)]">
        <div className="container-page section">
          <SectionHead
            index="03"
            title={t("featuredProducts")}
            action={{ href: "/products", label: t("viewAll") }}
          />

          <div className="hidden grid-cols-[140px_minmax(0,1fr)_200px_126px_24px] gap-6 border-b border-[var(--color-bone)]/15 pb-3 md:grid">
            <span className="label">{tProducts("mpn")}</span>
            <span className="label">{tProducts("colProduct")}</span>
            <span className="label">{tProducts("colSpec")}</span>
            <span className="label">{tProducts("verification")}</span>
            <span />
          </div>
          <div>
            {featured.map((p) => (
              <ProductRow key={p.id} product={p} />
            ))}
          </div>
        </div>
      </section>

      {/* ── 04 优势（墨黑段）：亮场页面需要一次深色换气，否则翻到底会乏 ── */}
      <section className="on-ink">
        <div className="container-page section">
          <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
            <div>
              <div className="label mb-3 flex items-center gap-2">
                <span className="text-[var(--color-amber)]">04</span>
                <span className="h-px w-5 bg-[var(--color-line)]" aria-hidden />
                <span>FMW</span>
              </div>
              <h2 className="h2-display text-[clamp(1.6rem,2.6vw,2.2rem)] text-[var(--color-bone)]">
                {t("advantageTitle")}
              </h2>

              {/* 验证等级阶梯：把「可信度」画成可比较的四档，而不是形容词 */}
              <div className="mt-9">
                <div className="label mb-3">{tProducts("verification")}</div>
                <div className="flex h-1.5 w-full gap-1" aria-hidden>
                  {[18, 34, 55, 100].map((pct, i) => (
                    <span
                      key={pct}
                      className="h-full flex-1 rounded-[1px]"
                      style={{
                        background:
                          i === 3
                            ? "var(--color-amber)"
                            : `color-mix(in srgb, var(--color-bone) ${pct}%, transparent)`,
                      }}
                    />
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[11.5px] text-[var(--color-muted)] sm:grid-cols-4 sm:gap-1">
                  <span>{tProducts("vInternal")}</span>
                  <span>{tProducts("vDatasheet")}</span>
                  <span>{tProducts("vBenchTested")}</span>
                  <span className="text-[var(--color-amber)]">{tProducts("vCertified")}</span>
                </div>
              </div>
            </div>

            <div className="border-t border-[var(--color-line)]">
              {([1, 2, 3] as const).map((i) => (
                <div
                  key={i}
                  data-reveal
                  className="group grid gap-2 border-b border-[var(--color-line)] py-7 md:grid-cols-[56px_minmax(0,1fr)] md:gap-6"
                >
                  <span className="num text-[13px] text-[var(--color-amber)]">
                    0{i}
                  </span>
                  <div>
                    <h3 className="text-[19px] leading-snug font-semibold text-[var(--color-bone)]">
                      {t(`adv${i}Title` as "adv1Title")}
                    </h3>
                    <p className="mt-2 max-w-[52ch] text-[13.5px] leading-relaxed text-[var(--color-muted)]">
                      {t(`adv${i}Desc` as "adv1Desc")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 05 资讯 ───────────────────────────────────────────── */}
      <section className="bg-white">
        <div className="container-page section">
          <SectionHead
            index="05"
            title={t("latestNews")}
            action={{ href: "/news", label: t("viewAll") }}
          />
          <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14">
            {lead && <ArticleCard article={lead} variant="feature" />}
            <div className="self-start">
              {restNews.map((a, i) => (
                <ArticleCard key={a.id} article={a} index={i} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 06 行动区：整幅朱砂，全站唯一的大色块 ───────────────── */}
      <section className="on-brand">
        <div className="container-page relative overflow-hidden py-14 md:py-20">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 -right-16 hidden h-[420px] w-[420px] rounded-full border border-white/15 md:block"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -top-8 -right-8 hidden h-[280px] w-[280px] rounded-full border border-white/10 md:block"
          />
          <div className="relative grid items-end gap-8 md:grid-cols-[1fr_auto]">
            <div>
              <div className="mono mb-4 text-[10.5px] tracking-[0.2em] text-white/70 uppercase">
                06 / Sample &amp; Quotation
              </div>
              <h2 className="display max-w-[20ch] text-[clamp(1.9rem,3.6vw,2.9rem)] text-white">
                {t("ctaTitle")}
              </h2>
              <p className="mt-4 max-w-[40ch] text-[14px] leading-relaxed text-balance text-white/85">
                {t("ctaDesc")}
              </p>
            </div>
            <Link
              href="/contact"
              className="inline-flex h-12 shrink-0 items-center gap-3 bg-white px-7 text-[14px] font-semibold text-[var(--color-void)] transition-colors hover:bg-[var(--color-bone-2)]"
            >
              {t("ctaButton")}
              <span>→</span>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
