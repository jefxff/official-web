/**
 * 双区域拨测（v1.2 §11：国内 / 海外可用性巡检）。
 *
 * 拨测要检的三件事，缺一不可：
 *  1. **可达**：HTTP 200（海外最容易出问题的是「新页面 404」——Worker 未回源）；
 *  2. **内容正确**：响应里真的有业务内容，而不是 CDN 的默认错误页 / 反代 502 转 200；
 *  3. **跨区域一致**：同一路径在两个区域都能拿到内容（缓存版本不同可以接受，缺页不行）。
 *
 * 用法：
 *   npm run probe                                        # 用默认域名
 *   PROBE_CN=https://www.fmw.cn PROBE_GLOBAL=https://www.fmw.com npm run probe
 *   npm run probe -- --cn=http://127.0.0.1:3000 --global=http://127.0.0.1:3000   # 本地自检
 *   npm run probe -- --json                               # 输出 JSON，便于接入告警平台
 *
 * 退出码：0 全部通过；1 存在失败项（可直接用于 CI / cron 告警）。
 */

interface Target {
  path: string;
  label: string;
  /** 响应体必须包含的片段（区分「真页面」与「错误页」） */
  mustContain?: string;
  /** 期望的 Content-Type 前缀 */
  contentType?: string;
  /** JSON 校验：解析后自定义断言 */
  json?: (body: unknown) => boolean;
}

const TIMEOUT_MS = 10_000;
const SLOW_MS = 2_500;

const TARGETS: Target[] = [
  { path: "/zh", label: "首页（中文）", mustContain: "富满微", contentType: "text/html" },
  { path: "/en", label: "首页（英文）", mustContain: "<html", contentType: "text/html" },
  { path: "/zh/products", label: "产品列表", mustContain: "产品", contentType: "text/html" },
  { path: "/zh/products/FM8001", label: "料号页", mustContain: "FM8001", contentType: "text/html" },
  { path: "/zh/news", label: "资讯列表", mustContain: "<html", contentType: "text/html" },
  {
    path: "/api/v1/part/FM8001",
    label: "P02 URL as API",
    contentType: "application/json",
    json: (b) => typeof b === "object" && b !== null && (b as { mpn?: string }).mpn === "FM8001",
  },
  {
    path: "/api/v1/part/NO-SUCH-MPN",
    label: "P02 未知料号应 404",
    contentType: "application/json",
    // 404 是正确行为：单独标记，见下方 expectStatus
  },
  { path: "/sitemap.xml", label: "sitemap", mustContain: "<urlset", contentType: "application/xml" },
  { path: "/robots.txt", label: "robots", mustContain: "Sitemap", contentType: "text/plain" },
];

interface Result {
  region: "cn" | "global";
  path: string;
  label: string;
  status: number | null;
  ms: number;
  ok: boolean;
  problem?: string;
}

function argValue(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.split("=")[1];
}

const asJson = process.argv.includes("--json");

const REGIONS: Array<{ key: "cn" | "global"; base: string }> = [
  {
    key: "cn",
    base: argValue("cn") ?? process.env.PROBE_CN ?? process.env.NEXT_PUBLIC_SITE_URL_CN ?? "",
  },
  {
    key: "global",
    base:
      argValue("global") ??
      process.env.PROBE_GLOBAL ??
      process.env.NEXT_PUBLIC_SITE_URL_GLOBAL ??
      "",
  },
].filter((r) => Boolean(r.base)) as Array<{ key: "cn" | "global"; base: string }>;

async function probeOne(
  region: "cn" | "global",
  base: string,
  target: Target
): Promise<Result> {
  const url = `${base.replace(/\/$/, "")}${target.path}`;
  const startedAt = Date.now();
  const result: Result = {
    region,
    path: target.path,
    label: target.label,
    status: null,
    ms: 0,
    ok: false,
  };

  const expect404 = target.path.includes("NO-SUCH-MPN");

  try {
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "User-Agent": "fmw-probe/1.0" },
    });
    result.ms = Date.now() - startedAt;
    result.status = res.status;

    if (expect404) {
      result.ok = res.status === 404;
      if (!result.ok) result.problem = `期望 404，实际 ${res.status}`;
      return result;
    }

    if (res.status !== 200) {
      result.problem = `HTTP ${res.status}`;
      return result;
    }

    const ctype = res.headers.get("content-type") ?? "";
    if (target.contentType && !ctype.startsWith(target.contentType)) {
      result.problem = `Content-Type 异常：${ctype || "(空)"}`;
      return result;
    }

    const body = await res.text();
    if (body.length === 0) {
      result.problem = "响应体为空";
      return result;
    }

    if (target.mustContain && !body.includes(target.mustContain)) {
      // 命中 CDN/反代错误页的典型特征
      result.problem = `响应缺少关键字「${target.mustContain}」（疑似错误页）`;
      return result;
    }

    if (target.json) {
      try {
        if (!target.json(JSON.parse(body))) {
          result.problem = "JSON 内容不符合预期";
          return result;
        }
      } catch {
        result.problem = "响应不是合法 JSON";
        return result;
      }
    }

    result.ok = true;
    if (result.ms > SLOW_MS) result.problem = `响应偏慢 ${result.ms}ms`;
    return result;
  } catch (err) {
    result.ms = Date.now() - startedAt;
    result.problem =
      err instanceof Error && err.name === "TimeoutError"
        ? `超时（>${TIMEOUT_MS}ms）`
        : err instanceof Error
          ? err.message
          : String(err);
    return result;
  }
}

async function main(): Promise<void> {
  if (REGIONS.length === 0) {
    console.error(
      "未配置拨测地址。请设置 PROBE_CN / PROBE_GLOBAL，或使用 --cn= / --global= 传参。"
    );
    process.exit(1);
  }

  const results: Result[] = [];
  for (const region of REGIONS) {
    for (const target of TARGETS) {
      results.push(await probeOne(region.key, region.base, target));
    }
  }

  const failed = results.filter((r) => !r.ok);
  const slow = results.filter((r) => r.ok && r.ms > SLOW_MS);

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          at: new Date().toISOString(),
          regions: REGIONS.map((r) => ({ region: r.key, base: r.base })),
          total: results.length,
          failed: failed.length,
          slow: slow.length,
          results,
        },
        null,
        2
      )
    );
  } else {
    for (const region of REGIONS) {
      console.log(`\n[${region.key}] ${region.base}`);
      for (const r of results.filter((x) => x.region === region.key)) {
        const flag = r.ok ? (r.ms > SLOW_MS ? "SLOW" : " OK ") : "FAIL";
        const detail = r.problem ? `  ${r.problem}` : "";
        console.log(
          `  ${flag}  ${String(r.status ?? "-").padStart(3)}  ${String(r.ms).padStart(5)}ms  ${r.label}${detail}`
        );
      }
    }
    console.log(
      `\n合计 ${results.length} 项：通过 ${results.length - failed.length} / 失败 ${failed.length} / 偏慢 ${slow.length}`
    );
  }

  if (failed.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
