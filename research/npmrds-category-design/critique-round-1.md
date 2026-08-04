# NPMRDS category design set — critique, round 1

**Date:** 2026-07-29 · **Critic:** fable subagent (Phase 8a of
`planning/transportny/tasks/current/npmrds-category-design-set.md`)
**Scope:** the nine `pages/` files forming the NPMRDS category, `design-system/` docs
(theme · layouts · grid · components · patterns §10–13), `README.md`, `ds-nav.js`,
judged against `designing-a-dms-design-system.md`, `card-layout.md`,
`src/themes/CLAUDE.md`, the ReportRouteList README, and the task's nine-item cross-page contract.
Method: full markup read of all nine pages + docs; programmatic contract diffs (nav, freshness,
breadcrumbs, container widths, downloads, section nesting, type-spec census); rendered checks at
1280/1440 (macro workbench, report compound card, report rail scroll behaviour).

---

## Bottom line

This is a genuinely coherent set — the header shape, freshness strip, route colours, kicker
system, attribution lines and footer blocks repeat with real discipline, and the two hardest
pages (`npmrds-report.html`, `npmrds-macro.html`) are the strongest work in the whole
catalogue. But three of the contract's nine items don't survive a mechanical diff (freshness on
macro, downloads on two MAP-21 pages, breadcrumb shape split two ways), the set's single
demonstration of the compound-card rule is **measurably broken** (a 24 px pane gap where the
"fused" card claims a shared edge — a direct casualty of the gap-6 deviation that Design note 1
asserts is harmless), and the task's own honesty ledger (the Escalations table) is empty while at
least four drawn affordances are conceded or knowably inexpressible in DMS today. The A/B on the
reports page has a clear winner and the loser is itself an undocumented composition, so deleting
it also clears a done-criteria violation. Everything on the must-fix list is mechanical; nothing
requires re-architecture.

---

## § The A/B ruling — `npmrds-reports.html`

**Treatment A (§ 01, the inline search-first list) ships. Treatment B (§ 05, the command
palette) is deleted from the page.** Not hedged: A is the page.

Why, in order of force:

1. **B is inexpressible and the task forbids what it needs.** The page's own § 05 prose concedes
   it: a Dialog wired to a keyboard shortcut plus cross-entity result grouping that no DMS
   primitive composes today. The task's OUT list says *no new primitives — log it in Escalations
   and design around it*. B belongs in the Escalations table, not in the mockup.
2. **A's state lives in the URL; B's evaporates.** The search param + facet chips make every
   result set shareable and bookmarkable — the exact property `route-comparison.html`'s own
   "// shareable" rail note celebrates as a brand value. A public-sector analyst mails links;
   a palette leaves no address.
3. **B is undocumented.** The palette composition appears nowhere in
   `design-system/patterns.html` (grep: zero hits). Keeping it violates the task's no-smuggling
   done-criterion outright; A is already documented as patterns §11.
4. **B duplicates chrome the set already ships.** Every full SideNav carries a persistent
   "Search reports & routes" pill. If a cross-entity search ever gets platform support, that
   pill is its natural home — a second, page-local invocation adds a competing search moment to
   a page whose § 01 already answers "where do I search."

**Consequences the deletion must carry (do these in the same edit):**

- **Move the no-results state into A.** § 05's no-match card is the best microcopy in the set
  ("NPMRDS covers the NHS road network only — no off-road facilities…" + suggestion chips).
  Redraw it verbatim as the § 01 results-card empty state (`data-dms-section="results"`,
  second drawn state).
- **Give A an empty-query state** (the third required state currently only drawn inside B):
  empty search box + recent reports + the curated shortcuts, in the § 01 card.
- **Log B in the task's Escalations table**: "cross-entity command palette · smallest
  enrichment: Dialog + keyboard-shortcut wiring + grouped multi-source search results."
  Keep the trade-off paragraph as a Design note; the ⌘↵ "new report from route" idea is worth
  the ledger line on its own.

---

## § 1 · Coherence

The good first, briefly: the freshness strip is byte-identical on pages 1, 2, 5, 6; the
kicker → rule → meta → h1-with-amber-period → purpose → action-pair header shape repeats
precisely; route colours (#1F3F8F / #E5A646 / #10B981 / #8B5CF6) carry across the reports list,
the report rail, the summary table and the charts; attribution lines carry real provenance
(source 583 / view 982) in one voice. The set passes the squint test as one product. The
findings below are where the contract text and the pages disagree — and a contract you can't
diff-verify is the thing this task existed to prevent.

1. **[must-fix] `route-comparison.html` · SideNav — no expanded level-2 group at all.**
   Zero `pl-5` sub-items; MAP-21 carries ChevronRight (collapsed), Reports collapsed. This is
   the only page in the nine that fails skill §10 criterion 5 *and* contract item 1. Fix: expand
   the MAP-21 group here, exactly as the written contract ("MAP-21 group always expanded")
   prescribes — one copy-paste from `map-21.html` lines 51–52.

2. **[must-fix] `npmrds-report.html` + `route-comparison.html` · all groups — undocumented
   1600 px container.** Both pages cap at `max-w-[1600px]`; every other page, `grid.html`'s
   spec table, `layouts.html`'s wrapper reference (12 × `max-w-[1480px]`, zero 1600s), and the
   patterns §07 archetype table know only 1480. Either normalize both pages to 1480, or earn
   the width: add a `data-wide · 1600` archetype row to layouts.html + patterns §07 stating
   which pages use it and why (rail + canvas pages need the width — that's a defensible reason,
   but it must be written down).

3. **[must-fix] `npmrds-macro.html` · panel-3 chrome strip — freshness strip breaks the
   byte-identical rule (contract item 4).** It drops "jul 2026 partial · since jan 2017" and
   substitutes "pm3 year 2025". The MAP-21 pages *append* a fifth segment to the intact four —
   a superset, tolerable; macro *replaces* two of the four. Fix: restore all four shared
   segments on macro, then amend contract item 4 to permit a page-scoped **suffix** after the
   shared four (which legitimizes the MAP-21 pages' "pm3 year 2025" tail).

4. **[must-fix] `map-21.html` + `map-21-trend.html` — no download affordance anywhere.**
   Contract item 7 names pages 3, 4, 5, 6. Sysperf has a § download section, LOTTR has an
   annual-download link, but `map-21.html` (grep: zero) and `map-21-trend.html` (zero) offer
   nothing — on the two pages whose tables (compliance KPIs, by-region, multi-year trend
   series) are exactly what an MPO analyst exports. Fix: the standard header-right download
   (Download icon + metaSM label) on `compliance` / `by-region` (map-21) and on each trend
   band (trend).

5. **[should-fix] Breadcrumbs ship in two shapes (contract item 3).** `npmrds-report.html`
   uses the dedicated `data-dms-group="breadcrumbs"` band (the datasets-source model the
   contract names); all four `map-21*.html` and `route-comparison.html` inline a `<nav>` inside
   the `page-header` section instead. Both look similar; they are different DMS structures and
   will translate differently. Pick the group (the contract already did) and re-tag the five
   retrofit pages.

6. **[should-fix] The written contract says "MAP-21 group always expanded"; the set does
   "active group expanded."** `npmrds-home.html`'s contract comment (item 1) promises MAP-21
   expanded on all pages; `npmrds-reports.html`/`npmrds-report.html` expand Reports and collapse
   MAP-21. The pages' behaviour is the better design — fix the contract text in the
   `npmrds-home.html` header comment (and the task file) to: *the active item's group is
   expanded; where no group is active (route-comparison), MAP-21 stays expanded.* Note this is
   what makes finding 1's fix coherent rather than arbitrary.

7. **[should-fix] `npmrds-macro.html` — the compact 64 px icon SideNav and the missing page
   header are undocumented contract exceptions.** Both follow `freight-atlas-map.html` (the
   catalogue's only workbench precedent) and the compact variant is a documented SideNav state
   in components.html — the *pages* are right. But contract items 1–2 say "identical on all
   six" / "one shape across all six" with no workbench carve-out, and no Design note records
   the deviation. Fix: a one-line amendment to both contract items ("…except the workbench
   page, which uses the documented compact SideNav and map-owned chrome in place of a page
   header") in the home-page comment + task file.

8. **[should-fix] `route-comparison.html` § builder — route rows are not the contract-6 row,
   and the builder doesn't read as page 6's rail family.** Diffs against
   `npmrds-report.html § route-list` / patterns §13: dot `size-2` vs `size-3`; name 12.5 px
   regular, **no `title` tooltip** vs 13 px semibold + tooltip; meta `9.5px` lowercase
   "11 TMCs · 14.2 mi" vs `10px` uppercase-tracked "9 TMC · 2.0 mi · dates"; white
   "Build comparison" header vs the dark `#12181F` rail header bar. The Phase-6 brief called
   for exactly this alignment ("both are route-selection surfaces — today they don't look
   related") and it wasn't done; Design note 6's "only shared chrome changed" over-scopes the
   exemption — these *are* chrome. Fix: the four cosmetic diffs; architecture untouched.

9. **[taste] `npmrds-home.html` uses the `hero` group; pages 2–6 use `header`.** The shape
   inside is identical and a category front door earning the topo band is defensible — noting
   it here so the next reader knows it's deliberate, not drift. No change needed.

10. **[taste] `README.md` "Mapping to the spec" table** still says pages/ = "9 handoff
    examples + 7 Freight Atlas" — stale by three product families. One-line fix.

---

## § 2 · Hierarchy

1. **[should-fix] `npmrds-macro.html` § map (the workbench) — the map loses to its own
   chrome.** Rendered at 1280×900, the drawn state opens *everything at once*: the measure menu
   (which buries the always-on filters it sits above), the download builder, the context panel,
   and the hover popup — which the download panel physically clips (the popup's
   "click to pin…" caption is cut off behind it). Perhaps a quarter of the canvas shows map.
   For the page whose brief is "a full-page map," the most important thing is the least visible
   thing. Fix: draw the canvas in resting state (menu closed, download collapsed to its dock
   button — the dark pill already drawn in patterns §12, popup placed clear of the panels), and
   prove the open states the way § 02 already proves the conditional block — as content-band
   snapshots below the fold. The page already invented the right mechanism for this; use it.

2. **[should-fix] `npmrds-report.html` § graph-3-info — the payoff number is clipped at both
   1280 and 1440.** The route-summary table (`min-w-[520px]`) internally scrolls inside its
   `col-span-7` card, and the column that scrolls out of view is **Δ pm** — the −42 s that the
   whole report exists to show (it's literally "the finding" in the rail). Fix: order Δ before
   avg speed, or drop the min-width (four short columns fit), so the delta is visible without
   a scroll the reader doesn't know exists.

3. **[good — keep] `npmrds-home.html` § latest-data.** Reserving `displayHero` (52 px) for
   "June 2026" while the h1 takes displayLG is the best hierarchy decision in the set — the
   data currency, not the product name, is the landing page's headline, exactly per brief.
   `map-21.html` § compliance (KPI row first, statXL figures) and `npmrds-reports.html`
   (search box as the first object on the pane) are similarly correct. No findings.

4. **[taste] `npmrds-report.html` § route-list — the dark `#12181F` rail header is the
   heaviest element on the canvas.** The eye lands on "ROUTES" before "the finding" or any
   chart. Defensible (routes are the report's legend), but consider the white panel-header
   treatment (as the macro context panel uses) so the finding card and the charts lead.
   Also **[taste]**: on `npmrds-reports.html`, the § 01 search card renders *above* the
   "// 01 Search results" band head — everywhere else the kicker numbers the top of its band.
   Consider "// 01" on the search card itself.

---

## § 3 · Density

The information rate is right almost everywhere — these pages respect an analyst's time, and
the worked numbers (199,359,695 June rows; 115 months; legend bin counts that actually sum to
3,112) reward close reading instead of punishing it.

1. **[should-fix] `npmrds-report.html` — the density rule is stated but its load-bearing
   clause is never drawn.** Graph-card contract clause 5 and density rule 03 both claim: *at
   size 4 the y-axis drops to 3 ticks and the legend collapses to dots + count*. The smallest
   card on the page is size 5; no size-4 card exists anywhere in the set, so the one rule that
   makes the 21-section stress case survivable is an assertion. Fix: one size-4 card in band 2
   (or added to patterns §13) drawn with 3 ticks + dot-legend. Cheap, and it converts the rule
   from claim to spec. Otherwise the page *does* obey its own rule in what it draws: bands
   break on question, the attribution truncates on one line (verified in render), nothing
   below size 5.

2. **[should-fix] `npmrds-macro.html` § map — density of the drawn state.** Same fix as
   Hierarchy 1; counted here because it's the one place the set is cramped rather than padded.

3. **[taste] `npmrds-home.html` § quick-start.** Three step cards + docs index is one band
   doing two jobs; the step cards' body copy runs a sentence longer than it needs. Fine to
   ship; trim if touched.

4. **[no finding] `npmrds-reports.html` § templates** (12 real templates as 6 grouped cards)
   and **`npmrds-macro.html` § measure-reference** (8-row definition table) are exactly the
   right density for the audience — the reference table especially is the best "good
   additional context" moment in the set.

---

## § 4 · The type system

Declared in `theme.html` § type: displayHero/XL/LG/MD/SM/XS · proseLG/prose/proseSM/proseXS ·
metaMD/metaSM/metaXS · kicker · statXL/statLG/statMD · cardTitleSM = **18 tokens**.

**Census of the nine pages** (`text-[N px]` occurrences): declared sizes account for the bulk,
but **the single most-used text size in the set is undeclared**: `10px` × 247, followed by
`11px` × 130, `13px` × 101, `9px` × 43, `14px` × 13, `20px` × 7, `13.5px` × 5, `34px` × 4,
`17px` × 2, `8.5px` × 1. All ten sizes have catalogue precedent (e.g. datasets-catalog uses
10px × 113; freight-atlas-map uses 9px × 9), so the progress-log claim "zero **new** undeclared
sizes" is technically true.

**Ruling on Design note 3's concession:** half right, half dodge. Right: not re-tokenizing 40
catalogue pages mid-task, and not diverging the new pages from catalogue chrome. Dodge: the
concession frames the *whole* fix as "a catalogue-wide pass, not this task," when the honest
core of it — **declaring the chrome role in theme.html** — is three table rows and changes zero
pixels. The set's own worst symptom: on `npmrds-macro.html`, four mono micro-label sizes within
1.5 px (9 / 9.5 / 10 / 10.5) coexist in the same panels — precisely the drift §7.2.1 exists to
stop, propagated onto brand-new markup 92 times.

Findings:

1. **[must-fix] Declare the chrome role now (declare-to-match, no page edits):**
   `theme.html § type` gains three rows — `chromeNav` (13 px / 500 · SideNav + menu items;
   13.5 covered as its tracked variant or folded to 13), `chromeLabel` (10 px / 400 mono upper ·
   panel/micro labels — the 247-use workhorse), `chromeTick` (9 px / 400 mono · axis ticks,
   dense panel captions; 8.5 folds up into it). Each with the standard folded-variants note.
   This legalizes ~500 of the ~660 undeclared occurrences without touching a page.

2. **[should-fix] Fold the long tail (page edits, all within earn-a-token):** `14px` → `prose`
   (14.5 — a 0.5 px difference is the definition of a non-token); `17px` → `displayXS` (18);
   `20px` → `displaySM` (22) — note the *docs pages themselves* use 20 px section heads
   (7 × in theme.html alone), so this fold is a docs-page pass too; `34px`
   (map-21-system-performance ×3, map-21-lottr ×1) → `displayMD`/`statLG` (28) or `displayLG`
   (38); `11px` → `proseXS` (11.5) or `metaMD` (12) by context.

3. **[should-fix] `statXL` and `statLG` fail the earn-a-token rule as declared.**
   statXL (52/600 tabular) differs from displayHero (52/600) *only* by tabular-nums; statLG
   (28/600 tabular) from displayMD likewise — and tabular-nums is explicitly a modifier axis;
   §7.2.1's own worked example ("displayMD rendered as a tabular KPI value — no separate
   displayKPI token") names this exact case. Fold both into displayHero/displayMD + modifier,
   or keep them and delete the folded-variants doctrine from the page — the current state
   asserts a rule its own ladder violates. (statMD earns: 600 vs displaySM's 500 is a weight
   step. cardTitleSM earns: 15 vs 18/12.5 clears 2 px.)

4. **[should-fix] `theme.html § type` folded note references `displayItalicMD`, which is
   declared nowhere.** ("italic pull-quote (use displayItalicMD at the call site)") — a fold
   target that doesn't exist. Declare it or repoint the note at `displaySM + italic`.

5. **[should-fix] `patterns.html § kpi-strip (03)` — the KPI figure is
   `font-mono text-[40px] font-medium`:** resolves to no token and matches *neither*
   implementation (map-21 § compliance uses statXL Oswald 52; npmrds-home § map21-glance uses
   statLG 28). The documented pattern is stale against both of its consumers. Redraw §03 with
   the map-21 treatment. (Related: `README.md` brand intent still says "All KPI values … in
   ui-monospace" while theme.html's stat ladder is Oswald — the transcription note in
   map-21.html even records "handoff wins over brief." Update the README sentence.)

6. **[taste] `npmrds-report.html` header comment clause 1 says card titles are `displayXS`
   (18 px); every drawn card header — and patterns §13's own demo — is 15 px.** The drawn 15 px
   is right (it's cardTitleSM minus uppercase, sentence-case being a legal text-transform
   modifier); fix the comment, and add one line to patterns §13 naming the token so the
   translation skill doesn't guess.

---

## § 5 · DMS honesty

The set is *mostly* honest — and unusually explicit about it (the macro header comment's three
tile-rendering constraints, the ReportRouteList behaviours drawn as fixed, the `$self` chip
mechanics faithfully transcribed). The failures are concentrated in one place: the ledger.

1. **[must-fix] The task's Escalations table is empty while the set contains at least five
   elements that need entries.** The task's own rule: anything DMS can't render with existing
   primitives gets logged and designed around. Log, minimally:
   - `npmrds-reports.html § 05` — the command palette (conceded inexpressible in the page's own
     prose; see the A/B ruling).
   - `npmrds-macro.html` panel 2 — the **value-distribution histogram** of currently-mapped
     values (the legacy MeasureVisBox was custom React; no Map-section knob produces it).
   - `npmrds-macro.html` panel 4 — the **download builder** (scope/format/column preview; the
     legacy surface was 909 lines of custom code; the Map section has no export-builder chrome).
   - `npmrds-macro.html` panel 2 — the viewer-facing **"edit breaks"** button (symbology breaks
     are author-side per editing-map-symbologies; a viewer affordance is new capability). Demote
     to edit-mode chrome or delete.
   - `npmrds-macro.html` hover popup — **"shift-click to add to a route"** promises route
     mutation from the macro map; route creation lives in the transportNY tool. Reword to
     "click to pin" only, and log the wish.
   These can all stay *drawn* (they're the brief's required content) — but each needs its
   ledger row with the smallest enrichment, or the build tasks will discover them the hard way.

2. **[must-fix] `npmrds-report.html` § graph-2-map / graph-3-info / compound-foot — the
   demonstrated compound card is broken, and Design note 1 claims otherwise.** Measured in
   render: **24 px of pane** between the cards' open (border-b-0) bottom edges and the shared
   attribution foot — because the pieces sit in different rows of a `gap-6` grid, where no
   amount of section-padding zeroing can close a grid-owned gap. The "fused" card reads as two
   cards with missing bottom borders plus a stray floating strip (with a pane-coloured hole
   over the foot in the inter-column gutter). This is the set's *only* demonstration of
   contract item 9. Fix now: give each card its own one-line attribution and delete
   `compound-foot` (side-by-side sections sharing a basement is not the documented recipe
   anyway — patterns §13 and skill §7.4 define compound cards as *stacked* sections sharing an
   edge). Fix in the docs: rewrite Design note 1's claim — on the catalogue's gap-6 grid,
   compound cards are **not achievable**; they arrive with the gap-0 conversion the note
   already defers to a follow-on task. Contract item 9 should say so.

3. **[should-fix] Nested `data-dms-section` markers — sections inside sections don't exist in
   DMS.** Census: npmrds-home 19 (e.g. `latest-complete` inside `latest-data`, four `tool-*`
   inside `tools`), npmrds-reports 17, npmrds-report 4 (including `report-summary` nested
   *inside* `page-header`), macro 3; the retrofit pages inherited the idiom from the catalogue
   (map-21 pages: 4 each). A wrapper that contains sections is a *band*, not a section — as
   tagged, the mockups mistranslate (the row JSON has no container-section concept). Mechanical
   fix: outer wrappers lose `data-dms-section` (the band head becomes its own lexical section);
   `report-summary` becomes a sibling section in the header group.

4. **[should-fix] `npmrds-report.html` § route-list / § finding — the rail's `lg:sticky` is
   inert, and patterns §13's guidance doesn't match the demonstration.** Rendered proof: at
   scrollY ≈ 1400 the rail is entirely off-screen — under `items-start` the rail's grid column
   is content-height, so the sticky children have no travel (and if they did, two siblings both
   pinned at `top-6` would overlap). Patterns §13 asserts `items-start` is what *makes* the rail
   stick; the set's own mockup disproves the claim as drawn. Fix: one sticky wrapper around both
   rail cards inside a full-height column (or drop the sticky classes and the §13 sentence);
   reconcile with `adding-an-in-page-nav-rail.md` since the live DMS structure is what the
   mockup is supposed to preview.

5. **[should-fix] `npmrds-reports.html § 01` — two facet chips need an expressibility check.**
   `mine` (user-scoped: is `created_by = current user` expressible as a Filter leaf?) and
   `recent` (a relative-date predicate — the URL-toggle gap-filter vocabulary covers
   empty/notempty, not `updated > now-30d`). If either isn't a real filter leaf, it's a facet
   in name only — verify against `full-text-search-filter.md` / the Filter component before the
   build task, or swap `recent` for the sort control that already exists. Also flag: the result
   rows render per-report route chips (name + TMC count + length), which requires route metadata
   denormalized onto the reports source — a data-shape prerequisite worth a line in the build
   task, not a primitive gap.

6. **[taste] `npmrds-report.html § graph-6-grid` — authored insight inside graph chrome.**
   "S3 & S4 north of Main St carry the gain" sits in the legend row; avlGraph legends don't
   carry authored copy. Move to the band head meta or a caption cell if kept.

---

## § 6 · What's missing

Checked against the legacy inventory (Home, Map/MacroView boxes + DataDownload, pm3Map21,
BatchReportsNew, analysis, Folders, docs). Present and accounted for: MeasureInfoBox +
MeasureVisBox (macro panel 2), DataDownload (macro panel 4), TmcSearch (panel 1), bottlenecks +
incidents (collapsed rows, panel 2 — per brief), HoverComp (popup), compare-year, network
toggle, per-measure entry (macro § 01), the 12 FocusAnalysis templates, curated reports,
route-creation path, folders-as-facet, region-select cut (noted in § 02's comment). That's a
clean sweep of the big items. The gaps:

1. **[should-fix] `npmrds-home.html § docs-index` — Training Videos (419465) is missing**, and
   the task's must-link list named it explicitly. Regional Analysis (280612) and the Appendix
   (281807) are also absent ("all 9 →" gestures at them but the six drawn rows skip three
   required ones in favour of Batch Reports API). Fix: swap in Training Videos at minimum;
   ideally list all nine — it's a docs index, completeness *is* the content.

2. **[should-fix] `npmrds-report.html § page-header` — no print/export-shaped moment.** Open
   question 4's recorded default was "one print-shaped state"; the header has Data / Share /
   Edit but nothing that acknowledges these reports get handed to clients as documents. Fix:
   either a Print/PDF action in the pair (smallest) or one drawn print-header state (the
   default answer). If cut instead, it needs the "cut, because" note the done-criteria demand.

3. **[should-fix] Unverified numbers presented as fact.** The task's bar is "zero invented
   numbers." Verified figures are everywhere (good), but: **"1,204 saved routes"**
   (`npmrds-reports.html` header meta + § routes card) and **"52,157 TMC segments · 2025 map"**
   (`npmrds-home.html § latest-spine`, repeated in patterns §10) are not in the task's verified
   list. Verify both (routes count against the routes source; TMC count against view 1041) or
   mark them as illustrative in the page comment. Everything else I spot-checked reconciles
   (115 months ✓, 4 × 9 TMC = 36 ✓, legend bins sum to 3,112 ✓).

4. **[no finding] Loading/error states** for pages 2 and 6 exist only as the shared patterns
   §01 vocabulary, not per-page drawings — acceptable-by-reference; contract item 8 says use
   that vocabulary, and the page-specific empty states (first-run reports; unused route + add
   graph) are drawn properly.

5. **[taste] Percentile-speed submeasures** (5/20/25/50/75/80/85/95) appear only as
   "5th … 95th" in macro § 01 — fine as a summary; the conditional-controls § 02 could name the
   percentile list in its LOTTR/Emissions swap examples if a third proof card is ever added.

---

## Judgments on the seven Design notes (asked for or load-bearing)

- **Note 1 (gap-6 vs gap-0):** matching the catalogue was the right call for ordinary bands —
  but the note's claim that compound cards "still work and are demonstrated" is **false as
  rendered** (see Honesty 2, the measured 24 px gap). Rewrite the note; fix the demonstration;
  amend contract item 9. Also fix `grid.html`, which currently *documents* `gap-0` in its spec
  table while its own ruler section says "24-px gap" and every demo uses gap-6 — the doc
  contradicts itself page-internally (and its `layouts.centered: mx-auto` row contradicts skill
  done-criterion 8's `mr-auto`). The docs must describe the catalogue that exists, with the
  deviation note pointing at the conversion task.
- **Note 2 (py-12 bands):** right call, no strings attached — consistent, documented, and the
  section-padding conversion belongs with the gap-0 task.
- **Note 3 (type debt):** half right — see § 4 finding 1. Declaring the chrome role is this
  task's job; the long-tail folds are the catalogue pass.
- **Note 4 (macro scrolls):** right call. Reference prose in floating panels would have been
  worse; the § 01/§ 02 bands below the workbench are the strongest part of the page.
- **Note 5 (both search treatments):** discharged by the A/B ruling above.
- **Note 6 (route-comparison chrome-only retrofit):** over-scoped exemption — the route-row and
  rail-family alignment the Phase-6 brief ordered are chrome, not architecture (Coherence 8).
- **Note 7 (getting-started left in place):** fine per the recorded default.

---

## Must-fix summary (work straight down)

1. **A/B ruling:** ship § 01 (treatment A); delete § 05 from `npmrds-reports.html`; fold B's
   no-results + empty-query states into § 01's results card; log the palette in Escalations.
2. **`route-comparison.html` SideNav:** expand the MAP-21 level-2 group (only page with no
   expanded group — criterion 5).
3. **1600 px container** on `npmrds-report.html` + `route-comparison.html`: normalize to 1480
   or document a wide archetype in layouts.html + patterns §07 (and grid.html).
4. **`npmrds-macro.html` freshness strip:** restore the four shared segments; amend contract
   item 4 to allow page-scoped suffixes (legalizing the MAP-21 pages' "pm3 year 2025" tail).
5. **Download affordance** on `map-21.html` and `map-21-trend.html` (contract item 7).
6. **Escalations table:** populate with the five entries in Honesty 1 (palette; distribution
   histogram; download builder; "edit breaks" — also demote/remove it from the panel;
   "shift-click to add to a route" — also reword the popup caption).
7. **Compound card on `npmrds-report.html`:** per-card attributions, delete `compound-foot`;
   rewrite Design note 1's compound-card claim and contract item 9 (compound cards await the
   gap-0 conversion); fix `grid.html`'s self-contradictory gap-0 spec row.
8. **Type system:** declare the 3-token chrome role (`chromeNav` 13, `chromeLabel` 10,
   `chromeTick` 9) in theme.html § type — declare-to-match, zero page edits.

Should-fix, in priority order: breadcrumb shape normalization (Coherence 5) · macro workbench
resting-state redraw + popup/panel collision (Hierarchy 1) · Δ-column clip on the report
summary table (Hierarchy 2) · one size-4 graph card proving the density rule (Density 1) ·
route-comparison route-row/rail-family alignment (Coherence 8) · nested `data-dms-section`
re-tag (Honesty 3) · inert sticky rail + patterns §13 reconciliation (Honesty 4) · statXL/statLG
fold + `displayItalicMD` ghost + patterns §03 40px-mono KPI redraw (§ 4.3–4.5) · long-tail type
folds (§ 4.2) · Training Videos et al. in the docs index (§ 6.1) · print/export moment (§ 6.2) ·
verify "1,204 routes" / "52,157 TMCs" (§ 6.3) · `mine`/`recent` facet expressibility check
(Honesty 5) · contract-text amendments for the nav/header workbench exceptions (Coherence 6–7).

---

## Rejected

Applied by the Phase 8b tightening pass, 2026-07-29. Every finding above was either fixed or is
listed here with a reason — nothing was silently skipped. "Deferred" entries are logged as
follow-on tasks in the task file's Phase 8 section; they are not regressions.

- **§4.3 · fold `statXL`/`statLG` into `displayHero`/`displayMD`, or delete the folded-variants
  doctrine — REJECTED as framed.** The diagnosis is correct (they differ only by `tabular-nums`,
  which §7.2.1 names as a modifier axis). But deleting a *declared* token is a non-BC change to a
  published set that other catalogue pages already bind by name, and deleting the doctrine would
  be worse. Instead both rows stay, with one honest reconciliation line marking them **pinned
  tabular aliases retained for existing consumers**, and directing new work to
  `display* + tabular-nums`. The fold itself is logged as a follow-on needing Alex's call.
- **Honesty 3 · nested `data-dms-section` on the five retrofit pages — DEFERRED, not rejected.**
  Fixed on the four new pages (43 markers). The retrofits inherit the idiom from ~40 catalogue
  pages; re-tagging the catalogue is a separate task, and re-tagging five of forty-five would
  create a worse inconsistency than the one it fixes.
- **§4.2 · re-tokenise the docs pages' own 20px section heads — DEFERRED.** The long-tail folds
  were applied within the nine category pages (162 specs). The docs pages' internal type is the
  same catalogue-wide pass as above.
- **§6.3 · "verify against view 1041" — REJECTED, the guidance is factually wrong.** `v1041` is
  the **2022** TMC geometry view (51,227 segments); the 2025 view is **`v1312`**. The mockups had
  inherited the same error and paired 1041 with "2025" in two places — both corrected. The count
  itself (52,157) verified against three independent 2025 sources.
- **Honesty 5 · "swap `recent` for the sort control that already exists" — REJECTED, both
  premises fail.** `recent` **is** expressible today: a structured `op:'time'` filter leaf ships a
  `last_30d` preset ("Last 30 days"), URL-bound as `last:30d`, compiling to
  `col >= now() - 30 * interval '1 day'`. And the sort control is the thing that does **not**
  exist — `sort` is an author-time column property; the table header only renders a direction
  icon, with no click-to-sort or viewer sort control anywhere. So the chip stays and the *sort*
  became an escalation. (Two real caveats on `recent` are logged: Postgres-only, and it must key
  off a date stored inside `data`, not the row's unregistered `updated_at`.)
- **Hierarchy 4 (taste) · make `npmrds-report`'s dark `#12181F` rail header white — REJECTED, it
  conflicts with Coherence 8.** Coherence 8 (a should-fix) requires `route-comparison`'s builder
  to adopt *the dark rail header* so the two route-selection surfaces read as one family. The two
  findings pull opposite ways; the should-fix wins, and "routes are the report's legend" is the
  defence the critique itself offers. `route-comparison` went dark; nothing went white.
- **Coherence 9 (taste) · `hero` vs `header` group on the landing page — no change, as the
  critique itself concluded.** Noted as deliberate.
- **Density 3 (taste) · trim the quick-start step-card copy — NOT DONE.** The band was
  restructured (nesting + docs index), but the copy is accurate and the critique rated it "fine to
  ship". Rewriting body copy that no finding calls wrong is churn, and mockup copy is meant to be
  carried verbatim into the build.
- **§6.5 (taste) · name the percentile list in § 02's LOTTR/Emissions swap examples — NOT DONE.**
  The critique gates this on "if a third proof card is ever added"; no third card was added, and
  the full percentile ladder is already in the § 01 measure-reference table.
