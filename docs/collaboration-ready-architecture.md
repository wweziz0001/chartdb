# Collaboration-Ready Architecture

## Scope

This change prepares ChartDB for future collaborative editing without turning on full multiplayer yet.

What is included now:

- versioned diagram document metadata on persisted diagrams
- edit-session records with explicit lifecycle and transport hints
- optimistic save hooks for conflict-safe document writes
- frontend session activation, heartbeat, and release hooks in the editor lifecycle
- extension points for future websocket or live-sync transport

What is not included yet:

- live cursor presence
- websocket broadcasting
- remote patch merging
- conflict resolution UI

## Design Goals

The implementation keeps the current single-user editor flow intact while introducing a separate collaboration layer that can grow later.

The design follows three principles:

- diagram persistence stays the source of truth
- session state is tracked separately from the document
- document writes can opt into version checks without requiring live sync

## Backend Model

Each persisted diagram now carries collaboration-aware document metadata:

- `documentVersion`
- `documentUpdatedAt`
- `lastSavedSessionId`
- `lastSavedByUserId`

This metadata is stored alongside the existing `document_json` payload in `app_diagrams`.

ChartDB also now stores edit-session records in `app_diagram_sessions`:

- `id`
- `diagramId`
- `ownerUserId`
- `mode`
- `status`
- `clientId`
- `baseVersion`
- `lastSeenDocumentVersion`
- heartbeat and close timestamps

This split mirrors the separation used in collaborative products such as ExcaliDash:

- the document remains durable state
- the session describes who is editing and what version they started from
- transport details live beside the session rather than inside the editor reducer

## API Surface

Diagram responses now include a `collaboration` block with:

- current document version metadata
- active session count
- realtime transport capability hints

New edit-session endpoints:

- `POST /api/diagrams/:id/sessions`
- `GET /api/diagrams/:id/sessions/:sessionId`
- `PATCH /api/diagrams/:id/sessions/:sessionId`

Diagram writes also accept:

- `sessionId`
- `baseVersion`

When `baseVersion` is stale, the API rejects the write with `DIAGRAM_VERSION_CONFLICT`.

## Frontend Integration

`StorageProvider` now owns the active diagram session map and uses it to enrich the existing auto-sync path.

`ChartDBProvider` now:

- activates an edit session when a diagram loads
- heartbeats the active session while the editor stays open
- releases the session on diagram teardown
- forwards session/version metadata through explicit saves

This means future realtime transports can plug into the same session state without replacing the current editor context model.

## Conflict-Safe Foundation

Today, conflict protection is optimistic and save-based:

- each session starts from a known `baseVersion`
- saves include that base version
- the server increments the version when the document changes
- stale saves are rejected instead of silently overwriting newer work

This gives ChartDB a safe foundation for later work such as:

- websocket subscriptions per diagram session
- server-authoritative presence
- incremental operation streaming
- conflict resolution UI and recovery flows

## Migration Notes

Existing diagrams are preserved.

The new migration backfills collaboration metadata by:

- defaulting document versions to `1`
- copying `updated_at` into `document_updated_at`
- leaving session-linked fields empty until a session is created

## Testing

The collaboration foundation is covered with targeted validation for:

- session creation and lifecycle
- document version increments
- optimistic conflict rejection on stale saves
