import { NextResponse, type NextRequest } from "next/server";
import { readMedia } from "@fmw/storage";

export const runtime = "nodejs";

/**
 * 本地 provider 的媒体出流：GET /api/v1/media/media/2026/11/<hash>-<slug>.<ext>
 *
 * 为什么不直接写 `public/`：
 *  1. 生产镜像（standalone）与 CDN 回源不保证能看到构建后新增的文件；
 *  2. 走路由可以显式下发 `immutable` 长缓存，命中 CDN 后不再回源；
 *  3. key 由服务端生成并做正则校验，天然阻断路径穿越。
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const { key } = await params;
  const found = await readMedia(key.join("/"));
  if (!found) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(found.buffer), {
    status: 200,
    headers: {
      "Content-Type": found.mime,
      "Content-Length": String(found.buffer.byteLength),
      // key 含内容哈希，内容不可变，可安全长缓存。
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      // 图片/PDF 内联展示，但禁止被当作脚本执行（配合 nosniff）。
      "Content-Disposition": "inline",
    },
  });
}
