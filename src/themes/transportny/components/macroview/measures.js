// macroview — the MEASURE VOCABULARY, as data.
//
// ONE record per measure, TWO renderings (design contract item 5):
//   1. the floating measure-context panel (contextPanel.jsx) — name · definition ·
//      unit · reliable-when · equation
//   2. the below-fold "§ 01 Measure reference" page section, built by
//      qa_skills/tools/builds/build_npmrds_macro.mjs — measure · what it answers ·
//      computation · unit · extra controls
// Both read THIS file, so the prose exists once. Copy is verbatim from the converged
// mockup `dms_design_system_v2/pages/npmrds-macro.html` (§ 01 table + panel 2) wherever
// the mockup draws it; the two fields the mockup only draws for LOTTR (`definition`,
// `reliableWhen`) are authored here in the same voice for the other measures.
//
// NO IMPORTS ON PURPOSE. This file is imported both by React (the plugin) and by a plain
// node build script; pulling in `updateFilters.jsx` (JSX + colorbrewer) would break the
// node side. Peak/percentile display names stay in updateFilters, where those keys live.
//
// `available: false` = the measure is drawn in § 01 with an honest "not yet computed"
// state and is kept OUT of the measure select (Alex, open decision #2 — an empty measure
// that draws nothing is worse than an honest gap). Adding the data is
// pm3-runner-geometry-and-macroview-coverage.md § "the missing measure families", not
// this task. The source this plugin points at is 1410 / view 3425 (PM3 2025).

// Menu grouping, in the order the mockup's § 04 "measure menu open" state draws them.
export const MEASURE_GROUPS = [
  { key: "reliability", label: "reliability" },
  { key: "congestion", label: "congestion" },
  { key: "speed", label: "speed" },
  { key: "network", label: "environment · network" },
  // Coverage describes the input, not the network — its own group so it cannot be mistaken for a
  // traffic measure sitting alongside LOTTR and TTTR.
  { key: "quality", label: "data quality" },
];

export const MEASURES = {
  lottr: {
    key: "lottr",
    abbr: "LOTTR",
    name: "Level of Travel Time Reliability",
    // § 01 sub-caption under the measure name
    subtitle: "Level of Travel Time Reliability",
    // the measure select's closed-state label
    selectLabel: "LOTTR · Travel-time reliability",
    // the measure menu's row label + its right-hand unit hint
    menuLabel: "LOTTR",
    menuUnit: "ratio",
    group: "reliability",
    answers: "How much longer a bad trip takes than a typical one.",
    definition:
      "How much longer a bad trip takes than a typical one. The 80th-percentile travel time divided by the 50th, per segment per peak period.",
    computation: "TT₈₀ ÷ TT₅₀",
    equation: "LOTTR = TT₈₀ ÷ TT₅₀",
    unit: "ratio · unitless",
    unitShort: "ratio",
    // The federal LOTTR test, and the same `>= 1.5` the PM3 view's own reliability SQL
    // uses (gis_datasets.s2001_v3394). `threshold` drives three things: the "% beyond"
    // readout (stats.js, `>=`), the dashed marker on the histogram, and — since
    // 2026-08-18 — the fact that 1.50 is a COLOUR BOUNDARY on the map (breaks.js).
    reliableWhen: "< 1.50",
    threshold: 1.5,
    // which side of the threshold is the BAD side — drives the "% beyond threshold"
    // readout in the value-distribution block.
    beyondThreshold: "above",
    referenceControls: ["peak period"],
    available: true,
  },
  tttr: {
    key: "tttr",
    abbr: "TTTR",
    name: "Truck Travel Time Reliability",
    subtitle: "Truck Travel Time Reliability",
    selectLabel: "TTTR · Truck travel-time reliability",
    menuLabel: "TTTR · truck",
    menuUnit: "ratio",
    group: "reliability",
    answers: "The same question for freight, at a stricter percentile.",
    definition:
      "The same question for freight, at a stricter percentile. The 95th-percentile truck travel time divided by the 50th, per segment per peak period.",
    computation: "TT₉₅ ÷ TT₅₀ · trucks",
    equation: "TTTR = TT₉₅ ÷ TT₅₀",
    unit: "ratio · unitless",
    unitShort: "ratio",
    // ⚠ 2.00, NOT 1.50 (corrected 2026-08-18). This record carried LOTTR's 1.50, which is
    // not TTTR's number and is not what the rest of the site reports: NYSDOT's applicable
    // TTTR target is **2.00** —
    // `gis_datasets.s2027_v3460_fhwa_map_21_targets.tttr_interstate_applicable_target` = 2
    // for every year 2023-2030, the same table the live PM3 home cards bind to via
    // `max(t.tttr_interstate_applicable_target)`. At 1.50 the panel reported 74.1 % of
    // segments beyond; at 2.00 it reports **44.7 %**.
    //
    // Honest qualification, and the reason the labels below differ from LOTTR's: 2.00 is a
    // SYSTEM-LEVEL INDEX TARGET (a length-weighted mean of each segment's worst period
    // across the Interstate NHS), not a per-segment pass/fail like LOTTR's 1.50. Read on a
    // segment it means "worse than the statewide target" — real and quotable, but not a
    // compliance classification, so the panel says "Target" and "Above target" rather than
    // "Reliable when" and "Unreliable".
    reliableWhen: "< 2.00",
    threshold: 2,
    // Optional per-measure copy for the threshold's three renderings. Absent ⇒ the
    // reliability wording (LOTTR): "Reliable when" · "Unreliable" · "1.50 threshold".
    thresholdLabel: "Target",
    beyondLabel: "Above target",
    thresholdNoun: "target",
    beyondThreshold: "above",
    referenceControls: ["peak period"],
    available: true,
  },
  // R1 — a truck p80/p50 alongside the federally-required p95/p50. Added because TTTR's p95 costs
  // 2.4-4.9x the sample of a p80 for the same confidence (H1b's measured down-sampling curves), and
  // truck coverage is thin: 22.7% of bins in 2025 and only 8.0% in 2020. So on a large part of the
  // network the p95 is the noisier statistic, and this is the one that can actually be read.
  //
  // NOT a federal measure and must not be presented as one — TTTR's p95/p50 is what 23 CFR 490
  // requires. This is the diagnostic sibling.
  tttr_p80: {
    key: "tttr_p80",
    abbr: "TTTR₈₀",
    name: "Truck Travel Time Reliability (p80)",
    subtitle: "Truck Travel Time Reliability, 80th percentile",
    selectLabel: "TTTR₈₀ · Truck reliability (p80)",
    menuLabel: "TTTR₈₀ · truck reliability, p80",
    menuUnit: "ratio",
    group: "reliability",
    answers: "How unreliable truck travel is, measured at a percentile the sample can support.",
    definition:
      "The same ratio as TTTR but taken at the 80th percentile instead of the 95th. Reads lower than TTTR by construction; its value is that it needs a far smaller sample for the same confidence, which matters because truck coverage is thin.",
    computation: "p80(TT) ÷ p50(TT), trucks",
    equation: "TTTR₈₀ = p80(TT) / p50(TT)",
    unit: "ratio",
    unitShort: "ratio",
    // Deliberately NO threshold/reliableWhen: there is no federal or state target at p80, and
    // inventing one would imply a compliance reading this measure cannot carry.
    referenceControls: ["peak period"],
    available: true,
  },
  ted: {
    key: "ted",
    abbr: "TED",
    name: "Total Excessive Delay",
    subtitle: "Total Excessive Delay",
    selectLabel: "TED · Total excessive delay",
    menuLabel: "TED · total excessive delay",
    menuUnit: "veh-hr",
    group: "congestion",
    answers: "How many vehicle-hours are lost below the delay threshold speed.",
    definition:
      "How many vehicle-hours are lost below the delay threshold speed. Excessive delay is the extra time spent under a speed threshold — 20 mph or 60% of the reference speed, whichever is greater.",
    computation: "Σ (TT − TT_threshold) × volume",
    equation: "TED = Σ (TT − TT_threshold) × volume",
    unit: "vehicle-hours",
    unitShort: "vehicle-hours",
    unitHint: "· or per mile",
    referenceControls: ["threshold", "per mile", "aadt source"],
    available: true,
  },
  phed: {
    key: "phed",
    abbr: "PHED",
    name: "Peak Hour Excessive Delay",
    subtitle: "Peak Hour Excessive Delay",
    selectLabel: "PHED · Peak-hour excessive delay",
    menuLabel: "PHED · peak-hour excessive delay",
    menuUnit: "per-hr",
    group: "congestion",
    answers: "The same, restricted to peak hours and counted per person.",
    definition:
      "The same, restricted to peak hours and counted per person. Excessive delay is the extra time spent under a speed threshold — 20 mph or 60% of the reference speed, whichever is greater.",
    computation: "TED_peak × occupancy",
    equation: "PHED = TED_peak × occupancy",
    unit: "person-hours",
    unitShort: "person-hours",
    referenceControls: ["unit", "per mile"],
    available: true,
  },
  speed: {
    key: "speed",
    abbr: "Percentile speed",
    name: "Percentile speed",
    subtitle: "5th … 95th",
    selectLabel: "Percentile speed",
    menuLabel: "Percentile speed",
    menuUnit: "mph",
    group: "speed",
    answers: "What speed a chosen share of trips beat — the floating-car view.",
    definition:
      "What speed a chosen share of trips beat — the floating-car view. The chosen percentile of observed speed over all travel times.",
    computation: "quantile(speed, p)",
    equation: "speed = quantile(speed, p)",
    unit: "mph",
    unitShort: "mph",
    referenceControls: ["percentile", "peak period"],
    available: true,
  },
  freeflow: {
    key: "freeflow",
    abbr: "Freeflow speed",
    name: "Freeflow speed",
    subtitle: "uncongested reference",
    selectLabel: "Freeflow speed",
    menuLabel: "Freeflow speed",
    menuUnit: "mph",
    group: "speed",
    answers: "How fast the road runs when nothing is in the way.",
    definition:
      "How fast the road runs when nothing is in the way. The 85th percentile of off-peak observed speed.",
    computation: "85th pctl of off-peak speed",
    equation: "freeflow = pctl₈₅(off-peak speed)",
    unit: "mph",
    unitShort: "mph",
    referenceControls: [],
    available: false,
  },
  emissions: {
    key: "emissions",
    abbr: "Emissions",
    name: "Emissions",
    subtitle: "six pollutants",
    selectLabel: "Emissions",
    menuLabel: "Emissions",
    menuUnit: "tons",
    group: "network",
    answers: "What the traffic on this segment puts into the air.",
    definition:
      "What the traffic on this segment puts into the air. A speed-binned emission rate applied to the segment's vehicle-miles travelled.",
    computation: "speed-binned rate × VMT",
    equation: "emissions = rate(speed) × VMT",
    unit: "tons/yr",
    unitShort: "tons/yr",
    referenceControls: ["pollutant", "fuel type", "aadt source", "peak period"],
    available: false,
  },
  // Data coverage as a first-class measure. It describes the INPUT rather than the network, which is
  // why it sits in its own group: every other measure here is a property of traffic, this one is a
  // property of how much of the feed arrived.
  //
  // It exists because coverage is not stationary and confounds every other measure on this map. Nine
  // coverage eras 2017-2026; all-vehicle bins run 36.3%-51.5% across the published years and truck
  // bins 8.0%-23.5%. Thinning the probes behind a bin INFLATES the reliability ratios while removing
  // reporting bins DEFLATES the delay measures — opposite directions from the same cause — so a
  // year-over-year read of anything else on this map should be checked against this first.
  coverage: {
    key: "coverage",
    abbr: "Coverage",
    name: "Data coverage",
    subtitle: "how much of the feed arrived",
    selectLabel: "Coverage · data completeness",
    menuLabel: "Coverage · data completeness",
    menuUnit: "%",
    group: "quality",
    answers: "How much of the underlying data actually arrived for this segment.",
    definition:
      "Two percentages on the same 0-100 scale. Bins reporting is how much of a bin-based measure's own input arrived — the sample size its percentiles rest on. Epochs reporting is how much of the raw 5-minute feed arrived, and is lower by construction, since a bin counts as present when any one of its three epochs did.",
    computation: "bins present ÷ bins possible · epochs present ÷ epochs possible",
    equation: "coverage = present / possible",
    unit: "percent",
    unitShort: "percent",
    unitHint: "· bins or epochs",
    referenceControls: ["stream", "peak period"],
    available: true,
  },
  attributes: {
    key: "attributes",
    abbr: "Attributes",
    name: "Attributes",
    subtitle: "TMC · RIS",
    selectLabel: "Attributes",
    menuLabel: "TMC · RIS attributes",
    menuUnit: "meta",
    group: "network",
    answers: "Network metadata itself — functional class, AADT, ownership.",
    definition:
      "Network metadata itself — functional class, AADT, ownership. Coloured straight from a field joined off the network table; no measure controls.",
    computation: "joined from the network table",
    equation: "",
    unit: "varies",
    unitShort: "varies",
    referenceControls: ["attribute"],
    available: false,
  },
};

// § 01's row order, and the measure menu's order within each group.
export const MEASURE_ORDER = [
  "lottr",
  "tttr",
  "tttr_p80",
  "ted",
  "phed",
  "speed",
  "freeflow",
  "emissions",
  "coverage",
  "attributes",
];

// The honest state for a measure the current source can't draw. Rendered as the
// § 01 row's tint + caption; these measures never enter the measure select.
export const NOT_COMPUTED_LABEL = "not yet computed";

// Rows for § 01's reference table, in order — the single place the table's shape is
// declared, consumed by build_npmrds_macro.mjs.
export const measureReferenceRows = () =>
  MEASURE_ORDER.map((key) => {
    const m = MEASURES[key];
    return {
      key,
      measure: m.abbr,
      subtitle: m.subtitle,
      answers: m.answers,
      computation: m.computation,
      unit: m.unitShort,
      unitHint: m.unitHint || "",
      controls: m.referenceControls,
      available: m.available,
      state: m.available ? "" : NOT_COMPUTED_LABEL,
    };
  });

// The measure select / menu: ONLY what the current source supports.
export const availableMeasures = () =>
  MEASURE_ORDER.filter((key) => MEASURES[key].available).map((key) => MEASURES[key]);

// `getMeasure()` in updateFilters composes a data-column string (e.g.
// "lottr_amp_lottr", "phed_truck_freeflow_all_xdelay_phrs", "speed_pctl_5"), so the
// record has to be recovered from the FILTER's measure value, not from the column.
export const measureRecord = (measureKey) => MEASURES[measureKey] || null;
