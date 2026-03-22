# Schema Sync Architecture

## Overview

ChartDB now ships with a PostgreSQL-first schema synchronization workflow that extends the existing visual editor without exposing database credentials to the browser.

## Major building blocks

### 1. Frontend visual editor

- Existing ChartDB canvas remains the editing surface.
- `SchemaSyncProvider` tracks the selected server-side connection, the imported baseline schema, preview state, and apply results.
- `SchemaSyncToolbar` adds connection management, live import, diff preview, SQL preview, and guarded apply dialogs.

### 2. Canonical schema model

- `shared/schema-sync/canonical.ts` defines the vendor-neutral schema representation.
- The canonical model is used for:
    - live PostgreSQL introspection output
    - editor-to-canonical conversion
    - diff generation
    - migration SQL generation
    - audit snapshots

### 3. Server-side PostgreSQL access

- `server/src/db/postgres-client.ts` contains the PostgreSQL wire-protocol client.
- All credentials stay on the server.
- Saved passwords are encrypted at rest using AES-256-GCM and an environment-provided secret key.

### 4. Diff + migration planner

- `shared/schema-sync/diff.ts` computes change sets, warnings, destructive flags, and rename candidates.
- `shared/schema-sync/postgres-sql.ts` converts the diff into ordered PostgreSQL DDL statements.
- Destructive changes are never auto-approved.

### 5. Safe apply flow

- `server/src/db/postgres-apply.ts` validates the migration plan before execution.
- Destructive operations require:
    - explicit approval checkbox
    - typed confirmation phrase
- Statements execute inside a guarded transaction where possible.

### 6. Audit trail

- `server/src/audit/audit-store.ts` persists import, diff, and apply records as JSON documents.
- Audit payloads capture:
    - connection id
    - baseline snapshot
    - target snapshot
    - diff summary
    - generated SQL
    - execution outcome

## Current supported PostgreSQL operations

- live schema import
- create table
- drop table
- add column
- drop column
- alter type
- alter nullability
- alter default
- add/drop PK
- add/drop FK
- add/drop unique constraints
- add/drop indexes

## Safety notes

- Browser never receives stored passwords back from the server.
- Backend does not execute arbitrary SQL from the UI.
- Rename detection is advisory only; ambiguous rename-like changes surface as warnings.
- Rollback is documented as operator-assisted rather than fully automatic in v1.

## Extension path

The canonical model and connector separation are designed to let future adapters plug in for MySQL, MariaDB, and SQL Server with minimal frontend churn.
