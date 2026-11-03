import { authenticator } from "otplib";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

/**
 * 后台管理员认证（v1.2 §6 国内唯一写点 + 评审：TOTP 二步验证）。
 *
 * 设计原则：
 * - 凭据由环境变量注入（生产走密钥管理 / K8s Secret），不在代码或 DB 明文存储。
 * - 登录 = 用户名/密码 + TOTP 动态码，双重校验后签发短时效会话 JWT（httpOnly Cookie）。
 * - 会话为无状态 JWT，便于国内单一写点水平扩展，无需共享会话存储。
 */

const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";
const ADMIN_TOTP_SECRET = process.env.ADMIN_TOTP_SECRET ?? ""; // base32
const AUTH_SECRET =
  process.env.AUTH_SECRET ?? "dev-only-insecure-secret-change-me";
const SESSION_MAX_AGE = 60 * 60 * 8; // 8h
export const ADMIN_COOKIE = "fmw_admin";

authenticator.options = { window: 1 }; // 允许 ±30s 时钟漂移

export function totpEnabled(): boolean {
  return ADMIN_TOTP_SECRET.length > 0;
}

/** 校验 TOTP 动态码；未启用 TOTP 时返回 true（仅密码登录）。 */
export function verifyTotp(code: string): boolean {
  if (!totpEnabled()) return true;
  try {
    return authenticator.verify({ token: code.replace(/\s/g, ""), secret: ADMIN_TOTP_SECRET });
  } catch {
    return false;
  }
}

/** 生成 otpauth URI，供 TOTP 设置页渲染二维码（管理员扫码入手机）。 */
export function buildOtpauthUri(account = ADMIN_USERNAME): string {
  if (!totpEnabled()) return "";
  return authenticator.keyuri("富满微官网", account, ADMIN_TOTP_SECRET);
}

export interface AdminSession {
  user: string;
  iat: number;
  exp: number;
}

export async function createSessionToken(username: string): Promise<string> {
  const secret = new TextEncoder().encode(AUTH_SECRET);
  return new SignJWT({ user: username })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secret);
}

export async function verifySessionToken(token: string): Promise<AdminSession | null> {
  try {
    const secret = new TextEncoder().encode(AUTH_SECRET);
    const { payload } = await jwtVerify(token, secret);
    if (typeof payload.user === "string") {
      return { user: payload.user, iat: payload.iat ?? 0, exp: payload.exp ?? 0 };
    }
    return null;
  } catch {
    return null;
  }
}

/** 从请求 Cookie 读取并校验后台会话，返回用户名或 null。 */
export async function getSession(req: NextRequest): Promise<string | null> {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  const s = await verifySessionToken(token);
  return s ? s.user : null;
}

/** 服务端组件（如后台布局）读取会话，返回用户名或 null。 */
export async function getServerSession(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  const s = await verifySessionToken(token);
  return s ? s.user : null;
}

export const SESSION_AGE_SECONDS = SESSION_MAX_AGE;

/** 核对静态用户名/密码（生产应替换为更安全的凭据存储）。 */
export function verifyCredentials(username: string, password: string): boolean {
  if (!ADMIN_PASSWORD) return false; // 未配置密码则禁止登录
  return username === ADMIN_USERNAME && password === ADMIN_PASSWORD;
}

export { ADMIN_USERNAME, totpEnabled as isTotpEnabled };
