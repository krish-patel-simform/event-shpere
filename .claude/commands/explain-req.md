---
description: Mentor Phase 1 for one requirement ID (or a few, e.g. DISC-3 or REG-1,REG-4): guide with no code changes, then ask Learn or Build mode
argument-hint: <ID> | <ID,ID,...> | <PREFIX-a..b>
allowed-tools: Read, Grep, Glob, Bash(git status*), Bash(git log*), Bash(git branch*)
---

Run **Mentor Workflow Phase 1** (see CLAUDE.md) for requirement(s) **$ARGUMENTS**. Make **no file changes**.

1. Resolve the IDs against `docs/requirements-catalog.md` (accept a single ID, a comma list, or a range like `DISC-1..4`). If an ID does not exist, show the closest matches and ask me which I meant; stop.
2. Read the catalog rows, the related spec section in `docs/poc-spec.md`, the existing code (what already exists for this feature?), and `git log` for recent related work.
3. Load the skills that serve these IDs (grep `.claude/skills/*/SKILL.md` for the ID in "Serves:" lines) and follow their conventions. Check the Next.js 16 docs in `node_modules/next/dist/docs/` for any Next.js API involved.
4. Produce the Phase 1 guide with exactly these sections, in order:
   1. **Goal** in simple words + requirement IDs covered.
   2. **Why now**: dependencies (other IDs/weeks); confirm which are done according to the catalog **and** the code; flag anything missing.
   3. **Concepts to learn** (backend and frontend), 1–3 sentences each with an official docs link.
   4. **Files** to create/change in the feature-based structure, one-line purpose each.
   5. **Step-by-step approach** (table/migration → repository → service → Zod → route → RTK Query/slice → components → page → tests), numbered, hints not full solutions; small signatures/skeletons allowed. Mark which steps belong to which ID so I can split by layer.
   6. **Common pitfalls** (including security and data-integrity).
   7. **Acceptance criteria** per ID, including tests to write.
5. End with exactly this question and then STOP:

   "Do you want to implement this yourself (Learn mode) or should I implement it (Build mode)?"
