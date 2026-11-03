import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import type { Product } from "@/packages/data/types";
import VerificationChip from "./VerificationChip";

/**
 * 料号行：全站产品列表的最小单元。
 *
 * 用「表格行」而不是「卡片」是有意的 —— 客户真正在做的动作是竖着扫一列料号
 * 比较参数，横排卡片会打断这个动作。行式排版同时天然对齐等宽字体，
 * 参数列能像数据手册一样上下对整齐。
 *
 * 移动端退化为两行堆叠（料号 + 等级 / 名称 + 摘要），不丢信息。
 */
export default function ProductRow({ product }: { product: Product }) {
  const t = useTranslations("products");
  const key = product.specs[0];

  return (
    <Link
      href={`/products/${product.mpn}`}
      className="group relative grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-1.5 border-b border-[var(--color-line-soft)] py-4 transition-colors hover:bg-[var(--color-surface-2)] md:grid-cols-[140px_minmax(0,1fr)_200px_126px_24px] md:items-center md:gap-x-6 md:py-5"
    >
      {/* 悬停时左侧亮起的朱砂刻度：不改变行高，不产生跳动 */}
      <span
        aria-hidden
        className="absolute top-0 bottom-0 left-0 w-[2px] origin-top scale-y-0 bg-[var(--color-amber)] transition-transform duration-300 group-hover:scale-y-100"
        style={{ transitionTimingFunction: "cubic-bezier(0.16,1,0.3,1)" }}
      />

      <span className="mono text-[13px] font-medium text-[var(--color-bone)] transition-colors group-hover:text-[var(--color-amber)] md:col-start-1 md:row-start-1">
        {product.mpn}
      </span>

      <span className="justify-self-end md:col-start-4 md:row-start-1 md:justify-self-start">
        <VerificationChip level={product.verificationLevel} />
      </span>

      <span className="col-span-2 min-w-0 md:col-span-1 md:col-start-2 md:row-start-1">
        <span className="line-clamp-2 block text-[15px] font-medium text-[var(--color-bone)] md:line-clamp-1">
          {product.name}
        </span>
        <span className="mt-0.5 block truncate text-[12.5px] text-[var(--color-muted)]">
          {product.summary}
        </span>
      </span>

      <span className="mono hidden text-[12.5px] text-[var(--color-bone-2)] md:col-start-3 md:row-start-1 md:block">
        {key ? (
          <>
            <span className="text-[var(--color-muted)]">{key.label} </span>
            {key.value}
          </>
        ) : (
          "—"
        )}
      </span>

      <span
        aria-hidden
        className="hidden text-[13px] text-[var(--color-muted)] transition-all duration-300 group-hover:translate-x-1 group-hover:text-[var(--color-amber)] md:col-start-5 md:row-start-1 md:block"
      >
        →
      </span>
      <span className="sr-only">{t("mpn")}</span>
    </Link>
  );
}
