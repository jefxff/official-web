import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@fmw/db";
import { requireAdmin, requireDbMode } from "../../guard";
import { articleInputSchema } from "../../schemas";
import { afterArticleChange, afterArticleDelete } from "@fmw/publish";
import { mapArticleToView } from "../../mapper";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const modeGuard = requireDbMode();
  if (modeGuard) return modeGuard;
  const { slug } = await params;
  const row = await prisma.article.findUnique({ where: { slug } });
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ item: mapArticleToView(row) });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const auth = await requireAdmin(req);
  if (auth) return auth;
  const modeGuard = requireDbMode();
  if (modeGuard) return modeGuard;

  const { slug } = await params;
  const parsed = articleInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const input = parsed.data;
  const existing = await prisma.article.findUnique({ where: { slug } });
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const row = await prisma.article.update({
    where: { slug },
    data: {
      slug,
      titleZh: input.titleZh,
      titleEn: input.titleEn,
      excerptZh: input.excerptZh,
      excerptEn: input.excerptEn,
      bodyZh: input.bodyZh,
      bodyEn: input.bodyEn,
      coverImage: input.coverImage || null,
      publishedAt: input.publishedAt ? new Date(input.publishedAt) : existing.publishedAt,
    },
  });
  await afterArticleChange(mapArticleToView(row));
  return NextResponse.json({ ok: true, item: mapArticleToView(row) });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const auth = await requireAdmin(req);
  if (auth) return auth;
  const modeGuard = requireDbMode();
  if (modeGuard) return modeGuard;

  const { slug } = await params;
  const existing = await prisma.article.findUnique({ where: { slug } });
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });
  await prisma.article.delete({ where: { slug } });
  await afterArticleDelete(slug);
  return NextResponse.json({ ok: true });
}
