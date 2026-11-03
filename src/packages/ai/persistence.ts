import { prisma } from "@fmw/db";
import { logger } from "@fmw/observability";
import type { ChatMessage } from "./types";

/**
 * AI 会话持久化（多轮上下文的服务端真源）。
 *
 * 设计原则：**持久化永远不能成为回答失败的因**。
 * 所有读写都包在 try/catch 里，失败只记 warn 并降级为「无状态模式」，
 * 与 seed 模式（无数据库）走同一条降级路径。数据库抖动时用户依然能拿到回答。
 *
 * 隐私边界：
 *  - 不落 IP、不落 User-Agent；
 *  - clientId 由前端生成随机串，仅用于把会话归属到同一浏览器，不含可识别信息；
 *  - 会话内容留存期由运维按 docs/ops-runbook.md 定期清理。
 */

const MAX_HISTORY_MESSAGES = 10;
const MAX_STORED_CONTENT = 4000;

export interface ResolvedConversation {
  /** null 表示降级为无状态（seed 模式 / DB 不可用 / 归属校验失败） */
  id: string | null;
  history: ChatMessage[];
}

export function aiPersistenceEnabled(): boolean {
  return (process.env.DATA_SOURCE ?? "seed") === "db" && Boolean(process.env.DATABASE_URL);
}

/**
 * 解析（或创建）会话，并返回服务端保存的历史。
 *
 * 归属校验：如果该会话已有 clientId，而本次请求的 clientId 与之不一致，
 * 则**丢弃**该会话另起新会话——否则拿到别人 conversationId 就能读到别人的聊天记录。
 */
export async function resolveConversation(input: {
  conversationId?: string;
  clientId?: string;
  locale: string;
}): Promise<ResolvedConversation> {
  if (!aiPersistenceEnabled()) return { id: null, history: [] };

  try {
    if (input.conversationId) {
      const existing = await prisma.aiConversation.findUnique({
        where: { id: input.conversationId },
        include: {
          messages: {
            orderBy: { createdAt: "desc" },
            take: MAX_HISTORY_MESSAGES,
          },
        },
      });

      const owned =
        existing &&
        (!existing.clientId || !input.clientId || existing.clientId === input.clientId);

      if (existing && owned) {
        const history: ChatMessage[] = existing.messages
          .slice()
          .reverse()
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
        return { id: existing.id, history };
      }

      if (existing && !owned) {
        logger.warn("ai", "conversation ownership mismatch, starting new", {
          conversationId: input.conversationId,
        });
      }
    }

    const created = await prisma.aiConversation.create({
      data: { locale: input.locale, clientId: input.clientId ?? null },
      select: { id: true },
    });
    return { id: created.id, history: [] };
  } catch (err) {
    logger.warn("ai", "conversation resolve failed, fallback to stateless", {
      reason: err instanceof Error ? err.message : String(err),
    });
    return { id: null, history: [] };
  }
}

/** 写入一轮问答（问答都落库，便于后续做知识缺口分析）。 */
export async function appendTurn(
  conversationId: string | null,
  userText: string,
  assistantText: string
): Promise<void> {
  if (!conversationId) return;
  try {
    await prisma.$transaction([
      prisma.aiMessage.create({
        data: {
          conversationId,
          role: "user",
          content: userText.slice(0, MAX_STORED_CONTENT),
        },
      }),
      prisma.aiMessage.create({
        data: {
          conversationId,
          role: "assistant",
          content: assistantText.slice(0, MAX_STORED_CONTENT),
        },
      }),
      prisma.aiConversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date() },
      }),
    ]);
  } catch (err) {
    logger.warn("ai", "append turn failed", {
      conversationId,
      reason: err instanceof Error ? err.message : String(err),
    });
  }
}

/** 清理 N 天前的会话（运维定时任务调用，级联删除消息）。 */
export async function pruneConversations(olderThanDays: number): Promise<number> {
  if (!aiPersistenceEnabled()) return 0;
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  const result = await prisma.aiConversation.deleteMany({
    where: { lastMessageAt: { lt: cutoff } },
  });
  return result.count;
}
