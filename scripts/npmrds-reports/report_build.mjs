#!/usr/bin/env node
/**
 * report_build.mjs — build an NPMRDS report page from a declarative spec.
 *
 *   node scripts/npmrds-reports/report_build.mjs <spec.json> [--summary|--dry-run] [--publish]
 *
 * WHY THIS EXISTS
 * ---------------
 * A report is a DMS page (from the "Report Page" page template) carrying a
 * ReportRouteList panel (which now has its own inline "Add a route" search —
 * see add-route-flow-improvements.md) and N AVL Graph sections, plus one
 * `reports_snap_2` row holding the route instances. Building that by
 * clicking has several silent failure modes (a graph-assignment pill that
 * doesn't register; a measure pick lost because Save wasn't clicked; an
 * anchor/compare order that is invisible in the UI). A spec makes the intended
 * report a reviewable artifact and turns those into declared data.
 *
 * THE PARITY GUARANTEE
 * --------------------
 * Graph state is composed by calling the SAME `applyMeasurePick` the UI's
 * Measure Picker calls — not a reimplementation. Its own docstring says the
 * apply sequence is shared so callers "can never silently drift"; this script is
 * simply a third caller. So for any spec, CLI output and UI output are identical
 * by construction, and "does the UI have parity?" reduces to "is there a control
 * for each spec field?".
 *
 * Modules are loaded through Vite's SSR resolver (not bare node) because the
 * theme/library sources use extensionless imports and JSON imports that only
 * Vite's resolver handles — which also guarantees we exercise the same module
 * graph the browser does.
 *
 * WHAT THIS DOES NOT DO
 * ---------------------
 * It does not load the built page in a browser. Two layers are checked here —
 * spec → composed state (via the real `applyMeasurePick`) and composed state →
 * written row (the structural checks below) — and both are decidable without
 * rendering. The third layer, "does the graph engine do something correct with a
 * config that is provably what the spec asked for", is a different question: its
 * failures are platform bugs, not build bugs (see the two folded-in prerequisites
 * in the task file — both had correct composed state and a broken page). That
 * check belongs on `report_probe.mjs`, which already holds the live data and can
 * run against any page rather than only freshly-built ones. Deliberately not
 * built yet — see the task file's deferred `--expect` note for the trigger.
 *
 * See research/npmrds-reports/report-spec.md for the spec format, and
 * planning/tasks/current/report-spec-and-build-script.md for the design record.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

// ── DMS content constants (mirrors scripts/npmrds-reports/convert_old_reports.py) ──────────
const APP = process.env.DMS_APP || 'npmrdsv5';
const SITE_TYPE = process.env.DMS_TYPE || 'dev2';
const HOST = process.env.DMS_HOST || 'http://localhost:3001';
const PATTERN = 'npmrds_sub';
const PAGE_TYPE = `${PATTERN}|page`;
const COMPONENT_TYPE = `${PATTERN}|component`;
const PAGE_TEMPLATE_ID = 2187021;                    // "Report Page" page template
const REPORTS_SNAP_TYPE = 'reports_snap_2|2177440:data';
const DEFAULT_PARENT_SLUG = 'converted_reports';
// The "Routes Data" catalog a spec's `route_id`s refer to.
const ROUTES_SOURCE_ID = 2107426;
const ROUTES_VIEW_ID = 2107427;
// The reports_snap_2 dataset itself — used to look a report's own row back up
// by report_id for --update/--from-page (source/view ids read off a live row's
// dataset query response; matches REPORTS_SNAP_TABLE's name in convert_old_reports.py).
const REPORTS_SNAP_SOURCE_ID = 2177438;
const REPORTS_SNAP_VIEW_ID = 2177440;
// Sanity cap on _specRevisions length (see the task file's storage-decisions table).
const REVISION_CAP = 200;

// A `graphType: "Map"` graph is NOT an AVL Graph — it's built by shelling out
// to convert_old_reports.py's `--route-map-section` (see composeMapGraphState
// below), which reuses the Route Map choropleth machinery built for the
// old-report-conversion task (rounds 47-50) rather than reimplementing
// template-minting/CH quantile-baking a second time in JS. Mirrors Python's
// ROUTE_MAP_MEASURES exactly — keep in sync if that list changes.
const ROUTE_MAP_MEASURES = ['none', 'speed', 'travelTime', 'hoursOfDelay', 'avgHoursOfDelay'];
const CONVERTER_SCRIPT = resolve(REPO, 'scripts/npmrds-reports/convert_old_reports.py');

// A `graphType: "InfoBox"` graph is likewise not an AVL Graph — it shells out to
// convert_old_reports.py's `--route-info-box-section` (see composeInfoBoxGraphState
// below), reusing the five INFO_BOX_*_BUCKET measure buckets already built for
// old-report conversion (rounds 18/38/40) rather than a second implementation.
// Mirrors Python's INFO_BOX_SPEC_MEASURES exactly — keep in sync if that list
// changes. "reliability" is the LOTTR/TTTR/Freeflow pm3 join (old code's own
// internal key for this bucket is the confusingly-reused "speed" measure — this
// spec-facing name avoids colliding with AVL Graph's real speed-in-mph measure).
const INFO_BOX_MEASURES = ['reliability', 'travelTime', 'length', 'aadt', 'hoursOfDelay'];
const INFO_BOX_BINS = ['amp', 'midd', 'pmp', 'we'];

// A `graphType: "RouteCompare"` graph is likewise not an AVL Graph — it shells
// out to convert_old_reports.py's `--route-compare-section` (see
// composeRouteCompareGraphState below), reusing the shared, generic,
// per-measure Route Compare Component template (round 25) already built for
// old-report conversion. Mirrors Python's MEASURE_EXPR keys exactly — keep in
// sync if that dict changes. NOT the theme's custom `RouteComparison.jsx`
// page component (an unrelated Batch-Reports-replacement tool) — this mints a
// plain Spreadsheet section (comparisonSeries row fan-out + a delta column).
const ROUTE_COMPARE_MEASURES = ['speed', 'travelTime'];
// Mirrors Python's PM3_VIEW_BY_YEAR range (source 1410's per-year pm3 join) —
// an Info Box "reliability" graph outside this window has no fallback (unlike
// Route Map's geometry-year clamp), so it's a hard build error, checked here
// before ever shelling out to Python.
const INFO_BOX_RELIABILITY_YEARS = { min: 2018, max: 2025 };

// A route instance's optional peak-hour/time-of-day sub-window. The runtime
// mechanism this rides on (useGraphPublish.js's transformReportRoutes) detects
// a time component by checking `.includes('T')` on startDate/endDate — so
// combining is just string concatenation, matching exactly what RouteRow.jsx's
// date+time inputs already produce by hand. startTime/endTime are kept as
// separate spec-facing fields rather than folded into startDate/endDate:
// Route Map/Info Box read startDate/endDate directly for a separate Python
// path and must never see a time suffix, so only combine at the one call site
// that writes the reports_snap_2 row's route entries.
const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
function combineDateTime(date, time) {
  return time ? `${date}T${time}` : date;
}
// Inverse of combineDateTime, for --from-page reconstruction: a persisted row
// only ever carries the combined string (that's the format the runtime/UI
// both read and write), so recovering a clean startTime/endTime pair back out
// of the spec means splitting on 'T' rather than assuming the field is bare.
function splitDateTime(combined) {
  if (!combined || !combined.includes('T')) return { date: combined };
  const [date, time] = combined.split('T');
  return { date, time };
}

// ── args ───────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const VALUE_FLAGS = new Set(['--update', '--from-page', '--out', '--note']);
const flags = new Set();
const values = {};
const positional = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (VALUE_FLAGS.has(a)) { values[a.slice(2)] = argv[++i]; continue; }
  if (a.startsWith('--')) { flags.add(a); continue; }
  positional.push(a);
}
const specPath = positional[0];
const UPDATE_PAGE = values.update;
const FROM_PAGE = values['from-page'];
const OUT_PATH = values.out;
const NOTE = values.note || null;

function usage() {
  console.error(`usage:
  node scripts/npmrds-reports/report_build.mjs <spec.json> [--summary|--dry-run] [--publish]
  node scripts/npmrds-reports/report_build.mjs <spec.json> --update <page> [--note "..."]
  node scripts/npmrds-reports/report_build.mjs --from-page <page> [--out <spec.json>]

  --summary        print a plain-language description of what the spec will build; no writes, no Vite boot
  --dry-run        compose every graph's state and print it; no writes
  --publish        also create published section copies (default: draft only)
  --update <page>  reconcile the spec into an EXISTING page (id or slug) instead of creating a new one —
                    matches graphs by spec \`key\` against the page's stored key→trackingId map, so a
                    revision edits sections in place instead of minting a duplicate page. The page's title
                    updates if changed; its slug (URL) never does, even then.
  --note "..."     annotate this --update in the report's revision log (why the spec changed)
  --from-page <page>  reverse a live page (+ its reports_snap_2 row) back into a spec, printed to stdout
                    (or written to --out <path>). Use to bootstrap a spec for a page --update hasn't
                    touched yet, or to check a page hasn't drifted from its last stored spec.

  To check that the built page actually renders, run the probe against it:
    node scripts/npmrds-reports/report_probe.mjs <slug>            (published pages)
    node scripts/npmrds-reports/report_probe.mjs edit/<slug> --auth  (draft-only pages)
`);
}

const SUMMARY_ONLY = flags.has('--summary');
const DRY_RUN = flags.has('--dry-run');
const DO_PUBLISH = flags.has('--publish');

function fail(msg) {
  console.error(`\nSPEC ERROR: ${msg}\n`);
  process.exit(1);
}

// ── dms CLI wrapper ────────────────────────────────────────────────────────
// Per CLAUDE.md all DMS reads/writes go through the CLI, which owns type
// resolution and config. Same approach the Python converter uses. Defined
// early (before spec loading) because --from-page runs without a spec at all.
function dms(args, data) {
  const full = ['--host', HOST, '--app', APP, '--type', SITE_TYPE, ...args];
  if (data !== undefined) full.push('--data', JSON.stringify(data));
  const out = execFileSync('dms', full, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const trimmed = out.trim();
  if (!trimmed) return null;
  try { return JSON.parse(trimmed); } catch { return trimmed; }
}

// The reports_snap_2 row for a given page, found via the UDA dataset path
// (this is a split `:data` type — `raw get`/`raw list` can't address it; see
// the CLI skill's dataset-rows-need-uda note). Returns null if never built.
function findSnapRow(pageId) {
  const res = dms(['dataset', 'query', String(REPORTS_SNAP_SOURCE_ID),
    '--view', String(REPORTS_SNAP_VIEW_ID), '--filter', `report_id=${pageId}`, '--limit', '1']);
  return res?.items?.[0] || null;
}

// Strips the `_`-prefixed working fields this script adds onto the spec
// in-place (r._name, g._assigned, g._invert, r._row, ...) before persisting
// it — the stored spec should be exactly what a human/reviewer authored.
function stripInternal(obj) {
  return JSON.parse(JSON.stringify(obj, (k, v) => (k.startsWith('_') ? undefined : v)));
}

// Coarse diff for the revision log (chosen over full-snapshot-per-revision,
// see the task file's storage-decisions table) — not a general deep-diff,
// just enough granularity to be useful rule-distilling material later.
function diffSpecs(oldSpec, newSpec) {
  const changes = [];
  for (const key of ['title', 'description', 'intro', 'slug', 'parent']) {
    if (JSON.stringify(oldSpec?.[key]) !== JSON.stringify(newSpec?.[key])) changes.push(`${key} changed`);
  }
  const oldGraphs = new Map((oldSpec?.graphs || []).map(g => [g.key, g]));
  const newGraphs = new Map((newSpec?.graphs || []).map(g => [g.key, g]));
  for (const key of newGraphs.keys()) {
    if (!oldGraphs.has(key)) changes.push(`graph ${key} added`);
    else if (JSON.stringify(oldGraphs.get(key)) !== JSON.stringify(newGraphs.get(key))) changes.push(`graph ${key} modified`);
  }
  for (const key of oldGraphs.keys()) {
    if (!newGraphs.has(key)) changes.push(`graph ${key} removed`);
  }
  const oldRoutes = new Map((oldSpec?.routes || []).map(r => [r.id, r]));
  const newRoutes = new Map((newSpec?.routes || []).map(r => [r.id, r]));
  for (const id of newRoutes.keys()) {
    if (!oldRoutes.has(id)) changes.push(`route ${id} added`);
    else if (JSON.stringify(oldRoutes.get(id)) !== JSON.stringify(newRoutes.get(id))) changes.push(`route ${id} modified`);
  }
  for (const id of oldRoutes.keys()) {
    if (!newRoutes.has(id)) changes.push(`route ${id} removed`);
  }
  return changes.length ? changes : ['no detected change'];
}

function writeSpecOut(spec, outPath) {
  const text = JSON.stringify(spec, null, 2);
  if (outPath) {
    writeFileSync(resolve(outPath), text + '\n');
    console.error(`wrote spec to ${outPath}`);
  } else {
    console.log(text);
  }
}

// AVL Graph/Map are unambiguous graph element-types; Spreadsheet is NOT — an
// Info Box graph, a Route Compare graph, and the page's own Add-a-Route
// section all share it. Only count a Spreadsheet section as a graph here if
// it actually carries the `_infoBoxPick` or `_routeComparePick` marker
// composeInfoBoxGraphState/composeRouteCompareGraphState stamps onto every
// build of that type (mirrors `_routeMapPick`) — the Add-a-Route section, a
// verbatim template clone, never has either.
function isGraphSectionElement(s) {
  const type = s.data.element['element-type'];
  if (['AVL Graph', 'Map'].includes(type)) return true;
  if (type !== 'Spreadsheet') return false;
  try {
    const state = JSON.parse(s.data.element['element-data']);
    return !!(state._infoBoxPick || state._routeComparePick);
  } catch { return false; }
}

// ── --from-page: reverse a live page back into a spec ──────────────────────
function runFromPage(pageArg, outPath) {
  const page = dms(['page', 'show', pageArg, '--pattern', PATTERN]);
  const pageId = page?.id;
  if (!pageId) fail(`page "${pageArg}" not found.`);
  const snap = findSnapRow(pageId);
  if (!snap) fail(`no reports_snap_2 row found for page ${pageId} — this page was never built by `
    + `report_build.mjs, so there's nothing to reverse.`);
  if (snap.data.routes === undefined) {
    fail(`page ${pageId}'s reports_snap_2 row (id ${snap.id}) uses the OLD old-report-conversion shape `
      + `(route_comps/graph_comps), not report_build.mjs's routes[] shape. --from-page only supports `
      + `pages in this spec-driven builder's own shape.`);
  }

  const dump = dms(['page', 'dump', String(pageId), '--sections']);
  const sections = dump?._expanded_sections || [];
  const specKeyMap = snap.data._specKeyMap ? JSON.parse(snap.data._specKeyMap) : null;

  if (snap.data._spec) {
    const stored = JSON.parse(snap.data._spec);
    const liveTrackingIds = new Set(sections.map(s => s.data.trackingId));
    const mapTrackingIds = new Set(specKeyMap ? Object.values(specKeyMap) : []);
    const graphSections = sections.filter(isGraphSectionElement);
    const keyByTid = specKeyMap ? Object.fromEntries(Object.entries(specKeyMap).map(([k, v]) => [v, k])) : {};
    const storedGraphByKey = new Map((stored.graphs || []).map(g => [g.key, g]));

    // Structural drift: a section added/removed by hand since the last build.
    let drifted = [...mapTrackingIds].some(tid => !liveTrackingIds.has(tid))
      || graphSections.some(s => !mapTrackingIds.has(s.data.trackingId));
    // Content drift: same sections, but a field was hand-edited in place —
    // title, or (for AVL Graph) the measure pick, without adding/removing a
    // section. Catches exactly the case a trackingId-only check misses.
    if (!drifted) {
      for (const s of graphSections) {
        const key = keyByTid[s.data.trackingId];
        const storedGraph = storedGraphByKey.get(key);
        if (!storedGraph) { drifted = true; break; }
        if ((storedGraph.title || '') !== (s.data.title || '')) { drifted = true; break; }
        if (s.data.element['element-type'] === 'Map') continue; // no cheap live pick to diff against (see _routeMapPick note above)
        let state = {};
        try { state = JSON.parse(s.data.element['element-data']); } catch { /* leave {} */ }
        if (s.data.element['element-type'] === 'Spreadsheet') {
          // Route Compare and Info Box share element-type Spreadsheet — tell
          // them apart by which marker is present before diffing.
          if (state._routeComparePick) {
            const pick = state._routeComparePick;
            const expected = { measure: storedGraph.measure };
            if (JSON.stringify(pick) !== JSON.stringify(expected)) { drifted = true; break; }
            continue;
          }
          // Info Box: no applyMeasurePick, diff against its own _infoBoxPick marker instead.
          const pick = state._infoBoxPick || {};
          const expected = { measure: storedGraph.measure, grain: storedGraph.grain || 'route',
            ...(storedGraph.measure === 'reliability' ? { bin: storedGraph.bin } : {}) };
          if (JSON.stringify(pick) !== JSON.stringify(expected)) { drifted = true; break; }
          continue;
        }
        const pick = state.display?._measurePick || {};
        const expected = { graphType: storedGraph.graphType, measure: storedGraph.measure, resolution: storedGraph.resolution, comparisonMode: storedGraph.comparisonMode || 'plain' };
        if (JSON.stringify(pick) !== JSON.stringify(expected)) { drifted = true; break; }
        if ((storedGraph.caption || '') !== (state.display?.description || '')) { drifted = true; break; }
      }
    }
    // Title-block content drift: heading or intro paragraph hand-edited
    // without adding/removing the section itself.
    if (!drifted && specKeyMap?.title_block) {
      const titleBlockSection = sections.find(s => s.data.trackingId === specKeyMap.title_block);
      if (!titleBlockSection) drifted = true;
      else {
        if ((stored.title || '') !== (titleBlockSection.data.title || '')) drifted = true;
        let elData = {};
        try { elData = JSON.parse(titleBlockSection.data.element['element-data']); } catch { /* leave {} */ }
        if (!drifted && (stored.intro || '') !== lexicalTreeToText(elData.text)) drifted = true;
      }
    }
    if (!drifted) {
      console.error(`(page ${pageId} matches its stored spec exactly — echoing it back, no live reconstruction needed)`);
      writeSpecOut(stored, outPath);
      return;
    }
    console.error(`note: page ${pageId}'s live sections have drifted from the stored spec (hand-edited?) — reconstructing from live state instead`);
  }

  const routeEntries = JSON.parse(snap.data.routes || '[]');
  const graphSections = sections.filter(isGraphSectionElement);
  const keyByTrackingId = new Map();
  const graphs = graphSections.map((s, i) => {
    const key = `g${i + 1}`;
    keyByTrackingId.set(s.data.trackingId, key);
    const elType = s.data.element['element-type'];
    if (elType === 'Map') {
      let pick = null;
      try { pick = JSON.parse(s.data.element['element-data'])._routeMapPick || null; } catch { /* leave null */ }
      return {
        key, title: s.data.title || undefined, graphType: 'Map',
        measure: pick?.measure ?? null,
        ...(pick?.resolution ? { resolution: pick.resolution } : {}),
        ...(pick ? {} : { _needsReview: 'Route Map measure not recoverable from this section (built before the _routeMapPick marker existed) — re-pick manually' }),
      };
    }
    if (elType === 'Spreadsheet') {
      let state = {};
      try { state = JSON.parse(s.data.element['element-data']); } catch { /* leave {} */ }
      if (state._routeComparePick) {
        return { key, title: s.data.title || undefined, graphType: 'RouteCompare', measure: state._routeComparePick.measure };
      }
      const pick = state._infoBoxPick || null;
      return {
        key, title: s.data.title || undefined, graphType: 'InfoBox',
        measure: pick?.measure ?? null, grain: pick?.grain || 'route',
        ...(pick?.bin ? { bin: pick.bin } : {}),
        ...(pick ? {} : { _needsReview: 'Info Box/Route Compare measure not recoverable from this section (built before the _infoBoxPick/_routeComparePick marker existed) — re-pick manually' }),
      };
    }
    let state = {};
    try { state = JSON.parse(s.data.element['element-data']); } catch { /* leave {} */ }
    const pick = state.display?._measurePick || {};
    const invert = !!state.comparisonSeries?.combine?.invert;
    return {
      key, title: s.data.title || undefined,
      graphType: pick.graphType, measure: pick.measure, resolution: pick.resolution,
      comparisonMode: pick.comparisonMode,
      ...(state.display?.description ? { caption: state.display.description } : {}),
      ...(invert ? { _needsReview: 'comparisonMode is "difference" with combine.invert set — the original `anchor` route id is not recoverable; re-specify anchor by hand' } : {}),
    };
  });

  // Title block: only recoverable via the stored key map (a page predating
  // this feature, or one never built by report_build.mjs at all, has no
  // `title_block` key — left unreconstructed rather than guessed).
  let intro;
  if (specKeyMap?.title_block) {
    const titleBlockSection = sections.find(s => s.data.trackingId === specKeyMap.title_block);
    if (titleBlockSection) {
      let elData = {};
      try { elData = JSON.parse(titleBlockSection.data.element['element-data']); } catch { /* leave {} */ }
      const text = lexicalTreeToText(elData.text);
      if (text) intro = text;
    }
  }

  const routes = routeEntries.map((e, i) => {
    const start = splitDateTime(e.startDate);
    const end = splitDateTime(e.endDate);
    return {
      id: `r${i + 1}`,
      route_id: Number(e.route_id ?? e.id),
      name: e.name,
      ...(start.date ? { startDate: start.date } : {}),
      ...(end.date ? { endDate: end.date } : {}),
      ...(start.time ? { startTime: start.time } : {}),
      ...(end.time ? { endTime: end.time } : {}),
      ...(e.color ? { color: e.color } : {}),
      ...(e.weekdays ? { weekdays: e.weekdays } : {}),
      graphs: (e.graphIds || []).map(tid => keyByTrackingId.get(tid)).filter(Boolean),
    };
  });

  writeSpecOut({
    title: page.title,
    slug: page.url_slug,
    ...(snap.data.description ? { description: snap.data.description } : {}),
    ...(intro ? { intro } : {}),
    graphs, routes,
  }, outPath);
}

if (FROM_PAGE) {
  runFromPage(FROM_PAGE, OUT_PATH);
  process.exit(0);
}

if (!specPath) { usage(); process.exit(1); }

// ── spec load + validation ─────────────────────────────────────────────────
const spec = JSON.parse(readFileSync(resolve(specPath), 'utf8'));

if (!spec.title) fail('`title` is required.');
if (!Array.isArray(spec.graphs) || !spec.graphs.length) fail('`graphs` must be a non-empty array.');
if (!Array.isArray(spec.routes) || !spec.routes.length) fail('`routes` must be a non-empty array.');

const graphByKey = new Map();
for (const g of spec.graphs) {
  if (!g.key) fail('every graph needs a unique `key`.');
  if (graphByKey.has(g.key)) fail(`duplicate graph key "${g.key}".`);
  graphByKey.set(g.key, g);
}

// Route names are the ONLY series discriminator downstream (the server's SQL
// alias and the client's legend/color key), so duplicates collapse into one
// series. ReportRouteList auto-suffixes on add for this reason; do the same here
// rather than emitting a report whose two arms silently merge.
const seenNames = new Set();
for (const r of spec.routes) {
  if (!r.id) fail('every route needs a spec-local `id` (used by graphs[].anchor and routes[].graphs).');
  if (!r.route_id) fail(`route "${r.id}" needs a \`route_id\` (its DMS id in the Routes Data dataset).`);
  if (!r.name) fail(`route "${r.id}" needs a \`name\`.`);
  let name = r.name;
  if (seenNames.has(name)) {
    let n = 2;
    while (seenNames.has(`${r.name} (${n})`)) n++;
    name = `${r.name} (${n})`;
    console.warn(`  note: route "${r.id}" renamed to "${name}" — duplicate names collapse into one series`);
  }
  seenNames.add(name);
  r._name = name;
  for (const gk of r.graphs || []) {
    if (!graphByKey.has(gk)) fail(`route "${r.id}" references unknown graph key "${gk}".`);
  }
  if (r.confidence !== undefined) {
    const level = r.confidence?.level;
    if (!['low', 'medium', 'high'].includes(level)) {
      fail(`route "${r.id}" has \`confidence\` but \`confidence.level\` is "${level}" — must be "low", "medium", or "high".`);
    }
  }
  // A time-of-day sub-window (peak-hour filtering) rides on the same startDate/
  // endDate strings useGraphPublish.js already parses (it detects a time
  // component via `.includes('T')`) — so a time needs a date to attach to, and
  // both boundaries must agree on whether a time is present.
  if (r.startTime || r.endTime) {
    if (!HHMM_RE.test(r.startTime || '') || !HHMM_RE.test(r.endTime || '')) {
      fail(`route "${r.id}" has \`startTime\`/\`endTime\` but one is missing or not "HH:mm" — both are required together, 24-hour, e.g. "07:00"/"10:00".`);
    }
    if (!r.startDate || !r.endDate) {
      fail(`route "${r.id}" has \`startTime\`/\`endTime\` but no \`startDate\`/\`endDate\` — a time-of-day window needs a date window to apply within.`);
    }
  }
}

// A guess-and-flag marker, not a gate (see the intake rules in creating-reports.md):
// an underspecified client ask ("around Verplank and Beekman") has no determinate
// segment extent, so the right move is a best-guess route plus a reviewable flag,
// never a stalled report. `confidence.level: "low"` is the signal that should turn
// into an explicit question to the reviewer rather than a silent guess.
function lowConfidenceRoutes(spec) {
  return spec.routes.filter(r => r.confidence?.level === 'low');
}

// Every graph should have at least one route, or it renders empty.
for (const g of spec.graphs) {
  const assigned = spec.routes.filter(r => (r.graphs || []).includes(g.key));
  if (!assigned.length) fail(`graph "${g.key}" has no routes assigned — no route lists it in its \`graphs\`.`);
  g._assigned = assigned;
  if (g.comparisonMode === 'difference' && assigned.length < 2) {
    fail(`graph "${g.key}" is comparisonMode "difference" but has ${assigned.length} route(s); difference needs at least 2.`);
  }
}

// ── anchor resolution for difference graphs ────────────────────────────────
// The server treats seriesVariants[0] — i.e. the FIRST assigned route in
// routes-array order — as the anchor ("Main"), and returns anchor − compare.
// The UI exposes no control for this at all; it's implicitly whichever instance
// was added first. The spec names it explicitly, and for the 2-arm case we can
// honor it without reordering by using comparisonSeries.combine.invert.
for (const g of spec.graphs) {
  if (g.comparisonMode !== 'difference') continue;
  if (g.graphType === 'Map') fail(`graph "${g.key}": Route Map doesn't support comparisonMode "difference" — each assigned route already renders as its own choropleth-colored layer.`);
  if (g.graphType === 'InfoBox') fail(`graph "${g.key}": Info Box doesn't support comparisonMode "difference" — each assigned route already renders as its own row via the comparisonSeries discriminator, not a subtraction.`);
  if (g.graphType === 'RouteCompare') fail(`graph "${g.key}": Route Compare doesn't support comparisonMode "difference" — its delta column already IS the %-diff-from-anchor; a separate difference mode would be redundant.`);
  if (!g.anchor) {
    console.warn(`  note: difference graph "${g.key}" has no \`anchor\`; defaulting to "${g._assigned[0].id}" (first assigned route). Set \`anchor\` to be explicit about the sign.`);
    g._invert = false;
    continue;
  }
  const idx = g._assigned.findIndex(r => r.id === g.anchor);
  if (idx === -1) fail(`graph "${g.key}" names anchor "${g.anchor}", which is not assigned to it.`);
  if (idx === 0) g._invert = false;
  else if (g._assigned.length === 2) {
    g._invert = true;   // anchor is the 2nd arm → flip the subtraction instead of reordering
  } else {
    fail(`graph "${g.key}" names anchor "${g.anchor}" but it is arm #${idx + 1} of ${g._assigned.length}. `
       + `With more than 2 arms the anchor must be the first assigned route — reorder \`routes\` so "${g.anchor}" comes first.`);
  }
}

// ── --summary: plain-language review, no Vite boot, no writes ──────────────
const RES_LABEL = { '5-minutes': '5-minute', '15-minutes': '15-minute', hour: 'hourly', day: 'daily', weekday: 'day-of-week', month: 'monthly' };

if (SUMMARY_ONLY) {
  console.log(`\n${spec.title}`);
  if (spec.slug) console.log(`  slug: ${spec.slug}`);
  if (spec.request) console.log(`\nClient request:\n  "${spec.request}"`);
  if (spec.intro) console.log(`\nIntro (title-block section):\n  "${spec.intro}"`);
  console.log(`\nRoutes (${spec.routes.length} instance${spec.routes.length === 1 ? '' : 's'}):`);
  for (const r of spec.routes) {
    const window = r.startDate && r.endDate
      ? `${combineDateTime(r.startDate, r.startTime)} → ${combineDateTime(r.endDate, r.endTime)}`
      : 'no date window (all available dates)';
    // Semantics per useGraphPublish.js:34 — ONLY an explicit `false` excludes a
    // day, so an absent key means included. Enumerate all seven and subtract.
    const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const included = r.weekdays ? DAYS.filter(d => r.weekdays[d] !== false) : DAYS;
    const days = r.weekdays ? ` [${included.length === 7 ? 'all days' : included.map(d => d.slice(0, 3)).join(',')}]` : '';
    console.log(`  • ${r._name}`);
    console.log(`      route ${r.route_id} · ${window}${days} · feeds: ${(r.graphs || []).join(', ') || 'NOTHING'}`);
    if (r.confidence) console.log(`      confidence: ${r.confidence.level}${r.confidence.note ? ` — ${r.confidence.note}` : ''}`);
  }
  const lowConf = lowConfidenceRoutes(spec);
  if (lowConf.length) {
    console.log(`\n⚠ NEEDS REVIEW — ${lowConf.length} route(s) marked low-confidence:`);
    for (const r of lowConf) console.log(`  • ${r._name}${r.confidence.note ? `: ${r.confidence.note}` : ''}`);
  }
  console.log(`\nGraphs (${spec.graphs.length}):`);
  for (const g of spec.graphs) {
    const mode = g.comparisonMode === 'difference'
      ? `difference (${g.anchor || g._assigned[0].id} − others${g._invert ? ', inverted' : ''})`
      : 'each route as its own series';
    const detail = g.graphType === 'Map'
      ? `Map, ${g.measure}${g.measure === 'avgHoursOfDelay' ? ` (${RES_LABEL[g.resolution] || g.resolution})` : ''} choropleth`
      : g.graphType === 'InfoBox'
      ? `Info Box (${g.grain || 'route'} grain), ${g.measure}${g.measure === 'reliability' ? ` [bin: ${g.bin}]` : ''}`
      : g.graphType === 'RouteCompare'
      ? `Route Compare, ${g.measure} (% vs anchor route)`
      : `${g.graphType}, ${g.measure}, ${RES_LABEL[g.resolution] || g.resolution} buckets`;
    console.log(`  • ${g.title || g.key} — ${detail}`);
    console.log(`      ${mode}; ${g._assigned.length} route(s): ${g._assigned.map(r => r.id).join(', ')}`);
    if (g.why) console.log(`      why: ${g.why}`);
    if (g.caption) console.log(`      caption: "${g.caption}"`);
  }
  console.log('\n(no changes made — drop --summary to build)\n');
  process.exit(0);
}

// ── --update preflight: resolve the existing page + stored key→trackingId map
// before the (slow) Vite boot, so a bad --update target fails fast. ────────
let updateCtx = null;
if (UPDATE_PAGE) {
  const page = dms(['page', 'show', UPDATE_PAGE, '--pattern', PATTERN]);
  const pageId = page?.id;
  if (!pageId) fail(`--update target "${UPDATE_PAGE}" not found.`);
  const snap = findSnapRow(pageId);
  if (!snap) fail(`--update target page ${pageId} has no reports_snap_2 row — it wasn't built by `
    + `report_build.mjs. Build it fresh (no --update) instead.`);
  if (!snap.data._specKeyMap) fail(`--update target page ${pageId}'s reports_snap_2 row (id ${snap.id}) `
    + `has no stored key→trackingId map — it predates this feature or was built by the old-report `
    + `converter. Run \`--from-page ${pageId} --out <spec.json>\`, review the reconstructed spec, then `
    + `build it fresh (no --update) once to adopt this feature before --update can reconcile it.`);
  const dump = dms(['page', 'dump', String(pageId), '--sections']);
  updateCtx = {
    pageId,
    slug: page.url_slug,
    currentTitle: page.title,
    snapId: snap.id,
    oldSpec: snap.data._spec ? JSON.parse(snap.data._spec) : null,
    oldKeyMap: JSON.parse(snap.data._specKeyMap),
    oldRevisions: snap.data._specRevisions ? JSON.parse(snap.data._specRevisions) : [],
    sections: dump?._expanded_sections || [],
  };
  console.log(`reconciling into existing page ${pageId} (${updateCtx.slug})`);
}

const lowConf = lowConfidenceRoutes(spec);
if (lowConf.length) {
  console.warn(`\n⚠ NEEDS REVIEW — ${lowConf.length} route(s) marked low-confidence (building anyway; `
    + `guess-and-flag, not a gate — see creating-reports.md):`);
  for (const r of lowConf) console.warn(`  • ${r._name}${r.confidence.note ? `: ${r.confidence.note}` : ''}`);
  console.warn('');
}

// ── compose graph state through the real Measure Picker ────────────────────
const { createServer } = await import('vite');
const server = await createServer({ root: REPO, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });

let composedStates;
try {
  const mp = await server.ssrLoadModule('/src/themes/transportny/components/MeasurePicker/index.js');
  const cmc = await server.ssrLoadModule('/src/themes/transportny/components/MeasurePicker/composeMeasureConfig.js');
  const graphCfg = await server.ssrLoadModule(
    '/src/dms/packages/dms/src/patterns/page/components/sections/components/ComponentRegistry/graph_new/config.jsx');
  const avlGraph = graphCfg.default;

  // Validate picks against the vocabulary before composing, so a typo fails
  // loudly here instead of producing a silently empty graph.
  const vocab = cmc.GRAPH_VOCAB;
  const graphTypes = new Set(cmc.GRAPH_TYPE_OPTIONS.map(o => o.value));
  for (const g of spec.graphs) {
    if (g.graphType === 'Map') {
      // Route Map is not an AVL Graph — it has its own measure vocabulary and
      // no `resolution` concept except avgHoursOfDelay's day/5-minutes split.
      // See composeMapGraphState below for how its state is actually built.
      if (!ROUTE_MAP_MEASURES.includes(g.measure)) fail(`graph "${g.key}": unknown Route Map measure "${g.measure}". Known: ${ROUTE_MAP_MEASURES.join(', ')}`);
      if (g.measure === 'avgHoursOfDelay' && !['day', '5-minutes'].includes(g.resolution)) fail(`graph "${g.key}": Route Map avgHoursOfDelay needs \`resolution\` "day" or "5-minutes".`);
      if (g.caption) fail(`graph "${g.key}": Route Map has no caption/description render path (unlike AVL Graph's GraphTitle) — drop \`caption\` or move this graph to an AVL Graph type.`);
      continue;
    }
    if (g.graphType === 'InfoBox') {
      // Route/TMC Info Box is not an AVL Graph either — no `resolution`, no
      // `applyMeasurePick`. See composeInfoBoxGraphState below for how its
      // state is actually built.
      if (!INFO_BOX_MEASURES.includes(g.measure)) fail(`graph "${g.key}": unknown Info Box measure "${g.measure}". Known: ${INFO_BOX_MEASURES.join(', ')}`);
      if (g.grain && !['route', 'tmc'].includes(g.grain)) fail(`graph "${g.key}": Info Box grain must be "route" or "tmc", got "${g.grain}".`);
      if (g.measure === 'reliability' && !INFO_BOX_BINS.includes(g.bin)) fail(`graph "${g.key}": Info Box measure "reliability" needs \`bin\` — one of ${INFO_BOX_BINS.join(', ')} (AM Peak/Midday/PM Peak/Weekend — the only four periods source 1410 precomputes).`);
      if (g.caption) fail(`graph "${g.key}": Info Box has no caption/description render path (Spreadsheet has no GraphTitle-equivalent, unlike AVL Graph) — drop \`caption\` or move this graph to an AVL Graph type.`);
      continue;
    }
    if (g.graphType === 'RouteCompare') {
      // Route Compare Component is not an AVL Graph either — no `resolution`,
      // no `applyMeasurePick`, and (like Info Box) no caption render path.
      // See composeRouteCompareGraphState below for how its state is built.
      if (!ROUTE_COMPARE_MEASURES.includes(g.measure)) fail(`graph "${g.key}": unknown Route Compare measure "${g.measure}". Known: ${ROUTE_COMPARE_MEASURES.join(', ')}`);
      if (g.caption) fail(`graph "${g.key}": Route Compare has no caption/description render path (Spreadsheet has no GraphTitle-equivalent, unlike AVL Graph) — drop \`caption\` or move this graph to an AVL Graph type.`);
      continue;
    }
    if (!graphTypes.has(g.graphType)) fail(`graph "${g.key}": unknown graphType "${g.graphType}". Known: ${[...graphTypes].join(', ')}`);
    if (!vocab.measures[g.measure]) fail(`graph "${g.key}": unknown measure "${g.measure}". Known: ${Object.keys(vocab.measures).join(', ')}`);
    if (!vocab.resolutions[g.resolution]) fail(`graph "${g.key}": unknown resolution "${g.resolution}". Known: ${Object.keys(vocab.resolutions).join(', ')}`);
    if (g.comparisonMode && !['plain', 'difference'].includes(g.comparisonMode)) fail(`graph "${g.key}": comparisonMode must be "plain" or "difference".`);
  }

  // Literal transcription of useDataWrapperAPI.js:132-174. It's a React
  // useCallback, so it cannot be imported and called outside a component —
  // this is the ONE piece of duplicated logic in this script. Keep it a
  // transcription, and diff it against the source if comparison-series
  // behavior ever changes.
  function reconcileComparisonSeriesColumn(draft) {
    if (!draft) return;
    const cs = draft.comparisonSeries;
    const seriesKey = cs?.seriesKey || '__series';
    const enabled = cs?.enabled === true;
    const dynamicSubscriber = (draft.display?._functions?.subscribers || [])
      .some(s => s.functionId === 'comparison_series' && s.enabled);
    const hasVariants = (Array.isArray(cs?.variants) && cs.variants.some(v => v && v.label))
      || Array.isArray(cs?.config) || dynamicSubscriber;
    const idx = (draft.columns || []).findIndex(c => c.origin === 'comparison-series');
    if (!enabled || !hasVariants) { if (idx !== -1) draft.columns.splice(idx, 1); return; }
    if (idx === -1) {
      draft.columns.push({ name: seriesKey, alias: seriesKey, type: 'text', show: true,
        group: true, target: 'categorize', isCalculatedColumn: false, origin: 'comparison-series' });
    } else {
      draft.columns[idx].name = seriesKey;
      draft.columns[idx].alias = seriesKey;
    }
  }

  composedStates = spec.graphs.map((g) => {
    if (g.graphType === 'Map') return undefined; // composed separately — see composeMapGraphState below
    if (g.graphType === 'InfoBox') return undefined; // composed separately — see composeInfoBoxGraphState below
    if (g.graphType === 'RouteCompare') return undefined; // composed separately — see composeRouteCompareGraphState below
    // Start from the component's own defaultState (which already includes the
    // `data: []` that BarGraph crashes without — see the converter's note).
    const state = structuredClone(avlGraph.defaultState);
    const dwAPI = {
      setState: (fn) => fn(state),
      reconcileComparisonSeriesColumn: () => reconcileComparisonSeriesColumn(state),
    };
    mp.applyMeasurePick({ state, dwAPI, currentComponent: avlGraph }, {
      graphType: g.graphType,
      measure: g.measure,
      resolution: g.resolution,
      comparisonMode: g.comparisonMode || 'plain',
    });
    // The spec's explicit anchor, honored without reordering routes. Only set
    // when true so a normal-order difference graph's state stays byte-identical
    // to what the UI produces.
    if (g._invert) {
      state.comparisonSeries.combine = { ...(state.comparisonSeries.combine || {}), invert: true };
    }
    if (g.title) state.display.title = { ...(state.display.title || {}), title: g.title };
    // Renders as a subtitle line under the chart title (GraphComponent.jsx's
    // GraphTitle) — already wired on the render side (and already written, to
    // a dead end, by convert_old_reports.py's old-caption handling); this is
    // the missing write path from a fresh spec-built graph.
    if (g.caption) {
      state.display.description = g.caption;
    }
    else if (g.comparisonMode === 'difference') {
      // A difference chart's title alone ("Northbound Travel Time Difference")
      // doesn't say which route is the base and which is the comparison —
      // the single plotted series is a delta, and neither raw value survives
      // to the client (see clickhouse.js's diff-mode join), so nothing else on
      // the page states it either. Auto-fill the same base-vs-comparison
      // wording the query itself computes (anchor − compare, or the reverse
      // under `_invert`) so a spec that skips `caption` still gets a
      // self-explanatory subtitle instead of none.
      const anchorRoute = g._invert ? g._assigned[1] : g._assigned[0];
      const compareRoutes = g._invert ? [g._assigned[0]] : g._assigned.slice(1);
      state.display.description =
        `Base: ${anchorRoute.name} · Comparison: ${compareRoutes.map(r => r.name).join(', ')}`;
    }
    return state;
  });
} finally {
  await server.close();
}

// ── compose Route Map graph state ───────────────────────────────────────────
// Shells out to convert_old_reports.py, which owns the ONLY Route Map
// choropleth machinery that exists (template-minting + per-report CH
// quantile-break baking, built for old-report conversion rounds 47-50) —
// reusing it exactly rather than reimplementing it a second time in JS. See
// planning/tasks/current/client-request-to-report-skill.md's 2026-07-27
// correction for why this wiring, not a from-scratch Map builder, was the
// actual gap. `opts.tmcs`/`startDate`/`endDate` are omitted for a --dry-run
// preview (year/shape only, placeholder paint); a real build calls this again
// after routes are resolved from the catalog, with real tmcs/dates, to get a
// choropleth baked from this report's own data.
function composeMapGraphState(g, { tmcs, startDate, endDate } = {}) {
  const years = (g._assigned || [])
    .map(r => (r.endDate || r.startDate || '').slice(0, 4))
    .filter(Boolean).map(Number);
  if (!years.length) fail(`graph "${g.key}": Route Map needs at least one assigned route with a startDate/endDate to pick a network year.`);
  const year = Math.max(...years);
  const args = [CONVERTER_SCRIPT, '--route-map-section', '--measure', g.measure, '--year', String(year)];
  if (g.measure === 'avgHoursOfDelay') args.push('--resolution', g.resolution);
  if (DRY_RUN) args.push('--dry-run');
  if (tmcs && tmcs.length && startDate && endDate) {
    args.push('--tmcs', JSON.stringify(tmcs), '--start-date', startDate, '--end-date', endDate);
  }
  if (g.colorRange) args.push('--color-range', JSON.stringify(g.colorRange));
  const out = execFileSync('python3', args, { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'] });
  // convert_old_reports.py prints progress banners (e.g. its TILE_HOST probe)
  // to stdout too, ahead of the final JSON line — take the last non-empty
  // line rather than assuming stdout is JSON-only.
  const lines = out.trim().split('\n').filter(Boolean);
  let built;
  try {
    built = JSON.parse(lines[lines.length - 1]);
  } catch {
    fail(`graph "${g.key}": could not parse Route Map builder output:\n${out}`);
  }
  // Bookkeeping only, mirrors AVL Graph's state.display._measurePick — lets
  // --from-page recover a Route Map graph's measure/resolution exactly
  // instead of flagging it unrecoverable (see runFromPage above).
  built.state._routeMapPick = { measure: g.measure, ...(g.measure === 'avgHoursOfDelay' ? { resolution: g.resolution } : {}) };
  return built;
}

// ── compose Route/TMC Info Box graph state ──────────────────────────────────
// Shells out to convert_old_reports.py, same reuse principle as
// composeMapGraphState above — the five INFO_BOX_*_BUCKET measure buckets
// (reliability/travelTime/length/aadt/hoursOfDelay) already exist there,
// built for old-report conversion (rounds 18/38/40). Unlike Route Map, an
// Info Box section needs NO per-report baking step at build time: every
// bucket queries live via the cloned template's own join (pgFederated for
// reliability, a plain CH join for the other four) — the same
// fetchMode:"force"/comparisonSeries mechanism an AVL Graph section already
// uses. So this composes in a single pass, immediately, rather than Map's
// placeholder-then-baked two-phase compose keyed off route resolution.
function composeInfoBoxGraphState(g) {
  const grain = g.grain || 'route';
  const args = [CONVERTER_SCRIPT, '--route-info-box-section',
    '--info-box-measure', g.measure, '--grain', grain];
  if (g.measure === 'reliability') {
    const years = (g._assigned || [])
      .map(r => (r.endDate || r.startDate || '').slice(0, 4))
      .filter(Boolean).map(Number);
    if (!years.length) fail(`graph "${g.key}": Info Box measure "reliability" needs at least one assigned route with a startDate/endDate to period-match source 1410's per-year join.`);
    const year = Math.max(...years);
    if (year < INFO_BOX_RELIABILITY_YEARS.min || year > INFO_BOX_RELIABILITY_YEARS.max) {
      fail(`graph "${g.key}": Info Box measure "reliability" year ${year} is outside source 1410's `
        + `${INFO_BOX_RELIABILITY_YEARS.min}-${INFO_BOX_RELIABILITY_YEARS.max} coverage — no fallback `
        + `exists (unlike Route Map's geometry-year clamp). Pick a measure with no year dependency `
        + `(travelTime/length/aadt/hoursOfDelay) or a route inside that window instead.`);
    }
    args.push('--year', String(year), '--bin', g.bin);
  }
  if (DRY_RUN) args.push('--dry-run');
  const out = execFileSync('python3', args, { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'] });
  const lines = out.trim().split('\n').filter(Boolean);
  let built;
  try {
    built = JSON.parse(lines[lines.length - 1]);
  } catch {
    fail(`graph "${g.key}": could not parse Info Box builder output:\n${out}`);
  }
  // Bookkeeping only, mirrors Route Map's state._routeMapPick — lets
  // --from-page recover an Info Box graph's measure/grain/bin exactly,
  // and lets isGraphSectionElement tell an Info Box section apart from the
  // page's own Add-a-Route section (both are element-type "Spreadsheet").
  built.state._infoBoxPick = { measure: g.measure, grain,
    ...(g.measure === 'reliability' ? { bin: g.bin } : {}) };
  return built;
}

// ── compose Route Compare Component graph state ────────────────────────────
// Shells out to convert_old_reports.py, same reuse principle as
// composeMapGraphState/composeInfoBoxGraphState above — the shared,
// generic, per-measure `ensure_route_compare_template` (round 25) already
// exists there. Like Info Box, this needs NO per-report baking step: the
// anchor and every compare row resolve live at render time via
// comparisonSeries + dms-server's __ANCHOR__(<expr>) mechanism, reading
// whichever route the page's own route list currently has first — so this
// composes in a single pass, immediately, exactly like Info Box.
function composeRouteCompareGraphState(g) {
  const args = [CONVERTER_SCRIPT, '--route-compare-section', '--compare-measure', g.measure];
  if (DRY_RUN) args.push('--dry-run');
  const out = execFileSync('python3', args, { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'] });
  const lines = out.trim().split('\n').filter(Boolean);
  let built;
  try {
    built = JSON.parse(lines[lines.length - 1]);
  } catch {
    fail(`graph "${g.key}": could not parse Route Compare builder output:\n${out}`);
  }
  // Bookkeeping only, mirrors Info Box's state._infoBoxPick — lets
  // --from-page recover a Route Compare graph's measure exactly, and lets
  // isGraphSectionElement tell a Route Compare section apart from Info Box
  // and the page's own Add-a-Route section (all three are element-type
  // "Spreadsheet").
  built.state._routeComparePick = { measure: g.measure };
  return built;
}

// Composed unconditionally, before the --dry-run/route-resolution branches
// below — unlike Route Map there is no placeholder-vs-baked distinction, so
// this only ever runs once.
for (const [i, g] of spec.graphs.entries()) {
  if (g.graphType !== 'InfoBox') continue;
  const built = composeInfoBoxGraphState(g);
  composedStates[i] = built.state;
  g._infoBoxElementType = built.elementType;
}
for (const [i, g] of spec.graphs.entries()) {
  if (g.graphType !== 'RouteCompare') continue;
  const built = composeRouteCompareGraphState(g);
  composedStates[i] = built.state;
  g._routeCompareElementType = built.elementType;
}

if (DRY_RUN) {
  // Preview: no route/tmc resolution yet, so this shows the bare template
  // shape (placeholder paint), not a real choropleth bake.
  for (const [i, g] of spec.graphs.entries()) {
    if (g.graphType !== 'Map') continue;
    const built = composeMapGraphState(g);
    composedStates[i] = built.state;
    g._mapElementType = built.elementType;
  }
}

if (DRY_RUN) {
  console.log(JSON.stringify(spec.graphs.map((g, i) => ({
    key: g.key, title: g.title, invert: !!g._invert, state: composedStates[i],
  })), null, 2));
  // Trailer goes to stderr so --dry-run's stdout stays valid JSON and can be
  // piped straight into `jq` / json.load without trimming.
  console.error('\n(--dry-run: nothing written)\n');
  process.exit(0);
}

// ── resolve routes from the Routes Data catalog ────────────────────────────
// The spec references routes by DMS id; the reports_snap_2 entry embeds the
// route's own tmc_array/name/etc, so fetch each one.
console.log('resolving routes from the catalog...');
for (const r of spec.routes) {
  // Must go through `dataset query`, NOT `raw get`: Routes Data rows are
  // split-table (`:data`) rows, and the `dms.data.byId` route behind `raw get`
  // is app-namespaced — with no type it cannot address a per-type split table
  // and returns a row of nulls. `dataset query` reads via the UDA routes, which
  // carry env + view_id. See src/dms/planning/tasks/current/cli-dataset-rows-via-uda.md
  const res = dms(['dataset', 'query', String(ROUTES_SOURCE_ID),
    '--view', String(ROUTES_VIEW_ID), '--filter', `id=${r.route_id}`, '--limit', '1']);
  const d = res?.items?.[0]?.data;
  if (!d) fail(`route_id ${r.route_id} not found in the Routes Data catalog `
    + `(source ${ROUTES_SOURCE_ID} / view ${ROUTES_VIEW_ID}). Total matched: ${res?.total ?? 0}.`);
  if (!d.tmc_array) fail(`route_id ${r.route_id} ("${d.name || '?'}") has no tmc_array — cannot feed a graph.`);
  r._row = d;
  const tmcCount = (() => { try { return JSON.parse(d.tmc_array).length; } catch { return '?'; } })();
  // Print the SPEC's instance name, not the catalog row's. Two instances routinely
  // share one catalog route and differ only by date window, so echoing the catalog
  // name makes a correct build look like it collapsed both arms into one label.
  const catalogName = d.name || '?';
  const instanceName = r.name || catalogName;
  console.log(`  ${r.route_id} "${instanceName}" — ${tmcCount} TMCs`
    + (instanceName !== catalogName ? `  (catalog: "${catalogName}")` : ''));
}

// ── compose Route Map graph state for real, now tmcs are known ─────────────
// Pools TMCs/dates across every route assigned to each Map graph and bakes a
// real per-report choropleth (see composeMapGraphState above) — the shared
// per-year template only ever carries placeholder paint.
for (const [i, g] of spec.graphs.entries()) {
  if (g.graphType !== 'Map') continue;
  const tmcs = new Set();
  const starts = [], ends = [];
  for (const r of g._assigned) {
    let arr = [];
    try { arr = JSON.parse(r._row.tmc_array) || []; } catch { /* logged as empty below */ }
    arr.forEach(t => tmcs.add(t));
    if (r.startDate) starts.push(r.startDate);
    if (r.endDate) ends.push(r.endDate);
  }
  if (!tmcs.size || !starts.length || !ends.length) {
    console.warn(`  note: graph "${g.key}" (Route Map) has no resolvable tmcs/date range across its assigned routes — choropleth left unbaked, template placeholder paint renders instead`);
    continue;
  }
  const startDate = [...starts].sort()[0];
  const endDate = [...ends].sort().slice(-1)[0];
  console.log(`  baking Route Map choropleth for "${g.key}" — ${tmcs.size} TMCs, ${startDate}..${endDate}`);
  const built = composeMapGraphState(g, { tmcs: [...tmcs], startDate, endDate });
  composedStates[i] = built.state;
  g._mapElementType = built.elementType;
}

// ── create OR reconcile the page ────────────────────────────────────────────
const pageTemplate = (dms(['raw', 'get', String(PAGE_TEMPLATE_ID)]))?.data;
if (!pageTemplate) fail(`could not load the Report Page template (row ${PAGE_TEMPLATE_ID}).`);

function templateSectionByType(elementType) {
  const found = (pageTemplate.draft_sections || [])
    .find(s => s?.element?.['element-type'] === elementType);
  if (!found) fail(`Report Page template has no "${elementType}" section.`);
  return found;
}

let pageId, slug, parentRef, graphTrackingIds, sectionDatas, titleBlockTrackingId;

function clonedSection(tmplSection, trackingId) {
  return {
    type: COMPONENT_TYPE,
    group: tmplSection.group || 'default',
    ...(tmplSection.level ? { level: tmplSection.level } : {}),
    ...(tmplSection.hideInView ? { hideInView: tmplSection.hideInView } : {}),
    title: tmplSection.title || '',
    parent: parentRef,
    trackingId,
    element: {
      'element-type': tmplSection.element['element-type'],
      'element-data': tmplSection.element['element-data'],
    },
  };
}

function graphSectionData(g, i, trackingId) {
  return {
    type: COMPONENT_TYPE,
    group: 'default',
    title: g.title || '',
    parent: parentRef,
    trackingId,
    ...(g.size ? { size: String(g.size) } : {}),
    element: {
      'element-type': g._mapElementType || g._infoBoxElementType || g._routeCompareElementType || 'AVL Graph',
      // element-data is a JSON STRING, not an object (see the CLI skill's
      // element-data gotcha) — a nested object here is silently unusable.
      'element-data': JSON.stringify(composedStates[i]),
    },
  };
}

// ── title-block section (Gap 3) ─────────────────────────────────────────────
// A generic "lexical" (Rich Text) section, reusing the section's own `title`
// (rendered by every section's header, not something new) plus a body
// paragraph for `spec.intro`. Always built — even with no `intro` — so every
// report gets a visible heading; today `item.title` on the page itself is
// never rendered anywhere in view.jsx.
//
// The read-only RichtextView component requires `text` to already be a
// Lexical tree object ({root:{children:[...]}}) — it checks `text?.root`
// directly and renders nothing for a bare string (only the *edit* component
// auto-upgrades plain strings via its own textToLexicalJSON). So build the
// tree ourselves, matching the exact node shape the editor itself emits
// (ui/components/lexical/index.jsx's textToLexicalJSON), split on blank
// lines into paragraphs (that helper only ever makes one).
function textToLexicalTree(text) {
  const paragraphs = String(text || '').split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  const children = (paragraphs.length ? paragraphs : ['']).map(p => ({
    children: [{ detail: 0, format: 0, mode: 'normal', style: '', text: p, type: 'text', version: 1 }],
    direction: 'ltr', format: '', indent: 0, type: 'paragraph', version: 1,
  }));
  return { root: { children, direction: 'ltr', format: '', indent: 0, type: 'root', version: 1 } };
}

// Inverse of textToLexicalTree, for --from-page: flattens paragraph text
// nodes back to a plain string. Only faithful for trees this script itself
// wrote (or the plain single-paragraph shape the editor's own
// textToLexicalJSON produces) — a hand-formatted paragraph (bold, links,
// multiple runs) still flattens to readable text, just without the
// formatting, which is fine for drift detection and a reconstructed spec.
function lexicalTreeToText(tree) {
  const paragraphs = (tree?.root?.children || [])
    .map(p => (p.children || []).map(c => c.text || '').join(''));
  return paragraphs.join('\n\n');
}

function titleBlockSectionData(trackingId) {
  return {
    type: COMPONENT_TYPE,
    group: 'default',
    title: spec.title,
    parent: parentRef,
    trackingId,
    element: {
      'element-type': 'lexical',
      'element-data': JSON.stringify({
        bgColor: 'rgba(0,0,0,0)', isCard: '', showToolbar: false,
        text: textToLexicalTree(spec.intro || ''),
      }),
    },
  };
}

if (updateCtx) {
  // ── reconcile into the existing page ──────────────────────────────────
  ({ pageId, slug } = updateCtx);
  parentRef = JSON.stringify({ id: String(pageId), ref: `${APP}+${PAGE_TYPE}` });

  // Existing spec keys keep their trackingId (so `section update` edits them
  // in place); new keys mint one. Keys dropped from the spec are handled
  // below by diffing against the section list itself, not this map.
  graphTrackingIds = spec.graphs.map(g => updateCtx.oldKeyMap[g.key] || randomUUID());
  titleBlockTrackingId = updateCtx.oldKeyMap['title_block'] || randomUUID();
  const keptTrackingIds = new Set([...graphTrackingIds, titleBlockTrackingId]);

  // RRL isn't in the key map — a Report Page always has exactly one, so find it
  // live rather than tracking it separately. An Info Box graph is ALSO
  // element-type "Spreadsheet" (unlike AVL Graph/Map, which are unambiguous):
  // exclude any Spreadsheet section this revision's OLD key map already tracks
  // as a graph key, so the sweep below doesn't misidentify a pre-existing page's
  // own frozen Add-a-Route-to-Report section (a page built/reconciled before
  // the standalone catalog section was retired — see
  // add-route-flow-improvements.md) as an Info Box graph.
  const trackedGraphTrackingIds = new Set(
    Object.entries(updateCtx.oldKeyMap).filter(([k]) => k !== 'title_block').map(([, v]) => v));
  const rrlSection = updateCtx.sections.find(s => s.data.element['element-type'] === 'ReportRouteList');
  if (!rrlSection) fail(`page ${pageId} has no ReportRouteList section — can't reconcile (hand-deleted?).`);

  // No Add-a-Route Spreadsheet section is created or re-synced here on purpose:
  // the Report Page template no longer has one to clone from (RRL's own inline
  // search replaces it, see add-route-flow-improvements.md). A page built before
  // that change still carries its own frozen copy — untouched by this reconcile
  // (it's excluded from the deletion sweep below the same way it always was),
  // per that task's explicit "don't retroactively touch existing pages" decision.
  sectionDatas = [
    clonedSection(templateSectionByType('ReportRouteList'), rrlSection.data.trackingId),
    titleBlockSectionData(titleBlockTrackingId),
    ...spec.graphs.map((g, i) => graphSectionData(g, i, graphTrackingIds[i])),
  ];

  let created = 0, updated = 0, deleted = 0;
  const titleBlockExisting = updateCtx.sections.find(s => s.data.trackingId === titleBlockTrackingId);
  if (titleBlockExisting) {
    dms(['section', 'update', String(titleBlockExisting.id)], sectionDatas[1]);
    updated++;
  } else {
    const res = dms(['section', 'create', String(pageId), '--pattern', PATTERN], sectionDatas[1]);
    if (!res?.id) fail('failed to create the title-block section.');
    created++;
  }
  for (const [i, g] of spec.graphs.entries()) {
    const tid = graphTrackingIds[i];
    const existing = updateCtx.sections.find(s => s.data.trackingId === tid);
    const payload = { ...sectionDatas[i + 2], size: g.size ? String(g.size) : '' }; // explicit '' clears a size dropped by this revision (shallow-merge --data would otherwise leave a stale one)
    if (existing) {
      dms(['section', 'update', String(existing.id)], payload);
      updated++;
    } else {
      const res = dms(['section', 'create', String(pageId), '--pattern', PATTERN], payload);
      if (!res?.id) fail(`failed to create section for new graph "${g.key}".`);
      created++;
    }
  }
  // Graph sections whose trackingId this revision no longer references were
  // dropped — delete them rather than leaving orphans. The title-block
  // section is never dropped (always built), so it needs no equivalent check
  // here — and deliberately isn't swept by a generic "any lexical section not
  // in the key map" rule, which would risk deleting a Rich Text block an
  // author added by hand elsewhere on the page. AVL Graph/Map are unambiguous
  // element-types (an author-added one is fair game for the same sweep, same
  // as before); Spreadsheet is NOT — it's also the Add-a-Route section's own
  // element-type, so only count a Spreadsheet section as a graph section here
  // if it was actually tracked as one (an Info Box graph a PRIOR build/update
  // minted), never the untracked Add-a-Route sheet.
  for (const s of updateCtx.sections) {
    const type = s.data.element['element-type'];
    const isGraphSection = ['AVL Graph', 'Map'].includes(type)
      || (type === 'Spreadsheet' && trackedGraphTrackingIds.has(s.data.trackingId));
    if (isGraphSection && !keptTrackingIds.has(s.data.trackingId)) {
      dms(['section', 'delete', String(s.id), '--page', String(pageId)]);
      deleted++;
    }
  }
  console.log(`reconciled sections: ${created} created, ${updated} updated, ${deleted} deleted`);

  if (spec.title && spec.title !== updateCtx.currentTitle) {
    // Slug is deliberately left untouched even when the title changes — see
    // the --update flag's usage text; a revision should never move the URL.
    dms(['raw', 'update', String(pageId)], { title: spec.title });
    console.log(`updated page title (slug left unchanged: /${slug})`);
  }
} else {
  // ── create a new page ───────────────────────────────────────────────────
  const parentSlug = spec.parent || DEFAULT_PARENT_SLUG;
  const parent = dms(['page', 'show', parentSlug, '--pattern', PATTERN]);
  const parentId = parent?.id;
  if (!parentId) fail(`parent page "${parentSlug}" not found — create it first, or set \`parent\` in the spec.`);

  slug = spec.slug || `${parentSlug}/${String(spec.title).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`;
  const pageRes = dms(['page', 'create', '--pattern', PATTERN, '--title', spec.title, '--slug', slug],
    { index: '0', parent: String(parentId), sidebar: pageTemplate.sidebar || 'left', published: 'draft' });
  pageId = pageRes?.id;
  if (!pageId) fail('page create returned no id.');
  console.log(`created page id=${pageId} slug=${slug}`);

  parentRef = JSON.stringify({ id: String(pageId), ref: `${APP}+${PAGE_TYPE}` });
  graphTrackingIds = spec.graphs.map(() => randomUUID());
  titleBlockTrackingId = randomUUID();
  sectionDatas = [
    clonedSection(templateSectionByType('ReportRouteList'), randomUUID()),
    titleBlockSectionData(titleBlockTrackingId),
    ...spec.graphs.map((g, i) => graphSectionData(g, i, graphTrackingIds[i])),
  ];
  const draftIds = sectionDatas.map(sd => dms(['section', 'create', String(pageId), '--pattern', PATTERN], sd)?.id);
  console.log(`created ${draftIds.length} draft sections: ${draftIds.join(', ')}`);
}

if (DO_PUBLISH) {
  // Publishing creates a SEPARATE set of component rows sharing trackingIds —
  // it does not flip the draft rows (mirrors the UI, and the converter).
  const publishedRefs = sectionDatas.map(sd => ({
    id: String(dms(['raw', 'create', APP, COMPONENT_TYPE], sd)?.id),
    ref: `${APP}+${COMPONENT_TYPE}`,
  }));
  const groups = pageTemplate.draft_section_groups
    || [{ name: 'default', index: 0, theme: 'content', position: 'content' }];
  dms(['raw', 'update', String(pageId)], {
    sections: publishedRefs, section_groups: groups, draft_section_groups: groups,
    published: '', has_changes: false,
  });
  console.log(`published (published section rows: ${publishedRefs.map(r => r.id).join(', ')})`);
}

// ── reports_snap_2 row: the route instances ───────────────────────────────
// graphIds is COMPUTED from the spec's declared assignments — this is the step
// that, done by clicking, can silently fail to persist.
const routeEntries = spec.routes.map((r, i) => {
  const d = r._row;
  return {
    ...d,
    name: r._name,
    route_id: d.route_id ?? String(r.route_id),
    id: r.route_id,
    route_comp_id: `comp-${i}`,
    graphIds: (r.graphs || []).map(gk => graphTrackingIds[spec.graphs.findIndex(g => g.key === gk)]),
    ...(r.startDate ? { startDate: combineDateTime(r.startDate, r.startTime) } : {}),
    ...(r.endDate ? { endDate: combineDateTime(r.endDate, r.endTime) } : {}),
    ...(r.color ? { color: r.color } : {}),
    ...(r.weekdays ? { weekdays: r.weekdays } : {}),
    isValid: true,
  };
});

const cleanSpec = stripInternal(spec);
const specKeyMap = Object.fromEntries([
  ['title_block', titleBlockTrackingId],
  ...spec.graphs.map((g, i) => [g.key, graphTrackingIds[i]]),
]);

let snapRes;
if (updateCtx) {
  const revisions = [...updateCtx.oldRevisions, {
    at: new Date().toISOString(),
    note: NOTE || 'spec update',
    changed_paths: diffSpecs(updateCtx.oldSpec, cleanSpec),
  }].slice(-REVISION_CAP);
  // `dms raw update` silently no-ops on split (`:data`) rows like reports_snap_2
  // — confirmed live (echoes a success response, but a follow-up read shows the
  // row unchanged); see the CLI-gaps reference doc. `raw create`/`raw delete`
  // both DO work on split rows (proven by every prior build/cleanup in this
  // task), so reconcile by replacing the row rather than updating it. Nothing
  // else holds a reference to the snap row's own id — ReportRouteList discovers
  // it by `report_id` at render time (self-binding), not a stored foreign key —
  // so a new row id here is transparent to the page.
  dms(['raw', 'delete', APP, REPORTS_SNAP_TYPE, String(updateCtx.snapId)]);
  snapRes = dms(['raw', 'create', APP, REPORTS_SNAP_TYPE], {
    report_id: String(pageId),
    routes: JSON.stringify(routeEntries),
    name: spec.title,
    description: spec.description || '',
    _built_from_spec: specPath,
    ...(spec.request ? { _client_request: spec.request } : {}),
    _spec: JSON.stringify(cleanSpec),
    _specKeyMap: JSON.stringify(specKeyMap),
    _specRevisions: JSON.stringify(revisions),
  });
  console.log(`replaced reports_snap_2 row (old id ${updateCtx.snapId} -> new id ${snapRes?.id}; `
    + `${routeEntries.length} route instances, revision #${revisions.length}: ${revisions[revisions.length - 1].changed_paths.join('; ')})`);
} else {
  snapRes = dms(['raw', 'create', APP, REPORTS_SNAP_TYPE], {
    report_id: String(pageId),
    routes: JSON.stringify(routeEntries),
    name: spec.title,
    description: spec.description || '',
    _built_from_spec: specPath,
    ...(spec.request ? { _client_request: spec.request } : {}),
    _spec: JSON.stringify(cleanSpec),
    _specKeyMap: JSON.stringify(specKeyMap),
    _specRevisions: JSON.stringify([{ at: new Date().toISOString(), note: 'initial build', changed_paths: ['*'] }]),
  });
  console.log(`created reports_snap_2 row id=${snapRes?.id} (${routeEntries.length} route instances)`);
}

// ── structural checks ─────────────────────────────────────────────────────
// These catch the silent-failure class directly, without needing a browser: a
// route feeding no graph, a graph nothing feeds, and the three state keys whose
// absence makes a section render empty rather than error.
let problems = 0;
for (const e of routeEntries) {
  if (!e.graphIds.length) { console.error(`  FAIL route "${e.name}" has empty graphIds — it will feed no graph`); problems++; }
}
for (const [i, g] of spec.graphs.entries()) {
  const feeding = routeEntries.filter(e => e.graphIds.includes(graphTrackingIds[i]));
  if (!feeding.length) { console.error(`  FAIL graph "${g.key}" has no routes pointing at it`); problems++; }
  const st = composedStates[i];
  // Route Map has no display.fetchMode/comparisonSeries.enabled — those are
  // AVL-Graph DataWrapper concepts; a Map section queries per-layer via its
  // own tile/join config instead. The $self comparison_series subscriber IS
  // shared (RRL discovery is element-type-agnostic — see the M0a note in
  // old-reports-conversion.md), so that check still applies to both.
  if (g.graphType !== 'Map') {
    if (st.display?.fetchMode !== 'force') { console.error(`  FAIL graph "${g.key}" missing display.fetchMode:"force" — it will never query live`); problems++; }
    if (!st.comparisonSeries?.enabled) { console.error(`  FAIL graph "${g.key}" comparisonSeries not enabled — assigned routes won't render as series`); problems++; }
  }
  const sub = (st.display?._functions?.subscribers || []).find(s => s.functionId === 'comparison_series');
  if (!sub || sub.paramKey !== '$self') { console.error(`  FAIL graph "${g.key}" missing the $self comparison_series subscriber`); problems++; }
}
console.log(problems === 0 ? '\nstructural checks: all passed' : `\nstructural checks: ${problems} PROBLEM(S)`);

console.log(`\n${problems === 0 ? 'OK' : 'BUILT WITH PROBLEMS'} — /${slug}${DO_PUBLISH ? '' : '  (draft only; add --publish, or publish from the UI)'}`);
console.log(`check it renders:  node scripts/npmrds-reports/report_probe.mjs ${DO_PUBLISH ? slug : `edit/${slug} --auth`}`);
process.exit(problems === 0 ? 0 : 1);
