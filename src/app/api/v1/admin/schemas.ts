import { z } from "zod";

/** 分级验证证据约束（评审意见 + 评审落地到 DB/应用层）：
 *  BENCH_TESTED / CERTIFIED 等级必须附带 verifiedEvidence。 */
const EVIDENCE_REQUIRED = new Set(["BENCH_TESTED", "CERTIFIED"] as const);

const verifiedEvidenceRefine = (
  data: { verificationLevel: string; verifiedEvidence?: string },
  ctx: z.RefinementCtx
) => {
  if (EVIDENCE_REQUIRED.has(data.verificationLevel as never)) {
    if (!data.verifiedEvidence || data.verifiedEvidence.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["verifiedEvidence"],
        message: "达到实测/认证等级时必须填写验证证据（verifiedEvidence）",
      });
    }
  }
};

export const specItemSchema = z.object({
  label: z.string().min(1),
  labelEn: z.string().min(1),
  value: z.string().min(1),
});

export const productInputSchema = z
  .object({
    mpn: z.string().min(1).max(64),
    category: z.string().min(1).max(64),
    seriesId: z.string().optional(),
    nameZh: z.string().min(1),
    nameEn: z.string().min(1),
    summaryZh: z.string().min(1),
    summaryEn: z.string().min(1),
    descriptionZh: z.string().default(""),
    descriptionEn: z.string().default(""),
    specs: z.array(specItemSchema).default([]),
    datasheetUrl: z.string().url().optional().or(z.literal("")),
    appNoteUrl: z.string().url().optional().or(z.literal("")),
    verificationLevel: z.enum(["INTERNAL", "DATASHEET", "BENCH_TESTED", "CERTIFIED"]),
    verifiedEvidence: z.string().optional(),
    verifiedEvidenceEn: z.string().optional(),
  })
  .superRefine(verifiedEvidenceRefine);

export const seriesInputSchema = z.object({
  slug: z.string().min(1).max(64),
  nameZh: z.string().min(1),
  nameEn: z.string().min(1),
  descriptionZh: z.string().default(""),
  descriptionEn: z.string().default(""),
});

export const articleInputSchema = z.object({
  slug: z.string().min(1).max(80),
  titleZh: z.string().min(1),
  titleEn: z.string().min(1),
  excerptZh: z.string().min(1),
  excerptEn: z.string().min(1),
  bodyZh: z.string().default(""),
  bodyEn: z.string().default(""),
  coverImage: z.string().url().optional().or(z.literal("")),
  publishedAt: z.string().optional(), // ISO；缺省服务端 now()
});

export type ProductInput = z.infer<typeof productInputSchema>;
export type SeriesInput = z.infer<typeof seriesInputSchema>;
export type ArticleInput = z.infer<typeof articleInputSchema>;
