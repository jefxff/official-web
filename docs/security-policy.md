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

- **Next 16 升级**：届时一并升级 eslint 生态，消除全部 moderate 条目。注意 `next lint` 在 Next 15.5 已弃用、Next 16 将移除，需迁至 ESLint CLI（`npx @next/codemod@canary next-lint-to-eslint-cli .`），否则升版后 CI 直接失败。
- **引入 osv-scanner**：作为 `npm audit` 的补充，覆盖 npm 之外的生态与更精确的可达性判定。
- **门禁阈值复评**：每季度复查一次 moderate 豁免登记，任一条目命中实际用法即升级为 high 处理。
