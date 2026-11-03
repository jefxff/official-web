"use client";

import { useRef, useState } from "react";

/**
 * 后台上传控件：文件选择 → POST /api/v1/admin/media → 回填 URL。
 *
 * 设计取舍：
 *  - 仍然保留手填 URL 的输入框（编辑可能引用历史外链资源），上传只是**追加**能力；
 *  - 上传成功后才覆盖 value，失败不破坏已有值；
 *  - 前端只做体验层校验（大小/扩展名），真正的类型判定在服务端按魔数进行，前端校验不作为安全边界。
 */

const MAX_BYTES = 8 * 1024 * 1024;

export default function MediaUploadField({
  label,
  value,
  onChange,
  accept = "image/jpeg,image/png,image/webp,image/gif",
  hint,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  accept?: string;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isImage = /\.(jpe?g|png|webp|gif)(\?|$)/i.test(value) || value.startsWith("data:image/");

  async function upload(file: File) {
    setError(null);
    if (file.size > MAX_BYTES) {
      setError(`文件超过 ${MAX_BYTES / 1024 / 1024}MB 上限`);
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/v1/admin/media", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? "上传失败");
        return;
      }
      onChange(data.item.url);
    } catch {
      setError("网络异常，上传未完成");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="block">
      <span className="block text-sm text-[var(--color-muted)] mb-1">{label}</span>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://... 或上传后自动回填"
          className="input flex-1"
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="rounded-[2px] border border-[var(--color-line)] px-3 text-sm text-[var(--color-bone-2)] hover:bg-[var(--color-bg)] disabled:opacity-50 whitespace-nowrap"
        >
          {busy ? "上传中…" : "上传"}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="rounded-[2px] border border-[var(--color-line)] px-3 text-sm text-[var(--color-muted)] hover:bg-[var(--color-bg)]"
          >
            清除
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
        }}
      />
      {hint && <span className="block text-xs text-[var(--color-muted)] mt-1">{hint}</span>}
      {error && <span className="block text-xs text-[var(--color-amber-2)] mt-1">{error}</span>}
      {value && isImage && (
        // 预览用原生 img：上传源是自有域名，无需 Next Image 优化，也避免后台额外配置 remotePatterns。
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value}
          alt="封面预览"
          className="mt-2 h-24 rounded border border-[var(--color-line)] object-cover"
        />
      )}
    </div>
  );
}
