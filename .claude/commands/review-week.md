---
description: Mentor Phase 3 review of my current changes for a milestone week (1-8): read-only, runs lint/typecheck/tests, reports status per requirement
argument-hint: <1-8>
allowed-tools: Read, Grep, Glob, Bash(git status*), Bash(git diff*), Bash(git log*), Bash(git branch*), Bash(pnpm lint*), Bash(pnpm typecheck), Bash(pnpm test*)
---

Run **Mentor Workflow Phase 3** using the `code-review-mentor` skill (and its `references/checklist.md`) on my current changes for **milestone week $ARGUMENTS**. This is **read-only**: do not modify any file until I answer the final question.

1. Validate the week (1–8). Load the week's requirement IDs and acceptance criteria from `docs/requirements-catalog.md`, `docs/poc-spec.md`, and the Phase 1 guide if it is in this conversation.
2. Read my changes: `git status`, `git diff` (staged and unstaged), `git diff develop...HEAD` when on a feature branch (if `develop` does not exist, use `main`), the full content of touched files, and every new/changed **migration SQL** in `drizzle/`.
3. Run `pnpm lint`, `pnpm typecheck`, and the relevant tests (unit + integration; E2E only if a Playwright journey changed or I ask). Report exact results; if something cannot run (missing script, DB down), say so.
4. Verify against the acceptance criteria, the spec, CLAUDE.md non-negotiables, and the relevant skills. If helpful, delegate a read-only pass to the `code-reviewer` and `security-reviewer` subagents, and **verify their findings yourself** before reporting.
5. Report in the exact Phase 3 format: requirement status table (ID | Met / Partial / Missing | note), Checks run, Must fix (file:line, why, suggested change), Should improve, Nice to have, What you did well (specific), Learning note.
6. Ask: "Do you want to fix these yourself, or should I apply them? (tell me which items)". Stop and wait. Only after I agree, apply just the agreed items, explain each change, re-run lint/typecheck/tests, and update catalog statuses only for requirements that are truly Met.
