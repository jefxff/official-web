import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import type { Product } from "@/packages/data/types";

const VLEVEL_BADGE: Record<string, string> = {
  INTERNAL: "bg-gray-100 text-gray-600",
  DATASHEET: "bg-blue-50 text-blue-700",
  BENCH_TESTED: "bg-green-50 text-green-700",
  CERTIFIED: "bg-amber-50 text-amber-700",
};

export default function ProductCard({ product }: { product: Product }) {
  const t = useTranslations("products");
  const badge = VLEVEL_BADGE[product.verificationLevel] ?? VLEVEL_BADGE.INTERNAL;

  return (
    <Link
      href={`/products/${product.mpn}`}
      className="block rounded-xl border border-[var(--color-line)] bg-white p-5 hover:shadow-md hover:border-[var(--color-brand)] transition"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-sm text-[var(--color-brand)]">{product.mpn}</span>
        <span className={`text-[11px] px-2 py-0.5 rounded-full ${badge}`}>
          {/* 四档都要走文案表：此前只有 BENCH_TESTED 翻译了，
              中文页面会混出 Datasheet / Internal / Certified 三个英文徽标。 */}
          {t(
            product.verificationLevel === "BENCH_TESTED"
              ? "vBenchTested"
              : product.verificationLevel === "CERTIFIED"
              ? "vCertified"
              : product.verificationLevel === "DATASHEET"
              ? "vDatasheet"
              : "vInternal"
          )}
        </span>
      </div>
      <h3 className="font-medium text-[var(--color-ink)] leading-snug mb-1">{product.name}</h3>
      <p className="text-sm text-[var(--color-sub)] line-clamp-2">{product.summary}</p>
      <div className="mt-3 text-xs text-[var(--color-sub)]">
        {t("category")}: {product.category}
      </div>
    </Link>
  );
}
