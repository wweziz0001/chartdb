# Sharing And Persistence Audit

Date: 2026-03-25

## Current Sharing Model

- Sharing is currently modeled only as resource-level global state on projects and diagrams:
  - `sharing_scope`: `private`, `authenticated`, or `link`
  - `sharing_access`: `view` or `edit`
  - `share_token` for link sharing
- There is no persisted per-user access list for directly sharing with specific people.
- Link sharing is intentionally limited to read-only in the current implementation.
- Sharing management is owner-only and exposed through:
  - `GET/PATCH /api/projects/:id/sharing`
  - `GET/PATCH /api/diagrams/:id/sharing`

## Current Collaboration And Persistence Flow

- The frontend editor writes mutations into the local Dexie-backed diagram snapshot first.
- Autosave/manual save flushes that local snapshot through `storage-provider.tsx` via:
  - `saveDiagram()`
  - `flushDiagramSync()`
  - `syncDiagramToRemote()`
  - `PUT /api/diagrams/:id`
- The backend persists the canonical diagram document in `PersistenceService.upsertDiagram()`.
- Realtime owner/editor refresh uses:
  - diagram sessions
  - optimistic document versions
  - server-sent collaboration events
  - a remote reload path in `chartdb-provider.tsx`

## Root Cause Of Shared Editor Persistence Failure

The collaborator-save failure is caused by an authorization mismatch in the canonical persistence path:

- `PersistenceService.upsertDiagram()` always authorizes saves with `assertCanEditProject(project, actor)`.
- That is correct for creating a brand new diagram in a project.
- It is incorrect for saving an existing shared diagram when the actor has edit access to the diagram but is not the project owner/editor.
- As a result, a collaborator can edit local session state, but the authoritative persisted document update can be rejected before it is stored.

## Product Gaps Identified

- No direct user-specific sharing records
- No owner-visible people-with-access list
- No role management per shared user
- No general link expiration model
- Link sharing cannot grant editor access
- The main editor UI does not expose a first-class share action next to the top-level admin controls

## Implementation Direction

- Add persisted per-user access entries for projects and diagrams.
- Expand sharing settings into:
  - people with access
  - general access by link
  - viewer/editor roles
  - expiration timestamp
- Enforce expiration and role checks on the server.
- Fix `upsertDiagram()` so existing shared editors can persist to the single canonical stored diagram document.
