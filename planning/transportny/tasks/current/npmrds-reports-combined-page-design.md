# NPMRDS Reports — combined page (toggle swaps content in place)

**Project:** TransportNY · **Topic:** themes · **Status:** DESIGN MOCKUP DONE, live build NOT STARTED · **Started:** 2026-09-04

> Not yet indexed in `planning/todo.md`/`completed.md` — several other sessions were touching
> shared planning files concurrently when this was written, so the index update was skipped on
> purpose. Whoever picks this up next should add the `todo.md` entry.

## Objective

Design a single combined Reports page where clicking the `Templates | All reports` toggle swaps
which content band renders below it **in place** — no route change, no page remount — instead of
today's link between two separate pages (`npmrds-reports.html`, page 2188366, LIVE; and
`npmrds-reports-list.html`, page 2217965, LIVE draft; full history in
[`npmrds-all-reports-list-page.md`](./npmrds-all-reports-list-page.md)). Asked directly by Ryan,
2026-09-04, "via the Design System / Design skills."

## What shipped this session (design only)

1. **`src/themes/transportny/TransportNY Design System/dms_design_system_v2/pages/npmrds-reports-combined.html`**
   — a new, working design-system mockup (plain HTML/Tailwind, per `designing-a-dms-design-system.md`).
   Both content bands (12-card Templates shelf, All-Reports rail+table) are transcribed verbatim
   from the two live pages' own mockups and mounted in the same DOM; a `setView()` toggle swaps a
   `hidden` class on each band, repaints the toggle buttons, and writes `?view=list` (or removes it)
   via `history.replaceState` — never a route change. Read the file's own header comment for the
   full design rationale; don't re-derive it here.
2. **Registered in `ds-nav.js`** (npmrds section) as `reports · combined (proposal)`, matching the
   existing `npmrds-picker-modals.html` "(proposal)" convention.
3. **New pattern entry `#toggle-swap` (§15) in `design-system/patterns.html`**, with a TOC link —
   required by the design-system's own "no smuggling" rule (§7.7: nothing in `pages/` may
   introduce a pattern not documented in `patterns.html`/`components.html`).
4. **One emergent, NOT-requested design decision, flagged not hidden:** the combined page unifies
   the two pages' different search widgets (Templates had a modal-trigger "find a report" dialog;
   All Reports had a real inline search box) into ONE shared inline search box that filters
   whichever band is visible. This drops the "find a report" modal dialog from this page entirely.
   That's a real behavior change from `npmrds-reports.html` (which keeps its dialog, unchanged, on
   its own URL) and needs Ryan's sign-off before it ships — not assumed by having built it into the
   mockup.

## The real finding — what's native today, and the concrete gap to close

Researched against the live `@availabs/dms` submodule before drawing anything (not assumed):

- **The closest existing mechanism is `sectionGroup.jsx`'s `isModal` + `modalParamKey` gate**
  (`src/dms/packages/dms/src/patterns/page/components/sections/sectionGroup.jsx:92-96`) — a whole
  LayoutGroup band mounts/unmounts based on an **action param** in `pageState.filters`
  (`type:'action'`), set via `setActionParam`/`clearActionParam` (`view.jsx:101-118`), read
  generically off `PageContext` (`context.js:4`). This is real, live, already used for
  `npmrds-reports.html`'s own "find a report" dialog, and already documented in
  `src/dms/skills/modal-section-group.md` §6 ("a modal that is NOT a create form"). Crucially it's
  **already in-memory / never a URL navigation** — exactly the "don't navigate to a different URL"
  requirement.
- **Three gaps, all small, none requiring a new primitive:**
  1. Presence-only, not value-matched (`f.values?.[0] !== undefined`) — no N-way switch.
  2. Modal-only chrome (`bg-black/50` overlay) — no inline/in-flow render mode.
  3. Action params are deliberately not URL-synced (`component-actions.md`) — a specific view
     can't be bookmarked/shared.
- **Proposed smallest enrichment (NOT BUILT — the concrete follow-up):** two additive keys beside
  `isModal`/`modalParamKey`: `displayMode:'modal'|'inline'` (default `'modal'`, so every existing
  group is byte-identical) and `condition:{searchKey,equals}` evaluated against ANY
  `pageState.filters` entry (URL-synced or action). No new registry entry, no bespoke React
  component — the same config-shape philosophy the search dialog already uses. Per
  `src/themes/CLAUDE.md`'s "configure, don't build" principle, a bespoke toggle component was
  considered and rejected on exactly this basis: the gap is a config generalization to an existing
  primitive, not a missing capability.
- **A genuine efficiency win the static mockup can't demonstrate:** with the real mechanism, an
  unmatched `condition` group renders `null` — so only the visible band's sections would ever
  mount/fetch. The mockup's both-bands-always-in-the-DOM approach is a mockup simplification, not
  what the live version would do.

This enrichment is a `@availabs/dms` submodule change (`sectionGroup.jsx` + wherever the group
schema/editor UI declares `isModal`/`modalParamKey`, likely `sectionGroupsPane.jsx`) — per
`src/dms/CLAUDE.md`/root `CLAUDE.md`, that part of the work belongs under `src/dms/planning/` once
it's picked up, not here.

## Not done / explicitly out of scope this session

- **The library enrichment itself** (`sectionGroup.jsx` generalization) — designed above, not
  implemented. Needs its own task under `src/dms/planning/` when picked up.
- **The live DMS page** — this session produced the design mockup only, per the literal ask
  ("design a combined page... via the Design System skills"), matching how
  `npmrds-all-reports-list-page.md` already flagged this as "a separate, larger deliverable, not
  started here."
- **Sign-off on dropping the "find a report" modal dialog** from the combined page (see emergent
  decision #4 above) — flagged, not decided.
- **`planning/todo.md` index entry** — skipped this session; see the note at the top of this file.
- A drive-by finding, also not fixed this session (same reason): `src/dms/skills/modal-section-group.md`
  exists and is directly load-bearing for this design, but is **not listed in
  `src/dms/skills/README.md`'s index** — a real gap, worth a one-line fix whenever someone's next
  in that file.

## If this gets picked up next

1. Get Ryan's read on the unified-search-box decision (emergent finding #4) before building the
   live page around it — it's a real, not-asked-for behavior change.
2. Scope and implement the `sectionGroup.jsx` enrichment (`displayMode`/`condition`) under
   `src/dms/planning/`, verified against the existing `isModal` search-dialog use (regression risk:
   it's shared code every `isModal` group in every theme depends on — see
   `feedback_prove_shared_code_regression_safety_with_grep` in memory).
3. Then build the live page: one URL-synced `view` page filter, two toggle Card cells with
   `click_publish`, two `content` groups with the new `displayMode:'inline'` + `condition`.
4. Update `src/dms/skills/README.md` to index `modal-section-group.md` while touching this area
   anyway.
