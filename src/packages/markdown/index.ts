import { createElement as h, Fragment, type ReactNode } from "react";

/**
 * 极简 Markdown 渲染器（零依赖、无 `dangerouslySetInnerHTML`）。
 *
 * 为什么要自己写：资讯正文在后台标注「支持 Markdown」，但前台此前直接输出
 * `{article.body}`，编辑写的 `## 标题`、列表、链接全部原样显示成符号。
 * 引一个 Markdown 库（marked / react-markdown）会带来 3~8 个传递依赖，
 * 与本项目的依赖门禁相冲突；而我们需要支持的语法子集很小。
 *
 * 安全模型（关键）：
 *  - **不解析原始 HTML**：`<script>`、`<img onerror>` 等一律按纯文本转义输出，
 *    因此渲染结果不可能产生 XSS——这一条比任何过滤器都可靠；
 *  - 链接只放行 `http(s)://`、`mailto:`、站内绝对路径 `/...` 与锚点 `#...`，
 *    其余（`javascript:`、`data:`）直接降级为纯文本；
 *  - 外链统一加 `rel="noopener noreferrer"`。
 *
 * 支持语法：# ~ ### 标题、有序/无序列表、引用、围栏代码块、分割线、
 * 段落、**加粗**、*斜体*、`行内代码`、[链接](url)。
 */

export interface MarkdownOptions {
  /** 额外类名（例如前台正文的容器样式） */
  className?: string;
}

function safeHref(raw: string): string | null {
  const href = raw.trim();
  if (/^https?:\/\//i.test(href)) return href;
  if (/^mailto:/i.test(href)) return href;
  if (href.startsWith("/") || href.startsWith("#")) return href;
  return null;
}

// 链接目标允许一层括号（`[x](javascript:alert(1))` 这类写法必须能识别出来再按不安全降级，
// 否则它会退化成原样文本；虽然同样安全，但会把「不安全的 URL」显示给读者）
const INLINE_PATTERN =
  /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*|_[^_\n]+_|`[^`\n]+`|\[[^\]\n]+\]\([^()\s]*(?:\([^()\s]*\))?[^()\s]*\))/g;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  let cursor = 0;
  let index = 0;

  for (const match of text.matchAll(INLINE_PATTERN)) {
    const token = match[0];
    const at = match.index ?? 0;
    if (at > cursor) out.push(text.slice(cursor, at));

    const key = `${keyPrefix}-i${index++}`;
    if (token.startsWith("**") || token.startsWith("__")) {
      out.push(h("strong", { key, className: "font-semibold" }, token.slice(2, -2)));
    } else if (token.startsWith("`")) {
      out.push(
        h(
          "code",
          {
            key,
            className: "rounded bg-slate-100 px-1 py-0.5 text-[0.9em] text-slate-800",
          },
          token.slice(1, -1)
        )
      );
    } else if (token.startsWith("[")) {
      const m = /^\[([^\]]+)\]\((.+)\)$/.exec(token);
      const label = m?.[1] ?? token;
      const href = m ? safeHref(m[2]) : null;
      const external = href?.startsWith("http") ?? false;
      out.push(
        href
          ? h(
              "a",
              {
                key,
                href,
                className: "text-[var(--color-brand)] underline underline-offset-2",
                ...(external ? { rel: "noopener noreferrer", target: "_blank" } : {}),
              },
              label
            )
          : label
      );
    } else {
      out.push(h("em", { key }, token.slice(1, -1)));
    }
    cursor = at + token.length;
  }

  if (cursor < text.length) out.push(text.slice(cursor));
  return out;
}

const H_CLASS: Record<number, string> = {
  1: "mt-8 mb-4 text-2xl font-semibold",
  2: "mt-8 mb-3 text-xl font-semibold",
  3: "mt-6 mb-2 text-lg font-semibold",
};

/**
 * 渲染为 React 节点数组。返回数组而非单个节点，便于调用方在 `article` 内自由组合。
 */
export function renderMarkdown(source: string): ReactNode[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;
  const nextKey = () => `md-${key++}`;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i += 1;
      continue;
    }

    // 围栏代码块
    const fence = /^```(\w*)\s*$/.exec(line.trim());
    if (fence) {
      const buf: string[] = [];
      i += 1;
      while (i < lines.length && !/^```\s*$/.test(lines[i].trim())) {
        buf.push(lines[i]);
        i += 1;
      }
      i += 1; // 跳过结束围栏
      blocks.push(
        h(
          "pre",
          {
            key: nextKey(),
            className:
              "my-5 overflow-x-auto rounded-lg bg-slate-900 p-4 text-sm text-slate-100",
          },
          h("code", null, buf.join("\n"))
        )
      );
      continue;
    }

    // 标题
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      blocks.push(
        h(`h${level}`, { key: nextKey(), className: H_CLASS[level] }, renderInline(heading[2], nextKey()))
      );
      i += 1;
      continue;
    }

    // 分割线
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim())) {
      blocks.push(h("hr", { key: nextKey(), className: "my-8 border-slate-200" }));
      i += 1;
      continue;
    }

    // 引用（连续 > 行合并）
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ""));
        i += 1;
      }
      blocks.push(
        h(
          "blockquote",
          {
            key: nextKey(),
            className: "my-5 border-l-4 border-[var(--color-brand)]/40 pl-4 text-[var(--color-sub)]",
          },
          renderInline(buf.join(" "), nextKey())
        )
      );
      continue;
    }

    // 列表（无序 / 有序），允许缩进一层嵌套
    const ulItem = /^\s*[-*+]\s+(.*)$/;
    const olItem = /^\s*\d+[.)]\s+(.*)$/;
    if (ulItem.test(line) || olItem.test(line)) {
      const ordered = olItem.test(line);
      const itemRe = ordered ? olItem : ulItem;
      const items: ReactNode[] = [];
      while (i < lines.length && itemRe.test(lines[i])) {
        const text = itemRe.exec(lines[i])?.[1] ?? "";
        items.push(h("li", { key: nextKey(), className: "my-1" }, renderInline(text, nextKey())));
        i += 1;
      }
      blocks.push(
        h(
          ordered ? "ol" : "ul",
          {
            key: nextKey(),
            className: ordered
              ? "my-4 list-decimal space-y-1 pl-6"
              : "my-4 list-disc space-y-1 pl-6",
          },
          items
        )
      );
      continue;
    }

    // 段落：连续的普通行合并
    const buf: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(#{1,3})\s+/.test(lines[i]) &&
      !/^```/.test(lines[i].trim()) &&
      !/^>\s?/.test(lines[i]) &&
      !ulItem.test(lines[i]) &&
      !olItem.test(lines[i])
    ) {
      buf.push(lines[i].trim());
      i += 1;
    }
    if (buf.length > 0) {
      blocks.push(
        h("p", { key: nextKey(), className: "my-4 leading-relaxed" }, renderInline(buf.join(" "), nextKey()))
      );
    }
  }

  return blocks.length > 0 ? [h(Fragment, { key: "md-root" }, blocks)] : [];
}

/** 便捷组件：包一层容器，供前台正文直接使用。 */
export function Markdown({ source, className }: { source: string; className?: string }) {
  if (!source.trim()) return null;
  return h("div", { className }, renderMarkdown(source));
}
