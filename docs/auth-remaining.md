# Auth module – what is left

Checklist of the auth work still to build and integrate (checked against the code on 2026-10-26).
Tick an item when its API, UI and tests are done; then update its status in
[requirements-catalog.md](requirements-catalog.md).

## 1. Dashboard: connect what can be real now

- [ ] **Organizer approval queue** → `GET /api/admin/organizers?verification=pending`,
      `POST .../[organizerId]/verify`, `POST .../[organizerId]/reject` with `{ reason }`
      (APIs exist; only the frontend api-service + hooks and a reject-reason dialog are missing).
      Replace `pendingOrganizers` in `src/features/dashboard/utils/admin-overview.sample.ts`.
- [ ] **Organizer review screen** → `GET /api/me/organizer-application` (API exists; the screen
      already has the pending and rejected states). Replace `SAMPLE_APPLICATION` in
      `app/dashboard/page.tsx`.
- [x] **Organizer rejection + reopen** (backend): kept account + reason, email, 409 rules,
      `POST .../[organizerId]/reopen`, migration `0004_organizer_rejection`. Done 2026-10-26.
- [ ] **Reopen button** on the admin rejected-organizers list (`?verification=rejected`).
- [ ] **Admin user stats** → new `GET /api/admin/stats` reading only auth tables: total users, new
      users in the period, approved / pending organizers, suspended users, weekly sign-ups.
- [ ] Keep `publishedEvents`, `draftEvents`, `registrations` on sample data until the events and
      registrations tables exist (see "Later").

## 2. Backend APIs to build

- [ ] **AUTH-3** Update profile: `GET` + `PATCH /api/me/profile` (first/last name in `users`;
      phone, city, postal code in `user_profiles`). Email change is out of scope.
- [ ] **AUTH-4** Profile image: `POST` + `DELETE /api/me/profile/avatar` → Vercel Blob,
      `user_profiles.avatar_url`. Reuse the speaker photo upload (type/size checks, delete old blob).
- [ ] **AUTH-5** Change password: `PATCH /api/me/password` with `currentPassword`, `newPassword`,
      `confirmPassword`. Verify the current password, hash the new one, and in one transaction
      update it and revoke the user's other sessions (keep the current one).
      A wrong current password returns 400 on the field, **not 401** (the client treats 401 as
      "logged out").
- [ ] **AUTH-8** Route protection in `proxy.ts`: guests going to `/dashboard`, `/profile`,
      `/admin/*` → `/login`; signed-in users going to `/login`, `/signup` → `/dashboard`. Only a quick
      cookie check; the real check stays in every API route.
- [ ] **BE-7** Rate limiting on `login`, `forgot-password`, `reset-password`, `resend-otp`.
      Today only resend-invite has a cooldown (`RateLimitError`).
- [ ] **ADM-6** Resend invite: marked "In progress"; finish and verify.

## 3. Frontend to build and integrate

- [ ] **Profile page** `/profile`: profile form (React Hook Form + Zod), avatar upload, change
      password form. Loading / error / success states.
- [ ] **Speaker accounts UI** for admin/organizer: invite a speaker, resend the invite
      (APIs `/api/speakers`, `/api/speakers/[slug]/resend-invite` exist, no UI yet).
- [x] **Admin organizers page UI** `/admin/organizers` with sample data (awaiting approval,
      approved, rejected; approve and reject-with-reason dialogs; Reconsider). Done 2026-10-26.
- [x] **Organizers page wired to the API** (list per tab, search, paging, approve, reject with a
      reason, reconsider; loading / error / empty states). Done 2026-10-27.
- [x] **Organizers page as tabs with server-side search and filters** (same layout as Users):
      tabs Awaiting approval / Approved / Rejected / All organizers (a tab is requested only when
      it is opened, so no tab counts; the open tab shows its total); one search box matching
      organisation, applicant name or email; `emailVerified` filter (waiting list only); `sort`
      by the list's own date (applied / approved / rejected); paging on every tab. API:
      `GET /api/admin/organizers?verification&search&emailVerified&sort&page&pageSize`
      (`searchField` / `searchValue` were replaced by `search`). Done 2026-10-27.
- [ ] **Organizers page: design parts hidden because there is no data yet**: Events and
      Registrations columns of approved organizers (need the events / registrations tables).
- [x] **Create organizer** button + form on the organizers page (`POST /api/admin/organizers`):
      first / last name, email, organisation, optional website; a taken email shows under the
      email field; the organizer is emailed a set-password link. Done 2026-10-27. The tabs now
      open on **All organizers** (first tab), like the Users page.
- [x] **Admin sends a password reset link** (ADM-9, backend):
      `POST /api/admin/users/[userId]/send-reset-link`, permission `USER_STATUS_MANAGE` (no new
      permission, so no seed change). Same `password_reset` token and `sendPasswordResetEmail` as
      "forgot password"; the email says an administrator started it. 403 admin, 404, 409
      pending / suspended, 429 within 60 s, 503 if the email fails. Done 2026-10-27.
- [x] **Send password reset link button** on the user profile page, wired to the endpoint above
      (confirmation dialog, error shown in it, "link sent" message). Done 2026-10-27. Still to do:
      add it to the Users list menu too. A pending user gets the set-password invite instead,
      which has no API for plain users yet (organizers and speakers have resend-invite).
- [ ] **Resend invite button** (ADM-6) and **Delete organizer** (only while not verified) on the
      organizers page: both APIs exist (`POST .../resend-invite`, `DELETE .../[organizerId]`),
      no UI yet.
- [x] **Speakers pages** `/speakers` and `/speakers/[slug]` (SPK-1, SPK-2), public, on the existing
      `GET /api/speakers` (search by name, paging; the list item now also has the topics) and
      `GET /api/speakers/[slug]` (name from Postgres, photo / role / topics / links / bio from
      Strapi; Strapi down → name only, "Profile coming soon"). **Add speaker** button only with
      `SPEAKER_CREATE` (`useHasPermission`), wired to `POST /api/speakers`. Left out on purpose: Export
      CSV, the event select, popular topics (design), and what has no data yet: tabs with counts,
      account status / invite state (the public API does not send it), sessions, ratings, assign to
      session, show / hide on public pages, remove speaker, edit as admin, resend invite on the card.
      Done 2026-10-27.
- [ ] **Speaker self-edit form**: `GET` + `PATCH /api/me/speaker-profile` and
      `POST /api/me/speaker-profile/photo` exist, no UI yet.
- [ ] **Dashboard approval queue** (`OrganizerApprovalQueue` on the admin overview) is still on
      sample data: wire it to `useGetOrganizerList({ verification: "pending" })`.
- [x] **Admin organizer review page** `/admin/organizers/[id]` (design: `AdminOrganizerReview`),
      on real data: `GET /api/admin/organizers/[organizerId]` (permission `ORGANIZER_MANAGE`; the
      application, its applicant with role, `approvedAt` / `rejectedAt`, `hasDuplicate` = another
      organizer with the same name or website, ignoring case). The page shows the organisation,
      applicant, checks before approving, history, and approve / reject (reason, common reasons) /
      reconsider through the existing hooks; a decision reloads the page. Every organizer name in
      the lists links to it. Done 2026-10-27. Left out because the data does not exist:
      "earlier rejected applications" (`organizer_profiles.user_id` is unique and reopening clears
      the rejection, so there is no history).
- [x] **Admin user profile page** `/admin/users/[id]` (design: `AdminUserDetail`), on real data:
      `GET /api/admin/users/[userId]` (permission `USER_VIEW`; the user's own account, their one
      role, whether a password is set, and the permission keys of the role). The same for every
      role: an organizer's application (organizer pages) and a speaker's profile (speaker section,
      later) are NOT on this page. Actions: suspend, reactivate, send password reset link (hooks
      and endpoints exist). Done 2026-10-27.
- [x] **Admin users page UI** `/admin/users` with sample data (tabs, search, filters, row menu,
      suspend / change-role / invite dialogs). Done 2026-10-26.
- [x] **Suspend / reactivate API** (ADM-7, ADM-8): `POST /api/admin/users/:id/suspend` and `/reactivate`, no body. Done 2026-10-27. Still to wire in the UI: simplify the suspend dialog (no reason, no email checkbox).
- [x] **`GET /api/admin/users`** (role, status, search, sort newest|name, paging). Done 2026-10-27.
- [x] **Users page wired to the API** (list with tabs, search, role / status / sort, paging;
      suspend, reactivate; loading / error / empty states). Done 2026-10-27. "Invite user" was
      removed: admins do not create users here.
- [ ] **Users page: design parts hidden because the API does not give them yet**:
  - tab counts (all / attendees / speakers / organizers / admins / unverified / suspended): one
    `count(*) FILTER (WHERE …)` query, plus an `emailVerified=false` filter for the
    "Unverified email" tab (the tab is hidden until then);
  - `organizerStatus` per row ("Organizer pending" / "rejected" badge): join `organizer_profiles`;
  - "Last active" column and `sort=seen`: sessions are deleted on logout, so it can NOT come from
    `auth_sessions`. Add `users.last_login_at` (set at login), or drop the column for good.
- [ ] **Users: actions removed from the menu until their API exists** _(extra, not in the spec)_:
      change role (one role per user, `USER_ROLE_MANAGE`), send password setup link.
- [ ] **User profile page: parts of the design left out until their data exists**: event
      registrations (needs the registrations table), audit log (needs an audit table), "Last
      active" (needs `users.last_login_at`), and **Change role** (no API yet, `USER_ROLE_MANAGE`;
      one role per user, so it is a radio picker, not checkboxes).

### Screens built as UI only on sample data (2026-10-27), still to wire to the API

Each takes its data as a prop with the sample as default, so wiring replaces the default, not the
screen. Event pages (browse, detail, admin events) are not built yet.

- [ ] **Profile & settings** `/profile` (`features/profile`): name form, change password, theme.
      Needs AUTH-3 (`GET` + `PATCH /api/me/profile`), AUTH-5 (`PATCH /api/me/password`), a
      notification-preferences API. Shown as "not available yet": photo upload (AUTH-4), time zone,
      two-step verification, device list, delete account.
- [ ] **Notifications** `/notifications` (`features/notifications`): day groups, unread, All / Unread
      / topic tabs, mark read, preferences card (disabled). Needs the notifications table + SSE
      (NOTIF-*), the unread badge in the shell and the bell in the top bar.
- [ ] **Role dashboards** on `/dashboard` (`features/dashboard/components/{attendee,speaker,organizer}`),
      picked in `DashboardHome` by permission: `ANALYTICS_VIEW_ALL` → admin, `ANALYTICS_VIEW_EVENT` →
      organizer, `SPEAKER_MANAGE_OWN` → speaker, `REGISTRATION_VIEW_OWN` → attendee. Anyone else sees
      the organizer review screen. **Known gap:** an attendee with a pending or rejected organizer
      application now sees the attendee home, not the review screen, until
      `GET /api/me/organizer-application` decides which one to show.
- [ ] **Speaker sessions** `/speaker/sessions`, `/speaker/sessions/[id]`, `/speaker/sessions/new`
      (`features/sessions`), **live polls** `/speaker/polls` (`features/polls`), **My schedule**
      `/my-schedule` (`features/schedule`, real `.ics` export). Need the events / sessions / polls
      tables. Dates are shown in UTC.
- [ ] **Edit my profile** `/speaker/profile` (`SpeakerProfileForm` in `features/speakers`): validates
      with the server's `updateOwnSpeakerProfileBodySchema`. The API already exists
      (`GET` + `PATCH /api/me/speaker-profile`, `POST .../photo`): wire the form to it and enable the
      photo button.
- [ ] **Not built (no board, or events):** `/my-events`, event pages, `AuthStates` / `EmailVerified`
      boards (check against the auth screens).

## 4. Housekeeping

- [ ] Commit the current uncommitted work (dashboard, organizer delete, seed) with requirement IDs.
- [ ] Review, then mark Done in the catalog: AUTH-1, AUTH-2, AUTH-6, AUTH-7, AUTH-9, BE-1 to BE-5
      (built but still "Todo").
- [ ] E2E (Playwright): sign up → verify email → log in → log out.

## Later (needs the events / registrations tables)

- [ ] Admin KPIs: published / draft events, registrations (+ change %).
- [ ] Organizer analytics dashboard (DASH-1 to DASH-8, BE-6).
