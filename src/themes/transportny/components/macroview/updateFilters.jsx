import {get, set, omit, cloneDeep, range} from "lodash-es";


import colorbrewer from "colorbrewer"
const ColorRanges = {};
for (const type in colorbrewer.schemeGroups) {
  colorbrewer.schemeGroups[type].forEach(name => {
    const group = colorbrewer[name];
    for (const length in group) {
      if (!(length in ColorRanges)) {
        ColorRanges[length] = [];
      }
      ColorRanges[length].push({
        type: `${ type[0].toUpperCase() }${ type.slice(1) }`,
        name,
        category: "Colorbrewer",
        colors: group[length]
      })
    }
  })
}


export const getColorRange = (size, name) =>
  get(ColorRanges, [size], [])
    .reduce((a, c) => c.name === name ? c.colors : a, []).slice();

export const AM_PEAK_KEY = 'amp';
export const PM_PEAK_KEY = 'pmp';
export const WEEKEND_KEY = 'we';
export const MIDDAY_KEY = 'midd';
export const OVERNIGHT_KEY = 'ovn';
export const NO_PEAK_KEY = 'all';

const PHRS = 'all_xdelay_phrs';
const VHRS = 'all_xdelay_vhrs';
const HRS = 'xdelay_hrs';
export const SPEED_PERCENTILE_DOMAIN = [
  { name: "", value: "" },
  { name: "5th Percentile", value: "pctl_5" },
  { name: "20th Percentile", value: "pctl_20" },
  { name: "25th Percentile", value: "pctl_25" },
  { name: "50th Percentile", value: "pctl_50" },
  { name: "75th Percentile", value: "pctl_75" },
  { name: "80th Percentile", value: "pctl_80" },
  { name: "85th Percentile", value: "pctl_85" },
  { name: "95th Percentile", value: "pctl_95" },
];
// The viewer-facing filter vocabulary. `measure` plus the dependent controls that
// `updateSubMeasures()` switches on and off; geography and year are NOT filters here —
// they live in pluginData (`geography`, `viewId`) and are rendered by controlsPanel.jsx.
//
// Removed 2026-08-12 (npmrds-macro-view-alignment.md P1): the dead commented-out
// `network` / `conflation` (TMC vs Conflation vs RIS) blocks — the design removed that
// control, TMC is the only network, and a commented-out remnant is not a decision record.
// The commented-out `compareYear` filter went with them: compare-years is a follow-on
// task, not a half-built control (Alex, 2026-08-12), and the View segment in
// controlsPanel.jsx ships it visibly disabled instead of silently absent.
const filters = {
  measure: {
    order: 0,
    name: 'Performance Measure',
    type: 'select',
    domain: [
      { name: "LOTTR", value: "lottr" },
      { name: "TTTR", value: "tttr" },
      { name: "PHED", value: "phed" },
      { name: "TED", value: "ted" },
      { name: "Percentile Speed", value: "speed" },
      //{ name: "Transit AADT", value: "OSM_transit_aadt" },
      //{ name: "RIS Attributes", value: "RIS" },
      //{ name: "TMC Attributes", value: "TMC" }
    ],
    value: 'lottr',
    active: true,
    searchable: true,
    multi: false,
    // accessor: d => d.name,
    // valueAccessor: d => d.value
  },
  // Threshold Speed — WHICH REFERENCE the delay measures are computed against.
  //
  // This was a boolean { Freeflow: true, Speed Limit: false } and the column builder emitted the
  // literal token "freeflow". pm3 computes FOUR references, so two of them — including the one
  // PROVENANCE.md section 9 names as the recommended default, and the one it marks REQUIRED for
  // comparing across functional classes — were unreachable by construction rather than by omission.
  // 84 of the view's columns could not be named by any UI state.
  //
  // `value` is now the TOKEN that getMeasure() splices into the column name, so adding a reference
  // is a domain entry and nothing else. Empty string = no token = the posted-speed-limit family
  // (`phed_*`, `ted_*`), which is how those column names are actually shaped.
  //
  // The order is deliberate: default first, then the two specialised readings, then the deprecated
  // own-year one last. `help` is drawn by contextPanel — the guidance in sections 9 and 10 has to
  // reach the person opening this dropdown, not only the person reading the docs.
  freeflow: {
    order: 1,
    name: "Threshold Speed",
    type: "select",
    domain: [
      {
        name: "Free-flow · fixed reference",
        value: "freeflow_anchored",
        help: "Recommended. 60% of the speed this segment achieves when uncongested, measured over a FIXED window (Jun 2023 – Jul 2024) so year-over-year change is real movement rather than the yardstick drifting.",
      },
      {
        name: "Free-flow · unfloored",
        value: "freeflow_relative",
        help: "Required for comparing ACROSS functional classes. Same fixed reference, but without the 20 mph floor — with the floor in place an arterial figure is ~90% floored against a freeway's ~3%, so a floored comparison compares the floor, not congestion.",
      },
      {
        name: "Posted speed limit",
        value: "",
        help: "The federal formula (23 CFR 490): 60% of the posted limit, floored at 20 mph. Measures degradation from a POLICY number, so on roads that cannot reach 60% of their posted limit it reports delay during normal operation.",
      },
      {
        name: "Free-flow · own year (deprecated)",
        value: "freeflow",
        help: "Legacy. Its reference is drawn from the year being measured, and that reference tracks prevailing traffic at r = +0.998 — so it structurally cannot show multi-year deterioration. Retained only to bridge to the fixed reference. Do not start new analysis on it.",
      },
    ],
    value: "freeflow_anchored",
    multi: false,
    searchable: false,
    active: false
  },
  // risAADT: {
  //   order: 2,
  //   name: "AADT Source",
  //   type: "select",
  //   accessor: d => d.name,
  //   valueAccessor: d => d.value,
  //   domain: [
  //     { name: "RIS", value: true },
  //     { name: "NPMRDS", value: false }
  //   ],
  //   value: false,
  //   multi: false,
  //   searchable: false,
  //   active: false
  // },
  fueltype: {
    name: "Fuel Type",
    type: "select",
    // accessor: d => d.name,
    // valueAccessor: d => d.value,
    domain: [
      { name: "Total (Gasoline & Diesel)", value: "total" },
      { name: "Gasoline", value: "gas" },
      { name: "Diesel", value: "diesel" }
    ],
    value: "total",
    multi: false,
    searchable: false,
    active: false
  },
  pollutant: {
    name: "Pollutant",
    type: "select",
    // accessor: d => d.name,
    // valueAccessor: d => d.value,
    domain: [
      { name: "CO² (Carbon Dioxide)", value: "co2" },
      { name: "CO (Carbon Monoxide)", value: "co" },
      { name: "NOx (Nitrogen Oxides)", value: "nox" },
      { name: "VOC (Volatile organic compound)", value: "voc" },
      { name: "PM₂.₅ (Fine Particles <= 2.5 microns)", value: "pm2_5" },
      { name: "PM₁₀ (Particulate Matter <= 10 microns)", value: "pm10" }
    ],
    value: "co2",
    multi: false,
    searchable: false,
    active: false
  },
  // perMiles: {
  //   name: "Sum By",
  //   type: "select",
  //   accessor: d => d.name,
  //   valueAccessor: d => d.value,
  //   domain: [
  //     { name: "Per Mile", value: true },
  //     { name: "Total", value: false }
  //   ],
  //   value: true,
  //   multi: false,
  //   searchable: false,
  //   active: false
  // },
  vehicleHours: {
    order: 3,
    name: "Unit",
    type: "select",
    // accessor: d => d.name,
    // valueAccessor: d => d.value,
    domain: [
      { name: "Vehicle Hours", value: VHRS },
      { name: "Person Hours", value: PHRS },
      { name: "Xdelay Hours", value: HRS }
    ],
    value: false,
    multi: false,
    searchable: false,
    active: false
  },
  // Coverage publishes TWO percentages on the same scale and they answer different questions, so the
  // choice is explicit rather than implied. Bins is the sample a percentile measure's own input rests
  // on; epochs is the raw 5-minute feed and is lower by construction, since a bin counts as present
  // when any one of its three epochs did. Their ratio recovers probe depth.
  coverageBasis: {
    order: 4,
    name: "Basis",
    type: "select",
    domain: [
      { name: "Bins reporting", value: "bins",
        help: "How much of a bin-based measure's own input arrived — the sample size its percentiles rest on." },
      { name: "Epochs reporting", value: "epochs",
        help: "How much of the raw 5-minute feed arrived. Lower than bins by construction." },
    ],
    value: "bins",
    multi: false,
    searchable: false,
    active: false
  },
  percentiles: {
    order: 6,
    name: "Percentile",
    type: "select",
    // accessor: d => d.name,
    // valueAccessor: d => d.value,
    multi: false,
    domain: SPEED_PERCENTILE_DOMAIN,
    value: null,
    active: false
  },
  trafficType: {
    order: 4,
    name: "Traffic Type",
    type: "select",
    // accessor: d => d.name,
    // valueAccessor: d => d.value,
    domain: [
      { name: "All Traffic", value: "all" },
      { name: "All Trucks", value: "truck" },
      // { name: "Single Unit Trucks", value: "singl" },
      // { name: "Combination Trucks", value: "combi" },
    ],
    value: 'all',
    active: false
  },
  peakSelector: {
    order: 5,
    name: "Peak Selector",
    type: "select",
    // accessor: d => d.name,
    // valueAccessor: d => d.value,
    domain: [],
    value: null,
    multi: false,
    active: true
  },
  attributes: {
    name: "Attributes",
    type: "select",
    // accessor: d => d.name,
    // valueAccessor: d => d.value,
    domain: [],
    value: null,
    multi: false,
    active: false
  }
}

/**
 * Reconcile a PERSISTED filter set with the current one.
 *
 * `updateSubMeasures` is called with `pluginData.measureFilters` — filter state saved into a map
 * section, possibly months ago — not with the `filters` export. So any filter key added since that
 * section was saved is simply absent, and destructuring it yields undefined. That crashed
 * (`Cannot set properties of undefined (setting 'active')`) the moment `coverageBasis` was added.
 *
 * It also migrates `freeflow`, which changed from a BOOLEAN to a reference token. That one would not
 * have crashed — it would have been worse. A saved `true` reached the column builder as the token
 * `"true"`, naming `phed_true_all_xdelay_phrs`, which does not exist: a blank map with no error. A
 * saved `false` would have quietly become the posted-speed-limit family.
 *
 * The boolean maps to the OWN-YEAR token, not the recommended anchored one. `true` meant "Freeflow"
 * when it was saved, and that is `*_freeflow_*`; silently upgrading someone's saved analysis to a
 * different reference would change their numbers. It also has to be own-year for correctness on
 * source 1410, whose views have no anchored columns at all.
 *
 * Static domains are refreshed for the two controls this change touched, since a persisted domain is
 * a stale copy — a saved section would otherwise still render the old two-option Freeflow toggle.
 * `peakSelector`'s domain is deliberately NOT refreshed: it is recomputed per measure below.
 */
const reconcileFilters = (incoming) => {
  const out = cloneDeep(incoming || {});
  for (const [key, def] of Object.entries(filters)) {
    if (!out[key]) out[key] = cloneDeep(def);
  }
  const ff = out.freeflow;
  if (ff) {
    if (typeof ff.value === "boolean" || ff.value === "true" || ff.value === "false") {
      ff.value = (ff.value === true || ff.value === "true") ? "freeflow" : "";
    }
    ff.domain = cloneDeep(filters.freeflow.domain);
  }
  if (out.coverageBasis) out.coverageBasis.domain = cloneDeep(filters.coverageBasis.domain);
  return out;
};

const updateSubMeasures = (filters, falcor) => {
  const {
    // fetchData,
    peakSelector,
    freeflow,
    //risAADT,
    // perMiles,
    vehicleHours,
    coverageBasis,
    attributes,
    percentiles,
    trafficType,
    fueltype,
    pollutant,
    measure
  } = reconcileFilters(filters);

  // const cache = falcor.getCache();

  // const mIds = get(cache, ["pm3", "measureIds","value"], []);
  // const mInfo = get(cache, ["pm3", "measureInfo"], {});

  peakSelector.active = false;
  peakSelector.domain = [];
  trafficType.active = false;
  trafficType.value = 'all'

  freeflow.active = false;
  //risAADT.active = false;
  // perMiles.active = false;
  vehicleHours.active = false;
  percentiles.active = false;

  attributes.active = false;

  fueltype.active = false;
  pollutant.active = false;
  coverageBasis.active = false;
  percentiles.value = null;
  switch (measure.value) {
    case "emissions":
      peakSelector.active = true;

      fueltype.active = true;
      fueltype.value = "total";
      pollutant.active = true;
      pollutant.value = "co2";

      peakSelector.domain = [
        { name: "No Peak", value: NO_PEAK_KEY },
        { name: "AM Peak", value: AM_PEAK_KEY },
        { name: "Off Peak", value: "off" },
        { name: "PM Peak", value: PM_PEAK_KEY },
        { name: "Overnight", value: OVERNIGHT_KEY },
        { name: "Weekend", value: WEEKEND_KEY }
      ]
      //risAADT.active = true;
      break;
    // case "RIS":
    //   attributes.active = true;
    //   attributes.domain = mIds.filter(m => /^RIS_/.test(m))
    //     .map(id => ({
    //       name: get(mInfo, [id, "fullname"], id),
    //       value: id.replace("RIS_", "")
    //     }));
    //   break;
    // case "TMC":
    //   attributes.active = true;
    //   attributes.domain =  mIds.filter(m => /^TMC_/.test(m)).filter(m => m !== "TMC_tmc")
    //     .map(id => ({
    //       name: get(mInfo, [id, "fullname"], id),
    //       value: id.replace("TMC_", "")
    //     }));
    //   break;
    case "lottr":
      peakSelector.active = true;
      peakSelector.domain = [
        // { name: "No Peak", value: NO_PEAK_KEY },
        { name: "AM Peak", value: AM_PEAK_KEY },
        { name: "Midday", value: MIDDAY_KEY },
        // { name: "Off Peak", value: "off" },
        { name: "PM Peak", value: PM_PEAK_KEY },
        { name: "Weekend", value: WEEKEND_KEY }
      ]

      // percentiles.domain = [
      //   { name : "", value: ""},
      //   { name: "80th", value: "80_pct" },
      //   { name: "50th", value: "50_pct" }
      // ]
      // percentiles.active = true;
      // percentiles.value = "";
      peakSelector.value = AM_PEAK_KEY;
      break;
    case "tttr":
      peakSelector.active = true;
      peakSelector.domain = [
        // { name: "No Peak", value: NO_PEAK_KEY },
        { name: "AM Peak", value: AM_PEAK_KEY },
        { name: "Midday", value: MIDDAY_KEY },
        // { name: "Off Peak", value: "off" },
        { name: "PM Peak", value: PM_PEAK_KEY },
        { name: "Weekend", value: WEEKEND_KEY },
        { name: "Overnight", value: OVERNIGHT_KEY }
      ]
      // percentiles.domain = [
      //   { name : "", value: ""},
      //   { name: "95th", value: "95_pct" },
      //   { name: "50th", value: "50_pct" }
      // ]
      // percentiles.value = "";
      // percentiles.active = true;
      peakSelector.value = AM_PEAK_KEY;
      break;
    // R1's truck p80. Every tttr_p80 column is PEAK-SCOPED — pm3 publishes tttr_p80_amp_tttr_p80 and
    // friends but no un-peaked form — so this case is mandatory, not cosmetic. Without it
    // peakSelector.domain stayed empty, the fallback below reset the value to NO_PEAK_KEY, getMeasure
    // omitted the bin segment, and the map asked for `tttr_p80_tttr_p80`: a column that does not
    // exist, hence a blank map for every year with no error anywhere.
    case "tttr_p80":
      peakSelector.active = true;
      peakSelector.domain = [
        { name: "AM Peak", value: AM_PEAK_KEY },
        { name: "Midday", value: MIDDAY_KEY },
        { name: "PM Peak", value: PM_PEAK_KEY },
        { name: "Weekend", value: WEEKEND_KEY },
        { name: "Overnight", value: OVERNIGHT_KEY }
      ]
      peakSelector.value = AM_PEAK_KEY;
      break;
    case "phed":
      peakSelector.active = true;
      peakSelector.domain = [
        { name: "No Peak", value: NO_PEAK_KEY },
        { name: "AM Peak", value: AM_PEAK_KEY },
        { name: "PM Peak", value: PM_PEAK_KEY }
      ]
      freeflow.active = true;
      //risAADT.active = true;
      // perMiles.active = true;
      vehicleHours.active = true;
      trafficType.active = true;
      peakSelector.value = NO_PEAK_KEY;
      vehicleHours.value = PHRS
      break;
    case "ted":
      peakSelector.value = NO_PEAK_KEY;
      freeflow.active = true;
      //risAADT.active = true;
      // perMiles.active = true;
      vehicleHours.active = true;
      trafficType.active = true;
      break;
    case "pti":
    case "tti":
      peakSelector.active = true;
      peakSelector.domain = [
        { name: "No Peak", value: NO_PEAK_KEY },
        { name: "AM Peak", value: AM_PEAK_KEY },
        { name: "PM Peak", value: PM_PEAK_KEY }
      ]
      break;
    case "pct_bins_reporting":
      peakSelector.active = true;
      peakSelector.domain = [
        { name: "No Peak", value: NO_PEAK_KEY },
        { name: "AM Peak", value: AM_PEAK_KEY },
        { name: "Off Peak", value: "off" },
        { name: "PM Peak", value: PM_PEAK_KEY },
        { name: "Overnight", value: OVERNIGHT_KEY },
        { name: "Weekend", value: WEEKEND_KEY }
      ]
      peakSelector.value = NO_PEAK_KEY;
    break;
    case "coverage":
      coverageBasis.active = true;
      trafficType.active = true;
      peakSelector.active = true;
      peakSelector.domain = [
        { name: "All periods", value: NO_PEAK_KEY },
        { name: "AM Peak", value: AM_PEAK_KEY },
        { name: "Midday", value: MIDDAY_KEY },
        { name: "PM Peak", value: PM_PEAK_KEY },
        // PHED's PM window (15-18) is a DIFFERENT window from PMP (16-19), and coverage publishes
        // both rather than reporting one under the other's name. See PROVENANCE.md section 11.
        { name: "PM Peak (delay window)", value: "alt_pmp" },
        { name: "Weekend", value: WEEKEND_KEY },
        // Trucks only: the all-vehicle stream has no overnight bin in pm3's COVERAGE_BINS, so
        // offering it there would name a column that does not exist.
        ...(trafficType.value === "truck"
          ? [{ name: "Overnight", value: OVERNIGHT_KEY }]
          : []),
      ];
      break;
    case "speed":
      // peakSelector.active = true;
      // peakSelector.domain = [
      //   { name: "No Peak", value: "total" },
      //   { name: "AM Peak", value: AM_PEAK_KEY },
      //   { name: "Off Peak", value: "off" },
      //   { name: "PM Peak", value: PM_PEAK_KEY },
      //   { name: "Overnight", value: OVERNIGHT_KEY },
      //   { name: "Weekend", value: WEEKEND_KEY }
      // ]
      percentiles.active = true;
      percentiles.value = "pctl_5"
      percentiles.domain = SPEED_PERCENTILE_DOMAIN;
      break;
    default:
      break;
  }

  if (!peakSelector.domain.reduce((a, c) => a || (c.value === peakSelector.value), false)) {
    peakSelector.value = measure === "speed" ? "total" : NO_PEAK_KEY;
  }

  // if ((measure !== "phed") && (measure !== "ted")) {
  //   freeflow.value = false;
  //   perMiles.value = false;
  //   vehicleHours.value = false;
  // } else {
  //   freeflow.value = true;
  //   perMiles.value = true;
  //   vehicleHours.value = true;
  // }

  // Was `false` when this was a boolean. Now the DEFAULT TOKEN — the fixed-reference free-flow that
  // PROVENANCE.md section 9 recommends. Resetting to "" here would silently default every delay map
  // to the posted-speed-limit family instead.
  freeflow.value = "freeflow_anchored";
  // perMiles.value = false;
  vehicleHours.value = PHRS;
  //risAADT.value = false;


  attributes.value = null;


  return {
    peakSelector,
    freeflow,
    //risAADT,
    // perMiles,
    vehicleHours,
    coverageBasis,
    attributes,
    percentiles,
    trafficType,
    fueltype,
    pollutant,
    measure
  }
// console.log("updateSubMeasures:", filters)
}

//no side effects/mutations/effects/etc.
//literally just tells you what your `data-column` is
const getMeasure = (rawFilters) => {
  // Reconciled for the same reason updateSubMeasures is: comp.jsx and dataUpdate.jsx both call this
  // with PERSISTED `measureFilters` on every render, which can predate `coverageBasis` and can still
  // hold `freeflow` as a boolean. Without this a saved `true` would name `phed_true_*` — a blank map
  // with no error — and it runs before updateSubMeasures has had a chance to write back.
  const filters = reconcileFilters(rawFilters);
  const {
    measure,
    peakSelector,
    freeflow,
    //risAADT,
    // perMiles,
    vehicleHours,
    attributes,
    percentiles,
    trafficType,
    coverageBasis,
    fueltype,
    pollutant
  } = filters;

  //console.log("getMeasure:", filters)

  //if lottr/ttr, measure - timeframe - measure
  //if phed, measure - [truck] - [freeflow] - timeframe
  //if phed and `hrs`, measure - [truck] - [freeflow] hrs

  let out;

  switch(measure.value) {
    case "phed":
      out = [
        measure.value, //phed, required
        (trafficType.value !== "all") && trafficType.value, //truck, optional
        // The SELECTED reference token, not a hardcoded "freeflow". "" = posted speed limit, which is
        // the un-suffixed column family. The measure.value guard stays: there is also a `freeflow`
        // MEASURE (free-flow speed), and without it that would build `freeflow_freeflow_*`.
        (measure.value !== "freeflow" && freeflow.value) || null, //threshold reference, optional
        (peakSelector.value !== NO_PEAK_KEY && vehicleHours.value !== HRS) && peakSelector.value, //amp, optional
        vehicleHours.active && vehicleHours.value,//phrs, required
      ].filter(Boolean).join("_")
      break;
    case "ted":
      out = [
        measure.value, //ted, required
        (trafficType.value !== "all") && trafficType.value, //truck, optional
        // The SELECTED reference token, not a hardcoded "freeflow". "" = posted speed limit, which is
        // the un-suffixed column family. The measure.value guard stays: there is also a `freeflow`
        // MEASURE (free-flow speed), and without it that would build `freeflow_freeflow_*`.
        (measure.value !== "freeflow" && freeflow.value) || null, //threshold reference, optional
        (peakSelector.value !== NO_PEAK_KEY && vehicleHours.value !== HRS) && peakSelector.value, //amp, optional
        vehicleHours.active && vehicleHours.value,//phrs, required
      ].filter(Boolean).join("_")
      break;
    case "lottr":
      out = [
        measure.value,
        (peakSelector.value !== NO_PEAK_KEY) && peakSelector.value,
        measure.value,
        //percentiles.value
      ].filter(Boolean).join("_")
      break;
    case "tttr":
      out = [
        measure.value,
        (peakSelector.value !== NO_PEAK_KEY) && peakSelector.value,
        measure.value,
        //percentiles.value
      ].filter(Boolean).join("_")
      break;
    // Same shape as tttr — `tttr_p80_amp_tttr_p80`. The measure key appears twice because pm3 names
    // the column `<metric>_<bin>_<metric>`.
    case "tttr_p80":
      out = [
        measure.value,
        (peakSelector.value !== NO_PEAK_KEY) && peakSelector.value,
        measure.value,
      ].filter(Boolean).join("_")
      break;
    // coverage_<stream>_<bin>_pct_<basis>_reporting. The bin is ALWAYS present, including "all" —
    // unlike the measure families, where NO_PEAK_KEY means "omit the segment".
    case "coverage":
      out = [
        "coverage",
        trafficType.value === "truck" ? "freight_trucks" : "all_vehicles",
        peakSelector.value,
        "pct",
        coverageBasis.value,
        "reporting",
      ].join("_")
      break;
    case "speed":
      out = [
        measure.value,
        percentiles.value
      ].filter(Boolean).join("_")
      // Pre-existing missing `break` — harmless while `default` is empty, but this is precisely the
      // shape that breaks silently when a case is appended below it.
      break;
    default:
      break;
  }

  // out = [
  //   measure.value,
  //   (trafficType.value !== "all") && trafficType.value,
  //   freeflow.value && measure.value !== "freeflow" ? "freeflow" : null,
  //   //risAADT.value ? "ris" : false,
  //   fueltype.active && (fueltype.value !== "total") ? fueltype.value : false,
  //   pollutant.active && pollutant.value,
  //   fueltype.active && (fueltype.value === "gas") ? "pass" : false,
  //   fueltype.active && (fueltype.value === "diesel") ? "truck" : false,
  //   // perMiles.value && "per_mi",
  //   (peakSelector.value !== "none") && peakSelector.value,
  //   vehicleHours.active && vehicleHours.value,
  //   (measure.value === "speed") && percentiles.value,
  //   (['lottr', 'tttr'].includes(measure.value)) && measure.value,
  //   attributes.value
  // ].filter(Boolean).join("_")

  const NOT_MEASURES = ["RIS", "TMC", "speed_total"];

  if (NOT_MEASURES.includes(out)) {
// console.log("getMeasure::out", "");
    return ""
  }

// console.log("getMeasure::out", out);

  return out
}

const updateLegend = (filters) => {
  let range, format;
  switch (filters.measure.value) {
    case 'lottr':
      range = getColorRange(7, "RdYlBu", true).reverse()
      format = ",.2~f";
      break;
      case 'tttr':
      range = getColorRange(7, "RdYlGn", true).reverse()
      format = ",.2~f";
      break;
    case 'freeflow':
      range = getColorRange(7, "RdPu", true)
      format = ",.0~f";
      break;
    case 'pti':
      range = getColorRange(7, "PRGn", true)
      format = ",.2~f";
      break;
    case 'phed':
      range = getColorRange(7, "YlOrRd", true)
      format = ",.2~s";
      break;
    case 'ted':
      range = getColorRange(7, "YlOrBr", true)
      format = ",.2~s";
      // ⚠ MISSING `break` FOUND 2026-08-18: without it TED fell through into `emissions`
      // and was painted with **Oranges**, i.e. the YlOrBr ramp declared on the line above
      // has never been on screen. The two formats happen to be identical, so the only
      // visible effect was the wrong ramp — TED now paints what this case says it does.
      break;
    case 'emissions':
      range = getColorRange(7, "Oranges", true)
      format = ",.2~s";
      break;
    case 'speed':
      range = getColorRange(7, "Spectral", true)
      format = ",.0~f";
      break;
    case 'pct_bins_reporting':
      range = getColorRange(7, "RdYlGn", true)
      // domain = [.1,.25,.5, .75, .9]
      format = ",.2~f";
      break;
    default:
      range = getColorRange(7, "Reds");
      format = ",.2~s";
      break;
  }


  return {
    range,
    format
  }
}
export { filters, updateSubMeasures, getMeasure, updateLegend }
