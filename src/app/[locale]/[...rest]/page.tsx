import { notFound } from "next/navigation";

/**
 * 语言段下的兜底路由。
 *
 * 没有这个文件时，`/zh/一个打错的路径` 会落到 Next 内置的默认 404 ——
 * 那是一张白底英文页，和整站视觉完全脱节，也丢掉了导航与搜索入口。
 * 这里主动抛 notFound()，让最近的 not-found 边界（[locale]/not-found.tsx）接管，
 * 用户看到的才是有品牌、能继续找东西的 404。
 */
export default function CatchAllPage() {
  notFound();
}
