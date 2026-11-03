/**
 * 种子数据导入（v1.2 §4）。将本地 seed JSON 导入 PostgreSQL。
 * 用法：
 *   DATABASE_URL=postgresql://... DATA_SOURCE=db npx tsx scripts/seed.ts
 * 幂等：按 mpn / slug 唯一键 upsert。
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const seedDir = join(__dirname, "..", "src", "packages", "data", "seed");

const prisma = new PrismaClient();

function load<T>(name: string): T[] {
  return JSON.parse(readFileSync(join(seedDir, name), "utf8")) as T[];
}

type RawProduct = {
  mpn: string;
  category: string;
  seriesId?: string;
  nameZh: string;
  nameEn: string;
  summaryZh: string;
  summaryEn: string;
  descriptionZh: string;
  descriptionEn: string;
  specsZh: unknown;
  specsEn: unknown;
  datasheetUrl?: string;
  appNoteUrl?: string;
  verificationLevel: "INTERNAL" | "DATASHEET" | "BENCH_TESTED" | "CERTIFIED";
  verifiedEvidence?: string;
  verifiedEvidenceEn?: string;
};

type RawSeries = {
  slug: string;
  nameZh: string;
  nameEn: string;
  descriptionZh?: string;
  descriptionEn?: string;
};

type RawArticle = {
  slug: string;
  titleZh: string;
  titleEn: string;
  excerptZh: string;
  excerptEn: string;
  bodyZh: string;
  bodyEn: string;
  coverImage?: string;
  publishedAt: string;
};

async function main() {
  const series = load<RawSeries>("series.json");
  for (const s of series) {
    await prisma.series.upsert({
      where: { slug: s.slug },
      create: {
        slug: s.slug,
        nameZh: s.nameZh,
        nameEn: s.nameEn,
        descriptionZh: s.descriptionZh ?? null,
        descriptionEn: s.descriptionEn ?? null,
      },
      update: {
        nameZh: s.nameZh,
        nameEn: s.nameEn,
        descriptionZh: s.descriptionZh ?? null,
        descriptionEn: s.descriptionEn ?? null,
      },
    });
  }
  console.log(`series: upserted ${series.length}`);

  const products = load<RawProduct>("products.json");
  for (const p of products) {
    await prisma.product.upsert({
      where: { mpn: p.mpn },
      create: {
        mpn: p.mpn,
        category: p.category,
        seriesId: p.seriesId ?? null,
        nameZh: p.nameZh,
        nameEn: p.nameEn,
        summaryZh: p.summaryZh,
        summaryEn: p.summaryEn,
        descriptionZh: p.descriptionZh,
        descriptionEn: p.descriptionEn,
        specsZh: p.specsZh as object,
        specsEn: p.specsEn as object,
        datasheetUrl: p.datasheetUrl ?? null,
        appNoteUrl: p.appNoteUrl ?? null,
        verificationLevel: p.verificationLevel,
        verifiedEvidence:
          p.verificationLevel === "BENCH_TESTED" || p.verificationLevel === "CERTIFIED"
            ? (p.verifiedEvidence ?? null)
            : null,
        verifiedEvidenceEn:
          p.verificationLevel === "BENCH_TESTED" || p.verificationLevel === "CERTIFIED"
            ? (p.verifiedEvidenceEn ?? null)
            : null,
      },
      update: {
        category: p.category,
        seriesId: p.seriesId ?? null,
        nameZh: p.nameZh,
        nameEn: p.nameEn,
        summaryZh: p.summaryZh,
        summaryEn: p.summaryEn,
        descriptionZh: p.descriptionZh,
        descriptionEn: p.descriptionEn,
        specsZh: p.specsZh as object,
        specsEn: p.specsEn as object,
        datasheetUrl: p.datasheetUrl ?? null,
        appNoteUrl: p.appNoteUrl ?? null,
        verificationLevel: p.verificationLevel,
        verifiedEvidence:
          p.verificationLevel === "BENCH_TESTED" || p.verificationLevel === "CERTIFIED"
            ? (p.verifiedEvidence ?? null)
            : null,
        verifiedEvidenceEn:
          p.verificationLevel === "BENCH_TESTED" || p.verificationLevel === "CERTIFIED"
            ? (p.verifiedEvidenceEn ?? null)
            : null,
      },
    });
  }
  console.log(`products: upserted ${products.length}`);

  const articles = load<RawArticle>("articles.json");
  for (const a of articles) {
    await prisma.article.upsert({
      where: { slug: a.slug },
      create: {
        slug: a.slug,
        titleZh: a.titleZh,
        titleEn: a.titleEn,
        excerptZh: a.excerptZh,
        excerptEn: a.excerptEn,
        bodyZh: a.bodyZh,
        bodyEn: a.bodyEn,
        coverImage: a.coverImage ?? null,
        publishedAt: new Date(a.publishedAt),
      },
      update: {
        titleZh: a.titleZh,
        titleEn: a.titleEn,
        excerptZh: a.excerptZh,
        excerptEn: a.excerptEn,
        bodyZh: a.bodyZh,
        bodyEn: a.bodyEn,
        coverImage: a.coverImage ?? null,
        publishedAt: new Date(a.publishedAt),
      },
    });
  }
  console.log(`articles: upserted ${articles.length}`);
  console.log("seed done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
