You are Codex acting as a principal engineer, codebase integration auditor, post-merge refactoring specialist, schema-sync reviewer, and self-hosted product hardening reviewer.

TARGET REPOSITORY:
https://github.com/wweziz0001/chartdb

WORKING BRANCH:
feature/post-merge-integration-audit-and-hardening

PULL REQUEST TITLE:
Post-merge integration audit, deduplication, schema-sync review, gap fixing, and hardening for ChartDB

==================================================
MISSION
==================================================

The repository has already gone through a large multi-branch implementation effort.

A total of 14 major feature efforts have been merged into main, including:

1. backend foundation
2. persistence
3. project storage
4. collections / organization
5. search
6. import / export backup
7. optional authentication
8. OIDC
9. admin bootstrap
10. admin dashboard
11. scoped sharing
12. collaboration foundation
13. real-time collaboration
14. live PostgreSQL integration with schema import, visual editing, diff / migration generation, and apply-to-database execution

Your task now is NOT to add a brand new large feature.

Your task is to perform a deep POST-MERGE INTEGRATION AUDIT of the current main branch, including the PostgreSQL schema-sync and apply workflow, identify all overlap, duplication, inconsistency, missing pieces, broken flows, architectural drift, incomplete integrations, and risky behavior, and then implement the necessary corrections directly in the repository.

==================================================
PRIMARY GOALS
==================================================

You must inspect the current merged codebase and determine:

1. Which features are fully implemented and correctly integrated
2. Which features exist only partially
3. Which features are duplicated in code, UI, API, models, or workflows
4. Which features overlap in confusing or redundant ways
5. Which features were implemented in separate branches but are not properly wired together after merge
6. Which architectural inconsistencies now exist due to parallel branch work
7. Which missing validations, route protections, or UI flows make features incomplete
8. Which test gaps now exist
9. Which docs are outdated, duplicated, or contradictory
10. Which refactors are necessary to make the merged result coherent and production-minded
11. Whether the live PostgreSQL schema import / diff / apply flow is correctly integrated with the rest of the platform
12. Whether database migration/apply behavior is safe, consistent, validated, and documented

==================================================
WHAT YOU MUST DO
==================================================

You must perform this task in 5 major phases.

==================================================
PHASE 1 — INVENTORY AND AUDIT
==================================================

Read the actual merged chartdb codebase and produce an internal capability inventory of the currently implemented features.

For each major area, determine:
- whether it exists
- whether it is complete
- whether it is partially implemented
- whether there are duplicate implementations
- whether the frontend and backend are fully connected
- whether data models align with APIs and UI
- whether access control is correctly enforced
- whether tests exist and are meaningful
- whether docs reflect reality

Audit at minimum these areas:
- backend/service architecture
- persistence/data model
- project storage
- collections/organization
- search
- import/export backup
- authentication
- OIDC integration
- admin bootstrap
- admin dashboard
- sharing/access control
- collaboration/session model
- real-time collaboration
- Docker / Compose / CI / env config / health checks / logging
- PostgreSQL connection management
- PostgreSQL live schema import
- canonical schema model if present
- schema diff engine
- SQL/migration generation
- apply-to-database execution flow
- schema validation and destructive-change protections
- audit/history/logging for apply operations

==================================================
PHASE 2 — DETECT DUPLICATION, GAPS, AND INCONSISTENCIES
==================================================

You must explicitly identify and classify issues in the merged codebase.

Classify findings into:

A. Duplicate implementations
Examples:
- duplicated API routes
- duplicated models
- duplicated state management
- duplicated auth checks
- duplicated config loading
- duplicated UI flows
- duplicated PostgreSQL connection handling
- duplicated type classification or schema-diff logic
- duplicated SQL generation or apply validation

B. Missing integration
Examples:
- backend exists but UI not wired
- UI exists but API missing
- model exists but not used
- feature exists but not protected by auth/permissions
- OIDC configured but not integrated into user/session flow
- admin dashboard exists but not linked to bootstrap/admin role logic
- PostgreSQL import exists but saved projects do not preserve imported schema state correctly
- apply-to-database exists but does not align with sharing, auth, or admin controls
- schema diff exists but import/export backup does not preserve required metadata

C. Broken or risky architecture
Examples:
- circular dependencies
- inconsistent ownership model
- multiple competing persistence patterns
- fragmented route structure
- duplicated environment parsing
- sharing/collaboration/auth not using the same access model
- live database connection logic mixed unsafely into frontend code
- apply flow bypassing centralized validation
- unsafe handling of destructive migration operations

D. Missing product behavior
Examples:
- save exists but rename/delete incomplete
- collections exist but search ignores them
- sharing exists but import/export ignores permissions metadata
- collaboration exists but project persistence not integrated with session state
- PostgreSQL schema import works but refresh/re-import flow is incomplete
- diff preview works but apply result is not persisted or auditable
- migration SQL preview exists but destructive warnings are incomplete
- connection test exists but secure credential handling is inconsistent

E. Missing tests or docs
Examples:
- features implemented without tests
- docs no longer match code
- env vars undocumented
- setup flows incomplete
- PostgreSQL schema-sync/apply behavior undocumented or partially documented
- destructive migration safeguards not covered by tests

==================================================
PHASE 3 — SPECIAL POSTGRESQL SCHEMA-SYNC REVIEW
==================================================

Perform a focused review of the live PostgreSQL integration and schema synchronization workflow.

You must inspect and verify:

1. connection management
- test connection flow
- credential handling
- storage/encryption of connection metadata if implemented
- environment/config consistency

2. live schema import
- whether tables, columns, keys, indexes, constraints, and relevant types are imported correctly
- whether imported schema is preserved consistently in editor/project state
- whether refresh/re-import behavior is coherent

3. canonical schema / internal model
- whether imported schema, edited schema, and persisted schema use one coherent model
- whether there are duplicate representations causing drift

4. diff and preview
- whether schema changes are correctly detected
- whether preview matches actual apply behavior
- whether risky/destructive changes are clearly surfaced

5. SQL generation / migration planning
- whether generated SQL is ordered correctly
- whether dependency handling is sound
- whether PostgreSQL-specific behaviors are respected
- whether enum/custom type support and similar schema objects are handled coherently if present

6. apply-to-database execution
- whether apply is server-side only
- whether arbitrary unsafe execution paths exist
- whether validation is centralized
- whether destructive changes require explicit confirmation
- whether failures are captured and surfaced properly

7. platform integration
- whether auth/permissions protect real database operations
- whether admin/ownership/sharing rules affect who may import/apply
- whether collaboration and persistence interact correctly with imported live schemas
- whether audit/history captures real database operations properly

8. safety and production readiness
- whether secrets are protected
- whether logs avoid leaking credentials
- whether dangerous operations are gated
- whether docs match the real behavior
- whether tests cover the main schema-sync/apply flows

==================================================
PHASE 4 — IMPLEMENT CORRECTIONS
==================================================

After auditing, directly implement the required corrections in the repository.

You must:
- remove or consolidate duplicate implementations
- connect incomplete frontend/backend flows
- unify inconsistent models and route patterns
- fix missing protections or validations
- close obvious feature gaps
- improve maintainability where merge history caused architectural drift
- reconcile PostgreSQL schema-sync/apply logic with the rest of the platform
- update tests
- update docs

IMPORTANT:
Do not rewrite the whole repository.
Do not remove major working features unnecessarily.
Prefer consolidation and integration hardening over large redesigns.
Prefer safe fixes over risky rewrites.

==================================================
PHASE 5 — FINAL INTEGRATION HARDENING
==================================================

After fixing issues, ensure the merged result is coherent.

You must verify:
- app builds successfully
- tests pass or are updated appropriately
- new and existing routes are wired correctly
- auth, OIDC, admin, sharing, collaboration, and schema-sync flows do not conflict
- env config is not duplicated or contradictory
- Docker / Compose / CI remain valid
- docs match the real system
- PostgreSQL live import / diff / apply is correctly integrated and safely guarded

==================================================
MANDATORY AUDIT OUTPUT MODEL
==================================================

Internally reason using an audit matrix for each major feature area with columns like:
- feature area
- current implementation status
- duplication found
- missing integration found
- risk level
- required correction
- correction implemented
- remaining limitation

Use that matrix to drive implementation.

Pay special attention to silent duplication:
- multiple representations of the same entity
- multiple validation layers with inconsistent rules
- multiple route patterns for the same resource
- duplicate frontend state shapes for the same backend object
- duplicated auth/access logic
- duplicated env/config parsing
- duplicated schema models or diff logic
- duplicated SQL/apply validation paths

==================================================
MANDATORY COMMIT DISCIPLINE
==================================================

You must create real git commits while working.

This is mandatory.

Rules:
- Do not leave all changes uncommitted until the end.
- Do not provide only suggested commit messages.
- Do not squash the whole task into one giant commit.
- Create commits in logical, reviewable phases.
- Commit immediately after each major phase is completed.

Minimum required commit sequence:
1. chore: audit merged feature set and identify duplication and integration gaps
2. refactor: consolidate duplicated models routes configuration or schema-sync logic
3. fix: wire incomplete feature flows and close integration gaps
4. fix: harden PostgreSQL schema import diff and apply integration
5. test: add or update coverage for merged feature behavior
6. docs: update README and technical docs after post-merge audit

If one of these phases does not apply exactly, adjust slightly but keep the same discipline and explain the adjustment in the final report.

Before finishing, you must provide:
- git status
- git log --oneline -n 20
- a short explanation of each commit created

The task is incomplete if the implementation is done but commit discipline was not followed.

==================================================
EXECUTION RULES
==================================================

- Work only on this post-merge audit and hardening task.
- Do not start unrelated new features.
- If you find a missing prerequisite, add only the minimum required fix.
- Prefer consolidation over expansion.
- Prefer maintainability over cleverness.
- Prefer consistent architecture over branch-by-branch leftovers.
- Do not stop at reporting problems; fix them directly in the repository.
- Do not provide only recommendations.
- Implement the corrections.

==================================================
DEVOPS AND OPERATIONS CHECKS
==================================================

As part of the post-merge audit, verify and correct where needed:
- .env.example completeness
- environment variable consistency
- secret handling
- Dockerfile consistency
- docker-compose consistency
- health endpoints
- structured logging
- CI workflow alignment with actual build/test commands
- reverse-proxy/deployment docs consistency

Also verify PostgreSQL integration operationally:
- connection-related env/config docs
- secure handling of connection settings
- no credentials leaked in logs
- schema apply safety notes in docs
- local/dev instructions for running and testing schema-sync flows

==================================================
TESTING REQUIREMENTS
==================================================

You must review the merged test situation and improve it where necessary.

At minimum:
- remove or reconcile redundant tests
- add missing tests for key integration paths
- verify tests match actual current behavior
- add integration-oriented tests where merge defects are likely

Focus especially on:
- save/open/update/delete flows
- collections + search interaction
- auth + OIDC interaction
- admin bootstrap + admin dashboard interaction
- sharing + access protection
- collaboration session access rules
- import/export compatibility with persisted models
- PostgreSQL connection test
- live schema import behavior
- diff preview consistency
- destructive change safeguards
- apply execution flow and error handling

==================================================
DOCUMENTATION REQUIREMENTS
==================================================

Update documentation so it matches the merged and corrected system.

At minimum update:
- README
- environment variables documentation
- setup instructions
- auth/OIDC setup
- admin bootstrap/admin behavior
- sharing/collaboration behavior
- persistence/search/collections/import-export behavior
- PostgreSQL live connection, import, preview, and apply behavior
- Docker/Compose/self-hosting notes
- current limitations

Also add a dedicated audit summary document, for example:
docs/post-merge-integration-audit.md

==================================================
FINAL DELIVERABLES
==================================================

You must provide all of the following:

1. actual repository code changes on the audit branch
2. duplicate/redundant code consolidated where needed
3. missing integrations fixed where needed
4. PostgreSQL schema-sync/apply workflow reviewed and corrected where needed
5. tests updated
6. docs updated
7. final engineering report including:
   - audited feature inventory
   - duplicate areas found
   - missing areas found
   - PostgreSQL live integration findings
   - fixes applied
   - remaining known limitations
   - actual commit list created during this task

==================================================
START NOW
==================================================

Start by:
1. auditing the current merged main branch
2. building a feature inventory from actual code
3. identifying duplication and gaps, including the PostgreSQL live schema-sync/apply flow
4. implementing the highest-impact corrections directly
5. committing in logical phases as required
6. summarizing the completed audit and fixes


Special emphasis:
Treat the PostgreSQL live schema import / migration / apply capability as a first-class audited feature, not as a side detail.
It must be reviewed together with persistence, auth, admin, sharing, collaboration, testing, and operational safety.


Git workflow is part of the acceptance criteria.

The task is NOT complete unless:
- real commits were created
- commits follow the required logical sequence
- work is not left as one uncommitted patch
- final output includes the actual commit list

If implementation is correct but commits are missing or badly grouped, the task is considered incomplete.
