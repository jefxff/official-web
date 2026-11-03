import { getProductAdminView, getSeriesList } from "@fmw/data";
import { notFound } from "next/navigation";
import ProductForm, { type ProductFormValues } from "../../ProductForm";

export const dynamic = "force-dynamic";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ mpn: string }>;
}) {
  const { mpn } = await params;
  const [product, series] = await Promise.all([
    getProductAdminView(mpn),
    getSeriesList("zh"),
  ]);
  if (!product) notFound();

  const initial: Partial<ProductFormValues> = {
    mpn: product.mpn,
    category: product.category,
    seriesId: product.seriesId ?? "",
    nameZh: product.nameZh,
    nameEn: product.nameEn,
    summaryZh: product.summaryZh,
    summaryEn: product.summaryEn,
    descriptionZh: product.descriptionZh,
    descriptionEn: product.descriptionEn,
    verificationLevel: product.verificationLevel,
    verifiedEvidence: product.verifiedEvidence ?? "",
    verifiedEvidenceEn: product.verifiedEvidenceEn ?? "",
    datasheetUrl: product.datasheetUrl ?? "",
    appNoteUrl: product.appNoteUrl ?? "",
    specs: product.specs,
  };

  return (
    <ProductForm
      isEdit
      initial={initial}
      seriesOptions={series.map((s) => ({ id: s.id, name: s.name }))}
    />
  );
}
