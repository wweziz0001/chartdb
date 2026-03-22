# Project Collections

ChartDB now supports a flat collection model for organizing saved work.

## How it works

- Collections are optional containers for saved projects.
- A project may belong to one collection or remain unorganized.
- Diagrams stay inside projects, so diagrams are effectively grouped by the collection of their parent project.
- Collections are flat in v1: there is no nesting, folder tree, or workspace hierarchy.

## Data model

Collections store:

- `id`
- `name`
- `description` (optional)
- `ownerUserId` (placeholder for future ownership scopes)
- `createdAt`
- `updatedAt`

Projects now store an optional `collectionId`.

## Organization behavior

- Creating a collection does not move existing projects automatically.
- Moving a project to a different collection updates only the project metadata.
- Deleting a collection does not delete any projects or diagrams.
- When a collection is deleted, its projects become unorganized.

## UI behavior

- `Open Saved Project` now has a collections column, a project column, and a diagram column.
- The dialog includes a single search box for quickly narrowing collections, projects, and diagrams.
- The collections column includes:
    - `All Projects`
    - `Unorganized`
    - user-created collections
- Selecting a collection filters the project list.
- Selecting a project shows its diagrams and lets you move that project into another collection.
- `Save Diagram As` can create a new project directly inside a chosen collection.

## Search behavior

- Search is case-insensitive and uses substring matching.
- Project search matches:
    - project name
    - project description
    - collection name and description
    - related diagram names and descriptions
    - saved diagram database type and edition
    - saved table names and schema names when present in the persisted diagram document
- Diagram search inside a selected project matches diagram metadata directly.
- If the search term matches the selected project's own metadata or collection name, the diagram list keeps showing that project's diagrams so the project remains explorable.

## API surface

- `GET /api/collections`
- `POST /api/collections`
- `PATCH /api/collections/:id`
- `DELETE /api/collections/:id`
- `GET /api/projects?collectionId=<id>`
- `GET /api/projects?unassigned=true`
- `GET /api/projects?search=<term>`
- `GET /api/projects?search=<term>&collectionId=<id>`
- `GET /api/projects/:id/diagrams?search=<term>`

## Limitations

- Search is not fuzzy-ranked; it only checks normalized substring matches.
- Table and schema matching depends on those names being present in the saved diagram document metadata.
- Search currently focuses on saved library metadata, not SQL content or full-text indexing.

## Testing coverage

- collection CRUD
- moving a project into and out of a collection
- listing projects by collection
- exact-match, partial-match, empty-result, and combined-filter search coverage
