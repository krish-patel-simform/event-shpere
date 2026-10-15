---
name: api-integration
description: Client-side API consumption in EventSphere with RTK Query: one baseApi with injectEndpoints per feature, Zod-parsing every response (failures reported to Sentry as typed errors), validating request bodies before sending, tags and invalidation, optimistic updates with rollback (agenda, votes), error normalization, 401 handling, and when Server Components call services directly instead. Use when writing or changing anything in features/*/api, baseApi, hooks that fetch data, or caching/invalidation behavior.
---

# API integration (RTK Query + Zod)

Serves: SETUP-4, STATE-1, ERR-1, ERR-3, MON-3, DISC-2, DISC-3, DISC-4, AGD-1, AGD-2, AGD-3, POLL-1, POLL-2, DASH-8.
Related: `api-design` (the contract), `zod-validation`, `state-management`, `error-handling-monitoring`.

## Purpose
Every byte that comes back from `/api/*` is validated by the same Zod schema the server used, so the UI never sees an unexpected shape, and every failure becomes a typed, user-friendly, monitored error.

## MUST
- One `baseApi` in `src/core/store/baseApi.ts`: `createApi({ reducerPath: "api", baseQuery: baseQueryWithGuards, tagTypes: [...], endpoints: () => ({}) })`. Features add endpoints with `baseApi.injectEndpoints({ endpoints: (build) => ({...}) })` in `features/<f>/api/<f>Api.ts` and export the generated hooks via the feature `index.ts`.
- `baseQueryWithGuards` wraps `fetchBaseQuery({ baseUrl: "/api" })` and: unwraps the `{ data }` envelope; normalizes errors to `ApiError { status, code, message, details?, requestId? }`; on `401` dispatches `authSlice.sessionExpired` and redirects to login (once); on network failure (`FETCH_ERROR`) returns `code: "NETWORK"` (drives the offline banner, ERR-3); reports **5xx, network and schema failures** to Sentry (`Sentry.captureException` with route + requestId, no PII); does **not** report expected 4xx (400/401/403/404/409).
- **Parse responses with Zod** in `transformResponse` (or `queryFn`): `schema.parse(raw)`; a `ZodError` becomes `ApiError { code: "INVALID_RESPONSE" }` and is sent to Sentry.
- **Validate request bodies/params before sending** (`createRegistration` → `registerRequestSchema.parse(arg)`); forms already validated with React Hook Form + the same schema.
- Use the shared schemas from `features/<f>/schemas` (the server imports the same files): the contract has one definition.
- Tags: `providesTags` on reads (`{ type: "Event", id }`, `"Event" LIST`), `invalidatesTags` on writes (registering invalidates `Registration` LIST, `Event` id so seats update). Keep tag types in one list in `baseApi`.
- **Optimistic updates with rollback** for snappy interactions: agenda add/remove/reorder, bookmark toggle, vote. Use `onQueryStarted` with `api.util.updateQueryData` and `patchResult.undo()` on failure; then toast the error. Reorder sends the full ordered id list (server rewrites positions in one transaction).
- Lists/filters live in the **URL** (`searchParams`), and the hook receives the parsed query object (`useListEventsQuery(query)`); debounce `q` (≈ 300 ms).
- `keepUnusedDataFor`, `refetchOnFocus`/`refetchOnReconnect` (call `setupListeners(store.dispatch)`) tuned per endpoint; dashboard supports manual **refresh** (`refetch`) and optional `pollingInterval` (DASH-8).
- **Server Components**: for public, SEO-relevant, first-paint data (event list/detail, speakers) call the **service directly** (server barrel) instead of HTTP to yourself; hydrate RTK Query only when a client component needs to refetch/mutate. Do not `fetch("/api/...")` from a Server Component.

## MUST NOT
- No `fetch`/`axios` in components for app APIs (always RTK Query endpoints); no `useEffect` fetching.
- No casting responses (`as EventDto`); no `any`.
- No copying server data into Redux slices (RTK Query is the cache; slices are for client state).
- No swallowing errors: every query shows error UI, every mutation shows a toast/inline error.
- No catching a Zod failure and returning partial data silently.

## Procedure: add an endpoint
1. Schemas exist (`request`, `response`). 2. `build.query/mutation` with `transformResponse` parse. 3. Tags. 4. Optimistic update if it's an interaction users expect to be instant. 5. Use hook in a component with loading/empty/error states (`ui-implementation`). 6. Test with MSW (`testing`).

## Example: events list endpoint (DISC-2..4)
```ts
export const eventsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listEvents: build.query<EventListResponse, EventListQuery>({
      query: (q) => ({ url: "/events", params: eventListQuerySchema.parse(q) }),
      transformResponse: (raw: unknown) => parseOrThrow(eventListResponseSchema, raw), // -> ApiError INVALID_RESPONSE
      providesTags: (res) => [{ type: "Event", id: "LIST" }, ...(res?.data ?? []).map((e) => ({ type: "Event" as const, id: e.id }))],
    }),
  }),
});
export const { useListEventsQuery } = eventsApi;
```
Optimistic agenda reorder (AGD-3): in `onQueryStarted`, `updateQueryData("getAgenda", undefined, (draft) => reorder(draft, ids))`; `try { await queryFulfilled } catch { patch.undo() }`.

## Common mistakes
- Forgetting to unwrap `{ data }` (shape mismatch → everything parses to INVALID_RESPONSE).
- Invalidating too broadly (refetch storms) or too narrowly (stale seat counts).
- Optimistic update without rollback; double toasts on failure.
- Sending dates as `Date` objects instead of ISO strings; `undefined` params serialized as "undefined".
- Reporting every 404/409 to Sentry (noise).

## Final checklist
- [ ] Endpoint injected into `baseApi`; hooks exported from `index.ts`.
- [ ] Response parsed with Zod; request validated; typed `ApiError`.
- [ ] Tags correct; optimistic update has rollback.
- [ ] 401, network and 5xx paths handled and monitored.
- [ ] Loading/empty/error UI + MSW test.
