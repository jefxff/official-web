# 富满微官网 — 国内节点部署镜像（v1.2 §11）
# 采用 Next.js standalone 输出，体积更小、启动更快。
FROM node:22-alpine AS base
RUN corepack enable

# ---- deps ----
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# ---- builder ----
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# 生成 Prisma client（无 DB 连接也能生成）
RUN npx prisma generate
# 双区域构建：默认 cn；构建 global 镜像时传入 --build-arg BUILD_TARGET=global
ARG BUILD_TARGET=cn
ARG NEXT_PUBLIC_SITE_URL=https://www.fmw.example
ENV BUILD_TARGET=$BUILD_TARGET
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
RUN NEXT_TELEMETRY_DISABLED=1 npm run build

# ---- runner ----
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
