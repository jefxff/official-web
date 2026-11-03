/**
 * APM 上报链路测试：用本地 HTTP 服务**真实接收** Envelope，验证报文与协议细节。
 *
 * 为什么值得这样测：Sentry 上报最容易出的问题不是「代码跑不通」，而是
 * DSN 解析错、端点拼错、少了 X-Sentry-Auth、信封格式不对——这些在本地都不会报错，
 * 只有线上真的出故障时才发现「事件一条都没收到」。
 *
 * 运行：npx tsx scripts/test-observability.ts
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { captureException, parseDsn, parseStack } from "../src/packages/observability";

let pass = 0;
let fail = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    pass += 1;
    console.log(`  PASS  ${name}`);
  } else {
    fail += 1;
    console.log(
      `  FAIL  ${name}\n        expected: ${JSON.stringify(expected)}\n        actual:   ${JSON.stringify(actual)}`
    );
  }
}

function checkTrue(name: string, actual: boolean) {
  check(name, actual, true);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Captured {
  url: string;
  headers: IncomingMessage["headers"];
  body: string;
}

async function main() {
  const captured: Captured[] = [];
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      captured.push({ url: req.url ?? "", headers: req.headers, body });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end("{}");
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  const dsn = `http://pubkey123@127.0.0.1:${port}/42`;

  console.log("=== DSN 解析 ===");
  {
    const parsed = parseDsn(dsn);
    check("端点拼装正确", parsed?.endpoint, `http://127.0.0.1:${port}/api/42/envelope/`);
    check("公钥解析正确", parsed?.publicKey, "pubkey123");
    check("项目号解析正确", parsed?.projectId, "42");
    check("非法 DSN 返回 null", parseDsn("not-a-dsn"), null);
    check("缺公钥返回 null", parseDsn("https://example.com/42"), null);
  }

  console.log("=== 栈解析 ===");
  {
    const err = new Error("boom");
    err.stack = [
      "Error: boom",
      "    at handler (/app/src/app/api/demo/route.ts:12:9)",
      "    at invoke (/app/node_modules/next/dist/server.js:100:5)",
      "    at <anonymous> (/app/src/lib/x.ts:7:1)",
    ].join("\n");
    const frames = parseStack(err.stack);
    check("解析出 3 帧", frames.length, 3);
    check("帧顺序反转（Sentry 要求由旧到新）", frames[0].function, "<anonymous>");
    checkTrue("业务代码标记 in_app", frames[0].in_app);
    check("第三方依赖不标记 in_app", frames[1].in_app, false);
    checkTrue("业务代码帧标记 in_app", frames[2].in_app);
    check("行列号解析", [frames[2].lineno, frames[2].colno], [12, 9]);

    const winFrames = parseStack(
      [
        "Error: win",
        "    at handler (C:////app////src////app////route.ts:5:3)",
        "    at dep (C:////app////node_modules////next////dist////x.js:1:1)",
      ].join("\n")
    );
    checkTrue("Windows 路径也识别为业务代码", winFrames[1].in_app);
    check("Windows 依赖帧不标记 in_app", winFrames[0].in_app, false);
  }

  console.log("=== 上报实际发出的报文 ===");
  {
    process.env.SENTRY_DSN = dsn;
    process.env.SENTRY_ENVIRONMENT = "test";
    process.env.BUILD_TARGET = "cn";

    captureException(new Error("上传失败：storage unreachable"), "media.upload", {
      key: "media/2026/11/abc-banner.png",
    });
    await sleep(400);

    check("收到 1 条上报", captured.length, 1);
    const req = captured[0];
    check("端点路径正确", req.url, "/api/42/envelope/");
    check(
      "Content-Type 为 envelope",
      req.headers["content-type"],
      "application/x-sentry-envelope"
    );
    check(
      "X-Sentry-Auth 含公钥",
      (req.headers["x-sentry-auth"] as string).includes("sentry_key=pubkey123"),
      true
    );

    const lines = req.body.split("\n");
    check("信封为三行结构", lines.length, 3);

    const header = JSON.parse(lines[0]);
    const itemHeader = JSON.parse(lines[1]);
    const event = JSON.parse(lines[2]);

    check("信封头含 event_id", typeof header.event_id, "string");
    check("信封头回带 dsn", header.dsn, dsn);
    check("条目类型为 event", itemHeader.type, "event");
    check("event_id 前后一致", event.event_id, header.event_id);
    check("日志级别 error", event.level, "error");
    check("scope 写入 logger", event.logger, "media.upload");
    check("环境标签", event.environment, "test");
    check("区域标签", event.tags.build_target, "cn");
    check("附加信息透传", event.extra.key, "media/2026/11/abc-banner.png");
    check("异常信息正确", event.exception.values[0].value, "上传失败：storage unreachable");
    checkTrue(
      "异常带栈帧",
      Array.isArray(event.exception.values[0].stacktrace?.frames) &&
        event.exception.values[0].stacktrace.frames.length > 0
    );
  }

  console.log("=== 限流（异常风暴保护）===");
  {
    const before = captured.length;
    for (let i = 0; i < 30; i += 1) captureException(new Error(`storm-${i}`), "storm");
    await sleep(600);
    const sent = captured.length - before;
    checkTrue(`每分钟上限生效（本次发出 ${sent} 条，应 ≤ 20）`, sent <= 20);
    checkTrue("至少发出部分事件（不是全丢）", sent > 0);
  }

  console.log("=== 失效保护 ===");
  {
    const before = captured.length;
    process.env.SENTRY_DSN = "http://bad-dsn-without-project";
    let threw = false;
    try {
      captureException(new Error("should not throw"), "guard");
    } catch {
      threw = true;
    }
    await sleep(100);
    checkTrue("非法 DSN 不抛错", !threw);
    check("非法 DSN 不上报", captured.length, before);
    delete process.env.SENTRY_DSN;
  }

  await new Promise<void>((resolve) => server.close(() => resolve()));

  console.log("");
  console.log(`总计 ${pass + fail} 项：PASS ${pass} / FAIL ${fail}`);
  if (fail > 0) {
    console.error("可观测性上报链路未通过。");
    process.exit(1);
  }
  console.log("APM 上报链路测试全部通过。");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
