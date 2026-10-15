---
description: Explain a file or folder as a mentor: purpose, flow, key concepts, design decisions, pitfalls, and what to read next
argument-hint: <path>
allowed-tools: Read, Grep, Glob
---

Explain **$ARGUMENTS** to me as a senior engineer mentoring a learner. **Read-only**: do not change files.

1. If the path does not exist, search for likely matches and ask; stop. If it is a folder, read its structure and the key files (index/barrel, schema, service, repository, route, main components) before explaining.
2. Explain in this order, in plain words, with short code excerpts quoted from the actual files (`file:line` references):
   - **What it is and why it exists**: which requirement IDs it serves (from `docs/requirements-catalog.md`) and where it sits in the architecture (layer, feature, route → service → repository).
   - **How it works**: the flow step by step (request → … → response, or render → state → effect), including data shapes (Zod schemas/DTOs).
   - **Key concepts used**, each 1–3 sentences with an official docs link (e.g. Route Handlers, Drizzle transactions, RTK Query `injectEndpoints`, `use cache`, Auth.js callbacks). Check `node_modules/next/dist/docs/` for Next.js-specific behavior rather than relying on memory.
   - **Design decisions and trade-offs**: why it is written this way and what the alternatives were; which project skill describes the rule.
   - **Pitfalls / things that would break**: edge cases, security or data-integrity risks, anything that looks wrong or deviates from the skills (flag honestly, with a suggestion, but do not fix).
   - **Try it yourself**: 2–3 small experiments or questions that test my understanding (e.g. "what happens if two users register for the last seat?").
3. End by asking which part I want to go deeper on.
