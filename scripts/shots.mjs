/**
 * 全站页面截图（视觉回归自检用）。
 *
 * 用系统自带 Edge（playwright-core 不自带浏览器，避免额外下载 100MB+），
 * 需要先起服务：npm run build && npx next start -p 3210
 *
 *   node scripts/shots.mjs http://127.0.0.1:3210 ./shots
 *
 * 说明：
 *  - 桌面 1440×900，移动 390×844，两档都出图，用来检查构成在窄屏是否崩；
 *  - fullPage 截图前先滚到底再回顶，触发懒加载并让所有滚动进场动画落位；
 *  - 动效统一在截图时禁用，避免同一页两次截图不一致（视觉回归的可比性）。
 */
import { chromium, devices } from "playwright-core";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE = process.argv[2] ?? "http://127.0.0.1:3210";
const OUT = process.argv[3] ?? "./shots";
const EDGE =
  process.env.EDGE_PATH ??
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

/** 每个页面一个短名，顺序即截图顺序 */
const PAGES = [
  ["home", "/zh"],
  ["products", "/zh/products"],
  ["product-detail", "/zh/products/FM8001"],
  ["series", "/zh/series"],
  ["series-detail", "/zh/series/ldo-regulators"],
  ["news", "/zh/news"],
  ["news-detail", "/zh/news/fm8001-launch"],
  ["about", "/zh/about"],
  ["contact", "/zh/contact"],
  ["search", "/zh/search?q=FM"],
  ["home-en", "/en"],
  ["about-en", "/en/about"],
  ["404", "/zh/not-found-page-for-screenshot"],
  ["admin-login", "/admin/login"],
];

const MOBILE_ONLY = new Set(["home", "products", "product-detail"]);

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: EDGE, headless: true });

async function shoot(name, urlPath, viewport, suffix) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
    locale: "zh-CN",
  });
  const page = await context.newPage();
  await page.goto(`${BASE}${urlPath}`, { waitUntil: "networkidle", timeout: 45000 });
  // 滚到底再回顶：触发懒加载图片与滚动进场，然后稳定在顶部构图
  await page.evaluate(async () => {
    const step = window.innerHeight;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(400);
  const file = path.join(OUT, `${name}${suffix}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`✓ ${file}`);
  await context.close();
}

for (const [name, urlPath] of PAGES) {
  await shoot(name, urlPath, { width: 1440, height: 900 }, "");
  if (MOBILE_ONLY.has(name)) {
    await shoot(name, urlPath, devices["iPhone 13"].viewport, "-mobile");
  }
}

await browser.close();
console.log("done");
