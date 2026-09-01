FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

FROM base AS builder
WORKDIR /app
RUN corepack enable pnpm && corepack prepare pnpm@8.15.0 --activate
COPY app/ ./app/
WORKDIR /app/app
RUN pnpm install
RUN pnpm add -D @rollup/rollup-linux-x64-musl
RUN pnpm run build

FROM base AS runner
WORKDIR /app
RUN corepack enable pnpm && corepack prepare pnpm@8.15.0 --activate
COPY --from=builder /app/app/package.json ./app/package.json
COPY --from=builder /app/app/node_modules ./app/node_modules
COPY --from=builder /app/app/dist ./dist
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/boot.js"]
