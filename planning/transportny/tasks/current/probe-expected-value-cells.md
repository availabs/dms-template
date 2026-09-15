# Probe: assert EXPECTED value-cell counts, not just "more than zero"

**Project:** TransportNY · **Topic:** testing / report probe · **Status:** NOT STARTED — logged
2026-09-14 at Ryan's request as a follow-on to the golden-corpus reliability work
([`report-probe-expect-and-golden-corpus.md`](./report-probe-expect-and-golden-corpus.md)).

## Why

InfoBox and RouteCompare sections render their data as **numbers in plain divs** — no SVG, no
canvas, not even a `<table>`. The census was SVG/canvas-only, so a fully populated Info Box read as
permanently blank and those sections were effectively unmonitored: the suite would notice one
disappearing, but not its contents breaking. 3 sections across the corpus were in that state.

Fixed 2026-09-14 by counting `valueCells` — leaf elements whose entire text is a number-like token
(`29.80`, `0:23`, `-2.4%`) — and treating **any** as content. Measured live:

| section | value cells |
|---|---|
| populated Info Box | 10 |
| populated Route Compare | 8 |
| report title header | 0 |
| genuinely empty graph | 0 |

**The threshold is `> 0` deliberately, not a tuned floor.** An intermediate value (3 was tried and
rejected) misjudges a SMALL section: the count scales with however many measures, routes and
columns a section carries, so a one-measure/one-route Info Box legitimately renders one or two
cells. Ryan: *"the exact number likely varies depending on the number of series/columns/etc"*.

## The enhancement

`> 0` only answers "did it render at all". Half a table is indistinguishable from a whole one — an
Info Box that should show 10 values but renders 3 passes today.

The count is not arbitrary though: it is a function of the section's own spec — roughly
`measures × routes × columns` — so the EXPECTED count is derivable rather than guessed. Ryan's
framing: *"its probably a small lift, for us to determine how many cells we expect in various
cases"*.

Proposed:

1. Derive the expected cell count per section type from the spec that built it (the `graphs[]`
   entry's `measure` list, assigned routes, and the component's own column set).
2. Store the expected count in the baseline alongside the observed one.
3. Report a mismatch as a **Major** ("Info Box rendered 3 of an expected 10 value cells"), the same
   severity as the existing `series count changed` check — which is the direct analogue for graph
   sections and already works this way.

## Notes / cautions

- **This is a RENDER check, not a data check.** An Info Box showing ten zeros because its query
  returned nothing would still pass, exactly as a graph drawing a flat zero line passes the
  SVG-ink check. Ryan's standing scope call: *"If we are concerned about the queries or data
  themselves, we should test those separately."* Worth respecting here rather than quietly
  widening this into data assertions.
- Start by measuring the real counts across all corpus sections before writing the derivation —
  the same order that made the `> 0` decision correct instead of guessed.
- Sections affected today: `one_week_study` "Route info box, speed, travel time",
  `annual_average_study` "Route compare, speed / travel time — year over year",
  `monthly_congestion` "Route compare component, speed".

## Files

- `scripts/npmrds-reports/report_probe.mjs` — `valueCellCount()` in the census, `hasValueCells()`
- `scripts/npmrds-reports/probe_corpus.mjs` — `normalize()`'s `hasContent`
- `scripts/npmrds-reports/report_probe_fixtures/golden-corpus.json` — where an expected count would live
