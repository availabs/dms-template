# Relative-dates authoring UI — scoping (2026-08-05)

Scoping pass requested by Ryan: "What would a UI look like for enabling relative dates?" — the
feature is built and live on the conversion/CLI side, but no author can create a relative-date
relationship by hand today. Read-only investigation (direct source reading of
`relativeDateResolution.js`, `RouteRow.jsx`, `ReportRouteList.jsx`, `useReportRow.js`,
`useDynamicReportRoutes.js`, `RouteTagBrowserModal`/`AddGraphModal`, `derived-page-variable.md`).
Nothing built, no DB rows touched.

**Headline finding that reframes the whole ask:** there are two unrelated mechanisms already
documented under "relative dates" in
`planning/transportny/tasks/current/dynamic-reports-and-route-tags.md` (item 3) and
`research/npmrds-reports/info-box-speed-and-relative-dates-scoping.md`, and only ONE of them is
actually "working" anywhere:

| | Mechanism A (`{recent-N}`) | Mechanism B (`relativeDate`/`isRelativeDateBase`) |
|---|---|---|
| Meaning | relative to **wall-clock today** ("this year," "last 3 years") | relative to **another row in the same report** (a designated base row's own literal date) |
| Python (conversion-time) | **not built** — sketched only, Ryan's 2026-08-03 call: "not worth building right now" | **built** — `resolve_relative_dates()` in `convert_old_reports.py`, live-verified against templates 244/278 |
| JS (live/runtime) | **does not exist at all** | **built** — `relativeDateResolution.js`, wired into `ReportRouteList.jsx`'s `effectiveRoutes` (line 130) |
| Authoring UI (either mechanism) | none | none — v1 only *renders* a relationship the Python converter wrote; there is no write path (task file's own "Not yet done" list, ~line 1466) |

So "we have this feature working for the conversion/CLI side" (Ryan's own words) describes
**Mechanism B only** — Mechanism A has zero code on either side. This matters directly for
scoping (see Q5).

---

## Q1 — Authoring surface: recommendation

**Extend `RouteRow.jsx`'s existing date-edit panel with a Fixed/Derived mode, not a new modal.**

Evidence for why this is the right surface, not a guess:

- The **read-only half of this UI already lives inside that exact panel.** `RouteRow.jsx:143`
  (`isDerivedDate = !!r.dateFormula`) gates the whole date block: pencil hidden (`:212`), inputs
  disabled (`:235-243`), a "Derived from {name}" note shown (`:227-231`). The write path is the
  only missing piece — finishing this panel is smaller than building a parallel surface.
- **The closest literal precedent is `derived-page-variable.md`, one layer up.** That primitive's
  own authoring UI is exactly this shape: a **"Derived From"** select (of the page's other
  non-derived variables) + a **"Derive"** select, the second one "shown only once a source is
  picked" (`derived-page-variable.md:77-80`). Mechanism B's own scoping doc explicitly calls for
  "mirroring `derivedFrom`+`derive`'s existing shape one level down" (`info-box-speed-and-
  relative-dates-scoping.md:295`) — an RRL route row instead of a page filter. Recommend copying
  that exact two-control shape rather than inventing new UI vocabulary.
- **A modal is the wrong weight for this.** Compare against why Add-Route and Add-Graph *did* need
  modals: Add-Route browses a large, growing catalog (hundreds of routes, tag/folder drill-down);
  Add-Graph composes a brand-new section from a blank slate (4 cartesian pickers + a preview).
  Setting up a date-derive relationship is a **small, local edit on a row that already exists in
  front of the author**, against a candidate list that's never more than a handful of sibling rows
  on the same report/template. `AddGraphModal.jsx:165-174`'s own "Anchor Route" control — a plain
  inline `<Select>` built from 2 already-selected sibling rows, not a sub-modal — is the existing
  precedent for "pick one sibling row for a special role," and it's an inline control inside a
  bigger modal, not its own dialog. A derive-from picker is the same shape, inline in RouteRow's
  panel.
- **The peak-preset pattern is the existing precedent for "structured choice instead of typing" in
  this exact panel.** `PEAK_PRESETS`/`DOW_DEFS` (`RouteRow.jsx:27-47`) already render as pill
  buttons inside the same `isEditingDates` block the new mode switch would live in — same file,
  same interaction idiom (click a preset, it writes into the existing text fields), directly
  reusable as the visual pattern for the new formula-preset picker (Q2).

**Concrete shape:** inside `RouteRow.jsx`'s `isEditingDates` block (`:209-288`), add a small
mode switch — "Fixed date" (today's behavior, default) / "Derived from another route" — persisted
as the presence/absence of `dateFormula`+`derivedFromRoute` on the row, not a separate boolean
field (see Q3 for why). Picking "Derived" reveals:
1. **Derive From** — a `<Select>` of eligible sibling rows (see Q3 for the eligibility filter).
2. **Derive** — shown only once a target is picked, per the `derived-page-variable.md` convention:
   a curated preset dropdown (Q2) writing a formula string, with an "Advanced" escape hatch for the
   raw grammar.

The existing Start/End Date `<Input>`s become hidden (mirroring today's read-only render), and the
PEAK_PRESETS/DOW controls stay untouched and fully independent — `resolveRouteDates` already
preserves a derived row's own time-of-day suffix untouched (`relativeDateResolution.js:123-126`,
verified live 2026-08-04 in the AM/PM/Off-Peak fix, see task file ~line 1418), so the new UI must
not couple the two.

---

## Q2 — Vocabulary: curated presets, with a raw-formula escape hatch. Not one or the other.

**Full raw grammar, unguarded, is the wrong default** — `RELATIVE_DATE_REGEX`
(`relativeDateResolution.js:20`) is a real, unforgiving DSL (`^(startDate|endDate)=>(day|week|
month|year)(of)?(?:([+-])(\d+)\k<span>->(\d+)\k<span>)?$`) with cosmetic-only sign characters and
snap-vs-shift semantics that even this scoping pass had to verify byte-for-byte against real data
before trusting (see the grounding doc's "verified byte-for-byte" note). Handing that string to a
non-technical report author violates the same instinct the `derived-page-variable.md` primitive
already encoded on purpose: **"a small named registry, not expressions... avoids inventing a
formula language"** (`derived-page-variable.md:62-64`).

**Pure curation is also wrong** — the root `CLAUDE.md` author-empowerment principle argues against
hardcoding a fixed preset list when the real grammar has more range than any small preset set can
cover, and this arc's own Add-Graph modal explicitly chose "full cartesian" vocabulary over presets
for exactly that reason (`dynamic-reports-and-route-tags.md:242-244`).

**Recommendation: curated presets covering the archetypes already verified against real corpus
data, plus an "Advanced: edit formula directly" toggle for the raw string.** Grounding each preset
in an already-verified real example (not inventing new formula shapes untested against real dates):

| Preset (author-facing label) | Formula it writes | Verified against |
|---|---|---|
| "Same [span], N [span]s back" (whole-period shift) | `startDate=>{span}-{N}{span}->1{span}` | template 278/279's `year-0year->1year` pattern (`info-box-speed-and-relative-dates-scoping.md:180-184`) |
| "This [span]" (snap to containing period) | `startDate=>{span}of` | template 278's `startDate=>yearof` (same doc, same lines) |
| "N days back, single day" (day-of-week/rolling window) | `startDate=>day-{N}day->1day` | template 279 comp-0, hand-verified `2023-02-01 → 2023-01-25` (task file ~line 1262) |

("Rolling N-year window" and multi-span-length windows are structurally expressible in the grammar
but have **no real corpus example verified** — don't add a preset for a shape nothing has ever
exercised; that's exactly the class of untested-math risk this feature has been careful to avoid
so far, per Q7.)

The "Advanced" raw-string field should **validate against `RELATIVE_DATE_REGEX` client-side and
surface a clear error**, rather than silently no-op the way the runtime resolver itself does today
(`resolveRelativeDateFormula` returns `null` on a bad match, and the row just falls through
unchanged — correct behavior for a resolver reading someone else's data, wrong behavior for an
author actively typing a formula who needs to know it's invalid).

---

## Q3 — Base-designation mechanic

**Real finding: the shipped runtime needs no explicit "is base" flag at all — base-ness is
implicit.** Re-read `resolveRouteDates` closely (`relativeDateResolution.js:108-131`): it only
checks `route.dateFormula && route.derivedFromRoute` to identify a *derived* row; there is no
`isRelativeDateBase` field anywhere in the JS runtime or in what `build_slot_entry`/
`build_route_entry` persist (confirmed: the task file's Python section never lists
`isRelativeDateBase` among the fields it surfaces on a built entry, only `dateFormula`/
`derivedFromRoute`, ~line 1281). A row is functionally "the base" purely because some sibling's
`derivedFromRoute` points at its `route_comp_id` — the old tool's explicit checkbox
(`AdvancedControls.jsx:273-281`, per the grounding doc) is a Python-conversion-time-only concept
used to *decide* which comp becomes the base while resolving a ported template; it never needed to
survive into the live data model.

**So the UI doesn't need a separate "mark as base" toggle** — only, per derived row: a "Derive
From" picker (Q1) targeting a sibling's identity. Whichever row gets picked *is* the base, by
construction, with two real constraints the picker must enforce (both are correctness
requirements, not polish):

1. **Single-hop only.** `resolveRouteDates:120` explicitly bails (`base.dateFormula` truthy →
   return unchanged) if the picked base is itself derived — a chain (`C` derives from `B` derives
   from `A`) silently fails, leaving `C` showing whatever stale value happens to be stored. The
   "Derive From" picker's candidate list must exclude any row that already has `dateFormula` set —
   otherwise an author can construct a relationship that looks accepted in the UI but silently
   never resolves.
2. **Atomicity.** `RouteRow.jsx:143`'s read-only gate keys off `dateFormula` alone
   (`isDerivedDate = !!r.dateFormula`), but the resolver requires **both** `dateFormula` AND
   `derivedFromRoute` to attempt resolution (`relativeDateResolution.js:113`). A write path that
   could set one without the other would produce a row that renders read-only (pencil hidden) but
   never actually computes a date — a confusing, silent half-state. The UI must write both fields
   in one update (`useReportRow.js`'s existing `updateRoute({index, updates: {...}})` already
   supports an arbitrary multi-field patch — no new persistence primitive needed, see Q7).

**Both mechanisms, if both get built:** Mechanism A has **no cross-row base-designation concept at
all** — it's a per-row, wall-clock-relative field (the unbuilt sketch: `startDateRecentYearOffset`/
`endDateRecentYearOffset`, an integer, per `info-box-speed-and-relative-dates-scoping.md:276-277`),
so its UI (if scoped in) would be a single "Relative to today" mode + an integer offset field on
each row independently — no sibling picker, no eligibility filtering, no single-hop guard. Simpler
UI, but the underlying resolver doesn't exist yet on either side of the stack (Q5).

---

## Q4 — Dynamic Reports applicability: generalizes cleanly, with one real, verified-but-untested wrinkle

**Traced the actual code path rather than assuming symmetry, per the task's instruction.** The
question was whether a relative-date relationship can be authored *between slots*, before any real
route is picked, the same way it works between already-resolved rows on a normal report.

**Verified: yes, cleanly, because dates live on the slot/row itself, never on the catalog.**
- `useDynamicReportRoutes.js`'s merge (`:100-107`) is `{...slot, ...catalogRow, route_comp_id:
  slot.route_comp_id, graphIds: slot.graphIds, color: slot.color, name: ...}` — `catalogRow` wins
  for whatever fields it carries, but a `routes_data` catalog row (confirmed via
  `fetchCatalogRows.js:13-27`, the canonical catalog-fetch: `name`/`tags`/`id`/whatever
  `routeSourceInfo.columns` declares) **never includes `startDate`/`endDate`** — a catalog route is
  a static TMC/geometry entity, not a dated one. So `startDate`/`endDate` (and therefore
  `dateFormula`/`derivedFromRoute`, which the spread also carries through unconditionally from
  `slot`) are **always the slot's own authored fields**, completely unaffected by which real route
  ends up filling that slot at view time, or whether it's filled yet at all.
- `ReportRouteList.jsx:130`: `effectiveRoutes = resolveRouteDates((isDynamicReport && !isEdit) ?
  resolvedRoutes : routes)` — in **edit mode**, a Dynamic Report's `effectiveRoutes` is
  `resolveRouteDates(routes)`, the raw persisted slot array, run through the exact same resolver a
  normal report uses. As long as the base *slot* has a literal `startDate`/`endDate` set (an
  ordinary authored field, same as any normal report's route — nothing about it requires a real
  route to exist), a derived sibling slot resolves correctly **in edit mode, with zero real routes
  ever picked.** This directly answers the question: yes, the relationship can be authored between
  slots before resolution, mechanically identical to normal reports.
- This is also **already proven at scale, just not via hand-authoring**: template 278's 10 ported
  slot rows (`converted_reports/floating_car_average_day`) are exactly "derive between rows sharing
  one `route_slot_group`," live-verified 2026-08-04 with real distinct resolved dates per row,
  independent of which real catalog route (`2198772`, "Rochester Inner Loop 2") happened to fill the
  group.

**The real wrinkle, verified structurally but never exercised: a derive-from relationship spanning
TWO DIFFERENT `route_slot_group`s (i.e., two independently-viewer-picked real routes).** Every
`relativeDate` comp in the real old-tool corpus pairs a base and its derived comps **within one
group** (same `routeId`, confirmed for the nested-group case too — "each group's derived comp
resolves against its OWN group's local base," dynamic-reports doc ~line 1250). But nothing in the
code enforces that scoping: `route_comp_id` is a per-ROW identity assigned uniquely regardless of
group (`useReportRow.js:287`, `comp-${maxId+1+i}`), and `resolveRouteDates`'s `byCompId` map
(`relativeDateResolution.js:110`) is built over the **whole** array with no group-awareness at all.
So a UI that lets an author pick a "Derive From" target from *any* sibling row — not just rows in
the same `route_slot_group` — would work exactly the same way mechanically (verified by reading
`resolveRouteDates` and the merge code, not assumed), enabling a genuinely new report shape: "Route
A" and "Route B" as two independently-viewer-picked real routes, where B's date is defined as
"N years after whatever the author set on A," entirely orthogonal to which two real routes end up
filling those slots. **Flagged, not resolved:** this specific shape has zero live test and zero
real corpus precedent — recommend one smoke test (two-group Dynamic Report, cross-group
derive-from, two different real routes picked) before shipping a picker that allows it, rather than
assuming the structural read is sufficient.

**One clarification worth surfacing to Ryan given his own framing in the scoping doc:** the doc's
Part 2 argued Mechanism B "reframes... to 'the more natural fit for how Dynamic Reports actually
work'" because a Dynamic Report's base date "can come from whatever the viewer picks when filling
that route slot" (`info-box-speed-and-relative-dates-scoping.md:190-193`). Traced this precisely:
that's **not literally true today** — a catalog route carries no date of its own to inherit (routes
are just TMC/geometry+tags entities, confirmed above), so a slot's base date is always an **author-
set literal**, fixed at design time, identical for every viewer regardless of which real route they
pick. What *does* vary per viewer is only route *identity* (which real TMCs/geometry), never the
date range. This is still a fully sensible, useful pattern (author fixes a comparison year once,
every viewer's different real route gets the same comparison-year treatment) — but it's a different
claim than "derives from the viewer's pick," and worth stating precisely rather than letting the
stronger-sounding framing stand uncorrected.

---

## Q5 — Mechanism A vs. B scope: **flagging for Ryan, not deciding**

This is the one question in this doc Ryan needs to actually weigh in on.

**The case for B only (my lean, but genuinely his call):**
- Ryan's own framing of the ask — "we have this feature working for the conversion/CLI side" —
  literally only matches Mechanism B. Mechanism A has **zero code anywhere**: no Python resolver
  (explicitly deferred, "not worth building right now," 2026-08-03), no JS module, not even a
  sketch that was implemented (only a *proposed* field pair, never built, per
  `info-box-speed-and-relative-dates-scoping.md:276-277`). Building a UI for Mechanism A means
  building its entire resolution engine first (a Python conversion-time resolver AND a JS live-
  recompute module, mirroring the effort already spent on B) — this is a materially bigger lift
  than "add a UI on top of an existing mechanism," which is what the ask sounds like it's asking
  for.
- B is also the one the last scoping pass argued is the better Dynamic-Reports fit (Q4 above,
  with the one caveat noted).

**The case for A being in scope too, or even primarily (the tension Ryan flagged himself when
writing the ask):**
- "Relative dates" in plain English, to a typical report author, more naturally suggests "always
  show the last 3 years, whatever year it is when someone opens this" (Mechanism A) than "this
  row's date should track that other row's date" (Mechanism B) — the ask's own wording ("Report
  author set up relative dates") reads as A-shaped, even though the concrete "already works"
  half-sentence is B-shaped. Ryan may be picturing A and not have the A/B split loaded when writing
  the ask.
- A is also the more common pattern in the old corpus by raw count (37 templates vs. 19, per
  `info-box-speed-and-relative-dates-scoping.md`'s usage table) — though that table predates
  Dynamic Reports existing as a use case, so raw historical usage may undercount A's real future
  demand for "evergreen" Dynamic Report templates (e.g., a shared "Current Year Snapshot" page that
  should never need date maintenance).

**Recommendation: build the authoring UI for Mechanism B first** (matches the literal "already
works" framing, rides an existing resolver, smaller and lower-risk), **and get an explicit answer
from Ryan on whether Mechanism A is wanted in this same pass or as a distinct follow-on** — not
something this doc should default on. If A is wanted too, its own resolver (Python + JS "now"-
source derivation) needs to be built first, as a prerequisite, before any UI work on it is worth
doing — that's new scope beyond "add a UI," not folded into the estimate below.

---

## Q6 — Integration with add-route flows: a follow-up edit on an existing row, not a new action

**Recommendation: no new "+ Add Derived Route" action, on either report type.** Reasoning:

- A derive relationship needs **two things that already exist independently of each other**: a row
  with an identity (`route_comp_id`) to attach the relationship to, and a base row with a literal
  date already set. Prompting for "base + formula" at creation time doesn't actually save a step —
  the base needs to be pickable, which means it needs to already be a row on the report (or you're
  really building a "create two rows and a relationship in one dialog" flow, which is strictly more
  complex for no real gain over "add the row normally, then flip it").
- This mirrors the **existing** integration pattern for every other RouteRow date concern
  (PEAK_PRESETS, day-of-week exclusion): those are edits inside the same date-edit panel on a row
  that was added through the ordinary "+ Add Route" / "+ Add Route Slot" flow — never their own
  add-flow variant. Relative dates should follow the same convention for consistency, not carve out
  a special case.
- **Symmetric for both report types**, confirmed by the Q4 trace: a normal report's row and a
  Dynamic Report's slot expose the identical set of authorable fields (`route_comp_id`/
  `startDate`/`endDate`/`dateFormula`/`derivedFromRoute`) through the identical `updateRoute` call —
  the UI change lives entirely in `RouteRow.jsx` + `ReportRouteList.jsx`'s sibling-list plumbing,
  with **zero divergence needed between the two report types**.

---

## Q7 — Effort/risk estimate and workstream breakdown

**Notably cheaper than the Add-Graph modal's own implementation plan (which needed a Workstream 0
to extract pure mutation functions before anything else could be built) — the resolution engine
here already exists and needs zero changes.** `relativeDateResolution.js` is already wired into the
one choke point (`effectiveRoutes`) that feeds both display and publish; this work is purely about
adding a write path in front of fields the runtime already consumes correctly.

1. **Sibling-eligibility + reverse-lookup plumbing in `ReportRouteList.jsx`.** Compute, alongside
   the existing per-row `derivedFromRouteName` lookup (`:346`, already present and directly
   reusable), an eligible-bases list per row (`routes.filter(r => r.route_comp_id !==
   self.route_comp_id && !r.dateFormula)`, the single-hop filter from Q3) and a reverse "who derives
   from me" list (for the optional clarity badge noted below). Pure derivation from data already in
   scope in this component — no new fetch, no new state.
2. **Preset-to-formula module.** A small new pure file (peer to `relativeDateResolution.js`) mapping
   the curated preset list (Q2) to formula strings, parameterized by a UI-entered `N`/`span`. Unit-
   test it the same way `relativeDateResolution.js` itself was unit-verified before wiring in
   (per the task file's own precedent: "Unit-verified in isolation before wiring in," ~line 1323) —
   cheap, low-risk, this is the same kind of pure function the codebase already trusts this pattern
   for.
3. **`RouteRow.jsx` UI: the Fixed/Derived mode switch + Derive-From/Derive controls.** The bulk of
   the net-new code. Reuses the existing `isEditingDates` block's layout conventions (pill-button
   presets, same as `PEAK_PRESETS`), adds one `<Select>` (Derive From) + one preset `<Select>` +
   optional "Advanced" raw-string field with regex validation (Q2). No new UI primitives needed —
   `Select`/`Input`/`Button` are already destructured from `ThemeContext` in this file's parent.
4. **`useReportRow.js`: zero new persistence code.** Confirmed `updateRoute({index, updates})`
   already accepts an arbitrary multi-field patch (used today for `startDate`/`endDate`/`weekdays`
   together, `ReportRouteList.jsx:362-369`) — setting `{dateFormula, derivedFromRoute}` or clearing
   both to `undefined` (converting a derived row back to fixed — needs a real literal fallback
   written at that moment, since nothing else will compute one once `dateFormula` is cleared) rides
   the same call, no new function.
5. **Optional clarity affordance:** a small "used as the base for: {sibling names}" badge on
   whichever row currently has ≥1 sibling pointing at it (Q3's "implicit base" finding) — purely a
   render-time computation off the reverse-lookup from Workstream 1, no persistence.
6. **Verification, both report types, mirroring this arc's own live-verification convention:**
   (a) normal report — add 2 real routes, mark one derived from the other via a "This year" preset,
   confirm the derived row's displayed date matches the base, edit the base's date, confirm the
   derived row recomputes with no reload (exercises the exact guarantee already unit-tested in
   `relativeDateResolution.js`); (b) Dynamic Report — add 2 route slots (no real routes picked yet),
   set up the same relationship in edit mode purely against the placeholders, confirm it displays
   correctly with zero catalog data present, then resolve both slots to real routes at view time and
   confirm the derived date is unaffected by which real routes were picked (Q4's core claim); (c) if
   the cross-`route_slot_group` case (Q4's flagged wrinkle) is allowed by the picker, one additional
   smoke test exercising it specifically, since nothing else in the corpus or existing live-tests
   covers that path.

**Risks, concretely:**
- **Preset-formula correctness.** Every preset must map to a formula shape already byte-verified
  against real data (Q2's table) — inventing an untested shape (e.g. a preset implying a
  calendar-date-preserving offset across a leap year, which the `day`-span shift-by-exact-days
  semantics does NOT cleanly give you for offsets much larger than a week) risks a silent,
  hard-to-notice date-math bug, the exact failure class this feature's own build history has been
  careful to avoid (byte-for-byte verification before every wire-in, per the task file).
- **Single-hop + atomicity enforcement (Q3)** must be real UI-level validation, not just documented
  intent — a picker that allows selecting an already-derived row as a new base, or a save path that
  writes `dateFormula` without `derivedFromRoute`, produces a row that looks configured but silently
  never resolves (both are real gaps the resolver itself tolerates by design, since it was built to
  read someone else's — the Python converter's — already-validated output, not to gate a live
  authoring UI).
- **Cross-`route_slot_group` derive-from (Q4)** is verified only by code-reading, not by any
  existing test or corpus example — treat it as new, unverified surface area if the picker allows
  it, budget the one extra smoke test in Workstream 6.
- **Scope fork (Q5)** — if Ryan wants Mechanism A in this same pass, the estimate above roughly
  doubles: a real resolver (Python + JS) has to be built before any UI on top of it means anything,
  which is a materially different (larger) task than what's estimated here.

---

## Open questions (explicit, not silently resolved)

1. **Mechanism A vs. B scope** (Q5) — the one Ryan must actually answer.
2. **Should the "Derive From" picker allow cross-`route_slot_group` targets** on Dynamic Reports
   (Q4's wrinkle), or should v1 restrict it to same-group siblings only (matching every real corpus
   example, at the cost of ruling out a plausible and easy-to-support future report shape)?
3. **Should converting a derived row back to "Fixed" auto-write the last-computed literal date** as
   the new stored value (so the row doesn't go blank), or require the author to re-enter dates from
   scratch? Leaning toward auto-write (least-surprise), not confirmed here.
4. **Does the "Advanced: raw formula" escape hatch belong in v1 at all**, or is a purely curated
   preset list (accepting its narrower coverage) the safer v1 given the non-technical-author
   audience this arc has been designing for elsewhere (e.g. Add-Graph's static-preview,
   no-live-fetch decision, and the tag-browser's hidden-taxonomy-not-raw-tags design)? Leaning
   toward including it (author-empowerment principle, and the raw grammar is genuinely more capable
   than any small preset set), but flagging since it's a real judgment call, not a slam-dunk either
   way.

## Implemented, 2026-08-05 — Mechanism B only, per Ryan's explicit call on Q5

Ryan's answer to the one open question this doc flagged as his to make (Q5): build for Mechanism B
only. Mechanism A stays exactly as this doc left it — a documented gap, no resolver on either side
of the stack, not started.

Built as recommended: `RouteRow.jsx`'s date-edit panel gained a Fixed/Derived mode switch (no new
modal), a new pure `relativeDatePresets.js` module (peer to `relativeDateResolution.js`) implementing
the curated preset table from Q2 plus an Advanced raw-formula escape hatch (open question 4 resolved:
included), and `ReportRouteList.jsx` computes the eligible-bases/reverse-lookup plumbing from Q7's
Workstream 1. Q3's single-hop/atomicity requirements and Q4's "generalizes cleanly to Dynamic
Reports" claim both hold as predicted — implemented with zero divergence between normal reports and
Dynamic Report route slots, confirmed by wiring both through the same `updateRoute` call.

Two open questions resolved during the build, not left for later:
- **Open question 3** (auto-write the last-resolved date when un-deriving) — turned out to need *no
  new code*: `onStartEditDates` already seeds the Fixed-mode inputs from `effectiveRoutes`' live-
  resolved value (RouteRow always renders off the resolved array), so switching a derived row back
  to Fixed and saving already carries the last-resolved date forward for free.
- **Open question 4** (Advanced escape hatch) — included, per this doc's own lean.

**Not resolved, carried forward as an explicit gap:** open question 2 (cross-`route_slot_group`
derive-from on Dynamic Reports) — the shipped "Derive From" picker does NOT restrict candidates by
group; it allows any non-derived sibling on the report, the simpler default, still unconfirmed
against any real report exercising that specific shape. See the task file's new "Not yet done" list.

**Verified so far: unit-level only** (formula round-tripping against real corpus shapes, and a full
simulated save → resolve → edit-base-cascades → un-derive → no-longer-cascades flow against the real
`resolveRouteDates`/`buildFormula`/`parseFormula` functions, no DB or browser involved). A live
interactive click-through in the browser has not happened yet — flagged for a follow-up pass, not
claimed as done.

**Real UX finding caught live by Ryan, 2026-08-05, fixed same day: RRL's actual column width is
much narrower than this doc's UI recommendation assumed.** Screenshot from a real report showed the
RRL panel occupying roughly a 220-260px sidebar column, not the width of a modal or a full page
pane — every other UI precedent this doc cited (`AddGraphModal`, `RouteTagBrowserModal`) renders in
a modal overlay, which is why the width mismatch wasn't caught during scoping. Two real problems in
the first build, both fixed without changing the underlying design (Fixed/Derived mode still lives
in `RouteRow.jsx`'s existing panel, no new modal):

1. **The Fixed/Derived mode switch was two full-text pill buttons ("Fixed dates" / "Derived from
   another route") side by side — impractical at this width.** Replaced with the same compact
   `Switch` primitive `ReportRouteList.jsx` already uses one panel up for the "Dynamic Report"
   toggle (proven to fit this exact column) plus a short text label showing the current mode next
   to it — one small knob instead of two button-sized chrome elements.
2. **The Pattern+Span and Direction+Amount control pairs were laid out side-by-side
   (`dateInputFlex`), which crushes each `Select` into roughly half the already-narrow column.**
   Restacked every derive sub-control to one-per-row, matching how Start Date/End Date already
   stack vertically in this same panel.
3. **Discoverability, a separate but related finding**: a Fixed row showed nothing at rest — only a
   Derived row's "Derived from X" note was ever visible without opening the editor, so there was no
   hint the feature existed at all until an author happened to click the date-range pencil. Fixed by
   always showing a one-line status ("Fixed dates." / "Derived from X — edit to change." / "Fixed
   dates — base for Y.") regardless of edit state — symmetric between both modes now, not just
   derived.

## Cross-references

- `planning/transportny/tasks/current/dynamic-reports-and-route-tags.md` — item 3, the Mechanism B
  build record this doc's UI recommendation sits on top of; "Not yet done" list (~line 1466)
  explicitly names the authoring-UI gap this pass scopes.
- `research/npmrds-reports/info-box-speed-and-relative-dates-scoping.md` — Part 2, the original
  Mechanism A/B split, real formula grounding, and the `derived-page-variable` architecture
  recommendation this doc's Q1/Q3 build on directly.
- `src/dms/planning/tasks/current/derived-page-variable.md` — the "Derived From" + "Derive" UI
  precedent this doc recommends mirroring one layer down (page filter → RRL route row).
- `src/themes/transportny/components/ReportRouteList/relativeDateResolution.js`,
  `RouteRow.jsx`, `ReportRouteList.jsx`, `useReportRow.js`, `useDynamicReportRoutes.js` — read
  directly for every claim above; no paraphrase trusted without a line citation.
- `src/themes/transportny/components/AddGraphModal/AddGraphModal.jsx` (esp. the Anchor Route
  control, `:165-174`), `src/themes/transportny/components/RouteTagBrowserModal/` — the two most
  recent author-facing modal precedents, used to argue *against* a modal for this feature (Q1).
