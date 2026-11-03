import { useTranslations } from "next-intl";
import type { VerificationLevel } from "@/packages/data/types";

/**
 * 验证等级标记。
 *
 * 四档不是「颜色标签」，而是客户准入审查时的可信度分级，所以用
 * 线型 + 底色 + 点 三种手段叠加表达，保证不靠颜色也能区分：
 *   INTERNAL     虚线框（设计值，仅供内部参考）
 *   DATASHEET    实线框（来自数据手册）
 *   BENCH_TESTED 实线 + 状态点（我们自己实测过）
 *   CERTIFIED    琥珀实心（第三方认证，最高档）
 */
const STYLE: Record<VerificationLevel, string> = {
  INTERNAL: "chip chip-muted",
  DATASHEET: "chip",
  BENCH_TESTED: "chip chip-bench chip-dot",
  CERTIFIED: "chip chip-filled",
};

const LABEL_KEY: Record<VerificationLevel, string> = {
  INTERNAL: "vInternal",
  DATASHEET: "vDatasheet",
  BENCH_TESTED: "vBenchTested",
  CERTIFIED: "vCertified",
};

export default function VerificationChip({
  level,
  className = "",
}: {
  level: VerificationLevel;
  className?: string;
}) {
  const t = useTranslations("products");
  return (
    <span className={`${STYLE[level]} ${className}`}>
      {t(LABEL_KEY[level] as "vInternal")}
    </span>
  );
}
