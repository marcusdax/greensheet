# Running Greensheet locally with Docker

This setup runs the full Greensheet platform — Vite React frontend + Express AI proxy — in Docker.

## Requirements

- Docker Engine 24+
- Docker Compose v2.24+ (uses `!override` for dev port mapping)
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

Frontend files (`src/`) are bind-mounted and hot-reloaded by Vite. The AI proxy (`server/`) restarts automatically in dev mode (`tsx watch`).

Containers start in detached mode. To follow dev logs:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env.docker logs -f
```

### Production-like mode (multi-stage build)

```bash
npm run docker:prod
```

- Frontend: http://localhost
- AI proxy health: http://localhost:3001/health

Static assets are built and served by Nginx; the proxy runs with `tsx`.

Containers start in detached mode. To follow production-like logs:

```bash
docker compose --env-file .env.docker logs -f
```

## Stop the stack

```bash
npm run docker:dev:down   # stop dev mode
npm run docker:down       # stop production-like mode
```

## Environment variables

Default values are in `app/.env.docker`. It is committed to the repo so the stack works out of the box. To override values locally without committing them, export them in your shell before running the npm scripts, or invoke `docker compose` directly with your own `--env-file <file>`.

| Variable | Purpose |
|----------|---------|
| `VITE_AI_PROXY_URL` | Host-reachable URL the browser uses to reach the AI proxy. |
| `AI_PROXY_PORT` | Port the Express proxy listens on inside its container. |
| `AI_ALLOWED_ORIGINS` | Comma-separated CORS origins allowed by the proxy. |

## Building images manually

The frontend image relies on the `localization/02-locale-files/` directory, which lives outside `app/`. Use Docker Compose (as shown above) so the build context and named context are correct. If you build manually, pass the localization context:

```bash
cd app
docker build -f Dockerfile.app --target prod -t greensheet-app:prod . \
  --build-context localization=../localization/02-locale-files
```

## Troubleshooting

- If `localhost:80` is already in use, edit `docker-compose.yml` to map a different host port, e.g. `"8080:80"`.
- If Vite does not reload on Windows, `CHOKIDAR_USEPOLLING=true` is already enabled in `docker-compose.dev.yml`. Ensure Docker Desktop is sharing the `app` drive if polling still fails.
