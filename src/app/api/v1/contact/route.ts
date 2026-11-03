import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { clientIp, rateLimited } from "@fmw/ratelimit";
import { createInquiry } from "@fmw/inquiry";
import { captureException, logger } from "@fmw/observability";

/**
 * 联系表单提交（站点唯一接收匿名写入的接口）。
 *
 * 与后台写接口的差异：没有会话凭据，因此防护靠限流 + 蜜罐 + 严格限长。
 * 成功返回 202（已受理），而不是 200 —— 落库是「尽力而为 + 双通道」，
 * 但只有真的写成功才返回 202，写失败会明确返回 500。
 */

const bodySchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(200),
  company: z.string().trim().max(120).optional(),
  message: z.string().trim().min(5).max(4000),
  locale: z.enum(["zh", "en"]).default("zh"),
  // 蜜罐：正常浏览器不会填这个隐藏字段
  website: z.string().max(200).optional(),
});

export async function POST(req: NextRequest) {
  const raw = await req.text();
  // 先卡体积再解析：避免 4000 字上限被超大 body 直接撑爆内存
  if (raw.length > 16_384) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }

  const ip = clientIp(req);
  if (rateLimited(`contact:${ip}`, 5, 10 * 60_000)) {
    return NextResponse.json(
      { error: "rate_limited", message: "提交过于频繁，请稍后再试或直接发送邮件。" },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation", issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })) },
      { status: 400 }
    );
  }

  const { website, ...input } = parsed.data;
  if (website && website.trim().length > 0) {
    // 机器人：返回 202 但不落库，避免对方据此调参
    logger.warn("contact", "honeypot triggered", { ip_hint: ip.slice(0, 3) + "***" });
    return NextResponse.json({ ok: true }, { status: 202 });
  }

  try {
    const stored = await createInquiry(input);
    return NextResponse.json({ ok: true, id: stored.id }, { status: 202 });
  } catch (err) {
    captureException(err, "contact.submit");
    return NextResponse.json(
      { error: "persist_failed", message: "提交失败，请稍后重试或直接发送邮件给我们。" },
      { status: 500 }
    );
  }
}
