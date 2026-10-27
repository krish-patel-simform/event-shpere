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
- [ ] **Wire the organizers page to the API**: replace `ADMIN_ORGANIZERS_SAMPLE`; one
      `GET /api/admin/organizers` call per tab (`verification=pending|verified|rejected`) with
      search + paging as query params; `verify`, `reject` (`{ reason }`), `reopen`. Events and
      registrations columns of approved organizers stay sample data until those tables exist.
- [ ] **Admin organizer review page** `/admin/organizers/[id]` (the Review links and organisation
      names already point there; design: `AdminOrganizerReview`).
- [x] **Admin users page UI** `/admin/users` with sample data (tabs, search, filters, row menu,
      suspend / change-role / invite dialogs). Done 2026-10-26.
- [ ] **Admin users backend + wiring** _(extra, not in the spec)_: `GET /api/admin/users`
      (tab, search, role, status, sort, paging), change role (one role per user), suspend /
      reactivate (`users.status`, reason to an audit log), invite (account + setup email),
      resend setup link. "Last active" has no column: derive it from the newest
      `auth_sessions.created_at`. Needs `USER_VIEW`, `USER_ROLE_MANAGE`, `USER_STATUS_MANAGE`.
- [ ] **Admin user profile page** `/admin/users/[id]` (design: `AdminUserDetail`); the names and
      the "View profile" menu item already link there.

## 4. Housekeeping

- [ ] Commit the current uncommitted work (dashboard, organizer delete, seed) with requirement IDs.
- [ ] Review, then mark Done in the catalog: AUTH-1, AUTH-2, AUTH-6, AUTH-7, AUTH-9, BE-1 to BE-5
      (built but still "Todo").
- [ ] E2E (Playwright): sign up → verify email → log in → log out.

## Later (needs the events / registrations tables)

- [ ] Admin KPIs: published / draft events, registrations (+ change %).
- [ ] Organizer analytics dashboard (DASH-1 to DASH-8, BE-6).
