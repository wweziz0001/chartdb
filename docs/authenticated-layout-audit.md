# Authenticated Layout Audit

Date: 2026-03-25
Branch: `feature/improve-dashboard-layout-and-role-aware-navigation`

## Current authenticated flow

- Frontend routing is editor-first.
- [`src/router.tsx`](/root/test/chartdb/src/router.tsx) maps both `/` and `/diagrams/:diagramId` to the editor.
- After sign-in, the app refreshes session state in [`src/features/auth/context/auth-provider.tsx`](/root/test/chartdb/src/features/auth/context/auth-provider.tsx), then falls through to the router without a post-login dashboard redirect.
- [`src/pages/editor-page/use-diagram-loader.tsx`](/root/test/chartdb/src/pages/editor-page/use-diagram-loader.tsx) decides whether to open a default diagram, open the "Open Diagram" dialog, or open the "Create Diagram" dialog.

## Existing authenticated navigation

- There is no shared authenticated application shell today.
- The main authenticated affordance is the editor top bar in [`src/pages/editor-page/top-navbar/top-navbar.tsx`](/root/test/chartdb/src/pages/editor-page/top-navbar/top-navbar.tsx).
- That top bar includes a `Log out` action and an `Admin` button for admin users, but it does not provide broader library navigation.

## Role-aware admin behavior

- Client-side admin route protection already exists in [`src/features/admin/components/admin-route-guard.tsx`](/root/test/chartdb/src/features/admin/components/admin-route-guard.tsx).
- Server-side admin enforcement already exists in [`server/src/routes/admin-routes.ts`](/root/test/chartdb/server/src/routes/admin-routes.ts) through `requireAdminUser`.
- Admin visibility in the UI is currently limited to the editor top bar and not part of a role-aware sidebar model.

## Available real data for a dashboard shell

- Collections are available via `/api/collections`.
- Projects are available via `/api/projects`, with support for `search`, `collectionId`, and `unassigned`.
- Per-project diagram summaries are available via `/api/projects/:id/diagrams`.
- Project summaries include `status`, `access`, `sharingScope`, and `collectionId`.
- Diagram summaries include `access`, `status`, and collaboration metadata.
- The storage layer in [`src/context/storage-context/storage-provider.tsx`](/root/test/chartdb/src/context/storage-context/storage-provider.tsx) already syncs remote collections, projects, and diagrams into local cache.

## UX gaps to address

- Authenticated users land in the editor instead of a product-grade library dashboard.
- Navigation across saved diagrams, shared work, collections, trash, profile, settings, and admin is fragmented or missing.
- Non-admin users do not have a complete post-login navigation model.
- The admin affordance is not integrated into a consistent authenticated shell.
