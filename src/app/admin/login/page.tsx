"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/v1/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, totp }),
    });
    if (res.ok) {
      router.push("/admin");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.message ?? "登录失败");
      setLoading(false);
    }
  }

  return (
    <div className="grain relative flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-5">
      <form
        onSubmit={submit}
        className="relative z-10 w-full max-w-[380px] border border-[var(--color-line)] bg-[var(--color-surface)] p-8"
      >
        <div className="label mb-6">FMW / Admin</div>
        <h1 className="text-[20px] font-bold tracking-[-0.01em] text-[var(--color-bone)]">
          富满微官网 · 后台
        </h1>
        <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--color-muted)]">
          用户名 / 密码 + TOTP 动态码（双重校验）
        </p>

        <div className="mt-7 space-y-4">
          <div>
            <label className="label mb-2 block" htmlFor="admin-username">
              用户名
            </label>
            <input
              id="admin-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label mb-2 block" htmlFor="admin-password">
              密码
            </label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label mb-2 block" htmlFor="admin-totp">
              动态验证码（TOTP）
            </label>
            <input
              id="admin-totp"
              value={totp}
              onChange={(e) => setTotp(e.target.value)}
              placeholder="6 位动态码"
              inputMode="numeric"
              className="input mono tracking-[0.3em]"
            />
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-4 border-l-2 border-[var(--color-amber)] px-3 py-1.5 text-[12.5px] text-[var(--color-bone-2)]">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary mt-6 w-full"
        >
          {loading ? "登录中…" : "登录"}
        </button>
      </form>
    </div>
  );
}
