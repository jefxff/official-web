# 运维手册（Ops Runbook）

面向「已上线后的日常运维 + 故障处置」。架构决策与安全策略分别见 `README.md` 与 `docs/security-policy.md`，本文只写**怎么做**。

## 1. 拓扑与职责边界

```
访客 ──► CDN（国内：阿里云 CDN / 海外：Cloudflare）
           │  命中：直接返回（静态产物，长缓存）
           ▼  MISS
   ┌───────────────────┐        ┌──────────────────────┐
   │ 国内源站（唯一写点）│        │ 海外 Cloudflare Worker│
   │ Next standalone    │◄───────│ 缓存 MISS 回源国内源站 │
   │ Prisma → PG        │  反代   │ 屏蔽 /admin 与写接口   │
   └───────────────────┘        └──────────────────────┘
        │            │
        ▼            ▼
   PostgreSQL   Meilisearch / 对象存储、媒体
```

三条硬约束，运维动作不得违背：

1. **写只发生在国内源站**。海外节点没有数据库连接串，任何「在海外改配置写库」的做法都会导致数据分叉。
2. **公开页面必须是静态产物**。CSP 的 nonce 档只在后台启用，公开页一旦被改成动态渲染，边缘缓存收益消失（理由见 `docs/security-policy.md`）。
3. **后台与写接口不进 CDN 缓存**。`/admin/**`、`/api/v1/admin/**` 已下发 `no-store`，若 CDN 侧另有缓存规则，必须把这两个前缀排除。

## 2. 发布与回滚

```bash
# 1) 质量门禁（CI 已跑，本地复现用）
npm run typecheck && npm run lint && npm test && npm run audit

# 2) 构建镜像（cn 为国内源站，global 为海外只读节点）
docker build -t fmw-web:$(git rev-parse --short HEAD) --build-arg BUILD_TARGET=cn .

# 3) 数据库变更（仅国内源站，且必须先于应用启动）
npx prisma migrate deploy
psql "$DATABASE_URL" -f prisma/constraint.sql   # 幂等，可重复执行

# 4) 起服务（standalone）
docker run -d --name fmw-web -p 3000:3000 --env-file .env.production fmw-web:<tag>
```

- **回滚**：`docker run` 上一个 tag 即可，数据库变更只做向前兼容（新增列可空、不删列），保证旧镜像仍能运行。
- **缓存**：发布后由 `@fmw/publish` 自动按 URL 失效；若发现旧页面残留，用 `CF_ZONE_ID` / `CF_API_TOKEN` 手工 Purge 对应 URL，不要整站 Purge（会打穿回源）。
- **验证**：发布后立即跑拨测（见 §5），失败则回滚，不要在线调试。
- **AUTH_SECRET 必须构建期注入**：`middleware.ts` 跑在 Edge Runtime，其中 `process.env.AUTH_SECRET`
  在**构建时被内联**。只在容器运行期改环境变量不会生效，还会造成「中间件认为未登录、Node 侧认为已登录」
  ——表现为登录成功后立刻被踢回登录页。**轮换密钥 = 重新构建镜像**，并让新老会话自然过期（8h）。

## 3. PostgreSQL

### 3.1 高可用与备份

| 项 | 要求 | 说明 |
|---|---|---|
| 部署形态 | 主备多可用区（同地域 ≥2 AZ），自动故障切换 | 单机 PG 不满足官网可用性目标 |
| 备份 | 每日全量 + WAL 连续归档 | 备份与实例**不同地域**存放 |
| PITR | 保留 ≥ 7 天，目标 RPO ≤ 5 分钟 | 误删内容 / 错误批量写入的主要兜底 |
| 演练 | 每季度一次恢复演练 | 未演练过的备份视为「没有备份」 |
| 连接 | 应用侧连接池上限 ≤ PG `max_connections` 的 60% | Prisma 默认连接数偏高，多副本时要显式限制 |

恢复演练步骤（在隔离环境做，禁止直接对生产库执行）：

```bash
# 1) 恢复到新实例的指定时间点（以云厂商控制台/CLI 为准）
# 2) 校验关键表行数与最新更新时间
psql "$RESTORE_URL" -c 'select count(*) from "Product"; select max("updatedAt") from "Product";'
# 3) 应用指向新实例验证读路径，再切换流量
```

### 3.2 数据约束（不要绕过）

- `verificationLevel` 为 `BENCH_TESTED` / `CERTIFIED` 时**必须有** `verifiedEvidence`，由应用层（zod refine）+ DB 层（`prisma/constraint.sql` 的 `chk_verified_evidence`）双重保障。
- 迁移后必须重跑 `npm run db:constraint`：`prisma migrate` 只建表，不建这条 CHECK 约束。
- 新增环境初始化顺序固定为：`migrate deploy` → `db:constraint` → `seed`。

## 4. 对象存储与媒体

媒体有两种落地方式，由 `MEDIA_STORAGE` 决定：

| 模式 | 适用 | 注意 |
|---|---|---|
| `local`（默认） | 单副本国内源站 | 落盘到 `MEDIA_ROOT`；多副本必须挂共享存储，否则 A 副本上传的图在 B 副本 404 |
| `s3` | 多副本 / 大流量 | S3 兼容（OSS / COS / MinIO），走 SigV4 直传，对外走 CDN 域名 |

```bash
# 切换到对象存储（改完需重启）
MEDIA_STORAGE=s3
S3_ENDPOINT=https://oss-cn-shenzhen.aliyuncs.com
S3_REGION=cn-shenzhen
S3_BUCKET=fmw-media
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_PUBLIC_BASE=https://cdn.fmw.example      # 对外可访问的 CDN 域名
```

存储侧必须开启：

- **版本控制（Versioning）**：误删/误覆盖可回滚；配合生命周期规则保留 30~90 天历史版本。
- **公共读 + 写私有**：写操作只允许源站 AK 完成，桶策略禁止匿名 PUT。
- **CDN 回源鉴权**：若开启「私有桶 + 回源鉴权」，源站签名密钥与 CDN 侧要同步轮换。

上传限制（代码内固定，改动需评审）：≤ 8MB；仅 JPG / PNG / WebP / GIF / PDF；**拒绝 SVG**（可内嵌脚本）。类型判定基于文件头魔数，不信任浏览器上报的 MIME。

## 5. 双区域拨测

```bash
PROBE_CN=https://www.fmw.cn PROBE_GLOBAL=https://www.fmw.com npm run probe
npm run probe -- --json        # 机器可读，接告警平台
```

- 检查项：可达（200）、内容正确（关键字/JSON 结构）、跨区域均有内容；未知料号必须返回 404。
- 退出码：`0` 全通过；`1` 有失败项 —— 可直接用于 cron / 监控告警。
- 建议频率：核心页面 1 分钟一次，全量 5 分钟一次；连续 2 次失败才告警，避免抖动误报。
- **常见误判**：CDN 返回 200 的错误页。脚本已通过关键字校验规避；新增页面时记得同步补充 `mustContain`。

## 6. APM（Sentry）

```bash
SENTRY_DSN=https://<key>@<org>.ingest.sentry.io/<project>
SENTRY_ENVIRONMENT=production          # 建议按区域区分：production-cn / production-global
SENTRY_RELEASE=<git sha>
```

- 实现为 Envelope HTTP 直传（`src/packages/observability/sentry.ts`），**无 SDK 依赖**；上报失败静默，不影响业务。
- 内置限流：每进程每分钟最多 20 条事件，异常风暴不会打满配额；被限流的事件在本地结构化日志里仍有记录。
- 建议告警规则：`ai.chat`、`media.upload`、`publish` 三个 scope 任一在 5 分钟内 ≥ 3 条即告警。
- 日志：stdout 为 JSON 行（`ts/level/scope/message`），由容器日志采集送 Loki / SLS；`LOG_LEVEL=info` 为生产默认。

## 7. AI 会话留存

- 会话内容存于 `AiConversation` / `AiMessage`，不记录 IP 与 User-Agent。
- 留存期由业务确认（默认建议 90 天），定时清理：

```bash
# 每天 03:00 清理 90 天未活跃会话（级联删除消息）
0 3 * * * cd /app && npm run prune:ai -- 90
```

- 非 db 模式（`DATA_SOURCE=seed`）或未配置 `DATABASE_URL` 时，该命令直接成功退出，可安全常驻。
- 合规提示：AI 对话可能包含访客自填的业务信息，若涉及个人信息，留存期须与隐私政策一致。

## 8. 故障处置

| 症状 | 优先排查 | 处置 |
|---|---|---|
| 海外访问新页面 404 | Worker 是否已发版、`ORIGIN_HOST` 是否指向国内源站 | 发版 Worker；确认 `/admin`、`/api/v1/admin` 被屏蔽 |
| 页面内容陈旧 | 写操作后 Purge 是否成功（看 `publish` 告警） | 手工按 URL Purge；检查 `CF_ZONE_ID`/`CF_API_TOKEN` 是否过期 |
| 后台打不开 / 登录后立刻回登录页 | `AUTH_SECRET` 是否变更导致旧 Cookie 失效；`/admin` 是否被 CDN 缓存 | 重新登录；确认 `no-store` 生效 |
| 后台脚本全被阻断（控制台 CSP 报错） | 后台是否被误改为静态渲染（nonce 前提） | 恢复 `src/app/admin/layout.tsx` 的 `force-dynamic` |
| 编辑上传 500 | `MEDIA_ROOT` 权限；S3 凭证/时钟偏移 | `chown` 目录；S3 签名对时间敏感，校正 NTP |
| 上传成功但图片 404 | 多副本未挂共享存储 | 改 `MEDIA_STORAGE=s3` 或挂 NFS |
| AI 助手报「暂时无法回答」 | `AI_LLM_API_KEY` 是否有效、上游是否限流 | 上游异常会自动降级为接地答案；持续失败可先 `AI_ASSISTANT_ENABLED=false` |
| AI 回答没上下文（每次都是新对话） | `DATA_SOURCE` 是否为 `db`、DB 是否可达 | 持久化失败只告警不阻断，看 `ai` scope 的 warn 日志 |
| 全站 502 | 源站进程存活、PG 连接数、内存 | 重启副本；`no-store` 页面的 502 一般是应用未起 |

## 9. 上线前检查清单

- [ ] `npm test` 全绿（schema / storage / content / observability 四组）
- [ ] `npm run audit` 通过（high 为 0，moderate 已登记）
- [ ] `AUTH_SECRET`、`ADMIN_PASSWORD`、`ADMIN_TOTP_SECRET` 全部替换为生产值
- [ ] 数据库已开启多可用区 + WAL 归档，PITR 可查
- [ ] 对象存储已开版本控制，媒体路径可访问
- [ ] CDN 已排除 `/admin`、`/api/v1/admin` 缓存
- [ ] 拨测双区域全绿，告警通道已接通
- [ ] `SENTRY_DSN` 配置完成，测试事件能在 Sentry 看到
- [ ] AI 会话清理定时任务已挂（若启用 AI 助手）
