You are Codex acting as a senior full-stack engineer.

TARGET REPOSITORY:
https://github.com/wweziz0001/chartdb

SOURCE REPOSITORY FOR FEATURE INSPIRATION:
https://github.com/wweziz0001/ExcaliDash

WORKING BRANCH:
feature/chartdb-persistent-project-storage

PULL REQUEST TITLE:
Add persistent project and diagram storage to ChartDB

MISSION
Implement persistent storage for chartdb diagrams/projects so users can save, reopen, update, and manage their database diagram work instead of relying only on transient editor state.

IMPORTANT EXECUTION RULES
- Work on this feature only.
- Reuse any backend/persistence foundation already present.
- Do not add auth, sharing, or admin in this task.
- Before implementing, inspect ExcaliDash only for relevant persistence/storage patterns and adapt them to chartdb.
- Implement directly in chartdb.

GOALS
1. Inspect the current chartdb editor state model.
2. Add persistence for saved projects/diagrams.
3. Allow users to:
   - create a project
   - save a diagram
   - reopen a saved diagram
   - update an existing diagram
   - list saved diagrams/projects
   - rename
   - delete
4. Preserve current chart editing behavior.

FEATURE REQUIREMENTS
Saved project/diagram metadata should include:
- id
- name
- description optional
- createdAt
- updatedAt
- diagram content/schema/editor state
- ownership placeholder if relevant

UI REQUIREMENTS
Add flows for:
- Save
- Save As
- Open Saved Project
- Rename
- Delete

TESTS
Add tests for create/read/update/delete persistence flows.

DOCUMENTATION
Update README with how saved projects work.

COMMIT DISCIPLINE
Use logical commits similar to:
- feat: add project and diagram persistence models
- feat: add API endpoints for saved projects and diagrams
- feat: add save, save as, open, rename, and delete flows in UI
- test: add CRUD tests for persisted project workflows
- docs: document persistent project storage

DELIVERABLES
- actual implementation
- tests
- docs
- final engineering summary
