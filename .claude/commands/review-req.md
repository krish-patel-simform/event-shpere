---
description: Mentor Phase 3 review of my current changes for one requirement ID (or several): read-only, runs lint/typecheck/tests, reports status
argument-hint: <ID> | <ID,ID,...> | <PREFIX-a..b>
allowed-tools: Read, Grep, Glob, Bash(git status*), Bash(git diff*), Bash(git log*), Bash(git branch*), Bash(pnpm lint*), Bash(pnpm typecheck), Bash(pnpm test*)
---

Run **Mentor Workflow Phase 3** using the `code-review-mentor` skill (and its `references/checklist.md`) on my current changes for **$ARGUMENTS**. This is **read-only**: do not modify any file until I answer the final question.

1. Resolve the IDs in `docs/requirements-catalog.md` (single, list, or range; unknown ID → show matches and stop). Load their acceptance criteria from the catalog, `docs/poc-spec.md`, and the Phase 1 guide if it is in this conversation.
2. Read my changes: `git status`, `git diff` (staged + unstaged), `git diff develop...HEAD` on a feature branch (fall back to `main` if `develop` does not exist), full touched files, and new/changed **migration SQL**.
3. Run `pnpm lint`, `pnpm typecheck`, and the tests related to these IDs. Report exact results; say so when something cannot run.
4. Verify against acceptance criteria, spec, CLAUDE.md, and the skills that serve these IDs. Optionally delegate read-only passes to `code-reviewer` / `security-reviewer`, and verify their findings before including them.
5. Report in the exact format: requirement status table (ID | Met / Partial / Missing | note), Checks run, Must fix (file:line, why, suggested change), Should improve, Nice to have, What you did well, Learning note.
6. Ask: "Do you want to fix these yourself, or should I apply them? (tell me which items)". Wait. Edit only after I agree, only the agreed items, explaining each change; then re-run checks and update catalog statuses for requirements that are truly Met.
