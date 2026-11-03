"use client";

import { useState } from "react";
import { verificationLabel } from "../../labels";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PRODUCT_I18N_PAIRS, collectI18nIssues, type I18nIssue } from "@fmw/i18n-validate";
import MediaUploadField from "../../MediaUploadField";
import { FieldMessage, I18nWarning, inputClass, issuesToFieldErrors } from "../../FormFeedback";

export interface ProductFormValues {
  mpn: string;
  category: string;
  seriesId: string;
  nameZh: string;
  nameEn: string;
  summaryZh: string;
  summaryEn: string;
  descriptionZh: string;
  descriptionEn: string;
  verificationLevel: "INTERNAL" | "DATASHEET" | "BENCH_TESTED" | "CERTIFIED";
  verifiedEvidence: string;
  verifiedEvidenceEn: string;
  datasheetUrl: string;
  appNoteUrl: string;
  specs: { label: string; labelEn: string; value: string }[];
}

const LEVELS: ProductFormValues["verificationLevel"][] = [
  "INTERNAL",
  "DATASHEET",
  "BENCH_TESTED",
  "CERTIFIED",
];

export default function ProductForm({
  initial,
  seriesOptions,
  isEdit,
}: {
  initial?: Partial<ProductFormValues>;
  seriesOptions: { id: string; name: string }[];
  isEdit?: boolean;
}) {
  const router = useRouter();
  const [v, setV] = useState<ProductFormValues>({
    mpn: initial?.mpn ?? "",
    category: initial?.category ?? "",
    seriesId: initial?.seriesId ?? "",
    nameZh: initial?.nameZh ?? "",
    nameEn: initial?.nameEn ?? "",
    summaryZh: initial?.summaryZh ?? "",
    summaryEn: initial?.summaryEn ?? "",
    descriptionZh: initial?.descriptionZh ?? "",
    descriptionEn: initial?.descriptionEn ?? "",
    verificationLevel: initial?.verificationLevel ?? "INTERNAL",
    verifiedEvidence: initial?.verifiedEvidence ?? "",
    verifiedEvidenceEn: initial?.verifiedEvidenceEn ?? "",
    datasheetUrl: initial?.datasheetUrl ?? "",
    appNoteUrl: initial?.appNoteUrl ?? "",
    specs: initial?.specs ?? [],
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [i18nIssues, setI18nIssues] = useState<I18nIssue[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function set<K extends keyof ProductFormValues>(key: K, val: ProductFormValues[K]) {
    setV((s) => ({ ...s, [key]: val }));
    setFieldErrors((e) => {
      if (!e[key]) return e;
      const next = { ...e };
      delete next[key];
      return next;
    });
  }

  function setSpec(i: number, key: "label" | "labelEn" | "value", val: string) {
    setV((s) => ({
      ...s,
      specs: s.specs.map((sp, idx) => (idx === i ? { ...sp, [key]: val } : sp)),
    }));
    setFieldErrors((e) => {
      const k = `specs.${i}.${key}`;
      if (!e[k]) return e;
      const next = { ...e };
      delete next[k];
      return next;
    });
  }

  async function save() {
    setLoading(true);
    setError(null);
    setFieldErrors({});
    const url = isEdit ? `/api/v1/admin/products/${v.mpn}` : `/api/v1/admin/products`;
    const method = isEdit ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(v),
    });
    if (res.ok) {
      router.push("/admin");
      router.refresh();
      return;
    }
    const d = await res.json().catch(() => ({}));
    setFieldErrors(issuesToFieldErrors(d.issues));
    setError(
      d.message ??
        (Array.isArray(d.issues) && d.issues.length > 0
          ? "提交内容有 " + d.issues.length + " 处不合规，请按字段提示修正"
          : "保存失败")
    );
    setLoading(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (i18nIssues.length === 0) {
      const found = collectI18nIssues(v, PRODUCT_I18N_PAIRS);
      if (found.length > 0) {
        setI18nIssues(found);
        return;
      }
    }
    await save();
  }

  const needsEvidence =
    v.verificationLevel === "BENCH_TESTED" || v.verificationLevel === "CERTIFIED";

  return (
    <form onSubmit={submit} className="max-w-3xl space-y-5 bg-[var(--color-surface)] p-6 rounded-[2px] shadow-none">
      <h1 className="text-xl font-semibold">{isEdit ? "编辑料号" : "新建料号"}</h1>

      <div className="grid grid-cols-2 gap-4">
        <Field label="料号 MPN" error={fieldErrors.mpn}>
          <input
            disabled={isEdit}
            value={v.mpn}
            onChange={(e) => set("mpn", e.target.value)}
            className={inputClass(Boolean(fieldErrors.mpn))}
          />
        </Field>
        <Field label="分类" error={fieldErrors.category}>
          <input
            value={v.category}
            onChange={(e) => set("category", e.target.value)}
            className={inputClass(Boolean(fieldErrors.category))}
          />
        </Field>
        <Field label="系列">
          {/* value 必须用 Series.id：DB 里 products.seriesId 存的是 id，用 slug 会导致
              回填匹配不上 → select 退回「（无）」→ 保存时静默清空系列关联。 */}
          <select value={v.seriesId} onChange={(e) => set("seriesId", e.target.value)} className="input">
            <option value="">（无）</option>
            {seriesOptions.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </Field>
        <Field label="验证等级">
          <select
            value={v.verificationLevel}
            onChange={(e) => set("verificationLevel", e.target.value as ProductFormValues["verificationLevel"])}
            className="input"
          >
            {LEVELS.map((l) => (
              // value 保持枚举（提交给写接口），显示用中文档位
              <option key={l} value={l}>{verificationLabel(l)}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="名称（中文）" error={fieldErrors.nameZh}>
          <input value={v.nameZh} onChange={(e) => set("nameZh", e.target.value)} className={inputClass(Boolean(fieldErrors.nameZh))} />
        </Field>
        <Field label="名称（英文）" error={fieldErrors.nameEn}>
          <input value={v.nameEn} onChange={(e) => set("nameEn", e.target.value)} className={inputClass(Boolean(fieldErrors.nameEn))} />
        </Field>
        <Field label="摘要（中文）" error={fieldErrors.summaryZh}>
          <input value={v.summaryZh} onChange={(e) => set("summaryZh", e.target.value)} className={inputClass(Boolean(fieldErrors.summaryZh))} />
        </Field>
        <Field label="摘要（英文）" error={fieldErrors.summaryEn}>
          <input value={v.summaryEn} onChange={(e) => set("summaryEn", e.target.value)} className={inputClass(Boolean(fieldErrors.summaryEn))} />
        </Field>
      </div>

      <Field label="描述（中文）" error={fieldErrors.descriptionZh}>
        <textarea
          value={v.descriptionZh}
          onChange={(e) => set("descriptionZh", e.target.value)}
          className={inputClass(Boolean(fieldErrors.descriptionZh))}
          rows={3}
        />
      </Field>
      <Field label="描述（英文）" error={fieldErrors.descriptionEn}>
        <textarea
          value={v.descriptionEn}
          onChange={(e) => set("descriptionEn", e.target.value)}
          className={inputClass(Boolean(fieldErrors.descriptionEn))}
          rows={3}
        />
      </Field>

      {needsEvidence && (
        <>
          <Field
            label="验证证据（中文，实测验证 / 第三方认证必填）"
            error={fieldErrors.verifiedEvidence}
          >
            <input
              value={v.verifiedEvidence}
              onChange={(e) => set("verifiedEvidence", e.target.value)}
              className={inputClass(Boolean(fieldErrors.verifiedEvidence))}
              placeholder="测试报告编号 / 认证证书编号"
            />
          </Field>
          <Field label="验证证据（英文，双语站必需；缺失时前台回落中文）">
            <input
              value={v.verifiedEvidenceEn}
              onChange={(e) => set("verifiedEvidenceEn", e.target.value)}
              className="input"
              placeholder="Bench report / certificate reference (English)"
            />
          </Field>
        </>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <MediaUploadField
            label="数据手册（上传 PDF 或填 URL）"
            value={v.datasheetUrl}
            onChange={(url) => set("datasheetUrl", url)}
            accept="application/pdf"
            hint="仅 PDF，≤ 8MB"
          />
          <FieldMessage message={fieldErrors.datasheetUrl} />
        </div>
        <div>
          <MediaUploadField
            label="应用笔记（上传 PDF 或填 URL）"
            value={v.appNoteUrl}
            onChange={(url) => set("appNoteUrl", url)}
            accept="application/pdf"
            hint="仅 PDF，≤ 8MB"
          />
          <FieldMessage message={fieldErrors.appNoteUrl} />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-[var(--color-bone-2)]">技术参数</span>
          <button
            type="button"
            onClick={() => set("specs", [...v.specs, { label: "", labelEn: "", value: "" }])}
            className="text-sm text-[var(--color-brand)] hover:underline"
          >
            + 添加参数
          </button>
        </div>
        <div className="space-y-2">
          {v.specs.map((sp, i) => (
            <div key={i}>
              <div className="grid grid-cols-4 gap-2 items-center">
                <input
                  placeholder="中文标签"
                  value={sp.label}
                  onChange={(e) => setSpec(i, "label", e.target.value)}
                  className={inputClass(Boolean(fieldErrors[`specs.${i}.label`]))}
                />
                <input
                  placeholder="英文标签"
                  value={sp.labelEn}
                  onChange={(e) => setSpec(i, "labelEn", e.target.value)}
                  className={inputClass(Boolean(fieldErrors[`specs.${i}.labelEn`]))}
                />
                <input
                  placeholder="值"
                  value={sp.value}
                  onChange={(e) => setSpec(i, "value", e.target.value)}
                  className={inputClass(Boolean(fieldErrors[`specs.${i}.value`]))}
                />
                <button
                  type="button"
                  onClick={() => set("specs", v.specs.filter((_, idx) => idx !== i))}
                  className="text-sm text-[var(--color-amber-2)] hover:underline"
                >
                  删除
                </button>
              </div>
              {fieldErrors[`specs.${i}.label`] && (
                <FieldMessage message={`第 ${i + 1} 行：${fieldErrors[`specs.${i}.label`]}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <I18nWarning
        issues={i18nIssues}
        busy={loading}
        onIgnore={() => {
          setI18nIssues([]);
          void save();
        }}
        onCancel={() => setI18nIssues([])}
      />

      {error && <p className="text-sm text-[var(--color-amber-2)]">{error}</p>}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-[2px] bg-[var(--color-brand)] text-[var(--color-on-brand)] px-5 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "保存中…" : "保存"}
        </button>
        <Link href="/admin" className="px-5 py-2.5 text-sm text-[var(--color-muted)] hover:underline">
          取消
        </Link>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm text-[var(--color-muted)] mb-1">{label}</span>
      {children}
      <FieldMessage message={error} />
    </label>
  );
}
