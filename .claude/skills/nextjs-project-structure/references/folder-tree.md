# EventSphere folder tree (target structure)

Created progressively by the milestone weeks; nothing here exists until its requirement is built.

```
event-sphere/
├─ docker-compose.yml                 # BE-1 local Postgres (+ test DB)
├─ drizzle.config.ts                  # BE-2 schema: src/core/db/schema.ts, out: ./drizzle
├─ drizzle/                           # generated SQL migrations (committed)
├─ sentry.*.config.ts / instrumentation.ts / instrumentation-client.ts   # MON-*
├─ next.config.ts                     # cacheComponents, Sentry, Serwist
├─ jest.config.ts  playwright.config.ts  sonar-project.properties
├─ vercel.json                        # cron schedule (NOTIF-1)
├─ .github/workflows/ci.yml           # SETUP-3 (Postgres service)
├─ public/                            # icons, offline fallback assets
├─ scripts/seed.ts                    # BE-3
├─ docs/                              # poc-spec, catalog, architecture, API collection, test report
└─ src/
   ├─ proxy.ts                        # Next 16 "middleware": early redirects only (not authz)
   ├─ app/
   │  ├─ layout.tsx  global-error.tsx  manifest.ts  sw.ts  not-found.tsx
   │  ├─ (public)/                    # Guest-accessible
   │  │  ├─ page.tsx                  # landing
   │  │  ├─ events/page.tsx           # DISC-1..4
   │  │  ├─ events/[slug]/page.tsx    # DET-1, DET-2
   │  │  ├─ speakers/page.tsx         # SPK-1
   │  │  └─ speakers/[slug]/page.tsx  # SPK-2
   │  ├─ (auth)/                      # login, signup, forgot-password, reset-password
   │  ├─ (user)/                      # needs USER
   │  │  ├─ profile/page.tsx
   │  │  ├─ my-events/page.tsx        # REG-3
   │  │  ├─ agenda/page.tsx           # AGD-*
   │  │  ├─ transactions/page.tsx     # REG-7
   │  │  ├─ registrations/confirmation/page.tsx  # REG-6
   │  │  ├─ events/[slug]/polls/page.tsx         # POLL-*
   │  │  └─ notifications/page.tsx    # NOTIF-7
   │  ├─ (organizer)/                 # needs ORGANIZER
   │  │  └─ organizer/{events,sessions,announcements,polls,dashboard}/...
   │  └─ api/
   │     ├─ auth/[...nextauth]/route.ts   auth/signup  auth/forgot-password  auth/reset-password
   │     ├─ events/route.ts  events/[eventId]/route.ts  events/[eventId]/sessions/route.ts
   │     ├─ events/[eventId]/registrations/route.ts  events/[eventId]/polls/route.ts
   │     ├─ polls/[pollId]/votes/route.ts  polls/[pollId]/results/route.ts
   │     ├─ speakers/...  (reads CMS)
   │     ├─ me/route.ts  me/avatar  me/password  me/registrations[/id]  me/transactions
   │     ├─ me/agenda[/order|/sessionId]  me/bookmarks  me/notifications[/read]
   │     ├─ notifications/stream/route.ts     # SSE
   │     ├─ organizer/events[/id]  organizer/events/[id]/sessions  organizer/events/[id]/announcements
   │     ├─ organizer/polls  organizer/analytics/{summary,ticket-sales,attendance,poll-participation,session-popularity}
   │     ├─ webhooks/stripe/route.ts          # signature-verified, idempotent
   │     ├─ revalidate/route.ts               # CMS webhook (secret)
   │     └─ cron/reminders/route.ts           # Vercel Cron (CRON_SECRET)
   ├─ core/
   │  ├─ config/env.ts             # Zod-validated env; server vs public split
   │  ├─ db/{client.ts,schema.ts,transaction.ts,types.ts}
   │  ├─ auth/{config.ts,guards.ts,password.ts,session.d.ts}
   │  ├─ http/{route-handler.ts,envelope.ts,errors.ts,logger.ts,rate-limit.ts,request-id.ts}
   │  ├─ store/{store.ts,baseApi.ts,hooks.ts,StoreProvider.tsx}
   │  ├─ ui/                       # Button, Input, Modal, Toast, Skeleton, EmptyState, ErrorState ...
   │  └─ lib/                      # formatDate, formatPrice, cn ...
   └─ features/
      ├─ auth/          ├─ profile/        ├─ events/        ├─ event-details/
      ├─ registrations/ ├─ payments/       ├─ agenda/        ├─ speakers/
      ├─ cms/           ├─ polls/          ├─ notifications/ ├─ announcements/
      ├─ dashboard/     ├─ organizer/      └─ offline/
         # each: api/ components/ hooks/ schemas/ server/{service,repository,dto,db/schema}.ts store/ types/ utils/ __tests__/ index.ts
```

## Dependency direction

```
app (routes/pages)  →  features/<x>/index.ts (client)   |  features/<x>/server (server)
features/<x>        →  core/*  and  features/<y>/index.ts
core/*              →  (nothing from features)
route → service → repository → core/db        (never backwards, never skipping a layer)
```
