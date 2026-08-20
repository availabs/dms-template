/**
 * R9/R4 — NPMRDS coverage eras.
 *
 * The feed is not one dataset. Measured across all 14.47 billion records, 2017-01 to 2026-08
 * (references/npmrds pm3/npmrds_analysis/data-quality-atlas.html), daytime epoch coverage moves in
 * abrupt, month-aligned steps rather than on a trend — and steps DOWN as often as up. Any multi-year
 * comparison that does not name its era is comparing feed history as much as traffic: a coverage
 * change of the size actually observed moves LOTTR ~3% and the flagged population ~23% relative
 * (H1, H14).
 *
 * Two properties of this table are easy to get wrong and are the reason it exists as data:
 *
 *   1. **Boundaries are MONTHLY, and four of them fall mid-year** (2023-06, 2024-08, 2024-12,
 *      2026-02). A year-level era tag is therefore wrong for 2023, 2024 and 2026, which is why
 *      `erasForYear` can return more than one era and flags the crossing.
 *   2. **The era model differs BY STREAM.** All-vehicle coverage steps at 2024-08 and 2026-02;
 *      truck coverage steps at 2021-01 and 2023-06 — different dates entirely. In 2023-06 the two
 *      moved in OPPOSITE directions (all-vehicle daytime coverage 43.5% -> 36.3% while truck rose
 *      13.4% -> 18.3%). One tag cannot describe both, so LOTTR/PHED and TTTR/truck-PHED carry
 *      separate tags.
 *
 * Two eras are traffic rather than feed events and are labelled as such: E4 is COVID (April 2020 is
 * the worst month in the archive) and the E2->E3 transition coincides with the TMC network expanding
 * +32.7% in a single day on 2019-01-01. The rest read as feed or processing changes — abrupt,
 * month-aligned, and moving the probe-density mix as well as the record count — but that is inferred
 * from shape and is NOT confirmed with the vendor (open question RQ12).
 *
 * `end` is inclusive; a null `end` means "current".
 */

// Daytime coverage (06:00-19:59) per era is carried so a consumer can see the magnitude without
// leaving the table, and so a future recalculation has something to check itself against.
const ALL_VEHICLE_ERAS = [
  { era: 'E1', start: '2017-01', end: '2018-09', daytimeCoverage: 37.4, note: 'early feed, 36k network' },
  { era: 'E2', start: '2018-10', end: '2018-12', daytimeCoverage: 28.0, note: 'late-2018 decline' },
  { era: 'E3', start: '2019-01', end: '2020-02', daytimeCoverage: 34.8, note: 'network expansion to 46k (+32.7% on 2019-01-01)' },
  { era: 'E4', start: '2020-03', end: '2020-12', daytimeCoverage: 31.0, note: 'COVID — traffic, not feed' },
  { era: 'E5', start: '2021-01', end: '2023-05', daytimeCoverage: 43.5, note: 'growth era' },
  { era: 'E6', start: '2023-06', end: '2024-07', daytimeCoverage: 36.3, note: 'step down' },
  { era: 'E7', start: '2024-08', end: '2024-11', daytimeCoverage: 67.0, note: 'high regime — the H1/H3/H10 natural experiment' },
  { era: 'E8', start: '2024-12', end: '2026-01', daytimeCoverage: 41.6, note: 'settled — the era the CY2025 measure analysis ran on' },
  { era: 'E9', start: '2026-02', end: null,      daytimeCoverage: 54.8, note: 'new high' },
];

// The truck stream has its own history, on its own dates. Coverage FELL 8.3% -> 4.8% through 2020,
// then jumped at 2021-01 and again at 2023-06, and again at 2026-02.
const TRUCK_ERAS = [
  { era: 'T1', start: '2017-01', end: '2020-12', daytimeCoverage: 6.4,  note: 'declining truck coverage' },
  { era: 'T2', start: '2021-01', end: '2023-05', daytimeCoverage: 13.4, note: 'first truck step up (2.8x)' },
  { era: 'T3', start: '2023-06', end: '2026-01', daytimeCoverage: 18.0, note: 'second truck step up — all-vehicle coverage FELL at this boundary' },
  { era: 'T4', start: '2026-02', end: null,      daytimeCoverage: 23.0, note: 'third truck step up' },
];

const ymToInt = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  return y * 12 + (m - 1);
};

/**
 * Which eras does a calendar year touch, and does it cross a boundary?
 *
 * Returns { eras: ['E5','E6'], label: 'E5|E6', crossesBoundary: true }. The label is what gets
 * published; `crossesBoundary` is the comparability warning, and is the actionable field — a year
 * that crosses a boundary must not be compared to another year without a coverage control.
 */
function erasForYear(year, stream = 'all_vehicles') {
  const table = stream === 'truck' ? TRUCK_ERAS : ALL_VEHICLE_ERAS;
  const first = year * 12;          // January
  const last = year * 12 + 11;      // December
  const hit = table.filter((e) => {
    const s = ymToInt(e.start);
    const t = e.end === null ? Infinity : ymToInt(e.end);
    return s <= last && t >= first; // any month overlap
  });
  return {
    eras: hit.map((e) => e.era),
    label: hit.length ? hit.map((e) => e.era).join('|') : null,
    crossesBoundary: hit.length > 1,
  };
}

/**
 * R2 — the anchored free-flow reference window.
 *
 * PHED/TED's freeflow threshold is the 15th percentile of travel time. Taken over the PUBLISH year
 * — which is what pm3 did before this change — it is not a free-flow speed at all: measured across
 * 51,674 TMCs, the year-to-year movement of that p15 correlates with movement of the MEDIAN at
 * r = +0.998 (H5). It is a lagged measurement of prevailing traffic, so it rises as the network
 * slows and the yardstick deteriorates along with what it is meant to measure.
 *
 * Cost of that, on identical CY2025 travel times with only the threshold changed: network delay
 * 4,840,278 h own-year vs 5,164,058 h anchored, **+6.69%**. It is bias rather than noise because the
 * movement is asymmetric — 36.3% of segments report materially more delay against a fixed yardstick
 * and only 9.6% less, a 3.8:1 split.
 *
 * **The window must lie inside ONE coverage era.** H5's own test anchored on CY2023, and the atlas
 * later showed that calendar year straddles the 2023-06 boundary: Jan–May sits at 46.4% daytime
 * coverage with 84.4% density-A, Jun–Dec at 36.1% and 90.7%, in a near 48/52 record split. A p15
 * pooled over that is a mixture of two regimes.
 *
 * E8 is used because it is a clean single era, 14 months long, and at 41.6% daytime coverage sits
 * close to the archive's long-run middle rather than at either extreme (the range is 28.0%–67.0%) —
 * so the anchor is not calibrated on an unusually good or bad period.
 *
 * Inclusive of both endpoints. Changing this changes every published delay figure, so treat it as a
 * versioned decision: republish, do not silently switch.
 */
const FREEFLOW_REFERENCE_WINDOW = {
  era: 'E8',
  dates: ['2024-12-01', '2026-01-31'],
  note: 'single clean era, 14 months, 41.6% daytime coverage ~ the archive long-run middle',
};

module.exports = { ALL_VEHICLE_ERAS, TRUCK_ERAS, erasForYear, FREEFLOW_REFERENCE_WINDOW };
