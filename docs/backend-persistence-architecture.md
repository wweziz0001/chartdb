# Backend Persistence Foundation

ChartDB now has two backend concerns that intentionally stay separate:

- `schema sync`
  PostgreSQL connection management, import, diff, SQL generation, and safe apply.
- `app persistence`
  Self-hosted storage for users, projects, diagrams, ownership metadata, and search-ready summaries.

## Design goals

- Keep the existing editor working with minimal frontend churn.
- Add a durable backend storage layer for self-hosted deployments.
- Preserve a clean seam between browser state and backend persistence.
- Leave room for future auth, sharing, collections, search, and admin features.

## Server modules

- `server/src/app-persistence/contracts.ts`
  Zod-validated API payloads and status/visibility enums.
- `server/src/app-persistence/repository.ts`
  SQLite-backed repository for users, projects, memberships, and diagrams.
- `server/src/app-persistence/service.ts`
  Default-user bootstrap, project/diagram lifecycle logic, and search.
- `server/src/app-persistence/routes.ts`
  Fastify routes under `/api/app/*`.

## Data model

### `app_users`

- Local auth-ready placeholder users.
- Tracks `status`, `is_admin`, and timestamps.

### `app_projects`

- Top-level container for collaboration and future sharing.
- Tracks `owner_user_id`, `slug`, `visibility`, `status`, and `primary_diagram_id`.

### `app_project_memberships`

- Foundation for future sharing and role-based access.
- Tracks `owner`, `editor`, and `viewer` roles.

### `app_diagrams`

- Stores a versioned diagram document plus ownership metadata.
- Tracks `visibility`, `status`, `checksum`, `version`, and timestamps.

## Frontend persistence flow

- IndexedDB remains the editor’s immediate local store.
- The storage provider now mirrors diagram changes to `/api/app/diagrams/:id`.
- When the backend is reachable, list/get requests prefer server persistence.
- When the backend is unavailable, the editor falls back to local IndexedDB without blocking the core editing experience.

## API surface

- `GET /api/health`
- `GET /api/app/health`
- `GET /api/app/me`
- `GET /api/app/projects`
- `POST /api/app/projects`
- `GET /api/app/projects/:id`
- `PATCH /api/app/projects/:id`
- `GET /api/app/diagrams`
- `GET /api/app/diagrams/:id`
- `PUT /api/app/diagrams/:id`
- `DELETE /api/app/diagrams/:id`
- `GET /api/app/search`

## Operational notes

- Persistence uses the same SQLite data directory as schema sync metadata.
- Fastify logging now includes service/environment metadata and remains request-structured.
- Production deployments should always set `CHARTDB_SECRET_KEY`.
