import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@fmw/db";
import { requireAdmin, requireDbMode } from "../../guard";
import { productInputSchema, type ProductInput } from "../../schemas";
import { afterProductChange, afterProductDelete } from "@fmw/publish";
import { mapProductToView } from "../../mapper";

function toPrismaData(input: ProductInput) {
  const datasheetUrl = input.datasheetUrl || undefined;
  const appNoteUrl = input.appNoteUrl || undefined;
  const specs = input.specs;
  return {
    category: input.category,
    seriesId: input.seriesId || null,
    nameZh: input.nameZh,
    nameEn: input.nameEn,
    summaryZh: input.summaryZh,
    summaryEn: input.summaryEn,
    descriptionZh: input.descriptionZh,
    descriptionEn: input.descriptionEn,
    specsZh: specs,
    specsEn: specs,
    datasheetUrl,
    appNoteUrl,
    verificationLevel: input.verificationLevel,
    verifiedEvidence: input.verifiedEvidence || null,
    verifiedEvidenceEn: input.verifiedEvidenceEn || null,
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ mpn: string }> }
) {
  const modeGuard = requireDbMode();
  if (modeGuard) return modeGuard;
  const { mpn } = await params;
  const row = await prisma.product.findUnique({ where: { mpn } });
  if (!row) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ item: mapProductToView(row) });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ mpn: string }> }
) {
  const auth = await requireAdmin(req);
  if (auth) return auth;
  const modeGuard = requireDbMode();
  if (modeGuard) return modeGuard;

  const { mpn } = await params;
  const body = await req.json().catch(() => null);
  const parsed = productInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const input = parsed.data;

  const existing = await prisma.product.findUnique({ where: { mpn } });
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  // 防止通过 PUT 改变主键料号
  const row = await prisma.product.update({
    where: { mpn },
    data: { ...toPrismaData(input), mpn },
  });
  await afterProductChange(mapProductToView(row));
  return NextResponse.json({ ok: true, item: mapProductToView(row) });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ mpn: string }> }
) {
  const auth = await requireAdmin(req);
  if (auth) return auth;
  const modeGuard = requireDbMode();
  if (modeGuard) return modeGuard;

  const { mpn } = await params;
  const existing = await prisma.product.findUnique({ where: { mpn } });
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  await prisma.product.delete({ where: { mpn } });
  await afterProductDelete(mpn);
  return NextResponse.json({ ok: true });
}
