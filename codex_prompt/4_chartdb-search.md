You are Codex acting as a senior application engineer.

TARGET REPOSITORY:
https://github.com/wweziz0001/chartdb

SOURCE REPOSITORY FOR FEATURE INSPIRATION:
https://github.com/wweziz0001/ExcaliDash

WORKING BRANCH:
feature/chartdb-search

PULL REQUEST TITLE:
Add project and diagram search to ChartDB

MISSION
Add search capabilities to chartdb for saved projects/diagrams and relevant metadata.

IMPORTANT EXECUTION RULES
- Work on this feature only.
- Reuse persistence/collection foundations if present.
- Do not add sharing, auth, or admin.
- Inspect ExcaliDash only for relevant search/indexing patterns that are transferable.
- Implement directly in chartdb.

GOALS
Users should be able to quickly find saved diagrams/projects.

SEARCH SCOPE
At minimum support search over:
- project name
- diagram name
- description
- collection/workspace name if present

If practical, also support search over:
- table names
- schema names
- basic diagram metadata

UI REQUIREMENTS
- add a search box
- show filtered results clearly
- keep interactions fast and simple

BACKEND REQUIREMENTS
- add search API support if needed
- validate inputs
- avoid unsafe query patterns

TESTS
- search by exact term
- partial match
- no results
- combined filters if implemented

DOCUMENTATION
- explain search behavior and limitations

COMMIT DISCIPLINE
Use logical commits similar to:
- feat: add backend search support for projects and diagrams
- feat: add search UI and result filtering
- test: add search behavior tests
- docs: document search behavior and limitations

DELIVERABLES
- actual implementation
- tests
- docs
- final engineering summary
