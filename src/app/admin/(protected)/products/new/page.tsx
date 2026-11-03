import { getSeriesList } from "@fmw/data";
import ProductForm from "../ProductForm";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const series = await getSeriesList("zh");
  return (
    <ProductForm
      seriesOptions={series.map((s) => ({ slug: s.slug, name: s.name }))}
    />
  );
}
