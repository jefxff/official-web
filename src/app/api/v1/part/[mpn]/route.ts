import { NextResponse } from "next/server";
import { getProductByMpn, getProducts } from "@/packages/data";
import type { Locale } from "@/i18n/routing";

/**
 * P02「URL as API」——独立路径返回 JSON（v1.2 §7 / 评审意见）。
 * 采用 /api/v1/part/[mpn] 独立路径，而非基于 Accept 头的协商，
 * 避免 CDN 对 Vary:Accept 处理不可靠导致的缓存串扰。
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ mpn: string }> }
) {
  const { mpn } = await params;
  const url = new URL(request.url);
  const localeParam = url.searchParams.get("locale");
  const locale: Locale =
    localeParam === "en" || localeParam === "zh" ? localeParam : "zh";

  const product = await getProductByMpn(mpn, locale);
  if (!product) {
    return NextResponse.json(
      { error: "not_found", mpn },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.json(
    {
      mpn: product.mpn,
      name: product.name,
      category: product.category,
      summary: product.summary,
      description: product.description,
      specs: product.specs,
      verificationLevel: product.verificationLevel,
      verifiedEvidence: product.verifiedEvidence ?? null,
      datasheetUrl: product.datasheetUrl ?? null,
      appNoteUrl: product.appNoteUrl ?? null,
      links: {
        web: `/${locale}/products/${product.mpn}`,
      },
    },
    {
      headers: {
        // API 路径单独缓存，不影响 HTML 路由
        "Cache-Control": "public, max-age=300, s-maxage=3600",
      },
    }
  );
}

/** 支持批量列出（用于文档/第三方索引） */
export async function generateStaticParams() {
  const products = await getProducts("zh");
  return products.map((p) => ({ mpn: p.mpn }));
}
