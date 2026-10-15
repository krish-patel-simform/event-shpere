---
description: Create feature/<area> from develop following the git-workflow skill
argument-hint: <area> (e.g. authentication, events, payments, dashboard)
allowed-tools: Bash(git status*), Bash(git branch*), Bash(git checkout *), Bash(git switch *), Bash(git pull --ff-only*), Bash(git log*)
---

Create the branch `feature/$ARGUMENTS` following the `git-workflow` skill.

1. Validate `$ARGUMENTS`: lowercase kebab-case, no `feature/` prefix, not empty. Prefer the spec names (`authentication`, `events`, `payments`, `dashboard`) when the area matches one.
2. `git status`: if there are uncommitted changes, show them and ask me what to do (commit, stash, or carry them over). Do not discard anything.
3. `git branch --list`: check that `develop` exists. **If it does not** (a fresh repo often has only `main`), tell me and ask whether to create `develop` from `main` (then `git checkout -b develop main`); do nothing else until I answer. Do not push anything.
4. Check that `feature/$ARGUMENTS` does not already exist; if it does, ask whether to switch to it.
5. Update `develop` only with a fast-forward pull if a remote is configured (`git pull --ff-only`); if there is no remote or it fails, say so and continue from the local `develop`.
6. `git checkout -b feature/$ARGUMENTS develop`. Confirm with `git branch --show-current`.
7. Remind me of the rules: conventional commits with requirement IDs (`feat(<scope>): <ID> ...`), migrations committed with their code, PR into `develop`. Suggest the next step (`/explain-req <ID>` for the first requirement on this branch).
