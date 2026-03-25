# Sharing Live Sync And Readonly Behavior

## Overview

ChartDB shared diagrams use one authoritative persisted document state.

- Owners and editors can update that persisted state.
- Viewers can open the same shared document in read-only mode.
- Live collaboration events are delivered through diagram sessions, including read-only viewer sessions.

## Permission Model

### Owner

- Can edit and save diagrams
- Can manage sharing and access
- Receives live collaboration updates

### Editor

- Can edit and save shared diagrams
- Receives live collaboration updates
- Cannot manage ownership or sharing unless separately granted

### Viewer

- Can open a shared diagram
- Always uses read-only editor behavior
- Cannot save, rename, delete, clear, or otherwise persist diagram mutations
- Still receives live updates from owners and editors

## Read-only Enforcement

Viewer access is enforced in multiple layers:

1. The server refuses edit sessions for viewers.
2. The server refuses diagram mutations from viewers.
3. The editor shell derives read-only mode from the authoritative saved access record.
4. The UI disables save-oriented and destructive actions for viewers.
5. The editor header shows a `View only` badge so the state is explicit.

This prevents the old failure mode where a viewer appeared to edit locally even though their changes could never persist.

## Live Update Propagation

When a shared diagram is opened, the client starts a collaboration session:

- editors open an `edit` session
- viewers open a `view` session

Both session types can subscribe to the diagram event stream.

When the owner or an editor saves a new version:

- the server updates the canonical persisted diagram document
- the server emits a collaboration document event
- viewer sessions receive that event and refresh from the authoritative remote diagram state

This means viewers no longer need a manual page refresh to see owner/editor changes during normal shared collaboration.

## Authoritative State Handling

The editor now refreshes shared state through one authoritative load path:

- fetch the latest persisted diagram document
- fetch the latest saved access metadata
- update the local editor state from that authoritative snapshot
- keep the collaboration session aligned with the resolved access mode

This keeps read-only behavior, saved access, and live refresh behavior synchronized.

## Current Limitation

Live update delivery depends on the browser maintaining the diagram event stream connection. If the stream disconnects, the viewer may temporarily stop receiving immediate updates until the session reconnects or the diagram is reloaded.
