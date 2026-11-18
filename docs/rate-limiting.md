# Rate limiting and overload protection (BE-7)

Research notes before implementing BE-7. Covers: the two different problems, the algorithm, the
key for every route and why, and what to do when the whole server is overloaded.

> **Follow [rate-limit-algorithms.md](rate-limit-algorithms.md) for what to build.** It has the
> final per-API limits (one row per API) and the build plan. Sections 3–5 here are the first
> draft; where they differ (login failures, event create), that file wins. Sections 6–8 here
> (overload, pitfalls, tests) still apply.

---

## 1. In short

- **Rate limiting** = "each caller gets a fair share". Count requests per caller (IP, user id or
  email) in a time window. Over the limit → `429 Too Many Requests` + `Retry-After` header.
- It stops **abuse**: password guessing, email spam, a script hammering one API, a buggy client
  in a retry loop.
- It does **not** stop **overload**: 10,000 real users arriving at once each stay under their
  own limit, so per-caller limits let all of them in. That is a **capacity** problem, solved
  differently (section 6).

So we need both, and they are different tools:

| Problem                         | Example                                  | Tool                                                      |
| ------------------------------- | ---------------------------------------- | --------------------------------------------------------- |
| One caller sends too much       | Bot tries 1,000 passwords on `/login`    | Rate limit per caller (this doc, sections 2–5)            |
| Too many honest callers at once | Ticket sale opens, whole college logs in | Caching, scaling, pooled DB, load shedding (section 6)    |
| Huge flood from many machines   | DDoS                                     | Host level: Vercel firewall / DDoS protection (section 6) |

---

## 2. What we already have

| Where                                                    | What                                                   | Algorithm                     |
| -------------------------------------------------------- | ------------------------------------------------------ | ----------------------------- |
| `src/core/http/daily-limit.ts`                           | event create 20/day, speaker invite 30/day per user    | Fixed window (24 h), Redis    |
| `password-reset-cooldown.store.ts`                       | forgot-password: 1 email per address per 60 s          | Cooldown (`SET NX EX`)        |
| `email-otp.store.ts`                                     | resend-otp: 1 per address per 60 s; verify: 5 attempts | Cooldown + attempt counter    |
| `account-invite.service.ts`, `password-reset.service.ts` | admin resend-invite / send-reset-link: 1 per 60 s      | Cooldown                      |
| `src/core/http/errors.ts`                                | `RateLimitError` → 429 `RATE_LIMITED`                  | (no `Retry-After` header yet) |

All of these are keyed by **email or target user**. Nothing is keyed by **IP** yet, and there is
no general per-minute limit and no `proxy.ts`. That is the gap.

Keep the existing ones as they are. Daily quotas and "one email per 60 s" are a different need
from "N requests per minute", and they already work.

---

## 3. Which algorithm

### The options

| Algorithm                  | How it works (simple)                                                      | Good                       | Bad                                                                                            |
| -------------------------- | -------------------------------------------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------- |
| **Fixed window**           | One counter per minute (`12:01`, `12:02`…). Reset at the minute.           | Simplest, 1 Redis key      | **Edge burst**: 5 requests at 12:01:59 + 5 at 12:02:00 = 10 in 1 s with a "5/min" limit        |
| **Sliding window log**     | Store the timestamp of every request; count the ones in the last 60 s.     | Exact                      | Stores every request (memory grows with the limit); more Redis work                            |
| **Sliding window counter** | Current minute's count + a weighted part of the previous minute's count.   | No edge burst, only 2 keys | Approximate (assumes the previous minute was evenly spread). Good enough for every use here    |
| **Token bucket**           | A bucket refills N tokens per second; each request takes one; empty → 429. | Allows short bursts        | Two values to keep (tokens + last time), fractional math, harder to explain the limit to users |
| **Leaky bucket**           | Requests queue and leave at a fixed speed.                                 | Smooth output              | Queues requests; a serverless function can't hold requests waiting                             |

### Choice: sliding window counter

- Fixes the fixed-window edge burst, which matters most on `/login` (it would double the
  allowed guesses).
- Cheap: 2 small counters per key, both expire on their own. No per-request storage.
- Easy to say to a user: "10 per minute".
- Runs as **one Lua script** in Redis, the same pattern as `daily-limit.ts`, so two parallel
  requests can't both slip through (atomic).

The formula (window = 60 s, we are 15 s into the current minute):

```
weight     = (60 - 15) / 60 = 0.75        // how much of the previous minute still "overlaps"
estimated  = previousCount * 0.75 + currentCount
allowed    = estimated < limit
```

Keys: `rl:<policy>:<id>:<windowNumber>` where `windowNumber = floor(now / windowMs)`. Each key
expires after 2 windows.

Token bucket would also be a fine choice. It wins only when you want bursts on purpose, which
we don't.

---

## 4. Which key to use, and why

### The rules

| Caller                                           | Key                     | Why                                                                                                     |
| ------------------------------------------------ | ----------------------- | ------------------------------------------------------------------------------------------------------- |
| Not signed in (login, signup, public reads)      | **IP**                  | It's the only identity we have.                                                                         |
| Signed in                                        | **user id**             | Fair per person. Many attendees share one venue/college Wi-Fi IP, so an IP key would block them all.    |
| Route that acts on an email (login, forgot, OTP) | **IP + email** (2 keys) | IP stops one attacker spraying many emails. Email stops many IPs attacking one account (botnet).        |
| Server-to-server (future Stripe/Strapi webhooks) | **none**                | They come from the provider's IPs in bursts. Verify the signature instead; a limit would drop payments. |

### Getting the IP

- On Vercel, read the **first** entry of `x-forwarded-for`. Vercel sets this header itself, so
  the client can't fake it there.
- If we ever self-host, only trust it when our own reverse proxy overwrites it. Otherwise anyone
  can send `x-forwarded-for: 1.2.3.4` and get a fresh limit each time.
- Locally the header is missing: use a fixed fallback such as `"local"`.

### Policies (one name per limit, reused across routes)

| Policy           | Key     | Limit (start here, tune later) | Fail if Redis is down |
| ---------------- | ------- | ------------------------------ | --------------------- |
| `global-ip`      | IP      | 600 / min                      | open (allow)          |
| `auth-ip`        | IP      | 10 / min                       | closed (block)        |
| `login-fail`     | email   | 5 failures / 15 min            | closed                |
| `refresh-ip`     | IP      | 30 / min                       | closed                |
| `public-read-ip` | IP      | 120 / min                      | open                  |
| `user-read`      | user id | 120 / min                      | open                  |
| `user-write`     | user id | 30 / min                       | closed                |
| `user-upload`    | user id | 10 / min                       | closed                |

**Fail open vs closed:** if Redis is down, a **closed** policy rejects the request, an **open**
one lets it through.

- Auth and writes fail **closed**, like `daily-limit.ts` already does. Letting password
  guesses through unchecked is worse than a short outage.
- Reads and the global limit fail **open**. Otherwise a Redis outage would take down the
  whole site, including pages that don't need Redis.

**Why `global-ip` is high (600):** it's only a flood guard. At an event, 200 attendees can share
one Wi-Fi IP, and a low global IP limit would block the venue. Tight limits belong on the
per-route policies, keyed by user id where possible.

### Route-by-route

**Auth (public)**

| Route                             | Policies                                  | Why                                                                                                                                                                                                              |
| --------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/auth/login`            | `auth-ip` + `login-fail` (email)          | Brute force. argon2 is slow and memory-heavy **on purpose**, so a login flood also burns CPU/RAM. Count only **failures** per email and clear them on success, so a real user who logs in fine is never blocked. |
| `POST /api/auth/signup/user`      | `auth-ip`                                 | Fake account creation; each signup hashes a password and sends an email (Resend cost).                                                                                                                           |
| `POST /api/auth/signup/organizer` | `auth-ip`                                 | Same as above.                                                                                                                                                                                                   |
| `POST /api/auth/forgot-password`  | `auth-ip` + existing per-email cooldown   | The cooldown is **per email**, so one attacker can still send to 1,000 **different** emails. The IP limit closes that gap.                                                                                       |
| `POST /api/auth/resend-otp`       | `auth-ip` + existing per-email cooldown   | Same gap as forgot-password.                                                                                                                                                                                     |
| `POST /api/auth/verify-email`     | `auth-ip` + existing 5 attempts per email | Attempts are per email; the IP limit stops guessing codes across many emails.                                                                                                                                    |
| `POST /api/auth/reset-password`   | `auth-ip`                                 | The token is random and can't be guessed; the limit protects the argon2 hash cost.                                                                                                                               |
| `POST /api/auth/account-setup`    | `auth-ip`                                 | Same as reset-password.                                                                                                                                                                                          |
| `POST /api/auth/refresh`          | `refresh-ip`                              | Called automatically by the client; a frontend bug can loop it. Looser than `auth-ip`.                                                                                                                           |
| `POST /api/auth/logout`           | `global-ip` only                          | Harmless, and logout must always work.                                                                                                                                                                           |
| `GET /api/auth/me`                | `user-read`                               | Called on every page load; normal read.                                                                                                                                                                          |

**Public reads**

| Route                                                                                                                                                                                                                             | Policies         | Why                                                                                                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/events`, `/events/slug/[slug]`, `/events/slug/[slug]/sessions/[sessionId]`, `/speakers`, `/speakers/[slug]`, `/speakers/[slug]/sessions`, `/states`, `/venues`, `/venues/[venueId]`, `/venues/[venueId]/halls/[hallId]` | `public-read-ip` | Stop scraping and search spam (`/api/events` runs a search query). Keep it generous because of shared Wi-Fi. **Caching** (section 6) does most of the protecting here. |
| `GET /api/health`                                                                                                                                                                                                                 | none             | Monitoring tools call it often; it must answer even when everything else is limited.                                                                                   |

**Signed in: reads** (`user-read`)

`/api/me/events`, `/api/me/events/counts`, `/api/me/organizer-application`,
`/api/me/speaker-profile` (GET), `/api/events/[eventId]` (GET), `.../content` (GET),
`.../sessions` (GET), `.../sessions/[sessionId]` (GET), `/api/venues/[venueId]/halls/availability`,
`/api/admin/users` (GET), `/api/admin/users/[userId]` (GET), `/api/admin/organizers` (GET),
`/api/admin/organizers/[organizerId]` (GET).

Why: key by user id so one user's tabs or a buggy loop can't hurt others, and shared IPs are
not an issue.

**Signed in: writes** (`user-write`)

Every signed-in `POST` / `PATCH` / `PUT` / `DELETE` not listed below: event create/update/
publish/cancel/delete, sessions, session speakers, event and session content (Strapi),
venues, halls, hall status, speaker profile PATCH, all admin actions (verify, reject, reopen,
suspend, reactivate, delete).

Why: writes hit Postgres in transactions and often Strapi. Even an admin token can be stolen,
so admins get a limit too. Daily limits on event create and speaker invite stay on top of this.

**Signed in: uploads** (`user-upload`)

`POST/DELETE /api/events/[eventId]/cover`, `POST /api/events/[eventId]/gallery`,
`DELETE .../gallery/[fileId]`, `POST/DELETE .../sessions/[sessionId]/cover`,
`POST /api/me/speaker-profile/photo`.

Why: large bodies, Blob/Strapi storage cost, slow. Tighter than normal writes.

**Signed in: sends an email** (`user-write` + existing cooldown/daily limit)

`POST /api/speakers` (invite), `/api/speakers/[slug]/resend-invite`,
`/api/admin/organizers` (create), `.../resend-invite`, `/api/admin/users/[userId]/resend-invite`,
`.../send-reset-link`.

Why: the existing per-target cooldown stops spamming **one** inbox; `user-write` stops one
account cycling through many targets.

**Not built yet (plan now so they get a limit when they're added)**

| Future route                   | Policy                                       | Why                                                                                          |
| ------------------------------ | -------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Poll vote                      | `user-write`, maybe a stricter `vote` policy | Required by BE-7. "One vote per poll" is a DB unique constraint, not a rate limit.           |
| Registration / Stripe checkout | `user-write`                                 | Each checkout creates a Stripe session.                                                      |
| Stripe / Strapi webhooks       | none                                         | Verify the signature; never drop a provider call.                                            |
| SSE notifications stream       | max N **open connections** per user (e.g. 3) | One request stays open for minutes, so requests per minute means nothing; count connections. |

---

## 5. Where the code goes

Request order, cheapest check first:

```
request
  → proxy.ts               global-ip (every /api/*, except /api/health)
  → route() wrapper        the route's policy: IP for public routes,
                           user id for signed-in routes (after requireCurrentUser)
  → service                email-based limits: login-fail, existing cooldowns, daily limits
  → work (DB, Strapi, email)
```

- **`proxy.ts`** (project root, next to `app/`). In Next 16, Proxy runs on the Node.js runtime
  by default, so it can use our ioredis client. Use a `matcher` for `/api/:path*`.
- **`route()` in `src/core/http/route-handler.ts`**: add an option next to `auth`, for example
  `route({ auth: "public", rateLimit: "auth-ip" }, ...)`. The policy sits next to the auth rule,
  so a reviewer sees both at once. A default per kind (public GET → `public-read-ip`, signed-in
  write → `user-write`) means no route is forgotten. That's the same idea as "deny by default".
- **Email-based limits stay in services.** The email is in the body, which only the service has
  after Zod parsing. Same place as the existing cooldowns.
- **New `src/core/http/rate-limit.ts`**: the sliding-window Lua script + `checkRateLimit()`.
  Policies go in a `RATE_LIMIT_POLICIES` constant, so limits live in one table.
- **`RateLimitError`** gets a `retryAfterSeconds`, and `errorResponse` sets the `Retry-After`
  header from it.
- **Frontend:** on 429 show "Too many attempts, try again in N seconds". Tell React Query
  **not to retry** 429s, or the client keeps hitting the limit.

**Rule:** blocked requests still count. A spammer who keeps hammering stays blocked instead of
getting a fresh slot every few seconds.

---

## 6. When the whole server is overloaded (many real users)

You're right: a per-route rate limit doesn't help here. Every user is honest and under their
own limit. What runs out is **shared** capacity: CPU, database connections, Strapi, Redis.

On Vercel, the app runs as **serverless functions that scale automatically**: more users means
more copies of the function. So the Next.js code itself rarely runs out. The bottleneck moves
to what all copies share: **Postgres connections first**, then Strapi and Redis.

Work through these in order (first = biggest win):

| #   | What                                       | How it helps                                                                                                                                                                                                                                                                                               | For this POC          |
| --- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| 1   | **Cache public reads**                     | 10,000 people opening the same event page should cost 1 DB query, not 10,000. Use `use cache` + `revalidateTag(tag, "max")` for event and speaker data; public GETs can send `Cache-Control` so Vercel's CDN answers.                                                                                      | **Yes**               |
| 2   | **Pooled DB connection + small pool**      | Use Neon's **pooled** connection string in prod (PgBouncer in front of Postgres). Each function copy keeps only a few connections, so 100 copies don't open 1,000 connections and crash the DB.                                                                                                            | **Yes**               |
| 3   | **Timeouts → fail fast with 503**          | If the DB pool is full, wait a bounded time (we use 10 s: it must exceed the time to open a connection, which was 3.5–4 s to hosted Neon), then answer `503 Service Unavailable` + `Retry-After`. A fast "busy, retry" is better than every request hanging until it times out. This is **load shedding**. | **Yes** (small)       |
| 4   | **Queue slow work**                        | Emails already go through BullMQ, so a signup rush doesn't wait on Resend. Keep doing this for any slow side work.                                                                                                                                                                                         | Done                  |
| 5   | **Global limit on one expensive resource** | A Redis counter **not keyed by user** (e.g. "max 50 Strapi writes per second, whole app"). Over it → 503. Protects a fragile dependency that can't scale.                                                                                                                                                  | Later, only if needed |
| 6   | **Host firewall / DDoS protection**        | A real flood must be stopped **before** it reaches our code: every request that reaches a function already costs us. Vercel has built-in DDoS mitigation, a WAF with rate-limit rules, and an "attack challenge" mode. Configure it in the dashboard, not in code.                                         | Document only         |
| 7   | **Waiting room** (virtual queue)           | For a ticket drop: let N users in at a time, show the rest "you're in line". Real ticketing sites do this.                                                                                                                                                                                                 | No (bonus level)      |

**Frontend side of overload:** debounce search inputs, don't poll faster than needed, and back
off on 429/503 (respect `Retry-After`). Otherwise the clients themselves create a retry storm.

---

## 7. Pitfalls

- **Non-atomic counters:** `GET` then `SET` in two calls lets parallel requests slip through.
  Use one Lua script (as `daily-limit.ts` does).
- **Trusting `x-forwarded-for` blindly** when not behind a proxy that overwrites it.
- **IP-only limits on signed-in routes:** a whole venue Wi-Fi gets blocked together.
- **Email-only limits on login:** an attacker can lock out a victim by failing 5 times. Short
  window + counting failures only + clearing on success keeps that small.
- **User enumeration:** a limited forgot-password / resend-otp must answer the same for known and
  unknown emails. The existing cooldowns already do this; the IP limit (429 for everyone) doesn't
  reveal anything either.
- **Different messages per policy** can leak which check failed. Keep one generic 429 message.
- **Limiting webhooks or `/api/health`:** you drop payments or get false "site down" alerts.
- **Forgetting the limit in tests:** integration tests that call login 20 times will start getting 429. Reset Redis keys between tests or raise limits in the test env.

---

## 8. Tests to write

- `rate-limit.ts`: N requests pass, request N+1 → blocked; the window slides (requests from the
  previous window count by weight); keys expire; Redis down → open vs closed per policy.
- `route()` wrapper: public route keys by IP; signed-in route keys by user id; 429 has
  `Retry-After` and the `RATE_LIMITED` envelope.
- Login: 5 wrong passwords → 429; a successful login clears the failure count.
- Forgot-password: many **different** emails from one IP → 429 after the `auth-ip` limit.
- Proxy: `/api/health` is never limited.
