/**
 * AI 会话留存清理（运维定时任务）。
 *
 * 用法：npm run prune:ai -- 90     # 清理 90 天前最后活跃的会话（级联删除消息）
 *
 * 只在 DATA_SOURCE=db 且配置 DATABASE_URL 时生效；其它情况直接退出成功，
 * 便于直接挂到 cron / 定时任务而不必区分环境。
 */
import { aiPersistenceEnabled, pruneConversations } from "../src/packages/ai/persistence";

async function main() {
  const days = Number(process.argv[2] ?? "90");
  if (!Number.isFinite(days) || days <= 0) {
    console.error("留存天数必须是正整数，例如：npm run prune:ai -- 90");
    process.exit(1);
  }

  if (!aiPersistenceEnabled()) {
    console.log("当前非 db 模式（或未配置 DATABASE_URL），无需清理。");
    return;
  }

  const removed = await pruneConversations(days);
  console.log(`已清理 ${removed} 个早于 ${days} 天未活跃的 AI 会话。`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
