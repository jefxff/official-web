/**
 * 后台中文标签映射。
 *
 * 验证等级在 DB 里是枚举（INTERNAL / DATASHEET / BENCH_TESTED / CERTIFIED），
 * 但运营在后台看到的不该是英文枚举 —— 之前下拉框与列表都直接输出枚举原文。
 * 注意：这里只用于**展示**，提交值必须仍是枚举，否则写接口会校验失败。
 */

export const VERIFICATION_LABELS: Record<string, string> = {
  INTERNAL: "内部设计值",
  DATASHEET: "数据手册值",
  BENCH_TESTED: "实测验证",
  CERTIFIED: "第三方认证",
};

export function verificationLabel(value: string): string {
  return VERIFICATION_LABELS[value] ?? value;
}
