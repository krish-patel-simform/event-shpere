---
description: Mentor-style help designing the Drizzle tables for a feature (columns, types, constraints, indexes, relations) with trade-offs; guidance only unless I ask you to write it
argument-hint: <feature> (e.g. registrations, polls, agenda)
allowed-tools: Read, Grep, Glob
---

Help me design the database tables for the **$ARGUMENTS** feature, following the `database-drizzle` skill and the planned tables in `.claude/skills/database-drizzle/references/schema-overview.md`. Treat this as **Learn mode guidance**: do **not** create or edit files, and do not generate migrations, unless I explicitly ask.

1. Validate that `$ARGUMENTS` is one of the project features (auth, profile, events, event-details, registrations, payments, agenda, speakers, cms, polls, notifications, announcements, dashboard, organizer, offline). If it is not, suggest the closest and ask. Note that `speakers`/`cms` have no tables (CMS data) and `dashboard` only adds indexes/queries.
2. Read the catalog IDs involved and the spec text, and any existing schema files under `src/features/*/server/db/schema.ts`.
3. Walk me through the design as a mentor, in this order, **asking me questions first** where the answer shapes the design (e.g. "what should happen to a registration when an event is deleted?", "can a user re-register after cancelling?"):
   - Entities and their relationships (small ER sketch in Mermaid or text).
   - For each table: columns with Postgres/Drizzle types and why (uuid vs serial, `timestamptz`, cents for money, `pgEnum` values), nullability, defaults.
   - Constraints that enforce the business rules (unique, FK + `onDelete` choice and why, check constraints).
   - Indexes tied to the queries we will run (filters, sorts, joins, analytics) and why each exists.
   - Relations for the relational query API, and the `$inferSelect` / `$inferInsert` types.
   - Trade-offs and alternatives (e.g. one ballot table vs one row per vote; denormalized counters vs aggregate queries) and what I would lose with each.
   - Migration notes (enum changes, data backfill, rollback story) and seed data needed.
4. Finish with a short checklist I can use to write it myself, and the next command to run (`/explain-req <ID>`). If I then say "you write it", implement following the skill, run `pnpm db:generate`, show and explain the SQL, and ask before `pnpm db:migrate` (see `/db-migrate`).
