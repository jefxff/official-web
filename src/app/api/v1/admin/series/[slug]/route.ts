import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@fmw/db";
import { requireAdmin, requireDbMode } from "../../guard";
import { seriesInputSchema } from "../../schemas";
import { afterSeriesChange, afterSeriesDelete } from "@fmw/publish";
import { mapSeriesToView } from "../../mapper";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const modeGuard = requireDbMode();
  if (modeGuard) return modeGuard;
  const { slug } = await params;
  const row = await prisma.series.findUnique({ where: { slug } });
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ item: mapSeriesToView(row) });
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
  const parsed = seriesInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const input = parsed.data;
  const existing = await prisma.series.findUnique({ where: { slug } });
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const row = await prisma.series.update({
    where: { slug },
    data: {
      slug,
      nameZh: input.nameZh,
      nameEn: input.nameEn,
      descriptionZh: input.descriptionZh || null,
      descriptionEn: input.descriptionEn || null,
    },
  });
  await afterSeriesChange(mapSeriesToView(row));
  return NextResponse.json({ ok: true, item: mapSeriesToView(row) });
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
  const existing = await prisma.series.findUnique({ where: { slug } });
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });
  await prisma.series.delete({ where: { slug } });
  await afterSeriesDelete(slug);
  return NextResponse.json({ ok: true });
}
