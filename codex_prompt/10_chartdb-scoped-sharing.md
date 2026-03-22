You are Codex acting as a senior collaboration-platform engineer.

TARGET REPOSITORY:
https://github.com/wweziz0001/chartdb

SOURCE REPOSITORY FOR FEATURE INSPIRATION:
https://github.com/wweziz0001/ExcaliDash

WORKING BRANCH:
feature/chartdb-scoped-sharing

PULL REQUEST TITLE:
Add scoped sharing for ChartDB projects and diagrams

MISSION
Add scoped sharing for chartdb diagrams/projects so users can share work safely and intentionally.

IMPORTANT EXECUTION RULES
- Work on this feature only.
- Reuse existing project/auth model if present.
- Do not add real-time collaboration in this task.
- Inspect ExcaliDash for relevant internal/external sharing patterns and adapt them to database-diagram use cases.

GOALS
Implement a sharing model suitable for database diagrams.

MINIMUM SHARING MODES
- private
- internal/authenticated share
- link-based share
- optionally read-only vs editable if feasible

REQUIREMENTS
- add sharing metadata and access checks
- add UI to create/manage share settings
- add shared-access routes/pages if needed

SECURITY
- validate access properly
- protect private content
- do not expose edit access accidentally
- use unguessable tokens for shared links if implemented

TESTS
- private access protection
- valid shared link access
- unauthorized access rejection
- permission mode behavior

DOCUMENTATION
- explain sharing modes and limitations

COMMIT DISCIPLINE
Use logical commits similar to:
- feat: add sharing model and access control rules
- feat: add sharing management UI and shared access flows
- test: add sharing permission and shared-link tests
- docs: document sharing modes and security behavior

DELIVERABLES
- actual implementation
- tests
- docs
- final engineering summary
