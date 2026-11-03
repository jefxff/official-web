import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "src/packages/db/generated/**",
      // Next 自动生成，不可编辑
      "next-env.d.ts",
      // 构建产物
      "out/**",
      "dist/**",
    ],
  },
];

export default eslintConfig;
