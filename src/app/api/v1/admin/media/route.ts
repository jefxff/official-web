import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin, requireDbMode } from "../guard";
import { MAX_MEDIA_BYTES, saveMedia } from "@fmw/storage";
import { captureException, logger } from "@fmw/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 媒体上传接口：POST /api/v1/admin/media  (multipart/form-data, 字段名 file)
 *
 * 与其它写接口保持同一约束：必须登录会话 + DATA_SOURCE=db。
 * 先看 Content-Length 再把 body 读进内存——否则一个 500MB 的请求会直接把 Node 进程打挂。
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth) return auth;
  const modeGuard = requireDbMode();
  if (modeGuard) return modeGuard;

  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_MEDIA_BYTES + 1024 * 64) {
    return NextResponse.json(
      {
        error: "payload_too_large",
        message: `文件超过 ${Math.round(MAX_MEDIA_BYTES / 1024 / 1024)}MB 上限`,
      },
      { status: 413 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "invalid_form", message: "请求必须是 multipart/form-data" },
      { status: 400 }
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "missing_file", message: "缺少 file 字段" },
      { status: 400 }
    );
  }
  if (file.size > MAX_MEDIA_BYTES) {
    return NextResponse.json(
      {
        error: "payload_too_large",
        message: `文件超过 ${Math.round(MAX_MEDIA_BYTES / 1024 / 1024)}MB 上限`,
      },
      { status: 413 }
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const stored = await saveMedia({ buffer, filename: file.name });
    logger.info("media", "uploaded", {
      key: stored.key,
      size: stored.size,
      provider: stored.provider,
    });
    return NextResponse.json({ ok: true, item: stored }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "上传失败";
    // 校验类失败是预期的用户错误，不当作异常上报；其余按异常处理。
    if (/不支持|SVG|上限|空文件/.test(message)) {
      return NextResponse.json({ error: "invalid_file", message }, { status: 400 });
    }
    captureException(err, "media.upload");
    return NextResponse.json(
      { error: "storage_failed", message: "存储写入失败，请检查对象存储配置" },
      { status: 500 }
    );
  }
}
