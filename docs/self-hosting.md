# Self-Hosting ChartDB

ChartDB can run as a lightweight self-hosted stack with a static web container, a Fastify API, and local SQLite persistence for application metadata.

## Local run

Copy the example environment file and choose local secrets:

```bash
cp .env.example .env
```

At minimum, set:

```dotenv
CHARTDB_SECRET_KEY=replace-with-a-long-random-secret
CHARTDB_POSTGRES_PASSWORD=replace-with-a-local-dev-password
```

Run the app without Docker:

```bash
npm install
npm run dev:server
npm run dev:web
```

Vite serves the frontend on `http://localhost:5173` and proxies `/api` to `CHARTDB_API_PROXY`, which defaults to `http://localhost:4010`.

## Build and test

```bash
npm run lint
npm run typecheck
npm run test:ci
npm run build
```

## Docker Compose

Start the full self-hosted stack:

```bash
docker compose up --build -d
```

This starts:

- `web` on `http://localhost:8080`
- `api` on `http://localhost:4010`
- `postgres` on `localhost:5432`

Useful follow-up commands:

```bash
docker compose ps
docker compose logs -f api
docker compose down -v
```

Health endpoints:

- `GET /healthz` on the web container
- `GET /api/livez` for process liveness
- `GET /api/readyz` for API + SQLite readiness
- `GET /api/health` for a detailed operational snapshot

## Environment variables

Frontend runtime variables:

- `VITE_API_BASE_URL`: optional public API base when the frontend is not proxying `/api` on the same origin
- `VITE_OPENAI_API_KEY`: optional browser-side OpenAI key for AI export flows
- `VITE_OPENAI_API_ENDPOINT`: optional OpenAI-compatible endpoint override
- `VITE_LLM_MODEL_NAME`: optional default model name for AI export flows
- `VITE_HIDE_CHARTDB_CLOUD`: hides cloud upsell entry points when `true`
- `VITE_DISABLE_ANALYTICS`: disables Fathom analytics when `true`

Backend runtime variables:

- `CHARTDB_API_HOST`: backend bind host, defaults to `0.0.0.0`
- `CHARTDB_API_PORT`: backend listen port, defaults to `4010`
- `CHARTDB_CORS_ORIGIN`: allowed browser origin for API access
- `CHARTDB_TRUST_PROXY`: `false`, `true`, or a positive hop count such as `1`
- `CHARTDB_SECRET_KEY`: required production secret used for encrypted connection storage and signed auth flow state
- `CHARTDB_DATA_DIR`: directory for local SQLite files
- `CHARTDB_APP_DB_PATH`: optional explicit path for the app persistence SQLite database
- `CHARTDB_METADATA_DB_PATH`: optional explicit path for the schema-sync metadata SQLite database
- `CHARTDB_LOG_LEVEL`: Fastify/Pino level
- `CHARTDB_DEFAULT_PROJECT_NAME`: bootstrap default project name
- `CHARTDB_DEFAULT_OWNER_NAME`: bootstrap default owner display name

Authentication variables:

- `CHARTDB_AUTH_MODE`: `disabled`, `password`, or `oidc`
- `CHARTDB_AUTH_EMAIL`: optional environment-assisted first admin email for password mode
- `CHARTDB_AUTH_PASSWORD`: optional environment-assisted first admin password for password mode
- `CHARTDB_AUTH_DISPLAY_NAME`: display name for environment-assisted bootstrap
- `CHARTDB_BOOTSTRAP_SETUP_CODE`: optional operator-managed interactive bootstrap code
- `CHARTDB_BOOTSTRAP_ADMIN_EMAIL`: required first admin email for OIDC bootstrap
- `CHARTDB_SESSION_TTL_HOURS`: session lifetime
- `CHARTDB_SESSION_COOKIE_NAME`: session cookie name
- `CHARTDB_SESSION_COOKIE_SECURE`: optional cookie `Secure` override
- `CHARTDB_OIDC_ISSUER`: OIDC issuer URL
- `CHARTDB_OIDC_CLIENT_ID`: OIDC client id
- `CHARTDB_OIDC_CLIENT_SECRET`: optional OIDC client secret
- `CHARTDB_OIDC_REDIRECT_URL`: registered OIDC callback URL
- `CHARTDB_OIDC_LOGOUT_URL`: optional provider logout continuation URL
- `CHARTDB_OIDC_SCOPES`: optional OIDC scopes, defaults to `openid profile email`

Compose helper variables:

- `CHARTDB_WEB_PORT`: published web port, defaults to `8080`
- `CHARTDB_POSTGRES_PORT`: published PostgreSQL port, defaults to `5432`
- `CHARTDB_POSTGRES_DB`: local compose database name
- `CHARTDB_POSTGRES_USER`: local compose database user
- `CHARTDB_POSTGRES_PASSWORD`: local compose database password

## Reverse proxy notes

- Prefer serving the frontend and API from the same external origin and let the web container proxy `/api` internally.
- Set `CHARTDB_CORS_ORIGIN` to the exact public frontend origin when browsers call the API.
- Set `CHARTDB_TRUST_PROXY=1` only when ChartDB is always behind one trusted reverse-proxy hop that sanitizes forwarded headers.
- Forward `Host`, `X-Forwarded-For`, `X-Forwarded-Proto`, and optionally `X-Request-Id`.
- Disable buffering for `/api/` when proxying because ChartDB uses server-sent events for collaboration updates.
- When the frontend and API are split across origins, set `VITE_API_BASE_URL=https://api.example.com`.
- Keep `CHARTDB_OIDC_REDIRECT_URL` aligned with the externally visible callback URL when OIDC is enabled.

## Deployment basics

- Run the API with `NODE_ENV=production`.
- Mount `/app/data` on persistent storage when using the API container.
- Back up the SQLite files in `CHARTDB_DATA_DIR` regularly.
- Keep API replicas at `1` today. ChartDB currently uses SQLite plus in-memory collaboration state, so multi-replica API deployments need extra coordination work before they are safe.
- The web container is stateless and is compatible with future Kubernetes ingress or service-based routing.
- For Kubernetes, map probes to `/healthz`, `/api/livez`, and `/api/readyz`, and back the API pod with a persistent volume claim.
