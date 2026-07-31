# Dynamic Reports, Route Tags & Add-Route Flow — next-phase scoping

## Status: IN PROGRESS — core architecture decided for all 3 items (2026-07-31, across three rounds of same-day follow-up). Item 2 (Route Tags) Phase 1 — manual tag storage + editing UI — is DONE and live-verified (2026-07-31, see item 2's "Implementation Plan" section). Remaining opens are sequencing + a few scheduling/verification items, see "Open questions" at the bottom.

**Priority directive (2026-07-31):** this arc (all items below) takes priority over every other
currently-tracked gap/bug in the reports/routes space — `report-route-ui-parity-gaps.md`,
`report-page-template-editorial-slots.md`, `cold-open-ux-findings.md`'s recommendations, etc. —
until re-triaged. Nothing below has been broken into an implementation plan yet; this file exists
to get three related, somewhat-rambly ideas into one coherent, cross-referenced shape before the
next round of back-and-forth on scope/priority/detail.

## Context that applies to all three items

- Ryan's coworker is doing visual/design work across these repos (still under construction). Don't
  block on it, don't tightly couple anything below to it, don't treat current in-progress design
  work as settled — it'll get applied on top of whatever gets built here, later.
- Old-tool reference point Ryan gave: `https://npmrds.devtny.org/report/edit/1071` — an
  `admin2.templates` row ("template" in the old tool's vocabulary), which is the direct conceptual
  ancestor of "Dynamic Report" below.
- Starting point Ryan gave for old-tool/DB spelunking: `src/dms/planning/tasks/current/old-reports-conversion.md`.
- **These three items are not independent.** Item 2 (Route Tags) is infrastructure that items 1 and
  3 both consume — it is not a parallel third track, it's closer to a dependency underneath the
  other two. **Confirmed 2026-07-31: items 1 and 3 also share one UI component** — the tag-folder
  route-picker modal — not just the tags underneath it. See "Open questions" below.

---

## 1. Add Route Flow (RRL)

**The problem, in Ryan's words:** adding a route to a report today is "overwhelming / confusing /
IDK where to look."

**Current state.** Per `reportroutelist.md`, the RRL add-flow is currently a flat inline box: empty
input shows recently-created routes, typing 2+ characters searches by name, clicking a result adds
immediately. This is itself the result of a rebuild (2026-07-29) that replaced an earlier
separate-catalog-section-plus-confirm-banner flow, and it held up fine in the 2026-07-31 cold-open
UX walkthrough (`cold-open-ux-findings.md`) — "worked immediately, no confirm-dialog friction." That
walkthrough was against a small number of routes, though. A flat recent-list + name search doesn't
scale as an organizing principle once there are hundreds of routes on the books, which is exactly
what item 2 below is about to produce.

**Direction:** mirror the *organizing effect* of the old tool's folder browser — not its literal
folders-under-the-hood model — so a user can narrow down to a manageable subset before
searching/scanning, the way folder navigation did in the old tool. Explicitly **not** real folders
in the data model; the actual mechanism is tags (item 2). `research/route-creation/findings.md`'s
"Route organization (folders)" section (~line 296 on) already has a thorough writeup of exactly how
the old tool's folder browser worked and behaved, sourced directly from the transportNY code — good
inspiration material, already on file.

**Sub-item — Add Graph/Section flow.** A related but distinct pain point Ryan raised in the same
breath: adding a graph/section to a report by hand is "hard/ambiguous" today. Proposed direction:
move this into the RRL too, via a modal that shows a live preview of the graph plus descriptive
prose about what it's for / what it displays. Stated benefits: control over defaults, sibling-section
wiring, auto-assigning routes to the new graph. This is a concrete, buildable instance of the gap
`guidance-layer-findings.md` (2026-07-31) already identified in the abstract — the reports/routes
tools currently have no "guidance layer" at all (nothing tells the user what a thing is for or how
to use it) — worth reading that doc's framing before designing this modal's copy/behavior.

**Confirmed, 2026-07-31: part of this arc**, not a peer item — tracked here alongside Add Route
Flow, even though mechanically it's about adding graphs, not routes.

**Decided, 2026-07-31: shared modal.** The same tag-folder-browsing modal used for Dynamic
Reports' route-slot-fill (item 3's no-URL-param case) will also replace the inline box for
*normal* reports' add-route flow — one shared modal component, not two separate builds. It differs
only in selection constraints (normal reports: any number, uncapped; Dynamic Reports: exactly N,
gated by route-slot count) and in what happens after selection (normal: RRL adds the route(s)
directly; Dynamic Report: sets the URL param via the page-variable system, see item 3). This makes
item 2 (tags) even more clearly the thing to build first — both item 1 and item 3's actual UI work
now route through the same component.

---

## 2. Route Tags ("folder approximation")

**Explicit non-goal:** real folders in the data model. **Goal:** tags on routes, plus a UI built
over those tags that *looks and feels* like folder browsing.

**Auto-generated routes + tagging scheme.** The old tool auto-generates a large number of routes
for continuous TMC-linear chains; the plan is to port or replicate that generation. Ryan's
`auto_generated`/`tmc_linear`/`county:{county_fips}` scheme was **illustrative only, not a spec.**

**Tag taxonomy — start from the old DB, don't invent from scratch (2026-07-31 clarification).**
Next concrete step: infer a starting tag vocabulary by inspecting how the old tool's folders were
actually structured — names/hierarchy/categories used in the `folders2` tree (see
`research/route-creation/findings.md`'s folder findings, ~line 296). The folder *structure* is real
signal even though the old tool had no tagging system of its own. Not yet done — a DB-inspection
task queued for whenever this item gets picked up, not attempted yet.

**Users can add their own tags too (2026-07-31 clarification).** Tags aren't only system-applied
(generation provenance, geography). Authors need to be able to add custom tags to routes as well —
needs its own UI (tag entry/management, likely on the route save/edit flow or a dedicated
manager), not just a fixed backend taxonomy.

**Technical grounding, checked 2026-07-31 — this is likely cheaper than it sounds.** Two things
looked into on Ryan's "something to look into" prompt:

- **Storage.** Routes made by the new (dms-template-native) routecreation tool are already DMS
  *dataset* rows — `INTERNAL_ROUTES_TYPE = 'routes_data'` in
  `src/themes/transportny/components/routecreation/constants.js`, stored as a split type
  (`{sourceType}|{viewId}:data`, `comp.jsx:174`). `SaveRouteModal.jsx` today only has **Name** and
  **Description** fields — no Folder field (consistent with the 2026-07-23 deferral), no tags
  field yet. So a `tags` field would be a genuinely new column on this dataset, not a repurpose of
  something existing.
- **Filtering.** DMS already has a generic, production-proven, fully-tested UDA filter operation
  for exactly this shape: `array_contains`/`array_not_contains`
  (`src/dms/planning/tasks/completed/uda-array-contains-filter.md`, DONE), built for `multiselect`
  JSON-array columns (real examples in production: `county: ["Greene"]`, `role: ["Planner",
  "Stakeholder"]`). Querying "routes tagged `county:36001`" is `WHERE data->'tags' @>
  '["county:36001"]'::jsonb` — already-supported SQL, no new query engineering. This means the
  "should tags be a generic DMS primitive or an NPMRDS-bespoke field" question mostly answers
  itself: give the routes dataset a `tags` column typed `multiselect`, and the existing generic
  filter machinery just works.

**Decided, 2026-07-31: tag editing lives in `SaveRouteModal.jsx`.** A Tags field goes in the same
place as today's Name/Description fields — no separate tag-management surface for now.

**Scope limiter (2026-07-31 clarification):** whether all old reports/routes/templates map cleanly
into the new tag system is TBD, and how much that's worth caring about is *also* TBD — per Ryan,
don't over-invest in a lossless migration; a partial/lossy mapping is fine to start with, revisit
if it turns out to matter.

Note this "auto-generate by following a continuous TMC-linear chain" mechanism is a **different**
thing from the marker-placement/auto-*routing* work tracked in `route-creation-tool.md` (which
resolves a road-network path between user-dropped map markers via the external
`routing2.availabs.org` service). This item is a batch, data-driven process over TMC network
metadata, not an interactive map-drawing feature.

**TMC linear/sequence field — Ryan recalls this already exists (2026-07-31), not yet independently
verified.** "Already on the table" — i.e. the TMC metadata is believed to already carry a
linear/sequence field the auto-generation can chain on directly, no new derivation logic needed.
Worth a quick confirm-against-the-actual-schema pass before building on it (likely
`TMC_IDENTIFICATION_JOIN` or similar, per `src/dms/documentation/npmrds-data-sources.md`'s
measure→source mapping), but not re-litigating the question itself.

**Standing ruling — confirmed superseded, 2026-07-31 (not just "doesn't conflict").** Memory
`project_reports_folders_discovery_permissions_out_of_scope` (2026-07-27) had put "folders,
discovery/browsing, and permissions" **permanently out of scope** for the reports/routes arc — DMS
natives would supply that later. I'd initially guessed today's ask was scoped narrowly enough not
to actually conflict with that ruling (system-applied route tags vs. the old ruling's report
discovery/manual-folder-field target). Ryan corrected this directly: it *was* a real, accurate
scope-out at the time, but "things change" and folders — as a user-facing organizing concept, still
backed by tags rather than the old data model — are now explicitly **back in scope** for route
organization, and porting similar functionality from the old tool is wanted. Ryan confirmed asking
was the right call rather than assuming either way (see memory
`feedback_flag_standing_decision_reversals`). The memory has been amended to reflect this.

**Confirmed, 2026-07-31:** the reversal covers route organization/tagging specifically (this item)
only. Report discovery/index page work and the permissions/ACL model remain out of scope — that
part of the original ruling still stands.

**Implementation Plan — Phase 1: manual tag storage + editing UI — DONE, live-verified
2026-07-31.** Scope: get `tags` working end-to-end for manual/custom tagging on the existing
routecreation tool — schema, save/load wiring, and an editing UI. Does **not** include the shared
tag-folder-browsing modal (item 1/3's UI, consumes this later), the old-DB folder-taxonomy
inspection, or TMC-linear auto-generation — those stay separately scheduled (see "Open questions").

**Verification (2026-07-31):** live-tested against `converted_reports/route_creation_demo`
(subdomain `npmrds`, `http://npmrds.localhost:5173/converted_reports/route_creation_demo`).
Created a route (TMC `104N04120`) with tags `test_tag_one` + `county:albany` via the new Tags
chip field → saved → confirmed via `dms dataset query "Routes Data" --view 2107427 --filter
id=<new-id>` that `data.tags` is a real JSON array string, `["test_tag_one","county:albany"]`,
stored exactly like `tmc_array`. Reloaded the page fresh at `?route_id=<new-id>` → both tags
round-tripped correctly into the "Update Route" modal as removable chips. Separately loaded a
pre-existing route with no `tags` data at all (id 2122037) → no crash, Tags field renders empty,
confirming `curRouteFromApi[TAGS_COL] ? JSON.parse(...) : []` handles the missing-field case. One
leftover test row exists in the live dataset from this pass (route "Claude Tags Test Route",
id in the 2198xxx range) — harmless scratch data, not cleaned up (per the dataset being disposable
dev data), safe to delete opportunistically.

1. **Add a `tags` column to the `routes_data` dataset — on the SOURCE row, not the view.**
   Column-type config for DMS's generic multiselect/`array_contains` filtering lives on the
   source row's `data.config` (a JSON-*encoded string*) → `.attributes[]`, keyed by `name`.
   Confirmed via `buildUdaConfig.js`'s `columnsWithSettingsByName` merge chain
   (`src/dms/packages/dms/src/patterns/page/components/sections/components/dataWrapper/buildUdaConfig.js`,
   `buildColumnsWithSettings` ~line 765, merge ~lines 1326-1328) and `useDataSource.js`'s
   `getSources()` (`attr === "config"` case, ~lines 64-69: `columns = JSON.parse(source.config).attributes`).
   Target row: source id `2107426` (type `datasets_env|routes_data:source`, app `npmrdsv5`).
   Current `config.attributes` has 11 entries, **all `type: "text"`** (route_id, name,
   description, tmc_array, points, conflation_array, conflation_version, created_by, created_at,
   updated_at, metadata) — confirmed live via `dms raw get 2107426`, 2026-07-31. No column in this
   app has ever used `multiselect` (checked all 15 internal-table sources in `npmrdsv5`/`dev2` —
   `text`/`textarea`/`number`/`integer`/`date`/`select` only), so there's no live example to copy;
   template comes from `RenderField.jsx`'s `fieldTypes` list (`multiselect` = "dropdown (multiple
   choice)") and `buildUdaConfig.test.js`'s fixtures (`{name, type: "multiselect"}`) instead. New
   attribute entry to append:
   ```json
   {"name": "tags", "display_name": "tags", "options": null, "type": "multiselect", "required": false}
   ```
   `options: null` is fine for free-form tag entry (no fixed vocabulary yet); the array-contains
   filter engine only checks `col.type === "multiselect"`, it doesn't require `options` populated.
   **Mechanics — full `data` replace, not a dotted `--set`.** `config` is itself a JSON-encoded
   string; per `feedback_dms_raw_update_set_json_string_footgun`, a dotted `--set
   config.attributes=...` would corrupt it by re-nesting into `{"attributes": [...]}` and dropping
   sibling keys. Instead: fetch the row, `JSON.parse(data.config)`, append the new attribute
   object, `JSON.stringify` the whole thing back, then do a full `--data` replace of the row's
   entire `data` object (preserving `is_dirty` etc.) — same pattern as `convert_old_reports.py`'s
   `dms()` helper. Purely additive: every existing column and row is untouched, so this can't
   affect anything currently reading `routes_data` (e.g. the routes behind the shipped NY-9D
   Beacon report).

2. **Wire the routecreation tool itself to read/write `tags`.** `comp.jsx` bypasses
   `buildUdaConfig` entirely for this dataset — it reads/writes via ad-hoc raw `data->>'col' as
   col` SQL — so step 1 alone won't make the tool show or save tags; needs explicit wiring, same
   pattern as the existing fields:
   - `INITIAL_MODAL_STATE` (`comp.jsx` ~line 30-35): add `tags: []`.
   - `addItem` (~line 153-170): add `tags: JSON.stringify(modalState.tags || [])` to `payload` —
     same explicit-stringify treatment as `tmc_array`, unlike `name`/`description` which are
     plain strings.
   - Load effect (~line 206-236): add `const TAGS_COL = "data->>'tags' as tags"` to the falcor
     get's column list; `JSON.parse(curRouteFromApi[TAGS_COL] || "[]")` into `modalState.tags`
     alongside `name`/`description`.

3. **Tags field in `SaveRouteModal.jsx`.** Per the 2026-07-31 decision, goes alongside
   Name/Description, no separate tag-manager surface. No fixed taxonomy exists yet (old-DB
   inspection not done), so this is a free-form multi-tag chip input, not a `<select multiple>`:
   type text, Enter/comma commits a tag as a removable chip, reports the full array back via
   `setRouteMeta({ tags: [...] })`. New small component alongside the existing `ModalInputField`
   in the same file, following its controlled-input/`path`/`onChange` pattern.

4. **Live-verify.** Create a route via the routecreation tool, add 2+ tags, save; confirm via
   `dms raw get` that `data->>'tags'` is a real JSON array on the new row. Re-open that route for
   editing; confirm tags round-trip into the modal. Confirm an existing pre-tags route still
   loads fine with an empty tags list (no crash on missing/null `tags`).

**Old-tool reference material already on file.** `research/route-creation/findings.md` documents
the old tool's folder system in real detail — folder types `user`/`group`/`AVAIL`, arbitrary nesting
via a `folders2 user tree` falcor call, metadata of name/type/owner/icon/color, Fuse.js search over
name+description only — and states plainly: **the old tool has no tagging system anywhere**
(checked `RouteSaveModal`, `FolderModal`, `StuffInfoModal`). So "tags instead of folders" is new
design work, not a port of something the old tool already had. The old UI is inspiration for the
*organizing effect* only, per Ryan's own framing.

**Continuity note.** A "folder field in save/move" for routes was already flagged and deliberately
deferred once before, 2026-07-23 (`research/route-creation/findings.md` Part 4, also noted in
`route-creation-tool.md`'s "Open items"). This item is that deferred thread, picked back up, now
shaped as tags instead of folders.

---

## 3. Dynamic Reports

**Core idea.** A new report-template kind, using the existing generic Page Templates system
(`src/dms/planning/tasks/current/page-templates.md`, Phases 1-5 already coded) as a starting point
— but with a behavior Page Templates doesn't currently have: routes aren't permanently assigned to
the page. Instead the template defines N "route slots," filled **at view time** via a URL param
(e.g. `?routes=123456`), the same way the old tool's page templates worked.

**Architecture confirmed, 2026-07-31: one shared page per template, not one row per use.** A
Dynamic Report template is a single DMS page that gets reused/shared across every use — e.g. one
"Single Route Year by Year Beginner Template" page exists, ever, and everyone reaches it with a
different `?routes=` value. Nobody "creates" a Dynamic Report the way they create a normal report
today; they just navigate to an existing template page. Follow-on implications, not yet resolved:

- **Editing the template's own structure** (which graphs/panels it has) now touches a page that's
  live for whoever else is viewing it at the time. DMS's existing draft-vs-published page model
  (`draft_sections` vs. published `sections`, per `page-templates.md`) likely already covers this,
  but it's worth confirming explicitly rather than assuming — a shared page is a different
  edit-safety situation than a normal report page nobody else is looking at.
- **How many template pages actually get created?** This item's "Old-template porting" decision
  below says port the old tool's 216 templates as content — does that mean up to 216 actual Dynamic
  Report pages, or a curated subset? The 2026-07-27 investigation this doc already cites found real
  structure here worth reusing for that decision: only 43% coverage in the top 20 shapes by
  whole-template signature, but panels are highly concentrated (top 12 panel kinds cover 49% of
  usage) — so "which ones get ported" may want to follow panel frequency rather than porting all
  216 uniformly.

**Terminology flag.** "Slot" is already used elsewhere in this same arc for a different concept —
`report-page-template-editorial-slots.md` uses "slot" for editorial/content placeholders (a hero
stat callout, etc.), unrelated to routes. Worth deliberately saying "route slot" throughout and
never bare "slot," so the two don't get conflated in future docs/conversation.

**No-URL-param behavior.** Navigating to a Dynamic Report without the URL param should pop a modal
letting the user pick routes by browsing the tag-derived "folders" from item 2, capped/required to
exactly the number of route slots the template needs. Ryan's reference point: this is how the old
public landing page (`npmrds.transportny.org`) worked, and it's the model for how his coworker's
new landing page (in progress, separately, out of scope here) will eventually link into these
reports.

**Likely existing mechanism to build on, not invent.** DMS already has an established architecture
for exactly "a URL param drives page behavior": the page-variable system described in the
`creating-interactive-pages.md` skill and `src/dms/planning/tasks/current/derived-page-variable.md`.
The rule there: **the page is the single owner of URL params; any URL param is a page variable;
components connect to it through the existing filters/actions system, never by reading the URL
directly.** "Route slots filled via URL param" is very likely a new consumer of that existing
system, not new URL-parsing plumbing — worth reading those two docs before designing this, not
after.

**Old-tool mechanism this is closest to (already investigated).** The old tool's `admin2.templates`
table already models almost exactly this: a `routes` column that's a **slot count (1-9, mode 1)**,
plus `route_comps`/`graph_comps` referencing `comp-N` placeholders resolved against whichever real
route IDs get supplied at use time. The old folder browser's bulk "Open in Template" action only
enables when the number of selected routes exactly matches a template's slot count — i.e. exactly
the cap/require behavior Ryan described for the picker modal. Full investigation:
`planning/tasks/current/client-request-to-report-skill-archive.md` (~lines 20-90).

**Old-template porting — confirmed superseded, 2026-07-31 (not a mechanism-vs-content split).**
Ryan flagged this tension himself: "may be in conflict with earlier guidance I gave you." The
earlier guidance (2026-07-27 investigation, `client-request-to-report-skill-archive.md` ~lines
20-90) concluded **do not port the old tool's 216 `admin2.templates` rows as our report-template
library** — they don't cluster into reusable archetypes (top 20 shapes cover only 43% of
templates), and the better model is a composition rule over a panel vocabulary parameterized by
route-slot count. Related: memory `feedback_template_catalog_end_goal` (vocabulary breadth over
numeric/content fidelity, same spirit).

My first guess was that today's ask only wanted the *mechanism* (route-slot count, URL-param fill),
not the template *content*, and so didn't really conflict with the 2026-07-27 finding. Ryan
corrected this, same pattern as the folders ruling above: that decision was right *at the time*
("it was easier to consider them out of scope"), but now the old templates should actually be
**ported into the new system as content**, not just referenced for their mechanism — while
**keeping the dynamic (route-slot/URL-param) behavior intact**, i.e. a ported template must not
collapse into a statically-route-bound report. So: port the old templates for real, into the new
Dynamic Report system, dynamic behavior preserved. See memory
`feedback_flag_standing_decision_reversals` for the general pattern (this is the second instance of
the same correction in the same conversation).

**Dynamic naming.** The old tool's dynamic reports have names with bracket placeholders (e.g.
`{type}`) filled in dynamically in various places. Needs its own pass once implementation starts —
not scoped further here.

**Out of scope here:** the landing page itself — that's the coworker's design work, applied later.
Dynamic Reports just needs to end up linkable-into from wherever that lands.

---

## Open questions for triage

Still open:

1. Priority order across the three items (and the Add-Graph sub-item under #1) — sequential or
   parallel? (Item 2 + the shared modal are clearly first among equals now; the rest of the
   ordering isn't decided.)
2. Old-DB folder-structure inspection to derive a starting tag taxonomy (item 2) — not yet done,
   needs scheduling relative to the rest of this arc.
3. Since Dynamic Report template pages are shared/reused (not per-instance), does editing a
   template's structure need any special draft/publish handling beyond what DMS pages already do,
   to avoid disrupting a concurrent viewer? Probably already covered by the existing
   draft-vs-published model — not confirmed.
4. How many of the old tool's 216 templates actually get ported as real Dynamic Report pages — all
   216, or a curated subset following panel-frequency concentration (see item 3's architecture
   note)?

Resolved 2026-07-31 (same-day, across two follow-up rounds):

- ~~The folders-out-of-scope boundary check under item 2~~ — confirmed superseded, not just
  non-conflicting, and confirmed scoped to route organization only. See item 2's "Standing ruling"
  section.
- ~~The old-template-porting tension under item 3~~ — confirmed superseded: port the old templates
  as content, keep them dynamic. See item 3's "Old-template porting" section.
- ~~Generic DMS tags primitive vs. NPMRDS-bespoke~~ — moot: the routes dataset gets a `multiselect`
  `tags` column and rides the existing generic `array_contains` UDA filter. See item 2's
  "Technical grounding" section.
- ~~Where does tag-editing UI live~~ — `SaveRouteModal.jsx`, alongside Name/Description.
- ~~Shared modal for normal + Dynamic Report route-picking~~ — yes, one shared component.
- ~~Dynamic Report page model: shared vs. per-instance~~ — one shared page per template. See item
  3's "Architecture confirmed" section for follow-on implications.
- ~~Is the Add-Graph modal part of this arc or a peer item~~ — part of this arc.
- ~~Does TMC metadata already carry a linear/sequence field to chain on~~ — Ryan recalls yes, not
  yet independently verified against the schema. See item 2's tagging-scheme section.

## Cross-references

- `research/route-creation/findings.md` — old tool's folder system (Part 4 area, "Route
  organization (folders)"), and the marker-placement/auto-routing work (a different "auto" than
  item 2's)
- `planning/tasks/current/route-creation-tool.md` — route creation tool current status; folder
  field explicitly deferred 2026-07-23
- `planning/tasks/current/reportroutelist.md` — RRL add-flow history (3 rounds so far)
- `research/npmrds-reports/cold-open-ux-findings.md` — first-60-seconds friction findings,
  motivates item 1
- `research/npmrds-reports/guidance-layer-findings.md` — "does the tool tell the user anything"
  axis, motivates item 1's Add-Graph sub-item
- `src/dms/planning/tasks/current/page-templates.md` — generic Page Templates system, baseline for
  item 3
- `src/dms/planning/tasks/current/derived-page-variable.md`, skill `creating-interactive-pages.md`
  — page-variable/URL-param architecture, likely mechanism for item 3
- `planning/tasks/current/client-request-to-report-skill-archive.md` (~lines 20-90) — old tool's
  216-template route-slot analysis
- `planning/tasks/current/report-spec-and-build-script.md`,
  `research/npmrds-reports/report-spec.md` — declarative report spec, relevant to how Dynamic
  Report templates might get authored
- `planning/tasks/current/report-route-ui-parity-gaps.md` — has the same folders-out-of-scope
  ruling restated (line ~26)
- `planning/tasks/current/report-page-template-editorial-slots.md` — the other, unrelated sense of
  "slot" in this arc
- memory `project_reports_folders_discovery_permissions_out_of_scope` — the prior ruling item 2
  partially supersedes (amended 2026-07-31); report discovery/index page and permissions/ACL
  pieces of that ruling still stand
- `src/dms/planning/tasks/completed/uda-array-contains-filter.md` — the generic multiselect
  array-contains filter item 2's tag filtering can ride on directly
- `src/themes/transportny/components/routecreation/constants.js`,
  `components/SaveRouteModal.jsx` — current route storage shape (`routes_data` dataset, split
  type) and current save-modal fields (Name/Description only)
