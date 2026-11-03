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
import { clientIp, rateLimited } from "@fmw/ratelimit";
import { appendTurn, resolveConversation } from "@fmw/ai/persistence";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  message: z.string().min(1).max(2000),
  locale: z.enum(["zh", "en"]).optional(),
  // 会话标识：放入 body 而非 Cookie，避免为匿名访客设置跟踪 Cookie（无需 Cookie 同意弹窗）。
  conversationId: z.string().min(1).max(64).optional(),
  clientId: z.string().min(1).max(64).optional(),
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

// 限流实现已抽到 @fmw/ratelimit（联系表单接口复用同一套计数）。
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;

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
  const { message, locale = "zh", history = [], conversationId, clientId } = parsed.data;

  if (rateLimited(`ai:${clientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS)) {
    return new Response(JSON.stringify({ error: "rate_limited" }), {
      status: 429,
    });
  }

  const loc = locale as Locale;

  // 服务端历史优先：DB 模式下多轮上下文以库为准（前端传入的 history 只作为无状态降级来源），
  // 这样即使前端刷新/被篡改，模型看到的上下文仍是真实发生过的那几轮。
  const convo = await resolveConversation({ conversationId, clientId, locale: loc });
  const historyMsgs: ChatMessage[] =
    convo.history.length > 0 ? convo.history : (history as ChatMessage[]);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let answer = "";
      try {
        // 首帧回传会话标识：前端据此续聊（无状态模式下为 null，前端保持一次一答）。
        controller.enqueue(sse({ type: "meta", conversationId: convo.id }));

        const ctx = await buildContextFor(message, loc);
        const provider = getProvider();

        // 句子级缓冲：累积片段直到出现句末标点 / 换行才下发，避免流式撕裂。
        let buf = "";
        const tryFlush = () => {
          let i = 0;
          while (i < buf.length) {
            if (isSentenceBoundary(buf, i)) {
              const sentence = buf.slice(0, i + 1);
              answer += sentence;
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
          answer += buf;
          controller.enqueue(sse({ type: "token", text: buf }));
        }
        // 落库后再收尾：服务端渲染函数返回后进程可能被回收，不可 fire-and-forget。
        await appendTurn(convo.id, message, answer);
        controller.enqueue(sse({ type: "done" }));
        controller.close();
        logger.info("ai", "chat completed", {
          locale: loc,
          mpn: ctx.analysis.mpn,
          conversationId: convo.id,
          persisted: convo.id !== null,
        });
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
