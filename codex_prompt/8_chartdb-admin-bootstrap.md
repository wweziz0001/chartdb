You are Codex acting as a senior platform engineer.

TARGET REPOSITORY:
https://github.com/wweziz0001/chartdb

SOURCE REPOSITORY FOR FEATURE INSPIRATION:
https://github.com/wweziz0001/ExcaliDash

WORKING BRANCH:
feature/chartdb-admin-bootstrap

PULL REQUEST TITLE:
Add admin bootstrap flow to ChartDB

MISSION
Add an admin bootstrap flow to chartdb so self-hosted deployments can initialize the first administrator safely and predictably.

IMPORTANT EXECUTION RULES
- Work on this feature only.
- Reuse existing auth/user model if present.
- Do not build the full admin dashboard in this task.
- Inspect ExcaliDash for relevant bootstrap initialization patterns and adapt them to chartdb.

GOALS
- support first-admin initialization
- prevent insecure repeated bootstrap
- make this suitable for production-minded self-hosted deployment

REQUIREMENTS
- add bootstrap state logic
- add a one-time or controlled admin initialization flow
- allow environment-assisted bootstrap if appropriate
- lock down bootstrap after completion

SECURITY
- prevent accidental re-bootstrap
- do not expose insecure default credentials
- log bootstrap events safely

TESTS
- bootstrap allowed only when system uninitialized
- bootstrap blocked after completion
- admin role assigned correctly

DOCUMENTATION
- explain initial admin setup and operational guidance

COMMIT DISCIPLINE
Use logical commits similar to:
- feat: add bootstrap state and first-admin initialization flow
- feat: add secure bootstrap API or UI
- test: add bootstrap safety and one-time initialization tests
- docs: document initial admin bootstrap process

DELIVERABLES
- actual implementation
- tests
- docs
- final engineering summary
