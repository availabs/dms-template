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
| build_cr_overview.mjs | sitemgmt/overview 2184939 | migrated | rebuilt 2026-07-29 ✓ (landing enrolled; before/after payload diff clean — see note) |
| build_cr_page.mjs | sitemgmt/page 2185886 | migrated | rebuilt 2026-07-07 ✓ |
| build_cr_tickets.mjs | sitemgmt/tickets 2185867 + ticket 2185870 | migrated | rebuilt from HERE 2026-07-07 ✓ |
| build_cr_design.mjs | sitemgmt/design 2186739 | migrated | last run 2026-06-30 — gate before first fix-loop rebuild |
| build_tsmo_home.mjs | tsmo2/home 1431215 | migrated | rebuilt 2026-07-07 ✓ (also seeds groups JSON) |
| build_tsmo2_congestion_v2.mjs | tsmo2/congestion_v2 2175676 — **2026-07-31 (row 2197899): the §04 "Worst corridors" link column now BUILDS its href in SQL** (`'/corridor_view?county=' \|\| meta.county \|\| '&road=' \|\| meta.road \|\| '&direction=' \|\| meta.direction as view_link`). With `searchParams:"none"` the cell value *is* the href and nothing is appended, so all 12 rows had been landing on corridor_view's defaults. `\|\|` is mandatory here — a calc column must contain NO COMMAS, which rules out concat/format/replace. Draft-only; **awaiting publish.** | generated (replaced the stale migrated build_tsmo_congestion.mjs 2026-07-20 — it had drifted 19 vs live 20 sections and was guard-throwing; regenerated from live) | gated ✓ 2026-07-20 (rebuild 20/20 + re-export diff clean) · **parity re-proven 2026-07-31 before the fix run** (`fidelity_static` 20/20 identical), rebuilt 20/20, and 20/20 again afterwards |
| build_tsmo_reliability.mjs | tsmo2/reliability_v2 2180946 | migrated | same caveat |
| build_tsmo_incident_search.mjs | tsmo2/incident_search 2183804 | migrated | same caveat |
| build_fa_home.mjs | freightatlas2/home 2174663 | migrated | **gated ✓ 2026-07-31** — static parity proven BEFORE the run (27/27 sections byte-identical to live draft, group uuids aside), then rebuilt 27/27 for #196 + #200 items 2–3, and parity re-proven after. `fidelity_static.mjs` **cannot** be used here (migrated ⇒ no `const SECTIONS` literal; it grabs the first `[…]` in a comment and dies on `[BACKFILL→Graph]`) — see the migrated-builder parity recipe below |
| build_fa_gallery_about.mjs | freightatlas2/maps_gallery 2174664 + **about 2174665** (slug-swap per #107 done; about_deprecated DELETED 2026-07-13) | migrated | gallery rebuilt DATA-DRIVEN 2026-07-13 per the new design: tiles = live figures from `freightatlas_maps` (2189815/v2189816), 8 category groups, live status chips, `?layers=` deep-links. Gotchas encoded in comments: pageSize REQUIRED with usePagination:false; no literal ' as ' in calc string literals (chr(32) dodge). |
| build_tsmo2_about.mjs | tsmo2/about 2184040 | generated | gated ✓ |
| build_tsmo2_methodology.mjs | tsmo2/methodology 2184101 | generated | gated ✓ |
| build_tsmo2_incidents_v2.mjs | tsmo2/incidents_v2 2181461 | generated — **REGENERATED from live 2026-07-27** after a re-run silently reverted the 07-16 graph fix (`yAxis.tickSpacing` 2000000 → 2) despite a matching 32-section count. Now carries a runtime parity guard + a pointer to `fidelity_static.mjs`, which is the check that catches same-count drift. | gated ✓ 2026-07-27 — static fidelity 32/32 identical to live, rebuild 32/32, re-export diff clean, `AxisLeft` warning gone and graph verified rendering ~5 ticks at 2M |
| build_tsmo2_workzones_v2.mjs | tsmo2/workzones_v2 2182386 — **§04 "Active work zones" REMOVED 2026-07-28 (#180, out of scope): 34→28 sections, 8→7 groups, group indices re-sequenced. Parity proven before the edit (34==34 byte-identical), the 6 live placeholders deleted so the runtime guard could pass honestly (28==28), rebuilt 28/28.** · **2026-07-31 (row 2197900): §01 graph unit fix — SECTIONS[9] `round(sum(vehicle_delay)/1e6,1) as delay_mvh` → raw `round(sum(vehicle_delay)) as delay_vh`, `yAxis.tickSpacing`/`domainMin` dropped, `margin.left` 44→64; SECTIONS[8] label/kicker follow. Patched-and-re-ran (fidelity 28/28 before AND after). See the builder's header block — it records which graph_new yAxis keys are real.** | generated — **REGENERATED from live 2026-07-27** after drifting 28 vs live 34 (it had been marked "STALE — DO NOT RUN" since it regressed the drafts on 2026-07-15/16). Now carries a **runtime parity guard** instead of that hand-written throw: it compares the live draft section count to `SECTIONS.length` *before* wiping and refuses if they differ. | gated ✓ 2026-07-27 — static fidelity (all 34 exported sections byte-identical to live) + rebuild 34/34 + re-export diff clean + guard verified to refuse a deliberately drifted copy without touching the page |
| build_tsmo2_incident_view.mjs | tsmo2/incident_view 2182470 — **2026-07-28 (row 2196812): event-POINT layer added over source 956/view 1947 (always-on, serverSide event_id, `layer-type` MUST stay `""` — `"categories"` triggers a 66k-value domain fetch), hideIfNull notice Card, statewide initialBounds. Backported a live `height` edit ("fill"→"1/3") that fidelity_static caught. Guard gained an `ALLOW_SECTION_COUNT_CHANGE=1` opt-in for intentional structural changes.** | generated | gated ✓ |
| build_tsmo2_corridor_view.mjs | tsmo2/corridor_view 2182912 | generated + hand-fix 2026-07-27 (#103/#159/#181: corridor strip map added to the empty "Compare & map" group — Map section over source 582/view 984, serverSide county/road/direction/**year** filters) | gated ✓ · rebuilt 24/24 2026-07-27 |
| build_freightatlas2_freight_atlas.mjs | ~~freightatlas2/freight_atlas 1411761~~ **STALE — owner retired 1411761 2026-07-16** | generated (460KB map symbology — payloads via temp files) | The sitemgmt `freightatlas2` surface now tracks the SANDBOX pattern 2175436 → page **2189762** / map section **2189767** (config row 2186151). That page is NOT build-owned; its symbologies are edited directly (see `qa-fix-map-symbology-tickets.md`). TODO: regenerate this build against 2189762 (or retire it) so the tracked page is build-owned again. |
| build_npmrds2_map_21.mjs | npmrds2/map_21 1473731 | generated | gated ✓ |

**⚠ LIVE-EDIT DRIFT — check CONTENT, not section counts (2026-07-27 incident).**
`build_tsmo2_congestion_v2.mjs` was generated 07-20; two fixes (#156, #158) were applied on 07-21 by
editing the **live sections**; re-running the script on 07-27 silently reverted both. Section counts
matched (20 vs 20) because the drift was *inside* existing sections' column configs, so the count-parity
check passed. Restored 07-28 from the orphaned 07-21 published rows.

Before re-running ANY script here: re-export live (`node ../page_to_build.mjs --pattern <p> --slug <s>
--out /tmp/x.mjs`) and **diff against the committed script**, and check the ticket table for fixes whose
`resolved_date` is after the script's generation date on that `page_key`. If it happens anyway: the
pre-rebuild published section rows survive as orphans — `dms raw list "<app>+<pattern>|component"
--limit 2000` (plus `--offset`), grep for the lost config, lift `element-data` verbatim, fold it into
the script.

**Armed right now:** `build_tsmo_reliability.mjs` (migrated, ungated) predates **#165**'s 07-21 live fix
(map legend title no longer truncated to "W..") — re-running it as-is will revert that. Diff before use.

**MIGRATED builders can't use `fidelity_static.mjs` either — but they can still be parity-proven.**
The 9 migrated scripts have no `const SECTIONS` literal, so the tool matches the first `[…]` in the
file (a comment) and dies with `SyntaxError: Unexpected token 'B', "[BACKFILL→Graph]"`. **That crash is
not a licence to run the builder blind.** Recipe used for `build_fa_home.mjs` on 2026-07-31: copy the
script's source up to its `// ── apply` marker into a scratch harness, append the *same* payload
construction the apply loop does (`{size, group, title, element:{…}, border?, height?}`) and print it as
JSON — i.e. build what the script WOULD create without creating it — then diff each payload against the
live `draft_sections[i]` row using `fidelity_static.mjs`'s own `strip`/`denoise` normalisation, plus two
tweaks the migrated shape needs: parse `element-data` (a JSON *string*) before comparing so
re-serialisation whitespace doesn't false-alarm, and compare `group` as a **bijection** (exported uuid →
live uuid) rather than literally, since migrated scripts `randomUUID()` their band names on every run.
Same verdict semantics: all sections identical ⇒ running the script is provably content-neutral.

**GENERATIVE builders can't use `fidelity_static.mjs`.** It parses a `const SECTIONS = [...]` literal, so
it only works on scripts produced by `page_to_build.mjs`. The four `build_cr_*.mjs` scripts *compose*
their sections from live data, so use a **before/after payload diff** instead: dump the draft sections,
run the builder, dump again, and compare payloads grouped by their distinguishing key (for the overview,
the `surface` filter value). Pre-existing groups must come back byte-identical; anything else is either
an intended data-driven counter change or a regression. Worked example — the 2026-07-29 landing
enrolment: `tsmo2`/`freightatlas2`/`npmrds2` blocks byte-identical, only the header counter text moved
(`3 patterns · 19 pages` → `4 patterns · 20 pages`) plus the new `landing` block. **That diff earned its
keep**: it caught the overview's identity card printing `t.pattern` — which is the raw pattern **id**
`2175436` for the Freight Atlas row — so a client-facing card would have read "2175436 · 6 pages".
Fixed to key on `t.surface`. Two `sitemgmt_pages` reads also silently returned NOTHING until the CLI got
`DMS_AUTH_TOKEN`: the `sitemgmt` pattern is auth-gated, and an unauthenticated `raw get` on its pages
returns empty rather than erroring — always pass the token when touching control-room pages.

**⚠ VIEWING A PAGE IN `/edit` MUTATES ITS SECTIONS — it is itself a drift source (2026-07-28).**
Opening `/edit/<slug>` on a build-owned page makes the editor re-save the sections it renders, so a
builder that was byte-identical to live can fail `fidelity_static.mjs` minutes later with nobody
having authored anything. Two flavours, and only the second matters:

- *Harmless, now normalised by `fidelity_static.mjs`*: an unset page-variable leaf's `"value": []`
  comes back as `"value": [""]` (behaviourally identical — `buildUdaConfig` drops all-empty
  filter/exclude leaves, which is also what stops them compiling to `IN ('')` and blanking the
  section), and an empty `join: {"sources": {}}` is added.
- *Real config drift, still reported*: `useDataSource`'s runtime reconcile rewrites
  `externalSource` — `baseUrl` blanked, `isEditable` added, and every column def reshaped
  (`display_name` → `display: ""`, `"INTEGER"` → `"integer"`). Observed on incidents_v2 sections
  2196881/2196886 after a verification pass. The page still renders, but the committed builder and
  live have diverged — the same condition that let the 07-16 graph fix get reverted.

Practical rules: **verify page changes on the PUBLISHED view, or via the CLI, not `/edit`**, and if
you must open `/edit`, re-run the builder afterwards to restore parity (it is content-neutral when
fidelity passes) and re-check. Open question worth deciding once: adopt the editor-normalised
`externalSource` shape into the builders (regenerate, so the drift stops recurring) or keep
re-running to restore the authored shape — nobody has established whether the blanked `baseUrl`
matters.

**Fidelity gate** (mandatory before a script's FIRST fix-loop rebuild if flagged above): baseline
`qa_assess.mjs` + section count → run the script → section count unchanged, no new findings,
`page_to_build.mjs` re-export diff clean.

**Add a STATIC fidelity check before the first run of a regenerated script.** The two gate steps above
both require *running* the script, which is the destructive part — that is how workzones_v2 lost 6
authored sections on 2026-07-15/16. Cheaper and safer: export with `page_to_build.mjs --out <scratch>`,
then compare each exported `SECTIONS[i]` payload against the corresponding live `draft_sections[i]`
row's `data` (ignoring `id`/timestamps). If every section is byte-identical, running the script is
*provably* content-neutral and the gate becomes a formality.
(Worked example: `fidelity_static.mjs`, used for the 2026-07-27 workzones_v2 regeneration.)

**⚠ A matching section COUNT does not mean a builder is safe to run.** `build_tsmo2_incidents_v2.mjs`
was 32-for-32 with its live page and still silently reverted a fix when re-run (2026-07-27): the
2026-07-16 pass had changed the "Attributed delay by year" graph from millions-of-vehicle-hours to raw
vehicle-hours on the live draft — `display.yAxis.tickSpacing` `2` → `2000000` — and never backported
it. The rebuild restored `tickSpacing: 2` against a 0–9.79M domain, so `AxisLeft` began logging
*"ignoring tickSpacing 2 — it would produce 4893180 ticks (max 200)"* and falling back on every render.
Nothing failed loudly; the section count was identical and the page still drew.
**So: run `fidelity_static.mjs` before re-running any builder on a page that has been authored since
the builder was generated** — it is the only check that catches a same-count content drift. Recovery
came from the published rows, which a draft-only rebuild never touches.

**Every generated script now carries a runtime parity guard — `page_to_build.mjs` emits it** (as of
2026-07-28), so a regeneration no longer drops it and you don't hand-add it. It sits right after
`const existing = …draft_sections` and *before* the delete loop, refuses when
`existing.length !== SECTIONS.length`, and prints the exact `fidelity_static.mjs` command for that
page (real page id baked in). It replaces the old idiom of a hand-written `STALE — DO NOT RUN` throw
at the top of the file, which needed a human both to notice the drift and to remember to remove the
throw afterwards.

Verified by running a deliberately drifted copy (`SECTIONS.pop()`): it refuses with
*"REFUSING TO WIPE workzones_v2: the live draft has 34 sections but this builder carries 33"* and the
page is untouched — tested on both an emitted guard (workzones_v2) and a backfilled one (methodology).

**Coverage: 9 of 18 builders — every GENERATED one.** The guard was backfilled into the 7 generated
scripts that predate the generator emitting it (a pure code addition: it only takes effect on the next
run, so no rebuild and no page was touched to apply it). The **9 MIGRATED builders have no guard** —
they don't keep a `const SECTIONS` array (they create sections another way), so `SECTIONS.length` has
no meaning there and each needs its own "how many sections will I create" expression. Add it per
script, or regenerate them (which flattens hand-authored structure to a verbatim export — a trade to
make deliberately, not by default):
`build_cr_{design,overview,page,tickets}.mjs`, `build_fa_{home,gallery_about}.mjs`,
`build_tsmo_{home,incident_search,reliability}.mjs`.

**Two scripts remain stale** — `build_tsmo_home.mjs` still carries a `STALE` throw, and
`build_freightatlas2_freight_atlas.mjs` targets retired page 1411761 (the tracked page is 2189762).
Both want the same regenerate-and-gate treatment.

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
