You are Codex acting as a senior full-stack architect and repository refactoring engineer.

TARGET REPOSITORY:
https://github.com/wweziz0001/chartdb

SOURCE REPOSITORY FOR FEATURE INSPIRATION:
https://github.com/wweziz0001/ExcaliDash

WORKING BRANCH:
feature/chartdb-backend-persistence-foundation

PULL REQUEST TITLE:
Add backend and persistence foundation for self-hosted ChartDB

MISSION
Inspect the chartdb repository and add the minimum backend and persistence foundation required to evolve chartdb from a mostly frontend-oriented database diagram editor into a self-hosted application that can persist user/project data safely.

IMPORTANT EXECUTION RULES
- Work on this feature only.
- Do not expand into auth, sharing, admin, or collaboration unless a minimal prerequisite is absolutely required.
- Before implementing, inspect the ExcaliDash repository and identify only the relevant backend/persistence architectural patterns that can be adapted to chartdb.
- Then implement directly in chartdb.
- Do not stop at analysis.
- Do not rewrite the whole app.

GOALS
1. Inspect current chartdb structure.
2. Determine whether chartdb already has a backend/service layer. If not, add one cleanly.
3. Introduce a maintainable backend foundation for future features such as:
   - saved projects
   - collections
   - search
   - sharing
   - auth
   - admin
4. Add a persistence layer with a clean data model for chartdb application data.
5. Keep chartdb’s current editing experience working.

MINIMUM REQUIREMENTS
- Add clean frontend/backend boundaries.
- Add backend health endpoint.
- Add API structure for future persistence operations.
- Add persistence models for at least:
  - users or auth-ready placeholder
  - projects
  - diagrams
  - timestamps
  - ownership placeholder
  - visibility/status placeholder
- Use environment variables for configuration.
- Add `.env.example`
- Add structured logging.
- Do not hardcode secrets.

TESTING
- Add basic tests for health/config/model validation.

DOCUMENTATION
- Update README with backend startup and configuration basics.
- Add a short architecture document.

COMMIT DISCIPLINE
Use logical commits similar to:
- chore: analyze chartdb architecture and identify backend boundaries
- feat: add backend service foundation and health endpoint
- feat: add persistence layer and core application models
- chore: add environment configuration and .env.example
- docs: document backend and persistence foundation

DELIVERABLES
- actual repository code changes
- backend foundation
- persistence foundation
- tests
- docs
- final engineering summary
