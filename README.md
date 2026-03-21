# ChartDB Schema Sync

ChartDB is now extended into a **PostgreSQL-first schema synchronization platform** that preserves the existing visual editor while adding a production-minded backend workflow for importing, diffing, previewing, and safely applying schema changes.

## What changed

### New workflow

1. Save a PostgreSQL connection in the new **Connect Database** flow.
2. Test the connection server-side.
3. Import the live schema into the ChartDB canvas.
4. Edit tables, columns, relationships, and indexes visually.
5. Preview the diff between the imported baseline and the edited target.
6. Review the generated migration SQL and risk warnings.
7. Apply approved changes back to PostgreSQL through the backend.
8. Review audit history and refresh from the live database.

## Key features in v1

- Server-side PostgreSQL connection management
- Live schema import / introspection
- Canonical schema model shared between frontend and backend
- Baseline-vs-target diff generation
- PostgreSQL migration SQL generation
- Destructive-change warnings and typed confirmation flow
- JSON audit trail for import, diff, and apply events
- Docker Compose local stack for frontend, backend, and PostgreSQL

## Repository architecture

- `src/` – existing ChartDB frontend plus schema sync UI and context
- `shared/schema-sync/` – canonical schema model, diff engine, SQL planner, validation
- `server/src/` – backend API, PostgreSQL client, apply engine, audit + connection stores
- `docs/schema-sync-architecture.md` – technical architecture reference

## Security model

- Browser never connects directly to PostgreSQL.
- Credentials are submitted once and stored only on the backend.
- Stored passwords are encrypted at rest using AES-256-GCM.
- The UI cannot execute arbitrary SQL.
- Destructive operations require explicit approval and typed confirmation.
- Backend input is validated with `zod`.

## Local development

### Prerequisites

- Node.js 22+
- npm
- Docker / Docker Compose (recommended for PostgreSQL)

### Environment

Copy `.env.example` to `.env` and update as needed.

### Run the frontend and backend manually

```bash
npm install
npm run dev:server
npm run dev
```

Frontend: `http://localhost:5173`
Backend health: `http://localhost:4010/api/health`

### Run the full local stack with Docker Compose

```bash
docker compose up --build
```

Services:

- frontend: `http://localhost:5173`
- backend: `http://localhost:4010`
- postgres: `localhost:5432`

## Backend API

- `GET /api/health`
- `GET /api/connections`
- `POST /api/connections`
- `DELETE /api/connections/:id`
- `POST /api/connections/test`
- `POST /api/schema/import-live`
- `POST /api/schema/diff`
- `POST /api/schema/apply`
- `GET /api/audit/:id`

## CI / quality gates

GitHub Actions now runs:

- install
- lint
- type-check
- unit tests
- build

## Limitations in v1

- PostgreSQL is the only live engine implemented.
- Rename detection is advisory, not automatic.
- Automatic rollback is not provided for every DDL pattern.
- Audits are file-backed for local/self-hosted use.
- Authentication / RBAC is structured for future work but not implemented yet.

## Future extension path

The new canonical schema layer and backend connector separation are designed for future engine adapters:

- MySQL
- MariaDB
- SQL Server

See `docs/schema-sync-architecture.md` for the deeper design reference.
