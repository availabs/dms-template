# QA skill — Scope user stories for pages in the Proposed stage

A TransportNY **site-management QA skill**. It makes a pass over every page in the control room's
`sitemgmt_pages` dataset that is in the **Proposed** stage, proposes a set of **user stories** for each
(grounded in what the page actually does), and writes them to the `sitemgmt_stories` dataset at the
**proposed** stage. A human then reviews them on the page-QA page and moves each to **accepted** /
**verified**.

> **Audience:** an AI agent (or engineer) with DMS CLI/API access to the `npmrdsv5` / `dev2` control
> room. **Output:** `proposed` rows in `sitemgmt_stories`, one per user story, linked to the page by
> `page_key`. Nothing is auto-accepted — proposing is the skill's only job.

## The QA process this fits

Pipeline: **Proposed → Design → Implemented → QA → Dev Acceptance → Client Acceptance**. A page enters
**Proposed** when we want to define *what it should do* before designing/building. This skill is the work
of the Proposed stage: turn the page's purpose into a concrete, reviewable backlog of user stories.

Story stages (distinct from the page stage): **proposed** (AI/dev drafted) → **accepted** (human agrees
it's in scope) → **verified** (built + confirmed on the live page). Once a page's stories are accepted, a
human advances the page from **Proposed** to **Design**.

## Prerequisites

- The `sitemgmt_stories` dataset exists (source `2186440` / view `2186441`; created by
  `scratchpad/npmrdsv5-dev2/cr_create_stories_source.mjs`).
- A DMS token: `POST {DMS_HOST}/login {email,password,project:'npmrdsv5'}` → `user.token`; export it as
  `DMS_AUTH_TOKEN`. `DMS_HOST` defaults to `http://localhost:3001`.
- Run commands from the `dms-template/` repo root.

## Procedure

1. **List the pages awaiting scoping.**
   ```bash
   DMS_AUTH_TOKEN=… node src/themes/transportny/qa_skills/scope_stories.mjs list
   ```
   Prints every `sitemgmt_pages` row with `stage === "Proposed"` — `page_key`, `name`, `surface_label`,
   `route`, `description`. If the list is empty, there is nothing to scope.

2. **Understand each page.** Read its `description` (what the page does) and, when useful, open the live
   page (`//<subdomain>.<host>/<route>`) or its design mockup to see the real content. Do **not** invent
   capabilities the page clearly doesn't have.

3. **Propose 4–6 user stories per page.** Write each as a single, testable capability:
   - Format: **`As a <role>, I can <capability>.`** (roles: planner, analyst, manager, visitor, editor…)
   - One capability per story; concrete and verifiable ("I can filter the gallery by mode", not "the
     page is good").
   - Cover the page's primary jobs: the headline value, the key interactions, the data binding, and one
     responsiveness/accessibility story where relevant.
   - Transcribe from the page's real purpose — these become the acceptance backlog, so accuracy matters.

4. **Write them as `proposed`.** Author a JSON file mapping `page_key → [stories]`:
   ```json
   { "tsmo2:home": [
       "As a manager, I can see current TSMO performance at a glance.",
       "As a user, I can switch the reporting year.",
       "As a user, I can drill into congestion, reliability and incidents."
   ] }
   ```
   then:
   ```bash
   DMS_AUTH_TOKEN=… node src/themes/transportny/qa_skills/scope_stories.mjs write /tmp/proposed.json
   ```
   The helper creates one `sitemgmt_stories` row per story at `stage:"proposed"`, `source:"ai"`,
   `sort_order` sequential. It is **idempotent** — a story with the same `page_key` + text is skipped, so
   re-running never duplicates.

5. **Hand off.** The proposed stories now render in the page-QA page's **Features & user stories** card.
   A human reviews them and advances each to `accepted`, then `verified` once built. Leave the page in
   **Proposed** until its stories are accepted, then a human advances it to **Design** (stage transitions
   are a human/dev action, not this skill's).

## Conventions / guardrails

- **Propose only.** Never write `accepted`/`verified` — those are human judgments.
- **Grounded, not generic.** Stories must reflect *this* page; a page with no special interactions gets
  fewer, simpler stories — don't pad to hit a count.
- **One capability per story**, in the `As a <role>, I can <…>` form, so each maps to a verifiable check.
- **Idempotent + non-destructive.** The helper only adds; it never edits or deletes existing stories.

## Mechanics (for reference)

- Stories source: `sitemgmt_stories` — `app=npmrdsv5`, source `2186440`, view `2186441`, split data type
  `sitemgmt_stories|2186441:data`. Schema: `page_key, story, stage(proposed|accepted|verified), source,
  sort_order`.
- Pages source: `sitemgmt_pages` — view `2184890`; the Proposed filter is `data->>'stage' = 'Proposed'`.
- Writes go through the falcor `dms.data.create` route (the helper handles it); reads through the `uda`
  options route. See `src/dms/skills/creating-pages-from-a-design-pattern.md` for the broader CLI/API
  surface and `planning/transportny/tasks/current/delivery-control-room.md` for the control-room build.
