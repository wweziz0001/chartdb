You are Codex acting as a senior identity integration engineer.

TARGET REPOSITORY:
https://github.com/wweziz0001/chartdb

SOURCE REPOSITORY FOR FEATURE INSPIRATION:
https://github.com/wweziz0001/ExcaliDash

WORKING BRANCH:
feature/chartdb-oidc-support

PULL REQUEST TITLE:
Add optional OIDC support to ChartDB

MISSION
Add optional OIDC authentication support to chartdb for self-hosted enterprise deployments.

IMPORTANT EXECUTION RULES
- Work on this feature only.
- Assume baseline auth exists or add only the minimum prerequisite needed.
- Do not mix in admin dashboard, sharing, or collaboration.
- Inspect ExcaliDash for relevant OIDC/Keycloak integration patterns and adapt them to chartdb.

GOALS
- support login via OIDC provider
- make the design suitable for Keycloak and standard OIDC providers
- integrate cleanly with chartdb auth model

REQUIREMENTS
- add OIDC configuration through environment variables
- support standard OIDC login flow
- map authenticated identity into chartdb user records/sessions
- document local/dev setup and reverse-proxy considerations if needed

CONFIGURATION
Use env vars for:
- issuer
- client id
- client secret
- redirect URL
- logout URL if relevant

SECURITY
- never hardcode secrets
- validate callback flow properly
- protect tokens and sessions

TESTS
- auth config validation
- OIDC callback handling where practical
- user provisioning/linking behavior if implemented

DOCUMENTATION
- OIDC setup guide
- example Keycloak-compatible configuration

COMMIT DISCIPLINE
Use logical commits similar to:
- feat: add OIDC configuration and provider integration
- feat: add OIDC login callback and user mapping flow
- test: add OIDC config and callback validation tests
- docs: document OIDC and Keycloak setup for ChartDB

DELIVERABLES
- actual implementation
- tests
- docs
- final engineering summary
