import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@fmw/db";
import { requireAdmin, requireDbMode } from "../guard";
import { seriesInputSchema } from "../schemas";
import { afterSeriesChange } from "@fmw/publish";
import { mapSeriesToView } from "../mapper";

export async function GET() {
  const modeGuard = requireDbMode();
  if (modeGuard) return modeGuard;
  const rows = await prisma.series.findMany({ orderBy: { slug: "asc" } });
  return NextResponse.json({ items: rows.map(mapSeriesToView) });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth) return auth;
  const modeGuard = requireDbMode();
  if (modeGuard) return modeGuard;

  const parsed = seriesInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const input = parsed.data;
  const existing = await prisma.series.findUnique({ where: { slug: input.slug } });
  if (existing) {
    return NextResponse.json(
      { error: "duplicate_slug", message: `系列 ${input.slug} 已存在` },
      { status: 409 }
    );
  }
  const row = await prisma.series.create({
    data: {
      slug: input.slug,
      nameZh: input.nameZh,
      nameEn: input.nameEn,
      descriptionZh: input.descriptionZh || null,
      descriptionEn: input.descriptionEn || null,
    },
  });
  await afterSeriesChange(mapSeriesToView(row));
  return NextResponse.json({ ok: true, item: mapSeriesToView(row) }, { status: 201 });
}
