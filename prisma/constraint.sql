-- 富满微官网 · 数据库层约束（v1.2 §8 分级验证 + 评审意见落地）
--
-- 背景：分层验证制度是合规卖点，约束应放在离数据最近的一层（DB），
-- 以覆盖应用层漏网（脚本导入、历史数据修复等）。Prisma 当前版本对 @@check
-- 属性支持有差异，故在迁移之外用原生 SQL 落地，保持幂等、可重复执行。
--
-- 用法（在 `prisma migrate dev/deploy` 生成基础表结构之后执行）：
--   psql "$DATABASE_URL" -f prisma/constraint.sql
-- 或在 CI 发布脚本中调用。

-- 1) 分级验证约束：达到实测(BENCH_TESTED)/认证(CERTIFIED)等级必须填写验证证据。
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_verified_evidence'
  ) THEN
    ALTER TABLE "Product" ADD CONSTRAINT "chk_verified_evidence"
      CHECK (
        "verificationLevel" IN ('INTERNAL', 'DATASHEET')
        OR "verifiedEvidence" IS NOT NULL
      );
  END IF;
END $$;

-- 2) 索引加速（料号/系列/分类/发布时间常用查询）。
CREATE INDEX IF NOT EXISTS "Product_seriesId_idx" ON "Product" ("seriesId");
CREATE INDEX IF NOT EXISTS "Product_category_idx" ON "Product" ("category");
CREATE INDEX IF NOT EXISTS "Article_publishedAt_idx" ON "Article" ("publishedAt" DESC);
