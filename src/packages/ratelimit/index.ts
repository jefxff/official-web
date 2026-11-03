import type { NextRequest } from "next/server";

/**
 * 单实例内存限流（固定窗口计数）。
 *
 * 为什么不用 Server Action / 中间件：写接口与 AI 接口都在 Route Handler 内，
 * 直接在进程内存里计数最简单；多实例部署时必须换成共享存储
 * （Redis / Cloudflare KV），否则 N 个副本等于把阈值放大 N 倍。
 *
 * 说明：这里刻意不做 LRU 淘汰 —— 键是 IP，攻击者换 IP 依然能绕过，
 * 真正防线在网关 / WAF；本层只挡「同一访客手抖连点」。
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** 返回 true 表示本次请求应被拒绝（已超限）。 */
export function rateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const rec = buckets.get(key);
  if (!rec || rec.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  if (rec.count >= limit) return true;
  rec.count += 1;
  return false;
}

/** 取客户端 IP：优先取反代链首位，都没有则归为 unknown（不会因此放开限流）。 */
export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/** 测试用：清空计数，避免用例之间互相污染。 */
export function resetRateLimit(key?: string): void {
  if (key === undefined) buckets.clear();
  else buckets.delete(key);
}
