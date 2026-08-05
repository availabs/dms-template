# MNY County Actions — Jurisdiction Prioritization page

**Topic:** themes
**Status:** DONE — pending a human visual pass
**Started:** 2026-08-04
**Design section:** `src/themes/mny/design/pages/county-actions/` (County Actions Workflow)

**Live build task:** [`mny-jurisdiction-prioritization-live-build.md`](./mny-jurisdiction-prioritization-live-build.md)
— converts this design into a real DMS page (created 2026-08-04).

## Objective

Add a sixth page to the MNY design system's County Actions Workflow: a **jurisdiction
prioritization** page that is the local jurisdiction's counterpart to the county workspace.
It carries the **local priority** column where the workspace carries county priority, and it
absorbs the **Needs your attention** band that currently lives on the county dashboard.

The county workspace narrows to a single job as a result: **county priority is its only
editable column.**

## Scope

In scope — design mockups only (`pages/county-actions/*.html`), the shared nav widget, the
design-system README, and this task file.

Out of scope — the live DMS pattern (`mitigat-ny-prod` pattern `2265530`), `theme.js`, and any
section/page creation via the CLI. Nothing here is published.

## Current state (before this task)

Five linked pages: `dashboard` → `jurisdictions` → `workspace` → `action-view` ⇄ `action-edit`.

- `dashboard.html` hosts the **Needs your attention** band — four blocker tiles (county tier,
  cost range, action type, critical facility) + an "also missing" row, each deep-linking into
  `workspace.html` with one filter switched on.
- `workspace.html` has **four** inline-editable columns (action type, cost range, critical
  facility, county priority) — deliberately the same four the dashboard band counts, "so a
  tile's deep link lands somewhere the fix is actually possible."
- `jurisdictions.html`'s 22 municipal tiles and its county tile all link to `workspace.html`.

## Proposed changes

### The split

| Page | Who | Editable |
|---|---|---|
| `jurisdiction-prioritization.html` (new) | the jurisdiction, on its own actions | **local priority** + the three data-completeness gaps (action type, cost range, critical facility) |
| `workspace.html` | the county, across all jurisdictions | **county priority only** |

Rationale: the needs-attention band's whole premise is that a tile lands where the fix is
possible. Moving the band onto the jurisdiction page therefore moves the three gap-fixing
editable columns with it, and leaves the county workspace as the single-decision surface its
lede already claims it is ("Assign a county priority tier to each mitigation action").

### Flow order (now six)

1. dashboard → 2. jurisdictions → 3. **jurisdiction prioritization** → 4. county workspace →
5. action view ⇄ 6. action edit

`jurisdictions.html`'s per-jurisdiction tiles enter at 3. The two county-scope routes on that
page ("Work all 475 in one list", the `Sullivan (County)` tile) still go to 4 — county scope is
the county workspace's job.

### Design notes

- **Design note — the band replaces the gap-chip row on the new page.** The workspace's filter
  bar carries a second "show only actions that need…" chip row, which existed because the band
  lived on another page. With both on one page that would be two ways to say the same thing, so
  the new page drops the chip row and the band's tiles carry the toggle state themselves (first
  tile ON, `aria-pressed`). The workspace keeps a chip row, reduced to the tier chip.
- **Design note — band counts stay county-wide** and say so on the band header. The reference
  aggregates in `assets/mny/data/` are county-level; per-jurisdiction gap counts aren't baked.
  The live build re-scopes them through the same page filter.
- **Design note — local priority is free text in the source.** `action-edit.html` renders it as
  a text input ("The jurisdiction's own ranking. Distinct from the county tier above."), not a
  four-tier select. The new page's inline editor is therefore a select over the observed values
  (High / Medium / Low / Not Reported) that still renders an unrecognised value in the
  established `bad value` treatment, the same convention `cost_range` already uses.
- **Data gap — local-priority fill is not measured.** Every other number on these six pages is
  real Sullivan data. `local_priority` is not present in
  `assets/mny/data/sullivan_actions.geojson` (which carries only status and location precision),
  and the DMS CLI is not configured in this checkout, so the page's local-priority *counts* are
  placeholders. This is stated in the page's HTML comment and visibly in its footer meta line.
  Refresh from source `1029065` / view `1074456` before this page is used as a data reference.
  Fallsburg's status split **is** real: 30 actions — 28 Proposed, 1 In-Progress, 1 Completed.

## Files requiring changes

- [x] **NEW** `pages/county-actions/jurisdiction-prioritization.html` — copied from
      `workspace.html`; local priority column, moved needs-attention band, Fallsburg-scoped
      stat strip, no gap-chip row.
- [x] `pages/county-actions/dashboard.html` — needs-attention section removed; map click and
      "open worklist" copy retargeted at the new page; page index → 6 entries.
- [x] `pages/county-actions/workspace.html` — county priority the only editable column (the
      other three become read-only); toolbar `1 editable`; gap row reduced to the tier chip plus
      a pointer to the jurisdiction page; comments rewritten; page index → 6 entries.
- [x] `pages/county-actions/jurisdictions.html` — 22 municipal tiles → the new page; county-scope
      routes unchanged; page index → 6 entries.
- [x] `pages/county-actions/action-view.html` — jurisdiction breadcrumb + "Back to worklist" →
      the new page; page index → 6 entries.
- [x] `pages/county-actions/action-edit.html` — jurisdiction breadcrumb → the new page; the
      county-tier note still points at the workspace; page index → 6 entries.
- [x] `ds-nav.js` — new page added to the `county` section in flow order; workspace relabelled
      `county workspace`.
- [x] `src/themes/mny/design/README.md` — folder structure + County Actions Workflow prose.

## Testing checklist

- [x] Every `<a href>` in `pages/county-actions/` resolves to a file that exists.
- [x] No page in the section still links a per-jurisdiction route at `workspace.html`.
- [x] The needs-attention markup appears exactly once in the section.
- [x] `workspace.html` has exactly one editable column (one Edit pencil in the table head).
- [x] Page-index footers list six entries on all six pages, each with its own entry active.
- [x] Table cells balanced — 8 `<td>` per data row against 8 `<th>`, on both worklists.
- [x] Rendered over a local server: all six sections present and sized, no horizontal
      overflow, no element overflowing its container, dashboard band gone, nav widget lists
      six county pages with the right one active.
- [ ] Human visual pass (screenshots unavailable in this session — the Browser pane wasn't
      displayed, so verification was DOM/text-based, not pixel-based).
- [ ] Local-priority counts refreshed from the live source (blocked: CLI not configured).

## Round 2 — hero condensed (2026-08-04)

Feedback: the hero cards ate too much vertical space, and the denominator appends ("8 / 30")
should go. The hero band went from **183px to 95px** at `lg+` (−48%) via three cuts, each
removing a restatement rather than a fact:

- [x] **Every cell is one row** — label and value share a baseline (`flex items-baseline
      justify-between`) instead of stacking label / number / sub-line, so height is set by the
      type size. Stat cells: 90px → 42px intrinsic; they stretch to the lede's height with the
      pair vertically centred (`flex-col justify-center` + an inner baseline row).
- [x] **No denominator or derived-text appends** — dropped "/ 30", "93% of Fallsburg",
      "Monguap Road culverts", "Maplewood Ave culvert", and the word "Showing" on the active
      cell. The total lives on the first cell and in the pagination row; the active cell is
      marked the way it is everywhere else in the section (tinted fill + ring + solid left edge).
- [x] **No prose under the meter** — it restated the "Not set · 22" legend chip and the first
      needs-attention tile. The legend is now one non-wrapping row of 5 chips (verified: single
      row) and carries the counts.

**~~Design note — the band tile's "22 / 30 here" was deliberately kept.~~ Reversed in round 5**
(below) at the user's direction — the fraction is gone and the scope split it was carrying now
lives in the band's lede instead.

## Round 3 — dashboard cleanup (2026-08-04)

- [x] **Removed the yellow "Plan review will send fields back" box** (`data-gap-handoff`), the
      placeholder this task had put where the needs-attention band used to be. Nothing replaces
      it — a comment marks the spot and explains why. The dashboard reports; the hero buttons
      are the routes into the work.
- [x] **"Mitigation approach" → "Mitigation category"** (`action-type-mix` heading). Kept the
      file's sentence-case convention — the display uppercase comes from the type token, and
      every other h2 on the page is written that way. The `data-name` is unchanged, since it
      tracks the underlying field.
- [x] **Added a "Prioritize Actions" button** beside Edit Actions, linking to `workspace.html`
      (the county-priority page). Outlined `bg-mny-50`, not a second amber pill — two filled
      CTAs side by side read as one action split in half, and Edit Actions is the one that opens
      the jurisdiction chooser. Reuses the existing named `List` icon rather than introducing an
      unregistered glyph.
      - Design note: Edit Actions gained `border border-transparent`. Without it the outlined
        button rendered 2px taller (42 vs 40) and the pair sat misaligned on one row. Verified
        both now 42px with matching tops.

## Round 4 — All County Actions table (2026-08-04)

- [x] **Removed the Action # column** — header plus all six row cells. Table is 7 → 6 columns,
      every row verified balanced. Row 5's number was `—` (no action number recorded), so that
      one row's "unknown" state is no longer surfaced on the dashboard; it still shows on the
      action pages and in the worklists.
- [x] **Bolded the Action Name column** — `font-[600]` on the six `action-view.html` links, this
      system's table-cell emphasis weight (matching the Jurisdiction cell and the worklist
      tables). 700 in prose is reserved for uppercase micro-labels.
- [x] **Design note — added the section's scroll-container pattern to this table.** The five
      trailing columns are fixed-width, so Action Name is the only one that flexes; dropping the
      150px number column left it at **126px** under ~1000px of table width, wrapping names to
      three lines. Wrapped the table in `overflow-x-auto` with `min-w-[980px]`, exactly as the
      two worklist tables in this section already do, which takes Action Name to 268px at the
      narrow end (≈578px at the 1440px page cap) with at most two-line wrapping. Pagination sits
      outside the scroll container so it stays put while columns scroll.

## Round 5 — the last data-append removed (2026-08-04)

Round 2 kept `22 / 30 here` on the first needs-attention tile, reasoning that the fraction was
the only thing marking that count as Fallsburg-scoped among three county-wide ones. **That
reasoning is reversed: the tile is not the right place to carry a scope qualifier.**

- [x] **Removed "/ 30 here".** The first tile now has byte-identical structure to the other
      three — a bare number beside its toggle. Verified at the 4-across breakpoint: one tile
      top, one tile height (183px), one number baseline, one toggle baseline.
- [x] **Removed the "County-wide counts" chip** beside the heading. With the fraction gone it
      was half a scope statement, and it had always been the second thing saying what the
      fraction said.
- [x] **Scope split stated once, in the band's lede:** "Local priority counts Fallsburg; the
      other three count the whole county." Prose, not an append, and it says it one time.
- [x] Section comment rewritten to record why no tile carries a denominator (the jurisdiction
      total is already on the hero's first cell and in the pagination row) and to note that the
      lede sentence should be **deleted, not reworded**, once the live build re-scopes all four
      counts through the jurisdiction filter.

Verified: 0 rendered fractions anywhere in the page body, div tags balanced 78/78, worklist
table still 8 columns. The string `/ 30 here` survives only inside an explanatory HTML comment.

## Round 6 — hero numbers on one baseline (2026-08-04)

- [x] **The lede's "8" now centres vertically and stays right-justified.** It had been sitting on
      the label's baseline in the card's top row, ~14px above the stat-cell numbers. Pulled it
      out of the label/meter/legend stack: the card is now `flex items-center justify-between`
      with the stack in a `flex-1` column and the number last with `shrink-0`.
- [x] **Fixed a pre-existing misalignment the request surfaced** — the four stat numbers weren't
      level with each other either (two at 375px, two at 382px). Cause: each cell centred an
      inner `items-baseline` row holding label + number, and "Fallsburg actions" / "In-Progress"
      wrap to two lines, so their rows were 39px vs 26px and centring the taller row lifted the
      baseline-aligned number by 7px. Flattened all four to the same structure as the lede, so
      each number centres against its own cell independent of label line count.

Measured at the 4-across breakpoint: **all five numbers share one top (383px) and one bottom
(407px)**, every number is exactly centred in its card (centre-offset 0 on all five), all five
cards are 65px, and the legend still holds one row. The hero also lost another 14px (95 → 81px)
because the number no longer drives the stack's height.

One residual, left alone deliberately: the lede's number sits 13px from its card's outer right
edge vs 12px for the stat cells — the lede has a 1px right border, so the numbers are equidistant
from their *content* edges. The cards are 12px apart, so no eye checks that alignment; the shared
horizontal baseline is what matters and it is exact.

## Round 7 — the condensed hero ported to the county workspace (2026-08-04)

The two worklists' heroes are now the same object. `workspace.html`'s band went **183px → 81px**,
matching `jurisdiction-prioritization.html` exactly. All four rules carried over:

- [x] Every cell is one row — label left, count right, shared baseline.
- [x] The count sits outside the label/meter/legend stack and centres against the card's full
      height, so a wrapping label can't lift it.
- [x] No denominator or derived-text appends — dropped `/ 475`, `82% of actions`,
      `5% of actions`, `9% of actions`, and the `Showing` line on the active cell.
- [x] No prose under the meter — dropped "One tiered so far. The other 474 are what this worklist
      is for", which the `Not set · 474` chip and the tier gap chip already say.

Verified identical to the jurisdiction page by structural fingerprint (lede shell, stat shell ×4,
`flex-1 min-w-0` labels ×4, `shrink-0` numbers ×5, `h-[7px]` meter, legend gap, dot size, section
padding, zero appends — all matching) and by geometry: hero 81px, all five cards 65px, all five
numbers on one top (383px) and bottom (407px), centre-offset 0 on each, legend one row.

**Design note — tier chips keep their `·` separator** (`T1 · 0`) where the jurisdiction page's
word-labelled chips dropped it (`High 3`). `T1 0` reads as a single token; the separator is a
legibility need, not a style inconsistency.

**Pre-existing data contradiction, left as found and NOT introduced by this restyle:** the lede
says 1 action is tiered / `Not set · 474`, while the tier gap chip beside it counts `a tier 475`
and the README states county priority is unset on all 475. The mockup's row 2 does show a Tier 2
value, so the "1 tiered" is a deliberate demo of the tiered state that the 475 figures were never
reconciled with. Worth settling before this page is used as a data reference — either the demo row
loses its tier (all figures become 475) or the gap counts become 474.

### Incident — document corrupted mid-edit, then repaired

A scripted edit passed HTML through a `String.replace()` **replacement string**. That HTML
contained a literal `$'` (inside the `cost_state` SQL in a comment: `~ '^[<>]?\$'`), and `$'` in
a replacement expands to *everything after the match* — so the whole document tail was spliced
in at that point and the `$'` was eaten. The page rendered every section from `needs-attention`
onward twice (1244 lines, two `</html>`).

Repaired by restoring the eaten `$'` and dropping the spliced copy; verified back to 763 lines,
one of each section, 8 `<th>` / 7 `<tbody>` rows, the SQL comment byte-identical to its original
form, 0 broken links.

**Rule for future scripted edits in this folder: never pass page text as a `replace()`
replacement string — use a function replacement (`replace(re, () => text)`) or slice
concatenation.** These pages carry `$` in cost-range copy and in SQL comments, so `$'`, `$&` and
`$\`` are live hazards, and the failure is silent.

## Late corrections made during implementation

- **The band's first tile was drafted lit** (filtering to the 22 unranked) while the worklist
  showed rows that already had a local priority — the two contradicted. Resolved by showing the
  unfiltered arrival state: all four tiles off, all 30 rows listed, so the Local Priority column
  demonstrates its set / unset / unrecognised-value states instead.
- **The dashboard hand-off duplicated the hero CTA** — both were amber pills to
  `jurisdictions.html`, 40px apart. The hand-off's routes are quiet uppercase links now; the
  hero keeps the page's only button.
