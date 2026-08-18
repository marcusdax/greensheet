# Docker Localhost Setup for Greensheet Platform — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Docker Compose support so the Greensheet Vite React frontend and Express AI proxy can be launched locally with one command, in both development (hot reload) and production-like (multi-stage build) modes.

**Architecture:** Two Dockerfiles (`Dockerfile.app` and `Dockerfile.proxy`) produce multi-stage images; `docker-compose.yml` runs production-like static assets via Nginx plus the proxy, while `docker-compose.dev.yml` overrides both services with bind mounts and dev commands for hot reload. The browser AI client calls `http://localhost:3001` in both modes.

**Tech Stack:** Docker, Docker Compose, `node:22-alpine`, `nginx:alpine`, `tsx`, Vite, Express.

## Global Constraints

- Scope is frontend + AI proxy only; the browser-side mock API client remains unchanged.
- All Docker files live under `app/` because that is where the runnable code is.
- Use separate `Dockerfile.app` and `Dockerfile.proxy` files for clear boundaries.
- Base image: `node:22-alpine` for Node services; `nginx:alpine` for the production frontend.
- `server/tsconfig.json` sets `noEmit: true` and `allowImportingTsExtensions: true`, so the proxy must run with `tsx` rather than a compiled `dist` output.
- Dev ports: frontend `5173`, proxy `3001`. Production-like ports: frontend `80`, proxy `3001`.
- Dev frontend must bind to `0.0.0.0` inside its container so the host can reach it.
- `AI_ALLOWED_ORIGINS` must contain the frontend origin served to the browser: `http://localhost:5173` for dev, `http://localhost` for production.
- `VITE_AI_PROXY_URL` is consumed by the browser, so it must be a host-resolvable address (`http://localhost:3001`), not an internal Docker service name.
- All new files are committed to the repo.

## File Structure

| File | Responsibility |
|------|----------------|
| `app/.dockerignore` | Keeps image context small and avoids leaking local env files. |
| `app/.env.docker` | Default environment values used by Docker Compose on the host. |
| `app/nginx.conf` | Serves static `dist/` assets and falls back to `index.html` for React Router. |
| `app/Dockerfile.app` | Multi-stage image for the Vite frontend (base → dev → builder → prod). |
| `app/Dockerfile.proxy` | Multi-stage image for the Express AI proxy (base → dev → prod). |
| `app/docker-compose.yml` | Production-like service definitions. |
| `app/docker-compose.dev.yml` | Dev overrides: target `dev`, bind mounts, exposed ports. |
| `app/package.json` | Adds one-command npm scripts and ensures `vite --host` is used for dev. |
| `docs/docker.md` | End-user instructions for starting/stopping the platform locally. |

---

### Task 1: Ignore local artifacts from Docker context

**Files:**
- Create: `app/.dockerignore`

**Interfaces:**
- Consumes: nothing
- Produces: `app/.dockerignore` (excludes files from all Docker build contexts under `app/`)

- [ ] **Step 1: Create the ignore file**

Create `app/.dockerignore` with the following content:

```gitignore
# Dependencies
node_modules
*/node_modules

# Build outputs
dist
dist-ssr
*.tsbuildinfo

# Local env files
.env
.env.local
.env.*.local
.env.docker

# Vite / editor
*.local
.vscode
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?

# Git and logs
.git
.gitignore
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*
```

- [ ] **Step 2: Verify the file exists and contains expected rules**

Run:

```bash
ls -la app/.dockerignore && head -n 5 app/.dockerignore
```

Expected: file is listed and first lines contain `node_modules` and `dist`.

- [ ] **Step 3: Commit**

```bash
git add app/.dockerignore
git commit -m "chore(docker): add .dockerignore for app context"
```

---

### Task 2: Add default Docker environment file

**Files:**
- Create: `app/.env.docker`

**Interfaces:**
- Consumes: browser AI client default endpoint (`http://localhost:3001`)
- Produces: default values loaded by `docker compose --env-file .env.docker`

- [ ] **Step 1: Create the env file**

Create `app/.env.docker`:

```bash
# AI Proxy URL used by the browser client (must be host-reachable, not a Docker service name)
VITE_AI_PROXY_URL=http://localhost:3001

# Port for the Express AI proxy
AI_PROXY_PORT=3001

# CORS origins allowed by the proxy (comma-separated)
AI_ALLOWED_ORIGINS=http://localhost:5173,http://localhost,http://localhost:80
```

- [ ] **Step 2: Verify values**

Run:

```bash
grep "^VITE_AI_PROXY_URL=" app/.env.docker
grep "^AI_PROXY_PORT=" app/.env.docker
```

Expected:
- `VITE_AI_PROXY_URL=http://localhost:3001`
- `AI_PROXY_PORT=3001`

- [ ] **Step 3: Commit**

```bash
git add app/.env.docker
git commit -m "chore(docker): add default .env.docker for local compose"
```

---

### Task 3: Add Nginx configuration for production-like frontend

**Files:**
- Create: `app/nginx.conf`

**Interfaces:**
- Consumes: static assets built to `/usr/share/nginx/html`
- Produces: `app/nginx.conf` mounted into the Nginx stage of `Dockerfile.app`

- [ ] **Step 1: Create the Nginx config**

Create `app/nginx.conf`:

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

  # Do not cache the entrypoint so updates are picked up on redeploy
  location = /index.html {
    add_header Cache-Control "no-store, no-cache, must-revalidate";
  }
}
```

- [ ] **Step 2: Validate syntax locally if possible**

Run (requires `nginx` on the host; if unavailable, skip and verify later with the running container):

```bash
nginx -t -c "$(pwd)/app/nginx.conf" 2>&1 || echo "Host Nginx not available; will verify in container."
```

Expected: either `syntax is ok` or a message explaining host Nginx is unavailable.

- [ ] **Step 3: Commit**

```bash
git add app/nginx.conf
git commit -m "chore(docker): add nginx config for static frontend serving"
```

---

### Task 4: Build the frontend Dockerfile

**Files:**
- Create: `app/Dockerfile.app`

**Interfaces:**
- Consumes: `app/package*.json`, `app/nginx.conf`, source code in `app/`
- Produces: image targets `greensheet-app:dev` and `greensheet-app:prod`

- [ ] **Step 1: Create the Dockerfile**

Create `app/Dockerfile.app`:

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

- [ ] **Step 2: Build the dev target to prove the image compiles**

Run:

```bash
cd app && docker build -f Dockerfile.app --target dev -t greensheet-app:dev .
```

Expected: build completes with no errors and the final line shows a success message.

- [ ] **Step 3: Commit**

```bash
git add app/Dockerfile.app
git commit -m "feat(docker): add multi-stage Dockerfile for Vite frontend"
```

---

### Task 5: Build the AI proxy Dockerfile

**Files:**
- Create: `app/Dockerfile.proxy`

**Interfaces:**
- Consumes: `app/package*.json`, `app/server/**/*.ts`
- Produces: image targets `greensheet-proxy:dev` and `greensheet-proxy:prod`

- [ ] **Step 1: Create the Dockerfile**

Create `app/Dockerfile.proxy`:

```dockerfile
# syntax=docker/dockerfile:1
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
# server/tsconfig.json uses noEmit + allowImportingTsExtensions, so run with tsx
CMD ["npx", "tsx", "server/index.ts"]
```

- [ ] **Step 2: Build the dev target to prove the image compiles**

Run:

```bash
cd app && docker build -f Dockerfile.proxy --target dev -t greensheet-proxy:dev .
```

Expected: build completes with no errors.

- [ ] **Step 3: Build the prod target to prove `tsx` can start**

Run:

```bash
cd app && docker build -f Dockerfile.proxy --target prod -t greensheet-proxy:prod .
```

Expected: build completes with no errors.

- [ ] **Step 4: Commit**

```bash
git add app/Dockerfile.proxy
git commit -m "feat(docker): add multi-stage Dockerfile for AI proxy"
```

---

### Task 6: Ensure Vite dev server binds to `0.0.0.0`

**Files:**
- Modify: `app/package.json`

**Interfaces:**
- Consumes: existing `scripts.dev` value `"vite"`
- Produces: updated `scripts.dev` value `"vite --host"`

- [ ] **Step 1: Edit the dev script**

Replace the `dev` script in `app/package.json`:

```json
"dev": "vite --host"
```

- [ ] **Step 2: Verify the change**

Run:

```bash
node -e "console.log(require('./app/package.json').scripts.dev)"
```

Expected output: `vite --host`

- [ ] **Step 3: Commit**

```bash
git add app/package.json
git commit -m "fix(docker): bind Vite dev server to all interfaces"
```

---

### Task 7: Add Docker npm scripts

**Files:**
- Modify: `app/package.json`

**Interfaces:**
- Consumes: `docker-compose.yml`, `docker-compose.dev.yml`, `.env.docker`
- Produces: npm scripts `docker:dev`, `docker:prod`, `docker:down`, `docker:dev:down`

- [ ] **Step 1: Add the scripts after `preview`**

Edit `app/package.json` so the `scripts` block becomes:

```json
"scripts": {
  "dev": "vite --host",
  "dev:server": "tsx server/index.ts",
  "dev:full": "concurrently \"npm run dev:server\" \"npm run dev\"",
  "build": "tsc -b && vite build",
  "lint": "oxlint",
  "preview": "vite preview",
  "test": "vitest",
  "test:run": "vitest run",
  "docker:dev": "docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env.docker up --build",
  "docker:prod": "docker compose --env-file .env.docker up --build",
  "docker:down": "docker compose --env-file .env.docker down",
  "docker:dev:down": "docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env.docker down"
}
```

- [ ] **Step 2: Validate JSON**

Run:

```bash
node -e "JSON.parse(require('fs').readFileSync('./app/package.json','utf8')); console.log('package.json is valid JSON')"
```

Expected: `package.json is valid JSON`

- [ ] **Step 3: Commit**

```bash
git add app/package.json
git commit -m "feat(docker): add npm scripts for compose up/down"
```

---

### Task 8: Add production Docker Compose definition

**Files:**
- Create: `app/docker-compose.yml`

**Interfaces:**
- Consumes: `Dockerfile.proxy` target `prod`, `Dockerfile.app` target `prod`
- Produces: running production-like services on host ports `3001` and `80`

- [ ] **Step 1: Create the file**

Create `app/docker-compose.yml`:

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

- [ ] **Step 2: Validate compose syntax**

Run:

```bash
cd app && docker compose --env-file .env.docker config > /dev/null && echo "compose config valid"
```

Expected: `compose config valid`

- [ ] **Step 3: Commit**

```bash
git add app/docker-compose.yml
git commit -m "feat(docker): add production-like docker compose definition"
```

---

### Task 9: Add development Docker Compose override

**Files:**
- Create: `app/docker-compose.dev.yml`

**Interfaces:**
- Consumes: `docker-compose.yml`, `Dockerfile.app` target `dev`, `Dockerfile.proxy` target `dev`
- Produces: dev services with bind mounts, hot reload, and host ports `5173`/`3001`

- [ ] **Step 1: Create the override file**

Create `app/docker-compose.dev.yml`:

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
    ports:
      - "3001:3001"

  app:
    build:
      target: dev
    volumes:
      - ./:/app
      - /app/node_modules
    environment:
      - VITE_AI_PROXY_URL=http://localhost:3001
    ports:
      - "5173:5173"
```

- [ ] **Step 2: Validate merged compose syntax**

Run:

```bash
cd app && docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env.docker config > /dev/null && echo "merged compose config valid"
```

Expected: `merged compose config valid`

- [ ] **Step 3: Commit**

```bash
git add app/docker-compose.dev.yml
git commit -m "feat(docker): add dev compose override with bind mounts and hot reload"
```

---

### Task 10: Write Docker usage documentation

**Files:**
- Create: `docs/docker.md`

**Interfaces:**
- Consumes: all files created in Tasks 1–9
- Produces: end-user runbook for local Docker launches

- [ ] **Step 1: Create the runbook**

Create `docs/docker.md`:

```markdown
# Running Greensheet locally with Docker

This setup runs the full Greensheet platform — Vite React frontend + Express AI proxy — in Docker.

## Requirements

- Docker Engine 24+
- Docker Compose v2+
- Port `80`, `5173`, and `3001` free on localhost

## Quick start

```bash
cd app
```

### Development mode (hot reload)

```bash
npm run docker:dev
```

- Frontend: http://localhost:5173
- AI proxy health: http://localhost:3001/health

Source files are bind-mounted, so edits to `src/` or `server/` are reflected immediately.

### Production-like mode (multi-stage build)

```bash
npm run docker:prod
```

- Frontend: http://localhost
- AI proxy health: http://localhost:3001/health

Static assets are built and served by Nginx; the proxy runs with `tsx`.

## Stop the stack

```bash
npm run docker:dev:down   # stop dev mode
npm run docker:down       # stop production-like mode
```

## Environment variables

Default values are in `app/.env.docker`. You can override any value in a local `.env.docker` file; it is ignored by Git.

| Variable | Purpose |
|----------|---------|
| `VITE_AI_PROXY_URL` | Host-reachable URL the browser uses to reach the AI proxy. |
| `AI_PROXY_PORT` | Port the Express proxy listens on inside its container. |
| `AI_ALLOWED_ORIGINS` | Comma-separated CORS origins allowed by the proxy. |

## Troubleshooting

- If `localhost:80` is already in use, edit `docker-compose.yml` to map a different host port, e.g. `"8080:80"`.
- If Vite does not reload on Windows, ensure Docker Desktop is sharing the `app` drive.
```

- [ ] **Step 2: Verify the file renders**

Run:

```bash
head -n 20 docs/docker.md
```

Expected: the file begins with `# Running Greensheet locally with Docker`.

- [ ] **Step 3: Commit**

```bash
git add docs/docker.md
git commit -m "docs(docker): add local Docker runbook"
```

---

### Task 11: Verify the production-like stack

**Files:**
- Test: shell commands against running containers

**Interfaces:**
- Consumes: `docker-compose.yml`, built images, `.env.docker`
- Produces: confirmation that the proxy health endpoint and Nginx frontend respond

- [ ] **Step 1: Start the production-like stack in the background**

Run:

```bash
cd app
npm run docker:down
npm run docker:prod -d
```

- [ ] **Step 2: Wait for services to be ready**

Run a readiness loop:

```bash
for i in {1..30}; do
  curl -fsS http://localhost:3001/health && break
  sleep 1
done
```

Expected: `curl` returns JSON like `{"status":"ok"}` and exits `0`.

- [ ] **Step 3: Check the frontend is served**

Run:

```bash
curl -fsS -o /dev/null -w "%{http_code}" http://localhost
```

Expected: `200`

- [ ] **Step 4: Check the HTML contains the app mount**

Run:

```bash
curl -fsS http://localhost | grep -q "root" && echo "HTML mount point present"
```

Expected: `HTML mount point present`

- [ ] **Step 5: Stop the stack**

```bash
npm run docker:down
```

Expected: containers are removed; `docker ps` no longer lists `app-app-*` or `app-proxy-*`.

- [ ] **Step 6: Commit verification notes (optional)**

No code change; if you recorded output, commit the log or skip.

---

### Task 12: Verify the development stack

**Files:**
- Test: shell commands against running containers

**Interfaces:**
- Consumes: `docker-compose.yml`, `docker-compose.dev.yml`, built images, `.env.docker`
- Produces: confirmation that dev frontend and proxy respond, plus hot reload works

- [ ] **Step 1: Start the dev stack in the background**

Run:

```bash
cd app
npm run docker:dev:down
npm run docker:dev -d
```

- [ ] **Step 2: Wait for services to be ready**

Run a readiness loop:

```bash
for i in {1..30}; do
  curl -fsS http://localhost:3001/health && break
  sleep 1
done
```

Expected: `curl` returns `{"status":"ok"}` and exits `0`.

- [ ] **Step 3: Check the dev frontend responds**

Run:

```bash
curl -fsS -o /dev/null -w "%{http_code}" http://localhost:5173
```

Expected: `200`

- [ ] **Step 4: Check the dev HTML contains the app mount**

Run:

```bash
curl -fsS http://localhost:5173 | grep -q "root" && echo "Dev HTML mount point present"
```

Expected: `Dev HTML mount point present`

- [ ] **Step 5: Confirm Vite is reachable from the host (proves `0.0.0.0` binding)**

The previous `curl` already showed the page loads, which is only possible if Vite bound to `0.0.0.0` inside the container. For an explicit check, run:

```bash
curl -fsS http://127.0.0.1:5173/ -o /dev/null -w "%{http_code}\n"
```

Expected: `200`

- [ ] **Step 6: Verify hot reload (manual)**

1. Edit a visible string in `app/src/App.tsx`.
2. Wait 1–2 seconds.
3. Refresh http://localhost:5173 in the browser.
4. Confirm the change appears.
5. Revert the edit.

- [ ] **Step 7: Stop the stack**

Run:

```bash
npm run docker:dev:down
```

Expected: containers are removed; `docker ps` no longer lists the dev services.

- [ ] **Step 8: Commit**

If any dev-only files changed during the hot-reload test, review and commit only intentional changes.

```bash
git status
```

---

## Self-Review

**1. Spec coverage:**

| Spec requirement | Task |
|------------------|------|
| Separate `Dockerfile.app` and `Dockerfile.proxy` | Tasks 4, 5 |
| Multi-stage production images + dev override | Tasks 4, 5, 8, 9 |
| `app/.env.docker` | Task 2 |
| `app/nginx.conf` | Task 3 |
| `app/.dockerignore` | Task 1 |
| npm scripts for Docker | Task 7 |
| README/docker run instructions | Task 10 |
| Proxy uses `tsx` because of `noEmit` | Task 5 (prod stage `CMD`) |
| Frontend dev binds to `0.0.0.0` | Task 6 |
| Ports: dev 5173/3001, prod 80/3001 | Tasks 8, 9 |

**2. Placeholder scan:**

- No `TBD`, `TODO`, or `implement later` strings remain.
- Every code step includes the actual file content.
- Every verification step includes exact commands and expected outputs.

**3. Type / interface consistency:**

- `AI_PROXY_PORT` is always `3001` across compose and env files.
- `AI_ALLOWED_ORIGINS` matches the origin the browser actually uses (`http://localhost:5173` dev, `http://localhost` prod).
- `VITE_AI_PROXY_URL` is always `http://localhost:3001` and never an internal service name.
- npm script names are consistent between `package.json`, verification commands, and the runbook.

**4. Design errata addressed:**

- The original design listed `VITE_AI_PROXY_URL=http://proxy:3001` in `docker-compose.dev.yml`. This plan uses `http://localhost:3001` because the browser cannot resolve Docker service names.
