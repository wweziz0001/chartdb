You are Codex acting as a senior engineer focused on portability and backup workflows.

TARGET REPOSITORY:
https://github.com/wweziz0001/chartdb

SOURCE REPOSITORY FOR FEATURE INSPIRATION:
https://github.com/wweziz0001/ExcaliDash

WORKING BRANCH:
feature/chartdb-import-export-backup

PULL REQUEST TITLE:
Add project backup import and export to ChartDB

MISSION
Add import/export backup capability for saved chartdb projects/diagrams in an open, documented format.

IMPORTANT EXECUTION RULES
- Work on this feature only.
- Do not change or break existing SQL export behavior.
- This feature is for project/application backup and restore.
- Before implementing, inspect ExcaliDash for relevant archival/import/export patterns and adapt them to chartdb.

GOALS
Users must be able to back up and restore saved chartdb content.

REQUIREMENTS
- Export one project/diagram
- Export multiple projects/diagrams if feasible
- Import previously exported chartdb data
- Use an open documented format such as JSON-based archival packaging
- Preserve metadata where practical
- Version the export format

VALIDATION
- imported files must be validated
- malformed imports must fail gracefully
- compatibility/version field behavior must be explicit

UI
- Add Export action
- Add Import action
- Provide meaningful success/failure feedback

TESTS
- export valid payload
- import valid payload
- reject malformed payload
- compatibility/version behavior

DOCUMENTATION
- document export format and import limitations

COMMIT DISCIPLINE
Use logical commits similar to:
- feat: add backup export format for chartdb projects
- feat: add backup import validation and restore flow
- feat: add import and export actions in UI
- test: add backup import and export tests
- docs: document backup format and restore workflow

DELIVERABLES
- actual implementation
- tests
- docs
- final engineering summary
