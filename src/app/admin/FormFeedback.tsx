"use client";

import type { I18nIssue } from "@fmw/i18n-validate";

/**
 * 后台表单的共用反馈组件。
 *
 * 两类错误必须分开呈现，否则编辑无法判断该改什么：
 *  - **校验错误（blocking）**：字段级，来自服务端 zod issues 或前端必需项，不修不能保存；
 *  - **国际化提醒（advisory）**：中英对照类问题（漏译/中文写进英文栏），可确认放行。
 */

/** 输入框样式：有错时换红边，同时保留原有 .input 基线。 */
export function inputClass(hasError?: boolean): string {
  return hasError ? "input border-red-400 ring-1 ring-red-200" : "input";
}

export function FieldMessage({ message }: { message?: string }) {
  if (!message) return null;
  return <span className="mt-1 block text-xs text-[var(--color-amber-2)]">{message}</span>;
}

export function I18nWarning({
  issues,
  onIgnore,
  onCancel,
  busy,
}: {
  issues: I18nIssue[];
  onIgnore: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  if (issues.length === 0) return null;
  return (
    <div className="rounded-[2px] border border-amber-300 bg-amber-50 p-4">
      <p className="text-sm font-medium text-amber-900">
        检测到 {issues.length} 处中英文内容问题（可确认后继续保存）
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-800">
        {issues.map((issue) => (
          <li key={`${issue.field}-${issue.kind}`}>{issue.message}</li>
        ))}
      </ul>
      <div className="mt-3 flex gap-3">
        <button
          type="button"
          onClick={onIgnore}
          disabled={busy}
          className="rounded-[2px] bg-amber-600 px-4 py-2 text-sm font-medium text-[var(--color-on-brand)] hover:bg-amber-700 disabled:opacity-50"
        >
          确认无误，继续保存
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-[2px] px-4 py-2 text-sm text-amber-800 hover:underline"
        >
          返回修改
        </button>
      </div>
    </div>
  );
}

/** 服务端 zod issues → { 字段名: 提示 }，供逐字段高亮。 */
export function issuesToFieldErrors(
  raw: unknown
): Record<string, string> {
  if (!Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const item of raw) {
    const it = item as { path?: unknown[]; message?: string };
    const key = (it.path ?? []).map(String).join(".");
    if (key && it.message && !out[key]) out[key] = it.message;
  }
  return out;
}
