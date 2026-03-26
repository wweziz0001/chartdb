# Live Presence Refresh/Reconnect Audit

Date: 2026-03-25

## Root Cause

The duplicate participant and stale cursor bug comes from the authoritative
presence model using `sessionId` as the only identity for active presence.

- `registerDiagramPresence` adds participants by `sessionId`
- `unregisterDiagramPresence` removes participants by `sessionId`
- browser refresh creates a brand new diagram session before the old session is
  reliably closed
- the broker therefore accepts both the old and new entries as separate active
  participants
- cursor state is attached to those participant entries, so stale cursor
  overlays remain until the exact old `sessionId` is removed

## Additional Lifecycle Gaps

- abrupt disconnects rely primarily on transport close cleanup
- stale sessions are not authoritatively pruned from presence using heartbeat
  age
- the frontend already replaces server snapshots instead of appending blindly,
  so the duplicate source is the server-side presence registry
- anonymous/shared sessions do not have a stable browser-local participant
  identity yet

## Fix Direction

1. Introduce a stable effective participant identity for live presence.
2. Deduplicate presence on reconnect/refresh so the latest live connection
   replaces older presence for the same logical participant.
3. Prune stale sessions and orphaned presence entries from the authoritative
   server-side lifecycle.
4. Keep cursor state ephemeral and remove it when presence is replaced or
   disconnected.
5. Document the multiple-tab policy explicitly so header chips and cursor
   rendering remain predictable.
