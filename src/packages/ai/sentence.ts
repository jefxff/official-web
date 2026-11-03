/**
 * 句子级分片：把文本切成「完整句子」片段（保留句末标点 / 换行）。
 *
 * 用途：SSE 流式下发时，以完整句子为最小单元，避免网络抖动导致半句撕裂
 * （v1.2 评审：中途丢弃句子会撕裂 Markdown / 表格结构）。
 *
 * 边界规则："。！？!?" 一律断句；"." 仅在句末（后接空白或结尾）才断句，
 * 以避免误拆小数（2.2V）与 URL（cdn.fmw.example）中的点。
 */

const HARD = "。！？!?";

/** 判断 text[i] 是否句子边界（供分片与流式缓冲共用）。 */
export function isSentenceBoundary(text: string, i: number): boolean {
  const ch = text[i];
  if (HARD.includes(ch)) return true;
  if (ch === "\n") return true;
  if (ch === ".") {
    const next = text[i + 1];
    return next === undefined || next === " " || next === "\n" || next === "\t";
  }
  return false;
}

export function splitSentences(text: string): string[] {
  const out: string[] = [];
  let buf = "";
  for (let i = 0; i < text.length; i++) {
    buf += text[i];
    if (isSentenceBoundary(text, i)) {
      out.push(buf);
      buf = "";
    }
  }
  if (buf.length > 0) out.push(buf);
  return out;
}
