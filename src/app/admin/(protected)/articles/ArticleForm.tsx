"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export interface ArticleFormValues {
  slug: string;
  titleZh: string;
  titleEn: string;
  excerptZh: string;
  excerptEn: string;
  bodyZh: string;
  bodyEn: string;
  coverImage: string;
  publishedAt: string;
}

export default function ArticleForm({
  initial,
  isEdit,
}: {
  initial?: Partial<ArticleFormValues>;
  isEdit?: boolean;
}) {
  const router = useRouter();
  const [v, setV] = useState<ArticleFormValues>({
    slug: initial?.slug ?? "",
    titleZh: initial?.titleZh ?? "",
    titleEn: initial?.titleEn ?? "",
    excerptZh: initial?.excerptZh ?? "",
    excerptEn: initial?.excerptEn ?? "",
    bodyZh: initial?.bodyZh ?? "",
    bodyEn: initial?.bodyEn ?? "",
    coverImage: initial?.coverImage ?? "",
    publishedAt: initial?.publishedAt ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function set<K extends keyof ArticleFormValues>(key: K, val: ArticleFormValues[K]) {
    setV((s) => ({ ...s, [key]: val }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const url = isEdit ? `/api/v1/admin/articles/${v.slug}` : `/api/v1/admin/articles`;
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

  return (
    <form onSubmit={submit} className="max-w-3xl space-y-5 bg-white p-6 rounded-lg shadow">
      <h1 className="text-xl font-semibold">{isEdit ? "编辑资讯" : "新建资讯"}</h1>
      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className="block text-sm text-slate-600 mb-1">Slug</span>
          <input disabled={isEdit} value={v.slug} onChange={(e) => set("slug", e.target.value)} className="input" />
        </label>
        <label className="block">
          <span className="block text-sm text-slate-600 mb-1">封面图 URL</span>
          <input value={v.coverImage} onChange={(e) => set("coverImage", e.target.value)} className="input" />
        </label>
        <label className="block">
          <span className="block text-sm text-slate-600 mb-1">标题（中文）</span>
          <input value={v.titleZh} onChange={(e) => set("titleZh", e.target.value)} className="input" />
        </label>
        <label className="block">
          <span className="block text-sm text-slate-600 mb-1">标题（英文）</span>
          <input value={v.titleEn} onChange={(e) => set("titleEn", e.target.value)} className="input" />
        </label>
        <label className="block">
          <span className="block text-sm text-slate-600 mb-1">摘要（中文）</span>
          <input value={v.excerptZh} onChange={(e) => set("excerptZh", e.target.value)} className="input" />
        </label>
        <label className="block">
          <span className="block text-sm text-slate-600 mb-1">摘要（英文）</span>
          <input value={v.excerptEn} onChange={(e) => set("excerptEn", e.target.value)} className="input" />
        </label>
      </div>

      <label className="block">
        <span className="block text-sm text-slate-600 mb-1">正文（中文，支持 Markdown）</span>
        <textarea value={v.bodyZh} onChange={(e) => set("bodyZh", e.target.value)} className="input" rows={6} />
      </label>
      <label className="block">
        <span className="block text-sm text-slate-600 mb-1">正文（英文，支持 Markdown）</span>
        <textarea value={v.bodyEn} onChange={(e) => set("bodyEn", e.target.value)} className="input" rows={6} />
      </label>

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
