# NPMRDS Reports — combined page (toggle swaps content in place)

**Project:** TransportNY · **Topic:** themes · **Status:** DESIGN DONE + LIBRARY-CHANGE PLAN SPEC'D, live build NOT STARTED · **Started:** 2026-09-04

## Objective

Design a single combined Reports page where clicking the `Templates | All reports` toggle swaps
which content band renders below it **in place** — no route change, no page remount — instead of
today's link between two separate pages (`npmrds-reports.html`, page 2188366, LIVE; and
`npmrds-reports-list.html`, page 2217965, LIVE draft; full history in
[`npmrds-all-reports-list-page.md`](./npmrds-all-reports-list-page.md)). Asked directly by Ryan,
2026-09-04.

## What shipped this session

1. **`src/themes/transportny/TransportNY Design System/dms_design_system_v2/pages/npmrds-reports-combined.html`**
   — a working design-system mockup (plain HTML/Tailwind, per `designing-a-dms-design-system.md`),
   revised twice against live feedback. Read the file's own header comment for full rationale;
   don't re-derive it here. Current, final behavior (browser-verified both rounds, zero console
   errors):
   - Both content bands (12-card Templates shelf; All-Reports rail + paginated table, **rail kept
     in full** — facets, browse-by-tag, tag histogram) are mounted in the same DOM. `setView()`
     toggles a `hidden` class on each band, repaints the toggle buttons, and writes `?view=list`
     (or removes it for the `templates` default) via `history.replaceState` — never a route
     change. A cold load of `?view=list` opens straight into All Reports.
   - **One shared search box for both bands.** Typing a non-empty query while on Templates
     auto-switches the view to All Reports on the first keystroke, then applies the query there
     (Ryan's steer, round 2) — search means "search the library," not "filter these 12 cards."
     Clearing the box does not auto-switch back; that's an explicit toggle click.
   - The "find a report" modal dialog (`npmrds-reports.html`'s own feature) is still not
     reproduced on this page — superseded by the always-present inline search box. Real,
     acknowledged difference from the standalone Templates page; not asked to change there.
2. **Registered in `ds-nav.js`** (npmrds section) as `reports · combined (proposal)`.
3. **New pattern entry `#toggle-swap` (§15) in `design-system/patterns.html`** + TOC link —
   required by the design-system's own "no smuggling" rule (§7.7).

## The real mechanism — verified against live code, plan is implementation-ready

Everything below was traced through the actual `@availabs/dms` submodule (file:line cited), not
assumed. Three separate pieces, and the good news is **two of the three need zero new code** —
only `sectionGroup.jsx` needs a small, additive change.

### 1. The toggle itself — already fully native, zero new code

`Card.jsx:649` renders a link cell as `<Link to={url}>` (react-router client nav, confirmed —
`url` built at `Card.jsx:488` from the column's `location` + computed search params). `to="?view=list"`
on the SAME route is a same-page search-param change, not a route change — no remount. This is
**the exact mechanism the toggle already uses today** (`isLink:true, location:...`), just pointed
at a query string instead of a different page path. **No custom toggle component needed** — two
ordinary Card link cells, same as the live toggle already is.

### 2. The default/URL-synced `view` filter — already fully native, zero new code

An authored page filter (`item.filters`, registered per `creating-interactive-pages.md` step 0)
can carry a **default `values`** — confirmed via `mergeFilters`/`getPageVariableRegistry`
(`pages/_utils/index.js:444-454, 570-575`): `{searchKey:'view', values:['templates'],
useSearchParams:true}` seeds `pageState.filters` with `'templates'` on a bare load, and
`updatePageStateFiltersOnSearchParamChange` (`_utils/index.js:578-599`, wired from a
`useSearchParams()` effect in `view.jsx:88`) overrides it to `'list'` the instant `?view=list`
lands in the URL — reactively, no page reload (confirmed: `view.jsx` imports `useSearchParams`
from `react-router` at the top, `sectionGroup.jsx`'s consumers only see `pageState.filters`, never
touch `location` directly). This is the SAME already-proven mechanism as the pre-existing
`user_id_default_filter` (`siteConfig.jsx:177`) — just page-authored instead of pattern-global.

### 3. `sectionGroup.jsx` — the one real gap, small and additive

Current code (`src/dms/packages/dms/src/patterns/page/components/sections/sectionGroup.jsx:84-130`):

```js
const isModal = group.isModal && !edit;
const modalParamKey = group.modalParamKey;
const isOpen = isModal
    ? (pageState?.filters?.some(f => f.searchKey === modalParamKey && f.type === 'action' && f.values?.[0] !== undefined))
    : true;
if (isModal && !isOpen) return null;
if (isModal) { return ( /* bg-black/50 overlay + modalCard, unconditional */ ); }
// ...falls through to the ordinary mainSections/rail render for non-modal groups
```

Two gaps: (a) presence-only match (`values?.[0] !== undefined`), not value-matched — no N-way
switch; (b) always renders the overlay — no inline/in-flow mode; (c) hard-requires `f.type ===
'action'`, which action params deliberately never satisfy from a URL (`component-actions.md`) —
so a `isModal` group can never be gated by a URL-synced filter today.

**Proposed diff** — two new optional keys on the group row, both default to today's exact
behavior when absent:

```js
const isModal = group.isModal && !edit;
const modalParamKey = group.modalParamKey;
const modalParamValue = group.modalParamValue;          // NEW — optional value match
const displayInline = group.displayMode === 'inline';    // NEW — skip the overlay chrome
const isOpen = isModal
    ? (pageState?.filters?.some(f =>
        f.searchKey === modalParamKey
        && (displayInline || f.type === 'action')         // inline groups also accept URL-synced filters
        && f.values?.[0] !== undefined
        && (modalParamValue === undefined || String(f.values[0]) === String(modalParamValue))
      ))
    : true;
if (isModal && !isOpen) return null;
if (isModal && !displayInline) { return ( /* UNCHANGED overlay branch */ ); }
// isModal===false OR (isModal && displayInline && isOpen): fall through to the EXISTING
// mainSections/rail render, unmodified — an inline-modal group gets the rail/showRail
// machinery for free, same as any ordinary content group.
```

**Backward compatibility, verified by grep, not assumed** (`feedback_prove_shared_code_regression_safety_with_grep`):
every current `isModal` consumer — `ChooseReportButton.jsx` (the search dialog trigger),
`build_cr_page.mjs` (control-room "Add ticket" modal), `build_npmrds_reports.mjs` ("find a
report" dialog), `wcdb_theme.js` (themes the modal chrome) — sets neither `displayMode` nor
`modalParamValue`. With both undefined, the new `isOpen` expression reduces to byte-identical
logic (`displayInline` is `false` → `f.type === 'action'` required, unchanged;
`modalParamValue === undefined` → the value-match clause is a no-op, unchanged), and the render
still hits the overlay branch. Zero behavior change for any existing group.

**Author-facing UI, not yet touched:** `sectionGroupsPane.jsx` (`pages/edit/editPane/`) exposes
`isModal` (switch) + `modalParamKey` (text input) only — no field for `modalParamValue` or
`displayMode` yet. Not required to ship a first version (this page is CLI/headless-authored, like
every other build in `qa_skills/tools/builds/`), but a real gap for "author empowerment" if anyone
should ever configure this from the page editor. Two small additions when someone's next in that
file.

### Net page config (once the enrichment lands)

- Page `filters`: `{id:'view_default_filter', searchKey:'view', values:['templates'], useSearchParams:true}`.
- Toggle: two ordinary Card link cells, `isLink:true, location:'?view=templates'` /
  `location:'?view=list'` (same mechanism the live toggle already uses, just same-page).
- Two `content` groups: `isModal:true, displayMode:'inline', modalParamKey:'view',
  modalParamValue:'templates'` and `...modalParamValue:'list'`. Each holds its band's real
  sections (unchanged from either standalone page).
- **Not yet resolved:** the auto-switch-on-type behavior (typing in the shared search box flips
  `view` to `list`) needs the search `Filter` control to also write the `view` param as a side
  effect — no native "set filter B when filter A gets a value" primitive was found. Small,
  page-scoped custom behavior (or a small Filter enrichment) either way; not blocking, worth a
  fresh look when this is actually built.

## Not done / explicitly out of scope this session

- **The library change itself** — spec'd above, not written. Real submodule work; per root
  `CLAUDE.md`/`src/dms/CLAUDE.md`, belongs under `src/dms/planning/` once someone implements it.
- **The live DMS page** — design + plan only this session.

## If this gets picked up next

1. Implement the `sectionGroup.jsx` diff above under `src/dms/planning/` (new task file there).
   Verify against the existing search-dialog `isModal` use post-change (still an overlay, byte
   for byte) before touching anything page-specific.
2. Add the `view` default filter + two link-cell toggle + two inline `content` groups to a real
   page (new build script, mirroring `build_npmrds_reports.mjs`/`build_npmrds_reports_list.mjs`'s
   own discipline — find-by-slug-then-create, draft-only).
3. Resolve the auto-switch-on-type open question above.
4. `sectionGroupsPane.jsx`: add `modalParamValue`/`displayMode` fields alongside the existing
   `modalParamKey` input, so this becomes author-configurable, not just CLI-configurable.
