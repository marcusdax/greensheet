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

# One-shot schema push and seed. This stage carries the SOURCE, not just the
# bundle: drizzle-kit reads db/schema.ts and the seed scripts run through tsx,
# so `dist` alone cannot do either. It is a separate target from `runner`
# precisely so the serving image stays small and has no seed script in it.
FROM base AS migrate
WORKDIR /app/app
RUN corepack enable pnpm && corepack prepare pnpm@8.15.0 --activate
COPY --from=builder /app/app ./
# Every seed guards on its own data and exits cleanly when it is already
# there, so `docker compose up` a second time re-checks rather than duplicates.
CMD ["sh", "-c", "pnpm run db:push && pnpm run db:seed && pnpm run db:seed:expansion && pnpm run db:seed:auth && pnpm run db:seed:payments && pnpm run db:seed:dunning"]

FROM base AS runner
WORKDIR /app
RUN corepack enable pnpm && corepack prepare pnpm@8.15.0 --activate
COPY --from=builder /app/app/package.json ./app/package.json
COPY --from=builder /app/app/node_modules ./app/node_modules
COPY --from=builder /app/app/dist ./dist
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/boot.js"]
