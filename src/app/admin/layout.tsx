import "../globals.css";

export const metadata = {
  title: "富满微官网 · 后台",
  robots: { index: false, follow: false },
};

// 后台根布局：仅提供 html/body 外壳。鉴权与导航由 (protected) 子组布局负责，
// 登录/设置页位于 (public)，不受守卫影响，避免「未登录→重定向登录→又被守卫拦截」死循环。
export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh">
      <body>{children}</body>
    </html>
  );
}
