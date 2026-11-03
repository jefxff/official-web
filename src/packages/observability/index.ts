/**
 * 可观测性基础包（v1.2 评审：这是「省了会后悔」的重点欠账，提前补齐底座）。
 *
 * 设计目标：
 *  - 零依赖：开箱即用，不影响 npm install 体积与构建。
 *  - 结构化日志：统一 JSON 行，便于接入 Loki / 日志服务。
 *  - 错误捕获：captureException 在设 SENTRY_DSN 时上报 Sentry（Envelope 协议，见 ./sentry.ts）。
 *  - 双区域可用：国内 / 海外同一套，海外 Worker 不参与（仅边缘缓存）。
 *
 * 接入自建 tracing 或其它 APM 时，只需替换 ./sentry.ts 的实现，业务代码无需改动。
 */

import { sendToSentry } from "./sentry";

export { buildEnvelope, parseDsn, parseStack, sendToSentry } from "./sentry";

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function currentLevel(): LogLevel {
  const raw = (process.env.LOG_LEVEL ?? "info").toLowerCase();
  return raw in LEVEL_ORDER ? (raw as LogLevel) : "info";
}

function threshold(): number {
  return LEVEL_ORDER[currentLevel()];
}

function emit(
  level: LogLevel,
  scope: string,
  message: string,
  meta?: Record<string, unknown>
): void {
  if (LEVEL_ORDER[level] < threshold()) return;
  const entry = {
    ts: new Date().toISOString(),
    level,
    scope,
    message,
    ...(meta ?? {}),
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);

  // —— Sentry 扩展点 ——
  // if (process.env.SENTRY_DSN) { const Sentry = require("@sentry/node"); Sentry.captureMessage(message, level); }
}

export const logger = {
  debug: (scope: string, msg: string, meta?: Record<string, unknown>) =>
    emit("debug", scope, msg, meta),
  info: (scope: string, msg: string, meta?: Record<string, unknown>) =>
    emit("info", scope, msg, meta),
  warn: (scope: string, msg: string, meta?: Record<string, unknown>) =>
    emit("warn", scope, msg, meta),
  error: (scope: string, msg: string, meta?: Record<string, unknown>) =>
    emit("error", scope, msg, meta),
};

/** 捕获异常：结构化记录 message + stack，并在配置 SENTRY_DSN 时上报 APM。 */
export function captureException(
  err: unknown,
  scope = "app",
  meta?: Record<string, unknown>
): void {
  const message = err instanceof Error ? err.message : String(err);
  emit("error", scope, message, {
    ...meta,
    stack: err instanceof Error ? err.stack : undefined,
  });

  // 上报是「尽力而为」：失败静默，绝不影响请求处理（实现见 ./sentry.ts）。
  const dsn = process.env.SENTRY_DSN;
  if (dsn) {
    sendToSentry({ err, scope, meta, dsn });
  }
}

export type { LogLevel };
