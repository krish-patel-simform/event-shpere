---
description: Mentor Phase 1 for a milestone week (1-8): implementation guide with no code changes, then ask Learn or Build mode
argument-hint: <1-8>
allowed-tools: Read, Grep, Glob, Bash(git status*), Bash(git log*), Bash(git branch*)
---

Run **Mentor Workflow Phase 1** (see CLAUDE.md) for **milestone week $ARGUMENTS**. Make **no file changes**.

1. Validate the argument: it must be an integer 1–8; otherwise ask me for a valid week and stop.
2. Read `docs/requirements-catalog.md` and list every requirement whose week column is $ARGUMENTS (plus cross-cutting IDs this week must respect). Read the matching section of `docs/poc-spec.md`. Check the current codebase and `git log` to see what already exists.
3. Load the relevant skills from `.claude/skills/` (by topic: structure, backend-architecture, database-drizzle, api-design, auth-roles, etc.) and use them as the source of conventions.
4. Check the Next.js 16 docs in `node_modules/next/dist/docs/` for any Next.js API the week needs before describing it.
5. Produce the Phase 1 guide with these exact sections, in order:
   1. **Goal** in simple words + requirement IDs covered.
   2. **Why now**: dependencies on earlier weeks/IDs; state clearly which are Done (per catalog **and** code) and which are missing. If a dependency is missing, say so prominently.
   3. **Concepts to learn** (backend and frontend), 1–3 sentences each with an official docs link.
   4. **Files** to create/change in the feature-based structure, one-line purpose each.
   5. **Step-by-step approach**: Drizzle table + migration → repository → service → Zod schemas → route handler → RTK Query endpoint / slice → components → page → tests; numbered, with hints, not full solutions (small signatures/skeletons are fine). Group by requirement ID so I can split work per requirement or per layer.
   6. **Common pitfalls** (including security and data-integrity).
   7. **Acceptance criteria** per requirement ID, including the tests to write.
6. End with exactly this question and then STOP (no code, no further tool calls):

   "Do you want to implement this yourself (Learn mode) or should I implement it (Build mode)?"
