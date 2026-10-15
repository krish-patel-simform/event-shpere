---
name: cms-integration
description: Headless CMS integration for EventSphere (Contentful or Hygraph preferred, Strapi allowed): typed and Zod-parsed content, content types for speakers, event announcements, blog articles and session content, linking CMS entries to database rows by slug, caching with use cache and on-demand revalidation via a secret-protected webhook, fallbacks, and no hardcoded content. Use for speaker directory/profile, any CMS-driven content, revalidation, or when tempted to hardcode copy or data.
---

# CMS integration

Serves: CMS-1, CMS-2, CMS-3, SPK-1, SPK-2, DET-1, NOTIF-6, ERR-4.
Related: `zod-validation`, `database-drizzle` (slug links), `api-design` (`/api/revalidate`), `backend-security`, `testing` (mock CMS).

> Pick the CMS in the CMS-1 explain step and record it in `docs/` (decision log). This skill is written for **Contentful** (default recommendation: simple REST/SDK, free tier). For Hygraph the content model is the same but the client is GraphQL; for Strapi it is REST with `populate`. Verify the chosen SDK's current API (`contentful` package, `createClient`, `getEntries`) in its docs; say so if unsure.

## Purpose
All editorial content (speakers, announcements content, blog articles, session content) comes from the CMS, is validated at the boundary, and is cached yet refreshable without a redeploy.

## Content model (CMS-2)
| Content type | Key fields | Linked to DB by |
| --- | --- | --- |
| `speaker` | slug*, name, designation, company, photo (asset), bio (rich text), expertise[], social links (linkedin, x, github, website) | `event_sessions.speakerSlug` |
| `sessionContent` | slug*, title, summary/body (rich text), resources/links | `event_sessions.cmsSlug` |
| `eventAnnouncement` | slug*, title, body, eventSlug, publishDate | `events.slug` (content; the **log + SSE fan-out** is in Postgres, see `realtime-sse`) |
| `blogArticle` | slug*, title, excerpt, body, author, coverImage, tags[], publishedAt | none (standalone) |

CMS owns **editorial content**; Postgres owns **transactional/schedule data** (times, rooms, seats, prices). A session row stores times and the slugs; the page joins them at render time. Missing CMS entry → graceful fallback (show the DB title and "Speaker details coming soon"), never crash (ERR-4).

## MUST
- Client in `features/cms/server/client.ts` (`import "server-only"`, tokens from `env`). All reads go through `features/cms/server/queries.ts` (`getSpeakers()`, `getSpeakerBySlug(slug)`, `getSessionContent(slug)`, `getAnnouncements(eventSlug)`, `getBlogArticles()`).
- **Zod-parse every CMS response** (`speakerSchema`, `sessionContentSchema`, …) and map to our own DTOs (flatten rich-text to a safe renderable structure, image URL + dimensions + alt, ISO dates). Invalid entries are logged (Sentry, with the entry id) and skipped, not rendered raw.
- **Caching**: with Cache Components, wrap read functions with `"use cache"` + `cacheLife("hours")` (or a custom profile) + `cacheTag("speakers")` / `cacheTag(`speaker:${slug}`)`. These functions use no cookies/headers. Public CMS pages (speakers) can be prerendered.
- **On-demand revalidation (CMS-3)**: CMS webhook (publish/unpublish) → `POST /api/revalidate` with a secret header; verify with timing-safe compare; validate the payload with Zod; call `revalidateTag("speakers", "max")` (Next 16 requires the second argument; read `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidateTag.md`) and the specific `speaker:<slug>` tag. Return `200`. Add a README step to configure the webhook in the CMS.
- **No hardcoded content** anywhere (speaker names, bios, announcements, blog text, even fallback marketing copy beyond generic UI labels). Seed data for the DB references CMS slugs that exist in the CMS space; keep a `docs/cms-content.md` listing the sample entries to create (or a script to import them).
- Rich text: render via the CMS's renderer with an allow-list; images via `next/image` (add the CMS image host to `images.remotePatterns`); always include `alt` from the CMS.
- Speakers list (SPK-1): photo, name, designation, company; profile (SPK-2): bio, social links, expertise, **sessions** (query DB sessions by `speakerSlug`, show title/time/event) → join in a server component or service (`speakers` feature depends on `event-details` through its `index.ts`).
- Fallbacks: CMS down → serve cached/stale content; if none, an error state with retry. Never block the whole event page because the CMS failed (use `<Suspense>` + error boundary around CMS sections).

## MUST NOT
- No CMS tokens in client code (only server reads; use the Delivery/Preview tokens appropriately, never the management token).
- No rendering unvalidated CMS JSON; no `dangerouslySetInnerHTML` of CMS HTML without sanitizing.
- No duplicating editorial content into Postgres (store slugs only).
- No revalidate route without a secret; no `revalidateTag` with a single argument.

## Procedure
1. Create content types + sample entries in the CMS. 2. Env vars + client. 3. Zod schemas + mappers + tests with fixtures. 4. Cached queries with tags. 5. Pages (speakers list/profile, session detail extras). 6. Revalidate route + CMS webhook. 7. Tests: mapper/schema (valid/invalid), page fallback when entry missing (MSW or module mock).

## Example: cached speaker query (CMS-1, SPK-1)
```ts
export async function getSpeakers(): Promise<SpeakerDto[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("speakers");
  const entries = await cms.getEntries({ content_type: "speaker", order: ["fields.name"] });
  return parseEntries(speakerEntrySchema, entries.items).map(toSpeakerDto);   // invalid ones logged + skipped
}
```
Webhook: `POST /api/revalidate` → `{ type: "speaker", slug }` → `revalidateTag("speakers","max"); revalidateTag(`speaker:${slug}`,"max")`.

## Common mistakes
- Forgetting to add the CMS image host in `next.config.ts` (images 400).
- Calling `revalidateTag("speakers")` (deprecated one-arg form).
- Putting times/prices in the CMS (they belong to transactional data).
- Letting one malformed entry crash the whole list.
- Unpublished/draft content leaking via the wrong token.

## Final checklist
- [ ] Reads server-only, Zod-parsed, mapped to DTOs; invalid entries handled.
- [ ] `use cache` + tags + `cacheLife`; revalidation route secret-protected and tested.
- [ ] No hardcoded content; fallbacks for missing/failed CMS data.
- [ ] CMS ↔ DB linked by slug only; images/alt/host configured.
- [ ] Docs list content types and the webhook setup.
