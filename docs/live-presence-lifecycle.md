# Live Presence Lifecycle

Date: 2026-03-25

## Purpose

ChartDB keeps live collaboration presence separate from:

- access control and sharing permissions
- persisted diagram document state
- long-lived diagram session records
- ephemeral cursor state

This document describes the authoritative model used for active participants,
refresh/reconnect handling, and stale cleanup.

## Identity Model

Live presence is keyed by a stable logical participant identity per diagram.

- authenticated users use `user:{ownerUserId}`
- anonymous/shared-link users use `client:{clientId}`
- if neither exists, the server falls back to `session:{sessionId}`

`sessionId` still identifies a concrete connection/session instance, but it is
not the primary identity for participant deduplication.

## Reconnect And Refresh Policy

Refresh/reconnect creates a brand new diagram session id. When that new session
registers presence for the same logical participant:

- the presence broker replaces the older participant entry
- the new session becomes the only active presence owner for that participant
- the old cursor is removed with the replaced presence entry
- header chips and `N live` counts stay aligned to logical active users

This prevents refreshes from stacking duplicate participant avatars or cursors.

## Multiple Tabs Policy

ChartDB treats multiple tabs from the same logical participant as one presence
identity per diagram.

- authenticated users are collapsed per account
- anonymous viewers are collapsed per browser-local collaboration client id
- the newest connected session owns the active presence entry and cursor

This means multi-tab usage does not inflate header participant counts or leave
multiple cursors for the same person.

## Stale Cleanup Strategy

Presence cleanup is authoritative on the server.

- SSE disconnect cleanup unregisters presence when the transport closes
- the server also prunes sessions whose heartbeat is older than 45 seconds
- stale-session pruning removes the participant entry and its cursor together
- active session counts are computed from live logical identities, not stacked
  duplicate sessions

This protects presence accuracy even if a browser refresh or abrupt disconnect
does not deliver a clean close request.

## Cursor Lifecycle

Cursor state is ephemeral and always tied to the active presence entry.

- cursor updates only apply to a currently registered participant session
- replacing or removing that participant removes the cursor
- stale sessions cannot keep a cursor alive after pruning

As a result, remote cursors disappear when a participant disconnects, refreshes,
or is replaced by a newer reconnect session.

## Client Responsibilities

The frontend still has a few important responsibilities:

- use the server collaboration snapshot/event stream as the source of truth
- register a stable browser-local collaboration client id for anonymous users
- render header chips and cursor overlays from the authoritative presence list
- avoid local append-only presence bookkeeping

The client should reconcile to the latest collaboration payload instead of
trying to infer disconnect state on its own.
