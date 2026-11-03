import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // 跳过 API、后台管理区、_next 内部资源、静态文件
  matcher: ["/((?!api|admin|_next|_vercel|.*\\..*).*)"],
};
