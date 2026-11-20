# Registration, booking and attendance API (reference)

The routes built in the registration phase (REG-1 to REG-4 and the attendance side), with query
params, body, response and rules. Written for a new session or a new teammate: read this before
touching the registration feature. The code is the source of truth; this file says where to look.

- Backend code: `src/features/registrations/{schemas,server}` (route → service → repository → db).
- Routes: `app/api/events/[eventId]/...` and `app/api/me/registrations`.
- Tests: `src/features/registrations/{server,schemas}/__tests__`. Fixture:
  `src/features/registrations/__fixtures__/registration-service.ts`.
- Status: **API only. No UI yet.** Free tickets only (Stripe later).
- Pending work lives in `docs/remaining-work.md` (section "Registration and payments").

## 1. Common to every route

**Success envelope:** `{ "data": ... }`; lists are `{ "data": [...], "meta": { page, pageSize, total, ... } }`.
Creates answer **201**, everything else here **200**. No route in this file answers 204.

**Error envelope:** `{ "error": { "code": "...", "message": "...", "details"?: ... } }`.

| Status | Code                     | When                                                                                          |
| ------ | ------------------------ | --------------------------------------------------------------------------------------------- |
| 400    | `VALIDATION_ERROR`       | bad param, query or body (Zod); `details` lists the fields                                    |
| 401    | `UNAUTHENTICATED`        | no valid access-token cookie                                                                  |
| 403    | `FORBIDDEN`              | the role lacks the permission; also a cross-site write (`Origin` differs)                     |
| 404    | `NOT_FOUND`              | unknown id, or something the caller must not know exists (another organizer's event, a draft) |
| 409    | a named code (section 4) | the request conflicts with the current state                                                  |
| 429    | `RATE_LIMITED`           | over the limit; `Retry-After` header                                                          |
| 503    |                          | database or a dependency is unavailable; `Retry-After` header                                 |

- **Auth:** the signed-in user comes from the httpOnly access-token cookie. No route here takes a
  user id in the URL, query or body: "me" is always the login.
- **Rate limits** (per user id, 60 s window): `user-read` 120, `user-write` 30.
- **Caching:** every read that carries names, emails or ticket codes sends
  `Cache-Control: private, no-store` and `Vary: Cookie`.
- **Dates:** ISO 8601 strings in UTC (`2026-12-12T04:30:00.000Z`). Event days (`date`,
  `attendanceDate`) are `YYYY-MM-DD` **in the event's time zone** (`events.timezone`).
- **Ids** in the path are UUIDs; anything else is a 400 (never a 500).
- **Money** is in paise (`150000` = ₹1,500).
- **DTOs only:** responses never carry a user id, password hash, token or `updatedAt`.

## 2. Who may call what

One role per user. The roles `user` and `speaker` hold the attendee permissions; `organizer` and
`admin` do **not**, so they get a 403 on attendee routes (they use a separate user account to attend).

| Permission                   | Roles         | Used by                                                 |
| ---------------------------- | ------------- | ------------------------------------------------------- |
| `REGISTRATION_CREATE`        | user, speaker | register for an event, book a session seat              |
| `REGISTRATION_VIEW_OWN`      | user, speaker | `GET .../registrations/me`, `GET /api/me/registrations` |
| `REGISTRATION_MANAGE_OWN`    | user, speaker | cancel an event registration, cancel a session seat     |
| `REGISTRATION_VIEW_EVENT`    | organizer     | attendee lists and check-in log of **own** events       |
| `REGISTRATION_VIEW_ALL`      | admin         | the same, any event                                     |
| `REGISTRATION_CHECKIN_EVENT` | organizer     | check in at **own** events                              |
| `REGISTRATION_CHECKIN_ALL`   | admin         | check in at any event                                   |

Staff routes use `auth: "signed-in"` and the **service** decides ("VIEW_EVENT or VIEW_ALL", then
`eventAccess.getEventIfOrgOwns`), because a route's `permission: [...]` needs _every_ listed
permission and organizer and admin hold different ones. An organizer asking for another
organizer's event gets a **404**, never a 403. An unapproved organizer gets a 403.

## 3. Routes

| #   | Method and path                                                      | Who              | Purpose                             |
| --- | -------------------------------------------------------------------- | ---------------- | ----------------------------------- |
| 1   | `POST /api/events/{eventId}/registrations`                           | user, speaker    | register for an event               |
| 2   | `GET /api/events/{eventId}/registrations/me`                         | user, speaker    | my standing in one event            |
| 3   | `DELETE /api/events/{eventId}/registrations/me`                      | user, speaker    | cancel my registration              |
| 4   | `GET /api/me/registrations`                                          | user, speaker    | my tickets (all events)             |
| 5   | `GET /api/events/{eventId}/attendees`                                | organizer, admin | who registered, who checked in      |
| 6   | `POST /api/events/{eventId}/check-ins`                               | organizer, admin | check a person in at the event door |
| 7   | `GET /api/events/{eventId}/check-ins`                                | organizer, admin | check-in log (planned for removal)  |
| 8   | `POST /api/events/{eventId}/sessions/{sessionId}/registrations`      | user, speaker    | book a session seat                 |
| 9   | `DELETE /api/events/{eventId}/sessions/{sessionId}/registrations/me` | user, speaker    | cancel my session seat              |
| 10  | `GET /api/events/{eventId}/sessions/{sessionId}/attendees`           | organizer, admin | who holds a seat, who checked in    |
| 11  | `POST /api/events/{eventId}/sessions/{sessionId}/check-ins`          | organizer, admin | check a person in at one session    |

There is **no** `GET` for "my booking in one session": the session page reads `bookedSessionIds`
from route 2.

### 1. `POST /api/events/{eventId}/registrations`

Register the signed-in user. **No body.** Permission `REGISTRATION_CREATE`, `user-write`.

**201** `data` (`registrationResponseSchema`):

```json
{
  "id": "uuid",
  "eventId": "uuid",
  "status": "registered",
  "ticketCode": "ESEVT7K3Q9P",
  "amount": 0,
  "currency": "INR",
  "reason": "free",
  "registeredAt": "2026-11-02T10:00:00.000Z"
}
```

`reason` is `free` or `complimentary_speaker` (a speaker of the event gets in free on a paid event).
`amount` is 0 until paid tickets exist.

Rules, in order: draft or unknown event → 404; already registered → 409 `ALREADY_REGISTERED`;
cancelled → `EVENT_CANCELLED`; over → `EVENT_ENDED`; before the window → `REGISTRATION_NOT_OPEN`;
after it → `REGISTRATION_CLOSED` (no closing time means the event start); paid price →
`PAYMENT_NOT_AVAILABLE_YET`; capacity reached → `EVENT_FULL`. A **cancelled** registration is
revived by registering again (same row, new ticket code).

### 2. `GET /api/events/{eventId}/registrations/me`

Permission `REGISTRATION_VIEW_OWN`, `user-read`, `private, no-store`. **200** `data`:

```json
{ "registration": { ...as route 1... } | null, "bookedSessionIds": ["uuid"] }
```

`registration` is `null` when the user never registered (normal, not a 404); a cancelled one comes
back with `status: "cancelled"`. `bookedSessionIds` are sessions of this event the user holds a seat
in (empty once the registration is cancelled). Readable whatever the event's state.

### 3. `DELETE /api/events/{eventId}/registrations/me`

Cancel my registration and, in the same transaction, all my seats in this event's sessions.
Permission `REGISTRATION_MANAGE_OWN`, `user-write`. **200** `data`: same shape as route 2 (now
`status: "cancelled"`, `bookedSessionIds: []`).

Allowed until registration closes (`registrationClosesAt`, or the event start). After that: 409
`CANCELLATION_CLOSED`. Already checked in: 409 `ALREADY_CHECKED_IN`. No registration: 404.
Cancelling twice answers the cancelled registration again. The old ticket code stops working. No refund yet.

### 4. `GET /api/me/registrations`

"My tickets". Permission `REGISTRATION_VIEW_OWN`, `user-read`, `private, no-store`.

| Query      | Type                                 | Default    | Notes                                                                            |
| ---------- | ------------------------------------ | ---------- | -------------------------------------------------------------------------------- |
| `page`     | int ≥ 1                              | 1          |                                                                                  |
| `pageSize` | int 1..50                            | 10         |                                                                                  |
| `status`   | `all` \| `registered` \| `cancelled` | `all`      | registration status                                                              |
| `when`     | `upcoming` \| `past` \| `all`        | `upcoming` | by when the **event ends**; upcoming = soonest first, others = most recent first |

**200** `data[]` (`myTicketSchema`) and `meta {page, pageSize, total}`:

```json
{ "registration": { ...route 1... },
  "event": { "id", "slug", "title", "status", "startAt", "endAt", "timezone", "venueName": "…"|null, "venueCity": "…"|null },
  "bookedSessionCount": 2 }
```

`event.status` is the event's (draft/published/cancelled), so a cancelled event can say so.
The cover image is not here (it lives in the CMS).

### 5. `GET /api/events/{eventId}/attendees`

Organizer (own event) or admin (any). `auth: "signed-in"`, `user-read`, `private, no-store`.
Query (`attendeeListQuerySchema`):

| Query              | Type                                          | Default        | Notes                                                                                                                                                            |
| ------------------ | --------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `page`, `pageSize` | int                                           | 1, 10 (max 50) |                                                                                                                                                                  |
| `status`           | `all` \| `registered` \| `cancelled`          | `all`          | for a "pending" view send `registered`                                                                                                                           |
| `checkedIn`        | `all` \| `yes` \| `no`                        | `all`          | `no` = pending (registered, not checked in)                                                                                                                      |
| `date`             | `YYYY-MM-DD`                                  | none           | one event day: `checkedIn`, `checkedInAt`, `checkedInBy` and `counts` then mean **that day** (so "pending on day 2" works). Without it: any day, latest check-in |
| `sort`             | `newest` \| `oldest` \| `name` \| `checkedIn` | `newest`       | registration time; last name then first; `checkedIn` = latest check-in first, not-checked-in last. Id breaks ties                                                |
| `search`           | string ≤ 100                                  | none           | name, "first last", email or ticket code, contains, case-insensitive; `%` and `_` are literal                                                                    |

**200** `data[]` (`attendeeSchema`):

```json
{ "registrationId": "uuid", "firstName": "Priya", "lastName": "Shah", "email": "priya@example.com",
  "ticketCode": "ESEVT7K3Q9P", "status": "registered", "registeredAt": "…",
  "checkedInAt": "…" | null, "checkedInBy": { "firstName": "Omkar", "lastName": "Patil" } | null,
  "checkInMethod": "manual" | "qr_scan" | null }
```

`meta`: `{ page, pageSize, total, counts: { registered, cancelled, checkedIn, pending } }`. `total` follows
the search and filters; `counts` cover the whole event (and the asked `date`), so badges do not move
while typing. `checkedIn` counts registered people only; `pending` = registered with no check-in.

### 6. `POST /api/events/{eventId}/check-ins`

Check a person in at the event door by ticket code. `auth: "signed-in"`, `user-write`.
Service permission: `REGISTRATION_CHECKIN_EVENT` (own event) or `REGISTRATION_CHECKIN_ALL`.

Body: `{ "ticketCode": "esevt7k3q9p" }` (trimmed and upper-cased; 1..32 chars). The code only says
**who** is at the door. **201** `data` (`checkInResponseSchema`):

```json
{
  "id": "uuid",
  "registrationId": "uuid",
  "attendanceDate": "2026-12-12",
  "checkedInAt": "…",
  "method": "manual",
  "attendee": {
    "firstName": "Priya",
    "lastName": "Shah",
    "ticketCode": "ESEVT7K3Q9P"
  }
}
```

Rules: event reachable (404); unknown code or a code of another event → 404 `Ticket not found`;
draft → 409 `EVENT_NOT_PUBLISHED`; cancelled → `EVENT_CANCELLED`; cancelled ticket →
`REGISTRATION_CANCELLED`; window: opens `CHECK_IN_OPENS_HOURS_BEFORE` hours before the start
(6 in production, a year in `next dev`) and closes at the event end → `CHECK_IN_NOT_OPEN` /
`CHECK_IN_CLOSED`; a second check-in the same day → `ALREADY_CHECKED_IN` (a multi-day event checks a
person in once per day). The day is the check-in moment's date in the event's time zone.

### 7. `GET /api/events/{eventId}/check-ins` (planned for removal)

The log: one row **per check-in** (a person on a two-day event appears twice). Same access as route 5.
Query: `page`, `pageSize` (≤ 50), `search` (≤ 100), `date` (`YYYY-MM-DD`, default all days),
`sort` = `newest` (default) \| `oldest` \| `name`.

**200** `data[]`: `{ id, registrationId, attendanceDate, checkedInAt, method,
attendee: { firstName, lastName, email, ticketCode }, checkedInBy: { firstName, lastName } | null }`;
`meta`: `{ page, pageSize, total, counts: { checkedIn, registered } }` (people, whole event).

Route 5 now covers everything this shows. Delete this `GET` (keep the `POST` in the same file) once the
Check-ins tab uses route 5. Tracked in `docs/remaining-work.md`.

### 8. `POST /api/events/{eventId}/sessions/{sessionId}/registrations`

Book a seat. **No body.** Permission `REGISTRATION_CREATE`, `user-write`. **201** `data`
(`sessionBookingResponseSchema`):

```json
{
  "id": "uuid",
  "sessionId": "uuid",
  "status": "registered",
  "registeredAt": "…"
}
```

Rules, in order (under the event lock): draft or unknown event → 404; cancelled event →
`EVENT_CANCELLED`; unknown session, a session of another event, or a draft session → 404; session
cancelled → `SESSION_CANCELLED`; `requiresRegistration` false → `SESSION_NOT_BOOKABLE`; session already
started (booking stops at `startAt`, so also after it ended) → `SESSION_STARTED`; in-person or hybrid
with no hall yet → `SESSION_NOT_BOOKABLE`; **no live event registration** →
`EVENT_REGISTRATION_REQUIRED`; already booked → `ALREADY_BOOKED`; a speaker of this session →
`SPEAKER_CANNOT_BOOK`; price above 0 → `PAYMENT_NOT_AVAILABLE_YET`; hall capacity reached →
`SESSION_FULL`. **Online sessions have no hall and no seat limit.** A cancelled booking is revived.

### 9. `DELETE /api/events/{eventId}/sessions/{sessionId}/registrations/me`

Cancel my seat. Permission `REGISTRATION_MANAGE_OWN`, `user-write`. **200** `data`: the booking with
`status: "cancelled"` (same shape as route 8). Allowed until registration for the **event** closes
(`registrationClosesAt`, or the event start; a seat freed on the event day is too late for anyone else).
After that → 409 `CANCELLATION_CLOSED`. A seat already used to check in → `ALREADY_CHECKED_IN`. No
booking, or a session of another event → 404. Cancelling twice answers the cancelled booking. A
cancelled session is allowed (a leftover seat can go).

### 10. `GET /api/events/{eventId}/sessions/{sessionId}/attendees`

Same access, headers and **same query** as route 5 (`page`, `pageSize`, `status`, `checkedIn`, `sort`,
`search`); `date` is accepted but ignored (a session happens once, a seat has at most one check-in).
A session of another event → 404. `sort`: seat booking time for `newest`/`oldest`; `checkedIn` = latest
check-in first.

**200** `data[]` (`sessionAttendeeSchema`):

```json
{ "bookingId": "uuid", "firstName", "lastName", "email", "ticketCode": "ESEVT7K3Q9P",
  "status": "registered" | "cancelled", "bookedAt": "…", "checkedInAt": "…" | null }
```

`meta.counts`: `{ registered, cancelled, checkedIn, pending }` for the whole session. `checkedIn` counts the
**check-in rows**, not the seat status, so a session cancelled half-way (which cancels every seat) keeps its
attendance; `pending` = registered seats with no check-in. `ticketCode` is the person's **event** ticket
(the door types it into route 11).

### 11. `POST /api/events/{eventId}/sessions/{sessionId}/check-ins`

Check a booked person in at one session. Same access and body as route 6 (`{ "ticketCode": "..." }`).
**201** `data` (`sessionCheckInResponseSchema`):

```json
{
  "id": "uuid",
  "sessionId": "uuid",
  "checkedInAt": "…",
  "method": "manual",
  "attendee": {
    "firstName": "Priya",
    "lastName": "Shah",
    "ticketCode": "ESEVT7K3Q9P"
  }
}
```

Rules: draft event → `EVENT_NOT_PUBLISHED`; cancelled → `EVENT_CANCELLED`; unknown session or session of
another event, or a draft session → 404; cancelled session → `SESSION_CANCELLED`; window: from
`SESSION_CHECK_IN_OPENS_HOURS_BEFORE` hours before the session starts (2 in production, a year in
`next dev`) until it ends → `CHECK_IN_NOT_OPEN` / `CHECK_IN_CLOSED`; unknown code or code of another event
→ 404; **no registered seat in this session** → `SESSION_NOT_BOOKED` (a walk-in is not recorded; a
cancelled ticket has no seat so it fails here too); **no event check-in for today** →
`EVENT_CHECK_IN_REQUIRED` (check them in at the event door first); a repeat → `ALREADY_CHECKED_IN`.
"Today" = the day of this check-in in the event's time zone, the same day the event check-in was written for.

### Also changed (not new routes)

- `GET /api/me/events` and `GET /api/me/events/counts`: an **admin** now gets every event (an organizer
  still only their own). Each row carries the registered count.
- `POST /api/events/{eventId}/publish`: the body sets when registration opens and closes
  (`registrationOpensAt`, `registrationClosesAt`, both required). Registration (route 1) uses that window.

## 4. 409 codes at a glance

| Code                                            | Where       | Meaning                                                                |
| ----------------------------------------------- | ----------- | ---------------------------------------------------------------------- |
| `ALREADY_REGISTERED`                            | 1           | already holds a live registration                                      |
| `EVENT_CANCELLED`                               | 1, 6, 8, 11 | the event was cancelled                                                |
| `EVENT_ENDED`                                   | 1           | the event is over                                                      |
| `EVENT_NOT_PUBLISHED`                           | 6, 11       | draft event                                                            |
| `REGISTRATION_NOT_OPEN` / `REGISTRATION_CLOSED` | 1           | outside the registration window                                        |
| `EVENT_FULL`                                    | 1           | capacity reached                                                       |
| `PAYMENT_NOT_AVAILABLE_YET`                     | 1, 8        | price above 0 (Stripe not built)                                       |
| `CANCELLATION_CLOSED`                           | 3, 9        | registration has closed, cancelling is over                            |
| `ALREADY_CHECKED_IN`                            | 3, 6, 9, 11 | already used                                                           |
| `REGISTRATION_CHANGED` / `BOOKING_CHANGED`      | 3 / 9       | row changed while cancelling (guard; should not happen under the lock) |
| `REGISTRATION_CANCELLED`                        | 6           | ticket was cancelled                                                   |
| `CHECK_IN_NOT_OPEN` / `CHECK_IN_CLOSED`         | 6, 11       | outside the check-in window                                            |
| `EVENT_REGISTRATION_REQUIRED`                   | 8           | register for the event first                                           |
| `ALREADY_BOOKED`                                | 8           | seat already held                                                      |
| `SPEAKER_CANNOT_BOOK`                           | 8           | speaker of this session                                                |
| `SESSION_CANCELLED`                             | 8, 11       | the session was cancelled                                              |
| `SESSION_STARTED`                               | 8           | booking closed, the session has started                                |
| `SESSION_NOT_BOOKABLE`                          | 8           | no booking needed, or no hall yet                                      |
| `SESSION_FULL`                                  | 8           | hall capacity reached                                                  |
| `SESSION_NOT_BOOKED`                            | 11          | no registered seat in this session                                     |
| `EVENT_CHECK_IN_REQUIRED`                       | 11          | not through the event door today                                       |

## 5. Rules and decisions worth knowing

- **Concurrency:** register, cancel, book and every check-in lock the event row first
  (`lockEvent`, `FOR NO KEY UPDATE`), so the last seat goes to one person and a check-in and a cancel of
  the same ticket take turns. Session lookups also lock the session row, so an organizer's session cancel
  and a booking cannot cross.
- **The ticket code** identifies the person at the door; it is not re-validated against the registration
  window (a row exists only if registration was open). It is unique per event registration; cancelling
  kills the code, registering again issues a new one.
- **Check-in windows:** event `CHECK_IN_OPENS_HOURS_BEFORE` (default 6 in production, `24*365` elsewhere),
  session `SESSION_CHECK_IN_OPENS_HOURS_BEFORE` (default 2 in production, `24*365` elsewhere); both close
  at the end. Set them in `.env` to try the real rule locally. Defined in `src/config/env.ts`.
- **Organizer and admin cannot attend** (no attendee permissions); they use a separate account.
- **Session cancel and event cancel** (organizer routes, existing) cancel the seats and registrations in the
  same transaction and are final (no reopen; refunds will make that impossible). A session's `endAt` in the
  past can no longer be cancelled; a cancelled **event** currently also cancels sessions that already ended
  (to fix, see `docs/remaining-work.md`).
- **Sessions are one day:** a session starts and ends the same day (in the event's time zone) unless the
  event runs through the night. A seat has at most one session check-in (`session_check_ins`, unique per
  seat).
- **No undo check-in.** Check-ins are history; attendance counts come from the check-in rows.

## 6. Tables behind these routes

`event_registrations` (unique per event and user, `ticket_code`), `session_registrations` (unique per
session and user), `event_check_ins` (unique per registration and `attendance_date`),
`session_check_ins` (unique per seat, points at the event check-in it builds on). Schema:
`src/db/schemas/events.schema.ts`. Migration for the session check-ins: `drizzle/0010_session_check_ins.sql`.

## 7. Not built yet

- Stripe (PaymentIntent and Payment Element, pending payment status, webhook, refunds on cancel).
- QR image of the ticket code and the QR scan (BONUS-1); the QR is only an image of `ticket_code`.
- All UI: Register/Cancel buttons, My tickets, session booking button, Check-ins tab, Attendees tab wiring,
  session attendees and check-in screens. Notifications to attendees on cancel.
- Removal of route 7; "ended sessions are left alone when an event is cancelled"; changing the registration
  window after publish.
