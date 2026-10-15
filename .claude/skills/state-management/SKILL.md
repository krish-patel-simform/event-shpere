---
name: state-management
description: State rules for EventSphere: Redux Toolkit slices for the state required by the spec (auth, profile, events, registrations, notifications, polling, dashboard), RTK Query for server data, local component state, React Hook Form for forms, URL search params for filters, per-request store for Next App Router, typed hooks, no derived data in state, and slice testing. Use when creating a slice, deciding where state lives, wiring the store/provider, or fixing prop drilling.
---

# State management

Serves: STATE-1, SETUP-4, TEST-1, AUTH-9, NOTIF-5, NOTIF-7, POLL-2, DASH-6, DASH-8.
Related: `api-integration`, `component-development`, `ui-implementation`, `auth-roles`, `realtime-sse`.

## Purpose
Put each piece of state in the one place designed for it, satisfy the spec's Redux Toolkit requirement (§6) without turning Redux into a copy of the server, and avoid prop drilling.

## Where does state live? (decision table)
| State | Home | Example |
| --- | --- | --- |
| Server data (cached, refetchable) | **RTK Query** (`baseApi`) | event list, event detail, my registrations, agenda, poll results, analytics |
| Client-only, app-wide | **Redux slice** | auth status, notification inbox/unread count (fed by SSE), poll draft/selection + live results updates, dashboard filters (date range) |
| Filters/sort/pagination/search | **URL search params** | `?q=ai&category=tech&price=free&sort=date&page=2` (shareable, back button works) |
| Form fields | **React Hook Form** (+ Zod resolver) | signup, profile, event creation |
| Ephemeral UI | `useState`/`useReducer` in the component | modal open, hover, accordion |
| Derived values | **Selectors / computed in render** | unread count, "is full", sorted list |

## Slices required by spec §6 (STATE-1)
| Spec item | Where in Redux | Notes |
| --- | --- | --- |
| Authentication | `authSlice` (`status`, `user`) | hydrated from the server session; cleared on logout/401 |
| User profile | `profile` data via RTK Query + `authSlice.user` for header display; `profileSlice` only for client-only UI (e.g. avatar upload progress) | update `authSlice.user` after a successful `PATCH /api/me` |
| Events | RTK Query endpoints (`eventsApi`) + `eventsSlice` for UI state (view mode grid/list, last viewed ids for offline hints) | the **cache is the store of events** |
| Registrations | RTK Query (`registrationsApi`) + `registrationsSlice` for the pending-checkout state | |
| Notifications | `notificationsSlice` (entity adapter: `items`, `unreadCount`, `connection: "connecting"|"open"|"closed"`) | SSE hook dispatches `notificationReceived`; initial list from RTK Query |
| Polling data | `pollsSlice` (`selections` per poll, `liveResults` by pollId) | votes themselves through RTK Query mutation |
| Dashboard data | RTK Query (`dashboardApi`) + `dashboardSlice` (`dateRange`, `eventId`, `autoRefresh`) | filter state in slice → query args |

"Managed by Redux Toolkit" = slices **and** RTK Query: both are in the one store.

## MUST
- Store factory `makeStore()` in `core/store/store.ts` + `StoreProvider` (client component, creates the store once per request/session with `useRef`/`useState`); never a module-level singleton on the server (it would leak state between users). Typed hooks `useAppDispatch`, `useAppSelector`, `useAppStore` via `.withTypes<...>()` (RTK ≥ 2).
- Slices in `features/<f>/store/<f>Slice.ts`; the root reducer combines slice reducers + `baseApi.reducer`; middleware adds `baseApi.middleware`; `setupListeners` once on the client.
- Keep state **normalized and minimal**; compute derived data with selectors (`createSelector`) or in render. Use `createEntityAdapter` for lists you mutate (notifications).
- Actions describe events (`notificationReceived`, `sessionExpired`), not setters. Extra reducers react to RTK Query matchers where needed (e.g. `logout` resets slices; `baseApi.util.resetApiState()`).
- Prop drilling > 2 levels → use a hook (`useAppSelector`, a feature hook) or composition (children/slots), not a new context by reflex.
- Slices are pure and serializable (no `Date`, class instances, functions: use ISO strings).
- Test slices (TEST-1): reducer + selector tests with plain Jest, no React.

## MUST NOT
- Don't store server responses in a slice when RTK Query already caches them.
- Don't keep form field values or filter state in Redux.
- Don't put the store in a Server Component or read it there; server components read the DB through services.
- Don't mutate outside Immer reducers; don't store derived/duplicated data (`count` next to `items`).
- Don't create a slice per component.

## Procedure: add state
1. Ask the decision table. 2. If a slice: define `initialState` (typed), reducers, selectors; export from the feature `index.ts`; register in `core/store`. 3. Use typed hooks in components. 4. Test the reducer/selectors.

## Example: notifications (NOTIF-5, NOTIF-7)
```ts
const adapter = createEntityAdapter<NotificationDto>({ sortComparer: (a, b) => b.createdAt.localeCompare(a.createdAt) });
const notificationsSlice = createSlice({
  name: "notifications",
  initialState: adapter.getInitialState({ connection: "closed" as "connecting" | "open" | "closed" }),
  reducers: {
    notificationReceived: adapter.upsertOne,
    notificationsLoaded: adapter.setMany,
    markedRead: (s, a: PayloadAction<string[]>) => { a.payload.forEach((id) => s.entities[id] && (s.entities[id]!.readAt ??= new Date().toISOString())); },
    connectionChanged: (s, a: PayloadAction<typeof s.connection>) => { s.connection = a.payload; },
  },
});
export const selectUnreadCount = createSelector(adapter.getSelectors().selectAll, (all) => all.filter((n) => !n.readAt).length);
```

## Common mistakes
- Module-level `configureStore()` shared across requests.
- Putting the whole `event` list in a slice and also in RTK Query → two sources of truth.
- Non-serializable values in actions (RTK warns).
- Resetting only the slices on logout and forgetting the RTK Query cache.

## Final checklist
- [ ] State placed per the decision table; no duplicate sources of truth.
- [ ] Slice typed, normalized, serializable, with selectors.
- [ ] Store per request; typed hooks used.
- [ ] Logout resets slices and API cache.
- [ ] Reducer/selector tests exist.
