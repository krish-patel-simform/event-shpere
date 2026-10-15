---
name: testing
description: Testing strategy for EventSphere: Jest + React Testing Library for utilities, Redux slices and Zod/form validation; service unit tests with mocked repositories; repository and route integration tests against a test PostgreSQL database; Playwright E2E journeys (registration, login, event registration, poll participation, payment); factories, test DB reset, mocking Stripe/CMS/SSE, and generating the test report. Use when writing, fixing or planning tests, configuring Jest/Playwright/CI, or generating the test report.
---

# Testing

Serves: TEST-1, TEST-2, TEST-3, QUAL-1, SETUP-3, DEL-1, DOD-1.
Related: `backend-architecture` (injectable services), `database-drizzle`, `payments-stripe`, `cms-integration`, `realtime-sse`, `code-review-mentor`. Testing = 15% of the grade; Sonar coverage/quality gates depend on it.

> Next.js ships guides for Jest and Playwright in `node_modules/next/dist/docs/01-app/02-guides/testing/`. Read them before configuring (`next/jest`, async Server Components are better covered by E2E than by unit tests).

## Test pyramid for this project
| Layer | Tool | Scope | Req |
| --- | --- | --- | --- |
| Unit | Jest | utils (`formatPrice`, `findOverlaps`, `buildPieOption`), Zod schemas, Redux slices/selectors | TEST-1 |
| Component | Jest + RTL (+ user-event, MSW) | forms (validation messages, pending state), cards, states, notification bell | TEST-1, ERR-* |
| Service unit | Jest (node env) | business rules with **fake repositories** (seat check, ownership, poll limits, reset-token rules) | TEST-3 |
| Integration | Jest (node env) + **test Postgres** | repositories (constraints, transactions, aggregations) and route handlers end-to-end (auth → Zod → service → DB) | TEST-3 |
| E2E | Playwright | user registration, login, event registration, poll participation, payment flow (+ offline smoke) | TEST-2 |

## MUST
- **Config**: `jest.config.ts` with `next/jest`; projects: `jsdom` for components/slices, `node` for server code (`/** @jest-environment node */` or separate project); `moduleNameMapper` for `@/*`; coverage thresholds on `features/**` and `core/**` (not on `app/**` glue), `lcov` output for SonarCloud. Playwright: `playwright.config.ts` with `webServer` (`pnpm build && pnpm start` in CI), projects chromium (+ mobile viewport), `storageState` per role (user, organizer) created by a setup project.
- **Service tests**: build the service with `createXService({ ...fakeRepos })`; test each rule and error (`EVENT_FULL`, `ALREADY_REGISTERED`, `ForbiddenError` for foreign resources, poll `maxChoices`, reset token expired/used). Fakes are tiny in-memory objects typed against the repository interface; use `jest.fn()` for call assertions.
- **Integration tests** (DB): `DATABASE_URL_TEST` pointing at the dockerized `eventsphere_test` DB; `globalSetup` runs migrations (`drizzle-kit migrate` or `migrate()` from `drizzle-orm/.../migrator`); **reset between tests** with a helper that truncates all tables (`TRUNCATE ... RESTART IDENTITY CASCADE`) and **refuses to run unless the DB name ends with `_test`**; factories (`makeUser`, `makeEvent`, `makeSession`, `makePoll`) with sensible defaults via `@faker-js/faker` or hand-rolled. Test constraint behavior: unique registration, one ballot per user per poll, agenda reorder atomicity (concurrent requests with `Promise.all` for seat races).
- **Route tests**: call the exported handler with a `NextRequest`; stub the session guard (`jest.mock("@/core/auth/guards")` or inject actor) and assert status + envelope for 200/201/400/401/403/404/409/429.
- **Mocking boundaries**: Stripe via the `stripe-client` wrapper (`jest.mock`) and signed webhook fixtures (`stripe.webhooks.generateTestHeaderString`); CMS via module mock or MSW handlers returning fixtures (valid and malformed); SSE hook with a fake `EventSource` class; time with `jest.useFakeTimers()`; network in component tests with **MSW** (`http.get`, `HttpResponse.json`).
- **RTL style**: query by role/label/text, `userEvent`, assert visible behavior, `findBy*` for async; helper `renderWithProviders(ui, { preloadedState })`.
- **E2E**: seeded DB (`pnpm db:seed` against the test DB), stable selectors (`getByRole`, `getByLabel`, `data-testid` only when needed), one assertion-rich journey per spec item: (1) sign up → lands logged in, (2) login/logout + protected route redirect, (3) browse → register for free event → status shown, (4) vote in a poll → results chart visible, (5) paid event → Checkout → confirmation (hosted Checkout with the `4242…` card, **or** pending registration + signed webhook fixture; document the choice), plus organizer-only access denial. Offline smoke: visit event page → `context.setOffline(true)` → page still renders.
- **Test report (DEL-1)**: `pnpm test --coverage` + Playwright HTML/JUnit reporters → collected in `docs/test-report/` with a summary `README.md` (counts, coverage, how to run, known gaps). `/test-report` automates it.
- CI (SETUP-3): jobs for lint, typecheck, unit/integration (Postgres service container), E2E, Sonar scan with coverage.
- Tests accompany the code in the same PR; bug fix = regression test first.

## MUST NOT
- No tests depending on order, wall-clock, or real external services (Stripe, CMS, Resend, Blob).
- No testing against the dev database; no truncating without the `_test` guard.
- No snapshot tests of large DOM trees; no asserting implementation details (class names, state).
- No `any`-typed fakes that stop matching the repository interface (type them).
- No skipped/`.only` tests committed; no flaky `waitForTimeout` (use auto-waiting assertions).

## Procedure: test a requirement
1. Read its acceptance criteria. 2. Write service unit tests for rules/errors. 3. Add an integration test for the constraint/transaction that makes it safe. 4. Add route test for status codes + auth. 5. Add component tests for states/validation. 6. Extend an E2E journey if it is one of the five. 7. Run the suite; check coverage on the touched files.

## Example: service unit test (REG-1)
```ts
it("rejects registration when the event is full", async () => {
  const svc = createRegistrationsService({
    withTransaction: (fn) => fn({} as Tx),
    eventsRepo: fakeEventsRepo({ findByIdForUpdate: async () => makeEvent({ capacity: 1 }) }),
    registrationsRepo: fakeRegistrationsRepo({ countActive: async () => 1, findByUserAndEvent: async () => null }),
    notifications: { create: jest.fn() },
  });
  await expect(svc.register(user, "evt-1")).rejects.toMatchObject({ code: "EVENT_FULL" });
});
```
Integration counterpart: two concurrent `register` calls for the last seat → exactly one succeeds.

## Common mistakes
- Mocking the repository **and** asserting SQL shape (test behavior).
- Integration tests sharing state through leftover rows.
- E2E relying on seed data that unit tests mutate (use a separate DB/schema).
- Testing async Server Components with RTL (use E2E or test the service + presentational parts).
- Forgetting `await` in `expect(...).rejects`.

## Final checklist
- [ ] Rules covered at service level; constraints covered by DB integration tests.
- [ ] Route tests cover 401/403/404/400/409 paths; envelope asserted.
- [ ] Components cover loading/empty/error + validation; slices/utils unit-tested.
- [ ] External services mocked; test DB guarded and reset.
- [ ] CI runs everything; coverage reaches Sonar; report generated for DEL-1.
