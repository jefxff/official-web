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
    <div className="fixed right-4 bottom-4 z-50 md:right-6 md:bottom-6">
      {open ? (
        <div className="flex h-[min(72vh,540px)] w-[min(92vw,380px)] flex-col overflow-hidden border border-[var(--color-line)] bg-[var(--color-void)] shadow-[var(--shadow-3)]">
          {/* 头部：等宽标签 + 一个会呼吸的状态点，暗示「在线」而不是装饰 */}
          <div className="flex items-center justify-between border-b border-[var(--color-line)] px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span
                className="h-1.5 w-1.5 bg-[var(--color-bench)]"
                style={{ animation: "pulse-soft 2.4s ease-in-out infinite" }}
                aria-hidden
              />
              <div>
                <div className="text-[13px] font-semibold text-[var(--color-bone)]">
                  {t("title")}
                </div>
                <div className="mono mt-0.5 text-[10px] tracking-[0.1em] text-[var(--color-muted)]">
                  {t("subtitle")}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={startNewChat}
                  aria-label={t("newChat")}
                  title={t("newChat")}
                  className="grid h-8 w-8 place-items-center text-[13px] text-[var(--color-muted)] transition-colors hover:text-[var(--color-amber)]"
                >
                  ↻
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                aria-label={t("close")}
                className="grid h-8 w-8 place-items-center text-[13px] text-[var(--color-muted)] transition-colors hover:text-[var(--color-bone)]"
              >
                ✕
              </button>
            </div>
          </div>

          {conversationId && messages.length === 0 && (
            <div className="flex items-center justify-between border-b border-[var(--color-line)] px-4 py-2">
              <span className="mono text-[10px] tracking-[0.08em] text-[var(--color-muted)]">
                {t("continued")}
              </span>
              <button
                onClick={startNewChat}
                className="mono text-[10px] tracking-[0.08em] text-[var(--color-amber)] uppercase"
              >
                {t("newChat")}
              </button>
            </div>
          )}

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4 text-sm">
            {messages.length === 0 && (
              <div>
                <p className="text-[13.5px] leading-relaxed text-[var(--color-bone-2)]">
                  {t("welcome")}
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  {t.raw("suggestions").map((s: string) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="group flex items-center justify-between gap-3 border border-[var(--color-line)] px-3 py-2.5 text-left text-[12.5px] text-[var(--color-bone-2)] transition-colors hover:border-[var(--color-amber)] hover:text-[var(--color-amber)]"
                    >
                      <span>{s}</span>
                      <span className="text-[var(--color-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--color-amber)]">
                        →
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <span
                  className={`inline-block max-w-[88%] px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-[var(--color-amber)] text-[var(--color-on-brand)]"
                      : "border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-bone-2)]"
                  }`}
                >
                  {m.content || (thinking && i === messages.length - 1 ? t("thinking") : "")}
                </span>
              </div>
            ))}
            {error && (
              <div className="border-l-2 border-[var(--color-amber)] px-3 py-1.5 text-[12px] text-[var(--color-muted)]">
                {t("error")}
              </div>
            )}
            <div className="mono pt-1 text-[10px] leading-relaxed tracking-[0.04em] text-[var(--color-muted)]">
              {t("disclaimer")}
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-stretch gap-2 border-t border-[var(--color-line)] p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("placeholder")}
              className="input min-h-10 flex-1 text-[13px]"
            />
            <button
              type="submit"
              disabled={thinking || !input.trim()}
              className="grid w-11 place-items-center bg-[var(--color-amber)] text-[var(--color-on-brand)] transition-colors hover:bg-[var(--color-amber-2)] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={t("send")}
            >
              →
            </button>
          </form>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          aria-label={t("open")}
          className="group flex items-center gap-2.5 border border-[var(--color-line)] bg-[var(--color-void)] py-2.5 pr-4 pl-3 shadow-[var(--shadow-3)] transition-colors hover:border-[var(--color-amber)]"
        >
          <span className="mono grid h-7 w-7 place-items-center border border-[var(--color-amber)] text-[10px] font-bold text-[var(--color-amber)]">
            AI
          </span>
          <span className="text-[12.5px] font-medium text-[var(--color-bone)]">{t("title")}</span>
        </button>
      )}
    </div>
  );
}
