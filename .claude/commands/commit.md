---
description: Review staged changes, propose a conventional commit message with requirement IDs, and commit only after I approve
allowed-tools: Read, Grep, Glob, Bash(git status*), Bash(git diff*), Bash(git log*), Bash(git branch*)
---

Prepare a commit following the `git-workflow` skill.

1. `git branch --show-current`: refuse and warn if I am on `main` or `develop` (work should be on `feature/<area>`). `git status` and `git diff --staged`. If nothing is staged, show the unstaged changes and ask which files to stage (suggest logical groups; one logical change per commit). Never stage `.env*`, secrets, or generated junk; warn if you see any.
2. Review the staged diff briefly as a mentor: obvious bugs, leftover `console.log`/TODO/commented code, missing tests, a schema change without its migration in `drizzle/` (or the reverse), missing catalog update. Report concerns and ask whether to proceed or fix first.
3. Identify the requirement IDs affected (from the diff and `docs/requirements-catalog.md`) and the scope (feature folder).
4. Propose a message: `<type>(<scope>): <ID[, ID]> <imperative summary>` (≤ 72 chars) plus a short body explaining **why** if the change is not obvious. Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore. Examples: `feat(events): DISC-3 free/paid filter`, `fix(payments): REG-5 ignore duplicate Stripe webhook deliveries`.
5. Ask: "Commit with this message? (yes / edit / no)". **Only after I approve**, create the commit (end the message with the co-author trailer that Claude Code's attribution guidance specifies) and show `git log -1 --stat`. Never use `--no-verify`, never amend or push unless I ask.
