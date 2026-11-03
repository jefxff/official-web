import type { Locale } from "@/i18n/routing";
import type { Product } from "@fmw/data/types";

export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export type Intent =
  | "product_detail" // 命中料号
  | "product_find" // 命中类别 / 关键词
  | "contact" // 询价 / 样品 / 联系
  | "general"; // 其他

export interface QuestionAnalysis {
  mpn?: string;
  category?: string;
  intent: Intent;
}

export interface AiContext {
  analysis: QuestionAnalysis;
  products: Product[];
  /** 命中的具体参数（用户问了某个 spec 时） */
  matchedSpec?: { label: string; value: string };
  locale: Locale;
}

export interface StreamOpts {
  question: string;
  history: ChatMessage[];
  context: AiContext;
  locale: Locale;
}

export interface LLMProvider {
  readonly id: string;
  /** 流式产出文本片段（token 或句子），由路由做句子级缓冲后下发 SSE */
  streamAnswer(opts: StreamOpts): AsyncIterable<string>;
}
