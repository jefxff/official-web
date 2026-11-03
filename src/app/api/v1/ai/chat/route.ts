import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  buildContextFor,
  getProvider,
  isAiEnabled,
  type ChatMessage,
} from "@fmw/ai";
import { captureException, logger } from "@fmw/observability";
import { isSentenceBoundary } from "@fmw/ai/sentence";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  message: z.string().min(1).max(2000),
  locale: z.enum(["zh", "en"]).optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(2000),
      })
    )
    .max(20)
    .optional(),
});

// 简单内存限流（单实例）。多实例部署需外部存储（Redis / Cloudflare KV）。
const RATE = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const rec = RATE.get(ip);
  if (!rec || rec.resetAt < now) {
    RATE.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  if (rec.count >= RATE_LIMIT) return true;
  rec.count += 1;
  return false;
}

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

const encoder = new TextEncoder();
function sse(data: unknown): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
}

export async function POST(req: NextRequest) {
  if (!isAiEnabled()) {
    return new Response(JSON.stringify({ error: "service_disabled" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
    });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: "invalid_params", detail: parsed.error.issues }),
      { status: 400 }
    );
  }
  const { message, locale = "zh", history = [] } = parsed.data;

  if (rateLimited(clientIp(req))) {
    return new Response(JSON.stringify({ error: "rate_limited" }), {
      status: 429,
    });
  }

  const loc = locale as Locale;
  const historyMsgs = history as ChatMessage[];

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const ctx = await buildContextFor(message, loc);
        const provider = getProvider();

        // 句子级缓冲：累积片段直到出现句末标点 / 换行才下发，避免流式撕裂。
        let buf = "";
        const tryFlush = () => {
          let i = 0;
          while (i < buf.length) {
            if (isSentenceBoundary(buf, i)) {
              const sentence = buf.slice(0, i + 1);
              controller.enqueue(sse({ type: "token", text: sentence }));
              buf = buf.slice(i + 1);
              i = 0;
            } else {
              i += 1;
            }
          }
        };

        for await (const chunk of provider.streamAnswer({
          question: message,
          history: historyMsgs,
          context: ctx,
          locale: loc,
        })) {
          buf += chunk;
          tryFlush();
        }
        // 下发剩余尾片（无句末标点的收尾文本）
        if (buf.trim().length > 0) {
          controller.enqueue(sse({ type: "token", text: buf }));
        }
        controller.enqueue(sse({ type: "done" }));
        controller.close();
        logger.info("ai", "chat completed", { locale: loc, mpn: ctx.analysis.mpn });
      } catch (err) {
        captureException(err, "ai.chat");
        try {
          controller.enqueue(sse({ type: "error", message: "internal_error" }));
          controller.close();
        } catch {
          /* 已关闭则忽略 */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
