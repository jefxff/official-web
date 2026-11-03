"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

// 功能开关：默认显示（demo）。设 NEXT_PUBLIC_AI_ASSISTANT_ENABLED=false 可关闭。
const AI_VISIBLE = process.env.NEXT_PUBLIC_AI_ASSISTANT_ENABLED !== "false";

export default function AiChat() {
  const t = useTranslations("ai");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

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
            if (evt.type === "token") {
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
            <button
              onClick={() => setOpen(false)}
              aria-label={t("close")}
              className="text-white/90 hover:text-white text-lg leading-none"
            >
              ✕
            </button>
          </div>

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
