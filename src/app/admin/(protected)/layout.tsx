import { redirect } from "next/navigation";
import { getServerSession } from "@fmw/auth";
import AdminNav from "../AdminNav";

// 受保护后台布局：未登录跳转登录页（登录页位于 (public)，不在本组，故不会死循环）。
export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getServerSession();
  if (!user) {
    redirect("/admin/login");
  }
  return (
    <div className="min-h-screen flex">
      <AdminNav user={user} />
      <main className="flex-1 bg-[var(--color-bg)] p-8">{children}</main>
    </div>
  );
}
