---
description: Verify DEL-1 and the spec's Definition of Done before submission
allowed-tools: Read, Grep, Glob, Agent, Bash(git status*), Bash(git log*), Bash(git branch*), Bash(pnpm lint*), Bash(pnpm typecheck), Bash(pnpm test*), Bash(pnpm build)
---

Run a pre-submission audit (**read-only**, no fixes unless I ask), using the `documentation-deliverables` skill and the `spec-checker` subagent where useful.

**A. DEL-1 deliverables**: for each, say Present / Partial / Missing with evidence:
1. Source code repository: branches `main`, `develop`, feature branches exist per spec §12; history uses conventional commits with IDs; no secrets committed (scan tracked files for key-like strings without printing them).
2. Live application URL: is it documented in the README? (Do not claim it works unless you can verify it; say what I should open and check.)
3. API collection: present in `docs/api/`, current versus the routes in `src/app/api`.
4. Test report: `docs/test-report/README.md` present and recent; matches current test results.
5. Technical documentation: README, `docs/architecture.md` (backend layers, ER diagram, flows), setup + env docs, `.env.example`, decision log, requirements coverage.

**B. Spec Definition of Done**, each Met / Partial / Missing + evidence:
- All mandatory modules implemented (every non-bonus catalog ID Done; list the ones that are not; bonus ignored).
- Application deployed to Vercel with working env vars, production build, migrations applied, accessible URL (DEP-1).
- All integrations functional: Stripe (test payment + webhook), CMS (content + revalidation), Sentry (client + server + rejections + API failures), SonarCloud, Neon/Postgres, Blob, email/reset flow, SSE.
- Test cases passing (run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` and report; E2E from the latest report or run it if asked).
- Code review feedback addressed (DOD-1): merged PR conversations resolved (check what is visible locally; ask me about GitHub state).
- Documentation complete.

**C. Quality gates**: SonarCloud (security, smells, duplication), Lighthouse ≥ 90 (note if unmeasured), accessibility spot-check, mobile.

Finish with a prioritized **submission blocker list** (must fix before submitting) versus **nice-to-fix**, each with the command to start (`/test-report`, `/api-collection`, `/check-spec`, `/explain-req <ID>`...).
