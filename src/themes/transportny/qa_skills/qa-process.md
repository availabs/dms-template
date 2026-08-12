# The agent QA process — operational reference

READ THIS FIRST before running any `qa-*` skill. It defines the datasets, the stage machine,
which transitions an agent may perform, and the guardrails. The planning spec (why it's shaped
this way) lives at `planning/transportny/qa-process/agent-qa-process.md` in the workspace root.

## Environment

App `npmrdsv5`, site `dev2`, API `http://localhost:3001`, frontend `http://npmrds.localhost:5173`
(sitemgmt pattern at `/sitemgmt`, pattern id 2184885). Auth (~6h tokens):

```bash
export DMS_AUTH_TOKEN=$(node src/dms/packages/dms/cli/bin/mint-token.mjs \
  --host http://localhost:3001 --project npmrdsv5 --email availabs@gmail.com --password test123)
# Playwright storageState (per assessed origin):
node src/dms/packages/dms/cli/bin/mint-token.mjs ... --origin http://npmrds.localhost:5173 \
  --out scratchpad/npmrdsv5-dev2/auth.json
```

All tools run from the dms-template root. State writes go through
`qa_skills/tools/qa_state.mjs` / `cr_sync.mjs` (falcor `dms.data.edit/create` with the
**split-type 4th arg** — never 3-arg edits, they hit the wrong table).

## Datasets (system of record)

| Dataset | source/view | Agent may… |
|---|---|---|
| `sitemgmt_patterns` 2186148/2186149 | tracked-pattern config | READ ONLY (humans add patterns) — unless the owner asks to enrol one *in that request* (see "Enrolling a pattern") |
| `sitemgmt_pages` 2184889/2184890 | the state machine (one row/page, key `page_key` = `surface:slug`) | update stage tuple, gates `ai_reviewed`/`dev_ready`, counters (via sync). NEVER `client_approved`. |
| `sitemgmt_stories` 2186440/2186441 | acceptance criteria | create `proposed` (source ai); advance `accepted → verified` ONLY. `proposed → accepted` is human. |
| `sitemgmt_tickets` 2184923/2184924 | bugs | create (source ai), triage, work status, resolve, elevate. Never delete. |

### Enrolling a pattern (owner-requested only)

Done for `landing` on 2026-07-29; the recipe generalises.

1. **Add one `sitemgmt_patterns` row** — `app`, `pattern`, `surface`, `surface_label`, `subdomain`,
   `base_url`, `sort_order`, `enabled: "yes"`. Back the table up first; it is otherwise read-only.
   - `pattern` must match the live pattern's `data.name` so `cr_sync` can read `base_url`/`subdomain`
     off the pattern row. If the name isn't a clean identifier, enrol by **pattern id** instead (as the
     Freight Atlas row does with `2175436`) and supply `subdomain` explicitly.
   - `subdomain` on the config row is an **explicit override**, logged loudly. Needed when the pattern's
     own subdomain is the wildcard `*`, which `cr_sync` maps to `""` and would emit a **relative** page
     url — wrong for a control-room link. `landing` is `*`, so its row pins `www` (verified:
     `devtny.org/landing` 301s to `www.devtny.org/landing`).
   - `sort_order: 0` places a pattern first without renumbering the existing rows.
2. **`cr_sync --apply`** — creates a `sitemgmt_pages` row per live page, at stage `Proposed`.
3. **Wire the design mockup** if its filename doesn't match the `SURFACE_PREFIX` rule — add a
   `KEY_FILE_OVERRIDE` entry in `cr_sync.mjs` (`landing:landing` → `landing.html`). Without it
   `design_html` is blank and the Design page renders nothing.
4. **Re-run `build_cr_overview.mjs`** — it reads the tracked patterns and renders one card per pattern,
   so the new surface does NOT appear until the overview page is rebuilt. Diff before/after payloads
   first (see `tools/builds/README.md` — generative builders can't use `fidelity_static.mjs`).
   `build_cr_page.mjs` and `build_cr_design.mjs` are parameterised on `?key=<page_key>` and need no
   rebuild.
5. The overview is written **draft-only** — the owner publishes.

To drop a page the owner has deleted from the live pattern: `cr_sync --prune` (dry-run first and read
the "existing rows not in live patterns" line — it is the exact delete list), then rebuild the overview.

## The stage machine

`Proposed(1) → Design(2) → Implemented(3) → QA(4) → Dev Acceptance(5) → Client Acceptance(6)`
Canonical `next_step` strings live in `tools/qa_state.mjs` (`STAGES`) — always transition via
`qa_state.mjs set-stage` so the tuple stays coherent. Stages never move backward EXCEPT the T5
re-entry (≥ Dev Acceptance → QA when new open tickets appear). `Client Acceptance` and the
`client_approved` gate are human-only. Open ticket = `status ∈ {Triage, In progress, In review}`.

| # | Trigger (stage + condition) | Skill | Writes |
|---|---|---|---|
| T0 | every run, first | `qa-sync-inventory` | pages inventory/design/counters/stage-tuple; tickets hygiene+denorm |
| T1 | Proposed, no stories | `qa-scope-stories` | stories += proposed; stage→Design (design exists) or →Implemented (live, no design) |
| T2 | Design | `qa-implement-page` | build page if missing — **requires BOTH design_file AND stories** (design = what to build, stories = what it must do; draft-only); stage→Implemented |
| T3 | Implemented | `qa-assess-page` | tickets += findings; accepted stories→verified; `ai_reviewed=yes`; stage→QA (findings) or →Dev Acceptance + `dev_ready=yes` (clean) |
| T4 | QA, open agent-actionable tickets | `qa-fix-ticket` (per ticket) | the fix (section config/theme/core/data) + ticket status; page→Dev Acceptance + `dev_ready=yes` when clear |
| T5 | ≥ Dev Acceptance, new open NON-elevated tickets | `qa-address-tickets` | triage fields on human tickets; stage→QA, `dev_ready=""` (elevated tickets ride along — never re-entry triggers) |

The orchestrator (`qa-run`) dispatches T5 → T1..T4 per page each run, then re-syncs and writes a
run report to `planning/transportny/qa-process/runs/YYYY-MM-DD[-n].md`.

## Elevation contract (agent → human hand-off)

Elevate a ticket when: 2 fix attempts failed verification · the fix needs a non-BC core change ·
needs data/credentials the agent can't create · needs product judgment · needs publish.
Writes: `assignee="HUMAN"`, `priority="Now"` (Blocker/Major), `comments += "ELEVATED (agent,
<date>): <reason>"` — status stays open. Elevated tickets are skipped on later runs and listed
first in the run report. **Advancement rule:** a page reaches Dev Acceptance when it has no open
agent-actionable tickets AND no open elevated Blocker/Major (elevated Minor/Polish ride along).

## Hard guardrails

- **Never publish** (`dms page publish`) — humans publish. Assess draft pages via `/edit/<slug>`;
  note view-only behaviors (e.g. isModal groups) as "verify after publish" instead of ticketing.
- Never delete rows; never edit `sitemgmt_patterns`; never set `client_approved`. **Exception: an
  explicit owner request in that same message** — e.g. "add the landing pattern to the QA process"
  (a `sitemgmt_patterns` row) or "remove page 2, I deleted it" (a `--prune` delete). Both were done
  2026-07-29. Back up the affected rows first, dry-run, and report the exact scope; the default stays
  read-only, and an instruction from an earlier turn does not carry forward.
- Section-config fixes go through the page's **owning build script in `tools/builds/`** — but
  **check the builder is in parity with the live page BEFORE you re-run it** (see its README for the
  custody table). The decision, in order:
  1. **Not build-owned** (e.g. the freight-atlas map section) → surgical read-modify-write on the
     section's `element-data` is the correct fix. See `qa-fix-map-symbology-tickets.md`.
  2. **Build-owned + in parity** → patch the script, re-run. The normal path.
  3. **Build-owned + DRIFTED** → do NOT re-run: a rebuild wipes and recreates, so anything authored
     live and never backported is destroyed. Either regenerate (`tools/page_to_build.mjs`) and gate,
     or fix surgically and backport.
  Prove parity with **`tools/builds/fidelity_static.mjs <script> <pageId>`** — a matching section
  COUNT is not enough. On 2026-07-27 `build_tsmo2_incidents_v2.mjs` was 32-for-32 and still reverted
  a graph fix (`yAxis.tickSpacing` 2000000 → 2, silently degrading every render); on 2026-07-15/16 a
  28-vs-34 drift destroyed 6 authored sections outright.
- **Backport a surgical edit the moment you make it.** An un-backported live edit is a landmine for
  the next rebuild — that is the exact mechanism behind both incidents above. If you cannot backport,
  say so on the ticket. Published rows are the recovery source: a draft-only rebuild never touches
  them, which is what made both recoveries possible.
- Core `@availabs/dms` fixes: BC only, with their own task file
  (`src/dms/planning/tasks/current/`) per `feedback_primitive_change_tasks_bc`; non-BC ⇒ elevate.
- Budgets per run (defaults): assess ≤ 5 pages, fix ≤ 10 tickets; one touch per page per stage
  per run. Design-first rows (manual `page_key`+`design_file`, no live page): never run sync
  `--prune` while any exist.

## Skills index

`qa-run` (orchestrator) · `qa-sync-inventory` (T0) · `qa-scope-stories` (T1) ·
`qa-implement-page` (T2) · `qa-assess-page` (T3) · `qa-fix-ticket` (T4, + the map-layer sub-process
`qa-fix-map-symbology-tickets`) · `qa-address-tickets` (T5). Tools: `tools/cr_sync.mjs`, `tools/qa_state.mjs`,
`tools/qa_assess.mjs`, `tools/page_to_build.mjs` (regenerate a drifted builder),
`tools/builds/fidelity_static.mjs` (prove a builder matches live BEFORE re-running it),
`tools/builds/`. Related dms skills:
`creating-pages-from-a-design-pattern`, `transcribing-a-design-card-to-dms`, `card-layout`,
`modal-section-group`, `authenticating-the-dms-cli`.
