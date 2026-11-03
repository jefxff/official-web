"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
  seriesOptions: { slug: string; name: string }[];
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

  function set<K extends keyof ProductFormValues>(key: K, val: ProductFormValues[K]) {
    setV((s) => ({ ...s, [key]: val }));
  }
  function setSpec(i: number, key: "label" | "labelEn" | "value", val: string) {
    setV((s) => ({
      ...s,
      specs: s.specs.map((sp, idx) => (idx === i ? { ...sp, [key]: val } : sp)),
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
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
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.message ?? JSON.stringify(d.issues ?? d) ?? "保存失败");
      setLoading(false);
    }
  }

  const needsEvidence = v.verificationLevel === "BENCH_TESTED" || v.verificationLevel === "CERTIFIED";

  return (
    <form onSubmit={submit} className="max-w-3xl space-y-5 bg-white p-6 rounded-lg shadow">
      <h1 className="text-xl font-semibold">{isEdit ? "编辑料号" : "新建料号"}</h1>

      <div className="grid grid-cols-2 gap-4">
        <Field label="料号 MPN">
          <input disabled={isEdit} value={v.mpn} onChange={(e) => set("mpn", e.target.value)} className="input" />
        </Field>
        <Field label="分类">
          <input value={v.category} onChange={(e) => set("category", e.target.value)} className="input" />
        </Field>
        <Field label="系列">
          <select value={v.seriesId} onChange={(e) => set("seriesId", e.target.value)} className="input">
            <option value="">（无）</option>
            {seriesOptions.map((s) => (
              <option key={s.slug} value={s.slug}>{s.name}</option>
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
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="名称（中文）"><input value={v.nameZh} onChange={(e) => set("nameZh", e.target.value)} className="input" /></Field>
        <Field label="名称（英文）"><input value={v.nameEn} onChange={(e) => set("nameEn", e.target.value)} className="input" /></Field>
        <Field label="摘要（中文）"><input value={v.summaryZh} onChange={(e) => set("summaryZh", e.target.value)} className="input" /></Field>
        <Field label="摘要（英文）"><input value={v.summaryEn} onChange={(e) => set("summaryEn", e.target.value)} className="input" /></Field>
      </div>

      <Field label="描述（中文）">
        <textarea value={v.descriptionZh} onChange={(e) => set("descriptionZh", e.target.value)} className="input" rows={3} />
      </Field>
      <Field label="描述（英文）">
        <textarea value={v.descriptionEn} onChange={(e) => set("descriptionEn", e.target.value)} className="input" rows={3} />
      </Field>

      {needsEvidence && (
        <>
          <Field label="验证证据（中文，BENCH_TESTED / CERTIFIED 必填）">
            <input value={v.verifiedEvidence} onChange={(e) => set("verifiedEvidence", e.target.value)} className="input" placeholder="测试报告编号 / 认证证书编号" />
          </Field>
          <Field label="验证证据（英文，双语站必需；缺失时前台回落中文）">
            <input value={v.verifiedEvidenceEn} onChange={(e) => set("verifiedEvidenceEn", e.target.value)} className="input" placeholder="Bench report / certificate reference (English)" />
          </Field>
        </>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field label="数据手册 URL"><input value={v.datasheetUrl} onChange={(e) => set("datasheetUrl", e.target.value)} className="input" /></Field>
        <Field label="应用笔记 URL"><input value={v.appNoteUrl} onChange={(e) => set("appNoteUrl", e.target.value)} className="input" /></Field>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-700">技术参数</span>
          <button type="button" onClick={() => set("specs", [...v.specs, { label: "", labelEn: "", value: "" }])}
            className="text-sm text-[var(--color-brand)] hover:underline">+ 添加参数</button>
        </div>
        <div className="space-y-2">
          {v.specs.map((sp, i) => (
            <div key={i} className="grid grid-cols-4 gap-2 items-center">
              <input placeholder="中文标签" value={sp.label} onChange={(e) => setSpec(i, "label", e.target.value)} className="input" />
              <input placeholder="英文标签" value={sp.labelEn} onChange={(e) => setSpec(i, "labelEn", e.target.value)} className="input" />
              <input placeholder="值" value={sp.value} onChange={(e) => setSpec(i, "value", e.target.value)} className="input" />
              <button type="button" onClick={() => set("specs", v.specs.filter((_, idx) => idx !== i))}
                className="text-sm text-red-600 hover:underline">删除</button>
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={loading}
          className="rounded-lg bg-[var(--color-brand)] text-white px-5 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50">
          {loading ? "保存中…" : "保存"}
        </button>
        <Link href="/admin" className="px-5 py-2.5 text-sm text-slate-500 hover:underline">取消</Link>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm text-slate-600 mb-1">{label}</span>
      {children}
    </label>
  );
}
