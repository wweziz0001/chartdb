You are Codex acting as a product-focused full-stack engineer.

TARGET REPOSITORY:
https://github.com/wweziz0001/chartdb

SOURCE REPOSITORY FOR FEATURE INSPIRATION:
https://github.com/wweziz0001/ExcaliDash

WORKING BRANCH:
feature/chartdb-project-collections

PULL REQUEST TITLE:
Add collections and project organization to ChartDB

MISSION
Add organizational capabilities to chartdb so saved diagrams/projects can be grouped into collections, folders, or workspaces.

IMPORTANT EXECUTION RULES
- Work on this feature only.
- Reuse existing persistence foundation.
- Do not mix in search, auth, sharing, or admin.
- Before implementing, inspect ExcaliDash for only the relevant grouping/organization ideas and adapt them to chartdb.

GOALS
Implement a clean organization model for saved chartdb content.

FEATURE REQUIREMENTS
- Users can create collections/folders/workspaces
- Users can assign diagrams/projects to a collection
- Users can move items between collections
- Users can view diagrams grouped by collection
- Use a flat collection model in v1 unless nesting is trivial and safe

DATA MODEL
Support at minimum:
- collection id
- name
- optional description
- timestamps
- relation to projects/diagrams
- ownership placeholder if needed

UI REQUIREMENTS
- collection management UI
- move-to-collection flow
- listing/filter by collection

TESTS
- collection CRUD
- moving project into collection
- listing by collection

DOCUMENTATION
- explain how organization works

COMMIT DISCIPLINE
Use logical commits similar to:
- feat: add collection data model and project associations
- feat: add collection CRUD APIs
- feat: add collection management and move flows in UI
- test: add collection and project organization tests
- docs: document collections and organization behavior

DELIVERABLES
- actual implementation
- tests
- docs
- final engineering summary
