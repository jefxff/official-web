"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AdminNav({ user }: { user: string }) {
  const router = useRouter();
  async function logout() {
    await fetch("/api/v1/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-[var(--color-line)] bg-[var(--color-void)] p-5">
      <div>
        <div className="label">FMW / Admin</div>
        <div className="mt-2 text-[15px] font-bold text-[var(--color-bone)]">富满微 · 后台</div>
        <div className="mono mt-1 text-[10px] tracking-[0.14em] text-[var(--color-muted)] uppercase">
          国内唯一写点
        </div>
      </div>

      <nav className="mt-8 flex flex-col text-[13.5px]">
        {[
          { href: "/admin", label: "仪表盘" },
          { href: "/admin/products/new", label: "新建料号" },
          { href: "/admin/articles/new", label: "新建资讯" },
          { href: "/admin/setup", label: "TOTP 设置" },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="border-b border-[var(--color-line-soft)] py-3 text-[var(--color-bone-2)] transition-colors hover:text-[var(--color-amber)]"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="mt-auto">
        <div className="mono text-[11px] text-[var(--color-muted)]">当前用户：{user}</div>
        <button
          onClick={logout}
          className="mt-3 w-full border border-[var(--color-line)] px-3 py-2 text-[12.5px] text-[var(--color-bone-2)] transition-colors hover:border-[var(--color-amber)] hover:text-[var(--color-amber)]"
        >
          退出登录
        </button>
      </div>
    </aside>
  );
}
