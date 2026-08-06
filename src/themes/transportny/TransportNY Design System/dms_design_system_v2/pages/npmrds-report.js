/* TransportNY · npmrds-report.html — the interactive layer
 * ════════════════════════════════════════════════════════════════════════════
 * WHY THIS FILE EXISTS. Every other page in this catalogue is a still drawing,
 * and that is right for a page you read. The report page is a page you DRIVE:
 * its rail is a control surface, and the two modals behind Add Route / Add
 * Graph are multi-step flows (drill into a tag folder, come back out, pick a
 * measure and watch the guidance change). Those cannot be judged from a
 * screenshot of one state — so the states are not drawn below the fold any
 * more, they are reachable. Click the rail.
 *
 * WHAT IS LIVE (all of it local to this page — nothing is fetched, nothing is
 * persisted):
 *   · Add Route / Add Graph — ALWAYS available, not gated behind edit mode: they
 *     are the report's two jobs, and a report with no routes has to offer the way
 *     out of that state. (Component escalation: the gate moves from "hide the
 *     button" to "the button enters edit mode and opens the modal" — nothing
 *     writes until confirm either way.)
 *   · edit mode toggle (header Edit, the rail's own "edit routes") — swaps the rail
 *     between the read-only panel and the mutating one, and puts the section
 *     toolbar + Measure Picker chrome on the canvas cards
 *   · panel collapse · row expand/collapse · TMC "+N more"
 *   · search (filters rows live, with the real no-match copy)
 *   · rename, inline, with the real duplicate-name refusal
 *   · the window, as three facets: DATES (which days) → DAYS (which of those
 *     count) → TIME OF DAY (which hours of each), with the time-of-day presets,
 *     the day mask, the day count the engine will really enumerate, and the
 *     validation for the two silent engine failures (a backwards time window is
 *     dropped rather than erroring; a time on one bound only is ignored)
 *   · copy a window and paste it onto another route, or into all of them
 *   · identity colour picker · graph-assignment chips
 *   · Dynamic Report switch (Add Route becomes Add Route Slot)
 *   · Add Routes in full: name search (the lead path), the three tag doors as
 *     header pills, drill-in/back-out with a breadcrumb, per-row county/region/
 *     agency tags, already-on-report flagging, selection chips with clear-all
 *   · Add Graph in full: the four SHAPE cards (Bar · Line · Grid · Table — Table
 *     builds a Spreadsheet section, the other three an AVL Graph), the grouped
 *     measure list with live guidance, resolution + comparison mode demoted to
 *     `refine`, and the Anchor Route select that only exists for Difference mode
 *     with exactly two routes checked
 *
 * WHAT IS DELIBERATELY INERT: the two confirm buttons. Adding a route or a
 * graph would mean writing to the report — this is a design artifact, so the
 * flow is what's being designed, not the write. Both say so when clicked.
 * Nothing here changes a graph, a legend or the canvas: colour and assignment
 * edits move the rail's own chrome only.
 *
 * Plain ES5-ish browser JS, no build step, no dependencies — same contract as
 * every page in this folder (see README "Working with this folder"). The row
 * markup lives in `rowHtml()` below rather than in the HTML file because a row
 * has six mutually exclusive states and hand-writing four copies of each was
 * how the old draft got to 1,300 lines of drawn states.
 *
 * Vocabularies are REAL, from the component's own sources:
 *   TAG_CATEGORIES  ← components/RouteTagBrowserModal/tagCategories.js
 *   MEASURES/RESOLUTIONS/GRAPH_TYPES ← components/MeasurePicker/vocabulary.json
 *   MEASURE_DESCRIPTIONS/GRAPH_TYPE_DESCRIPTIONS ← AddGraphModal/graphGuidanceCopy.js
 *   PEAK_PRESETS/DOW_DEFS ← ReportRouteList/RouteRow.jsx
 */
(function () {
  'use strict';

  // ── Vocabularies ─────────────────────────────────────────────────────────
  var NY_COUNTIES = ['Albany', 'Allegany', 'Bronx', 'Broome', 'Cattaraugus', 'Cayuga', 'Chautauqua', 'Chemung', 'Chenango', 'Clinton', 'Columbia', 'Cortland', 'Delaware', 'Dutchess', 'Erie', 'Essex', 'Franklin', 'Fulton', 'Genesee', 'Greene', 'Hamilton', 'Herkimer', 'Jefferson', 'Kings', 'Lewis', 'Livingston', 'Madison', 'Monroe', 'Montgomery', 'Nassau', 'New York', 'Niagara', 'Oneida', 'Onondaga', 'Ontario', 'Orange', 'Orleans', 'Oswego', 'Otsego', 'Putnam', 'Queens', 'Rensselaer', 'Richmond', 'Rockland', 'St. Lawrence', 'Saratoga', 'Schenectady', 'Schoharie', 'Schuyler', 'Seneca', 'Steuben', 'Suffolk', 'Sullivan', 'Tioga', 'Tompkins', 'Ulster', 'Warren', 'Washington', 'Wayne', 'Westchester', 'Wyoming', 'Yates'];
  var NYSDOT_REGIONS = [
    [1, 'Region 1 - Capital District'], [2, 'Region 2 - Mohawk Valley'], [3, 'Region 3 - Central New York'],
    [4, 'Region 4 - Genesee Valley'], [5, 'Region 5 - Western New York'], [6, 'Region 6 - Southern Tier/Central New York'],
    [7, 'Region 7 - North Country'], [8, 'Region 8 - Hudson Valley'], [9, 'Region 9 - Southern Tier'],
    [10, 'Region 10 - Long Island'], [11, 'Region 11 - New York City']
  ];
  var AGENCY_CODES = [
    ['NYSDOT', 'NYSDOT'], ['WLD', 'WLD (Week-Long Deployment)'], ['SDD', 'SDD (Single-Day Deployment)'],
    ['TDD', 'TDD (Two-Day Deployment)'], ['MDD', 'MDD (Multiple-Day Deployment)'], ['AGFTC', 'AGFTC'],
    ['BMTS', 'BMTS'], ['CDTC', 'CDTC'], ['GBNRTC', 'GBNRTC'], ['GTC', 'GTC'], ['HOCTS', 'HOCTS'],
    ['ITCTC', 'ITCTC'], ['NYMTC', 'NYMTC'], ['NYSAMPO', 'NYSAMPO'], ['OCTC', 'OCTC'], ['PDCTC', 'PDCTC'],
    ['SMTC', 'SMTC'], ['UCTC', 'UCTC']
  ];
  var AUTO_TAG = 'auto_generated';
  var TAG_CATEGORIES = [
    { key: 'county', label: 'County', values: NY_COUNTIES.map(function (n) { return { value: 'county:' + n, label: n }; }) },
    { key: 'region', label: 'Region', values: NYSDOT_REGIONS.map(function (r) { return { value: 'region:' + r[0], label: r[1] }; }) },
    { key: 'agency', label: 'Agency', values: AGENCY_CODES.map(function (a) { return { value: 'agency:' + a[0], label: a[1] }; }) }
  ];

  // TABLE is new here (2026-08-05). It is not an AVL Graph type — it builds a
  // Spreadsheet section, which is what the real report pages use for "Route Info
  // Box" / "Route summary · peak periods". It belonged in this modal all along: it
  // was the one card type whose only route in was the long +Add Component path this
  // modal exists to replace. `creates` is surfaced on the card because it decides
  // what the section's own menu offers afterwards.
  var GRAPH_TYPES = [
    { value: 'BarGraph', label: 'Bar', full: 'Bar Graph', creates: 'AVL Graph', good: 'Compare values side by side.' },
    { value: 'LineGraph', label: 'Line', full: 'Line Graph', creates: 'AVL Graph', good: 'Follow a trend over time.' },
    { value: 'GridGraph', label: 'Grid', full: 'Grid Graph', creates: 'AVL Graph', good: 'Patterns across many buckets.' },
    { value: 'Table', label: 'Table', full: 'Table', creates: 'Spreadsheet', good: 'Exact numbers, plus a CSV.' },
    { value: 'Map', label: 'Map', full: 'Route Map', creates: 'Map', good: 'Where on the corridor it changes.' }
  ];
  var MEASURES = [
    { value: 'speed', label: 'Speed (mph)' },
    { value: 'speedTruck', label: 'Truck Speed (mph)' },
    { value: 'travelTime', label: 'Travel Time (min)' },
    { value: 'hoursOfDelay', label: 'Hours of Delay' },
    { value: 'avgHoursOfDelay', label: 'Avg. Hours of Delay' },
    { value: 'co2Emissions_passenger', label: 'CO2 Emissions (tonnes) — Passenger' },
    { value: 'avgCo2Emissions_passenger', label: 'Avg. CO2 Emissions (tonnes) — Passenger' },
    { value: 'co2Emissions_truck', label: 'CO2 Emissions (tonnes) — Truck' },
    { value: 'avgCo2Emissions_truck', label: 'Avg. CO2 Emissions (tonnes) — Truck' }
  ];
  var RESOLUTIONS = [
    { value: '5-minutes', label: '5 Minutes' }, { value: '15-minutes', label: '15 Minutes' },
    { value: 'hour', label: 'Hour' }, { value: 'day', label: 'Day' },
    { value: 'weekday', label: 'Weekday' }, { value: 'month', label: 'Month' }
  ];
  var COMPARISON_MODES = [{ value: 'plain', label: 'Plain' }, { value: 'difference', label: 'Difference' }];
  // Grouping is presentation only — the vocabulary is flat, and every measure stays
  // reachable. Nine options in one list is a wall; four families is a glance.
  var MEASURE_GROUPS = [
    { label: 'Speed', values: ['speed', 'speedTruck'] },
    { label: 'Travel time', values: ['travelTime'] },
    { label: 'Delay', values: ['hoursOfDelay', 'avgHoursOfDelay'] },
    { label: 'Emissions', values: ['co2Emissions_passenger', 'avgCo2Emissions_passenger', 'co2Emissions_truck', 'avgCo2Emissions_truck'] }
  ];
  var MEASURE_DESCRIPTIONS = {
    speed: 'Average travel speed across the route, in miles per hour.',
    speedTruck: 'Average truck travel speed across the route, in miles per hour.',
    travelTime: 'Average time to traverse the route, in minutes.',
    hoursOfDelay: 'Total vehicle-hours lost to congestion below free-flow speed.',
    avgHoursOfDelay: 'Average per-day vehicle-hours lost to congestion below free-flow speed.',
    co2Emissions_passenger: 'Total CO2 emitted by passenger vehicles on the route, in tonnes.',
    avgCo2Emissions_passenger: 'Average per-day CO2 emitted by passenger vehicles on the route, in tonnes.',
    co2Emissions_truck: 'Total CO2 emitted by trucks on the route, in tonnes.',
    avgCo2Emissions_truck: 'Average per-day CO2 emitted by trucks on the route, in tonnes.'
  };
  var GRAPH_TYPE_DESCRIPTIONS = {
    BarGraph: 'One bar per time bucket — good for comparing values across routes at a glance.',
    LineGraph: 'A continuous line per route — good for seeing trends over time.',
    GridGraph: 'A heatmap of value by time-of-day and route — good for spotting patterns across many time buckets at once.',
    Table: 'One row per route, one column per period — good for exact values and for handing the numbers on.',
    Map: 'The route drawn segment by segment, coloured by the measure — the only card that answers WHERE on the corridor the value changes.'
  };
  var GLYPHS = {
    BarGraph: '<svg viewBox="0 0 40 40" fill="none" class="SZ shrink-0 text-[#1F3F8F]"><rect x="4" y="20" width="6" height="16" rx="1" fill="currentColor" opacity="0.5"/><rect x="14" y="10" width="6" height="26" rx="1" fill="currentColor"/><rect x="24" y="16" width="6" height="20" rx="1" fill="currentColor" opacity="0.7"/><rect x="34" y="4" width="2" height="32" fill="currentColor" opacity="0.15"/></svg>',
    LineGraph: '<svg viewBox="0 0 40 40" fill="none" class="SZ shrink-0 text-[#1F3F8F]"><polyline points="4,30 14,14 24,22 36,6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="14" cy="14" r="2" fill="currentColor"/><circle cx="24" cy="22" r="2" fill="currentColor"/><circle cx="36" cy="6" r="2" fill="currentColor"/></svg>',
    GridGraph: '<svg viewBox="0 0 40 40" fill="none" class="SZ shrink-0 text-[#1F3F8F]"><rect x="4" y="4" width="9" height="9" rx="1" fill="currentColor" opacity="0.9"/><rect x="16" y="4" width="9" height="9" rx="1" fill="currentColor" opacity="0.3"/><rect x="28" y="4" width="9" height="9" rx="1" fill="currentColor" opacity="0.6"/><rect x="4" y="16" width="9" height="9" rx="1" fill="currentColor" opacity="0.4"/><rect x="16" y="16" width="9" height="9" rx="1" fill="currentColor" opacity="0.95"/><rect x="28" y="16" width="9" height="9" rx="1" fill="currentColor" opacity="0.2"/><rect x="4" y="28" width="9" height="9" rx="1" fill="currentColor" opacity="0.15"/><rect x="16" y="28" width="9" height="9" rx="1" fill="currentColor" opacity="0.55"/><rect x="28" y="28" width="9" height="9" rx="1" fill="currentColor" opacity="0.8"/></svg>',
    Map: '<svg viewBox="0 0 40 40" fill="none" class="SZ shrink-0 text-[#1F3F8F]"><rect x="3" y="3" width="34" height="34" rx="3" fill="currentColor" opacity="0.08"/><path d="M9 33 L15 24 L19 18 L26 11 L32 7" stroke="currentColor" stroke-width="3" stroke-linecap="round" fill="none"/><path d="M19 18 L29 20" stroke="currentColor" stroke-width="2" opacity="0.45" stroke-linecap="round" fill="none"/><circle cx="19" cy="18" r="2.4" fill="currentColor"/><circle cx="26" cy="11" r="2.4" fill="currentColor" opacity="0.55"/></svg>',
    Table: '<svg viewBox="0 0 40 40" fill="none" class="SZ shrink-0 text-[#1F3F8F]"><rect x="4" y="7" width="32" height="7" rx="1" fill="currentColor" opacity="0.85"/><rect x="4" y="17" width="32" height="5" rx="1" fill="currentColor" opacity="0.35"/><rect x="4" y="25" width="32" height="5" rx="1" fill="currentColor" opacity="0.35"/><rect x="14.5" y="7" width="1.4" height="23" fill="#fff" opacity="0.9"/><rect x="25.5" y="7" width="1.4" height="23" fill="#fff" opacity="0.9"/></svg>'
  };
  // one glyph set, two sizes — the cards want size-7, the footer strip size-10
  function glyph(type, size) { return (GLYPHS[type] || GLYPHS.BarGraph).replace(/\bSZ\b|size-10/g, size || 'size-10'); }

  // RouteRow.jsx's own presets. OVN/FREEFLOW are absent on purpose: both wrap
  // past midnight, which the epoch-range mechanism can't express.
  var PEAK_PRESETS = [
    { label: 'AM Peak', s: '06:00', e: '10:00' },
    { label: 'PM Peak', s: '16:00', e: '20:00' },
    { label: 'PM Peak (alt)', s: '15:00', e: '19:00' },
    { label: 'Midday', s: '10:00', e: '16:00' },
    { label: 'All Day', s: '', e: '' }
  ];
  var DOW = [['sunday', 'Su'], ['monday', 'Mo'], ['tuesday', 'Tu'], ['wednesday', 'We'], ['thursday', 'Th'], ['friday', 'Fr'], ['saturday', 'Sa']];
  var WEEKDAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
  var WEEKEND_KEYS = ['sunday', 'saturday'];
  // ROUTE_COLOR_PALETTE is getColorRange(20,'div7') in the component; this is
  // that ramp plus the brand's own route colours, which is what authors reach for.
  var PALETTE = ['#d73027', '#f46d43', '#fdae61', '#fee08b', '#d9ef8b', '#a6d96a', '#66bd63', '#1a9850', '#10B981', '#1F3F8F', '#37576B', '#8B5CF6', '#E5A646', '#EF4444', '#0f6b42', '#2e9464', '#16307A', '#CA8A04'];

  // ── The report's own routes ───────────────────────────────────────────────
  var TMCS = {
    nb: ['120+29713', '120P29714', '120+29714', '120P29715', '120+29715', '120P29716', '120+29716', '120P29717', '120+29717'],
    sb: ['120-29713', '120N29714', '120-29714', '120N29715', '120-29715', '120N29716', '120-29716', '120N29717', '120-29717']
  };
  var GRAPHS = [
    { id: 'g1', label: 'Graph 1' }, { id: 'g2', label: 'Graph 2' }, { id: 'g3', label: 'Graph 3' },
    { id: 'g4', label: 'Graph 4' }, { id: 'g5', label: 'Graph 5' }
  ];
  var routes = [
    {
      id: 'comp-1', name: 'NY-9D NB · before', color: '#1F3F8F', tmcs: TMCS.nb, miles: '2.0',
      start: '2025-01-06T06:00', end: '2025-02-28T10:00', weekdays: { saturday: false, sunday: false },
      graphs: ['g1', 'g2', 'g4'], title: 'NY-9D Northbound (I-84 to Main St/Beekman, via Verplanck) — Jan–Feb 2025'
    },
    {
      id: 'comp-2', name: 'NY-9D NB · after', color: '#E5A646', tmcs: TMCS.nb, miles: '2.0',
      start: '2026-01-05T06:00', end: '2026-02-27T10:00', weekdays: { saturday: false, sunday: false },
      graphs: ['g1', 'g2', 'g4'], title: 'NY-9D Northbound (I-84 to Main St/Beekman, via Verplanck) — Jan–Feb 2026'
    },
    {
      id: 'comp-3', name: 'NY-9D SB · before', color: '#10B981', tmcs: TMCS.sb, miles: '1.9',
      start: '2025-01-06T16:00', end: '2025-02-28T20:00', weekdays: { saturday: false, sunday: false },
      graphs: ['g3'], title: 'NY-9D Southbound (Main St/Beekman to I-84, via Verplanck) — Jan–Feb 2025'
    },
    {
      // Mechanism B: this row's window is COMPUTED from comp-3's, so its date
      // block renders read-only with a note instead of the pencil.
      id: 'comp-4', name: 'NY-9D SB · after', color: '#8B5CF6', tmcs: TMCS.sb, miles: '1.9',
      start: '2026-01-05T16:00', end: '2026-02-27T20:00', weekdays: { saturday: false, sunday: false },
      graphs: [], derivedFrom: 'comp-3', title: 'NY-9D Southbound (Main St/Beekman to I-84, via Verplanck) — Jan–Feb 2026'
    }
  ];

  // ── The route catalogue the Add Routes modal browses ──────────────────────
  // Enough rows, with real tags, that searching and folder-drilling both return
  // something and both can be made to return nothing.
  function cat(name, tmcs, county, region, agency, auto) {
    var tags = ['county:' + county, 'region:' + region, 'agency:' + agency];
    if (auto) tags.push(AUTO_TAG);
    return { id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name: name, tmcs: tmcs, tags: tags };
  }
  var CATALOG = [
    cat('NY-9D NB (Beacon) — full corridor', 9, 'Dutchess', 8, 'PDCTC'),
    cat('NY-9D SB (Beacon) — full corridor', 9, 'Dutchess', 8, 'PDCTC'),
    cat('NY-9D NB · Main St to Verplanck', 4, 'Dutchess', 8, 'PDCTC'),
    cat('NY-52 WB · Fishkill village', 6, 'Dutchess', 8, 'PDCTC'),
    cat('I-84 EB · Newburgh–Fishkill (Hudson crossing)', 24, 'Orange', 8, 'NYSDOT'),
    cat('I-84 WB · Fishkill–Newburgh (Hudson crossing)', 24, 'Dutchess', 8, 'NYSDOT'),
    cat('US-9 NB · Wappingers Falls to Poughkeepsie', 17, 'Dutchess', 8, 'PDCTC'),
    cat('US-9 SB · Poughkeepsie to Wappingers Falls', 17, 'Dutchess', 8, 'PDCTC'),
    cat('US-44 EB · Poughkeepsie road diet', 11, 'Dutchess', 8, 'PDCTC'),
    cat('NY-55 WB · Poughkeepsie arterial', 13, 'Dutchess', 8, 'PDCTC'),
    cat('Taconic Pkwy NB · Putnam county line to I-84', 19, 'Putnam', 8, 'NYSDOT'),
    cat('NY-9A NB · Croton to Ossining', 15, 'Westchester', 8, 'NYMTC'),
    cat('I-287 EB · Tappan Zee approach', 22, 'Rockland', 8, 'NYMTC'),
    cat('I-287 WB · Tappan Zee approach', 22, 'Westchester', 8, 'NYMTC'),
    cat('I-87 NB · Suffern to Harriman', 26, 'Rockland', 8, 'NYSDOT'),
    cat('I-95 SB · New Rochelle to Pelham', 14, 'Westchester', 8, 'NYMTC'),
    cat('I-787 NB · Albany downtown', 12, 'Albany', 1, 'CDTC'),
    cat('NY-5 EB · Central Ave, Colonie', 21, 'Albany', 1, 'CDTC'),
    cat('NY-7 WB · Latham to Schenectady', 18, 'Albany', 1, 'CDTC'),
    cat('I-90 EB · Schenectady to Albany', 29, 'Schenectady', 1, 'CDTC'),
    cat('NY-146 EB · Clifton Park', 9, 'Saratoga', 1, 'CDTC'),
    cat('I-490 WB · Rochester inner loop', 20, 'Monroe', 4, 'GTC'),
    cat('NY-104 EB · Irondequoit', 16, 'Monroe', 4, 'GTC'),
    cat('I-590 NB · Brighton', 8, 'Monroe', 4, 'GTC'),
    cat('I-190 NB · Buffalo waterfront', 23, 'Erie', 5, 'GBNRTC'),
    cat('NY-33 EB · Kensington Expwy', 13, 'Erie', 5, 'GBNRTC'),
    cat('I-290 WB · Tonawanda', 17, 'Erie', 5, 'GBNRTC'),
    cat('I-81 SB · Syracuse viaduct', 15, 'Onondaga', 3, 'SMTC'),
    cat('I-690 EB · Syracuse', 12, 'Onondaga', 3, 'SMTC'),
    cat('NY-5 WB · Camillus', 10, 'Onondaga', 3, 'SMTC'),
    cat('NY-17 EB · Binghamton', 25, 'Broome', 9, 'BMTS'),
    cat('NY-434 WB · Vestal', 11, 'Broome', 9, 'BMTS'),
    cat('NY-13 NB · Ithaca', 9, 'Tompkins', 3, 'ITCTC'),
    cat('I-87 NB · Glens Falls', 14, 'Warren', 1, 'AGFTC'),
    cat('NY-104 WB · Oswego', 12, 'Oswego', 3, 'SMTC'),
    cat('I-495 EB · Nassau–Suffolk line', 31, 'Suffolk', 10, 'NYMTC'),
    cat('NY-27 EB · Southampton', 18, 'Suffolk', 10, 'NYMTC'),
    cat('Auto · I-84 EB corridor (generated 2026-06-02)', 24, 'Dutchess', 8, 'NYSDOT', true),
    cat('Auto · NY-9D NB corridor (generated 2026-06-02)', 9, 'Dutchess', 8, 'NYSDOT', true),
    cat('Auto · US-9 NB corridor (generated 2026-05-18)', 17, 'Dutchess', 8, 'NYSDOT', true),
    cat('Auto · I-90 EB corridor (generated 2026-05-18)', 29, 'Albany', 1, 'NYSDOT', true)
  ];
  // A few catalogue rows carry the project-number style free-text tags the
  // "Other tags" door searches.
  CATALOG[8].tags.push('pin:8756.41');
  CATALOG[9].tags.push('pin:8756.41');
  CATALOG[0].tags.push('pin:1760.99', 'beacon signal study');
  CATALOG[1].tags.push('pin:1760.99', 'beacon signal study');
  // The report's own four routes came from the first two catalogue rows.
  var ON_REPORT_CATALOG_IDS = [CATALOG[0].id, CATALOG[1].id];

  // ── State ────────────────────────────────────────────────────────────────
  var S = {
    mode: 'view',            // 'view' | 'edit'
    collapsed: false,
    dynamic: false,
    query: '',
    expanded: {},            // routeId -> bool
    editingName: null,       // routeId
    nameDraft: '',
    editingDates: null,      // routeId
    dateDraft: null,         // { start, end, weekdays }
    picking: null,           // routeId whose colour popover is open
    // A window copied from one route, waiting to be pasted onto others. In-app, not the
    // OS clipboard: the value is a shape ({start,end,weekdays}), not text, and the whole
    // point is to hand it to sibling routes — the common case being "make them all use
    // the same window", which is why the copied-strip offers apply-to-all directly.
    clip: null,              // { from, fromName, start, end, weekdays }
    error: ''
  };

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function byId(id) { for (var i = 0; i < routes.length; i++) if (routes[i].id === id) return routes[i]; return null; }
  function datePart(v) { return (v || '').split('T')[0]; }
  function timePart(v) { return (v || '').split('T')[1] || ''; }
  function joinDT(d, t) { return t ? d + 'T' + t : d; }
  function dayOn(mask, k) { return !mask || mask[k] !== false; }
  function summarizeWeekdays(mask) {
    var off = DOW.filter(function (d) { return mask && mask[d[0]] === false; }).map(function (d) { return d[1]; });
    if (!off.length) return null;
    var on = DOW.filter(function (d) { return dayOn(mask, d[0]); }).map(function (d) { return d[0]; });
    var same = function (list) { return on.length === list.length && list.every(function (k) { return on.indexOf(k) > -1; }); };
    if (same(WEEKDAY_KEYS)) return 'Weekdays only';
    if (same(WEEKEND_KEYS)) return 'Weekends only';
    return 'Excludes ' + off.join(', ');
  }
  // ── THE WINDOW MODEL (this is what the engine actually does) ─────────────────
  // useGraphPublish builds TWO independent IN-lists from one stored pair of
  // "YYYY-MM-DDTHH:mm" strings:
  //   · `date`  = every date from the start date to the end date, minus the days the
  //               weekday mask excludes (generateDateRange)
  //   · `epoch` = every 5-minute epoch from the start TIME to the end TIME, a
  //               WITHIN-DAY band applied to every one of those dates
  //               (generateEpochRange, inclusive of the end epoch)
  // So the values are averaged across days at the same hours — it is NOT one
  // continuous stretch from the start instant to the end instant. Presenting the
  // controls as "start date + start time / end date + end time" claimed the opposite,
  // which is the whole reason these controls were rebuilt as three facets:
  // DATES (which days) → DAYS (which of them count) → TIME OF DAY (which hours of each).
  //
  // Two engine behaviours the UI now has to state, because both are silent:
  //   · a backwards time window makes `epochs` empty, and an empty epoch array means
  //     the filter is never pushed at all — so it silently becomes ALL DAY rather than
  //     erroring. Same for a window that would cross midnight, which is why OVN and
  //     FREEFLOW are absent from the presets.
  //   · times only apply if BOTH bounds carry a time; one bound alone is ignored.
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function fmtDate(ymd) {
    var p = (ymd || '').split('-');
    if (p.length !== 3) return ymd || '—';
    return MONTHS[+p[1] - 1] + ' ' + (+p[2]) + ', ' + p[0];
  }
  function fmtDateRange(a, b) {
    var pa = datePart(a).split('-'), pb = datePart(b).split('-');
    if (pa.length !== 3 || pb.length !== 3) return fmtDate(datePart(a)) + ' → ' + fmtDate(datePart(b));
    // same year reads better without repeating it
    if (pa[0] === pb[0]) return MONTHS[+pa[1] - 1] + ' ' + (+pa[2]) + ' – ' + MONTHS[+pb[1] - 1] + ' ' + (+pb[2]) + ', ' + pa[0];
    return fmtDate(datePart(a)) + ' – ' + fmtDate(datePart(b));
  }
  // Counts the days the engine will actually enumerate — the same day-by-day loop
  // generateDateRange runs, mask included, so the number in the UI is the number of
  // days in the query rather than a calendar subtraction.
  function countDays(a, b, mask) {
    var pa = datePart(a).split('-'), pb = datePart(b).split('-');
    if (pa.length !== 3 || pb.length !== 3) return null;
    var d = new Date(+pa[0], +pa[1] - 1, +pa[2]), end = new Date(+pb[0], +pb[1] - 1, +pb[2]);
    if (isNaN(d) || isNaN(end) || d > end) return null;
    var all = 0, kept = 0, names = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    while (d <= end && all < 4000) {
      all++;
      if (!mask || mask[names[d.getDay()]] !== false) kept++;
      d.setDate(d.getDate() + 1);
    }
    return { all: all, kept: kept };
  }
  function shiftYMD(ymd, years) {
    var p = (ymd || '').split('-');
    if (p.length !== 3) return ymd;
    var d = new Date(+p[0] + years, +p[1] - 1, +p[2]);
    if (isNaN(d)) return ymd;
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function timeOfDayLabel(d) {
    var s = timePart(d.start), e = timePart(d.end);
    if (!s || !e) return 'All day';
    var hit = PEAK_PRESETS.filter(function (p) { return p.s === s && p.e === e; })[0];
    return s + ' – ' + e + (hit && hit.label !== 'All Day' ? ' · ' + hit.label : '');
  }
  function daysLabel(mask) {
    var on = DOW.filter(function (dd) { return dayOn(mask, dd[0]); });
    if (on.length === 7) return 'All days';
    return (summarizeWeekdays(mask) || on.length + ' days') + ' · ' + on.length + ' of 7';
  }
  // Every problem the stored shape can carry, in the words of what the engine will do
  // with it. `level` drives the colour: rose = the query is wrong, amber = the query is
  // legal but not what the control implies.
  function windowIssues(d) {
    var out = [];
    var s = datePart(d.start), e = datePart(d.end);
    if (!s || !e) { out.push({ level: 'error', text: 'Both dates are needed — without them the route has no date filter at all.' }); return out; }
    if (s > e) out.push({ level: 'error', text: 'The end date is before the start date, so no days are enumerated and the route returns nothing.' });
    var ts = timePart(d.start), te = timePart(d.end);
    if ((ts && !te) || (!ts && te)) out.push({ level: 'warn', text: 'A time of day needs both bounds — with one, the time filter is dropped and every hour is included.' });
    if (ts && te && ts > te) out.push({ level: 'warn', text: 'This window runs backwards (and a window can’t cross midnight). The epoch filter would be dropped, silently giving all-day data.' });
    return out;
  }

  function windowLabel(r) {
    var s = timePart(r.start), e = timePart(r.end);
    if (!s && !e) return null;
    var hit = PEAK_PRESETS.filter(function (p) { return p.s === s && p.e === e; })[0];
    return hit ? hit.label + ' window' : s + '–' + e;
  }
  function metaLine(r) {
    return r.tmcs.length + ' TMC · ' + r.miles + ' mi · ' + datePart(r.start) + ' → ' + datePart(r.end);
  }

  // ── Icons (inline, matching the page's own set) ───────────────────────────
  var I = {
    caretUp: '<svg class="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m4.5 15.75 7.5-7.5 7.5 7.5"/></svg>',
    caretDown: '<svg class="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m19.5 8.25-7.5 7.5-7.5-7.5"/></svg>',
    pencil: '<svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M16.86 4.49a2.12 2.12 0 1 1 3 3L8.5 18.85 4 20l1.15-4.5L16.86 4.49Z"/></svg>',
    trash: '<svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
    save: '<svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 4h11l3 3v13H5z"/><path d="M9 4v5h6V4M8 20v-5h8v5"/></svg>',
    cancel: '<svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m0-6-6 6"/></svg>',
    check: '<svg class="size-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="m4.5 12.75 6 6 9-13.5"/></svg>',
    calendar: '<svg class="size-3 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4m8-4v4"/></svg>',
    clock: '<svg class="size-3 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 8v4l2 2"/></svg>',
    more: '<svg class="size-4" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>',
    x: '<svg class="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 6 12 12M18 6 6 18"/></svg>',
    copy: '<svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>',
    paste: '<svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="7" y="4" width="10" height="16" rx="2"/><path d="M10 4V3h4v1"/><path d="M10 11h4M10 15h4"/></svg>'
  };

  // ── Rail: one route row ──────────────────────────────────────────────────
  var C = {  // class strings, named so a reader can map them to the theme
    rowBase: 'px-2 py-2.5',
    rowOpen: 'px-2 py-2.5 bg-slate-50/60',
    name: 'font-proxima text-[13px] font-semibold text-slate-700 truncate',
    meta: 'font-mono text-[9.5px] uppercase tracking-[0.08em] text-slate-400 tabular-nums mt-0.5',
    iconBtn: 'size-6 rounded flex items-center justify-center text-slate-400 hover:bg-slate-100 shrink-0',
    dangerBtn: 'size-6 rounded flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-600 shrink-0',
    expander: 'size-5 mt-0.5 shrink-0 rounded border border-zinc-950/12 bg-white flex items-center justify-center font-mono text-[11px] leading-none text-slate-500 hover:border-[#37576B]',
    expanderOpen: 'size-5 mt-0.5 shrink-0 rounded border border-[#37576B]/40 bg-white flex items-center justify-center font-mono text-[11px] leading-none text-[#37576B]',
    label: 'font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500',
    chipOn: 'h-5 px-1.5 inline-flex items-center gap-1 rounded bg-[#37576B] text-white font-mono text-[9.5px] uppercase tracking-wider',
    chipOff: 'h-5 px-1.5 inline-flex items-center rounded border border-zinc-950/15 bg-white text-slate-500 font-mono text-[9.5px] uppercase tracking-wider hover:border-[#37576B]',
    chipOffRead: 'h-5 px-1.5 inline-flex items-center rounded border border-zinc-950/12 bg-white text-slate-400 font-mono text-[9.5px] uppercase tracking-wider',
    pill: 'h-5 px-1.5 rounded border border-zinc-950/12 bg-slate-100 text-slate-600 font-mono text-[10px] hover:bg-slate-200',
    pillOn: 'h-5 px-1.5 rounded border border-[#1F3F8F] bg-[#1F3F8F]/10 text-[#16307A] font-mono text-[10px]',
    dayOn: 'w-6 h-5 rounded border border-[#1F3F8F]/40 bg-[#1F3F8F]/10 text-[#16307A] font-mono text-[10px]',
    dayOff: 'w-6 h-5 rounded border border-zinc-950/12 bg-slate-100 text-slate-400 font-mono text-[10px]',
    field: 'h-7 px-2 rounded-[4px] border border-zinc-950/15 bg-white flex items-center justify-between',
    fieldRO: 'h-7 px-2 rounded-[4px] border border-zinc-950/08 bg-slate-50 flex items-center font-mono text-[11px] tabular-nums text-slate-500'
  };

  // VIEW mode lists only the graphs a route actually feeds — a reader is being told
  // where this route appears, and five chips per row (four of them off) buries that
  // in noise at 340px. EDIT mode lists every discovered graph, because there the
  // chips are the assignment control and an unassigned graph has to be clickable.
  function chipsHtml(r, edit) {
    var out = ['<span class="' + C.label + ' mr-0.5">on</span>'];
    GRAPHS.filter(function (g) { return edit || r.graphs.indexOf(g.id) > -1; }).forEach(function (g) {
      var on = r.graphs.indexOf(g.id) > -1;
      var cls = on ? C.chipOn : (edit ? C.chipOff : C.chipOffRead);
      var title = edit ? (on ? 'Remove from ' + g.label : 'Add to ' + g.label) : (on ? 'On ' + g.label : g.label + ' — not assigned');
      // the check mark is a toggle state, so it only means something in edit mode —
      // in view mode every chip shown is already an "on"
      out.push('<button class="' + cls + '" data-act="chip" data-route="' + r.id + '" data-graph="' + g.id + '" title="' + esc(title) + '"' + (edit ? '' : ' disabled') + '>' +
        (on && edit ? I.check : '') + g.label.toLowerCase() + '</button>');
    });
    return out.join('');
  }

  // ── THE WINDOW BLOCK · three facets in the order the engine applies them ──────
  // DATES (which days) → DAYS (which of those count) → TIME OF DAY (which hours of
  // each one). Read that top to bottom and it describes the query; the old
  // "start date + start time / end date + end time" pairing described something the
  // tool has never done.
  function datesHtml(r, edit) {
    var editing = S.editingDates === r.id;
    var d = editing ? S.dateDraft : { start: r.start, end: r.end, weekdays: r.weekdays };
    var derived = !!r.derivedFrom;
    var copied = S.clip;

    var actions = '';
    if (edit && !derived) {
      actions = editing
        ? '<button class="size-6 rounded-[4px] border border-[#10B981]/40 bg-[#10B981]/10 flex items-center justify-center text-[#0f7a52]" data-act="dates-save" data-route="' + r.id + '" title="Save window">' + I.save + '</button>' +
          '<button class="size-6 rounded-[4px] border border-[#EF4444]/40 bg-[#EF4444]/10 flex items-center justify-center text-[#b91c1c]" data-act="dates-cancel" title="Cancel">' + I.cancel + '</button>'
        : '<button class="' + C.iconBtn + '" data-act="win-copy" data-route="' + r.id + '" title="Copy this window">' + I.copy + '</button>' +
          (copied && copied.from !== r.id
            ? '<button class="size-6 rounded flex items-center justify-center text-[#1F3F8F] hover:bg-[#1F3F8F]/10 shrink-0" data-act="win-paste" data-route="' + r.id + '" title="Paste the window copied from ' + esc(copied.fromName) + '">' + I.paste + '</button>'
            : '<button class="size-6 rounded flex items-center justify-center text-slate-200 cursor-not-allowed shrink-0" title="Copy a window from another route first" disabled>' + I.paste + '</button>') +
          '<button class="' + C.iconBtn + '" data-act="dates-edit" data-route="' + r.id + '" title="Edit window">' + I.pencil + '</button>';
    } else if (edit && derived && copied) {
      actions = '<span class="font-mono text-[9px] uppercase tracking-wider text-slate-400">derived</span>';
    }

    var head = '<div class="flex items-center justify-between gap-2">' +
      '<div class="' + C.label + '">window</div>' +
      '<div class="flex items-center gap-1">' + actions + '</div></div>' +
      (derived && edit ? '<div class="font-proxima text-[11px] italic text-slate-500 mt-1">Derived from ' + esc((byId(r.derivedFrom) || {}).name || 'another route') + ' — edit that route\'s window instead.</div>' : '');

    // ── read-only · three labelled lines, not four disabled inputs ──
    if (!editing) {
      var c = countDays(d.start, d.end, d.weekdays);
      var rows = [
        ['dates', fmtDateRange(d.start, d.end), c ? c.kept + ' of ' + c.all + ' days' : null],
        ['days', daysLabel(d.weekdays), null],
        ['time', timeOfDayLabel(d), timePart(d.start) && timePart(d.end) ? 'each day' : 'no filter']
      ];
      // the summary is also the affordance: clicking it opens the editor, so the pencil
      // is a shortcut rather than the only door
      var opener = edit && !derived;
      return '<div>' + head +
        '<div class="mt-1.5 space-y-1' + (opener ? ' cursor-pointer group/win rounded-[4px] -mx-1 px-1 py-0.5 hover:bg-[#1F3F8F]/5' : '') + '"' +
        (opener ? ' data-act="dates-edit" data-route="' + r.id + '" title="Edit this window"' : '') + '>' + rows.map(function (row) {
          return '<div class="flex items-baseline gap-2">' +
            '<span class="w-[34px] shrink-0 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-400">' + row[0] + '</span>' +
            '<span class="font-proxima text-[12px] text-slate-700 flex-1 min-w-0">' + esc(row[1]) +
            (row[2] ? '<span class="text-slate-400"> · ' + esc(row[2]) + '</span>' : '') + '</span>' +
            '</div>';
        }).join('') + '</div>' +
        (timePart(d.start) && timePart(d.end)
          ? '<div class="mt-1.5 font-proxima text-[11px] leading-[1.4] text-slate-500">Every day’s ' + esc(timePart(d.start) + '–' + timePart(d.end)) + ' is averaged together.</div>'
          : '') +
        '</div>';
    }

    // ── editing · one facet per sub-block ──
    var c2 = countDays(d.start, d.end, d.weekdays);
    var issues = windowIssues(d);
    var dateField = function (which, label) {
      return '<div class="flex-1 min-w-0"><label class="font-proxima text-[10px] font-semibold text-slate-500 block mb-0.5">' + label + '</label>' +
        '<input type="date" value="' + esc(datePart(d[which])) + '" data-act="date-in" data-route="' + r.id + '" data-which="' + which + '" class="w-full h-7 px-1.5 rounded-[4px] border border-zinc-950/15 bg-white font-mono text-[11px] tabular-nums text-[#0f1722] focus:outline-none focus:border-[#1F3F8F]"/></div>';
    };
    var timeField = function (which, label) {
      return '<div class="flex-1 min-w-0"><label class="font-proxima text-[10px] font-semibold text-slate-500 block mb-0.5">' + label + '</label>' +
        '<input type="time" value="' + esc(timePart(d[which])) + '" data-act="time-in" data-route="' + r.id + '" data-which="' + which + '" class="w-full h-7 px-1.5 rounded-[4px] border border-zinc-950/15 bg-white font-mono text-[11px] tabular-nums text-[#0f1722] focus:outline-none focus:border-[#1F3F8F]"/></div>';
    };

    return '<div>' + head +

      // 1 · DATES
      '<div class="mt-2">' +
      '<div class="flex items-baseline gap-2 mb-1"><span class="' + C.label + '">dates</span>' +
      '<span class="font-proxima text-[10.5px] text-slate-400 flex-1">which days</span>' +
      (c2 ? '<span class="font-mono text-[9.5px] uppercase tracking-[0.12em] text-slate-400 tabular-nums">' + c2.kept + ' of ' + c2.all + ' days</span>' : '') + '</div>' +
      '<div class="flex items-end gap-1.5">' + dateField('start', 'From') +
      '<span class="pb-1.5 text-slate-300">→</span>' + dateField('end', 'To') + '</div>' +
      // shift the whole span, keeping its length — the before/after move, and the one
      // place a hand-typed date range reliably goes wrong (off-by-a-day, wrong leap year)
      '<div class="mt-1.5 flex items-center gap-1">' +
      '<span class="font-proxima text-[10.5px] text-slate-400 mr-0.5">shift</span>' +
      '<button class="' + C.pill + '" data-act="shift" data-route="' + r.id + '" data-years="-1" title="Same span, one year earlier">− 1 year</button>' +
      '<button class="' + C.pill + '" data-act="shift" data-route="' + r.id + '" data-years="1" title="Same span, one year later">+ 1 year</button>' +
      '<span class="font-proxima text-[10.5px] text-slate-400 ml-auto">keeps the length</span>' +
      '</div></div>' +

      // 2 · DAYS
      '<div class="mt-2.5">' +
      '<div class="flex items-baseline gap-2 mb-1"><span class="' + C.label + '">days</span>' +
      '<span class="font-proxima text-[10.5px] text-slate-400 flex-1">which of those count</span></div>' +
      '<div class="flex flex-wrap items-center gap-1">' +
      DOW.map(function (dd) {
        var on = dayOn(d.weekdays, dd[0]);
        return '<button class="' + (on ? C.dayOn : C.dayOff) + '" data-act="dow" data-route="' + r.id + '" data-day="' + dd[0] + '" title="' + dd[0] + (on ? ' included — click to exclude' : ' excluded — click to include') + '">' + dd[1] + '</button>';
      }).join('') +
      '<span class="w-1"></span>' +
      '<button class="' + C.pill + '" data-act="dow-set" data-route="' + r.id + '" data-set="weekdays">Weekdays</button>' +
      '<button class="' + C.pill + '" data-act="dow-set" data-route="' + r.id + '" data-set="weekends">Weekends</button>' +
      '<button class="' + C.pill + '" data-act="dow-set" data-route="' + r.id + '" data-set="all">All</button>' +
      '</div></div>' +

      // 3 · TIME OF DAY — the facet the old pairing misrepresented, so it says what it does
      '<div class="mt-2.5 pt-2.5 border-t border-zinc-950/05">' +
      '<div class="flex items-baseline gap-2 mb-1"><span class="' + C.label + '">time of day</span>' +
      '<span class="font-proxima text-[10.5px] text-slate-400 flex-1">which hours of each day</span></div>' +
      '<div class="flex items-end gap-1.5">' + timeField('start', 'From') +
      '<span class="pb-1.5 text-slate-300">→</span>' + timeField('end', 'To') + '</div>' +
      '<div class="mt-1.5 flex flex-wrap items-center gap-1">' +
      PEAK_PRESETS.map(function (p) {
        var on = timePart(d.start) === p.s && timePart(d.end) === p.e;
        // the hours are ON the pill: "AM Peak" alone makes you hover to learn that this
        // brand means 06:00–10:00, and two of the five presets differ only by their hours
        return '<button class="' + (on ? C.pillOn : C.pill) + ' inline-flex items-baseline gap-1" data-act="preset" data-route="' + r.id + '" data-preset="' + esc(p.label) + '" title="' + esc(p.s ? p.s + '–' + p.e : 'no time filter') + '">' + esc(p.label) +
          '<span class="' + (on ? 'text-[#1F3F8F]/70' : 'text-slate-400') + ' text-[9px] tabular-nums">' + esc(p.s ? p.s.replace(':00', '') + '–' + p.e.replace(':00', '') : '·') + '</span></button>';
      }).join('') + '</div>' +
      '<div class="mt-1.5 font-proxima text-[11px] leading-[1.4] text-slate-500">' +
      (timePart(d.start) && timePart(d.end)
        ? 'Applied to <strong>every day</strong> in the range and averaged together — not one continuous stretch from the first day to the last.'
        : 'No time filter: every hour of every day in the range is included.') +
      '</div></div>' +

      (issues.length
        ? '<div class="mt-2 space-y-1">' + issues.map(function (i) {
          return '<div data-issue="' + i.level + '" class="rounded-[4px] px-2 py-1.5 font-proxima text-[11px] leading-[1.4] ' +
            (i.level === 'error' ? 'bg-[#EF4444]/8 border border-[#EF4444]/25 text-[#b91c1c]' : 'bg-[#FACC15]/12 border border-[#CA8A04]/25 text-[#8a5f03]') + '">' + i.text + '</div>';
        }).join('') + '</div>'
        : '') +
      '</div>';
  }

  // IDENTITY COLOUR · a popover on the row's own dot, not a block inside the open-out.
  // Inline, it was doubly buried — you had to expand the route AND click "change" — for a
  // control whose whole job is "this route is blue everywhere". Anchored to the dot it is
  // one click from a collapsed row, which is where you are when you notice two routes are
  // hard to tell apart on a chart.
  // Rendered into a FIXED element outside the rail: the rows region scrolls and the sticky
  // wrapper is overflow-hidden, so anything absolutely positioned inside a row gets
  // clipped. Same reason the shared Popup primitive portals.
  function colourPop() {
    var el = $('#colour-pop');
    var r = S.picking ? byId(S.picking) : null;
    if (!r) { el.classList.add('hidden'); return; }
    var dot = $('[data-act="pick-toggle"][data-route="' + r.id + '"]');
    if (!dot) { S.picking = null; el.classList.add('hidden'); return; }
    var box = dot.getBoundingClientRect();
    el.innerHTML =
      '<div class="flex items-center gap-2 mb-2">' +
      '<span class="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500 flex-1">identity colour</span>' +
      '<span class="font-mono text-[10.5px] tabular-nums text-slate-500">' + esc(r.color) + '</span>' +
      '<button class="size-4 rounded flex items-center justify-center text-slate-400 hover:text-slate-700" data-act="pick-close" title="Close">' + I.x + '</button></div>' +
      '<div class="grid grid-cols-9 gap-1">' +
      PALETTE.map(function (c) {
        var on = c.toLowerCase() === r.color.toLowerCase();
        return '<button class="size-4 rounded-full' + (on ? ' ring-2 ring-offset-1 ring-[#0f1722]/50' : ' hover:ring-2 hover:ring-offset-1 hover:ring-[#0f1722]/20') + '" style="background:' + c + '" data-act="colour" data-route="' + r.id + '" data-colour="' + c + '" title="' + c + '"></button>';
      }).join('') +
      '</div>' +
      '<div class="mt-2 pt-2 border-t border-zinc-950/05 font-proxima text-[11px] leading-[1.4] text-slate-500">Used by every graph this route feeds, so a reader learns the key once.</div>' +
      '<div class="mt-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-slate-400">getColorRange(20, div7)</div>';
    el.classList.remove('hidden');
    // flip above the dot when there isn't room below
    var h = el.offsetHeight, w = el.offsetWidth;
    var top = box.bottom + 6, left = box.left - 8;
    if (top + h > window.innerHeight - 8) top = Math.max(8, box.top - h - 6);
    if (left + w > window.innerWidth - 8) left = window.innerWidth - w - 8;
    el.style.top = top + 'px';
    el.style.left = left + 'px';
  }

  function openOutHtml(r, edit) {
    // NO TMC LIST (2026-08-05). It used to lead the open-out with nine codes and a
    // "+3 more" toggle: the widest content in a 340px panel, and nobody identifies a
    // route by reading `120P29714` off a rail — the count in the meta line is the
    // useful part and the map card is where the extent actually lives.
    // NO INLINE COLOUR either — it is a popover on the row's own dot now, so it is
    // reachable without opening the route at all. See colourPop().
    // FULL WIDTH of the row (2026-08-05). The open-out used to be indented to the route
    // name's left edge — a nice alignment cue that cost ~52 of 340 px, which is most of
    // what the date and time fields were short of. The block is a bordered card, so it
    // doesn't need the indent to read as belonging to the row above it.
    return '<div class="mt-2 rounded-[6px] border border-zinc-950/08 bg-white p-2.5 space-y-3">' +
      datesHtml(r, edit) +
      '<div class="pt-2.5 border-t border-zinc-950/05 flex flex-wrap items-center gap-1">' + chipsHtml(r, edit) + '</div>' +
      (edit ? '<div class="pt-2.5 border-t border-zinc-950/05 flex justify-end">' +
        '<button class="h-7 px-2 inline-flex items-center gap-1.5 rounded-[6px] border border-[#EF4444]/40 bg-[#EF4444]/5 text-[#b91c1c] hover:bg-[#EF4444]/10" data-act="inert" data-what="remove">' +
        I.trash + '<span class="font-display uppercase text-[10.5px] tracking-wide">Remove route from report</span></button></div>' : '') +
      '</div>';
  }

  function rowHtml(r) {
    var edit = LIVE;                     // per-route controls: always
    var open = !!S.expanded[r.id];
    var renaming = S.editingName === r.id;
    var unused = !r.graphs.length;

    if (renaming) {
      return '<div class="px-2 py-2.5 bg-[#1F3F8F]/5" data-row="' + r.id + '">' +
        '<div class="flex items-center gap-1.5 min-w-0">' +
        '<span class="size-3.5 rounded-full shrink-0" style="background:' + esc(r.color) + '"></span>' +
        '<input value="' + esc(S.nameDraft) + '" data-act="name-in" class="flex-1 min-w-0 h-8 px-2 rounded-[6px] border border-[#1F3F8F] bg-white ring-2 ring-[#1F3F8F]/15 font-proxima text-[12.5px] text-slate-700 focus:outline-none" autofocus/>' +
        '<button class="size-7 rounded-[6px] border border-[#10B981]/40 bg-[#10B981]/10 flex items-center justify-center text-[#0f7a52] shrink-0" data-act="name-save" data-route="' + r.id + '" title="Save">' + I.save + '</button>' +
        '<button class="size-7 rounded-[6px] border border-[#EF4444]/40 bg-[#EF4444]/10 flex items-center justify-center text-[#b91c1c] shrink-0" data-act="name-cancel" title="Cancel">' + I.cancel + '</button>' +
        '</div></div>';
    }

    var reorder = edit
      ? '<span class="flex flex-col shrink-0 mt-0.5">' +
        '<button class="size-4 flex items-center justify-center ' + (routes.indexOf(r) === 0 ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-slate-700') + '" data-act="move" data-route="' + r.id + '" data-dir="up" title="Move up"' + (routes.indexOf(r) === 0 ? ' disabled' : '') + '>' + I.caretUp + '</button>' +
        '<button class="size-4 flex items-center justify-center ' + (routes.indexOf(r) === routes.length - 1 ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-slate-700') + '" data-act="move" data-route="' + r.id + '" data-dir="down" title="Move down"' + (routes.indexOf(r) === routes.length - 1 ? ' disabled' : '') + '>' + I.caretDown + '</button></span>'
      : '';

    var dot = edit
      ? '<button class="size-3.5 mt-1 rounded-full ring-1 ring-[#0f1722]/20 shrink-0 hover:ring-2 hover:ring-[#1F3F8F]/40" style="background:' + esc(r.color) + '" data-act="pick-toggle" data-route="' + r.id + '" title="Identity colour ' + esc(r.color) + ' — click to change"></button>'
      : '<span class="size-3 mt-1 rounded-full shrink-0" style="background:' + esc(r.color) + '" title="' + esc(r.color) + '"></span>';

    // The meta line and chips keep a small indent so the row still reads name-first,
    // but no longer align to the name's left edge: at 52px the meta ("9 TMC · 2.0 mi ·
    // 2025-01-06 → 2025-02-28") wrapped its last two characters, and now that the
    // open-out below it is full width there is nothing left to align to anyway.
    var indent = 'pl-7';
    var rowActions = edit
      ? '<button class="' + C.iconBtn + '" data-act="name-edit" data-route="' + r.id + '" title="Edit name">' + I.pencil + '</button>' +
        '<button class="' + C.dangerBtn + '" data-act="inert" data-what="remove" title="Remove route from report">' + I.trash + '</button>'
      : '';

    return '<div class="' + (open ? C.rowOpen : C.rowBase) + '" data-row="' + r.id + '">' +
      '<div class="flex items-start gap-1 min-w-0">' + reorder +
      '<button class="' + (open ? C.expanderOpen : C.expander) + '" data-act="expand" data-route="' + r.id + '" title="' + (open ? 'Collapse' : 'Expand') + '">' + (open ? '−' : '+') + '</button>' +
      dot +
      '<div class="min-w-0 flex-1 flex items-center gap-1">' +
      '<span class="' + C.name + ' flex-1 min-w-0" title="' + esc(r.title) + '">' + esc(r.name) + '</span>' +
      (unused ? '<span class="h-5 px-1.5 inline-flex items-center rounded bg-[#E5A646]/20 text-[#8a5f03] font-mono text-[9.5px] uppercase tracking-wider shrink-0">unused</span>' : '') +
      rowActions + '</div></div>' +
      // Meta and chips sit at ROW level, not inside the name column: at 340px the
      // reorder carets + expander + dot ate enough width that "9 TMC · 2.0 mi ·
      // 2025-01-06 → 2025-02-28" wrapped onto a second line in edit mode. Indented
      // to the name's left edge instead, which reads the same and fits.
      '<div class="' + indent + ' ' + C.meta + '">' + esc(metaLine(r)) + '</div>' +
      (open ? '' : '<div class="' + indent + ' mt-1.5 flex flex-wrap items-center gap-1">' +
        (unused ? '<span class="font-proxima text-[11.5px] text-slate-500">Not on any graph yet.</span>' : chipsHtml(r, edit)) + '</div>') +
      (open ? openOutHtml(r, edit) : '') +
      '</div>';
  }

  // ── Rail render ──────────────────────────────────────────────────────────
  function visibleRoutes() {
    var q = S.query.trim().toLowerCase();
    return routes.filter(function (r) { return !q || r.name.toLowerCase().indexOf(q) > -1; });
  }

  // THE RAIL'S PER-ROUTE CONTROLS ARE ALWAYS LIVE (Alex, 2026-08-05). They used to
  // follow page edit mode, which — once the rail's own edit toggle was removed — meant
  // opening a route showed a read-only summary with no way in: the window, the colour,
  // the assignment and the name were all there and none of them could be touched
  // without finding the Edit button in the page header first. Same argument as the two
  // Add buttons: this panel IS the report's control surface, so its controls are
  // controls. `LIVE` marks every place that decision is applied.
  //   What page edit mode still governs: the canvas chrome (section toolbars + the
  //   Measure Picker) and the Dynamic Report switch — those change the PAGE, not the
  //   report's routes.
  //   Component escalation, same shape as the Add buttons: the gate moves from "hide the
  //   control" to "the first edit enters edit mode". A reader without edit permission
  //   still gets the read-only rail the component renders for them — that state exists,
  //   it just isn't what an author with the pencil sees.
  var LIVE = true;

  function renderRail() {
    var edit = S.mode === 'edit';
    document.documentElement.setAttribute('data-report-mode', S.mode);

    // The action row is ALWAYS present (Add Route / Add Graph are the report's two
    // jobs); it just carries the mode — white in view, amber while editing.
    $('#rail-actions').className = edit
      ? 'px-3 py-2.5 border-b border-[#FACC15]/40 bg-[#FACC15]/15 flex items-center gap-2 shrink-0'
      : 'px-3 py-2.5 border-b border-zinc-950/08 bg-slate-50 flex items-center gap-2 shrink-0';
    // page edit mode, not route editing — the routes are always editable now
    $('#rail-mode-note').textContent = edit ? 'page edit' : '';
    $('#rail-mode-note').className = edit
      ? 'ml-auto font-mono text-[9.5px] uppercase tracking-[0.16em] text-[#8a5f03] shrink-0'
      : 'ml-auto font-mono text-[9.5px] uppercase tracking-[0.16em] text-slate-400 shrink-0';
    // Dynamic Report stays edit-only: it reconfigures the page, not the route list.
    $('#rail-dynamic').classList.toggle('hidden', !edit);

    // the copied-window strip · follows the clipboard, not page edit mode: windows are
    // always editable now, so gating the strip left a copied window with nowhere to go
    var clipOn = !!S.clip;
    $('#rail-clip').classList.toggle('hidden', !clipOn);
    if (clipOn) {
      var d = S.clip;
      var others = routes.filter(function (r) { return r.id !== d.from && !r.derivedFrom; }).length;
      $('#rail-clip').innerHTML =
        '<div class="flex items-center gap-2">' +
        '<span class="text-[#1F3F8F] shrink-0">' + I.copy + '</span>' +
        '<span class="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500 flex-1 min-w-0 truncate">window copied · ' + esc(d.fromName) + '</span>' +
        '<button class="size-5 rounded flex items-center justify-center text-slate-400 hover:text-slate-700 shrink-0" data-act="win-clip-clear" title="Forget the copied window">' + I.x + '</button>' +
        '</div>' +
        '<div class="font-proxima text-[11.5px] text-slate-700 mt-1">' + esc(fmtDateRange(d.start, d.end)) + ' · ' + esc(daysLabel(d.weekdays).split(' · ')[0]) + ' · ' + esc(timeOfDayLabel(d)) + '</div>' +
        (others ? '<button class="mt-1.5 h-6 px-2 inline-flex items-center gap-1 rounded-[4px] border border-[#1F3F8F]/30 bg-white hover:bg-[#1F3F8F]/5 font-mono text-[9.5px] uppercase tracking-wider text-[#1F3F8F]" data-act="win-paste-all">' + I.paste + 'paste into all (' + others + ')</button>' : '');
    }
    $('#rail-body').classList.toggle('hidden', S.collapsed);
    $('#rail-collapse').innerHTML = S.collapsed
      ? '<svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m19.5 8.25-7.5 7.5-7.5-7.5"/></svg>'
      : '<svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m4.5 15.75 7.5-7.5 7.5 7.5"/></svg>';
    $('#rail-count').textContent = routes.length;

    // Dynamic Report: the add-route control becomes a slot control, because a
    // slot is a placeholder — there is no catalogue to browse for one.
    $('#dyn-knob').className = S.dynamic
      ? 'absolute top-0.5 left-[14px] size-3.5 rounded-full bg-white shadow transition-all'
      : 'absolute top-0.5 left-0.5 size-3.5 rounded-full bg-white shadow transition-all';
    $('#dyn-track').className = S.dynamic
      ? 'w-8 h-[18px] rounded-full bg-[#1F3F8F] relative shrink-0'
      : 'w-8 h-[18px] rounded-full bg-slate-300 relative shrink-0';
    $('#dyn-state').textContent = S.dynamic ? 'on' : 'off';
    $('#btn-add-route-label').textContent = S.dynamic ? 'Add route slot' : 'Add route';
    $('#rail-dyn-note').classList.toggle('hidden', !S.dynamic);

    var list = visibleRoutes();
    var html = list.map(rowHtml).join('');
    if (!routes.length) {
      html = '<div class="px-3 py-4 text-center font-proxima text-[12.5px] italic text-slate-500">No routes added — add one above.</div>';
    } else if (!list.length) {
      html = '<div class="px-3 py-3 font-proxima text-[12.5px] italic text-slate-500">No routes match “' + esc(S.query) + '”.</div>';
    }
    $('#route-rows').innerHTML = html;

    $('#rail-error').classList.toggle('hidden', !S.error);
    $('#rail-error').textContent = S.error || '';
    $('#rail-clear').classList.toggle('hidden', !S.query);

    colourPop();

    var tmc = routes.reduce(function (a, r) { return a + r.tmcs.length; }, 0);
    var mi = routes.reduce(function (a, r) { return a + parseFloat(r.miles); }, 0);
    $('#rail-totals').textContent = routes.length + ' routes · ' + tmc + ' TMC · ' + mi.toFixed(1) + ' mi';

    renderCanvasChrome();
  }

  // THE CARDS DELIBERATELY DO NOT MOVE (Alex, 2026-08-05). In the product a route's
  // window, colour and assignment publish to every graph it feeds (setActionParam → the
  // graph refetches) and the cards redraw. An earlier version of this file simulated a
  // slice of that — legends built from assignment, plotted series recoloured, each card's
  // attribution rewritten to the new window, a brief "updating" flash. It was reverted:
  // this page has no data behind it, so anything that made a card look refreshed implied
  // numbers that had not changed and could not change. The graphs here stay the drawings
  // they are; what this page is for is the CONTROLS — how a window actually gets chosen.
  // The binding itself is documented in § 03 and in the page's header comment.

  // Edit-mode canvas chrome: the section toolbar over every canvas section, and
  // the Measure Picker inside the graph card that owns it. Injected rather than
  // written into the page four times — same reason as the rows.
  // The section's card is the child that ISN'T the injected toolbar and carries card
  // chrome. `firstElementChild` looked right and was wrong: once the bar is inserted
  // it becomes the first child, so leaving edit mode removed the bar but left the
  // amber ring and the squared top corner on the real card underneath.
  function cardOf(sec) {
    return Array.prototype.filter.call(sec.children, function (c) {
      return !c.hasAttribute('data-edit-bar') && /rounded/.test(c.className || '') && /border|bg-white|bg-white\/60/.test(c.className || '');
    })[0];
  }

  function renderCanvasChrome() {
    var edit = S.mode === 'edit';
    $$('#report-canvas [data-dms-section]').forEach(function (sec) {
      var card = cardOf(sec);
      var bar = sec.querySelector('[data-edit-bar]');
      if (!edit) {
        if (bar) bar.remove();
        if (card) card.classList.remove('ring-2', 'ring-[#FACC15]', 'rounded-t-none');
        var mp = sec.querySelector('[data-measure-picker]');
        if (mp) mp.remove();
        return;
      }
      if (!card) return;
      card.classList.add('ring-2', 'ring-[#FACC15]');
      if (!bar) {
        var name = sec.getAttribute('data-dms-section');
        var kind = sec.getAttribute('data-edit-kind') || 'Section';
        var size = sec.getAttribute('data-edit-size') || '';
        bar = document.createElement('div');
        bar.setAttribute('data-edit-bar', '');
        bar.className = 'h-8 px-2 flex items-center gap-1.5 rounded-t-[8px] border border-b-0 border-[#FACC15] bg-[#FACC15]/15 -mb-px';
        bar.innerHTML = '<svg class="size-3.5 text-[#8a5f03] cursor-grab" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>' +
          '<span class="font-mono text-[9.5px] uppercase tracking-[0.18em] text-[#8a5f03] flex-1 truncate">' + esc(kind + (size ? ' · size ' + size : '')) + '</span>' +
          (sec.hasAttribute('data-measure') ? '<button class="h-5 px-1.5 inline-flex items-center rounded bg-white border border-[#E5A646]/40 font-mono text-[9.5px] uppercase tracking-wider text-[#8a5f03]" data-act="measure-toggle" data-section="' + esc(name) + '">measure</button>' : '') +
          '<button class="h-5 px-1.5 inline-flex items-center rounded bg-white border border-[#E5A646]/40 font-mono text-[9.5px] uppercase tracking-wider text-[#8a5f03]" data-act="inert" data-what="settings">settings</button>' +
          '<button class="h-5 px-1.5 inline-flex items-center rounded bg-white border border-[#E5A646]/40 font-mono text-[9.5px] uppercase tracking-wider text-[#8a5f03]" data-act="inert" data-what="duplicate">duplicate</button>' +
          '<button class="size-5 rounded flex items-center justify-center text-[#8a5f03] hover:bg-white/60" data-act="inert" data-what="menu">' + I.more + '</button>';
        sec.insertBefore(bar, card);
        card.classList.add('rounded-t-none');
      }
    });
  }

  var measurePick = { graphType: 'LineGraph', measure: 'travelTime', resolution: 'hour', comparisonMode: 'plain' };
  function selectHtml(opts, value, act) {
    return '<select data-act="' + act + '" class="w-full h-8 px-2 rounded-[6px] border border-zinc-950/10 bg-white font-proxima text-[12px] text-[#0f1722] focus:outline-none focus:border-[#1F3F8F]">' +
      opts.map(function (o) { return '<option value="' + o.value + '"' + (o.value === value ? ' selected' : '') + '>' + esc(o.label) + '</option>'; }).join('') + '</select>';
  }
  function toggleMeasurePicker(sectionName) {
    var sec = $('#report-canvas [data-dms-section="' + sectionName + '"]');
    if (!sec) return;
    var existing = sec.querySelector('[data-measure-picker]');
    if (existing) { existing.remove(); return; }
    // Under the card's title row, which is where the section menu opens it — NOT
    // sec.firstElementChild, which is the injected edit bar (see cardOf).
    var card = cardOf(sec);
    if (!card) return;
    var box = document.createElement('div');
    box.setAttribute('data-measure-picker', '');
    box.className = 'px-4 py-3 bg-slate-50 border-b border-zinc-950/05';
    box.innerHTML = '<div class="flex items-center gap-2 mb-2"><div class="font-mono text-[9.5px] uppercase tracking-[0.18em] text-slate-500 flex-1">measure picker</div>' +
      '<button class="font-mono text-[9.5px] uppercase tracking-wider text-slate-500 hover:text-slate-800" data-act="measure-toggle" data-section="' + esc(sectionName) + '">close</button></div>' +
      '<div class="grid grid-cols-2 gap-2">' +
      '<div><div class="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-400 mb-1">graph type</div>' + selectHtml(GRAPH_TYPES, measurePick.graphType, 'mp-graphType') + '</div>' +
      '<div><div class="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-400 mb-1">measure</div>' + selectHtml(MEASURES, measurePick.measure, 'mp-measure') + '</div>' +
      '<div><div class="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-400 mb-1">resolution</div>' + selectHtml(RESOLUTIONS, measurePick.resolution, 'mp-resolution') + '</div>' +
      '<div><div class="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-400 mb-1">comparison mode</div>' + selectHtml(COMPARISON_MODES, measurePick.comparisonMode, 'mp-comparisonMode') + '</div>' +
      '</div>' +
      '<p class="font-proxima text-[11.5px] leading-[1.45] text-slate-500 mt-2" data-measure-summary></p>';
    card.insertBefore(box, card.children[1] || null);   // after the card's header row
    updateMeasureSummary();
  }
  function updateMeasureSummary() {
    $$('[data-measure-summary]').forEach(function (el) {
      var m = MEASURES.filter(function (o) { return o.value === measurePick.measure; })[0] || {};
      var g = GRAPH_TYPES.filter(function (o) { return o.value === measurePick.graphType; })[0] || {};
      var res = RESOLUTIONS.filter(function (o) { return o.value === measurePick.resolution; })[0] || {};
      var cm = COMPARISON_MODES.filter(function (o) { return o.value === measurePick.comparisonMode; })[0] || {};
      el.innerHTML = esc(m.label + ' as a ' + g.label + ', ' + res.label.toLowerCase() + ' resolution, ' + cm.label.toLowerCase() + ' mode') +
        ' — each pick composes <span class="tny-mono">columns</span>, <span class="tny-mono">join</span> and <span class="tny-mono">display</span> into this section\'s draft state. The plot above is a still drawing and does not redraw.';
    });
  }

  // ── Add Routes modal (RouteTagBrowserModal) ──────────────────────────────
  var M1 = { open: false, view: 'root', cat: null, value: null, q: '', catQ: '', otherQ: '', selected: {} };

  function catalogResults() {
    if (M1.view === 'root') {
      var q = M1.q.trim().toLowerCase();
      var list = CATALOG.filter(function (r) { return !q || r.name.toLowerCase().indexOf(q) > -1; });
      // The unscoped default list hides routes already on the report (it is a
      // suggestion list); any deliberate view shows them, flagged.
      if (!q) return list.filter(function (r) { return ON_REPORT_CATALOG_IDS.indexOf(r.id) < 0; }).slice(0, 8);
      return list;
    }
    if (M1.view === 'value') {
      var v = M1.value.value, q2 = M1.q.trim().toLowerCase();
      return CATALOG.filter(function (r) { return r.tags.indexOf(v) > -1 && (!q2 || r.name.toLowerCase().indexOf(q2) > -1); });
    }
    if (M1.view === 'other') {
      var t = M1.otherQ.trim().toLowerCase();
      if (!t) return null;
      return CATALOG.filter(function (r) {
        return r.tags.some(function (tag) { return tag.toLowerCase().indexOf(t) > -1 && tag.indexOf('county:') !== 0 && tag.indexOf('region:') !== 0 && tag.indexOf('agency:') !== 0; });
      });
    }
    return [];
  }

  function renderM1() {
    $('#modal-routes').classList.toggle('hidden', !M1.open);
    if (!M1.open) return;
    var selIds = Object.keys(M1.selected);
    var atRoot = M1.view === 'root';

    // where you are · hidden at the root, because "all routes" alone is noise
    $('#m1-crumbs').classList.toggle('hidden', atRoot);
    $('#m1-crumbs').classList.toggle('flex', !atRoot);
    if (!atRoot) {
      var crumbs = ['<button class="text-slate-500 hover:text-[#1F3F8F]" data-act="m1-root">all routes</button>'];
      if (M1.cat) crumbs.push('<span class="text-slate-300">/</span><button class="' + (M1.view === 'category' ? 'text-[#0f1722] font-semibold' : 'text-slate-500 hover:text-[#1F3F8F]') + '" data-act="m1-cat" data-cat="' + M1.cat.key + '">' + esc(M1.cat.label.toLowerCase()) + '</button>');
      if (M1.view === 'other') crumbs.push('<span class="text-slate-300">/</span><span class="text-[#0f1722] font-semibold">other tags</span>');
      if (M1.view === 'value' && M1.value) crumbs.push('<span class="text-slate-300">/</span><span class="text-[#0f1722] font-semibold">' + esc(M1.value.label.toLowerCase()) + '</span>');
      $('#m1-crumbs').innerHTML = crumbs.join('');
    }

    // what you've picked · its own block, capped in height, with a way out
    $('#m1-selected').classList.toggle('hidden', !selIds.length);
    $('#m1-selected-label').textContent = selIds.length + (selIds.length === 1 ? ' route to add' : ' routes to add');
    $('#m1-chips').innerHTML = selIds.map(function (id) {
      var r = M1.selected[id];
      return '<span class="h-6 pl-2 pr-1 inline-flex items-center gap-1 rounded-full border border-[#1F3F8F]/30 bg-[#1F3F8F]/8 max-w-[260px]">' +
        '<span class="font-proxima text-[11.5px] text-[#16307A] truncate">' + esc(r.name) + '</span>' +
        '<button class="size-4 rounded-full flex items-center justify-center text-[#1F3F8F]/60 hover:text-[#1F3F8F]" data-act="m1-unpick" data-id="' + id + '" title="Remove">' + I.x + '</button></span>';
    }).join('');

    // browse pills · the three real axes, plus the two edge doors as text. The active
    // axis is marked, so the pills read as "where am I" as well as "go here".
    $('#m1-browse').innerHTML =
      TAG_CATEGORIES.map(function (c) {
        var on = M1.cat && M1.cat.key === c.key;
        return '<button data-act="m1-cat" data-cat="' + c.key + '" class="h-7 px-2 inline-flex items-center gap-1.5 rounded-[6px] border font-display uppercase text-[11px] tracking-wide ' +
          (on ? 'border-[#1F3F8F] bg-[#1F3F8F]/8 text-[#16307A]' : 'border-zinc-950/12 bg-white text-slate-600 hover:border-[#37576B]') + '">' +
          esc(c.label) + '<span class="font-mono text-[9.5px] tracking-normal ' + (on ? 'text-[#1F3F8F]/70' : 'text-slate-400') + ' tabular-nums">' + c.values.length + '</span></button>';
      }).join('') +
      '<span class="font-proxima text-[11.5px] text-slate-400 ml-1">also ' +
      '<button class="tny-link" data-act="m1-auto">auto-generated</button> · ' +
      '<button class="tny-link" data-act="m1-other">other tags</button></span>';

    // the search box only ever searches names
    // (tags have their own door), so its placeholder no longer changes per view
    $('#m1-search').placeholder = M1.view === 'category' ? 'Filter ' + M1.cat.label.toLowerCase() + '…'
      : M1.view === 'other' ? 'Type a tag (e.g. a project number)…'
      : M1.view === 'value' ? 'Search within this tag…' : 'Search routes by name…';
    var term = M1.view === 'category' ? M1.catQ : (M1.view === 'other' ? M1.otherQ : M1.q);
    if ($('#m1-search').value !== term) $('#m1-search').value = term;
    $('#m1-search-clear').classList.toggle('hidden', !term);

    var body = '';
    if (M1.view === 'category') {
      var q = M1.catQ.trim().toLowerCase();
      var vals = M1.cat.values.filter(function (v) { return !q || v.label.toLowerCase().indexOf(q) > -1; });
      body = '<div class="font-mono text-[9.5px] uppercase tracking-[0.18em] text-slate-500 mb-2">' + esc(M1.cat.label) + ' · ' + vals.length + ' of ' + M1.cat.values.length + '</div>' +
        (vals.length
          ? '<div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5">' + vals.map(function (v) {
            return '<button class="w-full text-left px-2.5 py-2 rounded-[6px] border border-zinc-950/10 bg-slate-50 hover:bg-slate-100 hover:border-[#37576B] font-proxima text-[13px] text-slate-700 truncate" data-act="m1-value" data-value="' + esc(v.value) + '" data-label="' + esc(v.label) + '">' + esc(v.label) + '</button>';
          }).join('') + '</div>'
          : '<div class="font-proxima text-[13px] italic text-slate-500">No values match “' + esc(M1.catQ) + '”.</div>');
    } else {
      var res = catalogResults();
      if (res === null) {
        body = '<div class="font-proxima text-[13px] italic text-slate-500">Type a tag to search. Free text, so a project number like <span class="tny-mono">pin:8756.41</span> works.</div>';
      } else {
        var head = atRoot
          ? (M1.q.trim()
            ? res.length + (res.length === 1 ? ' route matches' : ' routes match') + ' “' + esc(M1.q.trim()) + '”'
            : 'recently used · ' + res.length + ' of ' + CATALOG.length + ' routes')
          : res.length + (res.length === 1 ? ' route' : ' routes') + ' tagged ' + esc((M1.value && M1.value.label) || M1.otherQ);
        body = '<div class="font-mono text-[9.5px] uppercase tracking-[0.18em] text-slate-500 mb-2">' + head + '</div>' +
          (res.length ? routeListHtml(res) : '<div class="font-proxima text-[13px] italic text-slate-500">No routes found.</div>');
      }
    }
    $('#m1-body').innerHTML = body;

    $('#m1-count').textContent = selIds.length ? selIds.length + (selIds.length === 1 ? ' route selected' : ' routes selected') : 'nothing selected';
    $('#m1-confirm').textContent = 'Add ' + (selIds.length || '') + ' Route' + (selIds.length === 1 ? '' : 's');
    $('#m1-confirm').disabled = !selIds.length;
    $('#m1-confirm').className = selIds.length
      ? 'tny-press h-9 px-4 inline-flex items-center gap-2 rounded-[6px] bg-[#1F3F8F] text-white border-b-4 border-[#16306e] font-display uppercase text-[12.5px] tracking-wide'
      : 'h-9 px-4 inline-flex items-center gap-2 rounded-[6px] bg-slate-200 text-slate-400 font-display uppercase text-[12.5px] tracking-wide cursor-not-allowed';
  }

  // A row has to say what the route IS: two catalogue routes can share a name stem and
  // differ only by extent, so each row carries its county / region / agency tags — the
  // same data the tag folders are built from, shown where the decision is made.
  function tagChips(r) {
    var out = [];
    r.tags.forEach(function (tag) {
      var m = /^(county|region|agency):(.+)$/.exec(tag);
      if (m) {
        var label = m[1] === 'region' ? 'R' + m[2] : m[2];
        out.push('<span class="h-4 px-1 inline-flex items-center rounded bg-slate-100 border border-zinc-950/06 font-mono text-[9px] uppercase tracking-wider text-slate-500">' + esc(label) + '</span>');
      } else if (tag === AUTO_TAG) {
        out.push('<span class="h-4 px-1 inline-flex items-center rounded bg-[#37576B]/10 border border-[#37576B]/20 font-mono text-[9px] uppercase tracking-wider text-[#37576B]">auto</span>');
      }
    });
    return out.join('');
  }

  function routeListHtml(list) {
    return '<div class="space-y-1">' + list.map(function (r) {
      var on = !!M1.selected[r.id];
      var already = ON_REPORT_CATALOG_IDS.indexOf(r.id) > -1;
      return '<button class="w-full flex items-start gap-2 px-2 py-2 rounded-[6px] text-left ' +
        (on ? 'border border-[#1F3F8F]/30 bg-[#1F3F8F]/8' : 'border border-zinc-950/10 bg-slate-50 hover:bg-slate-100') + '" data-act="m1-pick" data-id="' + r.id + '">' +
        '<span class="size-3.5 mt-0.5 rounded-[3px] shrink-0 flex items-center justify-center ' + (on ? 'bg-[#1F3F8F] text-white' : 'border border-zinc-950/25 bg-white') + '">' + (on ? I.check : '') + '</span>' +
        '<span class="min-w-0 flex-1">' +
        '<span class="flex items-center gap-1.5 min-w-0"><span class="font-proxima text-[13px] text-slate-700 truncate">' + esc(r.name) + '</span>' +
        (already ? '<span class="h-5 px-1.5 inline-flex items-center rounded bg-[#E5A646]/20 text-[#8a5f03] font-mono text-[9.5px] uppercase tracking-wider shrink-0">already on report</span>' : '') + '</span>' +
        '<span class="flex flex-wrap items-center gap-1 mt-1">' + tagChips(r) +
        '<span class="font-mono text-[9.5px] uppercase tracking-[0.16em] text-slate-400 tabular-nums ml-0.5">' + r.tmcs + ' TMCs</span></span>' +
        '</span></button>';
    }).join('') + '</div>';
  }

  // ── Add Graph modal (AddGraphModal) ──────────────────────────────────────
  // DEFAULT PICK differs from the component's (BarGraph · speed · 5-minutes): a
  // 5-minute bar chart of speed is the densest, least readable combination in the
  // vocabulary, and it is what an author sees before touching anything. Line · travel
  // time · hour is the report's own most common card and reads immediately.
  var M2 = { open: false, pick: { graphType: 'LineGraph', measure: 'travelTime', resolution: 'hour', comparisonMode: 'plain', anchorInvert: false }, selected: {} };

  function renderM2() {
    $('#modal-graph').classList.toggle('hidden', !M2.open);
    if (!M2.open) return;
    var selIds = routes.filter(function (r) { return M2.selected[r.id]; });
    var type = GRAPH_TYPES.filter(function (o) { return o.value === M2.pick.graphType; })[0];

    // 01 · SHAPE — cards, not a dropdown. The whole vocabulary is visible, each with
    // its glyph, its one-line "good for", and what section it actually creates.
    $('#m2-types').innerHTML = GRAPH_TYPES.map(function (o) {
      var on = o.value === M2.pick.graphType;
      return '<button data-act="m2-type" data-type="' + o.value + '" class="text-left p-2.5 rounded-[6px] border transition-colors ' +
        (on ? 'border-[#1F3F8F] bg-[#1F3F8F]/8 ring-2 ring-[#1F3F8F]/15' : 'border-zinc-950/10 bg-white hover:border-[#37576B] hover:bg-slate-50') + '">' +
        '<div class="flex items-center gap-2">' + glyph(o.value, 'size-7') +
        '<span class="font-display uppercase text-[12.5px] tracking-wide ' + (on ? 'text-[#16307A]' : 'text-[#0F1722]') + '">' + esc(o.label) + '</span></div>' +
        '<div class="font-proxima text-[11.5px] leading-[1.4] text-slate-600 mt-1.5">' + esc(o.good) + '</div>' +
        '<div class="font-mono text-[9.5px] tracking-[0.04em] text-slate-400 mt-1.5 truncate" title="Creates a ' + esc(o.creates) + ' section">→ ' + esc(o.creates) + '</div>' +
        '</button>';
    }).join('');

    // 02 · VALUE — one grouped select plus the measure's own sentence
    $('#m2-measure').innerHTML = MEASURE_GROUPS.map(function (g) {
      return '<optgroup label="' + esc(g.label) + '">' + g.values.map(function (v) {
        var m = MEASURES.filter(function (o) { return o.value === v; })[0];
        return '<option value="' + v + '"' + (v === M2.pick.measure ? ' selected' : '') + '>' + esc(m.label) + '</option>';
      }).join('') + '</optgroup>';
    }).join('');
    $('#m2-measure-help').textContent = MEASURE_DESCRIPTIONS[M2.pick.measure] || '';

    // refine — defaults are fine, so these stay quiet
    $('#m2-resolution').innerHTML = optionsHtml(RESOLUTIONS, M2.pick.resolution);
    $('#m2-comparisonMode').innerHTML = optionsHtml(COMPARISON_MODES, M2.pick.comparisonMode);

    // 03 · ROUTES
    $('#m2-routes').innerHTML = routes.length ? routes.map(function (r) {
      var on = !!M2.selected[r.id];
      return '<button class="w-full flex items-center gap-2 px-2 py-1.5 rounded-[6px] text-left ' +
        (on ? 'border border-[#1F3F8F]/30 bg-[#1F3F8F]/8' : 'border border-zinc-950/10 bg-white hover:bg-slate-100') + '" data-act="m2-pick" data-id="' + r.id + '">' +
        '<span class="size-3.5 rounded-[3px] shrink-0 flex items-center justify-center ' + (on ? 'bg-[#1F3F8F] text-white' : 'border border-zinc-950/25 bg-white') + '">' + (on ? I.check : '') + '</span>' +
        '<span class="size-2.5 rounded-full shrink-0" style="background:' + esc(r.color) + '"></span>' +
        '<span class="font-proxima text-[12.5px] text-slate-700 truncate flex-1 min-w-0">' + esc(r.name) + '</span></button>';
    }).join('') : '<div class="font-proxima text-[12.5px] italic text-slate-500 px-2 py-3">No routes on this report yet — add a route first, then assign it here.</div>';
    $('#m2-route-count').textContent = selIds.length + '/' + routes.length;

    // Anchor Route · difference mode with exactly two routes, the only case where the
    // sign of the answer depends on which arm is "Main"
    var showAnchor = M2.pick.comparisonMode === 'difference' && selIds.length === 2;
    $('#m2-anchor-wrap').classList.toggle('hidden', !showAnchor);
    $('#m2-anchor-help').classList.toggle('hidden', !showAnchor);
    if (showAnchor) {
      $('#m2-anchor').innerHTML = [
        { value: 'first', label: selIds[0].name },
        { value: 'second', label: selIds[1].name }
      ].map(function (o) {
        return '<option value="' + o.value + '"' + ((M2.pick.anchorInvert ? 'second' : 'first') === o.value ? ' selected' : '') + '>' + esc(o.label) + '</option>';
      }).join('');
    }

    // preview strip · what will be built, in words
    var m = MEASURES.filter(function (o) { return o.value === M2.pick.measure; })[0];
    var res = RESOLUTIONS.filter(function (o) { return o.value === M2.pick.resolution; })[0];
    var cm = COMPARISON_MODES.filter(function (o) { return o.value === M2.pick.comparisonMode; })[0];
    $('#m2-glyph').innerHTML = glyph(M2.pick.graphType, 'size-10');
    $('#m2-preview-title').textContent = m.label + ' — ' + type.full;
    $('#m2-preview-summary').textContent = [
      type.creates + ' section',
      res.label.toLowerCase() + ' resolution',
      cm.label.toLowerCase() + ' mode',
      selIds.length ? selIds.length + (selIds.length === 1 ? ' route' : ' routes') : 'no routes yet'
    ].join(' · ');

    $('#m2-confirm').disabled = !selIds.length;
    $('#m2-confirm').className = selIds.length
      ? 'tny-press h-9 px-4 inline-flex items-center gap-2 rounded-[6px] bg-[#1F3F8F] text-white border-b-4 border-[#16306e] font-display uppercase text-[12.5px] tracking-wide'
      : 'h-9 px-4 inline-flex items-center gap-2 rounded-[6px] bg-slate-200 text-slate-400 font-display uppercase text-[12.5px] tracking-wide cursor-not-allowed';
  }

  function optionsHtml(opts, value) {
    return opts.map(function (o) { return '<option value="' + o.value + '"' + (o.value === value ? ' selected' : '') + '>' + esc(o.label) + '</option>'; }).join('');
  }

  // Copies the whole window shape — dates, day mask and time of day together. Splitting
  // it into "paste dates" / "paste times" was considered and dropped: the three facets
  // only mean something as a set ("the same window as that route"), and two buttons per
  // row at 340px buys nothing.
  function pasteWindow(target) {
    var d = S.clip;
    target.start = d.start;
    target.end = d.end;
    target.weekdays = d.weekdays ? Object.assign({}, d.weekdays) : undefined;
    if (S.editingDates === target.id) S.dateDraft = { start: target.start, end: target.end, weekdays: Object.assign({}, target.weekdays || {}) };
  }

  // ── The one thing that is deliberately inert ──────────────────────────────
  var INERT_COPY = {
    add_routes: 'Adding is switched off in this design mockup — the browsing and selection flow is what’s being designed, not the write.',
    add_graph: 'Adding is switched off in this design mockup — the picks and their guidance are what’s being designed, not the write.',
    remove: 'Removal is switched off here. In the product this drops the route from the report and strips it from every graph it fed.',
    settings: 'The section Settings drawer is its own surface — see design-system/patterns.html § section-toolbar.',
    duplicate: 'Duplicating a section would change the canvas; this page keeps the canvas fixed.',
    menu: 'The section menu is drawn in design-system/patterns.html § section-toolbar.'
  };
  var toastTimer = null;
  function toast(msg) {
    var el = $('#inert-toast');
    el.textContent = msg;
    el.classList.remove('hidden', 'opacity-0');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.add('opacity-0'); setTimeout(function () { el.classList.add('hidden'); }, 300); }, 3600);
  }

  // ── Events ───────────────────────────────────────────────────────────────
  function setMode(mode) {
    S.mode = mode;
    S.editingName = null; S.editingDates = null; S.picking = null; S.error = '';
    var hdr = $('#btn-edit-label');
    if (hdr) hdr.textContent = mode === 'edit' ? 'Done' : 'Edit';
    renderRail();
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-act]');
    if (!t) return;
    var act = t.getAttribute('data-act');
    var id = t.getAttribute('data-route');
    var r = id ? byId(id) : null;

    switch (act) {
      case 'mode': e.preventDefault(); setMode(S.mode === 'edit' ? 'view' : 'edit'); return;
      case 'collapse': S.collapsed = !S.collapsed; renderRail(); return;
      case 'expand': S.expanded[id] = !S.expanded[id]; renderRail(); return;
      case 'search-clear': S.query = ''; $('#rail-search').value = ''; renderRail(); return;

      case 'name-edit': S.editingName = id; S.nameDraft = r.name; S.error = ''; renderRail(); setTimeout(function () { var i = $('[data-act="name-in"]'); if (i) { i.focus(); i.select(); } }, 0); return;
      case 'name-cancel': S.editingName = null; S.error = ''; renderRail(); return;
      case 'name-save': {
        var v = ($('[data-act="name-in"]') || {}).value || '';
        // A rename is something a human typed, so a collision is refused
        // rather than silently suffixed the way an add is.
        var clash = routes.some(function (x) { return x.id !== id && x.name === v; });
        if (clash) { S.error = 'A route named “' + v + '” already exists.'; renderRail(); return; }
        if (v.trim()) r.name = v.trim();
        S.editingName = null; S.error = ''; renderRail(); return;
      }

      case 'dates-edit': S.editingDates = id; S.dateDraft = { start: r.start, end: r.end, weekdays: Object.assign({}, r.weekdays) }; renderRail(); return;
      case 'dates-cancel': S.editingDates = null; S.dateDraft = null; renderRail(); return;
      case 'dates-save': {
        // Only an explicit `false` is meaningful, so an all-days mask collapses
        // back to undefined instead of persisting a same-meaning object.
        var excluded = {};
        DOW.forEach(function (d) { if (S.dateDraft.weekdays[d[0]] === false) excluded[d[0]] = false; });
        r.start = S.dateDraft.start; r.end = S.dateDraft.end;
        r.weekdays = Object.keys(excluded).length ? excluded : undefined;
        S.editingDates = null; S.dateDraft = null; renderRail(); return;
      }
      // ── copy / paste a window ──
      case 'win-copy':
        S.clip = { from: r.id, fromName: r.name, start: r.start, end: r.end, weekdays: r.weekdays ? Object.assign({}, r.weekdays) : undefined };
        renderRail();
        toast('Window copied from ' + r.name + ' — paste it onto another route, or into all of them from the strip at the top of the rail.');
        return;
      case 'win-paste': {
        if (!S.clip || r.derivedFrom) return;
        pasteWindow(r);
        // pasting is a real edit, so it lands on the row you can see change
        S.expanded[r.id] = true;
       
        renderRail();
        return;
      }
      case 'win-paste-all': {
        var n = 0;
        routes.forEach(function (x) {
          if (x.id === S.clip.from || x.derivedFrom) return;
          pasteWindow(x); n++;
        });
        renderRail();
        toast(n + (n === 1 ? ' route' : ' routes') + ' now use ' + S.clip.fromName + '’s window. Derived routes were skipped — their dates are computed from another route.');
        return;
      }
      case 'win-clip-clear': S.clip = null; renderRail(); return;

      case 'shift': {
        var yrs = +t.getAttribute('data-years');
        S.dateDraft.start = joinDT(shiftYMD(datePart(S.dateDraft.start), yrs), timePart(S.dateDraft.start));
        S.dateDraft.end = joinDT(shiftYMD(datePart(S.dateDraft.end), yrs), timePart(S.dateDraft.end));
        renderRail(); return;
      }
      case 'preset': {
        var p = PEAK_PRESETS.filter(function (x) { return x.label === t.getAttribute('data-preset'); })[0];
        S.dateDraft.start = joinDT(datePart(S.dateDraft.start), p.s);
        S.dateDraft.end = joinDT(datePart(S.dateDraft.end), p.e);
        renderRail(); return;
      }
      case 'dow': {
        var k = t.getAttribute('data-day');
        S.dateDraft.weekdays[k] = !dayOn(S.dateDraft.weekdays, k);
        renderRail(); return;
      }
      case 'dow-set': {
        var set = t.getAttribute('data-set');
        var on = set === 'weekdays' ? WEEKDAY_KEYS : set === 'weekends' ? WEEKEND_KEYS : DOW.map(function (d) { return d[0]; });
        S.dateDraft.weekdays = {};
        DOW.forEach(function (d) { S.dateDraft.weekdays[d[0]] = on.indexOf(d[0]) > -1; });
        renderRail(); return;
      }

      case 'pick-toggle': S.picking = S.picking === id ? null : id; renderRail(); return;
      case 'pick-close': S.picking = null; renderRail(); return;
      // applies and STAYS open: trying two or three colours against the charts is the
      // actual behaviour, and closing on every click would make that a chore
      case 'colour': r.color = t.getAttribute('data-colour'); renderRail(); return;

      case 'chip': {
        var gid = t.getAttribute('data-graph');
        var i = r.graphs.indexOf(gid);
        if (i > -1) r.graphs.splice(i, 1); else r.graphs.push(gid);
        renderRail(); return;
      }
      case 'move': {
        var idx = routes.indexOf(r), dir = t.getAttribute('data-dir') === 'up' ? -1 : 1;
        var to = idx + dir;
        if (to < 0 || to >= routes.length) return;
        routes.splice(to, 0, routes.splice(idx, 1)[0]);
        renderRail(); return;
      }
      case 'dynamic': S.dynamic = !S.dynamic; renderRail(); return;

      case 'measure-toggle': toggleMeasurePicker(t.getAttribute('data-section')); return;

      case 'm1-search-clear':
        if (M1.view === 'category') M1.catQ = ''; else if (M1.view === 'other') M1.otherQ = ''; else M1.q = '';
        renderM1(); $('#m1-search').focus(); return;
      case 'm1-clear': M1.selected = {}; renderM1(); return;

      // ── modals ──
      case 'm1-show': e.preventDefault();
        if (S.dynamic) { toast('Dynamic Report is on, so this adds an empty ROUTE SLOT — there is no catalogue to browse for a placeholder. Switch it off to browse routes.'); return; }
        M1.open = true; M1.view = 'root'; M1.cat = null; M1.value = null; M1.q = ''; M1.catQ = ''; M1.otherQ = ''; M1.selected = {};
        renderM1(); setTimeout(function () { $('#m1-search').focus(); }, 30); return;
      case 'm1-close': M1.open = false; renderM1(); return;
      case 'm1-root': M1.view = 'root'; M1.cat = null; M1.value = null; M1.q = ''; renderM1(); return;
      case 'm1-cat': M1.view = 'category'; M1.cat = TAG_CATEGORIES.filter(function (c) { return c.key === t.getAttribute('data-cat'); })[0]; M1.catQ = ''; M1.value = null; renderM1(); return;
      case 'm1-value': M1.view = 'value'; M1.value = { value: t.getAttribute('data-value'), label: t.getAttribute('data-label') }; M1.q = ''; renderM1(); return;
      // the edge doors sit beside the three axes, not inside one
      case 'm1-auto': M1.view = 'value'; M1.cat = null; M1.value = { value: AUTO_TAG, label: 'Auto-generated' }; M1.q = ''; renderM1(); return;
      case 'm1-other': M1.view = 'other'; M1.cat = null; M1.otherQ = ''; renderM1(); return;
      case 'm1-pick': {
        var cid = t.getAttribute('data-id');
        if (M1.selected[cid]) delete M1.selected[cid];
        else M1.selected[cid] = CATALOG.filter(function (x) { return x.id === cid; })[0];
        renderM1(); return;
      }
      case 'm1-unpick': delete M1.selected[t.getAttribute('data-id')]; renderM1(); return;
      case 'm1-confirm': toast(INERT_COPY.add_routes); return;

      case 'm2-show': e.preventDefault(); M2.open = true; M2.selected = {};
        // selection resets, picks don't: adding three cards in a row is usually three
        // of the same shape, and re-choosing Line every time is the kind of small
        // insult that makes an author go back to the long path.
        M2.pick.anchorInvert = false;
        renderM2(); return;
      case 'm2-close': M2.open = false; renderM2(); return;
      case 'm2-type': M2.pick.graphType = t.getAttribute('data-type'); renderM2(); return;
      case 'm2-all': routes.forEach(function (r) { M2.selected[r.id] = true; }); renderM2(); return;
      case 'm2-none': M2.selected = {}; renderM2(); return;
      case 'm2-pick': {
        var rid = t.getAttribute('data-id');
        if (M2.selected[rid]) delete M2.selected[rid]; else M2.selected[rid] = true;
        renderM2(); return;
      }
      case 'm2-confirm': toast(INERT_COPY.add_graph); return;

      case 'inert': toast(INERT_COPY[t.getAttribute('data-what')] || 'Switched off in this design mockup.'); return;
    }
  });

  document.addEventListener('input', function (e) {
    var t = e.target.closest('[data-act]');
    if (!t) return;
    var act = t.getAttribute('data-act');
    if (act === 'rail-search') { S.query = t.value; renderRail(); $('#rail-search').focus(); return; }
    if (act === 'name-in') { S.nameDraft = t.value; return; }
    if (act === 'date-in' || act === 'time-in') {
      // state only on `input` — re-rendering on every keystroke would fight the native
      // date/time field's own segment-by-segment editing. The derived numbers (day
      // count, active preset, the validation notes) refresh on `change`, i.e. when the
      // field is committed, which is also when they can be right.
      var which = t.getAttribute('data-which');
      var cur = S.dateDraft[which] || '';
      S.dateDraft[which] = act === 'date-in' ? joinDT(t.value, timePart(cur)) : joinDT(datePart(cur), t.value);
      return;
    }
    if (act === 'm1-search') {
      if (M1.view === 'category') M1.catQ = t.value;
      else if (M1.view === 'other') M1.otherQ = t.value;
      else M1.q = t.value;
      renderM1(); $('#m1-search').focus(); return;
    }
  });

  document.addEventListener('change', function (e) {
    var t = e.target.closest('[data-act]');
    if (!t) return;
    var act = t.getAttribute('data-act');
    if (act === 'date-in' || act === 'time-in') {
      var which = t.getAttribute('data-which'), kind = act;
      var cur = S.dateDraft[which] || '';
      S.dateDraft[which] = act === 'date-in' ? joinDT(t.value, timePart(cur)) : joinDT(datePart(cur), t.value);
      renderRail();
      // hand focus back to the field that was just committed so tabbing still works
      var again = $('[data-act="' + kind + '"][data-which="' + which + '"]');
      if (again) again.focus();
      return;
    }
    if (act.indexOf('m2-') === 0) {
      var key = act.slice(3);
      if (key === 'anchor') M2.pick.anchorInvert = t.value === 'second';
      else M2.pick[key] = t.value;
      renderM2(); return;
    }
    if (act.indexOf('mp-') === 0) { measurePick[act.slice(3)] = t.value; updateMeasureSummary(); return; }
  });

  document.addEventListener('click', function (e) {
    if (!S.picking) return;
    if (e.target.closest('#colour-pop') || e.target.closest('[data-act="pick-toggle"]')) return;
    S.picking = null; renderRail();
  }, true);

  document.addEventListener('scroll', function () {
    if (S.picking) { S.picking = null; renderRail(); }
  }, true);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (S.picking) { S.picking = null; renderRail(); return; }
      if (M1.open) { M1.open = false; renderM1(); return; }
      if (M2.open) { M2.open = false; renderM2(); return; }
      if (S.editingName) { S.editingName = null; renderRail(); return; }
      if (S.editingDates) { S.editingDates = null; S.dateDraft = null; renderRail(); return; }
    }
    if (e.key === 'Enter' && S.editingName) {
      var btn = $('[data-act="name-save"]');
      if (btn) btn.click();
    }
  });

  // backdrop click closes, panel click doesn't
  $$('[data-backdrop]').forEach(function (bd) {
    bd.addEventListener('click', function (e) { if (e.target === bd) { M1.open = false; M2.open = false; renderM1(); renderM2(); } });
  });

  renderRail();
  renderM1();
  renderM2();
})();
