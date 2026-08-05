# MNY — Capacity Assessment Data Architecture report

## Objective

A 4th linked capability report, answering the specific architecture question the user raised: given
both the 1.0 county capability self-reports (`combined_capa.csv`, 2,354 rows) and the 2.0 statewide
capability catalog (`capcat.csv`, 649 rows), should the planned capacity assessment be (a) additional
columns on the existing capability dataset, or (b) a separate dataset? Grounded in DMS's actual
technical model (source/view/join mechanics), not just abstract data-modeling opinion.

## Scope

- One new static HTML + Tailwind CDN report: `src/themes/mny/design/reports/capacity-assessment-architecture.html`.
- Update the floating "Data Reports" nav-widget list on all 7 existing report pages to add this 8th entry.
- No live pattern/page work, no actual dataset creation — this is a design-system report recommending
  an approach; implementing the dataset is future work if the recommendation is accepted.

## Skills consulted (per user instruction to use `src/dms/skills`)

- **`live-cross-view-joined-section.md`** — the technical mechanics of joining two DMS views live:
  same query engine required, alias-prefixed columns, `sourceInfo.columns` required on the joined
  source or `/edit` crashes, and critically **a per-version/metadata view fans the join out unless its
  key column is pinned** — the direct analog for why capability↔capacity must join on a composite key
  (jurisdiction + capability/capacity-type name), not jurisdiction alone.
- **`uploading-gis-and-tabular-datasets.md`** — confirms each CSV ingest becomes its own DaMa
  source+view+table; there's no light-weight "just add columns to an existing table" path in the
  platform, reinforcing that "columns on the capability table" is a real schema commitment, not a
  free option.
- **`converting-hoc-1-to-2.md`** (already loaded earlier this session) — Stage 3's GeoID-crosswalk
  jurisdiction-identity rules and Stage 4's "build the full jurisdiction × hazard grid" pattern are the
  direct template for how a capacity dataset should be built (jurisdiction × capacity-item grid,
  same crosswalk key), so all three 2.0 datasets (Hazards of Concern, Capability, Capacity) share one
  jurisdiction identity system instead of inventing a second one.

## The recommendation (see the report for full reasoning)

**Two separate datasets, joined by a shared key — not one wide table.** Reasoning, grounded in already-
verified numbers from the prior two reports:
- Capability data is irregular/event-sourced: breadth per jurisdiction ranges from 1 domain (21 of 169
  jurisdictions) to 5 domains (1 jurisdiction, 26 rows) — there is no reliable 1:1 row per jurisdiction
  per capacity item to attach columns to.
- The 2.0 state catalog already shows what forcing a dense reference list into a sparse program table
  produces: 245 of 649 rows (38%) are bare placeholder rows with zero other data, because a fixed
  vocabulary was merged into a table meant for irregular real entries.
- Capacity assessment structurally needs a **complete** jurisdiction × ~30-item grid, asked uniformly
  regardless of what's checked in the capability table (this was the core argument of
  `capabilities-vs-capacity.html` — silence must stop being ambiguous). That's a dense-grid dataset,
  not a sparse-event dataset — different shape, different update cadence, different dataset.
- DMS can join the two live for reporting (`live-cross-view-joined-section.md`) as long as the join key
  is pinned to (jurisdiction, capability/capacity-type name) — mirroring the skill's "pin the version
  column or the join fans out" gotcha, translated to this domain.

## Files requiring changes — DONE

- [x] `src/themes/mny/design/reports/capacity-assessment-architecture.html` (new)
- [x] `src/themes/mny/design/reports/actions-qa.html` — nav widget: added link
- [x] `src/themes/mny/design/reports/duplicate-actions.html` — nav widget: added link
- [x] `src/themes/mny/design/reports/boilerplate-actions.html` — nav widget: added link
- [x] `src/themes/mny/design/reports/location-from-text.html` — nav widget: added link
- [x] `src/themes/mny/design/reports/capability-inventory.html` — nav widget: added link
- [x] `src/themes/mny/design/reports/capabilities-vs-capacity.html` — nav widget: added link
- [x] `src/themes/mny/design/reports/state-capability-catalog.html` — nav widget: added link

## Testing checklist

- [x] New page opens correctly relative to `../theme/index.css.additions` and `../assets/mny/...`.
- [x] Floating nav widget lists all 8 reports, consistently — verified on the new page itself (all 8 present, itself highlighted).
- [x] Verified visually in the in-app browser at desktop width — hero, stat strip, table-shape comparison, join-mechanics steps, and recommendation callout all render as intended.

## Note

Fixed one authoring mistake during build: an early draft linked "HoC 1.0→2.0 conversion work" to a
literal `converting-hoc-1-to-2.md` href (a skill file, not a page in this reports folder — would have
been a dead link). Corrected to plain bold text before finalizing.
