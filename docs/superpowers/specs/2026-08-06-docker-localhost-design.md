# Docker Localhost Setup for Greensheet Platform

## Goal

Add Docker support so the full Greensheet platform — React/Vite frontend plus Express AI proxy — can be launched locally with one command. Provide both a development mode with hot reload and a production-like multi-stage build.

## Decisions from brainstorming

- **Scope:** Frontend + AI proxy only. The existing browser-side mock API client remains unchanged.
- **Environment type:** Multi-stage production builds with a development override.
- **Service layout:** Separate `app` and `proxy` services in Docker Compose.
- **Dockerfiles:** Two separate files (`Dockerfile.app`, `Dockerfile.proxy`) for clearer separation of concerns.
- **Commit:** All Docker files committed to the repo.

## 1. Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        Docker Compose                         │
│  ┌─────────────────────┐          ┌─────────────────────┐     │
│  │ app service         │          │ proxy service         │     │
│  │ (Vite / Nginx)       │◀────────▶│ (Express AI proxy)    │     │
│  │                      │          │                      │     │
│  │ Dev:  npm run dev    │          │ Dev:  npm run         │     │
│  │ Port: 5173           │          │        dev:server     │     │
│  │                      │          │ Port: 3001            │     │
│  │ Prod: Nginx static   │          │ Prod: compiled TS     │     │
│  │ Port: 80             │          │        with node      │     │
│  └─────────────────────┘          └─────────────────────┘     │
└──────────────────────────────────────────────────────────────┘
```

- Frontend requests to `VITE_AI_PROXY_URL` go to the proxy service.
- Dev mode uses bind mounts for hot reload.
- Production mode uses multi-stage builds with static frontend assets served by Nginx.

## 2. Files to create

- `app/Dockerfile.app` — multi-stage frontend image.
- `app/Dockerfile.proxy` — multi-stage AI proxy image.
- `app/docker-compose.yml` — production-like services.
- `app/docker-compose.dev.yml` — dev overrides (bind mounts, ports).
- `app/.env.docker` — container networking environment variables.
- `app/nginx.conf` — Nginx static serving with React Router fallback.
- `app/.dockerignore` — exclude node_modules, dist, .git, etc.
- `app/package.json` — add `docker:dev`, `docker:prod`, `docker:down` scripts.
- `README.md` or `docs/docker.md` — run instructions.

## 3. Dockerfiles

### `app/Dockerfile.app`

```dockerfile
# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM base AS dev
ENV NODE_ENV=development
EXPOSE 5173
CMD ["npm", "run", "dev"]

FROM base AS builder
COPY . .
RUN npm run build

FROM nginx:alpine AS prod
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### `app/Dockerfile.proxy`

```dockerfile
FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM base AS dev
ENV NODE_ENV=development
EXPOSE 3001
CMD ["npm", "run", "dev:server"]

FROM base AS prod
COPY . .
RUN npx tsc -p server/tsconfig.json
CMD ["node", "server/dist/index.js"]
```

## 4. Docker Compose

### `app/docker-compose.yml` (production-like)

```yaml
services:
  proxy:
    build:
      context: .
      dockerfile: Dockerfile.proxy
      target: prod
    ports:
      - "3001:3001"
    environment:
      - AI_PROXY_PORT=3001
      - AI_ALLOWED_ORIGINS=http://localhost,http://localhost:80

  app:
    build:
      context: .
      dockerfile: Dockerfile.app
      target: prod
    ports:
      - "80:80"
    depends_on:
      - proxy
```

### `app/docker-compose.dev.yml` (dev overrides)

```yaml
services:
  proxy:
    build:
      target: dev
    volumes:
      - ./:/app
      - /app/node_modules
    environment:
      - AI_PROXY_PORT=3001
      - AI_ALLOWED_ORIGINS=http://localhost:5173

  app:
    build:
      target: dev
    volumes:
      - ./:/app
      - /app/node_modules
    environment:
      - VITE_AI_PROXY_URL=http://proxy:3001
    ports:
      - "5173:5173"
```

## 5. Environment and Nginx

`app/.env.docker`:
```bash
VITE_AI_PROXY_URL=http://localhost:3001
AI_PROXY_PORT=3001
AI_ALLOWED_ORIGINS=http://localhost:5173,http://localhost,http://localhost:80
```

`app/nginx.conf`:
```nginx
server {
  listen 80;
  server_name localhost;
  root /usr/share/nginx/html;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }

  location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }
}
```

## 6. Scripts and instructions

Add to `app/package.json`:
```json
{
  "docker:dev": "docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env.docker up --build",
  "docker:prod": "docker compose --env-file .env.docker up --build",
  "docker:down": "docker compose down"
}
```

Usage:
```bash
cd app
npm run docker:dev    # dev with hot reload
npm run docker:prod   # production-like build
npm run docker:down   # stop and remove containers
```

Endpoints:
- Dev frontend: http://localhost:5173
- Prod frontend: http://localhost
- AI proxy health: http://localhost:3001/health

## 7. Future work

- Add healthchecks and restart policies.
- Add a reverse proxy (Traefik/Nginx) with TLS for local HTTPS.
- Add Docker BuildKit cache mounts for faster rebuilds.
- Consider a unified `Dockerfile` with build targets if the team prefers fewer files.
