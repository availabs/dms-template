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
const filters = {
  // geography: {
  //   name: 'Geography',
  //   type: 'select',
  //   domain: [],
  //   value: [],
  //   searchable: true,
  //   accessor: d => d.name,
  //   valueAccessor: d => d.value,
  //   multi: true,
  // },
  // network: {
  //   name: "Network",
  //   type: "select",
  //   value: "tmc",
  //   multi: false,
  //   searchable: false,
  //   accessor: d => d.name,
  //   valueAccessor: d => d.value,
  //   domain: [
  //     { name: "TMC", value: "tmc" },
  //     { name: "Conflation", value: "con" },
  //     // { name: "RIS", value: "ris" }
  //   ]
  // },
  // conflation: {
  //   name: "Conflation",
  //   type: "select",
  //   value: "tmc",
  //   multi: false,
  //   searchable: false,
  //   accessor: d => d.name,
  //   valueAccessor: d => d.value,
  //   active: false,
  //   domain: [
  //     { name: "TMC", value: "tmc" },
  //     { name: "RIS", value: "ris" },
  //     { name: "OSM", value: "osm" }
  //   ]
  // },

  // year: {
  //   name: 'Year',
  //   type: "select",
  //   multi: false,
  //   domain: [...YEARS],
  //   value: YEARS[0]
  // },
  // compareYear: {
  //   name: 'Compare Year',
  //   type: 'select',
  //   multi: false,
  //   domain: ["none", ...YEARS],
  //   value: "none",

  // },
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
  freeflow: {
    order: 1,
    name: "Threshold Speed",
    type: "select",
    // accessor: d => d.name,
    // valueAccessor: d => d.value,
    domain: [
      { name: "Freeflow", value: true },
      { name: "Speed Limit", value: false }
    ],
    value: false,
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

const updateSubMeasures = (filters, falcor) => {
  const {
    // fetchData,
    peakSelector,
    freeflow,
    //risAADT,
    // perMiles,
    vehicleHours,
    attributes,
    percentiles,
    trafficType,
    fueltype,
    pollutant,
    measure
  } = cloneDeep(filters);

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

  freeflow.value = false;
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
const getMeasure = (filters) => {
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
        (freeflow.value && freeflow.value !== "false") && measure.value !== "freeflow" ? "freeflow" : null, //freeflow, optional
        (peakSelector.value !== NO_PEAK_KEY && vehicleHours.value !== HRS) && peakSelector.value, //amp, optional
        vehicleHours.active && vehicleHours.value,//phrs, required
      ].filter(Boolean).join("_")
      break;
    case "ted":
      out = [
        measure.value, //ted, required
        (trafficType.value !== "all") && trafficType.value, //truck, optional
        (freeflow.value && freeflow.value !== "false") && measure.value !== "freeflow" ? "freeflow" : null, //freeflow, optional
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
    case "speed":
      out = [
        measure.value,
        percentiles.value
      ].filter(Boolean).join("_")
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
