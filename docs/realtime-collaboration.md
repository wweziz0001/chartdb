# Real-Time Collaboration

## Scope

ChartDB now supports a first practical version of real-time collaboration for persisted diagrams.

What ships in this version:

- authenticated collaborators can join the same diagram editing session
- active editors receive session and document updates in near real time
- the editor shows a basic live participant count
- saves remain version-checked so newer persisted diagram state is never silently overwritten

What stays out of scope for now:

- cursor broadcasting
- field-by-field or shape-by-shape operational merging
- collaborative editing through public share-link viewers
- conflict resolution beyond stale-session reload

## Architecture

The collaboration flow builds on the existing persistence/session foundation described in [`docs/collaboration-ready-architecture.md`](./collaboration-ready-architecture.md).

The first live transport uses three layers:

1. Persisted diagram sessions
   Each editor joins with `POST /api/diagrams/:id/sessions` and keeps that session alive with heartbeats.

2. Server-sent events
   `GET /api/diagrams/:id/events?sessionId=...` streams collaboration events for the diagram.
   The server broadcasts:
   - `snapshot` when a client connects or reconnects
   - `session` when a participant joins, idles, or leaves
   - `document` when a diagram save produces a newer persisted version

3. Existing debounced autosync
   The browser still writes whole-diagram snapshots through the existing persistence pipeline.
   Remote editors use the event stream as a signal to refresh from the server when it is safe to do so.

This is intentionally closer to “server-authoritative snapshots with live invalidation” than a CRDT or OT system.

## Shared Editing Flow

- A collaborator opens the diagram through the authenticated editor flow.
- `ChartDBProvider` activates a diagram session in `view` or `edit` mode.
- `StorageProvider` keeps local autosync, session state, and cached snapshots in sync with the server.
- The editor subscribes to the diagram event stream.
- When another session saves:
  - editors without pending local sync refresh to the latest persisted snapshot automatically
  - editors with a local sync in flight defer refresh briefly
  - editors that lose a version race become `stale` and must reload before continuing

## Permissions

Realtime collaboration uses the same access model as persisted diagrams:

- private diagrams reject non-owners
- authenticated collaborators can only join sessions when the diagram or project sharing rules allow it
- edit sessions still require `edit` or `owner` access
- event-stream subscriptions validate both diagram visibility and the referenced session id

## Setup

For practical multi-user collaboration, use an authenticated ChartDB deployment.

1. Enable a multi-user auth mode such as password auth or OIDC.
2. Start the web app and API together with `npm run dev:full`.
3. Share the target project or diagram with authenticated `edit` access.
4. Have collaborators sign in and open the same diagram from the main editor UI.

Notes:

- Public share-link routes remain read-only viewers in this version.
- The event stream uses same-origin cookies, so the web app and API should remain deployed behind the same origin or proxy arrangement already used for authenticated ChartDB sessions.

## Limitations

- Collaboration is snapshot-based, not operation-based.
- Concurrent edits to the same diagram can still produce a stale session that requires reload.
- Undo/redo history is local to each browser session.
- Presence is intentionally minimal and currently represented as an active participant count.
- Shared-viewer routes do not join live edit sessions yet.

## Testing

Server coverage now includes:

- event-stream access control
- participant join/leave lifecycle broadcasts
- document update broadcasts across collaborators
- existing sharing and optimistic-version persistence tests
