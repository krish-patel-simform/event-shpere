---
description: Short Phase 1 summary for a milestone week (1-8), then Build mode (Claude implements, with tests and a teaching walkthrough)
argument-hint: <1-8>
---

I am choosing **Build mode** for **milestone week $ARGUMENTS** by invoking this command (this satisfies the "I choose a mode" rule in CLAUDE.md for this week's requirements only).

**Step 1: short Phase 1 summary (no code yet).**
- Validate the week (integer 1–8; otherwise ask and stop). Read `docs/requirements-catalog.md` (IDs for this week), the spec section, the current code, and the relevant skills. Check Next.js 16 docs in `node_modules/next/dist/docs/` before using any Next.js API.
- Check dependencies: if an earlier requirement this week needs is **not** done, tell me and ask whether to build it first. Do not silently build around it.
- Show a compact summary: goal + IDs, dependencies status, the concepts involved (one line + docs link each), the list of files you will create/change, the order you will build in, key decisions you are making (and alternatives), and the acceptance criteria per ID. Keep it to one screen. If there is a genuine decision that is mine to make (e.g. CMS choice, hashing library, refund policy), ask it now and wait; otherwise continue.

**Step 2: Phase 2B: implement.** Follow `CLAUDE.md` and **all** relevant skills, requirement by requirement, in this order per requirement: Drizzle table + migration (generate and show SQL; **ask before running `pnpm db:migrate`**) → repository → service → Zod schemas → route handler → RTK Query endpoint/slice → components → page → tests. Create a branch via the git-workflow rules only if I ask. Do not commit.
- After **each requirement**: run `pnpm lint`, `pnpm typecheck`, and the relevant tests; fix what you broke; report results honestly (if a command does not exist yet because setup is incomplete, say so).
- Update the requirement's status in `docs/requirements-catalog.md` only when its acceptance criteria are verified.

**Step 3: teaching walkthrough** (required): for each requirement ID: what you built, which files, key decisions and why (and trade-offs), how I can verify it myself (commands, URLs, a manual test path), and one concept to read more about. Keep it teaching-oriented.
