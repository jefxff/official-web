import type { LLMProvider, StreamOpts } from "../types";
import { slotFillAnswer } from "../grounding";
import { splitSentences } from "../sentence";
import { captureException, logger } from "@fmw/observability";

/**
 * OpenAI 兼容 Provider（env 网关）。
 * 仅当 AI_LLM_API_KEY 配置时启用。关键约束：系统提示要求模型
 * 只使用「已验证事实 JSON」作答，绝不臆造电气参数；流式转发 token。
 * 上游异常时降级为接地答案，保证服务可用（不把错误抛给用户）。
 */
export class OpenAIProvider implements LLMProvider {
  readonly id = "openai";

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
    private readonly model: string
  ) {}

  private systemPrompt(opts: StreamOpts): string {
    const facts =
      opts.context.products.length > 0
        ? opts.context.products.map((p) => ({
            mpn: p.mpn,
            category: p.category,
            name: p.name,
            specs: p.specs,
            verificationLevel: p.verificationLevel,
            verifiedEvidence: p.verifiedEvidence ?? null,
            datasheetUrl: p.datasheetUrl ?? null,
          }))
        : [];
    return [
      "You are FMW's official product assistant.",
      `Respond in ${opts.locale === "zh" ? "Chinese" : "English"}.`,
      "CRITICAL: Answer ONLY using the VERIFIED FACTS below. Never invent specs, voltages, currents, Rds(on), or evidence. If the facts don't cover the question, say so and suggest the Contact page.",
      "Keep answers concise (1-3 sentences). Mention verification level when relevant.",
      "VERIFIED FACTS (JSON):",
      JSON.stringify(facts, null, 2),
    ].join("\n");
  }

  async *streamAnswer(opts: StreamOpts): AsyncIterable<string> {
    const url = `${this.baseUrl.replace(/\/$/, "")}/chat/completions`;
    const messages = [
      { role: "system", content: this.systemPrompt(opts) },
      ...opts.history
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: opts.question },
    ];

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: true,
          temperature: 0.2,
        }),
      });
      if (!res.ok || !res.body) {
        throw new Error(`llm_upstream_${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, idx).trim();
          buf = buf.slice(idx + 1);
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (data === "[DONE]") return;
          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) yield delta as string;
          } catch {
            // 跳过不完整 / 心跳行
          }
        }
      }
    } catch (err) {
      captureException(err, "ai.openai");
      logger.warn("ai", "openai upstream failed, falling back to grounded answer");
      for (const s of splitSentences(slotFillAnswer(opts.context))) {
        yield s;
      }
    }
  }
}
