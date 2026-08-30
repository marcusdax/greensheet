FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

FROM base AS builder
WORKDIR /app
COPY app/package.json ./
RUN corepack enable pnpm && corepack prepare pnpm@8.15.0 --activate
RUN pnpm install
COPY app/ ./app/
WORKDIR /app/app
RUN pnpm run build

FROM base AS runner
WORKDIR /app
RUN corepack enable pnpm && corepack prepare pnpm@8.15.0 --activate
COPY --from=builder /app/app/package.json ./app/package.json
COPY --from=builder /app/app/node_modules ./app/node_modules
COPY --from=builder /app/app/dist ./dist
COPY --from=builder /app/app/app ./app
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/boot.js"]
