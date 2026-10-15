---
description: Short Phase 1 summary for one requirement ID (or several), then Build mode (Claude implements, with tests and a teaching walkthrough)
argument-hint: <ID> | <ID,ID,...> | <PREFIX-a..b>
---

I am choosing **Build mode** for **$ARGUMENTS** by invoking this command (this satisfies the "I choose a mode" rule in CLAUDE.md for these requirements only; any other requirement still needs Phase 1 and my choice).

**Step 1: short Phase 1 summary (no code yet).**
- Resolve the IDs in `docs/requirements-catalog.md` (single, comma list, or range like `AGD-1..3`); unknown ID → show closest matches and stop. Read the spec section, the existing code, and the skills that serve these IDs (grep "Serves:" in `.claude/skills/*/SKILL.md`). Check Next.js 16 docs in `node_modules/next/dist/docs/` before using any Next.js API.
- Verify dependencies are done (catalog and code). If not, say so and ask whether to build them first.
- Show a compact summary: goal, dependency status, concepts (one line + docs link), files to create/change, build order, key decisions with alternatives, acceptance criteria per ID. Ask only questions that are truly mine to decide; otherwise proceed.

**Step 2: Phase 2B: implement** per CLAUDE.md and all relevant skills: table + migration (generate, show/explain SQL, **ask before `pnpm db:migrate`**) → repository → service → Zod → route → RTK Query/slice → components → page → tests. Do not commit.
- After each requirement run `pnpm lint`, `pnpm typecheck` and relevant tests; fix regressions; report results honestly (missing scripts/env must be reported, not worked around silently).
- Update statuses in `docs/requirements-catalog.md` only for verified requirements.

**Step 3: teaching walkthrough**: per ID: what you built, files, key decisions and why (trade-offs), how I can verify it myself, and a concept to study next.
