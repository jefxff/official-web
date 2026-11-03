import type { Locale } from "@/i18n/routing";
import { MockProvider } from "./providers/mock";
import { OpenAIProvider } from "./providers/openai";
import { prepareContext } from "./grounding";
import type { AiContext, LLMProvider } from "./types";
import { logger } from "@fmw/observability";

export type { AiContext, ChatMessage, Intent, LLMProvider, QuestionAnalysis } from "./types";
export { analyzeQuestion, prepareContext, slotFillAnswer } from "./grounding";

/** 功能开关：默认开启（demo）。上线前可设为 false，作为 M1 之后的增量交付。 */
export function isAiEnabled(): boolean {
  return (process.env.AI_ASSISTANT_ENABLED ?? "true") !== "false";
}

/** Provider 工厂：有 AI_LLM_API_KEY 用 OpenAI，否则回退 Mock（零外网依赖）。 */
export function getProvider(): LLMProvider {
  const key = process.env.AI_LLM_API_KEY;
  if (key) {
    const base = process.env.AI_LLM_BASE_URL ?? "https://api.openai.com/v1";
    const model = process.env.AI_LLM_MODEL ?? "gpt-4o-mini";
    logger.info("ai", "provider=openai", { model, base });
    return new OpenAIProvider(key, base, model);
  }
  logger.info("ai", "provider=mock (no AI_LLM_API_KEY)");
  return new MockProvider();
}

/** 便捷：直接由问题构建上下文（含真实料号与命中参数）。 */
export async function buildContextFor(
  question: string,
  locale: Locale
): Promise<AiContext> {
  return prepareContext(question, locale);
}
