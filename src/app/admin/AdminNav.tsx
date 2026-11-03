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
    <aside className="w-56 bg-slate-900 text-slate-100 p-5 flex flex-col gap-6">
      <div>
        <div className="text-lg font-semibold">富满微 · 后台</div>
        <div className="text-xs text-slate-400 mt-1">国内唯一写点</div>
      </div>
      <nav className="flex flex-col gap-2 text-sm">
        <Link href="/admin" className="hover:text-white">仪表盘</Link>
        <Link href="/admin/products/new" className="hover:text-white">新建料号</Link>
        <Link href="/admin/articles/new" className="hover:text-white">新建资讯</Link>
        <Link href="/admin/setup" className="hover:text-white">TOTP 设置</Link>
      </nav>
      <div className="mt-auto text-xs text-slate-400">
        <div>当前用户：{user}</div>
        <button
          onClick={logout}
          className="mt-2 px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-100"
        >
          退出登录
        </button>
      </div>
    </aside>
  );
}
