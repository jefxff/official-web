"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

// 功能开关：默认显示（demo）。设 NEXT_PUBLIC_AI_ASSISTANT_ENABLED=false 可关闭。
const AI_VISIBLE = process.env.NEXT_PUBLIC_AI_ASSISTANT_ENABLED !== "false";

const CLIENT_KEY = "fmw.ai.clientId";

/**
 * 匿名标识：只用于把会话归属到同一浏览器，不含任何可识别信息。
 * 放 localStorage 而非 Cookie —— 避免为一个匿名 ID 触发 Cookie 同意流程。
 */
function ensureClientId(): string {
  try {
    const cached = localStorage.getItem(CLIENT_KEY);
    if (cached) return cached;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(CLIENT_KEY, id);
    return id;
  } catch {
    // 隐私模式 / 禁用存储：退化为一次性 id，会话不跨刷新延续（不影响回答）。
    return `c${Date.now().toString(36)}`;
  }
}

export default function AiChat() {
  const t = useTranslations("ai");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState(false);
  // 服务端会话 id（DB 模式才返回；seed 模式为 null，退化为单轮问答）
  const [conversationId, setConversationId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // 会话 id 按语言分别保存：中英站是不同的对话，混用会让上下文语言错乱。
  const storageKey = `fmw.ai.convo.${locale}`;

  useEffect(() => {
    try {
      setConversationId(sessionStorage.getItem(storageKey));
    } catch {
      /* 存储不可用时保持无状态 */
    }
  }, [storageKey]);

  function startNewChat() {
    setMessages([]);
    setError(false);
    setConversationId(null);
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      /* 忽略 */
    }
  }

  function rememberConversation(id: string | null) {
    setConversationId(id);
    try {
      if (id) sessionStorage.setItem(storageKey, id);
      else sessionStorage.removeItem(storageKey);
    } catch {
      /* 忽略 */
    }
  }

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, thinking]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  async function send(text: string) {
    const q = text.trim();
    if (!q || thinking) return;
    setError(false);
    setInput("");
    const history: Msg[] = messages;
    const next: Msg[] = [...history, { role: "user", content: q }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setThinking(true);

    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const res = await fetch("/api/v1/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: q,
          locale,
          conversationId: conversationId ?? undefined,
          clientId: ensureClientId(),
          // 无状态降级（seed 模式）时服务端没有历史，靠这里带回上下文。
          history: history.map((m) => ({ role: m.role, content: m.content })),
        }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        throw new Error(`http_${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let acc = "";
      // 解析 SSE 帧（data: {...}）
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, idx).trim();
          buf = buf.slice(idx + 1);
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          try {
            const evt = JSON.parse(payload);
            if (evt.type === "meta") {
              // 服务端确认/新建会话后回传 id，后续轮次据此续聊。
              rememberConversation(evt.conversationId ?? null);
            } else if (evt.type === "token") {
              acc += evt.text;
              setMessages((m) => {
                const copy = [...m];
                copy[copy.length - 1] = { role: "assistant", content: acc };
                return copy;
              });
            } else if (evt.type === "error") {
              setError(true);
            }
          } catch {
            /* 忽略不完整帧 */
          }
        }
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError(true);
    } finally {
      setThinking(false);
    }
  }

  if (!AI_VISIBLE) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 font-sans">
      {open ? (
        <div className="flex flex-col w-[min(92vw,360px)] h-[min(70vh,520px)] bg-white rounded-2xl shadow-2xl border border-[var(--color-line)] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-[var(--color-brand)] text-white">
            <div>
              <div className="text-sm font-semibold">{t("title")}</div>
              <div className="text-[11px] opacity-80">{t("subtitle")}</div>
            </div>
            <div className="flex items-center gap-3">
              {messages.length > 0 && (
                <button
                  onClick={startNewChat}
                  aria-label={t("newChat")}
                  title={t("newChat")}
                  className="text-white/80 hover:text-white text-sm leading-none"
                >
                  ↻
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                aria-label={t("close")}
                className="text-white/90 hover:text-white text-lg leading-none"
              >
                ✕
              </button>
            </div>
          </div>

          {conversationId && messages.length === 0 && (
            <div className="flex items-center justify-between bg-[var(--color-bg)] px-4 py-2 text-[11px] text-[var(--color-sub)]">
              <span>{t("continued")}</span>
              <button onClick={startNewChat} className="underline hover:text-[var(--color-brand)]">
                {t("newChat")}
              </button>
            </div>
          )}

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 text-sm">
            {messages.length === 0 && (
              <div className="text-[var(--color-ink)]/80">
                <p>{t("welcome")}</p>
                <div className="mt-3 flex flex-col gap-2">
                  {t.raw("suggestions").map((s: string) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="text-left text-xs rounded-lg border border-[var(--color-line)] px-3 py-2 hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={m.role === "user" ? "text-right" : "text-left"}
              >
                <span
                  className={`inline-block max-w-[85%] rounded-2xl px-3 py-2 whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-[var(--color-brand)] text-white"
                      : "bg-[var(--color-bg)] text-[var(--color-ink)]"
                  }`}
                >
                  {m.content || (thinking && i === messages.length - 1 ? t("thinking") : "")}
                </span>
              </div>
            ))}
            {error && (
              <div className="text-xs text-red-600">{t("error")}</div>
            )}
            <div className="text-[10px] text-[var(--color-ink)]/50">
              {t("disclaimer")}
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-center gap-2 border-t border-[var(--color-line)] p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("placeholder")}
              className="flex-1 text-sm border border-[var(--color-line)] rounded-lg px-3 py-2 outline-none focus:border-[var(--color-brand)]"
            />
            <button
              type="submit"
              disabled={thinking || !input.trim()}
              className="rounded-lg bg-[var(--color-brand)] text-white px-3 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {t("send")}
            </button>
          </form>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          aria-label={t("open")}
          className="flex items-center gap-2 rounded-full bg-[var(--color-brand)] text-white pl-3 pr-4 py-3 shadow-2xl hover:opacity-90"
        >
          <span className="text-lg">🤖</span>
          <span className="text-sm font-medium">{t("title")}</span>
        </button>
      )}
    </div>
  );
}
