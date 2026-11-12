# EventSphere – everything that is still pending

One list of all open work, checked against the code and the spec on 2026-11-12. Tick an item when
its API, UI and tests are done, then update its status in
[requirements-catalog.md](requirements-catalog.md). It replaces the open items of
`auth-remaining.md`, which can be removed once you agree.

IDs like `DISC-3` are from the catalog. "Static" means the screen exists but shows sample data.

## 1. What is finished (verified in the code, tests passing)

| Area               | What works today                                                                                                                                                                                                                                            |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth and admin     | sign up (user, organizer), verify email, login, logout, refresh, forgot and reset password, set password from an invite, admin users and organizers pages (approve, reject, reopen, suspend, reactivate, resend invite, send reset link), create organizer. |
| Speakers           | public list and profile (Postgres + Strapi), admin or organizer adds a speaker and resends the invite, the speaker edits their own profile.                                                                                                                 |
| Public listing     | `/events`: search by title, Date (upcoming / past), Price (free / paid), sort (soonest, latest, price, popular), server paging. Card: banner, title, date, venue, price, seats left.                                                                        |
| Public event page  | banner, tagline, about, schedule by day, speakers, venue with map, FAQ, cancelled banner, "coming soon" when Strapi is down. Each session opens `/events/[slug]/sessions/[sessionId]`.                                                                      |
| Organizer events   | create (stepper), edit, page content in Strapi, cover and gallery, publish, cancel, delete a draft (also removes the Strapi page, session entries and files), My events with tabs, counts, search, sort, paging.                                            |
| Organizer sessions | list, add, edit, cancel, speakers, content and cover, halls, hall availability, schedule board with drag and drop and clash rules.                                                                                                                          |
| Venues and halls   | admin list, create, detail, edit venue and hall, add or delete a hall, delete a never-used venue, activate or deactivate venue or halls (blocked while a session that is not over uses them), public venue browse.                                          |

## 2. Suggested order (and why)

1. **Finish week 1 auth** (section 4): profile, avatar, change password, route protection, rate
   limits. Small tasks that close a module, and `/profile` is already built on sample data.
2. **Free registration** (REG-1, 2, 3, 4): the next click after the event page. Register, cancel,
   see status, with the seat check inside one database transaction. Unlocks agenda, attendees,
   real seats left, popular sort and the dashboards.
3. **Paid registration with Stripe** (REG-5, 6, 7): Checkout in test mode, a verified webhook marks
   the ticket paid, confirmation page, transaction history. Builds on step 2.
4. **Close the discovery gaps** (section 3A): category, event type, date range, city, sold-out
   filter. They are spec items (DISC-1, DISC-3) that are only partly met.
5. **Personal agenda and bookmarks** (AGD-1, 2, 3, 5) and keyboard drag and drop (AGD-4).
6. **Polls** (ORG-4, POLL-1 to 5), then **notifications, announcements and SSE** (NOTIF-1 to 7,
   ORG-3). They need registered attendees and produce the notifications.
7. **Analytics dashboards** on real data (DASH-1 to 8, BE-6), replacing the sample files.
8. **Quality and delivery**: Sentry, error pages, PWA, tests, CI and SonarCloud, Vercel deploy,
   API collection, test report, documentation.

## 3. Events, listing, event details, sessions, schedule board, venues

### 3A. Discovery and listing (DISC-1, DISC-3)

- [ ] **Event category**: `events` has no category column, so the card cannot show one and the
      list cannot filter by it. Decide (Postgres enum, or a small table), then: column and
      migration, create and update schemas, form field, public DTO and card badge, `category`
      filter, filter group in `PublicEventFilters`.
- [ ] **Event type**: the catalog says `in_person | online | hybrid` on `events`, but the column
      does not exist (only sessions have a `mode`). Add it, with the publish rule "in person and
      hybrid need a venue" in the service, the form field and a list filter.
- [ ] **Date filter**: only Upcoming / Past today. Add a date range or quick choices (this week,
      this month).
- [ ] **City filter**: shown disabled (Static). Add `city` and `state` to the list query and
      repository (venues have both), then enable it.
- [ ] **"Hide sold-out events"**: shown disabled. Filter on seats left above zero, or no limit.
- [ ] **Popular sort** works but counts registrations, so every event is 0 until REG-1 exists.

### 3B. Event and session pages (DET-1, DET-2)

- [ ] **"Organised by"** on the public event page is a fixed "Organiser" (Static). Add the
      organisation name to the public detail DTO and show it.
- [ ] **Session description on the schedule** (DET-2): rows show name, speakers, start and end;
      the description is only on the session's own page. Decide: accept that, or add a one-line
      summary to the public session list item.
- [ ] **Register button** is disabled until registration exists.
- [ ] **Check by hand: speaker page "Sessions"** (SPK-2; built and unit tested, the SQL was only
      rendered, never run against Postgres). `GET /api/speakers/[slug]/sessions?timeline=now|upcoming|past`
      (grouped by event, paged by event). Check: a speaker with a live, an upcoming and a past session
      shows each in its own section; a draft or cancelled session, and a draft or cancelled event,
      never show; seats left drops after a booking; a suspended speaker is a 404.
- [ ] **Speaker page: still missing from the design**: ratings (★ per session and event, average
      rating; there is no ratings table), event thumbnails (they live in Strapi), the "Log in to
      book" banner for guests, the "At a glance" card (dropped on purpose), and co-speakers on a
      session row (dropped on purpose).
- [ ] **Session page actions**: add to my agenda, bookmark, register (need AGD-1, AGD-5, REG-1).

### 3C. Schedule board (AGD-4)

- [ ] **Keyboard drag and drop**: the board has only Mouse and Touch sensors
      (`ScheduleBoard.tsx`). Add dnd-kit's `KeyboardSensor` with screen-reader announcements, or a
      "Move to…" dialog on each block. Today the keyboard route is the Edit session form, which
      works but is not drag and drop. The spec and the `drag-and-drop` skill ask for keyboard access.

### 3D. Organizer screens still static

- [ ] **Attendees tab** `/organizer/events/[eventId]/attendees`: all sample data, Export CSV off.
      Needs registrations and `GET /api/events/[eventId]/attendees` (search, status, paging,
      owner check).
- [ ] **Quick actions** on the event overview (send notification, manage polls, view analytics) are
      switched off. They come with NOTIF-6, ORG-3, ORG-4 and DASH.
- [ ] **Speaker "My sessions"** `/speaker/sessions`, its detail page and **submit a session**
      `/speaker/sessions/new` use sample data. The spec has organizers assigning speakers, not
      speakers proposing sessions. Decide: wire "My sessions" to real data
      (`GET /api/me/sessions` through `session_speakers`) and drop the submission call, or build
      it. File upload for materials and the live console are shown as not available.

### 3E. Venues and halls

- [ ] **Check by hand: edit and delete a venue** (`VEN-2`, `VEN-3`; built and unit tested, not yet
      tried against Postgres). As an admin: edit a venue (only the changed fields are sent;
      renaming to an existing venue in the same city shows 409); edit a hall (rename, seats; a
      name used by another hall shows 409); delete a venue that has no event and no session, and
      it disappears from the list; delete a venue that has an event (even a past or draft one) and
      the dialog says to deactivate it instead. A hall with a session that is not over yet
      (draft, future or live) cannot be edited at all (409 `HALL_HAS_SESSIONS`, names the
      sessions); once they are over or cancelled it can. Venue edits are not locked yet.
- [ ] **Hall guard race**: saving a session checks "hall is active" without locking, so a session
      saved at the same instant as a deactivation could still land in an inactive hall. Lock the
      hall row when a session is saved (sessions repository).

## 4. Auth and admin (week 1 leftovers)

- [ ] **AUTH-3** profile: `GET` and `PATCH /api/me/profile` (names in `users`; phone, city, postal
      code in `user_profiles`). `/profile` runs on sample data until this exists.
- [ ] **AUTH-4** avatar: `POST` and `DELETE /api/me/profile/avatar`, stored in `user_profiles`
      (reuse the speaker photo checks; delete the old file).
- [ ] **AUTH-5** change password: `PATCH /api/me/password`. A wrong current password is a 400 on
      the field, not 401. One transaction updates it and ends the user's other sessions.
- [ ] **Profile page** `/profile`: wire the name form, avatar and password form (React Hook Form +
      Zod, loading, error and success states). Time zone, two-step verification, device list and
      delete account stay off.
- [ ] **AUTH-8** route protection in `proxy.ts` (the file does not exist yet): guests to
      `/dashboard`, `/profile`, `/admin/*` go to `/login`; signed-in users on `/login` or
      `/signup` go to `/dashboard`. Only a cookie check; the real check stays in each API route.
- [ ] **BE-7** rate limiting: only resend-invite and the password-reset link have a cooldown.
      Add it to login, resend-otp and the reset submit; vote routes later.
- [ ] **ADM-6 to ADM-9** are marked In progress in the catalog: verify and close them.
- [ ] **Admin dashboard on real data**: `AdminOverview` uses `ADMIN_OVERVIEW_SAMPLE`. Wire the
      approval queue to `useGetOrganizerList({ verification: "pending" })` and add
      `GET /api/admin/stats` (users, new users, approved and pending organizers, suspended,
      weekly sign-ups). Published and draft events and registrations can use the events tables now
      and the registrations table later.
- [ ] **Organizer review screen** `app/(app)/dashboard/page.tsx` still uses `SAMPLE_APPLICATION`:
      load `GET /api/me/organizer-application`. Known gap: an attendee with a pending or rejected
      application sees the attendee home instead of the review screen until this is wired.
- [ ] **Organizers page**: Resend invite and Delete organizer (only while not verified) have APIs
      but no buttons or hooks. The Events and Registrations columns stay hidden until the data
      exists.
- [ ] **Users page**: tab counts (one `count(*) FILTER` query), an Unverified email filter,
      `organizerStatus` per row, "Last active" (needs `users.last_login_at`, set at login), and
      the menu actions Change role and Send password setup link.
- [ ] **User profile page**: event registrations (after REG), audit log (needs an audit table),
      Last active, Change role (`USER_ROLE_MANAGE`, one role per user).
- [ ] **Role home dashboards** (attendee, speaker, organizer) are sample data. They get real data
      as registrations, sessions and analytics arrive.

## 5. Modules not started

### Registration and payments (REG-1 to REG-7)

- [ ] Register, cancel, status. Tables `event_registrations`, `session_registrations`,
      `event_check_ins` exist; there is no API or UI. Seat check and unique registration in one
      transaction; free ticket is instant (REG-4).
- [ ] Stripe Checkout in test mode from the database price, payments table, webhook with signature
      check and idempotent confirmation, confirmation page, transaction history. The `stripe`
      package is not installed yet.

### Personal agenda (AGD-1, 2, 3, 5)

- [ ] Agenda and bookmark tables, API, add, remove, reorder with positions saved in one
      transaction, `/my-schedule` on real data and a real `.ics` export.

### CMS leftovers (CMS-2, CMS-3)

- [ ] Content types for announcements and blog articles in Strapi (only speakers, event pages and
      session details exist), and the secret-protected revalidate route for the CMS webhook (no
      revalidate route exists).

### Polls (ORG-4, POLL-1 to 5)

- [ ] Poll, option and vote tables (one vote per user enforced by a unique constraint), organizer
      create and open or close, single and multiple choice limits, results, bar, pie and donut
      charts. `/speaker/polls` is on sample data.

### Notifications and announcements (NOTIF-1 to 7, ORG-3)

- [ ] Notifications table, SSE route with reconnect, reminder job (Vercel Cron, secret-protected),
      registration confirmation, session updates (event cancelled, session moved or cancelled),
      poll announcements, organizer announcements, notification center UI and unread badge
      (`/notifications` is on sample data).

### Analytics dashboard (DASH-1 to 8, BE-6)

- [ ] KPI, line, bar, pie and donut charts, date filter, interaction and refresh, built on SQL
      aggregations scoped to the organizer's own events. `echarts` is installed.

### PWA (PWA-1 to 5)

- [ ] Manifest, Serwist service worker, cached assets and schedules, previously viewed events
      offline, offline banner and fallback page. Nothing exists in `public/` yet.

## 6. Quality, monitoring and delivery

- [ ] **Sentry** (MON-1 to 3): not installed. Failures should be reported without personal data.
- [ ] **Error pages and states** (ERR-1 to 4): no `error.tsx`, `global-error.tsx` or
      `not-found.tsx`, and no offline or network detection.
- [ ] **State** (STATE-1): only one Redux slice exists (`auth-flow`). The project fetches with
      React Query and keeps Redux for client state, so decide which of auth, profile, events,
      registrations, notifications, polling and dashboard need a slice, and note it in the docs.
- [ ] **Structured logs and request IDs** (BE-8): not checked yet.
- [ ] **Tests**: Playwright does not exist (TEST-2: sign up, login, register for an event, poll,
      payment, plus the event journey: create, add session, publish, find, open). Repositories are
      only covered through mocks, so add tests against a test Postgres (TEST-3).
- [ ] **CI and SonarCloud** (SETUP-3, QUAL-1): no workflow or Sonar config exists.
- [ ] **Deploy** (DEP-1): Vercel project, environment variables, migrations on Neon.
- [ ] **Email in production**: `EMAIL_TO` sends every email to one inbox because Resend's test
      sender only delivers to the account owner. Verify a domain, set `EMAIL_FROM` on it and make
      `EMAIL_TO` optional before deploying, or no user receives an email.
- [ ] **Deliverables** (DEL-1, DOD-1): API collection, test report, technical documentation and
      README, and all review comments resolved.
- [ ] **Bonus** (only after every mandatory item): QR check-in, dark mode, Google Calendar export,
      infinite scroll, sharing, recommendations.

## 7. To verify by hand (needs organizer and admin logins)

- [ ] **Delete a draft end to end**: create a draft with a cover, gallery images, a session and a
      session cover; delete it; Postgres has no event or session rows and Strapi has no page,
      session entries or files.
- [ ] **Hall guard**: an upcoming scheduled session in a hall blocks deactivating the hall and its
      venue (409 naming the hall); cancel it, or use one that has ended, and it works. The SQL
      was checked by rendering it, not against Postgres.

## 8. Housekeeping

- [ ] Review and mark Done in the catalog: AUTH-1, 2, 6, 7, 9 and BE-1 to BE-5 (built, still
      Todo).
- [x] New IDs are in the catalog: `VEN-1` admin manages venues and halls, `VEN-2` edit a venue or
      hall, `VEN-3` delete a never-used venue, `DET-3` public session detail page.
- [ ] Commit the seed work (`scripts/seed.ts`, `src/db/seeds/`, still untracked) in its own
      commit with its requirement ID (BE-3).
