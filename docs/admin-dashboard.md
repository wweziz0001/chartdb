# Admin Dashboard

ChartDB now includes a basic admin dashboard for self-hosted deployments that enable authentication.

## What It Includes

- a protected `/admin` route that only authenticated admins can access
- a platform overview with environment, auth mode, bootstrap status, OIDC configuration status, and persistence mode
- top-level counts for users, admins, collections, projects, diagrams, and active sessions
- a read-only user table with role, status, auth provider, created-at, and last-login visibility
- project and diagram breakdowns by status and visibility
- sharing record counts across projects and diagrams

## What It Does Not Include

- user creation, editing, activation, or role changes
- password reset, impersonation, or recovery flows
- advanced role-based access control beyond the existing `admin` and `member` roles
- sharing record management or moderation tools
- operational controls such as toggling auth providers, changing env-backed settings, or mutating persistence data

## Notes

- The dashboard is intended for self-hosted operators who need quick visibility into platform state, not a full control plane.
- When authentication is disabled, the admin dashboard remains unavailable.
- Live PostgreSQL schema import, diff, and apply remain separate admin-only operational routes in auth-enabled deployments.
- The backend API surface for the dashboard is `GET /api/admin/overview`.
