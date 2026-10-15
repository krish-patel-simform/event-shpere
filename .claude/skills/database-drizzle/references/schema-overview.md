# EventSphere schema overview (planned)

A starting point to refine with `/design-table <feature>`: not final. `*` = unique, `→` = foreign key.

| Feature | Table | Key columns | Constraints / indexes |
| --- | --- | --- | --- |
| auth | `users` | id, firstName, lastName, email*, passwordHash, role (`USER`\|`ORGANIZER`), image, passwordChangedAt, createdAt | unique lower(email) |
| auth | Auth.js adapter tables (`accounts`, `verification_tokens`, …) | per adapter docs | credentials + JWT sessions: `sessions` table may be unused (Auth.js credentials requires `strategy: "jwt"`) |
| auth | `password_reset_tokens` | id, userId→users, tokenHash*, expiresAt, usedAt | index (userId); single-use via `usedAt` |
| events | `events` | id, slug*, title, description, category, eventType (`in_person`\|`online`\|`hybrid`), startsAt, endsAt, venue/location fields, bannerUrl, priceCents, currency, capacity, status (`draft`\|`published`), organizerId→users | idx (startsAt), (category), (priceCents); check capacity ≥ 0, endsAt > startsAt |
| event-details | `event_sessions` | id, eventId→events, title, descriptionRef/cmsSlug, speakerSlug (CMS link), startsAt, endsAt, room | idx (eventId, startsAt); check endsAt > startsAt |
| registrations | `registrations` | id, userId→users, eventId→events (restrict), status (`pending_payment`\|`confirmed`\|`cancelled`), createdAt, cancelledAt | **unique (userId, eventId)**, idx (eventId, status) |
| payments | `payments` | id, registrationId→registrations, stripeCheckoutSessionId*, stripePaymentIntentId, amountCents, currency, status, createdAt | idx (registrationId) |
| payments | `stripe_events` | stripeEventId (pk), type, processedAt | idempotent webhook processing |
| agenda | `agenda_items` | id, userId→users, sessionId→event_sessions, position | unique (userId, sessionId); idx (userId, position) |
| agenda | `bookmarks` | userId, sessionId (composite pk), createdAt | pk (userId, sessionId) |
| polls | `polls` | id, eventId→events, question, type (`single`\|`multiple`), maxChoices, status (`draft`\|`open`\|`closed`), createdBy→users | check maxChoices ≥ 1 |
| polls | `poll_options` | id, pollId→polls (cascade), label, position | idx (pollId) |
| polls | `poll_ballots` | id, pollId→polls, userId→users, createdAt | **unique (pollId, userId)**: one vote per user per poll (POLL-3) |
| polls | `poll_ballot_options` | ballotId→poll_ballots (cascade), optionId→poll_options | pk (ballotId, optionId); service enforces 1 option (single) or ≤ maxChoices (multiple) (POLL-4) |
| notifications | `notifications` | id, userId→users, type, title, body, data (jsonb), readAt, createdAt, dedupeKey | idx (userId, createdAt desc); unique (userId, dedupeKey) for idempotent reminders |
| announcements | `announcements` | id, eventId→events, organizerId→users, title, body, publishedAt | idx (eventId, publishedAt desc); fan-out to `notifications` on publish |

CMS (not in Postgres): speakers, event announcements content, blog articles, session content. Linked by `slug` (e.g. `event_sessions.speakerSlug`, `events.slug`).

Registration lifecycle: free → `confirmed` immediately; paid → `pending_payment` → webhook → `confirmed`; cancel → `cancelled` (row reused if the user registers again).
