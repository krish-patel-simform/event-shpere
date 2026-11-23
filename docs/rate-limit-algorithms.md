# Rate limit algorithms: which one for which API (BE-7)

Learning guide and build plan. Sections 1–8 explain the ideas; section 9 is the plan, in
phases. Background research (overload, pitfalls): [rate-limiting.md](rate-limiting.md). Where the
two files differ, this one wins.

---

## 1. The tools we use (simple words)

| Tool                        | One-line idea                                                  | Redis stores                            |
| --------------------------- | -------------------------------------------------------------- | --------------------------------------- |
| **Cooldown flag**           | "Once per N seconds." A key exists = wait.                     | one key, value `1`, with expiry         |
| **Fixed window counter**    | "At most N in this period." Count, and the key deletes itself. | one counter with expiry                 |
| **Sliding window counter**  | "At most N per minute", measured smoothly, no edge burst.      | two counters (this minute, last minute) |
| **Open-connection counter** | "At most N things open at the same time" (SSE, later).         | one counter, +1 on open, -1 on close    |

**Token bucket** is the fifth well-known one. We do **not** use it; section 6 says why.

**Your idea is right** that fixed rules (login failures, "one email per 60 s", "20 events per
day") need only a simple counter or flag. The only correction: the simple tool is a
_counter / flag_, not a _token bucket_. A token bucket is a different, more complex tool.

---

## 2. Which tool for which API

### How to choose: ask "what is the harm?"

| Harm                                                                  | Tool                               |
| --------------------------------------------------------------------- | ---------------------------------- |
| Each action **costs something** (a Strapi page, an email, storage)    | Fixed counter per day (quota)      |
| Someone **sends too fast** (guessing, spam, scraping, a loop bug)     | Sliding window counter, per min    |
| Something may happen **only once in a while** (an email to one inbox) | Cooldown flag                      |
| A fixed number of **tries** (wrong passwords, wrong codes)            | Fixed counter (cleared on success) |

If a route already has a daily quota, it needs **no special per-minute limit**: the quota is the
real protection.

### One row per API

Each API appears **once**. Some have two limits; both are checked and the **first one that
fails** answers 429. A second limit is only added when it answers a **different question** (a
different key, or speed vs total).

**Every route names its own limit** with `rateLimit: "..."` in its `route()` call (75 of 75
handlers), so you can read the limit in the route file. In the table, "(default)" only means the
policy is the usual one for that kind of route (public read, public write, signed-in read,
signed-in write). It is still written in the route. `route()` also has a runtime default for a
route that forgets, but that is a safety net only: `app/api/__tests__/rate-limit-coverage.test.ts`
scans every route file and fails if a handler has no `rateLimit`. A public route accepts only IP
policies and a signed-in route only user policies (`keyedBy` in `rate-limit-policies.ts`); a wrong
pairing does not compile.

| API                                                                                       | Limits                                                                                         | Why                                                                                                                          |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `POST /auth/login`                                                                        | IP: sliding 20 / min (default)<br>email: fixed counter 5 failures / 15 min (**new**)           | IP = how fast one machine guesses. Email = many machines guessing one account.                                               |
| `POST /auth/signup/user`, `/auth/signup/organizer`                                        | IP: sliding 20 / min (default)                                                                 | Fake accounts; each one hashes a password and sends an email.                                                                |
| `POST /auth/forgot-password`, `/auth/resend-otp`                                          | IP: sliding 20 / min (default)<br>email: cooldown 1 / 60 s (**exists**)                        | Cooldown = one inbox isn't spammed. IP = one attacker can't use 1,000 **different** emails.                                  |
| `POST /auth/verify-email`                                                                 | IP: sliding 20 / min (default)<br>email: 5 wrong codes (**exists**)                            | Attempts protect one code. IP stops guessing across many emails.                                                             |
| `POST /auth/reset-password`, `/auth/account-setup`                                        | IP: sliding 20 / min (default)                                                                 | The token can't be guessed; the limit protects the slow argon2 hash.                                                         |
| `POST /auth/refresh`                                                                      | IP: sliding 30 / min (override, fails open)                                                    | Called by the client by itself; looser, but stops a loop bug.                                                                |
| `POST /auth/logout`, `GET /health`                                                        | none                                                                                           | Logout must always work; monitoring must always reach health.                                                                |
| Public GETs: events, event by slug, sessions, speakers, venues, halls, states             | IP: sliding 120 / min (default)                                                                | Only the IP is known. High because a venue's Wi-Fi is one IP. Caching does most of the work.                                 |
| Signed-in GETs: `/auth/me`, `/me/*`, event, sessions, content, availability, admin lists  | user: sliding 120 / min (default)                                                              | One person is limited, not their whole Wi-Fi.                                                                                |
| Signed-in writes: update, publish, cancel, delete, sessions, venues, halls, admin actions | user: sliding 30 / min (default)                                                               | Writes cost DB transactions and Strapi calls.                                                                                |
| `POST /events` (create)                                                                   | user: **daily quota 20 / day** (**exists**)<br>(the default 30 / min is there but never fires) | The harm is cost per event, so the quota protects it. 20 / day is lower than 30 / min, so the per-minute limit adds nothing. |
| `POST /speakers` (invite)                                                                 | user: **daily quota 30 / day** (**exists**)<br>(default 30 / min, same as above)               | Same as event create.                                                                                                        |
| Resend-invite, send-reset-link, organizer create (admin / organizer, sends an email)      | user: sliding 30 / min (default)<br>target user: cooldown 1 / 60 s (**exists**)                | Cooldown = one target's inbox. User limit = one account cycling through many targets.                                        |
| Uploads: event/session cover, gallery, speaker photo                                      | user: sliding 10 / min (override) on the POST that sends the file; DELETE keeps the default    | Big bodies and storage cost.                                                                                                 |
| Every `/api/*` request (`proxy.ts`)                                                       | IP: sliding 600 / min                                                                          | Only a flood guard, loose on purpose.                                                                                        |
| SSE notifications (later)                                                                 | user: max 3 open connections                                                                   | A stream stays open for minutes; "per minute" means nothing.                                                                 |

### Your questions

**Public APIs (events, speakers): the key is the IP. What else?**
Nothing else at the first step: a public caller has no id, so IP is the only key. Two small
extras help:

- Cache the response. A cached answer never reaches our function, so it costs no limit and no
  database query. This protects public pages more than the limit does.
- Optional: a second, tighter key for the **expensive** variant of a route. `GET /api/events`
  with `?search=` is heavier than the plain list, so it can also take `search-ip` = 30 / min.

**Signed-in users: sliding window counter or not?**
Yes, the same algorithm, only the key changes to the user id. Reasons:

- One script, one set of tests, one sentence to explain: "30 writes per minute".
- A page load fires several requests at once. A window of 120 / min allows that burst, then
  caps the sustained speed. That is the behavior we want.

**So which algorithms do we actually build?**
Only two kinds:

- **Sliding window counter** (new): every "too fast" rule. This is the main build.
- **Fixed counter / cooldown flag** (mostly exists): the fixed rules. The only new one is the
  login failure counter, and it reuses the counting script from `daily-limit.ts`.

No token bucket: the sliding window covers "too fast", the fixed counters cover "too many in
total", so nothing is left for it to do.

---

## 3. Cooldown flag (exists: `password-reset-cooldown.store.ts`)

**Idea:** write a key that expires. If the key is already there, say "wait".

**Redis command:** `SET key 1 EX 60 NX`. `NX` = only if the key does not exist. It is one step,
so two requests at the same moment cannot both win.

**Example** (`forgot-password` for `alice@x.com`):

```
12:00:00  SET password-reset:cooldown:alice@x.com 1 EX 60 NX   → OK    → send the email
12:00:20  SET password-reset:cooldown:alice@x.com 1 EX 60 NX   → nil   → refused (40 s left)
12:01:00  key expired and deleted by Redis
12:01:05  SET password-reset:cooldown:alice@x.com 1 EX 60 NX   → OK    → send the email

In Redis at 12:00:20:
  key   password-reset:cooldown:alice@x.com
  value 1
  TTL   40
```

Nothing to calculate. The key's life **is** the rule.

---

## 4. Fixed window counter (exists: `daily-limit.ts`; new use: login failures)

**Idea:** count in one key. The first use starts the clock. When the key expires, the count is
gone and the next use starts a new period.

**Redis:** `INCR` then `EXPIRE` (only when the key is new), in one Lua script.

### Example A: quota, `event:create`, limit 20 per day

```
Key: daily-limit:event:create:<organizerId>

Mon 09:00  1st event    INCR → 1    key is new → EXPIRE 86400      allowed
Mon 09:05  2nd event    INCR → 2                                    allowed
   ...
Mon 14:00  20th event   INCR → 20                                   allowed  (20 > 20 is false)
Mon 14:10  21st event   INCR → 21                                   BLOCKED  (21 > 20)
Tue 09:00  key expired → the next event starts at 1 again
```

The rule is `used > limit → block`. Note the day starts at the **first use**, not at midnight.

### Example B: login failures, limit 5 per 15 min (new)

```
Key: rl:login-fail:alice@x.com
```

The flow, in this order. **Count first, forgive on success.** A "check, then verify, then record
a failure" flow has a race: argon2 takes about 100 ms, so 100 guesses sent at the same moment
would all read "0 failures" and all be checked. One atomic `INCR` at the start makes the limit
exact however many arrive together.

1. `INCR` the counter (new key → `EXPIRE 900`). If the result is `> 5` → answer 429 **without**
   looking up the account or hashing the password (saves argon2 CPU).
2. Password wrong → 401, the count stays.
3. Password right → `DEL` the key (a real user is never punished for old mistakes).

```
10:00  attempt, wrong password   INCR → 1   EXPIRE 900
10:01  attempt, wrong password   INCR → 2
10:02  attempt, wrong password   INCR → 3
10:03  attempt, wrong password   INCR → 4
10:04  attempt, wrong password   INCR → 5   (5 > 5 is false: still checked)
10:05  any attempt               INCR → 6   (6 > 5)  → 429, password not even checked
                                            Retry-After = TTL of the key (about 600 s)
10:15  key expired               → fresh start
```

So attempts 1 to 5 are checked, and the 6th is refused even with the right password, the same
`used > limit` rule as the daily quota. The window starts at the first attempt; later attempts
(refused ones too) do not extend it.

Other rules for this one:

- Count unknown emails the same way, and answer them the same. Otherwise the 429 shows which
  emails exist.
- An attacker can lock one email out for 15 min by failing 5 times. We accept that: the
  lockout is short, and the IP limit (section 5) slows the attacker down.

**Edge burst:** the fixed window does allow up to 2× the limit around a boundary (5 failures at
10:14:59 and 5 more at 10:15:00 = 10 guesses). For a 15 min lockout behind a slow argon2 hash
and an IP limit, that is acceptable. That is why the speed limits below do **not** use this tool.

---

## 5. Sliding window counter (new: all "per minute" limits)

**Idea:** a fixed window has an edge burst. The sliding window fixes it by also looking at
the **previous** window, counted less the further we are into the current one.

```
estimated = previousCount × weight + currentCount
weight    = (windowSize − secondsIntoCurrentWindow) / windowSize
allowed   = estimated <= limit
```

**Redis:** two counters, one per minute, named with the minute number
(`window = floor(nowSeconds / 60)`). Both expire after 2 minutes. One Lua script reads both,
`INCR`s the current one, sets the expiry, and returns the answer.

### Example: a policy with limit 10 per minute (made-up numbers), IP `203.0.113.7`

In Redis (minute numbers are made up):

```
rl:auth-ip:203.0.113.7:29000   = 8     ← 12:00:00 – 12:00:59 (previous)
rl:auth-ip:203.0.113.7:29001   = 0     ← 12:01:00 – 12:01:59 (current), TTL 120
```

It is **12:01:15**: 15 s into the minute, so `weight = (60 − 15) / 60 = 0.75`.
The previous minute counts as `8 × 0.75 = 6`.

| Request | current (after `INCR`) | estimated = 6 + current | Result                       |
| ------- | ---------------------- | ----------------------- | ---------------------------- |
| 1st     | 1                      | 6 + 1 = **7**           | allowed (3 left)             |
| 2nd     | 2                      | 6 + 2 = **8**           | allowed (2 left)             |
| 3rd     | 3                      | 6 + 3 = **9**           | allowed (1 left)             |
| 4th     | 4                      | 6 + 4 = **10**          | allowed (0 left, `10 <= 10`) |
| 5th     | 5                      | 6 + 5 = **11**          | **BLOCKED** → 429            |

The blocked request still did `INCR`, so someone who keeps hammering stays blocked.

**Why this beats the fixed window (the edge burst):**

```
12:00:59   an attacker sends 10 requests          key :29000 = 10
12:01:00   (new minute) sends 1 more
           weight = (60 − 0) / 60 = 1.0
           estimated = 10 × 1.0 + 1 = 11   → BLOCKED

A fixed window would have started at 0 here and allowed 10 more.
Over that 2 seconds it would have let 20 through, with a limit of 10 per minute.
```

**What we return:**

- `remaining = max(0, limit − floor(estimated))`.
- `Retry-After` = seconds left in the current window. It is a hint (the estimate can still be
  over the limit right after the window changes), but it is simple and honest enough.

**Cost:** 2 tiny keys per caller per policy, each deletes itself after 2 minutes. Nothing is
stored per request, so memory stays small however many requests come.

---

## 6. Token bucket (not used, and why)

**Idea:** a bucket holds up to `capacity` tokens and refills at a steady speed. Each request
takes one token. Empty bucket → blocked.

**Redis:** a hash with two fields, `tokens` and `lastRefill`.

**Example** (capacity 10, refill 1 token per 6 s):

```
t = 0 s    tokens = 2, lastRefill = 0
t = 12 s   request arrives
           refill = 12 s / 6 s = 2 tokens
           tokens = min(10, 2 + 2) = 4
           take 1 → tokens = 3, lastRefill = 12     → allowed
```

**Why we skip it:**

- Two values to keep, and a refill calculation (with decimals) in the script.
- It is hard to say to a user. "30 per minute" is easy; "bucket of 10, refills every 6 s" is not.
- Its main gain is allowing a controlled burst. A 120 per minute window already allows a page
  load's burst. We don't need anything more.
- You would pick it for an API where a client may burst a lot, then must be slow, such as a
  paid public API with plans. We don't have that.

---

## 7. Open-connection counter (later: SSE notifications)

**Idea:** limit things open at the **same time**, not requests per minute.

```
Key: sse:open:<userId>

open the stream    INCR → 1   (if > 3: DECR, answer 429)
close the stream   DECR
```

Risk: if a server dies, the `DECR` never runs and the count stays too high. The key therefore
gets an expiry that is refreshed by the stream's heartbeat, so a dead connection's count
disappears on its own. We build this in the notifications feature, not now.

---

## 8. One correction to rate-limiting.md

[rate-limiting.md](rate-limiting.md) puts `login-fail` under the sliding window and says the edge
burst "matters most on /login". After thinking it through:

- **Per-email failure counter** → simple fixed counter (section 4B). It is a fixed rule, and
  the IP limit sits next to it.
- **Per-IP speed on login** → sliding window counter (section 5). This is where the edge burst
  matters.

This file is the one to follow.

---

## 9. Build plan (phases)

Build bottom-up: each phase is tested on its own before the next one uses it. Run
`pnpm lint`, `pnpm typecheck` and `pnpm test` at the end of every phase. Progress is tracked
under BE-7 in [remaining-work.md](remaining-work.md).

### Progress

| Phase | What                            | Status                                                                                                                                                                                       |
| ----- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Foundations                     | Done (`retryAfterSeconds`, `client-ip.ts`, policies table, `Retry-After` header)                                                                                                             |
| 1     | The engine                      | Done (`sliding-window.ts`, `rate-limit.ts`, `increment-with-expiry.ts`). Lua not yet run on real Redis                                                                                       |
| 2     | Wire into `route()`             | Done. Live check with `curl` still to do (see below)                                                                                                                                         |
| 3     | Per-route overrides             | Done. `auth-ip` is 20 / min; `refresh-ip` fails open; only upload `POST`s use `user-upload`. Then every route got an explicit `rateLimit` (75 / 75), typed by key kind, with a coverage test |
| 4     | Login failure counter           | Done. Count first, forgive on success (see section 4B). Not yet tried against a real Redis                                                                                                   |
| 5     | Global flood guard (`proxy.ts`) | Done. Built and smoke-tested with Redis down (fails open); 429 not yet seen with a real Redis                                                                                                |
| 6     | Frontend                        | Done. 429 alert says to wait a moment (no time shown), no retry on 503, refresh failures no longer read as "signed out". Not yet seen in the browser against a real 429                      |
| 7     | Overload protection             | Done in code. CDN cache on 4 public reads, 10 s pool timeout, 503 + `Retry-After` on a busy DB. Deploy checklist (Neon pooler, Vercel firewall) written; not tried on Vercel yet             |
| 8     | Later, with their features      | Deferred until those features exist (notes in the Phase 8 section)                                                                                                                           |

Still to check by hand: run the Lua script once with `redis-cli`, and send 21 quick `POST`s to
`/api/auth/login` (the 21st should answer 429 with `Retry-After`).

### The reusable pieces (write once, use everywhere)

| Piece                                                                 | File                                              | Used by                                   |
| --------------------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------- |
| `RATE_LIMIT_POLICIES` (name → limit, window, fail open/closed)        | `src/core/http/rate-limit-policies.ts`            | everything; the only place numbers change |
| `getClientIp(req)`                                                    | `src/core/http/client-ip.ts`                      | `route()` wrapper, `proxy.ts`             |
| `incrementWithExpiry(key, ttlSeconds)`, moved out of `daily-limit.ts` | `src/core/redis/increment-with-expiry.ts`         | daily limit, login failures               |
| `slidingWindowDecision(...)`: the math only, no Redis                 | `src/core/http/sliding-window.ts`                 | `consumeRateLimit`                        |
| `consumeRateLimit(policy, id)` / `assertRateLimit(policy, id)`        | `src/core/http/rate-limit.ts`                     | `route()` wrapper, `proxy.ts`, services   |
| `route({ ..., rateLimit })` option with defaults                      | `src/core/http/route-handler.ts`                  | all routes                                |
| `loginFailureStore.{isLocked, recordFailure, clear}`                  | `src/features/auth/server/login-failure.store.ts` | login only                                |

**Design choice: Lua does the counting, TypeScript does the math.** The Lua script only
`INCR`s the current key, sets its expiry and reads the previous key, in one atomic step, and
returns both numbers. The weight / estimate / allowed calculation is a **pure function** in
TypeScript. So the examples from section 5 become plain Jest tests, with no Redis needed.

### Phase 0: Foundations (no Redis)

Goal: a 429 that tells the client when to come back, and the building blocks.

- `errors.ts`: `RateLimitError` gets an optional `retryAfterSeconds`.
- `response.ts` / `route-handler.ts`: when the error is a `RateLimitError` with
  `retryAfterSeconds`, the response gets a `Retry-After` header. Hint: let `errorResponse` take an
  optional `headers` argument.
- `client-ip.ts`: `getClientIp(req: Request): string`. Use the first entry of
  `x-forwarded-for`, trimmed; if it is missing, use `"local"`.
- `rate-limit-policies.ts`:

  ```ts
  type RateLimitPolicy = { limit: number; windowSeconds: number; failMode: "open" | "closed" };
  export const RATE_LIMIT_POLICIES = { "auth-ip": {...}, ... } as const satisfies Record<string, RateLimitPolicy>;
  export type RateLimitPolicyName = keyof typeof RATE_LIMIT_POLICIES;
  ```

Tests: the 429 has `Retry-After` and the `RATE_LIMITED` envelope; `getClientIp` covers one IP,
a list of IPs, a missing header and extra spaces.

Done when: nothing calls these yet, and all tests pass.

### Phase 1: The engine (Redis)

Goal: one function that answers "may this caller go on?".

1. **Refactor first.** Move `COUNT_SCRIPT` from `daily-limit.ts` into
   `incrementWithExpiry(key, ttlSeconds): Promise<number>`, and make `daily-limit.ts` call it.
   The existing `daily-limit.test.ts` must still pass; it is your safety net.
2. **Pure math.** `slidingWindowDecision({ previous, current, limit, windowSeconds, secondsIntoWindow })`
   returns `{ allowed, remaining, retryAfterSeconds }`. It uses the formula from section 5.
3. **Engine.** In `consumeRateLimit(policyName, id, now = Date.now())`:
   - window number = `floor(nowSeconds / windowSeconds)`
   - keys: `rl:<policy>:<id>:<window>` and `rl:<policy>:<id>:<window − 1>`
   - run the Lua script (INCR current, EXPIRE `2 × windowSeconds` if no expiry, GET previous)
   - pass the two numbers to `slidingWindowDecision`

   `assertRateLimit(...)` calls it and throws `RateLimitError` when not allowed.

4. **Redis down.** Catch the error. If the policy is `failMode: "open"`, log it and allow the
   request. If it is `"closed"`, rethrow (the request fails, like `daily-limit.ts` does today).

Tests:

- `slidingWindowDecision`: the 5 rows of the table in section 5, the edge-burst example, and
  `remaining` never going below 0.
- `consumeRateLimit` (mock `getRedis`, like `daily-limit.test.ts`): correct key names, correct
  TTL, fail open vs fail closed.

Done when: the engine works in tests, and no route uses it yet.

### Phase 2: Wire into `route()` (turns limits on everywhere)

Goal: every route is limited without editing each route.

- Add an optional `rateLimit?: RateLimitPolicyName | "none"` next to `auth`.
- If it is not set, use the default:

  | Route kind               | Default          | Key     |
  | ------------------------ | ---------------- | ------- |
  | public GET               | `public-read-ip` | IP      |
  | public POST/PATCH/DELETE | `auth-ip`        | IP      |
  | signed-in GET            | `user-read`      | user id |
  | signed-in write          | `user-write`     | user id |

  Public writes are only the auth routes, so `auth-ip` is the right strict default. This is
  deny-by-default again: a new route is limited even if you forget.

- Order: public routes are checked by IP **before** the handler. Signed-in routes are checked
  by user id **right after** `requireCurrentUser()`.

Tests (`route-handler.test.ts`): a public route keys by IP; a signed-in route keys by user id;
`"none"` skips the check; a blocked request returns 429 and never calls the handler.

Watch out: integration / E2E tests that call login many times will now get 429. Flush the
`rl:*` keys between tests, or use higher limits in the test env.

Done when: every route has the default limit.

### Phase 3: Per-route overrides

Goal: the few routes that differ from the default.

- `refresh` → `rateLimit: "refresh-ip"`
- event/session cover, gallery, speaker photo → `rateLimit: "user-upload"`
- `logout`, `health` → `rateLimit: "none"`

Done when: section 2's table matches the code, route by route.

### Phase 4: Login failure counter

Goal: many machines can't guess one account's password.

- Constants in `features/auth/constants.ts`: `LOGIN_MAX_ATTEMPTS = 5`,
  `LOGIN_ATTEMPTS_WINDOW_SECONDS = 15 * 60`.
- `login-failure.store.ts`, built on `incrementWithExpiry`:
  - `registerAttempt(email)` counts one attempt and answers `{ locked: false }` or
    `{ locked: true, retryAfterSeconds }` (the key's remaining TTL, read only when refusing)
  - `clear(email)` (DEL)
- Injected into `authService` like the other stores. In `login()`:
  1. `registerAttempt` **first**, before any lookup or hash. Locked → `RateLimitError` with
     `retryAfterSeconds`.
  2. Wrong password or unknown email → the same 401 as before (the count stays).
  3. Right password → `clear`, before the pending / suspended checks.
- Unknown emails are counted the same way, so the answer never shows which emails exist.
- Redis down → the login fails (fail closed), like `auth-ip`.

Tests: the store (key and expiry, attempt 5 passes and 6 is refused, `retryAfterSeconds` from
the TTL and at least 1, Redis failure, `clear`) and the service with a fake store (counted
before the password, locked answer with no lookup and no hash, same answer for an unknown
email, cleared after a correct password even for a pending account, never cleared after a wrong
one, Redis failure).

Done when: section 4B works end to end. Still to check by hand: 6 quick wrong logins for the
same email. The first five answer 401 and the sixth answers 429 with `Retry-After`.

### Phase 5: Global flood guard (`proxy.ts`)

Goal: a flood is rejected before any route code runs.

- **Read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`
  first.** Proxy is new in Next 16 and replaces `middleware`.
- `proxy.ts` at the project root (next to `app/`), with `matcher: "/api/:path*"`. It is a thin
  shell: the logic is `globalRateLimit(req)` in `src/core/http/global-rate-limit.ts`, so it can
  be unit tested. The Node.js runtime is the default, so the Redis client works in it.
- `/api/health` is skipped by an exact-path list (`UNLIMITED_PATHS`). Future webhook routes go
  in the same list.
- Call `consumeRateLimit("global-ip", getClientIp(req))`. Over the limit → the same 429
  envelope with `Retry-After` and an `x-request-id` (the route wrapper doesn't run here). This
  policy is `failMode: "open"`, so a Redis outage doesn't take the whole API down.

Tests: the guard (IP key, allowed passes, refused gives 429 + `Retry-After`, health never
counted, only the exact health path skipped) and `proxy()` itself (uses the guard's answer,
otherwise continues, matcher is `/api/:path*`).

Done when: every API request goes through the proxy check. Checked: the production build lists
`Proxy (Middleware)`, and the built app, run with a dead Redis, let requests through (fail open)
and logged one line. Still to check by hand, with a real Redis: 601 quick requests to
`/api/nothing` (a missing route, so only the proxy counts them) should answer 404 and then 429
with `Retry-After`.

### Phase 6: Frontend

Goal: the user sees a clear message, and the client doesn't retry into the limit.

- No wait time is shown to the user. The server still sends the standard `Retry-After` header
  (useful for curl and API clients), but the UI just says to wait a moment.
- The 401 interceptor in `base-api.service.ts` treats only a 401 from the refresh as "signed out".
  A 429, 5xx or network failure on the refresh is passed on as itself, so a rate-limited refresh
  doesn't log the user out.
- React Query (`QueryProvider`): no automatic retry on any 4xx (so not on 429) or on 503.
- `getAuthAlert` maps 429 / `RATE_LIMITED` to a warning: "You've made too many requests. Please
  wait a moment and try again.", with no retry button. Every auth form already renders
  `AuthAlert`, so login, signup, forgot-password, reset-password, set-password, OTP and resend
  all get it.
- The other ~50 places that show `error.message` (admin, events, venues, speakers, sessions)
  show the server's own text ("Too many requests, try again later"); nothing changed there.

Tests: `base-api.service.test.ts` (refresh 429 / 5xx / network), `QueryProvider.test.tsx` (no
retry on 503 / 429 / 404; retry on 500 / network), `auth-error-alerts.test.ts`, and the six
form/screen tests for the 429 alert.

Done when: the message is visible in the UI, checked on mobile width too (manual check still open).

### Phase 7: Overload protection (many real users)

Goal: shared capacity is protected. This is not rate limiting; see
[rate-limiting.md](rate-limiting.md) section 6.

What was built:

- **CDN cache on public reads that are the same for everyone.** `PUBLIC_CACHE_HEADERS` in
  `core/http/response.ts` on the event list, one event, one public session and a speaker's
  sessions: `Vercel-CDN-Cache-Control: s-maxage=30, stale-while-revalidate=60` for the CDN, and
  `Cache-Control: public, max-age=0, must-revalidate` for browsers. They were one header at first
  (`public, max-age=0, s-maxage=30, stale-while-revalidate=60`), but browsers apply
  `stale-while-revalidate` to their own cache too, so a refetch got the old copy ("seats left" did
  not move after registering). Fixed by keeping the CDN rule in the Vercel-only header. The CDN answers repeat
  requests without running our code (so without a DB query or a rate-limit count). Cost: an edit
  (publish, cancel) can take up to about 90 seconds to show for guests. Only `ok()` /
  `paginated()` carry it, so a 404, 429 or 503 is never kept.
- **What is NOT cached, on purpose.** Speakers (list and profile), venues and halls answer
  differently to an admin, so they keep `PER_USER_HEADERS` (`private, no-store`). A route with
  no cache header is not kept by the CDN, so forgetting is safe. `use cache` + `revalidateTag`
  was skipped: its entries live in memory per serverless instance, so it helps far less than the
  CDN and needs exact invalidation on every write. Revisit only if the CDN cache is not enough.
- **Pool timeout.** `connectionTimeoutMillis: 10000` in `src/db/dbClient.ts` (pool of 5 per
  instance). A request waits at most 10 seconds for a free connection. It started at 5 s, and a
  live test showed that was too tight: opening a connection to hosted Neon took 3.5-4 s from a
  dev machine, so 3 of 6 parallel requests failed with a false 503. Rule: the timeout must be
  well above the time to open a connection and below the browser's own 15 s request timeout
  (`base-api.service.ts`), or the user sees a network error instead of the 503. Measure the
  connect time again after any change of region or database.
- **Load shedding.** `isDatabaseUnavailable()` (`core/http/database-unavailable.ts`) recognises a
  pool timeout, a dropped connection, "too many connections", a server restart and socket
  errors (it looks inside Drizzle's `cause`). `route()` then answers `503 SERVICE_BUSY` with
  `Retry-After: 5` and a generic body. Any other database error (a bug, a missing table, a unique
  violation) stays a 500. The client already doesn't retry a 503 (Phase 6).

Deploy checklist (do in the Vercel / Neon dashboards, not in code):

- **Neon pooled connection string** for the app at runtime: the host with `-pooler` in the name
  (Neon puts PgBouncer in front of Postgres). Keep `max: 5` per instance. Check that
  `drizzle-kit migrate` uses the direct (non-pooled) string, which Neon recommends for
  migrations.
- **Vercel Firewall:** leave the built-in DDoS mitigation on; add a WAF rate-limit rule for
  `/api/*` per IP as a second layer above our Redis limits; know where "Attack Challenge Mode" is
  and turn it on during a real attack. A flood must be stopped before it reaches a function,
  because every request that reaches one already costs us.
- **Request id on cached answers:** a cached response carries the `x-request-id` of the request
  that filled the cache, so that id matches no log line for the later hits. Fine for debugging
  real failures, because errors are never cached.

Tests: `public-cache-headers.test.ts` (the four routes send the header; a 404 and a 400 do not),
`database-unavailable.test.ts` (the classifier, including what must NOT match),
`route-handler.test.ts` (503 + `Retry-After` + generic body; other DB errors stay 500),
`dbClient.test.ts` (timeout and pool size).

Not checked yet: the cache headers in a real Vercel deployment (`curl -I` twice and look for a
cache HIT), and a 503 under a real pool exhaustion.

### Phase 8: Later, with their features (deferred)

Not work to do now: these routes don't exist yet. Each one is a reminder for when it is built.

- Poll vote and Stripe checkout: pick a policy in their `route()` call (for example
  `rateLimit: "user-write"`). The types and the coverage test make forgetting impossible.
- Stripe webhook: not limited by IP (Stripe calls in bursts from a few addresses). Add its path
  to `UNLIMITED_PATHS` in `global-rate-limit.ts` and verify the Stripe signature instead.
- SSE notifications: the open-connection counter (section 7), built with the notifications
  feature.
- Optional `search-ip` for `GET /api/events?search=`, only if search proves slow.

### After it's done

- Verify each phase against section 2.
- Mark BE-7 rate limiting in `docs/requirements-catalog.md` and `docs/remaining-work.md`.
