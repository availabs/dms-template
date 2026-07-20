# qa-address-tickets — T5: re-enter accepted pages when new tickets appear

Runs at the START of every `qa-run`, over all pages at `stage ∈ {Dev Acceptance, Client
Acceptance}`. This is how client/dev tickets (filed via the Page-QA "Add ticket" modal, or the
tickets page) pull a page back into the loop.

**Trigger = open NON-ELEVATED tickets** (`assignee ≠ "HUMAN"`). Elevated tickets are the human
queue riding along at Dev Acceptance (that's how the page got there per the advancement rule) —
they must NOT re-enter the page. A page re-enters when a NEW actionable ticket appears (client/
dev-filed, or a human de-elevates by clearing `assignee`).

## Per page with open non-elevated tickets

1. **Triage human-filed tickets** (missing severity/priority — the modal form doesn't force
   them): infer from title/description via the severity heuristic (qa-process.md), then
   `qa_state.mjs patch-ticket <row_id> '{…}'`. Never change fields a human already set.
   **Write each thing to its own column** — the schema has dedicated triage fields; do not
   cram assessments into `comments`:
   - `severity` / `priority` — only when missing (heuristic).
   - `category` — `bug | style | data | content | enhancement`.
   - `effort` — `S | M | L`.
   - `suggested_solution` — the assessment + proposed fix (diagnosis, exact config
     knobs/files, owning build script). THIS is where proposed solutions go.
   - `duplicate_of` — the primary ticket's number when a dupe (keep the dupe open; note
     which fix resolves both).
   - `comments` — ONLY the triage stamp (`triaged priority/category/effort (agent, <date>)`),
     `ELEVATED (agent, <date>): <reason>` notes, and short cross-refs/flags.
2. **Re-enter**: `qa_state.mjs set-stage <page_key> QA '{"dev_ready":""}'` — the same run's T4
   pass then works the tickets.
3. Report: which pages re-entered, which tickets pulled them back, `source` breakdown.

No open tickets → no-op. `Client Acceptance` transitions themselves (approve/reopen decisions,
`client_approved`) are always human.
