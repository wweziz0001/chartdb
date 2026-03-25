# OIDC Authentication

ChartDB can use a standard OpenID Connect provider for self-hosted sign-in by setting `CHARTDB_AUTH_MODE=oidc`.

This mode is designed for Keycloak and other providers that support the standard authorization code flow with PKCE.

## How it works

- ChartDB redirects the browser to your OIDC provider.
- The callback is validated with a signed, short-lived flow cookie, `state`, `nonce`, and PKCE.
- After the provider callback succeeds, ChartDB links the identity by `issuer + subject`.
- On first sign-in, ChartDB can provision a local user record from the provider email and profile claims.
- Protected API access still uses ChartDB's own HTTP-only session cookie. Provider tokens are not stored in the browser by ChartDB.

## Required environment variables

When `CHARTDB_AUTH_MODE=oidc`, set:

- `CHARTDB_OIDC_ISSUER`
- `CHARTDB_OIDC_CLIENT_ID`
- `CHARTDB_OIDC_REDIRECT_URL`

Optional:

- `CHARTDB_OIDC_CLIENT_SECRET`
  Leave this unset only when your provider client is configured as a public client.
- `CHARTDB_OIDC_LOGOUT_URL`
  Use this when you want the ChartDB logout button to continue to the provider logout endpoint.
- `CHARTDB_OIDC_SCOPES`
  Defaults to `openid profile email`.

Shared auth/session settings:

- `CHARTDB_CORS_ORIGIN`
- `CHARTDB_TRUST_PROXY`
- `CHARTDB_SECRET_KEY`
- `CHARTDB_SESSION_TTL_HOURS`
- `CHARTDB_SESSION_COOKIE_NAME`
- `CHARTDB_SESSION_COOKIE_SECURE`

## Local development

When using the normal Vite dev server, the browser talks to `http://localhost:5173` and Vite proxies `/api` to the backend.

That means your OIDC redirect URL should usually point to the frontend origin, not directly to port `4010`:

```dotenv
CHARTDB_AUTH_MODE=oidc
CHARTDB_CORS_ORIGIN=http://localhost:5173
CHARTDB_SECRET_KEY=replace-with-a-local-dev-secret

CHARTDB_OIDC_ISSUER=http://localhost:8080/realms/chartdb
CHARTDB_OIDC_CLIENT_ID=chartdb
CHARTDB_OIDC_CLIENT_SECRET=replace-with-keycloak-client-secret
CHARTDB_OIDC_REDIRECT_URL=http://localhost:5173/api/auth/oidc/callback
CHARTDB_OIDC_LOGOUT_URL=http://localhost:8080/realms/chartdb/protocol/openid-connect/logout?post_logout_redirect_uri=http%3A%2F%2Flocalhost%3A5173&client_id=chartdb
```

Run ChartDB normally:

```bash
npm install
npm run dev:server
npm run dev:web
```

## Keycloak-compatible example

Typical Keycloak values look like this:

```dotenv
CHARTDB_AUTH_MODE=oidc
CHARTDB_CORS_ORIGIN=https://chartdb.example.com
CHARTDB_SECRET_KEY=replace-with-a-long-random-secret
CHARTDB_SESSION_COOKIE_SECURE=true

CHARTDB_OIDC_ISSUER=https://sso.example.com/realms/chartdb
CHARTDB_OIDC_CLIENT_ID=chartdb
CHARTDB_OIDC_CLIENT_SECRET=replace-with-keycloak-client-secret
CHARTDB_OIDC_REDIRECT_URL=https://chartdb.example.com/api/auth/oidc/callback
CHARTDB_OIDC_LOGOUT_URL=https://sso.example.com/realms/chartdb/protocol/openid-connect/logout?post_logout_redirect_uri=https%3A%2F%2Fchartdb.example.com&client_id=chartdb
```

Keycloak client settings to match:

- Access type: confidential when you set `CHARTDB_OIDC_CLIENT_SECRET`
- Valid redirect URIs: include your full ChartDB callback URL
- Web origins: include your ChartDB origin
- Standard flow: enabled
- Direct access grants: not required for this integration

## Reverse proxy notes

- Route `/api/auth/oidc/callback` through to the ChartDB backend.
- Keep the externally visible callback URL exactly aligned with `CHARTDB_OIDC_REDIRECT_URL`.
- If TLS terminates at the proxy, forward `X-Forwarded-Proto: https` and keep `CHARTDB_SESSION_COOKIE_SECURE=true` in production.
- Set `CHARTDB_TRUST_PROXY=1` when traffic always passes through one trusted reverse-proxy hop that sanitizes forwarded headers.
- Prefer serving the frontend and backend from the same external origin so session cookies and OIDC redirects stay simple.
- If you deploy the frontend and backend on different origins, `CHARTDB_CORS_ORIGIN` must be the exact frontend origin.

## User linking behavior

- Existing ChartDB users are reused when the provider email matches an existing account.
- Once linked, future sign-ins use the stable provider identity (`issuer + subject`) instead of relying on email alone.
- New users are provisioned with `authProvider=oidc` and a display name from provider claims such as `name` or `preferred_username`.

## Security notes

- Never commit real client secrets.
- In production, use HTTPS for both `CHARTDB_OIDC_REDIRECT_URL` and `CHARTDB_OIDC_LOGOUT_URL`.
- Make sure your provider returns an email claim because ChartDB uses it for first-login account matching.
- Rotate `CHARTDB_SECRET_KEY` deliberately; changing it invalidates signed OIDC flow cookies and encrypted backend secrets.
