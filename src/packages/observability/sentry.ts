/**
 * Sentry 上报（零依赖实现，走 Envelope HTTP 协议）。
 *
 * 为什么不用 @sentry/node：
 *  - SDK 体积与传递依赖较重，且会引入自己的全局 hook（patch console / http），
 *    与本项目「结构化日志 + 显式捕获」的边界相冲突；
 *  - 我们只需要「把异常送到 Sentry」这一件事，Envelope 协议是公开且稳定的。
 *
 * 约束（这些细节决定上报是否真的能到）：
 *  - DSN 形如 `https://<publicKey>@<host>/<projectId>`；
 *  - 上报端点为 `{protocol}://{host}/api/{projectId}/envelope/`；
 *  - Envelope 是「换行分隔的 JSON」：信封头 → 条目头 → 条目体；
 *  - 必须带 `X-Sentry-Auth`，否则 401；
 *  - 上报失败**绝不影响业务**：全部 fire-and-forget + 超时 + 限流。
 */

const MAX_EVENTS_PER_MINUTE = 20;

let windowStart = 0;
let windowCount = 0;

interface ParsedDsn {
  endpoint: string;
  publicKey: string;
  projectId: string;
}

export function parseDsn(dsn: string): ParsedDsn | null {
  try {
    const url = new URL(dsn);
    const publicKey = url.username;
    const projectId = url.pathname.replace(/^\//, "").split("/").filter(Boolean).pop() ?? "";
    if (!publicKey || !projectId) return null;
    return {
      endpoint: `${url.protocol}//${url.host}/api/${projectId}/envelope/`,
      publicKey,
      projectId,
    };
  } catch {
    return null;
  }
}

/** 每分钟最多上报 MAX_EVENTS_PER_MINUTE 条，避免异常风暴把配额打满、也避免拖慢请求。 */
function throttled(): boolean {
  const now = Date.now();
  if (now - windowStart > 60_000) {
    windowStart = now;
    windowCount = 0;
  }
  windowCount += 1;
  return windowCount > MAX_EVENTS_PER_MINUTE;
}

function newEventId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * 把 V8 的 stack 字符串解析成 Sentry 需要的 frames（由内到外，Sentry 自己会反转）。
 * 解析失败就返回空数组——宁可有 message 无 frames，也不要因此丢掉整条事件。
 */
export function parseStack(stack: string): Array<{
  filename: string;
  function: string;
  lineno: number;
  colno: number;
  in_app: boolean;
}> {
  const frames: Array<{
    filename: string;
    function: string;
    lineno: number;
    colno: number;
    in_app: boolean;
  }> = [];

  const lines = stack.split("\n").filter((l) => l.trim().startsWith("at "));
  for (const line of lines) {
    const m = /^\s*at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?$/.exec(line);
    if (!m) continue;
    const filename = m[2];
    frames.push({
      function: m[1] ?? "<anonymous>",
      filename,
      lineno: Number(m[3]),
      colno: Number(m[4]),
      // 只把自己的业务代码标为 in_app，第三方依赖折叠，栈更好读。
      // 同时兼容 POSIX（/app/src/...）与 Windows（C:\app\src\...）绝对路径。
      in_app: !/node_modules/.test(filename) && /^(?:[a-zA-Z]:[\\/]|\/)/.test(filename),
    });
  }
  // Sentry 期望 frames 按「从旧到新」排列
  return frames.reverse();
}

export interface SentryEnvelopeInput {
  err: unknown;
  scope: string;
  meta?: Record<string, unknown>;
  dsn: string;
}

/** 构造 Envelope 文本（纯函数，便于测试）。 */
export function buildEnvelope({ err, scope, meta, dsn }: SentryEnvelopeInput): string | null {
  const parsed = parseDsn(dsn);
  if (!parsed) return null;

  const eventId = newEventId();
  const isError = err instanceof Error;
  const message = isError ? err.message : String(err);
  const stack = isError && err.stack ? parseStack(err.stack) : [];

  const header = { event_id: eventId, dsn, sent_at: new Date().toISOString() };
  const itemHeader = { type: "event", content_type: "application/json" };

  const event: Record<string, unknown> = {
    event_id: eventId,
    timestamp: Date.now() / 1000,
    platform: "node",
    level: "error",
    logger: scope,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? "production",
    release: process.env.SENTRY_RELEASE ?? undefined,
    tags: { scope, build_target: process.env.BUILD_TARGET ?? "cn" },
    extra: { ...(meta ?? {}) },
    exception: {
      values: [
        {
          type: isError ? err.name : "Error",
          value: message,
          ...(stack.length > 0 ? { stacktrace: { frames: stack } } : {}),
        },
      ],
    },
  };

  return [JSON.stringify(header), JSON.stringify(itemHeader), JSON.stringify(event)].join("\n");
}

/** 发送到 Sentry。不 await 结果、不抛错——调用方永远不因上报失败而被影响。 */
export function sendToSentry(input: SentryEnvelopeInput): void {
  const parsed = parseDsn(input.dsn);
  if (!parsed) return;
  if (throttled()) return;

  const body = buildEnvelope(input);
  if (!body) return;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2000);

  void fetch(parsed.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-sentry-envelope",
      "X-Sentry-Auth":
        `Sentry sentry_version=7, sentry_client=fmw-observability/1.0, ` +
        `sentry_key=${parsed.publicKey}`,
    },
    body,
    signal: controller.signal,
  })
    .catch(() => {
      /* 上报失败静默：本地结构化日志已留下同一条记录 */
    })
    .finally(() => clearTimeout(timer));
}
