"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ARTICLE_I18N_PAIRS, collectI18nIssues, type I18nIssue } from "@fmw/i18n-validate";
import MediaUploadField from "../../MediaUploadField";
import { FieldMessage, I18nWarning, inputClass, issuesToFieldErrors } from "../../FormFeedback";

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
  const [i18nIssues, setI18nIssues] = useState<I18nIssue[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function set<K extends keyof ArticleFormValues>(key: K, val: ArticleFormValues[K]) {
    setV((s) => ({ ...s, [key]: val }));
    // 用户改动后清掉该字段的错误提示，避免「改完了红字还在」。
    setFieldErrors((e) => {
      if (!e[key]) return e;
      const next = { ...e };
      delete next[key];
      return next;
    });
  }

  async function save() {
    setLoading(true);
    setError(null);
    setFieldErrors({});
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
    // 先做中英对照检查：有问题先提示一次，编辑确认后才放行（品牌名/料号本就相同的情况很常见）。
    if (i18nIssues.length === 0) {
      const found = collectI18nIssues(v, ARTICLE_I18N_PAIRS);
      if (found.length > 0) {
        setI18nIssues(found);
        return;
      }
    }
    await save();
  }

  return (
    <form onSubmit={submit} className="max-w-3xl space-y-5 bg-white p-6 rounded-lg shadow">
      <h1 className="text-xl font-semibold">{isEdit ? "编辑资讯" : "新建资讯"}</h1>
      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className="block text-sm text-slate-600 mb-1">Slug</span>
          <input
            disabled={isEdit}
            value={v.slug}
            onChange={(e) => set("slug", e.target.value)}
            className={inputClass(Boolean(fieldErrors.slug))}
          />
          <FieldMessage message={fieldErrors.slug} />
        </label>
        <div className="block">
          <MediaUploadField
            label="封面图（上传或填 URL）"
            value={v.coverImage}
            onChange={(url) => set("coverImage", url)}
            hint="支持 JPG/PNG/WebP/GIF，单张 ≤ 8MB"
          />
          <FieldMessage message={fieldErrors.coverImage} />
        </div>
        <label className="block">
          <span className="block text-sm text-slate-600 mb-1">标题（中文）</span>
          <input
            value={v.titleZh}
            onChange={(e) => set("titleZh", e.target.value)}
            className={inputClass(Boolean(fieldErrors.titleZh))}
          />
          <FieldMessage message={fieldErrors.titleZh} />
        </label>
        <label className="block">
          <span className="block text-sm text-slate-600 mb-1">标题（英文）</span>
          <input
            value={v.titleEn}
            onChange={(e) => set("titleEn", e.target.value)}
            className={inputClass(Boolean(fieldErrors.titleEn))}
          />
          <FieldMessage message={fieldErrors.titleEn} />
        </label>
        <label className="block">
          <span className="block text-sm text-slate-600 mb-1">摘要（中文）</span>
          <input
            value={v.excerptZh}
            onChange={(e) => set("excerptZh", e.target.value)}
            className={inputClass(Boolean(fieldErrors.excerptZh))}
          />
          <FieldMessage message={fieldErrors.excerptZh} />
        </label>
        <label className="block">
          <span className="block text-sm text-slate-600 mb-1">摘要（英文）</span>
          <input
            value={v.excerptEn}
            onChange={(e) => set("excerptEn", e.target.value)}
            className={inputClass(Boolean(fieldErrors.excerptEn))}
          />
          <FieldMessage message={fieldErrors.excerptEn} />
        </label>
      </div>

      <label className="block">
        <span className="block text-sm text-slate-600 mb-1">正文（中文，支持 Markdown）</span>
        <textarea
          value={v.bodyZh}
          onChange={(e) => set("bodyZh", e.target.value)}
          className={inputClass(Boolean(fieldErrors.bodyZh))}
          rows={6}
        />
        <FieldMessage message={fieldErrors.bodyZh} />
      </label>
      <label className="block">
        <span className="block text-sm text-slate-600 mb-1">正文（英文，支持 Markdown）</span>
        <textarea
          value={v.bodyEn}
          onChange={(e) => set("bodyEn", e.target.value)}
          className={inputClass(Boolean(fieldErrors.bodyEn))}
          rows={6}
        />
        <FieldMessage message={fieldErrors.bodyEn} />
      </label>

      <I18nWarning
        issues={i18nIssues}
        busy={loading}
        onIgnore={() => {
          setI18nIssues([]);
          void save();
        }}
        onCancel={() => setI18nIssues([])}
      />

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-[var(--color-brand)] text-white px-5 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "保存中…" : "保存"}
        </button>
        <Link href="/admin" className="px-5 py-2.5 text-sm text-slate-500 hover:underline">
          取消
        </Link>
      </div>
    </form>
  );
}
