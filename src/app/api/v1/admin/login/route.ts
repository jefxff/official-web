import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_COOKIE,
  SESSION_AGE_SECONDS,
  createSessionToken,
  verifyCredentials,
  verifyTotp,
  totpEnabled,
} from "@fmw/auth";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    username?: string;
    password?: string;
    totp?: string;
  };

  if (!verifyCredentials(body.username ?? "", body.password ?? "")) {
    return NextResponse.json(
      { error: "invalid_credentials", message: "用户名或密码错误" },
      { status: 401 }
    );
  }

  if (totpEnabled() && !verifyTotp(body.totp ?? "")) {
    return NextResponse.json(
      { error: "invalid_totp", message: "动态验证码错误" },
      { status: 401 }
    );
  }

  const token = await createSessionToken(body.username ?? "admin");
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_AGE_SECONDS,
  });
  return res;
}
