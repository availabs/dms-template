# NPMRDS Reports/Route-Creation planning-doc consolidation

**Project:** TransportNY

## Objective

The NPMRDS Reports/Route-Creation work has accumulated ~18 task files across `tasks/current/` and
`tasks/completed/` (plus `todo.md`/`completed.md` entries), several of which now overlap, duplicate,
or contradict each other about what's actually current. Triggered 2026-08-18 when answering "what
have we recently done" required manually cross-referencing 4 separate doc clusters to reconstruct an
accurate picture. This task scopes — but does not yet execute — a consolidation pass: an inventory of
every file, what's genuinely stale/duplicate/misfiled, and an ordered plan to fix it.

**Status: Batches 1 and 2 DONE 2026-08-18** (steps 1–6 of the "Proposed order of operations" below).
**Step 7 — the hub doc's own overdue archive-split — remains, deliberately deferred both times** per
Ryan's explicit call to keep it a separate, dedicated pass rather than rushed alongside mechanical
doc-consolidation work.

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
| `dynamic-reports-and-route-tags.md` | The current hub — most recent entry 2026-08-17. Lines 331–1253 (the 2026-08-12→17 hand-by-hand bug-hunt log) have not yet been pushed into the paired archive. | **Still overdue — deliberately not done, twice now** (see Status above). Next time it's touched, split the completed 08-12→17 material into the archive, mirroring `report-page-redesign.md`'s pattern. |
| `dynamic-reports-and-route-tags-archive.md` | Correctly archival, covers through 2026-08-14 | Keep; will need a fresh append once the above split happens |
| `report-spec-and-build-script.md` | **DONE 2026-08-18: header rewritten, moved to `tasks/completed/`.** Its Follow-on section (all 12 catalog templates spec-built) was already DONE 2026-08-11 and Phase C was always tracked separately — the header just hadn't caught up. One item spun off rather than blocking: the `minutes_seconds` duration format, tracked in the DMS library's own `duration-value-format-mm-ss.md` (annotated with a real finding: a reusable `duration_mmss` formatter landed 2026-08-17 as a side effect of unrelated tooltip work, though it doesn't itself close that task). | Done |
| `report-probe-expect-and-golden-corpus.md` | **DONE 2026-08-18: added a dated correction section with the real 8-entry manifest table**, sourced directly from `golden-corpus.json` (3 new `dynamic_report_*` entries since the "5 entries" description was written). Kept the original stale table in place per "don't rewrite history" — appended the correction instead. | Done |
| `converter-vocabulary-unit-tests.md` | NOT STARTED, confirmed still accurate (no `tests/` dir exists) | Keep as-is — small, accurate backlog item, nothing to consolidate |

### Cluster 3 — Old-report conversion / design-v2 / catalog

| File | Status | Recommendation |
|---|---|---|
| `client-request-to-report-skill.md` | **DONE 2026-08-18: 5 open items folded into the hub doc's "Open questions" section, file moved to `tasks/completed/`.** (The original inventory undercounted this as a 4-item table — it was actually 5: the 4 listed plus a "measure-queryable-for-year check" item.) | Done |
| `client-request-to-report-skill-archive.md` | **Moved to `completed/` 2026-08-18** alongside the file above | Done |
| `npmrds-design-v2-implementation.md` | **DONE 2026-08-18: split live+archive**, same pattern as `dynamic-reports-and-route-tags.md`/`-archive.md` (used instead of moving wholesale to `completed/`, since real work remains — see below), rather than the originally-planned "move the DONE bulk to completed/, spin off the open items." Full 405-line build history moved verbatim to the new `npmrds-design-v2-implementation-archive.md`; the live file now carries **4** real open items (the inventory undercounted this at 3 — Phase 4's theme tokens are also genuinely not-started, not just background context): Map graph-type support (blocked), the report library (blocked on Alex, still "~90% done" as of 2026-08-06 with zero update since — **still worth asking Ryan to check**), the 7-item Post-ship gap review (tabled, needs re-triage against the since-shipped Design Push #2), and Phase 4 theme tokens. | Done |
| `catalog-page-slug-naming-fix.md` | **DONE 2026-08-18: placeholder-text open item folded into the hub doc (plus a note that the `--title`-override mechanism is likely superseded), file moved to `tasks/completed/`.** | Done |
| `route-creation-tool.md` | Thin, self-described orientation pointer to `research/route-creation/findings.md` and a `src/dms` submodule task; covers a genuinely distinct capability (map-based route drawing) that RRL/Route-Tags/Dynamic-Reports work never touches | Keep as-is — not part of the overlap problem |

### Cluster 4 — Completed docs (sanity-checked; not consolidation targets, but two orphan flags)

| File | Status | Note |
|---|---|---|
| `reports-page-template-catalog.md` | DONE 2026-08-06, correctly spun off 4 sibling task files (all confirmed to genuinely exist and still be open, not orphaned) | Fine as filed. Contained the source of bug #2 above (a broken inbound link from the hub doc) — **fixed 2026-08-18**, and its own pointer to `catalog-page-slug-naming-fix.md` updated to the new `completed/` sibling path now that both files live there. |
| `converter-route-comp-redesign.md` | DONE 2026-08-07, its one follow-on (`seriesLabel` from a picked route) confirmed genuinely tracked in `src/dms/planning/tasks/current/dynamic-report-nongraph-section-binding.md` | Fine as filed |
| `rrl-relative-dates-and-graph-count.md` | DONE 2026-08-07, no open follow-ons | Minor orphan — not referenced from the hub doc, but self-contained and fully resolved, low risk |
| `compact-sidenav-margin-bug.md` | DONE 2026-08-07, resolved internal loose ends | Minor orphan, low risk (fully resolved) |
| `port-transportny-map-plugins.md` | Both phases DONE 2026-07-29, but flags **real untested surface area inline**: routecreation's marker/auto-route mode and save/load path, and macroview's Data Downloader flow (blocked on a `MapEditorContext`/`DAMA_HOST` gap) and untested MapEditor `internalPanel` | **DONE 2026-08-18: pointer added to `route-creation-tool.md`'s "Open items" section**, distinguished from that file's existing "Save/load `points` persistence" row (a confirmed design limitation) since this is a separate, genuine testing gap. |

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
3. **DONE 2026-08-18.** Split `npmrds-design-v2-implementation.md` into a trimmed live file (4 open
   items) + a new `-archive.md` (full build history). Ryan's question about Alex's report-library
   status is still outstanding — asking is a conversation, not a doc edit, so it's flagged in the
   live file rather than resolved here.
4. **DONE 2026-08-18.** Rewrote `report-spec-and-build-script.md`'s stale header, moved it to
   `completed/`, fixed all 12 inbound cross-references found via repo-wide grep, and annotated the
   DMS library's `duration-value-format-mm-ss.md` with a real finding surfaced along the way (a
   reusable `duration_mmss` formatter that doesn't itself close that task but removes most of the
   remaining implementation work).
5. **DONE 2026-08-18.** Refreshed `report-probe-expect-and-golden-corpus.md`'s golden-corpus table
   against the real 8-entry manifest (3 new `dynamic_report_*` entries since the doc's "5 entries"
   description).
6. **DONE 2026-08-18.** Added a pointer to `port-transportny-map-plugins.md`'s untested surface area
   in `route-creation-tool.md`'s "Open items" section.
7. **Still not started, deliberately** — do whenever the hub doc is next touched anyway: split its
   2026-08-12→17 section into `dynamic-reports-and-route-tags-archive.md`, same pattern used for
   `npmrds-design-v2-implementation.md` in step 3 above.

All of steps 1–6 are now done. Step 7 remains the one deliberately-deferred item — same reasoning
both times it came up: it's a bigger, judgment-heavy rewrite of live technical narrative, not a
mechanical fix, and deserves its own dedicated pass rather than being squeezed in alongside batch
work.
