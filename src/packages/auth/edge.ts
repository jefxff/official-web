import { jwtVerify } from "jose";

/**
 * 会话校验的 **edge 安全** 版本。
 *
 * 为什么单独拆一个文件：middleware 跑在 Edge Runtime，不能引入 Node 专用依赖。
 * `@fmw/auth` 里同时用了 otplib（Node crypto）与 next/headers，整体 import 进
 * middleware 会把不必要的依赖拖进 edge bundle。这里只依赖 jose，纯 WebCrypto。
 *
 * 为什么中间件也要校验：布局里的 redirect() 属于「渲染之后」的跳转 ——
 * 页面内容仍会被渲染并序列化进 307 响应的 RSC payload，未登录者用一个
 * 普通 HTTP 客户端就能读到后台数据（曾实测 /admin 的 307 响应体里带出完整料号列表，
 * /admin/setup 更是直接带出 TOTP 种子）。鉴权必须前移到渲染之前。
 */

export const ADMIN_COOKIE = "fmw_admin";

/**
 * 注意：Edge Runtime 下 `process.env.*` 在**构建期**被内联，不是运行时读取。
 * 因此 AUTH_SECRET 必须在构建环境里就存在，且「轮换密钥 = 重新构建镜像」；
 * 只在运行时改环境变量不会生效，反而会让中间件与 Node 侧校验结果不一致
 * （表现为登录成功却一直被踢回登录页）。详见 docs/ops-runbook.md。
 */
const AUTH_SECRET = process.env.AUTH_SECRET ?? "dev-only-insecure-secret-change-me";

/** 只做「签名有效且未过期」判定，不解析具体用户（中间件的职责边界）。 */
export async function verifySessionTokenEdge(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, new TextEncoder().encode(AUTH_SECRET));
    return true;
  } catch {
    return false;
  }
}
