# builds/ — owning build scripts (content-as-code)

One committed, idempotent build script per page: find-or-create by slug, **wipe by PAGE ID with
loud failures** (never by slug — a slug-addressed delete silently no-ops and every rebuild
doubles the page's sections), recreate sections in order. The QA fix loop
(`qa_skills/qa-fix-ticket.md`) patches THESE scripts and re-runs them — never hand-edit a
section a script here owns. Run from the dms-template root with `DMS_AUTH_TOKEN` set
(mint via `src/dms/packages/dms/cli/bin/mint-token.mjs`). Draft-only: none of these publish.

Two lineages (task `planning/transportny/tasks/current/qa-build-scripts-migration.md`):
- **MIGRATED** — human-written scripts moved from scratchpad 2026-07-07, wipe-hardened.
- **GENERATED** — exported from the live draft state by `../page_to_build.mjs` (verbatim
  content-as-code; fidelity-gated: rebuild + re-export identical). Regenerate after intentional
  live/authored changes: `node ../page_to_build.mjs --pattern <p> --slug <s>`.

| Script | Page(s) | Lineage | Fidelity |
|---|---|---|---|
| build_cr_overview.mjs | sitemgmt/overview 2184939 | migrated | rebuilt 2026-07-07 ✓ |
| build_cr_page.mjs | sitemgmt/page 2185886 | migrated | rebuilt 2026-07-07 ✓ |
| build_cr_tickets.mjs | sitemgmt/tickets 2185867 + ticket 2185870 | migrated | rebuilt from HERE 2026-07-07 ✓ |
| build_cr_design.mjs | sitemgmt/design 2186739 | migrated | last run 2026-06-30 — gate before first fix-loop rebuild |
| build_tsmo_home.mjs | tsmo2/home 1431215 | migrated | rebuilt 2026-07-07 ✓ (also seeds groups JSON) |
| build_tsmo_congestion.mjs | tsmo2/congestion_v2 2175676 | migrated | last run weeks ago — **gate before rebuild** (author drift possible) |
| build_tsmo_reliability.mjs | tsmo2/reliability_v2 2180946 | migrated | same caveat |
| build_tsmo_incident_search.mjs | tsmo2/incident_search 2183804 | migrated | same caveat |
| build_fa_home.mjs | freightatlas2/home 2174663 | migrated | same caveat |
| build_fa_gallery_about.mjs | freightatlas2/maps_gallery 2174664 + **about 2174665** (slug-swap per #107 done; about_deprecated DELETED 2026-07-13) | migrated | gallery rebuilt DATA-DRIVEN 2026-07-13 per the new design: tiles = live figures from `freightatlas_maps` (2189815/v2189816), 8 category groups, live status chips, `?layers=` deep-links. Gotchas encoded in comments: pageSize REQUIRED with usePagination:false; no literal ' as ' in calc string literals (chr(32) dodge). |
| build_tsmo2_about.mjs | tsmo2/about 2184040 | generated | gated ✓ |
| build_tsmo2_methodology.mjs | tsmo2/methodology 2184101 | generated | gated ✓ |
| build_tsmo2_incidents_v2.mjs | tsmo2/incidents_v2 2181461 | generated (captures the #101 view-link fix) | gated ✓ |
| build_tsmo2_workzones_v2.mjs | tsmo2/workzones_v2 2182386 | generated | gated ✓ |
| build_tsmo2_incident_view.mjs | tsmo2/incident_view 2182470 | generated | gated ✓ |
| build_tsmo2_corridor_view.mjs | tsmo2/corridor_view 2182912 | generated | gated ✓ |
| build_freightatlas2_freight_atlas.mjs | ~~freightatlas2/freight_atlas 1411761~~ **STALE — owner retired 1411761 2026-07-16** | generated (460KB map symbology — payloads via temp files) | The sitemgmt `freightatlas2` surface now tracks the SANDBOX pattern 2175436 → page **2189762** / map section **2189767** (config row 2186151). That page is NOT build-owned; its symbologies are edited directly (see `qa-fix-map-symbology-tickets.md`). TODO: regenerate this build against 2189762 (or retire it) so the tracked page is build-owned again. |
| build_npmrds2_map_21.mjs | npmrds2/map_21 1473731 | generated | gated ✓ |

**Fidelity gate** (mandatory before a script's FIRST fix-loop rebuild if flagged above): baseline
`qa_assess.mjs` + section count → run the script → section count unchanged, no new findings,
`page_to_build.mjs` re-export diff clean.

**Not owned here** (out of scope): the 7 no-design tracked pages (pending prune decision);
`build_map21_lottr.mjs` (npmrds_sub report page), `build_emp_overview.mjs`,
`build_avlgraph_trends.mjs`, `build_s02/s03` (non-tracked pages) — still in scratchpad.

**Large payloads**: `dms section create --data` accepts a FILE PATH or `-` (stdin) as well as
inline JSON (CLI patched 2026-07-07) — generated scripts always write payloads to temp files;
migrated scripts using inline JSON are fine below ~100KB.

**Editable Card cells need an explicit `type` (2026-07-16 gotcha)**: making a Card column
editable-in-view takes BOTH `allowEditInView` (section + column) AND an explicit editable
columnType. A bare `col(name, label, {...})` sets **no `type`**, so the cell falls to `Card.jsx`'s
read-only `DefaultComp` and silently won't edit even with `allowEditInView` on (it still renders
the value in view, so the bug is invisible until you try to edit). Use `type: "textarea"` for
prose/multi-paragraph fields (multi-line box; `type: "text"` is a single-line `<input>` — wrong for
prose), `status_pill`/`select` for dropdowns. Worked example: `build_cr_tickets.mjs`'s `tacol`
helper + the Details-rail `efld` helper. Full explanation in `src/dms/skills/card-layout.md`
("Defaults that bite").
