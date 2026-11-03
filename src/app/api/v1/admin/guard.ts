import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@fmw/auth";

/**
 * 后台写接口统一守卫：
 * 1) 会话校验（TOTP 登录后签发的 JWT Cookie）
 * 2) 仅允许 DATA_SOURCE=db（国内唯一写点，必须有 PostgreSQL）
 *
 * 返回 null 表示通过；返回 NextResponse 表示应直接返回该响应。
 */

export async function requireAdmin(
  req: NextRequest
): Promise<NextResponse | null> {
  const user = await getSession(req);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}

export function requireDbMode(): NextResponse | null {
  if ((process.env.DATA_SOURCE ?? "seed") !== "db") {
    return NextResponse.json(
      {
        error:
          "admin_write_requires_db",
        message:
          "后台写接口仅在 DATA_SOURCE=db（已接入 PostgreSQL）时可用。当前为 seed 只读模式。",
      },
      { status: 503 }
    );
  }
  return null;
}
