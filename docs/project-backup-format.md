# ChartDB Project Backup Format

ChartDB project backup import/export uses a JSON archive with an explicit
format name and version.

## File format

- Recommended extension: `.chartdb-backup.json`
- MIME type when downloaded: `application/json`
- Top-level format marker: `chartdb-backup`
- Current supported `formatVersion`: `1`

## Archive shape

```json
{
  "format": "chartdb-backup",
  "formatVersion": 1,
  "exportedAt": "2026-03-22T17:00:00.000Z",
  "scope": "all-projects",
  "counts": {
    "collectionCount": 1,
    "projectCount": 2,
    "diagramCount": 3
  },
  "collections": [],
  "projects": [],
  "diagrams": []
}
```

### `collections[]`

- `id`
- `name`
- `description`
- `ownerUserId`
- `createdAt`
- `updatedAt`

### `projects[]`

- `id`
- `name`
- `description`
- `collectionId`
- `ownerUserId`
- `visibility`
- `status`
- `createdAt`
- `updatedAt`

### `diagrams[]`

- `id`
- `projectId`
- `name`
- `description`
- `databaseType`
- `databaseEdition`
- `visibility`
- `status`
- `createdAt`
- `updatedAt`
- `diagram`

The nested `diagram` document contains the saved ChartDB diagram payload,
including tables, relationships, dependencies, areas, custom types, notes,
and schema-sync metadata when present.

## Export behavior

- `Current saved diagram` exports the selected diagram plus its parent project
  metadata and referenced collection metadata.
- `Current saved project` exports that project and all of its saved diagrams.
- `All saved projects` exports every saved project, diagram, and referenced
  collection in the ChartDB library.
- Existing SQL export behavior is separate and unchanged.

## Import behavior

- Imports validate `format` and `formatVersion` before restore.
- Imports reject malformed JSON, duplicate ids inside the archive, broken
  project-to-collection references, and broken diagram-to-project references.
- Imports create new ChartDB ids on restore to avoid overwriting existing saved
  content.
- Diagram, project, and collection names are preserved where possible.
- Imported diagrams are restored into the saved project library and can be
  opened immediately after import.

## Compatibility rules

- `format` must be exactly `chartdb-backup`.
- `formatVersion` must currently be exactly `1`.
- Unsupported versions fail with an explicit error instead of attempting a
  partial import.

## Limitations

- Backup import/export targets saved ChartDB library content, not unsaved local
  browser-only diagrams.
- Restores are additive. Existing projects and diagrams are not updated in
  place.
- Ownership metadata in the archive is preserved in the file, but restored
  records are assigned to the current ChartDB application owner.
