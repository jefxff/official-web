# 富满微官网 (FMW Official Website)

基于《富满微官网开发计划书 v1.2》落地的工程骨架。Next.js 15 App Router + 双语（zh/en）+ 国内/海外双区域部署架构。

> 当前状态：**基础骨架 + S2 国内唯一写点闭环 + S5 AI 助手（P24，含功能开关）**。已跑通 `dev` / `build` / 生产冒烟测试；核心页面、SEO、数据层、双区域构建、缓存失效、后台认证与写接口、发布管线（缓存失效 + 搜索重建）、海外 Worker 回源、AI 助手（槽位填充 + SSE）与可观测性底座均已就位。PG 多可用区 + PITR、CSP nonce、拨测与真实 APM 接入仍为后续阶段工作。

## 技术栈

- **框架**：Next.js 15.5（App Router, RSC, ISR/SSG）
- **语言**：TypeScript（strict），React 19.2
- **样式**：Tailwind CSS v4（品牌色板见 `src/app/globals.css`）
- **国际化**：next-intl 3.26，`/[locale]` 目录式路由（zh / en），自动 hreflang
- **数据**：Prisma 6 + PostgreSQL（国内唯一写点）；未配置 DB 时回退本地 seed JSON，保证开箱即渲染
- **缓存失效**：`packages/cache-invalidate` —— Cloudflare Purge by URL，tag→URL 集中映射
- **搜索**：`packages/search` —— Meilisearch 同步（env 网关，未配置 no-op）
- **发布管线**：`packages/publish` —— 写后联动「边缘缓存失效 + 搜索索引重建」
- **后台认证**：`@fmw/auth` —— 用户名/密码 + TOTP 二步验证，无状态 JWT 会话 Cookie
- **AI 助手**：`@fmw/ai` —— 槽位填充接地（不臆造参数）+ 句子级 SSE 流式 + Provider 抽象（Mock / OpenAI）
- **可观测性**：`@fmw/observability` —— 结构化 JSON 日志 + `captureException`（预留 Sentry 扩展点）
- **海外边缘**：`deploy/worker` —— Cloudflare Worker，缓存 MISS 回落反代国内源站（关闭「新页面 404」缺口）+ 写面屏蔽
- **质量门禁**：`lint` + `tsc` + `npm audit` + `build`，GitHub Actions 已配（`.github/workflows/quality.yml`）

## 目录结构

```
FMW-app/
├─ prisma/
│  ├─ schema.prisma            # 领域模型（产品/系列/资讯，含验证等级）
│  └─ constraint.sql           # DB 层约束（分级验证必填证据）+ 索引，幂等可重跑
├─ messages/{zh,en}.json       # 双语字典
├─ scripts/seed.ts             # 将 seed JSON 灌入 PG（幂等 upsert）
├─ deploy/worker/              # 海外 Cloudflare Worker（回源 + 写面屏蔽）
├─ src/
│  ├─ middleware.ts            # 语言重定向（已排除 /api、/admin）
│  ├─ i18n/                    # routing / request 配置
│  ├─ app/
│  │  ├─ [locale]/             # 所有公开页面（首页/产品/料号/系列/新闻/关于/联系/搜索）
│  │  ├─ admin/                # 后台（登录/设置 + (protected) 受保护区）
│  │  ├─ api/v1/
│  │  │  ├─ part/[mpn]/        # P02「URL as API」JSON 接口（独立路径）
│  │  │  ├─ ai/chat/           # AI 助手 SSE 流式接口（feature flag + 限流）
│  │  │  └─ admin/             # 写接口（login/logout/me/products/series/articles）
│  │  ├─ sitemap.ts robots.ts  # SEO
│  ├─ components/              # Header / Footer / 卡片 / AiChat
│  └─ packages/
│     ├─ db/                   # Prisma client 单例
│     ├─ data/                 # 数据访问层（seed 回退 + PG 分支 + 后台双语视图）
│     ├─ auth/                 # TOTP + JWT 会话
│     ├─ search/               # Meilisearch 同步
│     ├─ publish/              # 发布管线（失效 + 索引）
│     ├─ ai/                   # AI 助手（grounding 接地 / provider / sentence 分片）
│     ├─ observability/        # 结构化日志 + 异常捕获
│     ├─ seo/                  # Metadata 构造器
│     └─ cache-invalidate/     # Cloudflare 失效（tag→URL 集中映射）
├─ Dockerfile                  # 国内节点 standalone 镜像（支持 cn/global 双目标）
└─ .github/workflows/quality.yml
```

## 常用脚本

```bash
npm run dev          # 开发
npm run build        # 生产构建（默认 cn 目标）
npm run start        # 启动生产服务
npm run typecheck    # 类型检查
npm run lint         # ESLint
npm run prisma:generate   # 生成 Prisma client
npm run seed         # 向 PG 灌入 seed 数据（需 DATABASE_URL）
```

## 环境变量

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL 连接串（写库） | （无 → 走 seed） |
| `DATA_SOURCE` | `seed`（默认）或 `db` | `seed` |
| `BUILD_TARGET` | `cn`（默认）或 `global` | `cn` |
| `NEXT_PUBLIC_SITE_URL` | 当前区域对外域名（canonical/sitemap/OGP） | `https://www.fmw.example` |
| `NEXT_PUBLIC_ASSET_PREFIX` | CDN 资源前缀（global 走 CF） | 空 |
| `CF_ZONE_ID` / `CF_API_TOKEN` | Cloudflare 失效凭证（仅 global 需要） | （无 → no-op） |
| `MEILI_HOST` / `MEILI_API_KEY` | Meilisearch 同步（可选） | （无 → no-op） |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | 后台登录凭据 | `admin` / （空=禁止登录） |
| `ADMIN_TOTP_SECRET` | TOTP base32 密钥（设后立即启用二步验证） | （无 → 仅密码） |
| `AUTH_SECRET` | 会话 JWT 签名密钥（**生产必须替换**） | 开发默认值 |
| `AI_ASSISTANT_ENABLED` | AI 助手服务端开关（false → 接口 503） | `true` |
| `NEXT_PUBLIC_AI_ASSISTANT_ENABLED` | AI 助手前端显隐 | `true` |
| `AI_LLM_API_KEY` | LLM 供应商密钥（不配置则回退 Mock，接地作答、无外网依赖） | （无 → Mock） |
| `AI_LLM_BASE_URL` / `AI_LLM_MODEL` | OpenAI 兼容端点与模型 | `https://api.openai.com/v1` / `gpt-4o-mini` |
| `LOG_LEVEL` | 结构化日志级别 | `info` |
| `SENTRY_DSN` | APM 上报（预留扩展点，接入需在 observability 包内 hook） | （无 → 仅本地日志） |

## 接入真实 PostgreSQL

1. 设置 `DATABASE_URL` 与 `DATA_SOURCE=db`
2. `npx prisma migrate dev` 建表（基础表结构）
3. `npm run db:constraint` 落地 DB 层约束 `chk_verified_evidence`（分级验证必填证据）+ 索引
4. `npm run seed` 灌入示例数据
5. 设好 `ADMIN_PASSWORD` 与 `ADMIN_TOTP_SECRET`，访问 `/admin` 即可管理内容

## 后台与发布链路（S2 落地）

- **鉴权**：`/admin/login` 走用户名/密码 + TOTP 双重校验，签发 httpOnly JWT Cookie；`/admin/(protected)/` 下所有页面与 `/api/v1/admin/*` 写接口均校验会话。登录页与 TOTP 设置页位于公开区，避免重定向死循环。
- **国内唯一写点**：所有写请求经 `/api/v1/admin/*` 落到国内 PostgreSQL（Prisma）。seed 只读模式下写接口返回 `503` 明确拒绝。
- **发布管线**：写成功后统一触发 `publish` → Cloudflare 按 URL 失效（双语）+ Meilisearch 索引重建，二者任一方失败只告警不阻断。
- **海外可达性**：`deploy/worker` 在边缘缓存 MISS 时回落反代国内源站（关闭「新页面 404」缺口），并屏蔽 `/admin`、`/api/v1/admin` 公网暴露。

## AI 助手（P24，可作上线后 M1 增量）

- **槽位填充接地**：v1.2 把「AI 数值校验」改为槽位填充——`@fmw/ai/grounding` 从**已验证产品库**（seed / PG）抽取真实字段填充回答模板，AI 不产生任何电气数值。查不到的料号如实回答「未收录」，不猜测。
- **Provider 抽象**：`MockProvider`（默认，零外网，句子级分片模拟流式）↔ `OpenAIProvider`（`AI_LLM_API_KEY` 存在时启用，系统提示强制「只使用已验证事实」，上游异常自动降级为接地答案）。切换只需配 env，不改业务代码。
- **SSE 流式**：`/api/v1/ai/chat` 以**完整句子**为最小单元下发（`@fmw/ai/sentence`），规避「流式中途丢句撕裂 Markdown / 表格」的问题；`.` 仅在句末断句，不误拆小数（`2.2V`）与 URL。
- **功能开关**：`AI_ASSISTANT_ENABLED=false` → 接口 503；`NEXT_PUBLIC_AI_ASSISTANT_ENABLED=false` → 不渲染悬浮组件。两者独立，上线前可只关前端。
- **护栏**：入参 zod 校验 + 单实例内存限流（20 次/分钟/IP，多实例需换 Redis / KV）。

## 可观测性底座

- `@fmw/observability` 零依赖：结构化 JSON 日志（`ts/level/scope/message`）+ `captureException`（含 stack）。接入真实 APM（Sentry 等）只需在包内 hook，业务代码零改动。
- 已接入 AI 路由与发布管线告警路径；后续补齐「国内 / 海外双区域拨测 + 日志聚合」。

## 已知问题与修复记录

- **客户端翻译退化为键名（已修复）**：next-intl v3 下 `NextIntlClientProvider` 未显式传 `messages` 时，客户端组件（Header 导航、Footer、联系表单、后台 UI、AI 助手）会直接渲染 `nav.products` 这类键名。现已在 `[locale]/layout.tsx` 用 `getMessages()` 显式下发全部文案。**后续新增客户端组件时注意此约束。**
- **后台编辑会覆盖英文文案（已修复）**：编辑页原先用 `getProductByMpn(mpn, "zh")`，把中文字段同时填进 `nameEn/summaryEn/descriptionEn`，保存即把英文覆盖为中文。现改用 `getProductAdminView()` 一次取全中英字段。
- **验证证据仅中文（已补齐）**：`verifiedEvidence` 现配 `verifiedEvidenceEn`；前台按 locale 选取，英文缺失时回落中文原文（不出现空白），后台表单可分别填写。
- **Prisma `@@check` 语法**：当前 Prisma 版本不支持 `@@check` 属性，分级验证约束改由 `prisma/constraint.sql` 以原生 SQL 落地（幂等可重跑）。
- **构建需在沙箱外执行**：清理 `.next` 会触发环境的批量删除安全阈值拦截，属环境限制而非代码问题。
- **`next lint` 已弃用**：Next 15.5 起 `next lint` 标记弃用（Next 16 将移除）。升级到 ESLint CLI（`npx @next/codemod@canary next-lint-to-eslint-cli`）需在 S0 的 Next 16 兼容性 spike 一并处理，避免升版时 CI 直接失败。

**已实现**：S0–S1 全部；S2 后台认证（TOTP）、国内唯一写点（产品/系列/资讯 CRUD 写接口 + 后台 UI）、发布管线（缓存失效 + 搜索重建）、海外 Worker 回源、DB 层分级验证约束、种子脚本；S5 的 P24 AI 助手（槽位填充接地 + 句子级 SSE + 双端 feature flag + Mock/OpenAI Provider）；可观测性底座（结构化日志 + 异常捕获）。

**后续阶段**：PG 多可用区 + PITR + OSS 版本化、CSP 与 Next 内联脚本 nonce 方案、双区域拨测与真实 APM 接入、S2 写接口的媒体资源上传与字段级国际化校验、AI 助手的会话持久化与多轮上下文检索（当前 history 仅随请求传递）。

详见会话中给出的《v1.2 专业评审意见》——其中三个 S0 必验技术陷阱（海外新页面可达性、Server Action 反代路径、Accept 头缓存）已通过架构选择规避：海外回源由 Worker 负责、全站写接口走显式 Route Handler、JSON 接口用独立路径。
