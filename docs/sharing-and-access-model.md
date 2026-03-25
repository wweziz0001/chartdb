# Sharing And Access Model

ChartDB now uses a single enforced sharing model across projects, diagrams, and collaborative editing.

## Roles

- `owner`
  - Full control over the resource
  - Can edit content
  - Can manage sharing
  - Can remove access and change general link settings
- `viewer`
  - Can open and view the resource
  - Cannot modify content
  - Cannot manage sharing
- `editor`
  - Can open and edit the resource
  - Cannot manage sharing
  - Cannot escalate their own permissions

## People With Access

Owners can grant direct access to specific existing ChartDB users.

- Direct shares are persisted server-side.
- Direct shares can be granted at the project level or diagram level.
- Project-level direct access applies across the project.
- Diagram-level direct access applies to that individual diagram.
- Owners are shown separately and are not editable through the sharing dialog.

## General Access

Owners can also configure link-based general access.

- `restricted`
  - No general link access is granted
- `anyone with the link`
  - Access is granted only when the link token is valid
  - The owner chooses whether the link is `viewer` or `editor`
  - The owner can set an expiration timestamp

### Expiration

- Link expiration is enforced on the server.
- When a link expires, ChartDB automatically disables that link share.
- Expired links stop granting access immediately.
- Fetching the sharing settings after expiration returns the resource to restricted mode.

## Enforcement

All access control is enforced in backend persistence logic, not only in the frontend.

- Viewers cannot start edit sessions or save changes.
- Editors can edit, save, and participate in collaborative sessions.
- Editors cannot read or mutate sharing configuration endpoints.
- Owners continue to have full access even when link settings or direct shares change.

## Shared Editing Persistence

ChartDB keeps one authoritative persisted diagram document on the server.

- Local editor changes are synchronized into that canonical persisted document.
- Diagram sessions still use optimistic document versions and realtime events.
- Shared editor saves now authorize against the existing diagram access model instead of assuming project ownership.
- That means a directly shared editor can persist changes correctly even when they do not own the surrounding project.
- Owner reloads and collaborator reloads both resolve from the same persisted document state.

## Practical Behavior

- If an editor changes a shared diagram and saves, the persisted diagram document is updated.
- Owners see the new document after reload.
- Active collaborators receive document-version updates through the collaboration event stream.
- Reopening the shared diagram restores the saved editor changes.

## Known Limitations

- The sharing dialog currently lists direct access entries for the current resource. Inherited access from a parent project is enforced, but it is not separately surfaced inside a diagram-level sharing dialog row list yet.
- The legacy authenticated-wide sharing mode is still accepted for compatibility, but the primary UX is now direct people sharing plus general link access.
