/**
 * 分级依赖审计门禁。
 *
 * 背景：`npm audit --audit-level=high` 只区分「阻断 / 不阻断」，团队容易在
 * 多次误报后习惯性绕过。本脚本把门禁分级并让豁免显式化：
 *
 *   high / critical → 必须为 0，否则失败（无豁免机制）
 *   moderate        → 必须在 docs/security-policy.md 中登记，否则失败
 *
 * 用法：npx tsx scripts/audit-gate.ts
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type AuditVuln = {
  name: string;
  severity: string;
  isDirect?: boolean;
  fixAvailable?: unknown;
};

type AuditReport = {
  vulnerabilities?: Record<string, AuditVuln>;
};

const BLOCKING_SEVERITIES = new Set(["high", "critical"]);
const REVIEW_SEVERITIES = new Set(["moderate"]);

function runAudit(): AuditReport {
  // npm audit 在发现漏洞时退出码非 0，因此不能用 execFileSync（会抛错），
  // 改用 spawnSync 读取 stdout。
  const res = spawnSync("npm", ["audit", "--json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
  });
  const out = res.stdout ?? "";
  if (!out.trim()) {
    console.error("✗ npm audit 未返回输出。");
    console.error(res.stderr ?? "");
    process.exit(1);
  }
  try {
    return JSON.parse(out) as AuditReport;
  } catch {
    console.error("✗ npm audit 输出无法解析为 JSON。");
    console.error(out.slice(0, 500));
    process.exit(1);
  }
}

/**
 * 从已登记的豁免文档里提取包名。
 * 只读取 AUDIT-EXEMPTIONS 标记区块内的表格第一列（形如 `| `pkg` | ... |`），
 * 这是机器可读清单，避免正则去猜正文里的各种简写写法。
 */
function loadRegisteredPackages(): Set<string> {
  const docPath = resolve(process.cwd(), "docs/security-policy.md");
  let content: string;
  try {
    content = readFileSync(docPath, "utf8");
  } catch {
    console.error("✗ 找不到 docs/security-policy.md，无法校验 moderate 豁免登记。");
    process.exit(1);
  }

  const begin = "<!-- AUDIT-EXEMPTIONS:BEGIN -->";
  const end = "<!-- AUDIT-EXEMPTIONS:END -->";
  // 文档正文里也会提及这两个标记字面量，故一律取最后一次出现的位置，
  // 确保拿到的是真正包裹清单的那一对。
  const start = content.lastIndexOf(begin);
  const stop = content.lastIndexOf(end);
  if (start < 0 || stop < 0 || stop <= start) {
    console.error(
      "✗ docs/security-policy.md 缺少 AUDIT-EXEMPTIONS 标记区块，无法校验豁免登记。"
    );
    process.exit(1);
  }

  const block = content.slice(start + begin.length, stop);
  const registered = new Set<string>();
  // 表格行：| `pkg-name` | ... |
  for (const m of block.matchAll(/^\|\s*`([^`]+)`\s*\|/gm)) {
    registered.add(m[1].trim());
  }
  return registered;
}

function main() {
  let report: AuditReport;
  try {
    report = runAudit();
  } catch {
    console.error("✗ npm audit 执行失败（可能网络不可用）。");
    process.exit(1);
  }

  const vulns = Object.values(report.vulnerabilities ?? {});
  const blocking = vulns.filter((v) => BLOCKING_SEVERITIES.has(v.severity));
  const review = vulns.filter((v) => REVIEW_SEVERITIES.has(v.severity));

  console.log("依赖安全门禁");
  console.log("=".repeat(50));

  // —— 第一关：high / critical 必须为 0 ——
  if (blocking.length > 0) {
    console.error(`\n✗ 存在 ${blocking.length} 个 high/critical 漏洞（无豁免机制，必须修复）：`);
    for (const v of blocking) {
      const fix = v.fixAvailable ? "可修复" : "需人工处理";
      console.error(`   - ${v.name} (${v.severity}, ${fix})`);
    }
    console.error("\n参考 docs/security-policy.md 的「已修复记录」章节。");
    process.exit(1);
  }
  console.log("✓ high / critical: 0");

  // —— 第二关：moderate 必须在豁免文档中登记 ——
  if (review.length > 0) {
    const registered = loadRegisteredPackages();
    const unregistered = review.filter((v) => !registered.has(v.name));
    console.log(`\nmoderate 漏洞 ${review.length} 个：`);
    for (const v of review) {
      const ok = registered.has(v.name);
      console.log(`   ${ok ? "✓" : "✗"} ${v.name} — ${ok ? "已登记豁免" : "未登记"}`);
    }
    if (unregistered.length > 0) {
      console.error(
        `\n✗ ${unregistered.length} 个 moderate 漏洞未在 docs/security-policy.md 登记。\n` +
          `   请评估是否命中本项目用法：命中则必须修复；不命中则补写登记条目。`
      );
      process.exit(1);
    }
    console.log("✓ 全部 moderate 漏洞均已登记豁免");
  } else {
    console.log("✓ moderate: 0");
  }

  // —— 第三关：豁免清单不得留有已修复的过期条目 ——
  const registered = loadRegisteredPackages();
  const liveNames = new Set(vulns.map((v) => v.name));
  const stale = [...registered].filter((name) => !liveNames.has(name));
  if (stale.length > 0) {
    console.error(
      `\n✗ 豁免清单中存在 ${stale.length} 个过期条目（漏洞已修复但未清理）：\n` +
        stale.map((n) => `   - ${n}`).join("\n") +
        `\n   请从 docs/security-policy.md 的 AUDIT-EXEMPTIONS 区块中移除。`
    );
    process.exit(1);
  }
  console.log("✓ 豁免清单无过期条目");

  console.log("\n✓ 依赖安全门禁通过");
}

main();
