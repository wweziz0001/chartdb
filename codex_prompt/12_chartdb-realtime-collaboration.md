You are Codex acting as a senior real-time collaboration engineer.

TARGET REPOSITORY:
https://github.com/wweziz0001/chartdb

SOURCE REPOSITORY FOR FEATURE INSPIRATION:
https://github.com/wweziz0001/ExcaliDash

WORKING BRANCH:
feature/chartdb-realtime-collaboration

PULL REQUEST TITLE:
Add first version of real-time collaboration to ChartDB

MISSION
Implement a first practical version of real-time collaboration for shared chartdb diagram sessions.

IMPORTANT EXECUTION RULES
- Work on this feature only.
- Reuse collaboration foundation if present.
- Keep the scope realistic.
- Inspect ExcaliDash for relevant real-time collaboration architecture, but adapt it carefully to chartdb’s editor model.
- Do not attempt a perfect Google Docs-grade system.

GOALS
Allow multiple users to collaborate on the same chartdb diagram/session in near real time.

MINIMUM SCOPE
- joining a shared session
- receiving updates from other participants
- basic participant awareness if feasible

SAFETY
- avoid corrupting saved diagram state
- validate permissions before joining/editing
- fail gracefully on disconnect/reconnect

TESTS
- core synchronization behavior where practical
- permissions and session access
- basic session lifecycle

DOCUMENTATION
- explain architecture, setup, and limitations

COMMIT DISCIPLINE
Use logical commits similar to:
- feat: add live collaboration transport and session synchronization
- feat: add participant presence and shared editing flow
- test: add core collaboration access and sync tests
- docs: document real-time collaboration setup and limitations

DELIVERABLES
- actual implementation
- tests
- docs
- final engineering summary
