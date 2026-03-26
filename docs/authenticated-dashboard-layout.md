# Authenticated Dashboard Layout

## Overview

ChartDB now uses a library-first authenticated experience instead of dropping
 signed-in users directly into the editor.

After a successful login, the default application route is the main dashboard at
 `/`. This dashboard acts as the primary operational home for the authenticated
 user and is backed by the existing saved-project, saved-diagram, and collection
 APIs.

## Post-login landing behavior

- Authenticated users now land on `All Diagrams` at `/`.
- The root route is the main library/dashboard page.
- The editor remains available at:
  - `/workspace`
  - `/workspace?action=create`
  - `/workspace?action=import`
  - `/diagrams/:diagramId`

This means the editor is still first-class, but it is no longer the default
 landing surface after authentication.

## Authenticated shell

Authenticated pages now share a persistent left-sidebar application shell.

The shell includes:

- Product identity header
- Main library navigation
- Collections section with live collection links
- Utility navigation
- User identity block in the footer
- Clear logout action

## Sidebar navigation model

### Standard authenticated navigation

The sidebar exposes the following primary destinations:

- `All Diagrams`
- `Shared with Me`
- `Unorganized`
- `Collections`
- `Trash`
- `Profile`
- `Settings`

If collections exist, they are also listed directly in the sidebar under the
 `Collections` section and link to `/collections/:collectionId`.

### Role-aware admin visibility

The `Admin` navigation item is role-aware:

- Users with `role === 'admin'` see the `Admin` sidebar item.
- Regular users do not see the `Admin` item at all.
- The tab is hidden, not disabled.

## Admin protection model

Admin access is enforced in two layers:

### Client-side

- The `/admin` route is wrapped by `AdminRouteGuard`.
- Non-admin users are redirected back to `/`.

### Server-side

- `/api/admin/overview` still requires an authenticated admin user on the
  server.
- Hiding the sidebar link is not the only protection layer.

## Page structure

The authenticated shell now hosts these pages:

- `All Diagrams`
- `Shared with Me`
- `Unorganized`
- `Collections`
- `Collection detail`
- `Trash`
- `Profile`
- `Settings`
- `Admin`

## Data model integration

The dashboard and sidebar use real ChartDB data sources:

- Collections from `/api/collections`
- Projects from `/api/projects`
- Diagrams from `/api/projects/:id/diagrams`
- Auth identity from the ChartDB auth session
- Local UI preferences from the existing local config context
- Saved config from the existing config context

No dead sidebar links were added. Each exposed route is backed by a real page.

## Routing assumptions

The current authenticated routing model assumes:

- `/` is the library landing page
- `/workspace` is the editor entry route
- `/diagrams/:diagramId` opens a specific diagram in the editor
- `/admin` is accessible only to admins

Any new authenticated pages should generally be added inside the shared
 dashboard shell unless they intentionally need a full-screen workspace layout
 like the editor.
