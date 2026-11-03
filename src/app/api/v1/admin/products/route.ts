import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@fmw/db";
import { requireAdmin, requireDbMode } from "../guard";
import { productInputSchema, type ProductInput } from "../schemas";
import { afterProductChange } from "@fmw/publish";
import { mapProductToView } from "../mapper";

function toPrismaData(input: ProductInput) {
  const datasheetUrl = input.datasheetUrl || undefined;
  const appNoteUrl = input.appNoteUrl || undefined;
  // specs 含 label/labelEn/value，双语读取时按 locale 取 label 或 labelEn。
  const specs = input.specs;
  return {
    mpn: input.mpn,
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

export async function GET() {
  const modeGuard = requireDbMode();
  if (modeGuard) return modeGuard;
  const rows = await prisma.product.findMany({ orderBy: { mpn: "asc" } });
  return NextResponse.json({ items: rows.map(mapProductToView) });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth) return auth;
  const modeGuard = requireDbMode();
  if (modeGuard) return modeGuard;

  const body = await req.json().catch(() => null);
  const parsed = productInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const input = parsed.data;

  const existing = await prisma.product.findUnique({ where: { mpn: input.mpn } });
  if (existing) {
    return NextResponse.json(
      { error: "duplicate_mpn", message: `料号 ${input.mpn} 已存在，请用 PUT 更新` },
      { status: 409 }
    );
  }

  const row = await prisma.product.create({ data: toPrismaData(input) });
  await afterProductChange(mapProductToView(row));
  return NextResponse.json({ ok: true, item: mapProductToView(row) }, { status: 201 });
}
