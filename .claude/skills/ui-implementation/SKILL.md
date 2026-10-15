---
name: ui-implementation
description: UI/UX rules for EventSphere pages: Tailwind design tokens, mobile-first layout, dark-mode readiness, loading/empty/error/success states, forms with inline errors and pending state, next/image, toasts and modals, offline banner, and Lighthouse 90+ targets. Use when styling, laying out pages, building forms, designing states, or doing a UI polish/accessibility pass.
---

# UI implementation (Tailwind, states, forms)

Serves: ERR-1, ERR-2, ERR-3, ERR-4, DISC-1, DISC-3, AUTH-1, AUTH-2, AUTH-3, BONUS-2, PWA-2.
Related: `component-development`, `error-handling-monitoring`, `api-integration`, `pwa-offline`. UI/UX is 10% of the grade; accessibility and states also feed code quality.

## Purpose
Consistent, responsive, accessible UI where no screen is ever blank, stuck, or silent about errors.

## MUST
- **Tailwind CSS v4 tokens**: define colors, radius, spacing, fonts as CSS variables / `@theme` in `src/app/globals.css` (brand, surface, text, border, success/warning/danger). Components use semantic tokens (`bg-surface`, `text-muted`) rather than raw hex, so **dark mode (BONUS-2)** is a variable swap (`@media (prefers-color-scheme: dark)` or a `.dark` class). Check the installed Tailwind setup (this repo uses Tailwind 4 with `@tailwindcss/turbopack`) before adding config.
- **Mobile-first**: base styles for 360 px, then `sm: md: lg:`; event grid 1 → 2 → 3 columns; filters in a drawer on mobile; tables become stacked cards; touch targets ≥ 44 px; no horizontal scroll; test at 360, 768, 1280.
- **Four states for every data view** (shared `core/ui` components):
  - **Loading**: skeletons that match the layout (`EventCardSkeleton`), no layout shift; `aria-busy`.
  - **Empty**: friendly message + next action ("No events match your filters" + *Clear filters*) (ERR-4).
  - **Error**: what happened in plain words + *Try again* (calls `refetch`) + request id for support when available; distinct messages for network (ERR-3), 403/404, and generic failures (ERR-1).
  - **Success/content**; for mutations, a toast ("Registered!") or inline confirmation.
- **Forms** (React Hook Form + `zodResolver`; ERR-2): label above input, helper text, **inline error under the field** (`aria-invalid`, `aria-describedby`), error summary focus on submit failure, submit button disabled + spinner while pending (`formState.isSubmitting`), server field errors mapped with `setError` from `ValidationError.details.fieldErrors`, generic server error in an `alert` region, `autocomplete` attributes (`email`, `current-password`, `new-password`), password show/hide.
- **Toasts** for non-blocking results (`role="status"`/`aria-live="polite"`), **modals/dialogs** only for confirmations (cancel registration, delete session) using the `<dialog>` element or an accessible library: focus trap, Esc closes, focus returns.
- **Offline banner** (PWA-2, ERR-3): `useOnlineStatus()` → persistent top banner "You're offline: showing saved data"; disable write actions with an explanatory tooltip.
- Images: `next/image` with `sizes`, intrinsic dimensions, `priority` only for the LCP banner; fonts via `next/font` (already used).
- **Performance/Lighthouse ≥ 90** (performance, accessibility, best practices, SEO): server-render list pages, stream with Suspense, lazy-load ECharts/dnd-kit/modals (`next/dynamic`), avoid layout shift, compress/size images, metadata per page (`generateMetadata`), semantic headings, sufficient contrast (4.5:1).
- Dates/prices formatted via shared helpers with locale + timezone clarity ("Sat, 14 Mar · 10:00 UTC+1").

## MUST NOT
- No blank screens, infinite spinners, or `console.error`-only failures.
- No color-only status; no placeholder-as-label; no disabled submit without explanation.
- No fixed pixel widths that break at 360 px; no hover-only interactions.
- No alert()/confirm().
- No custom styling duplicated across features (extend `core/ui`).

## Procedure: build a page
1. Sketch mobile layout first. 2. Compose from `core/ui` + feature components. 3. Add all four states. 4. Forms with inline validation and pending state. 5. Check keyboard path, focus order, contrast. 6. Run Lighthouse/axe; fix issues. 7. Add RTL tests for states and a Playwright path for the main journey.

## Example: events list page states (DISC-1..3)
`/events`: server component renders the shell + `<EventFilters/>` (client, URL params) + `<Suspense fallback={<EventGridSkeleton/>}><EventGrid query={query}/></Suspense>`. `EventGrid`: error → `<ErrorState onRetry>`; `data.length === 0` → `<EmptyState title="No events match" action={<ClearFiltersButton/>}/>`; else cards + pagination.

## Common mistakes
- Skeleton shapes that differ from final layout (layout shift).
- Showing validation errors only on submit, or only as a toast.
- Forgetting the empty state for "no sessions yet", "no notifications", "no transactions".
- Disabling zoom, tiny tap targets, low-contrast gray text.
- Importing ECharts/dnd-kit into the main bundle.

## Final checklist
- [ ] Mobile-first; tested at 360/768/1280; no horizontal scroll.
- [ ] Loading, empty, error, success all present and specific.
- [ ] Forms: inline errors, pending state, server errors mapped, a11y attributes.
- [ ] Tokens used (dark-mode ready); contrast OK; `next/image` + metadata.
- [ ] Offline banner wired; heavy libs lazy-loaded; Lighthouse ≥ 90.
