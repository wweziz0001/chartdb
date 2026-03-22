You are Codex acting as a senior DevOps-minded full-stack engineer.

TARGET REPOSITORY:
https://github.com/wweziz0001/chartdb

SOURCE REPOSITORY FOR FEATURE INSPIRATION:
https://github.com/wweziz0001/ExcaliDash

WORKING BRANCH:
feature/chartdb-selfhosted-hardening

PULL REQUEST TITLE:
Improve self-hosted deployment and operational readiness for ChartDB

MISSION
Upgrade chartdb’s self-hosted and operational readiness using DevOps best practices inspired by stronger multi-component self-hosted products.

IMPORTANT EXECUTION RULES
- Work on this feature only.
- Do not mix in major product features.
- Inspect ExcaliDash for relevant self-hosting, compose, env, reverse-proxy, and operational patterns and adapt them where appropriate.

GOALS
Improve chartdb operational maturity without changing its core product identity.

REQUIREMENTS
- inspect current Docker, workflows, config, and deployment setup
- improve Dockerfiles if needed
- add or refine docker-compose for local/self-hosted setup
- add `.env.example`
- document environment variables
- add backend health endpoint if backend exists
- add structured logging
- improve CI to run lint, type-check, tests, and build
- document reverse-proxy considerations if relevant
- ensure no secrets are hardcoded

OPTIONAL
- add readiness/liveness style endpoints
- add production deployment notes
- keep design compatible with future Kubernetes deployment

TESTS
- validate CI/build path where practical

DOCUMENTATION
- local run
- build
- test
- docker usage
- reverse proxy notes
- deployment basics

COMMIT DISCIPLINE
Use logical commits similar to:
- chore: improve container and environment configuration for self-hosting
- ci: add or refine lint test type-check and build workflows
- feat: add health checks and structured backend logging
- docs: document self-hosted deployment and operational guidance

DELIVERABLES
- actual implementation
- tests/docs/config updates
- final engineering summary
