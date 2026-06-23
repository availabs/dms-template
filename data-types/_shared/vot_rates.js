/**
 * Class-weighted value of time (VOT) — the shared monetization constants and
 * helper for converting vehicle-hours of delay into dollars.
 *
 * Replaces the old flat $20/veh-hr used everywhere (Incidents / Congestion /
 * Work Zones / Reliability $ figures). Adopted by Alex 2026-06-19; rates
 * confirmed 2026-06-22. Methodology + provenance:
 *   planning/transportny/tasks/current/class-weighted-vot-cost.md
 *   references/tsmo/06_congestion_delay_methodology.md
 *
 * Rates are PER VEHICLE-HOUR with occupancy already bundled in — do NOT also
 * multiply by average vehicle occupancy (that was the old double-count).
 *
 * Versioned like the excessive_delay v1/v2 series so old dashboards stay
 * reproducible: pin a `version` to reproduce a historical run; escalate by CPI
 * into a new version rather than mutating an existing one.
 *
 * ⚠ Bus-heavy single-unit caveat: NY single-unit (FHWA 4–7) is bus-heavy
 * (occupancy 10.7–16.8) — the least-clean class. For bus-dominated urban TMCs a
 * transit person-VOT may be more appropriate; revisit before treating the
 * single-unit rate as authoritative there.
 */

// 2024–25 dollars, per vehicle-hour. network_blend is the documented NY network
// blend (~$50–55) used as the fallback when a TMC's class split is NULL/0.
const VOT_RATES = {
  v1: {
    year: '2024-25',
    passenger: 52, // POV — Maryland CHART car rate, CPI-escalated; occupants bundled
    single_unit: 42, // FHWA 4–7 — BLS driver wage + lighter cargo (bus-heavy caveat above)
    combination: 77, // FHWA 8–13 tractor-trailer — CHART driver + inventory, CPI-escalated
    network_blend: 52, // NY network-blended VOT_eff fallback (~$50–55), occupancy 1.0 trucks
  },
};

const CURRENT = 'v1';

function rates(version = CURRENT) {
  const r = VOT_RATES[version];
  if (!r) throw new Error(`unknown VOT rate version: ${version}`);
  return r;
}

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Effective class-weighted $/veh-hr for one TMC from its AADT split:
 *   aadt_pass    = aadt − aadt_singl − aadt_combi
 *   VOT_eff(tmc) = (aadt_pass/aadt)·pass + (aadt_singl/aadt)·singl + (aadt_combi/aadt)·combi
 *
 * Falls back to the network-blended VOT (never drops the segment / returns 0)
 * when the total AADT is missing/0/invalid, or when the split is malformed such
 * that the passenger share would be negative.
 *
 * split: { aadt, aadt_singl, aadt_combi }; missing class cols ⇒ 0 trucks.
 */
function votEff(split, version = CURRENT) {
  const r = rates(version);
  const aadt = Number(split && split.aadt);
  if (!Number.isFinite(aadt) || aadt <= 0) return r.network_blend; // NULLIF(aadt,0) guard
  const singl = num(split.aadt_singl);
  const combi = num(split.aadt_combi);
  const pass = aadt - singl - combi;
  if (pass < 0) return r.network_blend; // malformed split — refuse nonsense
  return (
    (pass / aadt) * r.passenger
    + (singl / aadt) * r.single_unit
    + (combi / aadt) * r.combination
  );
}

/**
 * SQL fragment computing VOT_eff from raw AADT column expressions, for engines
 * where the weighting must happen in-query (Postgres / ClickHouse). Mirrors
 * votEff() exactly: NULLIF(aadt,0) guard, COALESCE to network_blend on NULL.
 * Pass already-validated column/expression strings (no user input).
 */
function votEffSqlExpr({ aadt, aadt_singl, aadt_combi }, version = CURRENT) {
  const r = rates(version);
  const a = `NULLIF(COALESCE(${aadt}, 0), 0)`;
  const s = `COALESCE(${aadt_singl}, 0)`;
  const c = `COALESCE(${aadt_combi}, 0)`;
  return (
    `COALESCE(`
    + `((COALESCE(${aadt}, 0) - ${s} - ${c}) / ${a}) * ${r.passenger}`
    + ` + (${s} / ${a}) * ${r.single_unit}`
    + ` + (${c} / ${a}) * ${r.combination}`
    + `, ${r.network_blend})`
  );
}

module.exports = {
  VOT_RATES,
  CURRENT,
  rates,
  votEff,
  votEffSqlExpr,
};
