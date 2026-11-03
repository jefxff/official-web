import { getArticleBySlug } from "@fmw/data";
import { notFound } from "next/navigation";
import ArticleForm, { type ArticleFormValues } from "../../ArticleForm";

export const dynamic = "force-dynamic";

export default async function EditArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug, "zh");
  if (!article) notFound();

  const initial: Partial<ArticleFormValues> = {
    slug: article.slug,
    titleZh: article.title,
    titleEn: article.title,
    excerptZh: article.excerpt,
    excerptEn: article.excerpt,
    bodyZh: article.body,
    bodyEn: article.body,
    coverImage: article.coverImage ?? "",
    publishedAt: article.publishedAt.slice(0, 16),
  };

  return <ArticleForm isEdit initial={initial} />;
}
