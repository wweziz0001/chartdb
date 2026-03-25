You are Codex acting as a senior product UI engineer, frontend architect, role-aware UX designer, and repository implementation specialist.

TARGET REPOSITORY:
https://github.com/wweziz0001/chartdb

SOURCE REPOSITORY / UX INSPIRATION:
https://github.com/wweziz0001/ExcaliDash

WORKING BRANCH:
feature/improve-dashboard-layout-and-role-aware-navigation

PULL REQUEST TITLE:
Improve ChartDB main dashboard UX and add role-aware sidebar navigation

==================================================
MISSION
==================================================

Your task is to improve the ChartDB user interface and navigation model by taking strong UX inspiration from ExcaliDash.

The goal is NOT to clone ExcaliDash pixel-for-pixel.
The goal is to adapt the strongest UX patterns from ExcaliDash into ChartDB in a way that fits ChartDB’s product identity as a database diagram / schema-sync platform.

After login, the user should land in a clean main dashboard/library experience, with a left sidebar and clearly organized navigation sections similar in spirit to ExcaliDash.

==================================================
PRIMARY PRODUCT GOALS
==================================================

Implement a more complete post-login application shell for ChartDB so that:

1. After login, the user lands on a main dashboard/library page instead of a confusing or fragmented entry point.
2. The layout includes a left sidebar navigation similar in structure to ExcaliDash.
3. The sidebar exposes the main user-facing sections in a clear and role-aware way.
4. The Admin tab is shown ONLY to users with admin privileges.
5. Non-admin users must not see the Admin tab at all.
6. The interface should feel cohesive, professional, and self-hosted-product-ready.

==================================================
UX REFERENCE MODEL
==================================================

Use the provided ExcaliDash screenshots as functional UX inspiration.

Important:
- Do not copy the UI blindly.
- Do not clone branding or exact styling.
- Preserve ChartDB identity.
- Reuse the strongest patterns:
  - main dashboard landing page
  - left sidebar
  - clear section grouping
  - profile area in sidebar footer
  - prominent content page title
  - obvious library-style navigation
  - role-aware tab visibility

==================================================
REQUIRED NAVIGATION MODEL
==================================================

After login, build a role-aware sidebar and application shell with at minimum these sections:

For all authenticated users:
- All Diagrams (or equivalent main library page for ChartDB)
- Shared with Me
- Unorganized
- Collections
- Trash
- Profile
- Settings

Only for admin users:
- Admin

You may refine naming slightly to fit ChartDB’s domain, for example:
- All Projects / All Diagrams
- Shared with Me
- Unorganized
- Collections
- Trash
- Profile
- Settings
- Admin

But the structure and intent must remain.

==================================================
ROLE-AWARE VISIBILITY REQUIREMENTS
==================================================

This is mandatory:

1. Admin tab:
- visible only for users with admin role
- not rendered for regular users
- not merely disabled; it should be hidden entirely

2. Admin routes/pages:
- must still be protected server-side and client-side as appropriate
- hiding the tab alone is not sufficient

3. Non-admin users:
- must have a complete and polished navigation experience even without Admin

==================================================
POST-LOGIN LANDING REQUIREMENTS
==================================================

After successful login:
- route the user to the main dashboard/library page
- that page should be a clean overview of the user’s diagrams/projects
- the page should work as the primary entry point into the application

This page should include:
- page title
- search box
- sort/filter controls if already present or easy to adapt
- diagram/project cards or list
- actions such as new project/new diagram/import where appropriate
- consistent empty-state behavior if no items exist

==================================================
SIDEBAR REQUIREMENTS
==================================================

Implement a persistent app shell/sidebar with these qualities:

1. Clear top branding/product identity area
2. Main navigation grouped logically
3. Optional "Collections" section or collection list area if supported
4. Lower utility navigation section for:
   - Trash
   - Profile
   - Settings
   - Admin (admin only)
5. User identity block near the bottom
6. Logout action clearly available

The sidebar should:
- be visually clean
- remain consistent across authenticated pages
- support active-state styling
- be easy to extend

==================================================
PAGE REQUIREMENTS
==================================================

At minimum, improve and align these authenticated areas:

1. Main Library / All Diagrams page
- make it the default landing page after login
- use a cleaner dashboard/library layout

2. Shared with Me page
- make it accessible via sidebar
- align its layout with the main library page

3. Unorganized page
- make it accessible via sidebar if the feature exists
- align layout and behavior

4. Collections navigation
- if collections already exist, expose them clearly in sidebar and/or main content
- if collection listing exists, integrate it cleanly

5. Trash page
- keep it accessible via sidebar
- improve consistency with the rest of the app shell

6. Profile page
- accessible from sidebar
- keep layout visually coherent with the new app shell

7. Settings page
- accessible from sidebar
- improve consistency with the new app shell

8. Admin page
- accessible only for admins
- visible only for admins
- keep the page inside the same shell layout

==================================================
IMPLEMENTATION REQUIREMENTS
==================================================

You must inspect the actual current ChartDB codebase and determine:

- current authenticated layout flow
- login redirect behavior
- how roles are represented
- whether a shared app shell already exists
- where navigation should live
- how to integrate role-aware rendering cleanly

You must implement the improved UX directly in the repository.

Do not stop at giving design advice.
Do not only create mockups.
Do not only move one button.
Implement the full layout improvement.

==================================================
ROUTING REQUIREMENTS
==================================================

You must review and improve routing so that:

- authenticated users land on the correct dashboard route after login
- sidebar navigation links map to real pages
- admin routes are protected
- non-admin users cannot navigate into admin pages
- navigation remains coherent and predictable

==================================================
STATE / DATA REQUIREMENTS
==================================================

Ensure the new dashboard shell works with the actual existing application data model.

At minimum:
- all diagrams/projects listing should use real data
- shared-with-me view should use real sharing data if present
- unorganized should use real classification state if present
- collections should use real collection data if present
- trash should use real trashed/deleted state if present
- profile/settings should use real user/account/config data if present

If some area exists only partially, build the minimum working integration instead of leaving dead links.

==================================================
UI / DESIGN REQUIREMENTS
==================================================

The new UI should be:
- clean
- structured
- modern
- readable
- consistent
- suitable for a self-hosted product

Do not attempt an unrelated redesign.
Do not break ChartDB’s own look and feel.
Adapt the layout and information architecture, not just superficial colors.

Use the ExcaliDash screenshots as guidance for:
- navigation organization
- dashboard entry flow
- sidebar layout
- page hierarchy
- admin visibility behavior

==================================================
SPECIAL EMPHASIS
==================================================

Pay special attention to these two points:

1. The first screen after login must feel intentional and product-grade.
2. Admin visibility must be role-aware:
   - Admin sees Admin tab
   - regular user does not see Admin tab at all

This is not optional.

==================================================
TESTING REQUIREMENTS
==================================================

Add or update tests for at least:

1. Authenticated redirect
- after login, user lands on main dashboard/library route

2. Sidebar rendering
- regular user sees standard tabs
- admin user sees standard tabs plus Admin
- regular user does not see Admin

3. Route protection
- admin route inaccessible to non-admin users
- admin route accessible to admin users

4. Navigation integration
- sidebar links open the correct pages
- active state behaves correctly if tested in current stack

5. Regression protection
- existing authenticated pages still work after shell integration

==================================================
DOCUMENTATION REQUIREMENTS
==================================================

Update documentation to explain:
- the new authenticated application shell
- post-login landing behavior
- sidebar navigation model
- role-aware admin visibility
- any new routing/layout assumptions

If appropriate, add a document such as:
docs/authenticated-dashboard-layout.md

==================================================
MANDATORY COMMIT DISCIPLINE
==================================================

You must create real git commits while working.

Rules:
- Do not leave all changes uncommitted until the end.
- Do not provide only suggested commit messages.
- Do not squash everything into one giant commit.
- Commit after each major logical phase.

Required commit sequence:
1. chore: audit current authenticated layout routing and role visibility
2. feat: add new dashboard shell and sidebar navigation
3. feat: implement role-aware admin tab visibility and protected routing
4. refactor: align authenticated pages with the new shell layout
5. test: add or update navigation and role-visibility coverage
6. docs: document dashboard shell and role-aware navigation

Before finishing, provide:
- git status
- git log --oneline -n 20
- a short explanation of each commit

The task is incomplete if:
- the post-login landing flow is not improved
- the sidebar is not meaningfully implemented
- the Admin tab is still visible to non-admin users
- admin route protection is not verified
- commit discipline was not followed

==================================================
EXECUTION RULES
==================================================

- Work only on this task.
- Do not introduce unrelated product features.
- Reuse existing pages/features where possible.
- Prefer integration and UX coherence over unnecessary rewrites.
- Inspect the actual current code and adapt the best navigation/layout ideas from ExcaliDash.
- Do not stop at analysis or recommendations.
- Implement the changes directly in the repository.

==================================================
FINAL DELIVERABLES
==================================================

You must provide:
1. actual repository code changes
2. improved post-login landing/dashboard flow
3. new or improved authenticated sidebar shell
4. role-aware Admin tab visibility
5. protected admin routing
6. updated tests
7. updated docs
8. final engineering summary including:
   - what the old flow was
   - what was improved
   - how admin visibility is enforced
   - remaining limitations if any

Start now by:
1. auditing current ChartDB authenticated layout and routing
2. inspecting the relevant UX organization patterns in ExcaliDash
3. implementing the new post-login dashboard shell
4. enforcing role-aware Admin visibility
5. updating tests and docs
6. committing in logical phases

UI reference requirement:
Use the provided ExcaliDash screenshots as a functional reference for:
- the post-login landing experience
- the left sidebar layout
- section grouping
- user footer area
- page title hierarchy
- role-aware Admin visibility

The implementation does not need to be pixel-perfect, but it must preserve the same UX clarity and navigation quality.

Do not add dead sidebar links.
Only show routes/pages that are implemented and wired to real data.
If a page is partially implemented, complete the minimum viable integration before exposing it in navigation.

Behavior requirement:
After login, the user must land on the main library/dashboard page, similar in spirit to ExcaliDash's "All Drawings" experience.
This page should become the natural operational home of the authenticated user.


Git workflow is part of the acceptance criteria.

The task is NOT complete unless:
- real commits were created
- commits follow the required logical sequence
- work is not left as one uncommitted patch
- final output includes the actual commit list

If implementation is correct but commits are missing or badly grouped, the task is considered incomplete.
