import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getProductByMpn, getProducts, getSeriesList } from "@/packages/data";
import { buildMetadata } from "@/packages/seo";
import { Link } from "@/i18n/routing";

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

const VLEVEL_TEXT: Record<string, { zh: string; en: string; cls: string }> = {
  INTERNAL: { zh: "内部设计值", en: "Internal", cls: "bg-gray-100 text-gray-600" },
  DATASHEET: { zh: "数据手册值", en: "Datasheet", cls: "bg-blue-50 text-blue-700" },
  BENCH_TESTED: { zh: "实测验证", en: "Bench-Tested", cls: "bg-green-50 text-green-700" },
  CERTIFIED: { zh: "第三方认证", en: "Certified", cls: "bg-amber-50 text-amber-700" },
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
  const v = VLEVEL_TEXT[product.verificationLevel];

  return (
    <div className="container-page py-10">
      <nav className="text-xs text-[var(--color-sub)] mb-4">
        <Link href="/products" className="hover:text-[var(--color-brand)]">{t("title")}</Link>
        {series && (
          <>
            <span className="mx-2">/</span>
            <Link href={`/series/${series.slug}`} className="hover:text-[var(--color-brand)]">
              {series.name}
            </Link>
          </>
        )}
      </nav>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="flex items-center gap-3 mb-2">
            <span className="font-mono text-lg text-[var(--color-brand)]">{product.mpn}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${v.cls}`}>
              {l === "zh" ? v.zh : v.en}
            </span>
          </div>
          <h1 className="text-2xl font-semibold mb-3">{product.name}</h1>
          <p className="text-[var(--color-sub)] mb-6">{product.summary}</p>

          <h2 className="text-lg font-medium mb-3">{t("specs")}</h2>
          <table className="w-full border-collapse text-sm mb-6">
            <tbody>
              {product.specs.map((s, i) => (
                <tr key={i} className="border-b border-[var(--color-line)]">
                  <td className="py-2.5 pr-4 text-[var(--color-sub)] w-1/3">{s.label}</td>
                  <td className="py-2.5 font-medium">{s.value}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 className="text-lg font-medium mb-3">{t("documentation")}</h2>
          <div className="flex flex-wrap gap-3 mb-6">
            {product.datasheetUrl && (
              <a
                href={product.datasheetUrl}
                className="px-4 py-2 rounded-lg border border-[var(--color-line)] text-sm hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
              >
                {t("datasheet")}
              </a>
            )}
            {product.appNoteUrl && (
              <a
                href={product.appNoteUrl}
                className="px-4 py-2 rounded-lg border border-[var(--color-line)] text-sm hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
              >
                {t("appNote")}
              </a>
            )}
          </div>

          {product.verifiedEvidence && (
            <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-sm text-green-800">
              <span className="font-medium">{t("benchTested")}: </span>
              {product.verifiedEvidence}
            </div>
          )}
        </div>

        <aside className="lg:col-span-1">
          <div className="rounded-xl border border-[var(--color-line)] bg-white p-5 sticky top-20">
            <div className="text-sm text-[var(--color-sub)] mb-1">{t("category")}</div>
            <div className="font-medium mb-4">{product.category}</div>
            <Link
              href="/contact"
              className="block text-center rounded-lg bg-[var(--color-brand)] text-white px-4 py-2.5 text-sm font-medium hover:opacity-90"
            >
              {t("ctaQuote")}
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
