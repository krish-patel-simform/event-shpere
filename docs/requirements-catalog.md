# EventSphere – Requirements Catalog

Source of truth for **what** to build: [poc-spec.md](./poc-spec.md). This catalog breaks the spec into trackable IDs and records the project decisions (real backend, see CLAUDE.md) that go beyond the spec.

**Status values:** `Todo` · `In progress` · `Done` (verified against acceptance criteria, tests green).
**Update the status here as soon as a requirement is verified** (Mentor Workflow rule).

IDs marked **(added)** are not in the original spec text; they were added after reading it (see the end of this file).

---

## Week 1 – Setup + Backend foundation + Authentication + Event Listing

### Setup & backend foundation

| ID      | Requirement                                                                                                                                                             | Week | Status |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------ |
| SETUP-1 | Next.js app, TS strict, Tailwind, ESLint/Prettier, path aliases                                                                                                         | 1    | Todo   |
| SETUP-2 | Git: main, develop, feature/* branches (feature/authentication, feature/events, feature/payments, feature/dashboard, more as needed); PRs into develop, release to main | 1    | Todo   |
| SETUP-3 | Vercel with preview deploys; Sentry; Jest + Playwright; CI (lint, typecheck, tests, SonarCloud) with a Postgres service for integration tests                           | 1    | Todo   |
| SETUP-4 | Redux store + RTK Query baseApi; core UI kit                                                                                                                            | 1    | Todo   |
| BE-1    | Docker Compose Postgres for local dev; hosted Postgres for production; Zod-validated env                                                                                | 1    | Todo   |
| BE-2    | Drizzle setup: db client, per-feature schema files, schema barrel, drizzle.config.ts, migrations via drizzle-kit generate + migrate                                     | 1    | Todo   |
| BE-3    | Seed script with realistic linked data (events, sessions, users of each role, polls)                                                                                    | 1    | Todo   |
| BE-4    | HTTP core: route handler wrapper, `{ data }` / `{ error: { code, message, details? } }` envelope, domain error classes mapped to status codes                           | 1    | Todo   |
| BE-5    | Layered architecture enforced: route → service → repository; no DB access outside repositories                                                                          | 1    | Todo   |

### Authentication

| ID                 | Requirement                                                                                                                                                           | Week | Status      |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----------- |
| AUTH-1             | Sign up with email: first name, last name, email, password                                                                                                            | 1    | Todo        |
| AUTH-2             | Login with email and password                                                                                                                                         | 1    | Todo        |
| AUTH-3             | Update profile information                                                                                                                                            | 1    | Todo        |
| AUTH-4             | Change profile image                                                                                                                                                  | 1    | Todo        |
| AUTH-5             | Change password                                                                                                                                                       | 1    | Todo        |
| AUTH-6             | Forgot password: request reset                                                                                                                                        | 1    | Todo        |
| AUTH-7             | Forgot password: set new password via expiring, hashed, single-use token                                                                                              | 1    | Todo        |
| AUTH-8             | Roles (Guest/User/Organizer) with route + API protection                                                                                                              | 1    | Todo        |
| AUTH-9 **(added)** | Logout (ends the session; clears client auth state)                                                                                                                   | 1    | Todo        |
| ADM-6 **(added)**  | Resend the set-password invite to a speaker or organizer whose account is still pending (new link, old links stop working, 60 s cooldown)                             | 1    | In progress |
| ADM-7 **(added)**  | Admin suspends an active user: login and API access stop at once, sessions are ended (not yourself, not an administrator)                                             | 1    | In progress |
| ADM-8 **(added)**  | Admin reactivates a suspended user                                                                                                                                    | 1    | In progress |
| ADM-9 **(added)**  | Admin sends a password reset link to an active user (same one-time link and email as "forgot password"; not for admins, pending or suspended accounts; 60 s cooldown) | 1    | In progress |

### Event listing

| ID     | Requirement                                                                                | Week | Status |
| ------ | ------------------------------------------------------------------------------------------ | ---- | ------ |
| DISC-1 | Event listing card: banner, title, category, date, location, ticket price, available seats | 1    | Todo   |

---

## Week 2 – Search + Filtering + Event Details

| ID     | Requirement                                                                            | Week | Status |
| ------ | -------------------------------------------------------------------------------------- | ---- | ------ |
| DISC-2 | Search by event name                                                                   | 2    | Todo   |
| DISC-3 | Filter by category, date, event type, free/paid                                        | 2    | Todo   |
| DISC-4 | Sort by date, popularity, price (server-side, indexed queries, paginated)              | 2    | Todo   |
| DET-1  | Event details page: banner, description, agenda, speakers, sessions, venue information | 2    | Todo   |
| DET-2  | Session schedule: session name, speaker, start time, end time, description             | 2    | Todo   |

---

## Week 3 – Registration + Stripe

| ID    | Requirement                                                                         | Week | Status |
| ----- | ----------------------------------------------------------------------------------- | ---- | ------ |
| REG-1 | Register for an event (transaction: seat check + unique registration)               | 3    | Todo   |
| REG-2 | Cancel registration                                                                 | 3    | Todo   |
| REG-3 | View registration status                                                            | 3    | Todo   |
| REG-4 | Free ticket: instant registration                                                   | 3    | Todo   |
| REG-5 | Paid ticket: Stripe Checkout (test mode), confirmed by verified webhook, idempotent | 3    | Todo   |
| REG-6 | Payment confirmation page                                                           | 3    | Todo   |
| REG-7 | Transaction history                                                                 | 3    | Todo   |

---

## Week 4 – Agenda Builder + Drag-and-Drop

| ID    | Requirement                                                                          | Week | Status |
| ----- | ------------------------------------------------------------------------------------ | ---- | ------ |
| AGD-1 | Add sessions to personal agenda                                                      | 4    | Todo   |
| AGD-2 | Remove sessions                                                                      | 4    | Todo   |
| AGD-3 | Rearrange sessions (positions persisted atomically)                                  | 4    | Todo   |
| AGD-4 | Drag-and-drop for session management and schedule organization (keyboard accessible) | 4    | Todo   |
| AGD-5 | Bookmark sessions                                                                    | 4    | Todo   |

---

## Week 5 – Speaker Directory + CMS

| ID    | Requirement                                                                                          | Week | Status |
| ----- | ---------------------------------------------------------------------------------------------------- | ---- | ------ |
| SPK-1 | Speaker list: photo, name, designation, company                                                      | 5    | Todo   |
| SPK-2 | Speaker profile: biography, social links, sessions, expertise                                        | 5    | Todo   |
| CMS-1 | All speaker data managed in the headless CMS                                                         | 5    | Todo   |
| CMS-2 | Content types: speakers, event announcements, blog articles, session content                         | 5    | Todo   |
| CMS-3 | No hardcoded content; revalidation without redeploy (webhook to a secret-protected revalidate route) | 5    | Todo   |

---

## Week 6 – Polling + SSE Notifications

### Polling

| ID     | Requirement                                                        | Week | Status |
| ------ | ------------------------------------------------------------------ | ---- | ------ |
| POLL-1 | Answer questions and submit votes                                  | 6    | Todo   |
| POLL-2 | View results                                                       | 6    | Todo   |
| POLL-3 | Single-choice polls (one vote per user, enforced by DB constraint) | 6    | Todo   |
| POLL-4 | Multiple-choice polls (allowed option limits enforced server-side) | 6    | Todo   |
| POLL-5 | Dynamic results charts: bar, pie, donut                            | 6    | Todo   |

### Notifications

| ID                  | Requirement                                                              | Week | Status |
| ------------------- | ------------------------------------------------------------------------ | ---- | ------ |
| NOTIF-1             | Event reminders (scheduled job, e.g. Vercel Cron, secret-protected)      | 6    | Todo   |
| NOTIF-2             | Registration confirmations                                               | 6    | Todo   |
| NOTIF-3             | Session updates                                                          | 6    | Todo   |
| NOTIF-4             | Poll announcements                                                       | 6    | Todo   |
| NOTIF-5             | Real-time notifications via SSE                                          | 6    | Todo   |
| NOTIF-6             | Live announcements via SSE (published by organizers)                     | 6    | Todo   |
| NOTIF-7 **(added)** | Notification Center UI: list, unread badge, mark as read / mark all read | 6    | Todo   |

---

## Week 7 – Analytics Dashboard + Organizer tools

### Organizer tools

| ID                | Requirement                                                                                                           | Week | Status |
| ----------------- | --------------------------------------------------------------------------------------------------------------------- | ---- | ------ |
| ORG-1             | Organizer creates events                                                                                              | 7    | Todo   |
| ORG-2             | Organizer manages sessions                                                                                            | 7    | Todo   |
| ORG-3             | Organizer publishes announcements                                                                                     | 7    | Todo   |
| ORG-4 **(added)** | Organizer creates and manages polls (question, type, options, open/close) so polls have a source other than seed data | 7    | Todo   |

### Analytics dashboard

| ID     | Requirement                                                                                                              | Week | Status |
| ------ | ------------------------------------------------------------------------------------------------------------------------ | ---- | ------ |
| DASH-1 | KPI card: total registrations                                                                                            | 7    | Todo   |
| DASH-2 | Line chart: ticket sales                                                                                                 | 7    | Todo   |
| DASH-3 | Bar chart: event attendance                                                                                              | 7    | Todo   |
| DASH-4 | Pie chart: poll participation                                                                                            | 7    | Todo   |
| DASH-5 | Donut chart: session popularity                                                                                          | 7    | Todo   |
| DASH-6 | Date filtering                                                                                                           | 7    | Todo   |
| DASH-7 | Interactive charts                                                                                                       | 7    | Todo   |
| DASH-8 | Data refresh                                                                                                             | 7    | Todo   |
| BE-6   | Analytics endpoints built with SQL aggregations in Drizzle (group by, date ranges), scoped to the organizer's own events | 7    | Todo   |

---

## Week 8 – PWA + Testing + Deployment

### PWA

| ID    | Requirement                                    | Week | Status |
| ----- | ---------------------------------------------- | ---- | ------ |
| PWA-1 | Installable application                        | 8    | Todo   |
| PWA-2 | Offline mode                                   | 8    | Todo   |
| PWA-3 | Cached assets                                  | 8    | Todo   |
| PWA-4 | Cached schedules                               | 8    | Todo   |
| PWA-5 | Previously viewed event data available offline | 8    | Todo   |

### Testing, deployment, deliverables

| ID                | Requirement                                                                                                           | Week | Status |
| ----------------- | --------------------------------------------------------------------------------------------------------------------- | ---- | ------ |
| TEST-1            | Unit tests: utility functions, state management, form validation                                                      | 8    | Todo   |
| TEST-2            | E2E: user registration, login, event registration, poll participation, payment flow                                   | 8    | Todo   |
| TEST-3            | Backend tests: services with mocked repositories; repository/route integration tests against a test Postgres database | 8    | Todo   |
| DEP-1             | Vercel production: working env variables, production build, migrations applied, accessible URL                        | 8    | Todo   |
| DEL-1             | Deliverables: repository, live URL, API collection (Postman/Bruno), test report, technical documentation              | 8    | Todo   |
| DOD-1 **(added)** | Spec Definition of Done: code review feedback addressed (all PR review comments resolved before merge)                | 8    | Todo   |

---

## Cross-cutting (every week)

### State, errors, monitoring, quality, backend hardening

| ID      | Requirement                                                                                                                                                                                                                  | Week | Status |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------ |
| STATE-1 | Redux Toolkit for auth, profile, events, registrations, notifications, polling, dashboard; no excessive prop drilling                                                                                                        | all  | Todo   |
| ERR-1   | Handle API failures                                                                                                                                                                                                          | all  | Todo   |
| ERR-2   | Handle invalid form submissions                                                                                                                                                                                              | all  | Todo   |
| ERR-3   | Handle network interruptions                                                                                                                                                                                                 | all  | Todo   |
| ERR-4   | Handle missing data; meaningful error messages everywhere                                                                                                                                                                    | all  | Todo   |
| MON-1   | Sentry captures JS exceptions                                                                                                                                                                                                | all  | Todo   |
| MON-2   | Sentry captures unhandled promise rejections                                                                                                                                                                                 | all  | Todo   |
| MON-3   | Sentry captures API failures (client and server)                                                                                                                                                                             | all  | Todo   |
| QUAL-1  | SonarQube passes security checks, code smells, duplication analysis                                                                                                                                                          | all  | Todo   |
| BE-7    | Backend security: authz on every endpoint, ownership checks on /api/me/* and organizer resources, rate limiting on auth/vote/reset routes, no sensitive fields in responses, parameterized queries only, secrets server-only | all  | Todo   |
| BE-8    | Structured server logging with request IDs; errors to Sentry without PII                                                                                                                                                     | all  | Todo   |

---

## Bonus (optional – only after ALL mandatory items are Done)

| ID      | Requirement                      | Status |
| ------- | -------------------------------- | ------ |
| BONUS-1 | QR code-based event check-in     | Todo   |
| BONUS-2 | Dark mode                        | Todo   |
| BONUS-3 | Export agenda to Google Calendar | Todo   |
| BONUS-4 | Infinite scrolling               | Todo   |
| BONUS-5 | Event sharing                    | Todo   |
| BONUS-6 | AI-powered event recommendations | Todo   |

---

## Spec gaps added after reading poc-spec.md

| New ID  | Why it was added                                                                                                                                                                                                  | Spec reference                    |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| AUTH-9  | The spec lists login but never logout; a session needs an end.                                                                                                                                                    | §5 Module 1                       |
| NOTIF-7 | The spec title is "Notification Center", but the catalog only had the notification _producers_ and the SSE transport. The user-facing list/unread/mark-read UI had no ID.                                         | §5 Module 8                       |
| ORG-4   | Polls are "answered" by users (Module 7) but nothing says who creates them. Organizers "manage sessions/events"; poll authoring is the missing piece.                                                             | §4, §5 Module 7                   |
| DOD-1   | "Code review feedback is addressed" is an explicit Definition of Done item with no owner.                                                                                                                         | Definition of Done                |
| ADM-6   | Speakers and organizers only become active through the emailed set-password link. If that email fails or the 24 h link expires, the account stays pending with no way to get a new link.                          | §4 accounts, custom-auth decision |
| ADM-7/8 | The schema has a `suspended` status and the `user:status_manage` permission, but nothing let an admin suspend or reactivate an account.                                                                           | §4 permissions                    |
| ADM-9   | When a user is locked out, the only way to a new password is their own "forgot password". An admin helping them had no way to start it. ADM-9 reuses the AUTH-7 token and page, so there is no second reset flow. | §4 permissions                    |

Interpretation notes (no new ID, but they shape the schema):

- **"Event type"** (DISC-3) is modelled as a Postgres enum on `events` (e.g. `in_person | online | hybrid`).
- **"Blog articles"** (CMS-2) must exist as a CMS content type; the spec requires no blog UI, so only the content model + a simple list/detail is expected, and only if time allows after SPK/CMS-1..3.
- **"Guest: view speakers, view schedules"** (§4) is covered by AUTH-8 (public routes) + SPK-1/2 + DET-2.
