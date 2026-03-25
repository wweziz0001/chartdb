You are Codex acting as a senior full-stack engineer, collaboration-platform architect, real-time sync debugging specialist, and product UI integration engineer.

TARGET REPOSITORY:
https://github.com/wweziz0001/chartdb

WORKING BRANCH:
feature/improve-sharing-ui-and-fix-editor-sync-persistence

PULL REQUEST TITLE:
Improve sharing UI and access model, and fix editor sync/persistence for shared editing

==================================================
MISSION
==================================================

You must implement two tightly related improvements in chartdb:

1. Upgrade the sharing feature so it behaves like a modern access-control sharing dialog with:
   - direct user-specific sharing
   - general access by link
   - role selection (viewer / editor)
   - time-limited link-based sharing expiration

2. Fix the shared editing bug where a user with editor access can make changes, but:
   - the changes do not appear correctly to the main owner
   - the changes are not reliably persisted to the underlying file/project

These two tasks must be handled together because the sharing model and the collaborative editing/persistence model must remain consistent.

==================================================
PRODUCT REQUIREMENTS
==================================================

A) SHARE BUTTON PLACEMENT

Add a visible Share button in the main UI next to the Admin button.

Requirements:
- it must be clearly visible in the interface
- it must open the sharing dialog for the current project / diagram / file
- it must match the existing chartdb design language
- it must not be hidden in deep menus unless absolutely necessary

==================================================
B) SHARING DIALOG UX
==================================================

Implement a sharing dialog inspired by the attached reference design.

The dialog must support two sharing scopes:

1. People with access
2. General access

--------------------------------------
1) People with access
--------------------------------------

The owner must be able to share with a specific user directly.

Required behavior:
- a searchable "Add people" input
- select a specific existing user
- add that user to the project/file access list
- choose permission for that user:
  - viewer
  - editor

Required UI concepts:
- show current people with access
- show each user’s role
- show owner clearly as owner
- allow changing another user’s role between viewer/editor
- allow removing access if appropriate

Backend/data requirements:
- persist user-specific sharing records
- enforce role-based access correctly
- distinguish owner from shared users

--------------------------------------
2) General access
--------------------------------------

The owner must also be able to enable general link-based access.

Required behavior:
- general access mode:
  - restricted
  - anyone with the link
- role for general access:
  - viewer
  - editor
- expiration timer for general access links

Required expiration behavior:
- owner can choose a link expiration duration
- after expiration, general access must automatically become restricted/disabled
- expired links must no longer grant access

Suggested durations:
- 1 hour
- 1 day
- 7 days
- custom expiration if easy to implement cleanly

Required UI concepts:
- show current general access mode
- show current role for general access
- show current expiration state
- show message about when link access will expire
- allow copy link action

Backend/data requirements:
- persist general access state
- persist role
- persist expiration timestamp
- enforce expiration server-side, not only in UI

==================================================
C) ACCESS MODEL REQUIREMENTS
==================================================

You must implement and/or correct a coherent sharing access model.

At minimum support:

1. Owner
- full control
- can manage sharing
- can edit
- can delete
- can change roles and general access settings

2. Viewer
- can open/view shared project/file
- cannot modify content
- cannot manage access

3. Editor
- can open and edit shared project/file
- cannot manage ownership unless explicitly allowed
- cannot escalate permissions

4. General link access
- if enabled, access is controlled by:
  - link availability
  - assigned role
  - expiration validity

Access control must be enforced in backend/API logic, not only in frontend UI.

==================================================
D) CRITICAL BUG TO FIX
==================================================

There is a bug in shared editing:

When the owner shares a project/file with another user as editor:
- the editor can make changes
- but the owner does not properly see those changes
- and the changes are not reliably saved/persisted in the project/file

This must be fixed.

You must inspect the actual merged codebase and determine the real cause.

Possible causes may include:
- collaboration session not wired to persisted project state
- editor changes updating only local session state
- owner view subscribed to stale data
- missing save propagation for non-owner editors
- permission checks accidentally bypassing persistence update
- shared session updates not invalidating caches
- multiple conflicting representations of the same project/document state
- collaboration transport updates not connected to canonical persisted model

Do not guess. Inspect the code and fix the actual integration issue.

==================================================
E) REQUIRED EDITOR/PERSISTENCE BEHAVIOR
==================================================

After your fix:

1. If a shared editor modifies the project/file:
- the change must be reflected to the authoritative persisted document state
- the owner must be able to see the new state
- reopening the file/project must show the saved shared edits

2. If real-time collaboration/session sync exists:
- owner and editor should see updates propagate correctly
- if real-time is partial, at minimum persisted saves must remain correct and reload must show correct state

3. If autosave exists:
- shared editor changes must be included in autosave logic

4. If manual save exists:
- shared editor changes must be saveable according to the correct permission model

==================================================
F) DATA / MODEL REQUIREMENTS
==================================================

Review and unify the data model for sharing and collaborative persistence.

At minimum, inspect and correct:
- project/file ownership model
- per-user access entries
- general access settings
- role model
- expiration model
- persisted document/source-of-truth model
- collaboration session linkage to saved project/file
- audit/update timestamps if relevant

Avoid duplicate or conflicting models for:
- sharing roles
- access checks
- document persistence state
- session state vs stored state

==================================================
G) API / BACKEND REQUIREMENTS
==================================================

Implement or fix backend APIs for:
- listing people with access
- adding a specific user to access list
- updating a shared user role
- removing a shared user
- reading general access state
- updating general access mode
- updating general access role
- updating general access expiration
- validating shared access on open/load
- enforcing expiration server-side
- ensuring shared editor changes persist correctly

Do not rely only on frontend state.
All access and persistence must be enforced server-side.

==================================================
H) UI REQUIREMENTS
==================================================

Implement a clean sharing dialog inspired by the provided reference.

The dialog should include:
- Add people input
- People with access section
- General access section
- role dropdowns for viewer/editor
- expiration control for general access
- copy link button
- done/close button

Do not copy the design blindly pixel-for-pixel.
Adapt it to chartdb’s design language, but preserve the same functional clarity.

The owner row should be visually distinguished.
Shared users should clearly show their role.
General access should clearly show:
- current role
- expiration status
- whether link access is enabled

==================================================
I) SECURITY REQUIREMENTS
==================================================

1. Enforce all permissions server-side.
2. Do not allow viewers to edit.
3. Do not allow editors to manage sharing unless explicitly designed.
4. Do not allow expired general links to work.
5. Do not expose sensitive sharing internals unnecessarily.
6. Use unguessable tokens for link-based access if token-based link sharing is used.
7. Ensure shared editor saves cannot overwrite data incorrectly due to ownership assumptions.
8. Avoid race conditions or stale overwrites where feasible.

==================================================
J) TESTING REQUIREMENTS
==================================================

You must add or update tests for at least the following:

1. Specific-user sharing
- owner shares with a specific user
- shared user gets viewer access
- shared user gets editor access

2. Role enforcement
- viewer cannot edit
- editor can edit
- editor cannot manage sharing
- owner can manage sharing

3. General access
- restricted mode blocks anonymous/general access
- anyone-with-link viewer works
- anyone-with-link editor works if enabled
- expired general link no longer works

4. Shared editing persistence
- editor updates are persisted
- owner sees updated content after reload
- persisted file/project reflects editor changes
- if live sync exists, owner/editor propagation behaves correctly

5. Regression coverage
- owner access still works
- save/autosave behavior not broken
- sharing changes do not corrupt project/file ownership

==================================================
K) DOCUMENTATION REQUIREMENTS
==================================================

Update documentation to explain:
- sharing model
- people with access
- general access
- viewer vs editor permissions
- link expiration behavior
- shared editing persistence behavior
- known limitations if any

If appropriate, add a document such as:
docs/sharing-and-access-model.md

==================================================
L) MANDATORY COMMIT DISCIPLINE
==================================================

You must create real git commits while working.

Rules:
- Do not leave all changes uncommitted until the end.
- Do not provide only suggested commit messages.
- Do not squash everything into one giant commit.
- Commit after each major logical phase.

Required commit sequence:
1. chore: audit current sharing model and shared editing persistence flow
2. feat: add improved sharing UI and access-management flows
3. feat: implement or fix backend sharing roles general access and expiration
4. fix: resolve shared editor sync and persistence bug
5. test: add sharing access and persistence regression coverage
6. docs: document sharing model and shared editing behavior

Before finishing, provide:
- git status
- git log --oneline -n 20
- a short explanation of each commit

The task is incomplete if:
- the sharing dialog is not improved meaningfully
- general access expiration is not enforced server-side
- the editor persistence bug remains unresolved
- commits were not created in logical phases

==================================================
M) EXECUTION RULES
==================================================

- Work only on this task.
- Do not introduce unrelated product features.
- If you find prerequisite issues, implement only the minimum needed fix.
- Inspect the actual code and fix the real cause of the shared editing persistence problem.
- Prefer coherent integration over superficial UI changes.
- Do not stop at analysis or recommendations.
- Implement the changes directly in the repository.

==================================================
FINAL DELIVERABLES
==================================================

You must provide:
1. actual repository code changes
2. improved sharing dialog and visible Share button
3. working people-specific sharing with viewer/editor roles
4. working general link access with viewer/editor roles and expiration
5. fixed shared editor persistence/sync behavior
6. updated tests
7. updated docs
8. final engineering summary including:
   - what was wrong before
   - how sharing was improved
   - how the editor persistence bug was fixed
   - remaining limitations if any

Start now by:
1. auditing current sharing UI, access model, and persistence flow
2. identifying the real root cause of the shared editor update/save problem
3. implementing the improved sharing dialog and backend access model
4. fixing shared editor persistence
5. adding tests and docs
6. committing in logical phases


UI reference requirement:
Use the attached reference image as a functional UX guide for the share dialog.
The implementation does not need to be pixel-perfect, but it must preserve the same core interaction model:
- Add people input
- People with access list
- General access section
- role dropdowns
- expiration control
- copy link action
- clear owner labeling


Pay special attention to source-of-truth consistency:
There must be one authoritative persisted document/project state.
Shared editor updates must flow into that canonical persisted state rather than only a temporary local or session-only state.


Git workflow is part of the acceptance criteria.

The task is NOT complete unless:
- real commits were created
- commits follow the required logical sequence
- work is not left as one uncommitted patch
- final output includes the actual commit list

If implementation is correct but commits are missing or badly grouped, the task is considered incomplete.
