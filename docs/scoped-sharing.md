# Scoped Sharing

ChartDB supports scoped sharing for saved projects and diagrams.

## Sharing Modes

- `private`
  Only the owner and ChartDB administrators can open the resource.
- `authenticated`
  Any signed-in ChartDB user can open the resource. The owner chooses whether that access is `view` or `edit`.
- `link`
  Anyone with the generated link can open the resource through the shared route. Link sharing is intentionally `view`-only in v1.

Projects and diagrams each have their own sharing settings. A shared project makes its saved diagrams available through the project link or the authenticated workspace scope. A diagram can also be shared directly on its own.

## Security Behavior

- Private resources stay behind normal authenticated routes.
- Signed-in access is enforced server-side on every list, read, and mutation route.
- Link sharing uses an unguessable random token embedded in the shared URL path.
- Shared links are read-only in this release to avoid accidental edit exposure.
- Rotating a shared link invalidates the previous token immediately.
- Sharing settings are owner/admin managed. Non-owners cannot read or mutate sharing configuration.

## Current Limitations

- No real-time collaboration is added by this feature.
- Link sharing is read-only even if authenticated sharing for the same item is editable.
- Backup import resets imported resources to `private` sharing so previously issued links are not resurrected accidentally.

## Routes

- Owner-managed settings:
  - `GET /api/projects/:id/sharing`
  - `PATCH /api/projects/:id/sharing`
  - `GET /api/diagrams/:id/sharing`
  - `PATCH /api/diagrams/:id/sharing`
- Public shared access:
  - `GET /api/shared/projects/:id/:shareToken`
  - `GET /api/shared/projects/:id/:shareToken/diagrams/:diagramId`
  - `GET /api/shared/diagrams/:id/:shareToken`

## UI Flow

- Open the saved-project dialog.
- Select a project and use `Share Project`, or use a diagram row menu and choose `Share`.
- Choose `Private`, `Signed-in users`, or `Anyone with the link`.
- For authenticated sharing, choose `View only` or `Editable`.
- For link sharing, copy the generated read-only URL or rotate it to revoke the previous link.
