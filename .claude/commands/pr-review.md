---
description: Review a branch or PR before merge (default: the current branch against develop): diff, lint/typecheck/tests, migrations, security, Definition of Done. Read-only report
argument-hint: [PR number | branch name]  (empty = the branch I am on, against develop)
allowed-tools: Read, Grep, Glob, Agent, Bash(git status*), Bash(git diff*), Bash(git log*), Bash(git branch*), Bash(git rev-parse*), Bash(git merge-base*), Bash(gh pr view*), Bash(gh pr diff*), Bash(pnpm lint*), Bash(pnpm typecheck), Bash(pnpm test*), Bash(pnpm exec drizzle-kit check*)
---

Review a pull request the way a senior reviewer would, **before it is merged**. Target from me: `$ARGUMENTS`. This is **read-only**: do not edit, commit, push or post anything until I answer the final question.

## 1. Pick what to review

- **No argument (default): the branch that is checked out now.** `git branch --show-current`; the base is `develop` (use `main` only if `develop` does not exist, checked with `git rev-parse --verify develop`).
- **A number** (`123`): the GitHub PR, with `gh pr view 123` and `gh pr diff 123` (base and head come from the PR).
- **A name**: that branch against the base above.
- If the branch is the base itself, or has no commits ahead of it, say "nothing to review" and stop. Uncommitted work (`git status`, staged and unstaged diff) is reviewed **separately** and labelled as "not committed yet".

## 2. Read the change

`git log <base>..HEAD --oneline`, `git diff <base>...HEAD --stat`, then the full diff and the full touched files (not only hunks). Read every new or changed **migration SQL** in `drizzle/` and check the journal and snapshots with `pnpm exec drizzle-kit check`. Get requirement IDs from the commit messages and the diff, and read their acceptance criteria in `docs/requirements-catalog.md` and `docs/poc-spec.md`.

## 3. Run the checks (report exact results)

`pnpm lint`, `pnpm typecheck`, `pnpm test`. If a check cannot run (environment, network), say so; never claim green when it is not.

## 4. Review against the project rules

Use `CLAUDE.md` and the skills that serve the touched areas (`backend-architecture`, `api-design`, `backend-security`, `database-drizzle`, `zod-validation`, `api-integration`, `component-development`, `ui-implementation`, `testing`, `git-workflow`). Look for:

- **Correctness:** wrong logic, missed edge cases, races, time zones, off-by-one in ranges, error paths.
- **Non-negotiables:** TypeScript strict and no `any`; Zod on request **and** response; auth + role + **ownership** on every protected route (deny by default); DTOs never raw rows; transactions for multi-step writes; no secrets or sensitive fields in responses; loading / empty / error states; accessibility; failures reported without PII.
- **Layers and imports:** route -> service -> repository; DB access only in repositories; a feature imports only `src/core` and other features' `index.ts`; `server-only` code never reaches the client barrel.
- **Migrations:** generated and committed **with** the code that needs them; destructive steps, data backfills, rollback story; never `drizzle-kit push`.
- **Tests:** the new behaviour and its failure paths are covered; tests would fail if the code were wrong.
- **Hygiene:** commits follow `type(scope): IDs summary`; no stray files (database dumps, `.env`, scratch files); docs and the requirements catalog updated.

When routes, auth, uploads, tokens, env or migrations changed, run `security-reviewer`; run `code-reviewer` for the general pass. They are read-only and can run in parallel. **Verify each finding yourself against the code** before it goes in the report, and drop what you cannot confirm.

## 5. Report in exactly this order

1. **Verdict:** Ready to merge / Fix first / Blocked, in one line with the main reason.
2. **Scope:** target, base, number of commits and files, and what is not committed.
3. **Checks run:** command -> result.
4. **Requirement status:** table ID | Met / Partial / Missing | note.
5. **Must fix:** `file:line`, why it matters, suggested change.
6. **Should improve**, then **Nice to have**.
7. **Migrations and data notes** (only if any), and **Security notes** (only if any).
8. **What is done well** (short, specific).

## 6. Then ask, and wait

"Do you want me to fix the Must fix items, draft the PR description with `/pr`, or post this as PR comments?" Do only what I choose. Fix only the items I name, explain each change, and re-run the checks afterwards. Never push, never merge, and never post comments to GitHub without my explicit yes.
