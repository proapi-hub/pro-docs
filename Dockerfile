# syntax=docker/dockerfile:1.7
# ---------- builder ----------
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# 启用 pnpm（package.json 用的是 pnpm-lock.yaml）
RUN corepack enable && corepack prepare pnpm@latest --activate

# 复制依赖清单 + 源码，一次性走 pnpm install（content 在仓库里，postinstall 的 fumadocs-mdx 需要它）
COPY . .

# 安装依赖（带缓存挂载，CI 命中后增量极快）
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm run build

# ---------- runner ----------
FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# 非 root 运行
RUN groupadd -g 1001 nodejs \
 && useradd  -u 1001 -g nodejs -m -d /home/nextjs nextjs

# Next.js standalone 输出
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static    ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public          ./public

USER nextjs

EXPOSE 3000

# 健康检查（Next.js 默认无 /healthz，用首页代替）
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
