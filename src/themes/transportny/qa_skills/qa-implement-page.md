# qa-implement-page — T2: build missing pages from design + stories

For pages at `stage=Design`. **Both inputs are REQUIRED before building**: the design mockup
(`design_file`) AND the page's stories (`sitemgmt_stories` rows) — the design says what to
build, the stories say what it must do (they are the acceptance criteria `qa-assess-page` will
verify against). Missing either → do NOT build: run `qa-scope-stories` first (no stories), or
leave at Proposed/report (no design).

## Dispatch

- Page already live (`build ≠ "Not started"`) → advance only:
  `qa_state.mjs set-stage <key> Implemented`. (Design approval is a human review the pipeline
  surfaces; the agent does not gate on it.)
- Page missing in DMS → build it:

## The build

1. Read the mockup file (`dms_design_system_v2/pages/<design_file>`) AND the stories
   (`qa_state.mjs state --page <key>` → `stories.rows`). Treat the design as the band/element
   checklist (per `creating-pages-from-a-design-pattern` §build discipline) and the stories as
   behaviors that must each be expressible in the build.
2. Build with the dms skills: `creating-pages-from-a-design-pattern` (page/bands/sections via
   CLI), `transcribing-a-design-card-to-dms` (verify loop), `card-layout`,
   `modal-section-group` where the design calls for one. **Draft-only** — never publish.
3. The build script is the source of truth: it lands in
   `src/themes/transportny/qa_skills/tools/builds/build_<surface>_<slug>.mjs` (committed, NOT
   scratchpad), modeled on the existing `build_cr_*.mjs` idiom (find-or-create by slug, delete +
   recreate sections, idempotent).
   It stays the source of truth only while it MATCHES the live page — the moment someone authors on
   the page without backporting, re-running the script silently reverts their work (twice in July
   2026: 6 sections destroyed, and a graph's `tickSpacing` reverted at an identical section count).
   So every script needs the **runtime parity guard** — right after it reads `data.draft_sections`
   and *before* the delete loop, throw when `existing.length !== SECTIONS.length`.
   `page_to_build.mjs` EMITS this automatically (since 2026-07-28), so a generated script already has
   it; only a hand-written script needs it added (copy from any generated builder). The count check is
   necessary but NOT sufficient — prove content parity with
   `tools/builds/fidelity_static.mjs <script> <pageId>`, which the emitted guard's comment spells out
   for that page.
4. Any design element or story a DMS primitive can't express → ticket it
   (`severity=Major, title="[build] <element/story> not expressible"`, description names the
   smallest primitive/data enrichment that would unblock — per the themes-guide discipline),
   and note it in the run report. Never silently approximate or drop.
5. Verify with a Playwright shot of `/edit/<slug>` against the mockup (the
   `transcribing-a-design-card-to-dms` loop), then advance:
   `qa_state.mjs set-stage <key> Implemented` (build refreshes on next sync). T3 assessment then
   verifies the stories individually.

## Design-first pages (mockup exists, no live page anywhere)

These rows don't enter via sync (sync mirrors LIVE pages). A human adds the row —
`page_key + surface + name + design_file`, `stage=Proposed`, `build="Not started"` — then the
normal T1 (stories) → T2 (this skill) flow builds it. Never run sync `--prune` while such rows
exist.
