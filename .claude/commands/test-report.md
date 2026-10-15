---
description: Run unit, integration and E2E tests and write the test report for the deliverables
allowed-tools: Read, Grep, Glob, Write, Bash(pnpm test*), Bash(pnpm test:e2e*), Bash(pnpm lint*), Bash(pnpm typecheck), Bash(pnpm db:up), Bash(docker compose ps*), Bash(git log*), Bash(git branch*)
---

Create the test report required by DEL-1, following the `testing` and `documentation-deliverables` skills.

1. **Prepare**: check scripts exist in `package.json` (`test`, `test:e2e`); check the test database is up (`docker compose ps`; suggest `pnpm db:up` if not) and that `DATABASE_URL_TEST` is configured **without reading `.env*` files**. If something is missing, report it and continue with what can run (do not fake results).
2. **Run** and capture output: `pnpm lint`, `pnpm typecheck`, `pnpm test -- --coverage` (unit + component + service + integration), `pnpm test:e2e` (Playwright; HTML + JUnit reporters). Note durations, counts (passed/failed/skipped) and coverage % (statements/branches/functions/lines) for `features/**` and `core/**`.
3. **Write `docs/test-report/README.md`**:
   - Environment (Node, pnpm, browsers, OS, DB version), date, branch/commit.
   - How to run each suite.
   - Results table per suite (unit, component, service, integration, E2E) with counts and duration.
   - Coverage summary and the files under threshold.
   - **E2E journeys** required by the spec (registration, login, event registration, poll participation, payment flow): status of each, with link to the Playwright report/traces.
   - **Requirement traceability**: table of test files → requirement IDs (TEST-1, TEST-2, TEST-3 and functional IDs), and IDs with **no** tests.
   - Failures/skips with cause and plan, flaky tests, known gaps and risks.
   - Quality gates: Sonar status if available (QUAL-1), Lighthouse scores if measured.
4. Copy or link artifacts (`coverage/lcov-report`, `playwright-report`) into/near `docs/test-report/` (do not commit huge binaries; mention what is git-ignored). Be honest: a failing suite is reported as failing. Update the catalog (TEST-*, DEL-1) only if criteria are truly met.
