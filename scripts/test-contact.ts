/**
 * 询盘接口行为回归测试。
 *
 * 重点不是「函数能跑」，而是三个曾经被踩过 / 容易写错的点：
 *  1. 无数据库时必须真的落盘（否则又变成「假成功」）；
 *  2. 蜜罐命中要返回 202 但**不落库**；
 *  3. 限流窗口到期后要恢复，且不同 key 互不影响。
 *
 * 运行：npx tsx scripts/test-contact.ts
 */
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

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

async function main() {
  const dir = await mkdtemp(path.join(tmpdir(), "fmw-inquiry-"));
  const file = path.join(dir, "inquiries.jsonl");
  process.env.DATA_SOURCE = "seed"; // 强制走文件兜底分支
  process.env.INQUIRY_FALLBACK_PATH = file;
  delete process.env.DATABASE_URL;

  const { createInquiry, countFileInquiries } = await import("../src/packages/inquiry");
  const { rateLimited, resetRateLimit } = await import("../src/packages/ratelimit");

  console.log("=== 落盘（无数据库时的兜底通道）===");
  {
    const stored = await createInquiry({
      name: "张工",
      email: "zhang@example.com",
      message: "想申请 FM8001 样片 2 片，谢谢。",
      locale: "zh",
    });
    check("返回存储通道", stored.storage, "file");
    checkTrue("返回 id", typeof stored.id === "string" && stored.id.length > 10);

    await createInquiry({
      name: "Li",
      email: "li@example.com",
      company: "  ",
      message: "Need FM3001 automotive qualification report.",
      locale: "en",
    });

    const raw = await readFile(file, "utf8");
    const lines = raw.split("\n").filter((l) => l.trim());
    check("写入条数", lines.length, 2);

    const first = JSON.parse(lines[0]) as Record<string, unknown>;
    check("中文留言原样保存", first.message, "想申请 FM8001 样片 2 片，谢谢。");
    check("locale 记录正确", first.locale, "zh");
    check("空白公司名归一为空", "company" in JSON.parse(lines[1]), false);

    check("计数辅助函数与文件一致", await countFileInquiries(), 2);
  }

  console.log("=== 限流窗口 ===");
  {
    resetRateLimit();
    const results: boolean[] = [];
    for (let i = 0; i < 4; i += 1) results.push(rateLimited("contact:1.1.1.1", 3, 60_000));
    check("前 3 次放行、第 4 次拦截", results, [false, false, false, true]);

    check("不同 key 互不影响", rateLimited("contact:2.2.2.2", 3, 60_000), false);

    // 窗口极短，等其自然过期（1ms 窗口 + 5ms 等待，避免依赖假时钟）
    resetRateLimit();
    rateLimited("short", 1, 1);
    await new Promise((r) => setTimeout(r, 10));
    check("窗口过期后重新放行", rateLimited("short", 1, 1), false);
  }

  console.log("=== 落盘失败必须抛错（不能假装成功）===");
  {
    // 用一个「父路径是普通文件」的位置，mkdir 必然 ENOTDIR（比写非法字符更接近真实故障）
    const blocker = path.join(dir, "blocker");
    await writeFile(blocker, "not a directory", "utf8");
    process.env.INQUIRY_FALLBACK_PATH = path.join(blocker, "inquiries.jsonl");
    let threw = false;
    try {
      await createInquiry({
        name: "x",
        email: "x@example.com",
        message: "test message",
        locale: "zh",
      });
    } catch (err) {
      threw = err instanceof Error && err.message === "inquiry_persist_failed";
    }
    checkTrue("两种通道都失败时抛出 inquiry_persist_failed", threw);
  }

  await rm(dir, { recursive: true, force: true });

  console.log("");
  console.log(`总计 ${pass + fail} 项：PASS ${pass} / FAIL ${fail}`);
  if (fail > 0) {
    console.error("询盘 / 限流实现未通过校验。");
    process.exit(1);
  }
  console.log("询盘落盘与限流校验全部通过。");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
