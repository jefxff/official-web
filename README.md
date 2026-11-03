# 富满微官网 (FMW Official Website)

基于《富满微官网开发计划书 v1.2》落地的工程骨架。Next.js 15 App Router + 双语（zh/en）+ 国内/海外双区域部署架构。

> 当前状态：**S0–S5 主体 + 内容运营与运维能力（媒体上传 / CSP / 双语校验 / APM / 拨测）**。已跑通 `dev` / `build` / 生产回归；核心页面、SEO、数据层、双区域构建、缓存失效、后台认证与写接口、发布管线（缓存失效 + 搜索重建）、海外 Worker 回源、AI 助手（槽位填充 + SSE + 会话留存）、媒体上传（本地 / S3 兼容）、分层 CSP、可观测性与双区域拨测均已就位。剩余为**基础设施侧动作**（PG 多可用区 + WAL 归档 + PITR 开通、对象存储版本化、监控告警接线），步骤见 [`docs/ops-runbook.md`](docs/ops-runbook.md)。

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
- **AI 助手**：`@fmw/ai` —— 槽位填充接地（不臆造参数）+ 句子级 SSE 流式 + Provider 抽象（Mock / OpenAI）+ 会话留存（DB 模式多轮上下文，失败自动降级为无状态）
- **媒体存储**：`@fmw/storage` —— 本地磁盘 / S3 兼容对象存储双 provider，魔数校验类型、内容哈希命名、SVG 拒收；SigV4 签名按官方测试向量自校验
- **内容渲染**：`@fmw/markdown` —— 零依赖 Markdown 渲染为 React 元素（不解析原始 HTML，从构造上排除 XSS）
- **内容校验**：`@fmw/i18n-validate` —— 双语字段「漏译 / 中英雷同 / 英文含中文」三类判定，后台可确认放行
- **安全策略**：`@fmw/security` + `middleware.ts` —— 分层 CSP（公开页静态档 / 后台 nonce 严格档）、HSTS、COOP 等响应头
- **可观测性**：`@fmw/observability` —— 结构化 JSON 日志 + `captureException` + Sentry Envelope 直传（零 SDK 依赖、内置限流）
- **海外边缘**：`deploy/worker` —— Cloudflare Worker，缓存 MISS 回落反代国内源站（关闭「新页面 404」缺口）+ 写面屏蔽
- **可用性巡检**：`scripts/probe.ts` —— 双区域拨测（可达 + 内容正确 + 跨区域一致），退出码可直接接告警
- **质量门禁**：`lint`（ESLint CLI）+ `tsc` + 4 组行为回归测试（schema / storage / content / observability）+ `依赖安全门禁` + `build`，GitHub Actions 已配（`.github/workflows/quality.yml`）
- **依赖安全**：分级门禁（high/critical 零豁免强制阻断；moderate 须在 `docs/security-policy.md` 登记并写明判定）

## 目录结构

```
FMW-app/
├─ prisma/
│  ├─ schema.prisma            # 领域模型（产品/系列/资讯，含验证等级）
│  └─ constraint.sql           # DB 层约束（分级验证必填证据）+ 索引，幂等可重跑
├─ messages/{zh,en}.json       # 双语字典
├─ docs/
│  ├─ security-policy.md       # 依赖安全策略 + CSP 分档 + 安全响应头
│  └─ ops-runbook.md           # 运维手册（PG/PITR、对象存储、拨测、APM、故障处置）
├─ scripts/
│  ├─ seed.ts                  # 将 seed JSON 灌入 PG（幂等 upsert）
│  ├─ audit-gate.ts            # 依赖安全分级门禁
│  ├─ probe.ts                 # 双区域拨测（退出码可接告警）
│  ├─ prune-ai-conversations.ts# AI 会话留存清理（定时任务）
│  ├─ test-zod-behavior.ts     # schema 行为回归测试（zod v4 迁移保障）
│  ├─ test-storage.ts          # 媒体存储 + SigV4 签名（官方测试向量）
│  ├─ test-content.ts          # Markdown 渲染 + 双语字段校验
│  └─ test-observability.ts    # Sentry Envelope 上报链路（本地接收校验）
├─ deploy/worker/              # 海外 Cloudflare Worker（回源 + 写面屏蔽）
├─ src/
│  ├─ middleware.ts            # 语言路由 + CSP 分档下发（公开页 / 后台 nonce）
│  ├─ i18n/                    # routing / request 配置
│  ├─ app/
│  │  ├─ [locale]/             # 所有公开页面（首页/产品/料号/系列/新闻/关于/联系/搜索）
│  │  ├─ admin/                # 后台（登录/设置 + (protected) 受保护区）
│  │  ├─ api/v1/
│  │  │  ├─ part/[mpn]/        # P02「URL as API」JSON 接口（独立路径）
│  │  │  ├─ ai/chat/           # AI 助手 SSE 流式接口（feature flag + 限流 + 会话留存）
│  │  │  ├─ media/[...key]/    # 本地媒体出流（immutable 长缓存 + key 白名单）
│  │  │  └─ admin/             # 写接口（login/logout/me/products/series/articles/media）
│  │  ├─ sitemap.ts robots.ts  # SEO
│  ├─ components/              # Header / Footer / 卡片 / AiChat
│  └─ packages/
│     ├─ db/                   # Prisma client 单例
│     ├─ data/                 # 数据访问层（seed 回退 + PG 分支 + 后台双语视图）
│     ├─ auth/                 # TOTP + JWT 会话
│     ├─ search/               # Meilisearch 同步
│     ├─ publish/              # 发布管线（失效 + 索引）
│     ├─ ai/                   # AI 助手（grounding 接地 / provider / sentence 分片 / 会话留存）
│     ├─ storage/              # 媒体存储（local / S3 兼容）+ SigV4 签名
│     ├─ markdown/             # 零依赖 Markdown → React（不解析原始 HTML）
│     ├─ i18n-validate/        # 双语字段完整性判定（漏译 / 雷同 / 含中文）
│     ├─ security/             # CSP 策略构造（静态档 / nonce 档）
│     ├─ observability/        # 结构化日志 + 异常捕获 + Sentry Envelope 上报
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
npm run lint         # ESLint（CLI 模式，覆盖全仓库）
npm test             # 四组行为回归测试（schema / storage / content / observability）
npm run test:schema  # schema 行为回归测试（zod 校验语义）
npm run test:storage # 媒体存储 + SigV4（官方 test vector）
npm run test:content # Markdown 渲染安全边界 + 双语字段校验
npm run test:observability # APM 上报链路
npm run probe        # 双区域拨测（PROBE_CN / PROBE_GLOBAL 或 --cn= / --global=）
npm run prune:ai -- 90     # 清理 90 天未活跃的 AI 会话
npm run audit        # 依赖安全门禁（分级：high 阻断 / moderate 须登记）
npm run prisma:generate   # 生成 Prisma client
npm run seed         # 向 PG 灌入 seed 数据（需 DATABASE_URL）
```

## 依赖安全门禁

`npm run audit` 执行**分级**策略，而非单一的 audit 阈值：

| 等级 | 处置 |
|---|---|
| high / critical | 必须为 0，**无豁免机制**，出现即阻断 CI |
| moderate | 必须在 `docs/security-policy.md` 的 `AUDIT-EXEMPTIONS` 区块登记并写明判定依据；未登记即阻断 |
| 过期登记 | 漏洞已修复但未清理的登记条目，同样阻断（防止清单腐化） |

传递依赖的安全修复通过 `package.json` 的 `overrides` 精准提升（`postcss`、`deepmerge-ts`），避免为此把 next/prisma 升到 major 版本引发连锁返工。完整策略、逐条判定与修复记录见 **[`docs/security-policy.md`](docs/security-policy.md)**。

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
| `MEDIA_STORAGE` | 媒体存储：`local`（默认）或 `s3` | `local` |
| `MEDIA_ROOT` | `local` 模式的落盘目录（多副本须挂共享存储） | `.media/` |
| `NEXT_PUBLIC_MEDIA_BASE` | `local` 模式的对外前缀（CDN 域名，可空=同源） | 空 |
| `S3_ENDPOINT` / `S3_REGION` / `S3_BUCKET` | `s3` 模式对象存储配置 | （无 → 不可用） |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | 对象存储写凭证（只给源站，勿下发前端） | （无 → 不可用） |
| `S3_PUBLIC_BASE` | 对象存储对外访问域名（CDN） | 回落到 endpoint/bucket |
| `LOG_LEVEL` | 结构化日志级别 | `info` |
| `SENTRY_DSN` | APM 上报（Envelope 直传；为空则仅本地日志） | （无 → 关闭） |
| `SENTRY_ENVIRONMENT` / `SENTRY_RELEASE` | Sentry 环境与版本标记 | `NODE_ENV` / （空） |
| `PROBE_CN` / `PROBE_GLOBAL` | 拨测目标域名（也可用 `--cn=` / `--global=`） | （无 → 脚本报错退出） |

## 内容运营（媒体 / Markdown / 双语）

- **媒体上传**：后台表单不再手填 URL，支持直接上传（`POST /api/v1/admin/media`）。类型判定基于**文件头魔数**而非浏览器 MIME；`SVG` 明确拒收（可内嵌脚本，会绕开 CSP）；单文件 ≤ 8MB。出流走 `/api/v1/media/<key>`，key 含内容哈希，下发 `immutable` 长缓存。
- **Markdown**：资讯正文支持标题 / 列表 / 引用 / 代码块 / 加粗 / 行内代码 / 链接，由自研渲染器转成 React 元素。**不解析原始 HTML**，链接只放行 `http(s)` / `mailto` / 站内路径，`javascript:` 与 `data:` 降级为纯文本。
- **双语字段校验**：保存前检查「英文为空 / 中英完全相同 / 英文字段含中文」三类问题。命中时**提示但允许确认放行**（品牌名、料号本就两栏相同，硬阻断会逼出无意义差异）。服务端 zod 错误会按字段回填到对应输入框。

## 安全响应头与 CSP

CSP 由 `middleware.ts` 逐请求下发，按路由分两档（完整取舍理由见 [`docs/security-policy.md`](docs/security-policy.md)）：

| 路由 | `script-src` | 渲染/缓存 |
|---|---|---|
| 公开页 | `'self' 'unsafe-inline'` | SSG/ISR，可被边缘长缓存 |
| `/admin/**` | `'self' 'nonce-<随机>' 'strict-dynamic'` | 强制动态 + `no-store` |

关键取舍：nonce 必须逐请求生成，会迫使页面放弃静态产物，从而让「海外 Worker 边缘缓存回源」的双区域设计失效。因此 nonce 只用于后台；公开页以「不渲染任何用户 HTML」作为补偿控制。

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
- **会话留存与多轮上下文**：SSE 首帧回传 `meta.conversationId`，前端按语言分别存于 `sessionStorage` 并续聊。服务端以库中历史为准（前端传入的 history 仅作无状态降级来源）；会话归属校验防止拿到他人 `conversationId` 读取其对话。**持久化失败只 warn 不阻断**——DB 抖动时自动降级为无状态问答。
- **隐私**：不记录 IP / User-Agent，`clientId` 为随机串；留存期清理见 `npm run prune:ai -- 90`。

## 可观测性与拨测

- `@fmw/observability` 零依赖：结构化 JSON 日志（`ts/level/scope/message`）+ `captureException`（含 stack）+ **Sentry Envelope 直传**（不引 SDK，解析 DSN、构造三行信封、`X-Sentry-Auth`、2s 超时、失败静默、每分钟 20 条限流）。
- 上报链路不靠肉眼保证：`npm run test:observability` 起本地 HTTP 服务**真实接收**信封，逐项断言端点、头部、event_id、栈帧 `in_app` 与限流行为。
- **双区域拨测**：`npm run probe` 检查两个区域的可达性、内容正确性（关键字/JSON 结构，防 CDN 200 错误页）与跨区域一致性，未知料号必须 404；退出码可直接接告警。

## 已知问题与修复记录

- **客户端翻译退化为键名（已修复）**：next-intl v3 下 `NextIntlClientProvider` 未显式传 `messages` 时，客户端组件（Header 导航、Footer、联系表单、后台 UI、AI 助手）会直接渲染 `nav.products` 这类键名。现已在 `[locale]/layout.tsx` 用 `getMessages()` 显式下发全部文案。**后续新增客户端组件时注意此约束。**
- **后台编辑会覆盖英文文案（已修复）**：编辑页原先用 `getProductByMpn(mpn, "zh")`，把中文字段同时填进 `nameEn/summaryEn/descriptionEn`，保存即把英文覆盖为中文。现改用 `getProductAdminView()` 一次取全中英字段。
- **验证证据仅中文（已补齐）**：`verifiedEvidence` 现配 `verifiedEvidenceEn`；前台按 locale 选取，英文缺失时回落中文原文（不出现空白），后台表单可分别填写。
- **Prisma `@@check` 语法**：当前 Prisma 版本不支持 `@@check` 属性，分级验证约束改由 `prisma/constraint.sql` 以原生 SQL 落地（幂等可重跑）。
- **构建需在沙箱外执行**：清理 `.next` 会触发环境的批量删除安全阈值拦截，属环境限制而非代码问题。
- **`next lint` 已弃用（已迁移）**：`next lint` 在 Next 15.5 标记弃用、Next 16 将移除。已提前迁至 ESLint CLI（`npm run lint` = `eslint . --max-warnings=0`），配置沿用现有 flat config。顺带修复了 `next lint` 覆盖不到的问题：`deploy/worker/src/worker.js` 的匿名默认导出、测试脚本的未使用变量；`next-env.d.ts`（Next 自动生成）已加入忽略列表。**升 Next 16 时 CI 无需再处理此项。**
- **zod 已升级至 v4**：`zod@4.6.7` 修复了「超大受约束集合导致内存耗尽」漏洞（该漏洞命中后台写接口的运行时校验路径，属真实可利用风险）。v4 保留了本项目用到的全部 API 兼容层，行为回归由 `npm run test:schema`（24 项断言）保障并已接入 CI。
- **`npm audit` 分级门禁**：单一 `--audit-level=high` 阈值在多次误报后容易被团队习惯性绕过，现改为三级门禁（见上）。
- **Docker 镜像缺 `server.js`（已修复）**：Dockerfile 复制 `.next/standalone`，但 `next.config.ts` 原先未开 `output: "standalone"`，该目录根本不会生成——镜像能构建成功、启动即失败。现已在配置中开启，并在镜像内预建 `MEDIA_ROOT`（`/app/.media`）并授权，避免编辑上传 EACCES。
- **资讯正文「支持 Markdown」但实际不渲染（已修复）**：前台原先直接输出 `{article.body}`，编辑写的 `##`、列表、链接全成符号。现由 `@fmw/markdown` 渲染；该渲染器不解析原始 HTML，因此**不能**再依赖「正文里写 HTML」实现排版。
- **CSP 未做全站 nonce（有意取舍）**：nonce 会强制动态渲染，与双区域边缘缓存冲突。后台用 nonce 严格档，公开页用 `'unsafe-inline'` + 「不渲染用户 HTML」补偿。详见 `docs/security-policy.md`。

**已实现**：S0–S1 全部；S2 后台认证（TOTP）、国内唯一写点（产品/系列/资讯 CRUD 写接口 + 后台 UI）、发布管线（缓存失效 + 搜索重建）、海外 Worker 回源、DB 层分级验证约束、种子脚本；S5 的 P24 AI 助手（槽位填充接地 + 句子级 SSE + 双端 feature flag + Mock/OpenAI Provider + 会话留存/多轮上下文）；**内容运营**（媒体上传 local/S3、Markdown 渲染、双语字段校验、后台逐字段错误定位）；**安全**（分层 CSP、HSTS/COOP 等响应头、后台与写接口 no-store）；**可观测与巡检**（Sentry Envelope 上报、双区域拨测、四组行为回归测试接入 CI）。

**剩余（基础设施侧，非代码）**：PG 多可用区 + WAL 归档 + PITR 开通与恢复演练、对象存储版本控制与生命周期策略、监控告警通道接线（拨测与 Sentry 告警规则）、CDN 侧规则复核（排除 `/admin`、`/api/v1/admin`）。操作步骤见 [`docs/ops-runbook.md`](docs/ops-runbook.md)。

详见会话中给出的《v1.2 专业评审意见》——其中三个 S0 必验技术陷阱（海外新页面可达性、Server Action 反代路径、Accept 头缓存）已通过架构选择规避：海外回源由 Worker 负责、全站写接口走显式 Route Handler、JSON 接口用独立路径。
