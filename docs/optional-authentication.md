# Optional Authentication

ChartDB now supports an optional password-based authentication mode for self-hosted deployments.

## Modes

- `CHARTDB_AUTH_MODE=disabled`
  Keeps the current lightweight behavior. If the backend is reachable, ChartDB bootstraps a placeholder local owner and persists data there. If the backend is unavailable, the editor continues in browser-local mode.
- `CHARTDB_AUTH_MODE=password`
  Requires a login before protected API routes can be used. The configured local user is stored in the app database, project ownership is attached to that user, and sessions are issued through an HTTP-only cookie.

OIDC is intentionally out of scope for this change.

## Required environment variables

When `CHARTDB_AUTH_MODE=password`, set:

- `CHARTDB_AUTH_EMAIL`
- `CHARTDB_AUTH_PASSWORD`
- `CHARTDB_AUTH_DISPLAY_NAME` optional display name for the bootstrap local account

Related session settings:

- `CHARTDB_SESSION_TTL_HOURS` session lifetime, defaults to `168`
- `CHARTDB_SESSION_COOKIE_NAME` cookie name, defaults to `chartdb_session`
- `CHARTDB_SESSION_COOKIE_SECURE` optional override for the cookie `Secure` flag. By default it is enabled in production and disabled outside production.

## Security notes

- Do not commit real credentials into `.env` files.
- Set a strong `CHARTDB_SECRET_KEY` and a strong `CHARTDB_AUTH_PASSWORD` for production.
- In production with password auth enabled, `CHARTDB_CORS_ORIGIN` must be an explicit origin, not `*`.
- Passwords are stored as salted `scrypt` hashes.
- Session cookies are `HttpOnly` and `SameSite=Lax`.
- Session records are persisted server-side and are invalidated on logout.

## Example configuration

```dotenv
CHARTDB_AUTH_MODE=password
CHARTDB_AUTH_EMAIL=owner@example.com
CHARTDB_AUTH_PASSWORD=replace-with-a-long-random-password
CHARTDB_AUTH_DISPLAY_NAME=ChartDB Owner
CHARTDB_CORS_ORIGIN=https://chartdb.example.com
CHARTDB_SECRET_KEY=replace-with-a-long-random-secret
```

## Login flow

1. Start the backend with password auth configured.
2. Open the ChartDB UI.
3. Sign in with `CHARTDB_AUTH_EMAIL` and `CHARTDB_AUTH_PASSWORD`.
4. Use `Log out` from the editor toolbar to invalidate the current session.

## API behavior

- Public routes:
  - `GET /api/health`
  - `GET /api/auth/session`
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
- Protected routes:
  - persistence routes under `/api/app`, `/api/projects`, `/api/collections`, `/api/diagrams`, `/api/backups`
  - schema sync routes under `/api/connections`, `/api/schema`, and `/api/audit`
