# Why the reports/routes tool "feels incomplete" — cold-open UX findings

**Date:** 2026-07-31. Triggered by Ryan's question: after weeks of working the ranked
`report-route-ui-parity-gaps.md` list, the ported report/route creation tool still
"FEELS shitty... doesn't look or feel complete, like a real feature," and each fix
feels smaller than the last. This doc is the investigation into *why*, not another
entry in that list — it's a different axis the existing list structurally can't
produce (see "Why this category was never caught" below).

## Method

1. Read the current planning state: `report-route-ui-parity-gaps.md`,
   `report-spec-and-build-script.md`, `route-creation-tool.md`,
   `src/dms/skills/creating-reports.md` / `creating-routes.md`.
2. Live walkthrough via browser automation against the local dev stack
   (`npmrds.localhost:5173`, logged in as the dev test account), driving the actual
   click-path a first-time author would use — not the `report_build.mjs`/`route_build.py`
   scripts. Corrected mid-walkthrough by Ryan to focus on the sidebar-reachable tool
   under active development rather than the old public dashboard nav.
3. One false-positive caught and retracted during the session: an apparently-clipped
   side panel turned out to be a mid-slide-in animation frame in the automation tab,
   not a real layout bug — confirmed by resizing the window and re-checking. Noted here
   so a future session doesn't need to re-litigate it.

## Finding A (structural, from the docs — not new)

The team's own actual workflow for building a report or route has moved to a script
(`report_build.mjs` / `route_build.py`), documented explicitly in `creating-reports.md`
and `creating-routes.md` as "the primary path... kept as a second column" for the UI
click-path. The reason given is that the UI has real silent-failure modes (graph pill
not registering, an un-saved Measure pick silently discarded, a difference graph
needing an unexplained re-save). This is the inverse of `CLAUDE.md`'s own author-
empowerment principle: right now the *developer* path is the reliable one and the
*author-facing UI* is the one worked around instead of fixed. `report-route-ui-parity-
gaps.md` has been closing bugs on that de-prioritized UI one at a time.

## Finding B (new — found live): the first 60 seconds of a cold start are broken

Past the structural point above, the live walkthrough surfaced a second, sharper cause
that's easy to miss because it isn't a measure/graph bug at all — it's what happens
*before* you ever touch a route or a measure:

1. **Creating a report page gives zero feedback.** Bottom toolbar → Page icon → Pages
   panel → "+ Add Page" → "Your Templates" → "Report Page" → "Create Page" creates the
   row and closes the dialog — no redirect, no confirmation, no visible change at all.
   You're left staring at whatever page you were already on. The only way to find your
   own new page is to already know to reopen the Pages tree, or query the DB directly
   (`creating-reports.md` documents exactly this as the workaround: "The new page's
   slug isn't predictable from the UI alone. Refresh, reopen the Pages panel, or query
   directly"). **Live-confirmed twice**: once by reproducing it (created page id
   `2197866`, slug `converted_reports/page_40`, found only via
   `scripts/npmrds-reports/dbq.py`), and once by Ryan hitting it independently in real
   time before I could report it ("idk really even how to find it XD, that's a DMS
   issue").
2. **The new page has no naming step.** It defaults to a generic, non-descriptive title
   ("Page 40") with no prompt to name it at creation time.
3. **The Settings gear shows a deliberately reduced menu** (Type / Dataset / Layout /
   Delete only) until a small pencil "Edit" icon — with no visual affordance hinting it
   unlocks anything — is clicked. Only then does the full menu (Measure, Columns,
   Filters, Display) and the Quick Controls pill row appear. This exact behavior is
   already written up as tribal knowledge in `creating-reports.md` ("The Measure
   Picker/Quick Controls only appear when the section is in true 'edit' mode... Click
   the gear, then the pencil") but was never logged as a trackable UI gap — it's
   documented as "how it works," not "a bug to fix."

None of this is specific to NPMRDS — (1) and (2) are DMS's generic page-creation flow,
not this theme's code — but they land squarely in the report-building workflow's first
few seconds, which is exactly the layer "feels unfinished" comes from.

## Counter-evidence: the actual mechanism is in decent shape

This matters for calibration — the tool is not deeply broken end-to-end. On the same
scratch page, past the friction above, the happy path worked cleanly:

- Adding a route via the "Add a route..." search/recently-created list worked
  immediately (no confirm-dialog friction encountered this session, contrary to what
  `creating-reports.md` describes — possibly stale, or the dialog only fires in some
  other condition; worth a quick re-check next time someone's in there).
- Setting a Date Range via the documented pencil-first sequence produced a clean
  `01/01/2025`–`02/28/2025` result with no garbling.
- Toggling the route's "ON: Graph 1" assignment pill rendered a real line chart against
  live ClickHouse data **immediately** — no re-save dance, no silent failure — with a
  correct, clean hover tooltip.
- The Days-of-Week and peak-hour preset rows from gaps #10/#11 (closed 2026-07-30 and
  2026-07-28 respectively) are genuinely present and match their documented design.

So the recent gap-list work was real and not wasted. It just wasn't the layer this
investigation was asked to explain.

## Minor aside, lower priority (per Ryan's steer mid-session)

The sidebar's top-level "Reports" and "Routes" nav items (in the public/non-edit site
chrome) both resolve to `/folders/reports` and `/folders/routes` — URLs with no backing
page, which per the site's general "unknown slug silently falls back to the home page"
behavior (see memory `reference_local_report_page_repro`) render the unrelated MAP-21
PM3 dashboard with no error or empty state. Ryan clarified this is old/not the tool
under active development, so it's not part of the core diagnosis — but it's a real,
reproduced dead link on the main nav, worth a look whenever nav-level polish comes up.

## Why this category of gap was never caught

Every person who has driven this UI already knows the pencil trick and already knows to
query the DB for a new page's slug — because it's always been the same one or two
people, dogfooding an expert path. Nobody has hit any of this cold, and (per Finding A)
the team's actual daily workflow moved to a script specifically *because* the UI had
rough edges — so the UI stopped getting used as anyone's real path, and its first-touch
experience stopped getting fresh eyes entirely. A gap list built by reviewing "what's
missing to reach spec parity" can only ever enumerate measure/graph-composition gaps —
it has no way to produce "a first-timer doesn't know where to click," because producing
that requires watching a first-timer, not auditing a spec.

## Recommendations

1. **Two cheap, high-visibility fixes**, worth doing before any more Phase C parity
   work:
   - Add Page should redirect straight into the new page's `/edit/<slug>` URL (ideally
     with an inline title prompt), instead of leaving the author to hunt for it.
   - The Settings-gear reduced-menu-until-pencil behavior should either show the full
     menu by default in edit mode, or the pencil affordance needs an obvious visual cue
     that there's more behind it.
2. **The larger structural move**: run one deliberate cold-open pass — hand the tool to
   someone who's never touched it (or deliberately simulate that) and watch exactly
   where they stall, *before* they reach a route or a measure. This is a different kind
   of input than another round of the ranked parity list, and it's the only way to
   surface this category of finding.
3. **On routes specifically**: prioritize the already-documented capability gap in
   `route-creation-tool.md` — a marker-made route reloads as a flat TMC list, not
   editable markers, the same create-rich/edit-poor asymmetry pattern as the report
   findings above — over additional polish items, since it's a real round-trip break,
   not a discoverability issue.

## Artifacts from this session

- Scratch page `converted_reports/page_40` (id `2197866`) — created live during the
  walkthrough to reproduce Finding B items 1–3. Left in place for Ryan to inspect
  (`http://npmrds.localhost:5173/edit/converted_reports/page_40`); safe to delete once
  reviewed.

## Cross-references

- `planning/transportny/tasks/current/report-route-ui-parity-gaps.md` — the existing ranked list;
  gaps #13/#14 added there pointing back to this doc.
- `planning/transportny/tasks/completed/report-spec-and-build-script.md` — Finding A's source.
- `planning/transportny/tasks/current/route-creation-tool.md` — the routes create/edit asymmetry.
- `src/dms/skills/creating-reports.md` — already documents items 1 and 3 of Finding B
  as workarounds, not gaps.
