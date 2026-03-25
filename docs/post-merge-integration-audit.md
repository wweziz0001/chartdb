# Post-Merge Integration Audit

Date: 2026-03-25
Branch: `feature/post-merge-integration-audit-and-hardening`

## Scope

This audit reviewed the merged ChartDB codebase across backend foundation, persistence, collections, search, import/export, authentication, OIDC, admin bootstrap, admin dashboard, sharing, collaboration, real-time updates, self-hosting, and the PostgreSQL live schema import/diff/apply workflow.

The goal of this document is to record the post-merge state before corrective hardening work, highlight the highest-risk integration gaps, and track which issues are being corrected on this branch.

## Audit Matrix

| Feature Area | Current Status | Duplication Found | Missing Integration Found | Risk | Required Correction | Planned / Implemented | Remaining Limitation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Backend/service architecture | Implemented with clear Fastify route/service/repository split | Route-level access checks are ad hoc | Operational schema-sync endpoints are not aligned with admin access model | High | Centralize request access rules for admin and schema-sync routes | Planned | Some domain rules still live inside services rather than dedicated policy modules |
| Persistence/data model | Strong overall; SQLite-backed app data persists users, projects, diagrams, sharing, sessions | `visibility` and `sharingScope` model overlapping intent | Visibility metadata is reported but not used as the effective access model | Medium | Document the canonical access path and avoid conflicting behavior | Planned docs clarification | `visibility` remains informational unless explicitly wired later |
| Project storage | Implemented end to end | No material duplication found | None found in core CRUD | Low | No major correction required | N/A | Ownership and admin semantics are still simple by design |
| Collections / organization | Implemented and connected to search and project CRUD | No material duplication found | None found in core flows | Low | No major correction required | N/A | No nested collection hierarchy support |
| Search | Implemented in persistence layer and connected to UI | No material duplication found | None found in collections + projects search | Low | No major correction required | N/A | Search remains metadata/string based, not full-text indexed |
| Import / export backup | Implemented with validation and restore workflow | Separate client/server schemas are intentional but require parity checks | Diagram schema-sync metadata is preserved in the document payload, but behavior depends on docs being explicit | Medium | Reconfirm docs and coverage around backup compatibility | Planned docs/tests check | Backups do not include live connection secrets or apply history |
| Authentication | Implemented for optional password auth | No major duplication found | Route protection and bootstrap state are integrated | Low | No major correction required | N/A | Auth-disabled mode intentionally behaves as single-user/local-owner |
| OIDC | Implemented with callback, session, and bootstrap interaction | No major duplication found | Integrated into session flow and route protection | Low | No major correction required | N/A | Provisioning remains intentionally lightweight |
| Admin bootstrap | Implemented and tested | No major duplication found | Correctly connected to auth state | Low | No major correction required | N/A | Only first-admin bootstrap is supported |
| Admin dashboard | Implemented and protected | Dashboard metrics drift from actual sharing capabilities | Sharing is reported as unsupported even though sharing exists | Medium | Align dashboard metrics and docs with real sharing support | Planned | Dashboard remains read-only |
| Sharing / access control | Implemented for authenticated and link-based sharing | Overlap with `visibility` fields causes conceptual drift | Sharing is the real enforced access layer, but admin/dashboard/docs do not consistently say so | Medium | Clarify canonical access model and align reporting | Planned | Link sharing is intentionally read-only in this release |
| Collaboration/session model | Implemented and persisted | No major duplication found | Correctly wired to diagram persistence and access checks | Low | No major correction required | N/A | Session model is optimistic and lightweight |
| Real-time collaboration | Implemented via event stream and session heartbeat | No major duplication found | Integrated with persistence/session updates | Low | No major correction required | N/A | WebSocket transport remains future-facing rather than active |
| Docker / Compose / CI / env / health / logging | Implemented and generally coherent | Frontend/runtime and backend env surfaces are intentionally separate | Docs need to stay explicit about which env vars affect web vs API | Medium | Refresh docs and env documentation | Planned | Compose includes a sample Postgres service even though app persistence remains SQLite |
| PostgreSQL connection management | Implemented with encrypted secret storage and test-connection flow | No major duplication found | Live DB connection operations are not currently aligned with admin controls | High | Restrict operational DB actions when auth is enabled, keep secure defaults, verify errors/logging | Planned | Encryption uses deployment secret key; there is no external KMS integration |
| PostgreSQL live schema import | Implemented for tables, columns, PKs, uniques, indexes, FKs, checks, enums | Canonical model is shared correctly between server and core package | Imported schema state is stored on the diagram, but downstream apply flow does not fully advance that baseline | High | Update post-apply/baseline sync behavior and tighten route governance | Planned | Composite/custom non-enum types remain limited |
| Canonical schema model | Implemented across server/core/frontend adapters | Local diagram model and canonical schema model are intentionally different | No hard drift found, but post-apply metadata handling is incomplete | Medium | Tighten schema-sync metadata updates after apply/import | Planned | Multiple representations still exist by necessity |
| Diff engine | Implemented with rename heuristics, FK validation, enum support, risk analysis | No major duplication found | Preview state is not fully reflected in later apply history | Medium | Improve audit continuity and server-side actor attribution | Planned | Rename heuristics still require human confirmation |
| SQL generation / migration planning | Implemented with ordering and destructive warnings | No major duplication found | Preview and apply history split into separate audit records without continuity | High | Reconcile preview/apply audit handling and reinforce server-side validation | Planned | Destructive changes still require operator review |
| Apply-to-database execution | Implemented server-side with drift check, transactions, preflight, destructive confirmation | Preview/apply auditing is duplicated per plan | Apply authority is not currently tied to admin controls in auth-enabled deployments | High | Enforce admin-only operational access in auth deployments and reuse preview audit context | Planned | Some PostgreSQL DDL remains non-transactional by engine design |
| Apply audit / history / logging | Implemented with audit and job records | Preview audit and apply audit split the same plan lifecycle | Actor attribution currently comes from client payload instead of server-authenticated identity | High | Use server-derived actor identity and keep a single coherent audit chain per plan | Planned | Audit export/reporting is still basic |

## Key Findings

### A. Duplicate or drifting implementations

1. Preview and apply create separate audit records for the same schema change plan.
   - Result: preview metadata and apply execution history are split across records.
   - Risk: audit trails are harder to reason about and can look like duplicate operations.

2. Access semantics are split between `visibility` metadata and `sharingScope` / `sharingAccess`.
   - Result: sharing is the actual enforced model, while visibility is mostly descriptive/reporting metadata.
   - Risk: feature and docs drift, especially in admin/reporting surfaces.

### B. Missing integration

1. Admin dashboard reports sharing as unsupported even though scoped sharing is implemented and tested.
2. Schema-sync operational endpoints are not integrated with the admin/ownership security posture.
   - In auth-enabled deployments, any authenticated user can currently list connections, manage them, import live schemas, preview diffs, and apply live database changes.
3. Schema diff/apply actor attribution is client-provided instead of server-derived.
4. After a successful apply, the editor keeps stale baseline metadata unless the user manually refreshes from the database.
   - Result: subsequent previews can be based on an outdated baseline even though the database already accepted the target state.

### C. Broken or risky architecture

1. Live database operations are not aligned with admin controls.
   - This is the most important hardening gap in the merged codebase.
2. Preview/apply audit duplication weakens the reliability of operational history.
3. Generic errors are used in parts of the schema-sync stack where typed application errors would produce safer and more consistent API behavior.

### D. Missing product behavior

1. Admin reporting does not reflect actual sharing state.
2. Schema-sync apply does not fully reconcile the diagram’s schema-sync metadata with the newly applied database state.
3. Connection selection UX can drift after connection deletion because the selected ID is not revalidated against the refreshed list.

### E. Missing tests or docs

1. Coverage is good overall, but the following need explicit tests after hardening:
   - admin-only schema-sync governance in auth-enabled mode
   - server-side actor attribution for diff/apply
   - audit continuity across preview and apply
   - post-apply baseline advancement in the schema-sync UI flow
   - admin dashboard sharing metrics
2. README and technical docs need to explicitly describe:
   - that schema-sync/apply is an operational/admin capability in auth-enabled deployments
   - that sharing, not visibility, is the enforced external access layer
   - current custom type limitations for schema-sync/apply

## PostgreSQL Schema-Sync Focus Review

### What is working

- Connection secrets are stored encrypted at rest in the metadata database.
- Live PostgreSQL connection testing is server-side.
- Introspection covers:
  - tables and views
  - columns
  - primary keys
  - unique constraints
  - indexes
  - foreign keys
  - check constraints
  - enum types
- Diff planning includes:
  - rename/move heuristics
  - foreign key target validation
  - destructive and warning-level risk analysis
  - additive enum handling
- Apply execution includes:
  - live drift detection before mutation
  - NOT NULL preflight validation
  - destructive confirmation text
  - server-side execution only
  - transaction handling for transactional statements
  - execution logging and persisted job status

### Highest-risk gaps found

1. Live DB operations are not admin-gated in auth-enabled deployments.
2. Diff/apply actor identity is client-controlled.
3. Preview and apply history for the same plan are stored as separate audit records.
4. Successful apply does not fully advance the diagram’s baseline metadata in the editor.

### Known current limitations

- Enum automation is additive-only.
- Non-enum custom PostgreSQL types are not fully automated.
- Link sharing is read-only.
- `visibility` metadata is not the effective access-control mechanism.

## Planned Corrections On This Branch

1. Consolidate route-level access and actor resolution for admin and schema-sync operations.
2. Align admin reporting with actual sharing support.
3. Harden PostgreSQL schema-sync/apply authorization and audit attribution.
4. Reconcile preview/apply audit continuity.
5. Advance client-side schema-sync baseline metadata after successful apply.
6. Update tests and docs to match the corrected behavior.
