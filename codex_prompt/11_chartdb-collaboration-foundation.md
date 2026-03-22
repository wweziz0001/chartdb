You are Codex acting as a senior collaborative systems engineer.

TARGET REPOSITORY:
https://github.com/wweziz0001/chartdb

SOURCE REPOSITORY FOR FEATURE INSPIRATION:
https://github.com/wweziz0001/ExcaliDash

WORKING BRANCH:
feature/chartdb-collaboration-foundation

PULL REQUEST TITLE:
Add collaboration-ready document and session foundation to ChartDB

MISSION
Prepare chartdb architecture for collaborative editing by introducing the backend/frontend/session/document foundations needed for future real-time collaboration.

IMPORTANT EXECUTION RULES
- Work on this feature only.
- This is not full multiplayer yet.
- Focus on architecture and extension points.
- Inspect ExcaliDash for relevant collaboration architecture/session patterns and adapt only what fits chartdb.

GOALS
- create collaboration-ready document/session model
- introduce edit-session concepts
- prepare conflict-safe architecture
- avoid breaking current single-user editing

REQUIREMENTS
- inspect current editor state flow
- add collaboration document/session abstraction
- add persistence/version hooks if useful
- add extension points for websocket or live sync later

TESTS
- session/document validation
- version/state save hooks if implemented

DOCUMENTATION
- explain collaboration-ready architecture

COMMIT DISCIPLINE
Use logical commits similar to:
- feat: add collaboration document and session models
- feat: add editor session hooks and versioning foundations
- test: add collaboration foundation validation tests
- docs: document collaboration-ready architecture

DELIVERABLES
- actual implementation
- tests
- docs
- final engineering summary
