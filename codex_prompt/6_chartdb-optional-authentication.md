You are Codex acting as a senior security-aware full-stack engineer.

TARGET REPOSITORY:
https://github.com/wweziz0001/chartdb

SOURCE REPOSITORY FOR FEATURE INSPIRATION:
https://github.com/wweziz0001/ExcaliDash

WORKING BRANCH:
feature/chartdb-optional-authentication

PULL REQUEST TITLE:
Add optional authentication to ChartDB

MISSION
Add an optional authentication layer to chartdb suitable for self-hosted deployments, while preserving a lightweight local mode if feasible.

IMPORTANT EXECUTION RULES
- Work on this feature only.
- Do not add OIDC in this task.
- Do not add admin dashboard or sharing in this task.
- Before implementing, inspect ExcaliDash only for relevant auth/session patterns that can be adapted to chartdb.
- Keep the implementation focused and minimal.

GOALS
- add optional login/authentication support
- preserve lightweight usage patterns where feasible
- prepare chartdb for ownership, sharing, and admin features

REQUIREMENTS
- inspect current repository and find the cleanest auth integration point
- add user/session model
- support login/logout
- protect authenticated resources
- keep public/anonymous mode behavior clear if retained

SECURITY
- no hardcoded secrets
- secure session/token handling
- input validation
- no password leakage in logs

TESTS
- login success/failure
- protected route access
- logout/session invalidation

DOCUMENTATION
- explain auth mode
- document env vars and setup

COMMIT DISCIPLINE
Use logical commits similar to:
- feat: add user and session models for optional auth
- feat: add login logout and protected route handling
- test: add authentication and session tests
- docs: document optional authentication setup

DELIVERABLES
- actual implementation
- tests
- docs
- final engineering summary
