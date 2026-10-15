---
name: component-development
description: How to build React components in EventSphere: anatomy, typed props, composition, server vs client components, presentational vs container split, no business logic in components, accessibility basics, and React Testing Library tests. Use when creating or refactoring any component (EventCard, SessionList, PollCard, NotificationBell, forms) or its tests.
---

# Component development

Serves: DISC-1, DET-1, SPK-1, NOTIF-7, ERR-2, TEST-1, STATE-1.
Related: `ui-implementation` (visual/states), `state-management`, `api-integration`, `nextjs-project-structure`, `testing`.

## Purpose
Small, typed, accessible components with clear responsibilities that are easy to test and reuse.

## MUST
- **Anatomy** (one component per file, `PascalCase.tsx` in `features/<f>/components/`): imports → `type Props` → component → (small private helpers below). Named export, no default except pages. Props are an explicit typed object (`type EventCardProps = { event: EventDto; onRegister?: (id: string) => void }`); derive types from Zod (`EventDto`), not hand-written duplicates.
- **Server by default.** Make it a Client Component (`"use client"`) only if it uses state, effects, event handlers, browser APIs, Redux, RHF, ECharts, dnd-kit or `EventSource`. Push `"use client"` to the smallest leaf; pass server-fetched data down as serializable props; never import server-only code into a client component.
- **Presentational vs container**: presentational components take data + callbacks and render (`EventCard`, `SessionItem`); container components (or hooks) fetch/select/dispatch (`EventListContainer` using `useListEventsQuery`). Page files compose containers.
- **No business logic in components**: no price/seat rules, role checks as security, date-overlap logic. Put them in `utils/` (pure, tested) or the service. Components format and display (use `formatPrice(cents)`, `formatDateRange`).
- Compose with `children`/slots instead of boolean-prop explosions (`<Card><Card.Header/>…`), keep components under ~150 lines; split when a component has more than one reason to change.
- Lists: stable `key` = entity id; never array index for reorderable lists (agenda).
- Every data-driven component handles **loading, empty, error** (delegate to `ui` states, see `ui-implementation`).
- Accessibility: semantic elements (`button`, `a`, `nav`, `main`, `ul/li`, `time` with `dateTime`), labels for every input, visible focus, `aria-live` for toasts/notifications, `alt` on images (`""` if decorative), color not the only signal, keyboard operable (Enter/Space/Esc), touch targets ≥ 44 px.
- Images with `next/image` (explicit `width/height` or `fill` + `sizes`; remote hosts allowed in `next.config.ts`).
- Tests with React Testing Library + `@testing-library/user-event`: query by role/label/text, assert behavior not implementation; render with a `renderWithProviders` helper (store + router mocks).

## MUST NOT
- No `fetch` or Drizzle in components; no `useEffect` for derived state or data fetching.
- No prop drilling more than two levels (use selectors/hooks/composition).
- No inline styles for layout (Tailwind); no `any`; no non-null `!` to silence types.
- No `dangerouslySetInnerHTML` with CMS content unless sanitized.
- No click handlers on `div`/`span` (use `button`/`a`).

## Procedure
1. Define the props from the DTO types. 2. Write the presentational component with Tailwind + a11y. 3. Add states (loading/empty/error) in the container. 4. Hook into data (`api-integration`) or slice (`state-management`). 5. Write RTL tests: renders data, handles each state, user interaction, accessible names. 6. Export from the feature `index.ts` only if other features/pages need it.

## Example: EventCard (DISC-1)
```tsx
type EventCardProps = { event: EventDto };
export function EventCard({ event }: EventCardProps) {
  const soldOut = event.availableSeats === 0;
  return (
    <article className="overflow-hidden rounded-xl border bg-white shadow-sm">
      <Image src={event.bannerUrl} alt="" width={640} height={360} className="aspect-video w-full object-cover" />
      <div className="space-y-2 p-4">
        <p className="text-sm text-indigo-700">{event.category}</p>
        <h3 className="text-lg font-semibold"><Link href={`/events/${event.slug}`}>{event.title}</Link></h3>
        <p className="text-sm text-slate-600"><time dateTime={event.startsAt}>{formatDate(event.startsAt)}</time> · {event.location}</p>
        <p className="flex justify-between text-sm"><span>{formatPrice(event.priceCents, event.currency)}</span>
          <span aria-live="polite">{soldOut ? "Sold out" : `${event.availableSeats} seats left`}</span></p>
      </div>
    </article>
  );
}
```
Test: renders title as a link to `/events/<slug>`, shows "Free" for `priceCents: 0`, shows "Sold out" at 0 seats.

## Common mistakes
- Making the whole page a client component for one `onClick`.
- Re-deriving "sold out" in three components (put it in `utils/eventAvailability.ts`).
- Using `index` keys in sortable lists; forgetting `alt`; nested interactive elements (a button inside a link).
- Tests that assert CSS classes or internal state.

## Final checklist
- [ ] Typed props from Zod types; server/client choice justified.
- [ ] No business logic; helpers in `utils/` with tests.
- [ ] Loading/empty/error handled; keyboard + screen-reader friendly.
- [ ] `next/image` used; no raw HTML injection.
- [ ] RTL tests cover render, states, interaction.
