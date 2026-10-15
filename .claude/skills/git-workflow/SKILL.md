---
name: git-workflow
description: Git branching and commit rules for EventSphere following spec section 12: main/develop/feature branches, conventional commits with requirement IDs, migrations committed with their code, pull request template and review checklist, and releases from develop to main. Use when creating branches, writing commit messages, opening or reviewing PRs, or cutting a release.
---

# Git workflow

Serves: SETUP-2, DOD-1, QUAL-1, DEP-1.
Related: `code-review-mentor` (PR review), `database-drizzle` (migrations), `testing` (CI). Commands: `/new-branch`, `/commit`, `/pr`.

## Branching (spec §12)
- `main`: production only; every merge is a **release** (tagged) deployed to Vercel production.
- `develop`: integration branch; Vercel preview deployments; CI must be green.
- `feature/<area>` branched **from `develop`**: spec-named ones `feature/authentication`, `feature/events`, `feature/payments`, `feature/dashboard`; add more as needed (`feature/agenda`, `feature/speakers-cms`, `feature/polls`, `feature/notifications`, `feature/pwa`, `feature/backend-foundation`, `feature/testing`). Small, short-lived; rebase/merge `develop` regularly.
- Hotfix: `fix/<name>` from `main` → merge to `main` and back to `develop`.
- PRs go **into `develop`** (squash or merge commit per team choice; keep conventional messages). `main` only via a release PR from `develop`.

## MUST
- **Conventional commits with requirement IDs**: `<type>(<scope>): <ID[, ID]> <imperative summary>`; types `feat fix docs style refactor perf test build ci chore`; scope = feature folder (`events`, `auth`, `payments`, `db`, `core`…).
  - `feat(events): DISC-3 free/paid filter`
  - `feat(db): BE-2 add registrations table and unique constraint`
  - `fix(payments): REG-5 ignore duplicate Stripe webhook deliveries`
  - `test(polls): POLL-3 one ballot per user integration test`
  - Body (when useful) explains *why*; footer `Closes #12` if issues are used.
- **Migrations are committed with the code that needs them** (generated SQL under `drizzle/` + schema change + seed update in the same PR); never edit applied migrations; never commit `.env*`.
- One logical change per commit; tests in the same commit/PR as the code.
- Before opening a PR: `pnpm lint && pnpm typecheck && pnpm test` pass; update `docs/requirements-catalog.md` statuses for verified IDs; no leftover `console.log`/TODO without an issue.
- **PR description** (use `/pr`): summary, requirement IDs, changes by layer, **migration notes** (new tables/columns, reversible? data impact), screenshots/GIFs to attach, test evidence (commands + results), risks, checklist.
- **Review checklist** (reviewer and author; see `code-review-mentor`): boundaries, Zod both sides, DTOs, auth/ownership, transactions, migrations/indexes, secrets, UI states, a11y, Sentry, tests, Sonar clean. PR conversations resolved (DOD-1) before merge.
- **Release**: PR `develop → main`; CI + SonarCloud green; migrations applied to the production DB deliberately (reviewed `drizzle-kit migrate`), env vars checked in Vercel, tag `vX.Y.Z`, smoke test the live URL.

## MUST NOT
- No direct commits to `main` or `develop`; no force-push (denied in settings); no `--no-verify`.
- No merging with failing CI or unresolved review comments; no giant "misc" commits; no commits without IDs when the change implements/affects a requirement (use `chore:` only for tooling).
- No squashing away a migration into a different PR than its code.

## Procedure
`/new-branch <area>` → implement in small commits → `/commit` (review staged diff, propose message, commit on approval) → `/pr` (draft description) → review/fix → merge to `develop` → delete branch.

## Example
Branch `feature/events` for DISC-1..4: commits `feat(db): BE-2 events table with type enum and indexes`, `feat(events): DISC-1 event card and list`, `feat(events): DISC-2 search by name`, `feat(events): DISC-3 filters`, `feat(events): DISC-4 server-side sorting and pagination`, `test(events): DISC-3 filter service and route tests`. PR title: `feat(events): DISC-1..4 event discovery`.

## Common mistakes
- Branching from another feature branch → tangled PRs.
- Migration generated on a stale `develop` → conflicting numbering (regenerate after rebase).
- Forgetting the ID in commit messages.
- Mixing refactors with features in one PR.

## Final checklist
- [ ] Branch from `develop`, named `feature/<area>`.
- [ ] Commits conventional with IDs; migrations included.
- [ ] CI green (lint, typecheck, tests, Sonar); catalog updated.
- [ ] PR description complete; review comments resolved.
- [ ] Release only develop → main, tagged, migrations applied deliberately.
