import Link from "next/link";
import { getArticles, getProducts } from "@fmw/data";
import { verificationLabel } from "../labels";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const [products, articles] = await Promise.all([
    getProducts("zh"),
    getArticles("zh"),
  ]);

  return (
    <div className="space-y-10">
      <section>
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-semibold">料号（{products.length}）</h1>
          <Link
            href="/admin/products/new"
            className="rounded-[2px] bg-[var(--color-brand)] text-[var(--color-on-brand)] px-4 py-2 text-sm font-medium hover:opacity-90"
          >
            新建料号
          </Link>
        </div>
        <div className="bg-[var(--color-surface)] rounded-[2px] shadow-none overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-surface-2)] text-[var(--color-muted)]">
              <tr>
                <th className="text-left px-4 py-2">料号</th>
                <th className="text-left px-4 py-2">名称</th>
                <th className="text-left px-4 py-2">分类</th>
                <th className="text-left px-4 py-2">验证等级</th>
                <th className="text-left px-4 py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="px-4 py-2 font-mono">{p.mpn}</td>
                  <td className="px-4 py-2">{p.name}</td>
                  <td className="px-4 py-2">{p.category}</td>
                  <td className="px-4 py-2">{verificationLabel(p.verificationLevel)}</td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/admin/products/${p.mpn}/edit`}
                      className="text-[var(--color-brand)] hover:underline"
                    >
                      编辑
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-semibold">资讯（{articles.length}）</h1>
          <Link
            href="/admin/articles/new"
            className="rounded-[2px] bg-[var(--color-brand)] text-[var(--color-on-brand)] px-4 py-2 text-sm font-medium hover:opacity-90"
          >
            新建资讯
          </Link>
        </div>
        <div className="bg-[var(--color-surface)] rounded-[2px] shadow-none overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-surface-2)] text-[var(--color-muted)]">
              <tr>
                <th className="text-left px-4 py-2">标题</th>
                <th className="text-left px-4 py-2">Slug</th>
                <th className="text-left px-4 py-2">发布时间</th>
                <th className="text-left px-4 py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {articles.map((a) => (
                <tr key={a.id} className="border-t">
                  <td className="px-4 py-2">{a.title}</td>
                  <td className="px-4 py-2 font-mono">{a.slug}</td>
                  <td className="px-4 py-2">{a.publishedAt.slice(0, 10)}</td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/admin/articles/${a.slug}/edit`}
                      className="text-[var(--color-brand)] hover:underline"
                    >
                      编辑
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
