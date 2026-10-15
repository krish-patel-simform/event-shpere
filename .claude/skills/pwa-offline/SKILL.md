---
name: pwa-offline
description: Progressive Web App and offline support for EventSphere: web app manifest, Serwist service worker, caching strategies per resource type (assets cache-first, viewed event pages stale-while-revalidate, schedules network-first with fallback, payments/auth/polls/writes network-only), offline banner and fallback page. Use for installability, service worker, caching rules, offline behavior, or when a feature must degrade gracefully without network.
---

# PWA & offline

Serves: PWA-1, PWA-2, PWA-3, PWA-4, PWA-5, ERR-3, NOTIF-5.
Related: `ui-implementation` (offline banner), `error-handling-monitoring` (network errors), `api-integration`, `realtime-sse`, `payments-stripe`.

> Serwist's Next.js integration changes often, and Next.js 16 uses Turbopack by default. **Before wiring it, read the current Serwist docs (`@serwist/next` vs `@serwist/turbopack`) and `node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md`; if the webpack-based plugin is required, build with the webpack flag or use the Turbopack-compatible package. Do not guess the config.** Also see Next's `offline-support.md` guide (experimental `useOffline`) as a complement for in-app retry UI, not a replacement for a service worker.

## Purpose
Installable app that keeps working for what the user already saw, tells the user when it's offline, and **never** serves stale data for things that must be live or secure.

## MUST
- **Manifest (PWA-1)**: `src/app/manifest.ts` (`MetadataRoute.Manifest`): `name`, `short_name`, `start_url: "/"`, `display: "standalone"`, `theme_color`, `background_color`, icons 192/512 (+ maskable) in `public/`. Served over HTTPS (Vercel). Verify installability in Chrome DevTools → Application and Lighthouse.
- **Service worker** (`src/app/sw.ts`, compiled to `public/sw.js` by Serwist): `new Serwist({ precacheEntries: self.__SW_MANIFEST, skipWaiting: true, clientsClaim: true, navigationPreload: true, runtimeCaching: [...], fallbacks: { entries: [{ url: "/~offline", matcher: ({ request }) => request.destination === "document" }] } })` then `serwist.addEventListeners()`. Register only in production builds (disable in dev to avoid stale-cache confusion). Add an update prompt ("New version available: Refresh").
- **Caching strategy table** (PWA-3..5):

| Resource | Strategy | Why |
| --- | --- | --- |
| `_next/static/*`, fonts, icons, banner/speaker images | **CacheFirst** (+ ExpirationPlugin: max entries/age) | immutable/hashed (PWA-3) |
| Viewed event detail pages `/events/[slug]` and their data | **StaleWhileRevalidate** | instant + fresh next time (PWA-5) |
| Schedules: `GET /api/events/[id]/sessions`, agenda `GET /api/me/agenda` | **NetworkFirst** (timeout ~3 s) with cache fallback | fresh when online, available offline (PWA-4) |
| Event list `GET /api/events` (viewed queries) | **NetworkFirst** / SWR with small cache | browse previously seen results |
| `POST/PUT/PATCH/DELETE` anything | **NetworkOnly** (no queueing of writes in this POC unless you opt into Background Sync) | correctness |
| `/api/auth/*`, `/api/me` (profile/password), payments, Stripe webhook, `/api/webhooks/*`, `/api/polls/*/votes`, poll results, `/api/notifications/stream` (SSE), `/api/organizer/*`, `/api/cron/*`, `/api/revalidate` | **NetworkOnly** | sensitive, live, or non-idempotent |
| Navigations (documents) without a cached copy | fallback page `/~offline` | graceful degradation |

- **Don't cache personalized data across users**: key caches by user or clear runtime caches on logout (`caches.delete(...)` via `postMessage` to the SW); never cache responses with `Set-Cookie`/auth-sensitive bodies beyond the schedule/agenda cases above, and only for the signed-in user.
- **Offline UX (PWA-2, ERR-3)**: `useOnlineStatus()` + banner "You're offline: showing saved data"; viewed-event pages render from cache; a dedicated offline page lists previously viewed events (store a small `recentlyViewed` list in `localStorage`/IndexedDB or the Redux `eventsSlice`); disable register/vote/payment buttons with an explanation; reconnect → refetch (`refetchOnReconnect`).
- Cache versioning/cleanup: Serwist precache revisions; `cleanupOutdatedCaches: true`; bump cache names when DTO shapes change (stale shape + Zod parse = `INVALID_RESPONSE`; the client treats that as "refresh needed").
- Test with DevTools Offline + Lighthouse PWA checks + a Playwright test using `context.setOffline(true)` after visiting an event page.

## MUST NOT
- No caching of auth, payment, vote, SSE or any mutation requests; no precaching of authenticated pages.
- No service worker in development by default; no `skipWaiting` surprises without the update prompt in production flows involving forms.
- No assuming iOS Safari parity (installability/background features differ); note it in docs.
- No custom SW code duplicating what Serwist strategies provide.

## Procedure
1. Manifest + icons. 2. Serwist setup (after reading its docs for the Turbopack/webpack question). 3. Runtime caching table implemented in `sw.ts`. 4. Offline fallback page + banner + recently-viewed list. 5. Logout cache clearing. 6. Manual DevTools verification + Playwright offline test + Lighthouse.

## Example: runtime caching entries (sketch: confirm against Serwist docs)
```ts
runtimeCaching: [
  { matcher: ({ url }) => url.pathname.startsWith("/api/notifications/stream"), handler: new NetworkOnly() },
  { matcher: ({ url, request }) => request.method === "GET" && /^\/api\/events\/[^/]+\/sessions$/.test(url.pathname),
    handler: new NetworkFirst({ cacheName: "schedules", networkTimeoutSeconds: 3,
      plugins: [new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 7 * 24 * 3600 })] }) },
  { matcher: ({ url }) => url.pathname.startsWith("/events/"), handler: new StaleWhileRevalidate({ cacheName: "event-pages" }) },
  ...defaultCache,
]
```
(Order matters: put NetworkOnly rules for sensitive/live routes **first**.)

## Common mistakes
- A broad `defaultCache`/catch-all rule above the NetworkOnly rules → caches login or votes.
- Serving a stale shell with a new API shape after deploy.
- Testing in dev where the SW is disabled and concluding "offline doesn't work".
- Forgetting maskable icons / 512 icon → not installable.
- Not clearing caches on logout on shared devices.

## Final checklist
- [ ] Manifest valid and installable; icons present.
- [ ] Strategy table implemented with sensitive routes NetworkOnly first.
- [ ] Offline page, banner, disabled writes, recently-viewed available offline.
- [ ] Logout clears runtime caches; update prompt present.
- [ ] Verified with DevTools offline, Lighthouse, and a Playwright offline test.
