# Sharing Dialog And Live Presence Audit

Date: 2026-03-25

## Summary

ChartDB already has a functional sharing model with:

- direct per-user project and diagram sharing
- general link access
- link role selection
- link expiration enforced by the persistence service

The main gaps for this task are in presence and header integration, not the core access model.

## Findings

1. The sharing dialog already supports most access-management operations.
   - File: `src/dialogs/open-diagram-dialog/sharing-settings-dialog.tsx`
   - Current support includes add/remove people, viewer/editor roles, link access, and expiration controls.
   - Gap: the UX is functional but not yet integrated with active participant presence in the header.

2. The header only shows the Share button and an aggregate live count.
   - Files:
     - `src/pages/editor-page/top-navbar/current-diagram-share-button.tsx`
     - `src/pages/editor-page/top-navbar/diagram-name.tsx`
     - `src/pages/editor-page/top-navbar/top-navbar.tsx`
   - Current state:
     - Share button exists
     - `DiagramName` can show `N live`
   - Gap: no participant identities, no overflow handling, and no separation between “has access” and “is currently present”.

3. The collaboration broker only transports document/session events with an active session count.
   - Files:
     - `server/src/services/diagram-collaboration-broker.ts`
     - `server/src/services/persistence-service.ts`
   - Current collaboration payload contains:
     - document version state
     - realtime endpoint metadata
     - `activeSessionCount`
   - Gap: no participant summaries and no ephemeral cursor state.

4. The client event stream handler only uses collaboration events for:
   - document version refresh
   - active session count updates
   - stale-session handling
   - File: `src/context/chartdb-context/chartdb-provider.tsx`
   - Gap: active participant identity and cursor presence are not modeled anywhere in client state.

5. Cursor handling inside the canvas is currently local-only.
   - File: `src/pages/editor-page/canvas/canvas.tsx`
   - Existing cursor state is only used for relationship creation helpers (`temp-cursor` / floating edge).
   - Gap: there is no session-based remote cursor rendering or broadcasting.

6. Public shared-link pages currently load shared diagrams through dedicated read-only endpoints, not through authenticated diagram sessions.
   - Files:
     - `src/pages/shared-project-page/shared-diagram-page.tsx`
     - `src/pages/shared-project-page/shared-project-diagram-page.tsx`
   - Implication: live presence can be implemented cleanly first for active authenticated diagram sessions; token-based anonymous presence would require additional shared-session plumbing.

## Implementation Direction

1. Keep access-list membership and active presence separate.
2. Extend collaboration state to include active participant summaries and ephemeral cursor payloads.
3. Broadcast presence and cursor updates through the existing diagram collaboration broker.
4. Surface active participants in the header near Share.
5. Render remote cursors as lightweight canvas overlays and exclude the local session from self-cursor rendering.
6. Preserve the existing sharing model and expiration enforcement instead of reworking persistence.
