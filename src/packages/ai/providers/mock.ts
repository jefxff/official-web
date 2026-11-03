import type { LLMProvider, StreamOpts } from "../types";
import { slotFillAnswer } from "../grounding";
import { splitSentences } from "../sentence";

/**
 * Mock Provider（默认，无需外网）。
 * 用于本地开发、CI 与本环境验证：基于接地答案做句子级分片，模拟流式输出。
 * 一旦配置 AI_LLM_API_KEY，工厂会自动切换为 OpenAIProvider。
 */
export class MockProvider implements LLMProvider {
  readonly id = "mock";

  async *streamAnswer(opts: StreamOpts): AsyncIterable<string> {
    const answer = slotFillAnswer(opts.context);
    for (const sentence of splitSentences(answer)) {
      yield sentence;
    }
  }
}
