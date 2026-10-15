---
name: nextjs-project-structure
description: Folder layout, feature-module anatomy, import boundaries, route groups, server vs client components, server-only code, naming, path aliases and barrel rules for EventSphere (Next.js 16 App Router, src/features/<feature>, src/core). Use when creating or moving files, adding a new feature module, deciding where code belongs, fixing an import-boundary violation, or setting up aliases and the project skeleton.
---

# Next.js project structure

Serves: SETUP-1, SETUP-4, BE-5, STATE-1. Full tree: [references/folder-tree.md](references/folder-tree.md).
Related skills: `backend-architecture` (layers), `database-drizzle` (schema files), `state-management`, `component-development`.

## Purpose
One predictable place for every piece of code, so a feature can be understood, tested and reviewed in isolation, and so the layering (route → service → repository) can be checked by lint rules.

## MUST
- Put **everything except routes** under `src/`. `src/app/` holds only routing files (`page.tsx`, `layout.tsx`, `route.ts`, `error.tsx`, `loading.tsx`, `manifest.ts`, `sw.ts`) and stays **thin**: parse params, call a feature's public API, render a feature component.
- Organise by **feature**: `src/features/<feature>/` with `api/ components/ hooks/ schemas/ server/ store/ types/ utils/ __tests__/ index.ts`. Create only the sub-folders a feature actually needs.
- Features: `auth, profile, events, event-details, registrations, payments, agenda, speakers, cms, polls, notifications, announcements, dashboard, organizer, offline`.
- Shared code lives in `src/core`: `db/` (client, schema barrel, transaction helper, drizzle config), `auth/` (Auth.js config, guards), `http/` (route wrapper, envelope, errors, logger), `store/` (store factory, baseApi, typed hooks), `ui/` (design-system components), `config/env.ts` (Zod-validated env), plus `lib/` for tiny pure helpers.
- A feature may import from `@/core/*` and from **another feature's `index.ts` only** (`@/features/events`, never `@/features/events/server/repository`). `core` must never import from a feature.
- Everything in `server/` (repository, service, dto), `core/db/client.ts` and the server half of `core/auth` begins with `import "server-only";`. **Exception:** `server/db/schema.ts` holds pure table definitions (no connection) and is not marked `server-only`, so Zod schemas can derive from it (see `zod-validation`); nothing else in `server/` may be imported by client code.
- The feature `index.ts` exports **client-safe** things only (components, hooks, types, Zod schemas, RTK endpoints). Server code is exported from a separate `server.ts` barrel at the feature root (`@/features/events/server` → `server/index.ts`) that is imported **only** from `app/**/route.ts`, server components and other features' server code.
- Default to **Server Components**. Add `"use client"` only at the leaves that need state, effects, browser APIs, RHK forms, Redux, ECharts, dnd-kit, EventSource.
- Route groups: `(public)` guest pages (events list/detail, speakers, login/signup live in `(auth)`), `(user)` pages needing `USER`, `(organizer)` pages needing `ORGANIZER`. Groups do not affect URLs. Authorization is **still** checked server-side (see `auth-roles`); the group + `proxy.ts` only give early redirects.
- Names: folders `kebab-case`; components `PascalCase.tsx`; hooks `useThing.ts`; Zod schemas `thing.schema.ts` exporting `thingSchema` and `type Thing`; server files `service.ts`, `repository.ts`, `dto.ts`; tests `thing.test.ts(x)` next to the code in `__tests__/`.
- Path aliases: `@/*` → `src/*` (tsconfig `paths`; Jest `moduleNameMapper`). Update tsconfig when `app/` moves to `src/app/` (SETUP-1).

## MUST NOT
- No deep imports into another feature, no circular feature dependencies (if A and B need each other, extract the shared piece to `core` or make one depend on the other's `index.ts`).
- No `server/` code reachable from a client component (the build will fail on `server-only`; treat that as a boundary bug, not something to silence).
- No business logic, DB access or Zod schemas defined inline in `app/` files.
- No `export *` barrels that mix server and client code; no barrel inside `core/ui` that pulls the entire kit into every page without need (prefer per-component imports if bundle size suffers).
- Do not use `middleware.ts` (renamed `proxy.ts` in Next 16) or route segment configs that Cache Components rejects: check `node_modules/next/dist/docs/01-app/` first.

## Procedure: add a feature module
1. Check the catalog IDs and dependencies (`/explain-req`).
2. Create `src/features/<feature>/` with only needed folders and an empty `index.ts`.
3. Server first: `server/db/schema.ts` (Drizzle tables) → export from `src/core/db/schema.ts` barrel → `pnpm db:generate` → repository → service → DTO mapper (see `database-drizzle`, `backend-architecture`).
4. `schemas/`: Zod request/response/form schemas (see `zod-validation`).
5. `app/api/**/route.ts`: thin handler using the `src/core/http` wrapper (see `api-design`).
6. `api/`: RTK Query endpoints via `baseApi.injectEndpoints` (see `api-integration`).
7. `components/`, `hooks/`, then the thin `app/(group)/.../page.tsx`.
8. `__tests__/` for each layer (see `testing`). Export the public surface from `index.ts`.

## Example: events feature
```
src/features/events/
  api/eventsApi.ts            # injectEndpoints: listEvents, getEvent
  components/EventCard.tsx    # DISC-1
  components/EventFilters.tsx # DISC-3 (client; URL search params)
  hooks/useEventFilters.ts
  schemas/event.schema.ts     # eventListQuerySchema, eventDtoSchema, eventListResponseSchema
  server/db/schema.ts         # events table, event_type enum
  server/repository.ts        # listEvents(filters, tx?) with indexed queries
  server/service.ts           # createEventsService({ eventsRepo })
  server/dto.ts               # toEventDto(row)
  server/index.ts             # server-only barrel
  __tests__/service.test.ts
  index.ts                    # EventCard, useEventFilters, eventsApi hooks, types
src/app/(public)/events/page.tsx          # thin: reads searchParams → <EventList/>
src/app/api/events/route.ts               # GET: parse query → eventsService.list → { data, meta }
```
`(public)/events/page.tsx` imports `EventCard` from `@/features/events`; it never imports `server/repository`.

## Common mistakes
- Putting the Drizzle schema in `core/db` instead of the feature (only the **barrel** lives in core).
- Importing `@/features/registrations/server/service` from the `events` feature (use the other feature's `server` barrel, and only from server code).
- Adding `"use client"` to a page just to use one hook (extract a small client component instead).
- Forgetting that `params`, `searchParams`, `cookies()`, `headers()` are async in this Next version.
- Letting a component read `process.env.*` (use `core/config/env.ts`; only `NEXT_PUBLIC_*` may reach the client).

## Final checklist
- [ ] File is in the right feature/core folder; imports follow the boundary rules.
- [ ] `server/` files start with `import "server-only"`; client barrel exports no server code.
- [ ] `app/` files are thin; no inline queries or business rules.
- [ ] Names follow the conventions above; tests sit in `__tests__/`.
- [ ] No deep cross-feature imports (lint rule `no-restricted-imports` / `eslint-plugin-boundaries` enforces this once SETUP-1 is done).
