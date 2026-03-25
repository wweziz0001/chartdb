# Viewer Readonly And Live Sync Audit

Date: 2026-03-25

## Summary

The shared viewer regressions come from a frontend state mismatch rather than a missing backend permission check.

## Findings

1. `ChartDBProvider` derives `readonly` from the route-only prop and diff mode.
   - File: `src/context/chartdb-context/chartdb-provider.tsx`
   - Current logic: `readonlyProp ?? hasDiff ?? false`
   - Effect: authenticated users who open a shared diagram through the normal editor route do not become read-only when their saved access is `view`.

2. Diagram sessions are opened from the same incorrect `readonly` value.
   - File: `src/context/chartdb-context/chartdb-provider.tsx`
   - Current logic: `activateDiagramSession({ mode: readonly ? 'view' : 'edit' })`
   - Effect: viewers request an edit session, the server rejects it with `403`, and the client drops `diagramSession` to `undefined`.

3. Live update propagation depends on an active collaboration session.
   - File: `src/context/chartdb-context/chartdb-provider.tsx`
   - The SSE subscription only starts when `diagramSession.session.transport.eventsEndpoint` exists.
   - Effect: once the viewer loses the session, they also lose live document updates and only see owner changes after a manual reload.

4. Save and rename actions still expose writable UI paths when `readonly` is not resolved from the persisted access model.
   - Files:
     - `src/pages/editor-page/top-navbar/menu/menu.tsx`
     - `src/context/keyboard-shortcuts-context/keyboard-shortcuts-provider.tsx`
     - `src/pages/editor-page/top-navbar/diagram-name.tsx`
   - Effect: the viewer can enter local editing flows that look writable even though persistence is rejected later.

## Root Cause

There is one authoritative persisted access model, but the editor shell was not deriving its read-only mode from that authoritative access value for authenticated shared viewers.

That mismatch caused two user-facing failures:

- viewers were given a writable client shell
- viewers failed to open a valid `view` collaboration session, so they were excluded from live update propagation

## Fix Direction

1. Resolve diagram access from the saved/persisted diagram metadata inside `ChartDBProvider`.
2. Open viewer sessions in `view` mode so the collaboration stream stays active.
3. Gate save and rename UI with the resolved read-only state.
4. Keep remote refreshes anchored to the canonical persisted diagram state returned by the persistence layer.
