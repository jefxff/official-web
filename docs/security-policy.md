# 依赖安全策略

## 分级门禁

| 等级 | 处置 | 门禁 |
|---|---|---|
| **high / critical** | 必须修复才能合并；无豁免机制 | `npm audit --audit-level=high` 失败即阻断 |
| **moderate** | 需评估是否命中本项目用法；命中则必须修复 | 不阻断，但必须在下方登记并写明判定 |
| **low / info** | 记录即可 | 不阻断 |

## 当前登记的 moderate 豁免

`npm audit --audit-level=high` 不阻断 moderate，但以下条目已逐一评估。
下方 `<!-- AUDIT-EXEMPTIONS:BEGIN -->` / `<!-- AUDIT-EXEMPTIONS:END -->` 之间是
**机器可读清单**，`scripts/audit-gate.ts` 会读取它来校验登记完整性——新增 moderate
漏洞若未登记，CI 会直接失败。

<!-- AUDIT-EXEMPTIONS:BEGIN -->

| 包名 | 性质 | 判定依据 |
|---|---|---|
| `eslint` | devDependency，仅 CI lint 阶段 | 不进生产镜像 |
| `eslint-config-next` | devDependency | 同上 |
| `eslint-plugin-react` | devDependency | 同上 |
| `eslint-plugin-import` | devDependency | 同上 |
| `eslint-plugin-jsx-a11y` | devDependency | 同上 |
| `minimatch` | eslint 生态传递依赖 | 同上 |
| `@eslint-community/eslint-utils` | eslint 生态传递依赖 | 同上 |
| `@eslint/config-array` | eslint 生态传递依赖 | 同上 |
| `@eslint/eslintrc` | eslint 生态传递依赖 | 同上 |
| `@typescript-eslint/eslint-plugin` | eslint 生态传递依赖 | 同上 |
| `@typescript-eslint/parser` | eslint 生态传递依赖 | 同上 |
| `@typescript-eslint/type-utils` | eslint 生态传递依赖 | 同上 |
| `@typescript-eslint/typescript-estree` | eslint 生态传递依赖 | 同上 |
| `@typescript-eslint/utils` | eslint 生态传递依赖 | 同上 |
| `next-intl` | 运行时依赖 | 见下方专项评估 |

<!-- AUDIT-EXEMPTIONS:END -->

### next-intl 两个 advisory（专项评估）

- **GHSA-8f24-v5vv-gm5j（open redirect）**：命中条件为自定义 redirect 配置或 `basePath`。
  - **判定**：不命中。本项目 `next.config.ts` 未设置 `basePath`/自定义 redirect，语言跳转由 `src/middleware.ts` 的固定路由表驱动。
- **GHSA-4c35-wcg5-mm9h（prototype pollution）**：命中条件为启用 `experimental.messages.precompile`。
  - **判定**：不命中。全项目未使用该实验特性，翻译字典为静态 JSON。

### eslint 工具链（13 项）

- **性质**：全部为 devDependencies，仅影响本地/CI 的 lint 阶段，不进入生产构建产物（`Dockerfile` 采用 standalone 输出，仅携带运行时依赖）。
- **修复路径**：等待 Next 16 升级时一并升级 eslint 生态（见下方"待办"）。

## 内容安全策略（CSP）分档

CSP 由 `src/middleware.ts` 逐请求下发，策略构造集中在 `src/packages/security/csp.ts`。**分两档而非全站 nonce**，理由如下。

| 路由类型 | `script-src` | 渲染模式 | 缓存 |
|---|---|---|---|
| 公开页（`/[locale]/**`、`/sitemap.xml` 等） | `'self' 'unsafe-inline'` | SSG / ISR | 可被 CDN / 边缘长缓存 |
| 后台（`/admin/**`） | `'self' 'nonce-<随机>' 'strict-dynamic'` | 强制动态 | `no-store` |

**为什么公开页不用 nonce**：nonce 必须逐请求生成并写进每个 `<script>`，因此页面无法预渲染成静态产物。而本项目的双区域架构（国内源站 + 海外 Cloudflare Worker 边缘缓存回源）依赖静态产物才能命中边缘缓存；一旦改成 nonce，公开页会退化为「每次请求穿透回源」，双区域设计的主要收益归零。这个交换不划算，故不做。

作为补偿措施（缺一不可，改动时请保持）：

1. **全仓库不使用 `dangerouslySetInnerHTML`**（资讯正文由自写的 `@fmw/markdown` 渲染为 React 元素，不解析原始 HTML）；
2. Markdown 链接只放行 `http(s)://`、`mailto:`、站内 `/...` 与 `#...`，`javascript:` / `data:` 降级为纯文本；
3. 后台整体 `force-dynamic`（`src/app/admin/layout.tsx`），nonce 前提才成立——若有人给后台加 `revalidate` 或静态化，nonce 会失效并导致后台脚本被 CSP 阻断；
4. 上传接口拒绝 SVG（SVG 可内嵌脚本，作为同源资源会绕开 `script-src`）。

验证方式（生产构建后执行）：

```bash
npm run build && npm start
curl -sD - -o /dev/null http://127.0.0.1:3000/zh | grep -i content-security-policy        # 期望：'unsafe-inline'，无 nonce
curl -sD - -o /dev/null http://127.0.0.1:3000/admin/login | grep -i content-security-policy # 期望：nonce-... 'strict-dynamic'
curl -s http://127.0.0.1:3000/admin/login | grep -c 'script[^>]*nonce='                     # 期望：等于 <script> 标签总数
```

## 其他安全响应头

| 头 | 值 | 说明 |
|---|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | 仅生产下发（本地会污染 localhost） |
| `X-Content-Type-Options` | `nosniff` | 全站 |
| `X-Frame-Options` | `SAMEORIGIN` | 与 `frame-ancestors 'self'` 双重保险 |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | 全站 |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | 全站 |
| `Cross-Origin-Opener-Policy` | `same-origin` | 防 `window.opener` 反向操控 |
| `Cache-Control` | `no-store`（`/admin/**`、`/api/v1/admin/**`） | 后台与写接口不得被任何中间层缓存 |

## npm overrides（传递依赖强制提升）

以下漏洞位于传递依赖树深处，直接升级父包会引发 major 变更连锁返工，故用 `overrides` 精准提升：

```json
"overrides": {
  "postcss": "^8.5.32",
  "deepmerge-ts": "^8.0.2"
}
```

- `postcss` — 经 `next@15` 传递。修复版本 8.5.32 修复了 XSS（未转义 `</style>`）与 `sourceMappingURL` 任意文件读取。属**构建期**依赖，但 CSS 由构建产物直接供给浏览器，风险真实存在，故必须修。
- `deepmerge-ts` — 经 `prisma` → `@prisma/config` 传递。修复版本 8.0.2 修复了合并递归对象图时的栈耗尽。属 CLI 工具链依赖。

> 升级 `next` 至 16 后，应重新评估 `postcss` override 是否仍必要。

## 已修复记录

| 包 | 原版本 | 修复版本 | 漏洞 | 处置 |
|---|---|---|---|---|
| `zod` | 3.25.x | 4.6.7 | 超大受约束集合导致内存耗尽 | **运行时漏洞**，admin 写接口直接校验用户输入，必须升级。已加 `scripts/test-zod-behavior.ts` 行为回归测试并接入 CI |
| `postcss` | 8.4.31（经 next） | 8.5.32 | XSS / 任意文件读取 | overrides 提升 |
| `deepmerge-ts` | 7.1.5（经 prisma） | 8.0.2 | 栈耗尽 | overrides 提升 |

## 待办

- **Next 16 升级**：届时一并升级 eslint 生态，消除全部 moderate 条目。（`next lint` 迁移已在 v1.2 交付中完成：`npm run lint` 现为 `eslint . --max-warnings=0`。）
- **引入 osv-scanner**：作为 `npm audit` 的补充，覆盖 npm 之外的生态与更精确的可达性判定。
- **门禁阈值复评**：每季度复查一次 moderate 豁免登记，任一条目命中实际用法即升级为 high 处理。
