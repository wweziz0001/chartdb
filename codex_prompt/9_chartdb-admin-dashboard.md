You are Codex acting as a senior full-stack product engineer.

TARGET REPOSITORY:
https://github.com/wweziz0001/chartdb

SOURCE REPOSITORY FOR FEATURE INSPIRATION:
https://github.com/wweziz0001/ExcaliDash

WORKING BRANCH:
feature/chartdb-admin-dashboard

PULL REQUEST TITLE:
Add basic admin dashboard to ChartDB

MISSION
Add a basic admin dashboard to chartdb for self-hosted environments.

IMPORTANT EXECUTION RULES
- Work on this feature only.
- Reuse auth/admin bootstrap if present.
- Do not add advanced role management unless trivial.
- Inspect ExcaliDash for relevant admin surface patterns and adapt them to chartdb.

GOALS
Provide administrators with a simple management surface for core platform operations.

MINIMUM ADMIN CAPABILITIES
- view users
- view projects/diagrams counts
- view sharing records if sharing exists
- basic user role/status visibility
- basic platform overview/health summary

UI REQUIREMENTS
- keep the dashboard simple and maintainable
- match chartdb style
- protect admin routes

TESTS
- admin-only route protection
- dashboard data loads correctly

DOCUMENTATION
- explain what the admin dashboard includes and does not include

COMMIT DISCIPLINE
Use logical commits similar to:
- feat: add admin overview APIs and metrics aggregation
- feat: add basic admin dashboard UI and route protection
- test: add admin access control and dashboard loading tests
- docs: document admin dashboard capabilities and limits

DELIVERABLES
- actual implementation
- tests
- docs
- final engineering summary
