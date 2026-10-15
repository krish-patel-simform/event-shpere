---
description: Generate or update the API collection (Postman or Bruno) from the route handlers and Zod schemas
argument-hint: [postman|bruno]
allowed-tools: Read, Grep, Glob, Write, Edit, Bash(git status*), Bash(git diff*)
---

Generate or update the API collection for the DEL-1 deliverable, following the `documentation-deliverables` and `api-design` skills. Preferred format from me (may be empty): $ARGUMENTS

1. **Format**: if `$ARGUMENTS` is empty and a collection already exists under `docs/api/`, keep that format; if neither, ask me once: Postman or Bruno (record the answer in `docs/decisions/`). Postman → `docs/api/eventsphere.postman_collection.json` (+ environment file); Bruno → `docs/api/bruno/` (`bruno.json`, environments, one `.bru` per request).
2. **Discover**: list every `src/app/api/**/route.ts`; for each exported method read: auth requirement (`PUBLIC|USER|ORGANIZER`/secret/signature), params, query schema, body schema, response schema, status codes. Use the Zod schemas as the source for example payloads (valid values, realistic EventSphere data).
3. **Generate** (folders per module: Auth, Events, Registrations, Payments, Agenda, Speakers, Polls, Notifications, Organizer, Analytics, System/Webhooks):
   - Variables: `baseUrl` (default `http://localhost:3000`), session handling (a login request that stores the Auth.js session cookie and CSRF token as needed; verify how Auth.js credentials sign-in works from a REST client in the Auth.js docs and document the steps instead of guessing).
   - Per request: description (purpose + requirement ID), auth note, example body, saved example responses (success and key errors in the `{ data }` / `{ error }` envelope), tests asserting status code and envelope shape.
   - Webhook/cron/revalidate requests documented with their secret/signature requirements (Stripe signature cannot be hand-made: link to the Stripe CLI approach).
4. **Update mode**: preserve manual edits where possible; report added / changed / removed endpoints compared with the previous collection and flag routes missing from it.
5. Validate JSON syntax, make sure no real secrets or personal data are present (placeholders only), and summarize what changed. Remind me to re-run this whenever a route or schema changes.
