import { defineRouting } from "next-intl/routing";
import { createNavigation } from "next-intl/navigation";

/**
 * 双语路由（v1.2 §7 / §9 双语策略）。
 * 默认 zh；en 为镜像。目录式路由 /zh /en，根路径重定向到默认语言。
 */
export const routing = defineRouting({
  locales: ["zh", "en"],
  defaultLocale: "zh",
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];

export const localeNames: Record<Locale, string> = {
  zh: "简体中文",
  en: "English",
};

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
