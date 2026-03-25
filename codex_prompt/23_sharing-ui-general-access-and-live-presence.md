You are Codex acting as a senior real-time collaboration engineer, full-stack access-control architect, presence-system implementer, and product UI integration engineer.

TARGET REPOSITORY:
https://github.com/wweziz0001/chartdb

SOURCE REPOSITORY / UX INSPIRATION:
https://github.com/wweziz0001/ExcaliDash

WORKING BRANCH:
feature/sharing-ui-general-access-and-live-presence

PULL REQUEST TITLE:
Improve sharing UX and add live participant presence to ChartDB

==================================================
MISSION
==================================================

You must improve ChartDB’s sharing and live collaboration presence experience.

This task includes three tightly related goals:

1. Improve the sharing UX and access-management dialog
2. Add user-specific and general access sharing controls
3. Add live participant presence similar in spirit to ExcaliDash:
   - active participant display in the header
   - participant names or initials near the Share button
   - live mouse cursor presence for currently connected participants

Important:
Do NOT treat this task as a persistence/sync bug-fix task.
Viewer/editor save/sync issues were already handled previously.
Focus only on sharing UX, access configuration, and live participant presence.

==================================================
PRIMARY PRODUCT REQUIREMENTS
==================================================

A) SHARE BUTTON AND HEADER INTEGRATION

Add a visible Share button in the main editor/header UI.

Also add live participant presence in the header near the Share button.

The header should show:
- currently connected participants in the active shared session
- each participant as name or initials/avatar chip
- a compact participant list for active collaborators/viewers currently present
- graceful overflow behavior if many participants are connected

This must reflect real current session presence, not static access-list membership.

==================================================
B) SHARING DIALOG UX
==================================================

Implement or improve a sharing dialog inspired by the provided reference model.

The dialog must support two scopes:

1. People with access
2. General access

--------------------------------------
1) People with access
--------------------------------------

The owner must be able to:
- search/select a specific existing user
- add that user to access list
- assign role:
  - viewer
  - editor

The dialog must show:
- owner clearly labeled as owner
- shared users
- each user’s role
- ability to change role
- ability to remove access if appropriate

--------------------------------------
2) General access
--------------------------------------

The owner must also be able to configure:
- restricted
- anyone with the link

For general access:
- role must be configurable:
  - viewer
  - editor
- link access must support expiration

Expiration requirements:
- choose duration such as:
  - 1 hour
  - 1 day
  - 7 days
  - custom expiration if cleanly implementable
- expiration must be enforced server-side
- once expired, general access must automatically become invalid/restricted

The dialog must include:
- current general access mode
- current general access role
- expiration status/message
- copy link action
- done/close action

==================================================
C) LIVE PARTICIPANT PRESENCE
==================================================

You must implement live participant presence for currently connected users in a shared session.

Presence requirements:

1. Header participant presence
- show currently connected participants near the Share button
- show display name or initials/avatar chips
- distinguish current user if useful
- update live as users join/leave

2. Presence accuracy
- only show users currently present in the active session
- do not confuse “has access” with “currently online in this document”
- if a user has access but is not currently connected, they should not appear in the active presence list

3. Presence lifecycle
- joining the shared document/session should add participant to presence
- leaving/disconnecting should remove them
- reconnect should restore presence correctly

4. Optional enhancements if easy:
- tooltip with full name/email
- count of additional participants if overflow exists

==================================================
D) LIVE MOUSE CURSORS
==================================================

Implement live mouse cursor presence for currently connected participants, similar in spirit to collaborative tools like ExcaliDash.

Requirements:
- when participants are currently active in the shared document, their cursor position should be visible to others
- each cursor should be associated with that participant’s identity
- show label near cursor with name or short identifier if feasible
- cursor presence must update in near real time
- disconnected users must no longer show a cursor

Behavior requirements:
- the current user should not see duplicated self-cursor behavior
- cursor rendering should be lightweight and not break editor performance
- viewer users may still have visible presence/cursor, while respecting the existing permission model

Important:
This is presence visualization only.
It must not bypass the permission model.

==================================================
E) ACCESS MODEL REQUIREMENTS
==================================================

Implement or improve a coherent sharing access model for the dialog and presence integration.

At minimum support:

1. Owner
- full control
- can manage sharing
- can see presence

2. Editor
- can be assigned via user-specific sharing
- can participate in shared sessions according to existing behavior
- can see other participants/presence

3. Viewer
- can be assigned via user-specific sharing
- can see live participant presence
- can see mouse cursors if session presence supports it

4. General link access
- enforced by role and expiration
- must behave consistently with the existing permission model

Permission enforcement must still be respected in:
- frontend UI
- backend API
- collaboration transport / realtime layer

However, do not spend this task reworking viewer/editor persistence behavior.
That is out of scope for this task.

==================================================
F) AUTHORITATIVE PRESENCE REQUIREMENT
==================================================

Presence must be based on actual active session membership.

Important distinction:
- access list = who is allowed
- active presence = who is currently connected
- cursor data = ephemeral realtime data

Do not confuse these concepts.

The sharing dialog should show who has access.
The header presence and mouse cursors should show who is currently present.

==================================================
G) REALTIME / SESSION REQUIREMENTS
==================================================

Review and improve the realtime/session architecture only as needed to support:
- participant join/leave presence
- live presence updates
- live cursor updates
- correct removal on disconnect
- correct rejoin behavior

Do not broaden scope into unrelated sync or persistence refactors.

==================================================
H) BACKEND / API REQUIREMENTS
==================================================

Implement or improve backend behavior for:
- user-specific sharing
- updating per-user role
- removing access
- general access mode/role/expiration
- validating general-access expiration server-side
- session/presence membership if tracked server-side
- presence broadcast for active session members
- cursor broadcast for active session members

Do not rely only on frontend state.

==================================================
I) UI REQUIREMENTS
==================================================

Implement/improve:

1. Header
- Share button visible
- active participant chips near Share
- clean layout
- overflow handling for many participants

2. Sharing dialog
- Add people input
- People with access section
- General access section
- viewer/editor role controls
- expiration controls
- copy link
- owner labeling

3. Collaboration presence
- visible cursors for active participants
- participant identity labels near cursors if feasible

Do not copy ExcaliDash pixel-for-pixel.
Adapt to ChartDB’s style while preserving similar functional clarity.

==================================================
J) TESTING REQUIREMENTS
==================================================

You must add or update tests for at least:

1. Specific-user sharing
- owner shares with a user
- user receives viewer role
- user receives editor role

2. General access
- restricted blocks general access
- anyone-with-link viewer works
- anyone-with-link editor works if enabled
- expired link no longer works

3. Header presence
- participant appears in active header presence on join
- participant disappears on leave/disconnect
- only active participants are shown
- access list users are not automatically treated as active participants

4. Cursor presence
- cursor updates are broadcast to other active participants
- disconnected participants no longer show cursors

5. Regression coverage
- sharing model remains intact
- existing collaboration behavior is not broken
- presence does not corrupt sharing/access data

==================================================
K) DOCUMENTATION REQUIREMENTS
==================================================

Update documentation to explain:
- sharing model
- people with access
- general access
- viewer vs editor role assignment in sharing
- general access expiration
- active participant presence
- mouse cursor presence
- difference between access list and active presence
- known limitations if any

Add or update a document such as:
docs/sharing-and-live-presence.md

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
1. chore: audit sharing dialog and active participant presence flow
2. feat: add improved sharing dialog and access-management controls
3. feat: implement general access role and expiration handling
4. feat: add header participant presence and live cursor presence
5. test: add sharing presence and cursor regression coverage
6. docs: document sharing dialog and live presence behavior

Before finishing, provide:
- git status
- git log --oneline -n 20
- a short explanation of each commit

The task is incomplete if:
- Share dialog is not improved meaningfully
- general access expiration is not enforced server-side
- active participants are not shown near Share
- live cursors are not implemented meaningfully
- commit discipline was not followed

==================================================
M) EXECUTION RULES
==================================================

- Work only on this task.
- Do not introduce unrelated product features.
- Do not broaden scope into persistence/sync bug fixing.
- Inspect the actual current code paths for sharing, access control, realtime transport, session membership, and presence.
- Implement the requested changes directly in the repository.
- Do not stop at analysis.
- Keep presence/cursor data ephemeral and session-based.

==================================================
FINAL DELIVERABLES
==================================================

You must provide:
1. actual repository code changes
2. improved sharing dialog
3. visible Share button and active participant chips in the header
4. live participant mouse cursor presence
5. working people-specific and general access sharing
6. updated tests
7. updated docs
8. final engineering summary including:
   - how sharing was improved
   - how participant presence was implemented
   - how cursor presence was implemented
   - how general access expiration works
   - remaining limitations if any

Start now by:
1. auditing current sharing, session, and presence behavior
2. implementing the improved sharing dialog
3. implementing header participant presence and live cursors
4. adding tests and docs
5. committing in logical phases

Git workflow is part of the acceptance criteria.

The task is NOT complete unless:
- real commits were created
- commits follow the required logical sequence
- work is not left as one uncommitted patch
- final output includes the actual commit list

If implementation is correct but commits are missing or badly grouped, the task is considered incomplete.
