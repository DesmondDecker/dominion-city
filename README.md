# Dominion City Church — management system

MERN stack, deployed on Netlify. Offline-first for check-in, member
records, and giving across dozens of branches and satellite fellowships.

## Architecture

- **Client**: React (Vite) + PWA, hosted on Netlify. Installable on
  tablets/phones/laptops. Reads/writes to a local IndexedDB store first
  (`client/src/lib/db.js`), so the UI works with no connection.
- **API**: Netlify Functions (serverless) — one function per resource,
  in `netlify/functions/`. This replaces a standalone Express server.
- **Database**: MongoDB Atlas (cloud-hosted — Netlify has no storage
  of its own).
- **Sync model**: check-ins and giving entries are **append-only** —
  every write is a new record with a client-generated UUID
  (`clientEventId`), never an edit. That's what makes offline writes
  safe: two devices can both queue a write for the same person/event
  and neither one conflicts, they just both land. Member record edits
  (name, phone) use simple last-write-wins by timestamp, since real
  conflicts there are rare.

## Production readiness checklist

Honest status, not a claim that this is fully production-ready — it
hasn't been run in a real browser or deployed anywhere yet.

### Hardened in this pass
- `.gitignore` and `.env.example` — neither existed before; secrets
  and `node_modules` could have been committed by accident.
- Database indexes on the collections that get queried on every page
  load (`Member`, `CheckIn`, `WelfareCase`, `Event`, `GivingEntry`).
- Login brute-force lockout — 5 failed attempts locks that email out
  for 15 minutes, tracked in MongoDB (`LoginAttempt`) since a
  serverless function has no memory between requests.
- Error responses no longer leak internals — every function now only
  returns `err.message` to the client for errors it intentionally
  threw (with a `statusCode` already set); anything unexpected returns
  a generic message and logs the real error server-side instead. This
  was applied mechanically across all 17 functions in one pass, then
  double-checked for a side effect: a couple of functions
  (`branches.js`, `welfare-requests.js`) were relying on Mongoose's own
  validation errors to explain what was missing, which have no
  `statusCode` and would have been swallowed into the generic message
  — those two got explicit field checks added back.
- A `health.js` endpoint for uptime monitoring.

### Hard blockers before go-live
- **This code has never been run.** No `npm install`, no dev server,
  no browser. Everything above is verified by reading it carefully,
  not by executing it. Budget real time to run `netlify dev` and click
  through every module before trusting it with real data.
- ~~No way to create the first admin account.~~ **Fixed** — visiting
  the site for the first time (or going to `/setup` directly) now
  offers a one-time setup form that creates the first `national_admin`
  account. `bootstrap.js` permanently locks itself the moment a single
  `User` document exists anywhere, so it can't be used to plant a
  second admin later — the only way it ever runs again is a genuinely
  empty database.
- Set every variable in `.env.example` in the Netlify dashboard, not
  just locally.
- Set up MongoDB Atlas for real: cluster, database user, and network
  access rules (allow Netlify's egress or use a properly scoped
  connection — don't leave it wide open long-term).
- The `netlify.toml` functions path (`../netlify/functions` relative
  to `base: client`) was reasoned through, not verified against a real
  deploy — confirm functions actually bundle correctly on first push.
- Configure at least one email provider for staff invites to work.

### Strongly recommended, not yet done
- **Test coverage is still thin.** Welfare's access control has real
  Jest tests now (see below) — everything else still has none.
- Error tracking (Sentry or similar) — right now failures only surface
  in Netlify's function logs.
- Confirm MongoDB Atlas automated backups are actually enabled for
  your tier.
- ~~Mobile responsiveness was flagged early and never built.~~
  **Partially fixed** — the sidebar is now a responsive off-canvas
  drawer below 768px (mobile header + hamburger menu), the dashboard
  grids (Overview, Admin) collapse to one column, and the data tables
  scroll horizontally instead of breaking the page. This has NOT been
  tested on a real phone — it was built by reading the CSS carefully
  against common breakpoints, the same honesty caveat as everything
  else in this list. Worth an actual walkthrough on a real device
  before trusting it for a Sunday-morning check-in.
- Privacy/data-protection review: this system stores health-adjacent
  data (`medicalNotes`), financial records (giving), and
  vulnerable-population data (welfare cases). Get real legal guidance
  for your jurisdiction — this is outside what I can advise on.
- Load testing at the scale this was designed for (dozens of
  branches).

### Feature gaps (incomplete, not security issues)
- Giving and Pastoral care modules aren't built.

## Local dev setup

```bash
# server deps (used by netlify/functions)
npm install

# client deps
cd client && npm install

# run locally with Netlify CLI (proxies functions + client together)
npm install -g netlify-cli
netlify dev
```

Environment variables needed (set in Netlify dashboard or a local `.env`):

```
MONGODB_URI=<your Atlas connection string>
JWT_SECRET=<random secret>
```

## Deploying to Netlify

1. Push this repo to GitHub.
2. In Netlify: "Add new site" → connect the repo.
3. Build settings are already in `netlify.toml` (base: `client`,
   publish: `client/dist`, functions: `netlify/functions`).
4. Add `MONGODB_URI` and `JWT_SECRET` under Site settings → Environment
   variables.
5. Deploy.

## What's built so far (starter scaffold)

- Full data model for the hierarchy: `Church`, `Branch` (branch or
  fellowship, self-referencing for nesting), `Department`
  (national or branch-scoped), `Household`, `Member`, `User` (staff,
  with role + scope), `Event`, `CheckIn` (append-only), `GivingEntry`
  (append-only).
- Auth: login function issuing a JWT with role + branch/department
  scope baked in (`auth-login.js`, `lib/auth.js`).
- One complete end-to-end module — **Branches** — as the pattern to
  copy: `netlify/functions/branches.js` (server CRUD, role-gated) +
  `client/src/pages/Branches.jsx` (reads local cache first, syncs from
  server, offline-safe writes via the outbox).
- The offline sync layer itself: `client/src/lib/db.js` (local cache +
  outbox queue + sync-on-reconnect) and `client/src/lib/checkIn.js` as
  a second worked example (append-only, offline-first check-in).

## Welfare department (built)

The most sensitive module, so it has its own access layer rather than
reusing plain branch scoping:

- **Models**: `WelfareCase`, `WelfareRequest` (approval workflow),
  `WelfareDisbursement` and `WelfareVisit` (both append-only, same
  offline-safe pattern as `CheckIn`/`GivingEntry`).
- **Access control** (`lib/welfareAccess.js`): a case is only visible to
  the national admin, the branch admin for that branch, the assigned
  caseworker, or an explicitly added additional viewer. Unauthorized
  requests get a 404, not a 403, so a case's existence isn't confirmed
  to someone who shouldn't see it. List views return summary fields
  only; the sensitive `details`/`notes` fields are only included in
  the access-gated single-case fetch.
- **Functions**: `welfare-cases.js`, `welfare-requests.js`,
  `welfare-disbursements.js`, `welfare-visits.js`.
- **Client**: `lib/welfare.js` (offline-first case cache + append-only
  disbursement/visit recording), `pages/WelfareDashboard.jsx` (case
  list, filters, new case form), `pages/WelfareCaseDetail.jsx`
  (disbursement log, visit log — both work fully offline, e.g. during
  a home visit with no signal).

## Members module (built)

Unblocks every other module that needs to reference a person:

- **Function** (`members.js`): search by name/phone, filter by status,
  branch-scoped, create/edit.
- **Client** (`lib/members.js`): offline-first search (falls back to
  filtering the local cache when offline), and offline-safe create —
  a member added with no connection appears instantly under a temp id
  and is swapped for the real server record once it syncs (see the
  reconciliation logic added to `lib/db.js`'s `syncOutbox`, reusable by
  any module, not just Members).
- **Reusable pickers**: `components/MemberPicker.jsx` and
  `components/BranchPicker.jsx` — searchable select components any
  module can drop in instead of asking someone to paste a raw ID.
  The Welfare "new case" form now uses both, replacing the placeholder
  text inputs from the first pass.
- **Pages**: `pages/Members.jsx` (list, search, filters, add form),
  `pages/MemberDetail.jsx` (detail view + inline status change).

## Bug-fix pass

A review pass caught and fixed several real issues:

- **Added `church.js`** — the Church document was required by `Branch`
  and `Department` but nothing could ever create one. It now
  auto-provisions on first GET.
- **Moved server dependencies to `netlify/functions/package.json`**
  (not the repo root) — with `[build].base = "client"`, Netlify's
  install step runs inside `client/`, so the root `package.json` was
  never actually getting installed for the functions.
- **`welfare-requests.js`** — approving/declining a request now checks
  access to that specific case's branch, not just the approver's
  global role. Previously a branch admin at one branch could decide on
  another branch's request.
- **`welfare-cases.js`** — creating a case now checks the creator has
  access to that branch. Previously anyone authenticated could open a
  case against any branch.
- **`lib/db.js`** — `syncOutbox` is now guarded by a lock, so two
  overlapping sync calls (fire-and-forget from `queueWrite` racing the
  `online` event listener) can't both submit the same pending write —
  this mattered for non-idempotent creates like Members and Branches.
- **`lib/welfare.js`** — `createCase` now writes an optimistic local
  record (same pattern as `createMember`), so a case opened offline
  shows up immediately instead of disappearing until it syncs.
- **`MemberPicker`** now actually uses its `value` prop, so it works
  when pre-filled, not just when a user types a fresh search.
- **`WelfareCaseDetail`** now falls back to the local cache if an
  online fetch fails partway (previously only the fully-offline branch
  had a fallback).
- **Unbuilt nav routes** (Check-in, Events, Departments, Giving,
  Pastoral care, Admin) now show a "coming soon" page instead of
  rendering blank.
- **Fellowship Leaders** now get the same branch-scoped welfare case
  visibility as Branch Admins, rather than being treated like a bare
  caseworker with no case access by default.
- **Member edits** can now include the children's-ministry safety
  fields (`isChild`, `authorizedGuardians`, `medicalNotes`) — they
  were in the schema but had no way to be set via the API.

## Events module (built)

- **Models**: `Event` (already existed in the scaffold) and the new
  `EventRSVP` (one record per member/guest per event, upsert on
  re-RSVP — not append-only like Welfare/Giving, since an RSVP is
  meant to be changed, not logged as history).
- **Functions**: `events.js` (create/list/edit/publish/cancel, scoped
  by which branches the event applies to — an event with no branches
  set applies to all of them) and `event-rsvps.js`.
- **Client**: `lib/events.js` and `lib/eventRsvps.js`, same
  offline-first + temp-id reconciliation pattern as Members and
  Welfare. `pages/Events.jsx` (card grid, new-event form, draft/
  published/cancelled badges) and `pages/EventDetail.jsx` (publish/
  cancel actions, RSVP count and list).

Known rough edge: event creation currently reads the church id from
`localStorage` (set when the Branches page loads) rather than fetching
it independently — same shortcut Branches.jsx uses. Fine for now, but
worth centralizing into a shared "current church" hook once a second
or third module needs it, rather than copying the localStorage read
again.

## Departments module (built)

The generic version, for every department that isn't Welfare (which
has its own dedicated module with case-management and access controls
— see above). Covers Choir, Ushering, Media, Protocol, Children's
Church, and any other department:

- **Model**: `Department` (already existed — national or branch scope,
  sub-departments, default meeting info) plus a new `DepartmentDuty`
  model for scheduling who's serving on a given date.
- **Functions**: `departments.js` (create/list/edit, scoped the same
  way Events are — national departments visible to everyone, branch
  departments only to staff scoped to that branch) and
  `department-duties.js`.
- **Roster**: reuses the existing `Member.departments` array rather
  than a separate join table — adding someone to a department's roster
  is really just appending to that field, so it goes through the same
  `updateMember` offline-safe path already built for Members.
  `members.js`'s search was extended with a `departmentId` filter to
  power the roster view.
- **Client**: `lib/departments.js`, `lib/departmentDuties.js`, same
  offline-first pattern as everywhere else. `pages/Departments.jsx`
  (split into National / Branch sections, create form) and
  `pages/DepartmentDetail.jsx` (roster with add/remove via
  `MemberPicker`, and a duty-scheduling tab).

Meeting attendance (distinct from Sunday check-in) is now built too:
`DepartmentAttendance` follows the exact same append-only,
idempotent-by-`clientEventId` pattern as `CheckIn` — a rehearsal or
meeting gets its own tap-to-mark-present flow
(`lib/departmentAttendance.js`, the "Meeting attendance" tab on
`DepartmentDetail.jsx`), reusing the roster already built for that
department rather than a separate member list.

## Check-in module (built)

The highest-value offline module — this is the one that has to work
with a room full of people and no signal:

- **Function** (`checkins.js`): GET returns today's check-ins for a
  branch (used for the running count); POST is idempotent by
  `clientEventId`, so a retried offline sync can never double-count
  someone.
- **Client** (`lib/checkIn.js`): `checkInMember` writes locally first
  and queues the sync — the tap-to-check-in feels instant regardless
  of connectivity. `loadTodayCheckins` merges local + server results so
  a check-in recorded moments ago doesn't briefly disappear from the
  count while it's still syncing.
- **`lib/session.js`** — a small new helper that reads the signed-in
  user's id/role/branches out of the stored JWT for UI convenience
  (defaulting the branch picker, tagging who checked someone in). It's
  explicitly *not* a security boundary — the server independently
  verifies the token on every request; this is display-only.
- **`pages/CheckIn.jsx`** — branch picker, a search box, and a tap
  target per result that turns into a green checkmark. A running count
  card at the bottom. Built for speed over anything else: minimal
  taps, instant feedback, works with the wifi off.

Known gap: there's no **undo** for a mistaken check-in yet (it was on
the original feature list). Given check-ins are append-only by design,
"undo" isn't a delete — it needs to be a reversal record, same
pattern as Welfare disbursement corrections. Worth building once this
sees real use and the need for it is concrete rather than speculative.

## Evangelism & Mobilisation (built as an opt-in department feature)

Rather than a separate module, this is a feature flag any department
can turn on: `Department.trackOutreachContacts`. When set, that
department's detail page gets an extra **Outreach contacts** tab —
field records of who was reached during outreach (name, phone, area,
outcome: accepted Christ / interested / not interested / already a
member, follow-up flag). This is the piece Evangelism & Mobilisation
specifically needs beyond plain roster/duty/attendance — soul-winning
records are fundamentally a different shape of data (a running log of
new contacts, not a fixed roster of existing members).

- **Model**: `EvangelismContact` — append-only and idempotent by
  `clientEventId`, same offline-safety reasoning as `CheckIn`: this
  gets captured door-to-door or at a crusade with no signal, and a
  retried sync must never lose or duplicate an entry.
- **Function**: `evangelism-contacts.js`, scoped to the department the
  same way duties/attendance are.
- **Client**: `lib/evangelismContacts.js`, same offline-first merge
  pattern as check-in/attendance.
- Not yet wired: `EvangelismContact.convertedMember` exists in the
  schema for linking a contact to a real Member record once they join,
  but there's no UI action to do that conversion yet — logged as a
  gap rather than silently left out.

## Department creation, expanded

Three additions on top of the original inline form:

- **Its own page** (`pages/CreateDepartment.jsx`, route `/departments/new`)
  instead of an inline form on the list page — room to grow (head
  assignment, meeting schedule) without cramming the list view.
- **Head-of-department assignment** — this needed a staff picker,
  which didn't exist yet, so it came with its own small stack:
  `users.js` (a new, read-only search endpoint over staff accounts —
  there's still no signup/invite flow, so accounts still have to be
  seeded directly in MongoDB), `lib/users.js`, and
  `components/StaffPicker.jsx` (same search-select pattern as
  `MemberPicker`, just over `User` instead of `Member`). The head can
  also be reassigned later from the department detail page, not just
  set at creation.
- **Bulk "set up standard departments"** — one action on the
  Departments list page that creates a preset set (Choir, Ushering,
  Media & Technical, Protocol, Children's Church, Evangelism &
  Mobilisation with outreach tracking pre-enabled, Welfare, Prayer
  Band) for a chosen branch in one go, rather than creating each by
  hand when a new branch goes live. Each one can still be edited or
  removed afterward — this is a starting point, not a locked template.

## Staff invite flow (built) — closes the signup gap

This was a real gap called out repeatedly: staff accounts had to be
inserted into MongoDB by hand. Now there's an actual invite flow:

- **`lib/email.js`** — a quota-aware load balancer, not just a retry
  chain: Resend → Brevo → SendGrid → Mailgun in priority order, but it
  tracks each provider's daily send count in MongoDB
  (`EmailProviderUsage`) and specifically distinguishes two different
  reasons to switch providers — out of quota (a 429 from the provider,
  or our own tracked count hitting the configured daily limit) skips
  that provider for the rest of the day and moves on; any other
  failure (bad key, outage) also moves to the next provider but
  doesn't mark it exhausted, since it'll likely work again next time.
  Daily limits are configurable per provider via
  `RESEND_DAILY_LIMIT` / `BREVO_DAILY_LIMIT` / `SENDGRID_DAILY_LIMIT` /
  `MAILGUN_DAILY_LIMIT` — the defaults in the code are placeholders,
  not a claim about any provider's actual current free-tier limit;
  check each provider's dashboard and set these to match your real
  plan. This is NOT simultaneous sending — exactly one provider sends
  each email. New env vars: `RESEND_API_KEY`, `BREVO_API_KEY`,
  `SENDGRID_API_KEY`, `MAILGUN_API_KEY` + `MAILGUN_DOMAIN`,
  `EMAIL_FROM`, `SITE_URL`.
- **`StaffInvite` model** — a pending invite with a random token,
  7-day expiry, converted into a real `User` once accepted.
- **`staff-invites.js`** — national/branch admins create invites
  (branch admins are scoped, and can't invite a national admin). If
  every email provider fails, the invite is still created and the
  accept link is returned in the response so an admin can share it
  manually rather than the whole thing silently failing.
- **`accept-invite.js`** — deliberately unauthenticated (no one has a
  token yet); gated by the invite token itself instead. Validates the
  token, creates the account, logs them straight in.
- **Client**: `pages/Admin.jsx` (invite form + pending invites list —
  the first real content in what was a placeholder page) and
  `pages/AcceptInvite.jsx` (public route, no login required, sets a
  password and signs in). Invite sending is deliberately **not**
  offline-first, unlike everything else in this app — it needs to
  actually reach the server to send an email, so if you're offline it
  says so plainly rather than queuing silently and letting an admin
  think the invite went out.

## Global scale: territories and the global member directory

Two things needed for a church operating across countries, not just
branches within one country:

- **`Territory` model** — Continent → Country → Region, self-referencing
  like Branch/Department already are. `Branch.territory` links a branch
  up to one; `territories.js` is the CRUD (structural changes —
  creating a new territory — are national-admin-only, since defining
  "West Africa" as a region is a top-level decision, not a branch-level
  one). A new `territory_admin` role and `User.territories` scope field
  let regional leadership see their region without full national access.
- **`territory-stats.js`** — a rollup endpoint, deliberately limited to
  what's actually measurable right now (branch count, member count,
  today's check-ins, aggregated per branch and grouped up client-side
  by territory). It does NOT include at-risk numbers — that engine
  doesn't exist yet, and faking the number would be worse than leaving
  it out. `pages/Territories.jsx` shows this as cards per territory.
- **Member transfer, for real this time** — building this surfaced a
  genuine bug: `branch` was never in `members.js`'s PATCH whitelist, so
  transferring a member between branches was silently impossible
  through the API the whole time, despite Member always having a
  `branch` field. Fixed, and `Member.transferHistory` now logs every
  move (from/to branch, when) — the piece that turns "moved branches"
  into "moved branches, and we can see when someone crossed a border."
  `MemberDetail.jsx` has a Transfer action and shows the history.
- **Global directory, visually** — the Members list already searched
  across every branch a national/territory admin could see; it just
  didn't *show* which branch each result belonged to, which made
  "search everyone" indistinguishable from "search my branch" in the
  UI even though the server was already scoping it correctly. Added a
  Branch column.
- **`branches.js` got a PATCH handler it didn't have before** —
  branches could be created but never edited via the API at all
  (needed for territory assignment, but was a gap regardless).

Deliberately not built in this pass, per the earlier discussion:
localization/multi-language UI, WhatsApp as a channel, and data
residency — all flagged as real needs for a global footprint, but each
is its own significant piece of work, not something to bolt on inside
this one.

## Tests — Welfare access control

The first automated tests in this codebase, deliberately starting with
the highest-stakes logic: **`lib/welfareAccess.js`**, where a bug is a
privacy failure, not just an inconvenience.

- **Framework**: Jest + `mongodb-memory-server` (an in-memory MongoDB),
  not mocks — these run real Mongoose queries against real documents,
  so they actually exercise the same code path production does.
- **`__tests__/welfareAccess.test.js`** — unit tests on
  `loadCaseWithAccess` and `scopeCaseQuery` directly: national admin
  sees everything, a branch admin sees only their branch (and strictly
  nothing from another branch — tested explicitly, not just "doesn't
  error"), the assigned caseworker and any explicitly added viewer can
  get in, an unrelated staff member gets a 404 (not a 403 — the case's
  existence itself shouldn't be confirmed), and a regression test for
  the fellowship-leader access-model bug found earlier.
- **`__tests__/welfare-cases.test.js`** and
  **`__tests__/welfare-requests.test.js`** — integration tests that
  call the actual exported HTTP handlers (not just the access-control
  helper in isolation), specifically encoding the two real bugs found
  and fixed in the earlier code-review pass: case creation with no
  branch-access check at all, and request approval where a branch
  admin's global role alone was enough to approve another branch's
  request. These are written as regressions — if either bug ever came
  back, these tests would fail.

**Run them** (from `netlify/functions/`): `npm install && npm test`.

Said plainly: **these have not been executed in this environment** —
no network access here to install Jest or download the in-memory
MongoDB binary. They were written by reading the actual handler code
line by line and matching each test's expectations to it, not by
running them and seeing green. Treat them as a strong starting point
that needs a real `npm test` run to confirm, not a guarantee.

## Admin oversight dashboard with analytics (built)

Turned the Admin page from "just staff invites" into a real oversight
dashboard, backed by live aggregation, not demo numbers:

- **`admin-stats.js`** — one endpoint, six parallel aggregation
  queries: branch/territory counts, members by status (feeds an
  "at-risk" KPI directly from real data), a 7-day check-in trend,
  upcoming events + total RSVPs, department count, welfare cases by
  status, and staff by role. Scoped by role like everything else —
  national admins see the whole organization, branch/territory admins
  see their own scope. Restricted to admin-ish roles entirely; anyone
  else gets a 403.
- **Welfare shows counts only, never details** — this page aggregates
  case status counts (`3 open, 1 approved`), never a summary, name, or
  anything else from a case. That's not a new restriction invented for
  this page; it never exceeds what an admin could already see by
  querying Welfare directly with the same branch scoping.
- **`MiniBarChart.jsx`** — a small dependency-free inline chart for the
  7-day trend, deliberately not adding a charting library for one
  component. It's a direct callback to the "Sunday attendance, last 8
  weeks" bar chart from the very first mockup at the start of this
  whole project.
- **Two real gaps found and fixed while building this**: `staff-invites.js`'s
  GET had no role check at all — any authenticated user, including a
  check-in volunteer, could list pending staff invites for their
  branch. And the sidebar showed "Admin" and "Territories" to every
  role regardless of permission, so a non-admin could see the nav item
  and hit a 403 on click rather than never seeing it at all. Both fixed.

Worth being precise about what this was *not*, at the time it was
written: it deliberately didn't touch the branch-level **Overview**
page, which was still static demo numbers then. That gap is closed
now too — see the section below.

## Overview dashboard — real data, and the at-risk engine (built)

This closes the single most-referenced gap in this whole README.
Every hardcoded number from the original mockup (`312` attendance,
`Marcus Toray`/`Rita Solano`/`Jon Byrne`, the fixed event list) is
gone — Overview now computes everything live, scoped to whichever
branch is selected (defaulting to the signed-in staff member's own
branch when they only have one).

- **`branch-overview.js`** — one endpoint: 8-week attendance trend,
  first-time visitors and new members this month, an upcoming-events
  list, and — the piece that had been discussed several times but
  never actually built — a real **at-risk computation**.
- **The at-risk engine, finally**: a member counts as needing
  follow-up if their `lastAttendedAt` is older than the branch's
  threshold (or Church's default if the branch has none set), or if
  they've never checked in at all. This only works because of one
  small but important fix alongside it: **`checkins.js` never updated
  `Member.lastAttendedAt`** — Check-in was recording attendance in its
  own collection the whole time, but nothing fed that back to the
  member record, so at-risk status could never have been computed from
  real data no matter what queried it. Fixed as part of this.
- **Two numbers are honest approximations, not exact**: "first-time
  visitors this month" and "new members this month" are read off
  `createdAt` on the Member record, since there's no separate
  first-visit or status-change-date field. A member record created
  this month with `status: 'member'` isn't necessarily someone who
  *just* converted from visitor this month — it's the closest signal
  available without adding that tracking. Worth knowing about rather
  than treating those two numbers as more precise than they are.
- **Client**: `lib/branchOverview.js`, a `BranchPicker` for admins
  scoped to more than one branch, and `MiniBarChart` extended with a
  configurable label formatter so the same component now serves both
  Admin's daily buckets and Overview's weekly ones instead of writing
  a second chart.

## Fresh audit pass — found two more real gaps

Asked "what do you need to fix" prompted an actual re-audit of
everything built since the last systematic review (Events,
Departments, Territories, Admin, the Overview rewrite, bootstrap, the
responsive layout — a lot of new surface area with no re-check). Found:

- **No client-side route protection existed at all.** Every page under
  `Layout` — Members, Welfare, Check-in, all of it — was reachable
  with no token or an expired one. The server correctly rejected the
  underlying API calls with 401s, but the page itself would just sit
  there broken instead of sending the person to `/login`. Fixed with
  `components/RequireAuth.jsx`, wrapping the entire authenticated route
  group in `App.jsx`.
- **`territory-stats.js` had no role restriction**, unlike
  `admin-stats.js` which explicitly gates to admin roles. Any
  authenticated user could call it directly. Low severity (it only
  returns counts), but fixed for consistency with the same pattern
  used everywhere else.

## Check-in undo, contact conversion, and expanded test coverage

Closes the three items from the last review pass.

- **Check-in undo** — implemented as a reversal record (`CheckIn.reversalOf`,
  storing the original's `clientEventId` rather than a Mongo ref, since
  the original might not have synced yet when someone undoes it).
  `checkins.js`'s GET now nets out reversed entries so the running
  count and "who's checked in" state are always correct, and the same
  net-effective filtering was replicated client-side in
  `lib/checkIn.js` for the offline path. Tapping an already-checked-in
  person in `CheckIn.jsx` now undoes it instead of doing nothing.
  Known, accepted limitation: undoing doesn't retroactively restore
  `lastAttendedAt` to whatever it was before, if there's no earlier
  check-in to fall back to — a rare edge case not worth a full
  recomputation for.
- **Evangelism contact → Member conversion** — deliberately **online-only**,
  unlike everything else in this file. Converting a contact links two
  documents by their real server `_id`, and chaining two
  offline-optimistic creates with a cross-reference (a temp member id
  pointing at a temp contact id) would be fragile, not genuinely
  offline-safe. Same honest tradeoff already made for staff invites.
  `evangelism-contacts.js` got a PATCH handler it didn't have before.
  Conversion requires the department to have a branch assigned
  (national-scope departments can't convert contacts yet — there's no
  UI to pick a target branch for those).
- **Test coverage expanded past Welfare**, in two different test
  setups since the logic under test runs in two different places:
  - `__tests__/checkins.test.js` (Jest + in-memory MongoDB, same
    infra as the Welfare tests) — the core idempotency guarantee
    (retrying the same `clientEventId` never double-records),
    `lastAttendedAt` updating correctly, and the new undo/reversal
    logic including that a reversal doesn't touch `lastAttendedAt`.
  - `client/src/lib/__tests__/db.test.js` (new: Vitest +
    `fake-indexeddb`, since this logic runs in the browser against
    real IndexedDB, not Node/MongoDB) — temp-id reconciliation, the
    sync concurrency lock, and failed-item handling.
  - **Writing these tests caught a real bug**: `syncOutbox`'s query
    only filtered on `synced === false`, which a failed item stays at
    forever — nothing actually skipped items already marked `failed`,
    so a permanently-failed write got silently retried on every future
    sync, directly contradicting the comment sitting right above the
    code. Fixed, with a regression test that would have caught it.
  - Run the client tests from `client/`: `npm install && npm test`.
    Same honesty note as every test suite in this project: written by
    reading the code carefully, not executed in this sandbox — needs a
    real `npm test` run to confirm.

## Build roadmap (suggested order)

1. **Org setup** — branch/fellowship CRUD (done as the example),
   department CRUD, church branding (logo/colors upload).
2. **Auth & roles** — login is scaffolded; add signup/invite flow,
   role assignment UI.
3. **Members & households** — CRUD, search/filter, at-risk flagging
   logic (reads from CheckIn history).
4. **Check-in** — the highest-value offline module; sync layer is
   already modeled, needs the UI (search + tap, household check-in,
   running count).
5. **Events** — public calendar (no auth) + staff create/edit/RSVP.
6. **Departments** — rosters, department attendance, duty scheduling.
7. **Giving** — ledger entry UI, batch reconciliation, statements.
   Treat this module with the same care as check-in: append-only,
   never mutate.
8. **Pastoral care** — follow-up queue, care notes (access-restricted).
9. **Reporting** — branch Overview dashboard (local data, works
   offline), national rollup (server-side aggregation, requires
   connectivity).
10. **Communications** — bulk SMS/email to filtered segments.

Each module after Branches follows the same three-file pattern: a
Mongoose model (already stubbed for most), a Netlify function with
role-gated CRUD, and a React page that reads local cache first and
queues writes through `db.js`.
