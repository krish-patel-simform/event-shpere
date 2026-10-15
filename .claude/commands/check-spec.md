---
description: Audit the codebase against docs/poc-spec.md and the requirements catalog: coverage table, gaps, drift, Definition of Done status
allowed-tools: Read, Grep, Glob, Agent, Bash(git status*), Bash(git log*), Bash(git branch*)
---

Audit the implementation against the spec (**read-only**). Use the `spec-checker` subagent for the heavy reading if the codebase is large, then verify its key claims yourself.

1. Read `docs/poc-spec.md` fully, `docs/requirements-catalog.md`, and the codebase. Remember the project decisions in CLAUDE.md override the spec where they differ (real backend instead of JSON Server; the extra IDs AUTH-9, NOTIF-7, ORG-4, DOD-1).
2. Produce:
   - **Coverage table**: ID | spec reference | implemented where (files/routes) | tested where | evidence-based status (Met / Partial / Missing) | catalog status.
   - **Gaps**: spec text not covered by any ID or implementation; IDs with no skill/command path.
   - **Drift**: places where the code contradicts the spec or CLAUDE.md (e.g. permission map §4 mismatches, hardcoded content, DB access outside repositories, missing Zod parsing, missing states).
   - **Definition of Done status** (all six spec items + project items from CLAUDE.md): each with Met/Partial/Missing and the evidence or what's missing.
   - **Evaluation weights view**: where the biggest score risk is (features 30, quality 20, testing 15, integrations 15, UI/UX 10, docs 10).
3. Recommend fixes in priority order with the command to start each. Offer to save the coverage table to `docs/requirements-coverage.md`; only write it if I say yes. Do not change catalog statuses unless I ask.
