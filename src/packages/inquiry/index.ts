import { randomUUID } from "node:crypto";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@fmw/db";
import { captureException, logger } from "@fmw/observability";

/**
 * 站点询盘落库。
 *
 * 为什么需要它：联系表单此前只在浏览器里 `setDone(true)` —— 客户留言被直接丢弃，
 * 而且页面还显示「已提交」。对 B2B 官网来说这是最贵的一类 bug（线索静默蒸发），
 * 所以这里必须有一条「真的存下来了」的路径。
 *
 * 两种落地形态：
 *  - DATA_SOURCE=db  → 写 PostgreSQL 的 Inquiry 表（生产形态）；
 *  - 其它（seed 演示）→ 追加写入 JSONL 文件（默认 .data/inquiries.jsonl）。
 *    演示环境没有数据库，但如果连文件都不落，就等于又回到了「假成功」。
 *
 * 两条都失败时**必须抛错**，由路由返回 500 —— 让客户看到失败并可改用邮件，
 * 好过让客户以为已经联系上了。
 */

export interface InquiryInput {
  name: string;
  email: string;
  company?: string;
  message: string;
  locale: string;
  source?: string;
}

export interface StoredInquiry extends InquiryInput {
  id: string;
  createdAt: string;
  storage: "db" | "file";
}

function fallbackPath(): string {
  return process.env.INQUIRY_FALLBACK_PATH ?? path.join(process.cwd(), ".data", "inquiries.jsonl");
}

function dbEnabled(): boolean {
  return (process.env.DATA_SOURCE ?? "seed") === "db" && Boolean(process.env.DATABASE_URL);
}

/** 通知外部系统（企业微信 / 飞书 / 自建 hook）。失败只 warn，不影响受理结果。 */
async function notify(payload: StoredInquiry): Promise<void> {
  const url = process.env.INQUIRY_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `【官网询盘】${payload.name} <${payload.email}>\n${payload.message.slice(0, 500)}`,
        inquiry: payload,
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch (err) {
    logger.warn("inquiry", "webhook notify failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function createInquiry(input: InquiryInput): Promise<StoredInquiry> {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const base: InquiryInput = {
    ...input,
    source: input.source ?? "contact",
    company: input.company?.trim() || undefined,
  };

  if (dbEnabled()) {
    try {
      await prisma.inquiry.create({
        data: {
          id,
          name: base.name,
          email: base.email,
          company: base.company ?? null,
          message: base.message,
          locale: base.locale,
          source: base.source ?? "contact",
        },
      });
      const stored: StoredInquiry = { ...base, id, createdAt, storage: "db" };
      logger.info("inquiry", "inquiry stored", { id, storage: "db", locale: base.locale });
      await notify(stored);
      return stored;
    } catch (err) {
      captureException(err, "inquiry.db");
      // 落库失败不直接返回 500：还有文件兜底，别让客户白填一遍。
    }
  }

  const file = fallbackPath();
  try {
    await mkdir(path.dirname(file), { recursive: true });
    await appendFile(file, JSON.stringify({ ...base, id, createdAt }) + "\n", "utf8");
    const stored: StoredInquiry = { ...base, id, createdAt, storage: "file" };
    logger.info("inquiry", "inquiry stored", { id, storage: "file", locale: base.locale });
    await notify(stored);
    return stored;
  } catch (err) {
    captureException(err, "inquiry.file", { id });
    throw new Error("inquiry_persist_failed");
  }
}

/** 测试与巡检用：读取文件兜底通道里已落盘的条数。 */
export async function countFileInquiries(): Promise<number> {
  try {
    const { readFile } = await import("node:fs/promises");
    const raw = await readFile(fallbackPath(), "utf8");
    return raw.split("\n").filter((l) => l.trim().length > 0).length;
  } catch {
    return 0;
  }
}
