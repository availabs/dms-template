# NPMRDS Reports/Route-Creation planning-doc consolidation

**Project:** TransportNY

## Objective

The NPMRDS Reports/Route-Creation work has accumulated ~18 task files across `tasks/current/` and
`tasks/completed/` (plus `todo.md`/`completed.md` entries), several of which now overlap, duplicate,
or contradict each other about what's actually current. Triggered 2026-08-18 when answering "what
have we recently done" required manually cross-referencing 4 separate doc clusters to reconstruct an
accurate picture. This task scopes — but does not yet execute — a consolidation pass: an inventory of
every file, what's genuinely stale/duplicate/misfiled, and an ordered plan to fix it.

**Status: Batch 1 DONE 2026-08-18** (the 3 concrete bugs + folding 2 files' open items into the hub
doc + moving those 2 files to `completed/`). Steps 3–7 of the "Proposed order of operations" below
remain — each needs its own judgment-call pass, not mechanical execution, per Ryan's explicit call
to keep the hub-doc archive-split (step 7) separate from batch 1 rather than rushed alongside it.

The inventory below is the result of 4 parallel read-only agent passes (2026-08-18), each reading a
cluster of files in full.

## Scope

**In scope:** every `planning/transportny/tasks/{current,completed}/*.md` file covering RRL/route-
list UI, dynamic reports/spec-build/testing infra, old-report conversion, the design-v2
implementation, and the catalog page — plus their `todo.md`/`completed.md` entries.

**Out of scope:**
- `point-to-point-routing-plugin.md` — a separate map-plugin feature (2-point routing), no content
  overlap with the reports/route-creation docs found.
- `qa-process/runs/2026-07-16.md` — a different project surface (Freight Atlas QA), not NPMRDS.
- `src/dms/planning/` — separate planning system for library-side work (has its own
  `dynamic-report-nongraph-section-binding.md` task, cross-referenced from several files below but
  not itself a consolidation target here).
- MitigateNY/Landbank/Tessera content — even though bug #3 below (`todo.md`'s malformed preamble)
  touches MitigateNY lines too, fixing those isn't this task's call to make unilaterally.

## Concrete bugs found — all 3 FIXED 2026-08-18 (batch 1)

1. **`report-route-color-assignment.md` was a dead duplicate.** Its content ("Gap 02" of the report-
   page redesign) had been merged verbatim into `report-page-redesign-archive.md` on 2026-07-30, but
   the original standalone file was never deleted afterward. `report-page-redesign.md` is the live
   doc, `report-page-redesign-archive.md` already had the full detail — this file was pure leftover.
   **FIXED: deleted.** (Verified first that no markdown link anywhere pointed at it — only plain-text
   historical mentions of the filename, e.g. "merged from three files," which stay accurate after
   deletion.)

2. **Broken cross-reference.** `dynamic-reports-and-route-tags.md` linked to
   `planning/transportny/tasks/current/reports-page-template-catalog.md` — the file is actually at
   `tasks/completed/reports-page-template-catalog.md` (moved there 2026-08-06 when the task
   completed; the link was never updated). **FIXED: path corrected to `completed`.**

3. **`planning/todo.md` had a malformed, duplicate preamble** (lines 8–16, above the first `##`
   heading at line 18). Verified line-by-line: 7 of these 9 entries were **exact duplicates** of
   entries correctly filed later under `## TransportNY` (lines 27–31, 35) or `## MitigateNY`
   (confirmed via `grep -c`, each filename/topic appeared exactly twice in the file) — but the
   preamble copies used a **broken relative path missing the project-folder segment**
   (`./tasks/current/report-page-redesign.md` instead of `./transportny/tasks/current/report-page-redesign.md`).
   Read as leftover content from before `todo.md` was reorganized into per-project sections, never
   cleaned up. **The 8th entry, `point-to-point-routing-plugin.md` (line 8), was NOT a duplicate —
   it was the ONLY place that task appeared in `todo.md` at all**, also with the same broken path.
   **FIXED, with Ryan's go-ahead 2026-08-18** (this touched MitigateNY-owned lines too, so it waited
   for explicit sign-off rather than being done unilaterally): deleted the 7 confirmed-duplicate
   lines, moved `point-to-point-routing-plugin.md` down into the `## TransportNY` section with its
   path corrected.

## Inventory by cluster

### Cluster 1 — RRL / route-list / report-page redesign

| File | Status | Recommendation |
|---|---|---|
| `reportroutelist.md` | DONE-ish live doc, most recent dated work 2026-07-29, a couple undated cleanup items carried forward | Keep as live doc — correctly paired with its archive |
| `reportroutelist-archive.md` | Archive, self-declared non-current | Keep — correctly shaped, already lives beside its live doc per convention |
| `report-page-redesign.md` | Gap 01 DONE, Gap 02 has open testing-checklist items, Gap 03 SETTLED 2026-07-23; most recent 2026-08-05 | Keep as live doc |
| `report-page-redesign-archive.md` | Archive, merged 2026-07-30 from 3 source files | Keep |
| `report-route-color-assignment.md` | **Dead duplicate — DELETED 2026-08-18** (see bug #1 above) | Done |
| `report-route-ui-parity-gaps.md` | IN PROGRESS, 6+/18 gaps done, most recent 2026-08-14 | Keep as live doc; it's grown large (18 gaps + long progress log) — good future candidate for its own live+archive split, same pattern as the others in this cluster, but not urgent |
| `report-page-template-editorial-slots.md` | REOPENED 2026-07-31, one item (hero-stat menu honesty) still genuinely open | Keep as live doc |

### Cluster 2 — Dynamic Reports / spec-build / testing infra

| File | Status | Recommendation |
|---|---|---|
| `dynamic-reports-and-route-tags.md` | The current hub — most recent entry 2026-08-17 (updated today, 2026-08-18, with that entry). Lines 331–1253 (the 2026-08-12→17 hand-by-hand bug-hunt log) have not yet been pushed into the paired archive. | Keep as the live doc, but **overdue for its own archive-split** — the same "grows too long to read" trigger that spawned the paired archive originally now applies to its own most-recent section. Not urgent, but next time it's touched, consider splitting the completed 08-12→17 material into the archive, mirroring `report-page-redesign.md`'s pattern. |
| `dynamic-reports-and-route-tags-archive.md` | Correctly archival, covers through 2026-08-14 (expected lag behind the live doc) | Keep; will need a fresh append once the above split happens |
| `report-spec-and-build-script.md` | Owns the `report_build.mjs` mechanism + initial 12-template conversion (through 2026-08-11) — genuinely distinct scope from the hub, not absorbed into it | Keep as its own file, but **its status header is stale** (claims "Phase A+B COMPLETE 2026-07-27" without acknowledging its own "Follow-on" section, itself DONE 2026-08-11) — rewrite the header, then it's close to movable to `completed/` once that's done (remaining blockers already live in their own separate task files) |
| `report-probe-expect-and-golden-corpus.md` | Owns the testing-infrastructure *design* (separate from its *usage*, which lives throughout the hub doc) | Keep as its own file, but its "golden corpus pages currently live" table lists 5 entries while the real manifest (`golden-corpus.json`) now has 8 — **drifted from ground truth**, needs a refresh pass |
| `converter-vocabulary-unit-tests.md` | NOT STARTED, confirmed still accurate (no `tests/` dir exists) | Keep as-is — small, accurate backlog item, nothing to consolidate |

### Cluster 3 — Old-report conversion / design-v2 / catalog

| File | Status | Recommendation |
|---|---|---|
| `client-request-to-report-skill.md` | **DONE 2026-08-18: 5 open items folded into the hub doc's "Open questions" section, file moved to `tasks/completed/`.** (The original inventory undercounted this as a 4-item table — it was actually 5: the 4 listed plus a "measure-queryable-for-year check" item.) | Done |
| `client-request-to-report-skill-archive.md` | **Moved to `completed/` 2026-08-18** alongside the file above | Done |
| `npmrds-design-v2-implementation.md` | **Stale status header** — claims "IN PROGRESS... top priority, superseding `dynamic-reports-and-route-tags.md`" but every dated entry is 2026-08-06 (12 days stale as of this writing) and all concrete phases are DONE. The framing is now backwards: the hub doc has since raced 12 days past it and correctly treats this file as background context, not the reverse. Only 3 items remain genuinely open: Map graph-type support (blocked), the report library (blocked on Alex, "~90% done" as of 2026-08-06, zero update since), and a 7-item "Post-ship gap review" tabled the same day. | **Not done — deferred past batch 1.** Rewrite the status header honestly, trim the file down to the 3 real open items, move the rest (the two fully-shipped design pushes, ~90% of the file) to `completed/`. Worth explicitly asking Ryan to check with Alex on report-library design status — "~90% done" with no follow-up in 12 days is exactly the kind of thing that silently rots. |
| `catalog-page-slug-naming-fix.md` | **DONE 2026-08-18: placeholder-text open item folded into the hub doc (plus a note that the `--title`-override mechanism is likely superseded), file moved to `tasks/completed/`.** | Done |
| `route-creation-tool.md` | Thin, self-described orientation pointer to `research/route-creation/findings.md` and a `src/dms` submodule task; covers a genuinely distinct capability (map-based route drawing) that RRL/Route-Tags/Dynamic-Reports work never touches | Keep as-is — not part of the overlap problem |

### Cluster 4 — Completed docs (sanity-checked; not consolidation targets, but two orphan flags)

| File | Status | Note |
|---|---|---|
| `reports-page-template-catalog.md` | DONE 2026-08-06, correctly spun off 4 sibling task files (all confirmed to genuinely exist and still be open, not orphaned) | Fine as filed. Contained the source of bug #2 above (a broken inbound link from the hub doc) — **fixed 2026-08-18**, and its own pointer to `catalog-page-slug-naming-fix.md` updated to the new `completed/` sibling path now that both files live there. |
| `converter-route-comp-redesign.md` | DONE 2026-08-07, its one follow-on (`seriesLabel` from a picked route) confirmed genuinely tracked in `src/dms/planning/tasks/current/dynamic-report-nongraph-section-binding.md` | Fine as filed |
| `rrl-relative-dates-and-graph-count.md` | DONE 2026-08-07, no open follow-ons | Minor orphan — not referenced from the hub doc, but self-contained and fully resolved, low risk |
| `compact-sidenav-margin-bug.md` | DONE 2026-08-07, resolved internal loose ends | Minor orphan, low risk (fully resolved) |
| `port-transportny-map-plugins.md` | Both phases DONE 2026-07-29, but flags **real untested surface area inline**: routecreation's marker/auto-route mode and save/load path, and macroview's Data Downloader flow (blocked on a `MapEditorContext`/`DAMA_HOST` gap) and untested MapEditor `internalPanel` | **Worth a one-line pointer from the hub doc or wherever this surface would naturally be searched for** — this is a real gap with no trail to it today, unlike the other completed files in this cluster |

## Proposed order of operations

1. **DONE 2026-08-18.** Fixed the 3 concrete bugs (deleted `report-route-color-assignment.md`; fixed
   the broken path in `dynamic-reports-and-route-tags.md`; fixed the `todo.md` preamble with Ryan's
   explicit go-ahead, since it touched MitigateNY lines too).
2. **DONE 2026-08-18.** Folded the "still open" items out of `client-request-to-report-skill.md` and
   `catalog-page-slug-naming-fix.md` into the hub doc's "Open questions for triage" section, moved
   both files (+ the skill's archive) to `completed/`, updated every inbound cross-reference found
   via repo-wide grep (`src/dms/skills/creating-reports.md`, `research/npmrds-reports/report-spec.md`,
   the hub doc + its archive, `reports-page-template-catalog.md`, `dynamic-report-nongraph-section-binding.md`
   in the `src/dms` submodule), and added both to `completed.md`.
3. **Not started.** Rewrite `npmrds-design-v2-implementation.md`'s status header honestly, trim it to its 3 real open
   items, move the rest to `completed/`. Ask Ryan about Alex's report-library status first.
4. Rewrite `report-spec-and-build-script.md`'s stale header, then move it to `completed/`.
5. Refresh `report-probe-expect-and-golden-corpus.md`'s golden-corpus table against the real
   8-entry manifest.
6. Add a one-line pointer to `port-transportny-map-plugins.md`'s untested surface area from
   wherever it'd naturally be searched for (likely `route-creation-tool.md` or the hub doc).
7. Lowest priority, do whenever the hub doc is next touched anyway: split its 2026-08-12→17 section
   into `dynamic-reports-and-route-tags-archive.md`, same pattern as every other split in this
   project.

Steps 1–2 (batch 1) are done. Step 6 remains similarly mechanical and low-risk. Steps 3–5 and 7
involve judgment calls (what counts as "real open work" vs. safe to archive, how much to condense a
dated technical narrative) and are better done as their own deliberate pass, reading the current
file state directly rather than blindly following this list — this doc is a map, not a diff to
apply mechanically.
