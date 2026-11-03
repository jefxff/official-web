import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@fmw/db";
import { requireAdmin, requireDbMode } from "../guard";
import { articleInputSchema } from "../schemas";
import { afterArticleChange } from "@fmw/publish";
import { mapArticleToView } from "../mapper";

export async function GET() {
  const modeGuard = requireDbMode();
  if (modeGuard) return modeGuard;
  const rows = await prisma.article.findMany({ orderBy: { publishedAt: "desc" } });
  return NextResponse.json({ items: rows.map(mapArticleToView) });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth) return auth;
  const modeGuard = requireDbMode();
  if (modeGuard) return modeGuard;

  const parsed = articleInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const input = parsed.data;
  const existing = await prisma.article.findUnique({ where: { slug: input.slug } });
  if (existing) {
    return NextResponse.json(
      { error: "duplicate_slug", message: `资讯 ${input.slug} 已存在` },
      { status: 409 }
    );
  }
  const row = await prisma.article.create({
    data: {
      slug: input.slug,
      titleZh: input.titleZh,
      titleEn: input.titleEn,
      excerptZh: input.excerptZh,
      excerptEn: input.excerptEn,
      bodyZh: input.bodyZh,
      bodyEn: input.bodyEn,
      coverImage: input.coverImage || null,
      publishedAt: input.publishedAt ? new Date(input.publishedAt) : new Date(),
    },
  });
  await afterArticleChange(mapArticleToView(row));
  return NextResponse.json({ ok: true, item: mapArticleToView(row) }, { status: 201 });
}
