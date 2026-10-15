---
name: realtime-sse
description: Real-time notifications and live announcements in EventSphere with Server-Sent Events: an SSE Route Handler, event format, heartbeats, client EventSource hook with auto-reconnect and Last-Event-ID, dispatch into the notifications Redux slice, how events are produced (DB-backed notifications plus a simulated generator), organizer announcements, and Vercel time-limit handling. Use for notifications, announcements, the notification center, reminders, or anything streaming to the browser.
---

# Real-time with SSE

Serves: NOTIF-1, NOTIF-2, NOTIF-3, NOTIF-4, NOTIF-5, NOTIF-6, NOTIF-7, ORG-3.
Related: `state-management` (notifications slice), `backend-architecture` (cron job), `api-design`, `database-drizzle`, `error-handling-monitoring`, `pwa-offline` (SW must not cache the stream).

## Purpose
Push notifications and live announcements to signed-in users without polling from the browser, in a way that works on serverless (Vercel) where connections are time-limited.

## Design
- **Source of truth = Postgres.** Every notification and announcement is a row (`notifications`, `announcements`); the SSE stream only *delivers* new rows. If the stream drops, nothing is lost: the client reconnects and catches up.
- **Producers** (all create rows, in the same transaction as their business action when possible):
  - NOTIF-2 registration confirmed (registrations/payments service), NOTIF-3 session updated (organizer edits a session → notify registered users), NOTIF-4 poll opened/published, NOTIF-1 event reminders (Vercel Cron → `/api/cron/reminders`, idempotent via `dedupeKey`), NOTIF-6/ORG-3 organizer publishes an announcement → one `announcements` row + fan-out `notifications` rows (type `announcement`) for users registered to that event.
  - **Simulated generator** (dev/demo, allowed by the spec): `pnpm`-script or a protected route that inserts fake notifications for a user so the UI can be demoed; mark them `data.simulated = true`.
- **Delivery**: `GET /api/notifications/stream` (auth `USER`).

## MUST
- Route handler returns a `ReadableStream` with headers `Content-Type: text/event-stream; charset=utf-8`, `Cache-Control: no-cache, no-transform`, `Connection: keep-alive`, `X-Accel-Buffering: no`. Node runtime (required by Cache Components anyway). Do not cache.
- Event format: `id: <notification created-at/ID cursor>\nevent: notification\ndata: <JSON NotificationDto>\n\n`; announcements use `event: announcement`. Payload is the **same DTO Zod schema** the REST list returns; client parses it.
- **Heartbeat** comment every ~15 s (`: ping\n\n`) to keep proxies from closing the stream.
- **Resume**: browsers send `Last-Event-ID` on reconnect; the server selects rows for this user with cursor greater than that id (initial connect: only new rows after "now", the list endpoint provides history).
- **Producing inside the stream**: poll the DB every 2–5 s for new rows (`WHERE user_id = $1 AND (created_at, id) > cursor`) inside the stream loop (serverless instances don't share memory, so in-process pub/sub would miss events). Stop the loop on `request.signal` abort.
- **Time limits**: Vercel functions have max durations. Close the stream gracefully before the limit (e.g. after ~50–55 s, check the project's `maxDuration`; verify allowed route config in the Next docs for your setup) and let the client reconnect: `EventSource` auto-reconnects, and `retry: 3000\n\n` sets the delay. This is expected behavior, not an error.
- **Client hook** `useNotificationsStream()` (`features/notifications/hooks`): `new EventSource("/api/notifications/stream")` in an effect (client only, when `authSlice.status === "authenticated"`), `onopen` → `connectionChanged("open")`, `onerror` → `connectionChanged("connecting")` (the browser retries; if `readyState === CLOSED` re-create with exponential backoff and jitter), `addEventListener("notification", e => dispatch(notificationReceived(parse(e.data))))`; show a toast for new items (`aria-live`); close on unmount/logout. Pause when offline (`online`/`offline` events).
- **Notification Center UI (NOTIF-7)**: bell with unread badge (selector), dropdown/page with list (paginated via `GET /api/me/notifications`), mark one/all as read (`POST /api/me/notifications/read` with ids or `all: true`, optimistic), empty state, connection indicator ("Live" / "Reconnecting…").
- Reminders (NOTIF-1): cron job selects events starting within the configured window, creates one reminder per registered user with `dedupeKey = reminder:<eventId>:<window>`; unique `(user_id, dedupe_key)` makes reruns safe.
- Rate-limit stream connections per user (one active stream preferred); validate the session on connect.

## MUST NOT
- No WebSockets (not supported by Vercel functions); no polling from the browser as the primary mechanism.
- No in-memory subscriber maps as the only event bus; no unbounded loops without abort handling; no leaking other users' rows (always filter by the session user).
- No PII beyond what the notification needs; no secrets in event payloads.
- No service worker caching of `/api/notifications/stream` (network-only; see `pwa-offline`).
- No sending `data:` with raw newlines (JSON.stringify keeps it on one line).

## Procedure
1. `notifications` + `announcements` tables (migration). 2. Service: `create`, `list`, `markRead`, `publishAnnouncement`, `sendDueEventReminders`. 3. Cron + REST routes. 4. SSE route. 5. Slice + hook + UI. 6. Simulated generator for demos. 7. Tests: service (fan-out, dedupe), SSE route (reads first chunk with a test user; cursor behavior), hook with a mocked `EventSource`; E2E: organizer publishes → registered user sees a toast.

## Example: stream skeleton (NOTIF-5)
```ts
export const GET = route({ auth: "USER" }, async ({ actor, req }) => {
  const encoder = new TextEncoder();
  let cursor = parseLastEventId(req.headers.get("last-event-id"));
  const stream = new ReadableStream({
    async start(controller) {
      const send = (chunk: string) => controller.enqueue(encoder.encode(chunk));
      send("retry: 3000\n\n");
      const started = Date.now();
      while (!req.signal.aborted && Date.now() - started < STREAM_MAX_MS) {
        const rows = await notificationsService.listSince(actor, cursor);   // repository inside service
        for (const n of rows) { cursor = n.cursor; send(`id: ${n.cursor}\nevent: notification\ndata: ${JSON.stringify(n.dto)}\n\n`); }
        if (!rows.length) send(": ping\n\n");
        await sleep(3000);
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: SSE_HEADERS });
});
```
(The wrapper must allow returning a raw `Response` for streams; keep auth/logging but skip envelope wrapping for this route.)

## Common mistakes
- Buffering: forgetting `no-transform`/flush so events arrive in bursts.
- Treating the planned close at the time limit as an error and spamming Sentry.
- Re-sending history on every reconnect (no cursor).
- Opening multiple `EventSource`s (one per component) instead of one app-level hook.
- Not closing on logout → next user receives the previous user's stream (auth is checked at connect; close on sign-out).

## Final checklist
- [ ] Rows in Postgres are the source of truth; stream only delivers.
- [ ] Headers, heartbeat, `id`, cursor resume, abort handling, graceful close before limit.
- [ ] Client: single hook, auto-reconnect/backoff, Zod-parsed events, slice updated, toast + badge.
- [ ] Cron secret-protected and idempotent; simulated generator marked.
- [ ] Tests cover service dedupe/fan-out, route first chunk, hook with mocked EventSource.
