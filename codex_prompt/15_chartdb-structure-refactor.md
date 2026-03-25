You are Codex acting as a principal full-stack architect, repository organization specialist, and structural refactoring engineer.

SOURCE REPOSITORY TO ANALYZE FOR ORGANIZATIONAL PATTERNS:
https://github.com/wweziz0001/ExcaliDash

TARGET REPOSITORY TO RESTRUCTURE:
https://github.com/wweziz0001/chartdb

WORKING BRANCH:
feature/chartdb-structure-refactor

PULL REQUEST TITLE:
Restructure ChartDB repository using ExcaliDash-inspired organization patterns

==================================================
MISSION
==================================================

Your task is to inspect the actual repository organization of ExcaliDash and use its strongest structural and organizational patterns to improve the repository layout of chartdb.

This task is about:
- repository structure
- folder organization
- boundary clarity
- operational file placement
- config organization
- test organization
- self-hosted discoverability
- maintainability

This task is NOT about copying product features.
Do not turn chartdb into ExcaliDash.
Preserve chartdb’s identity as a database diagram and schema-sync platform.

==================================================
MANDATORY PROCESS
==================================================

You must follow this sequence exactly.

STEP 1 — AUDIT EXCALIDASH STRUCTURE
Inspect ExcaliDash and identify the structural patterns that make it well organized.
Pay special attention to:
- backend/frontend separation
- e2e placement
- oidc/keycloak placement
- scripts placement
- docker-compose file strategy
- Makefile presence
- RELEASE.md / VERSION
- operational clarity in repository root

STEP 2 — AUDIT CURRENT CHARTDB STRUCTURE
Inspect chartdb and identify:
- overloaded folders
- unclear boundaries
- mixed concerns
- misplaced operational files
- weak discoverability of backend/frontend/core/auth/tests/docs/deploy structure

STEP 3 — PRODUCE A TARGET FOLDER TREE BEFORE IMPLEMENTING
Before moving files or refactoring structure, you must produce an explicit target repository tree for chartdb.

This target tree must show the intended top-level structure and major subdirectories.
For example, clearly indicate where these concerns should live:
- frontend app
- backend/server
- schema-sync core/domain logic
- auth / oidc
- persistence / data access
- admin
- collaboration
- docs
- scripts
- tests
- e2e
- deployment / self-hosted files
- environment/config documentation

You must not start the reorganization until you have internally defined this target structure.

STEP 4 — VALIDATE THE TARGET STRUCTURE AGAINST REALITY
Before implementing, verify that the target tree:
- fits chartdb’s actual codebase
- does not introduce unnecessary churn
- does not break build/test/runtime assumptions more than necessary
- improves discoverability and architectural clarity
- borrows the right organizational ideas from ExcaliDash without blindly copying

STEP 5 — IMPLEMENT THE REORGANIZATION
Then implement the new structure directly in chartdb by:
- moving or regrouping files/folders where justified
- improving naming and boundaries
- introducing clearer structural areas if needed
- updating imports, build config, scripts, tests, docs, and Docker/Compose paths accordingly

STEP 6 — VERIFY
After reorganization:
- ensure builds still work
- ensure tests still work
- ensure docs reflect the new structure
- ensure Docker/Compose/config paths remain valid

==================================================
STRUCTURAL GOALS
==================================================

Use ExcaliDash as inspiration for repository organization quality, especially around:
- clean top-level separation
- self-hosted operational clarity
- dedicated integration/test areas
- clearer identity-related/config-related boundaries
- obvious placement of tooling and release/process files

Improve chartdb in these areas:

1. Top-level organization
2. Frontend/backend boundary clarity
3. Schema-sync core/domain placement
4. Auth/OIDC/config placement if present
5. Test and e2e discoverability
6. Scripts/tooling placement
7. Deployment/self-hosted file clarity
8. Documentation layout clarity

==================================================
NON-GOALS
==================================================

Do NOT:
- rewrite the entire application
- introduce a huge monorepo migration unless clearly justified
- move files around without a clear structural reason
- rename things gratuitously
- remove working features
- change chartdb’s product identity

==================================================
MANDATORY COMMIT DISCIPLINE
==================================================

You must create real git commits during the task.

Rules:
- do not leave all changes until the end
- do not provide only suggested commit messages
- do not squash everything into one giant commit
- commit after each major logical phase

Required commit sequence:
1. chore: audit excalidash and chartdb repository structure
2. docs: add target chartdb repository tree and restructuring plan
3. refactor: reorganize chartdb folders and architectural boundaries
4. refactor: update config scripts imports and build paths for new layout
5. test: fix or update tests after repository reorganization
6. docs: update repository structure and developer documentation

Before finishing, provide:
- git status
- git log --oneline -n 20
- a short explanation of each commit

The task is incomplete if:
- no explicit target folder tree was created first
- the reorganization was done without a structural plan
- commits were not made in logical phases

==================================================
MANDATORY TARGET-TREE REQUIREMENT
==================================================

You must create a document before the main refactor, for example:
docs/repository-organization-plan.md

This document must include:
1. current chartdb structure summary
2. relevant ExcaliDash structural lessons
3. the proposed target folder tree
4. mapping from old paths to new paths
5. rationale for each major move
6. risks and compatibility considerations

This plan document must be committed before the main reorganization commit.

==================================================
ACCEPTANCE CRITERIA
==================================================

The task is complete only if:
- ExcaliDash repository organization was actually inspected
- chartdb repository structure was actually audited
- a target folder tree was created before refactoring
- chartdb repository layout was meaningfully improved
- boundaries are clearer than before
- operational/test/docs structure is more discoverable
- imports/config/build/test paths still work
- documentation reflects the new structure
- real commits were created in the required order

==================================================
FINAL DELIVERABLES
==================================================

You must provide:
1. actual chartdb repository reorganization
2. updated imports/config/scripts/build/test paths as needed
3. docs/repository-organization-plan.md
4. docs/repository-organization.md
5. updated README sections if needed
6. final engineering summary including:
   - what was learned from ExcaliDash structure
   - the target folder tree that was chosen
   - what moved and why
   - what was intentionally left unchanged
   - remaining limitations

Start now by:
1. auditing ExcaliDash repository layout
2. auditing chartdb repository layout
3. producing the target folder tree document
4. implementing the approved structure directly in chartdb
5. committing in logical phases
6. summarizing the final result

Do not perform cosmetic file moves.
Every structural move must have a clear architectural or operational justification.

Prefer low-risk structural consolidation over aggressive relocation.
Keep the repository buildable throughout the refactor.


Git workflow is part of the acceptance criteria.

The task is NOT complete unless:
- real commits were created
- commits follow the required logical sequence
- work is not left as one uncommitted patch
- final output includes the actual commit list

If implementation is correct but commits are missing or badly grouped, the task is considered incomplete.
