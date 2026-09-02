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
 * planning/transportny/tasks/current/report-spec-and-build-script.md for the design record.
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
// below), reusing the INFO_BOX_*_BUCKET measure buckets already built for
// old-report conversion (rounds 18/38/40) rather than a second implementation.
// Mirrors Python's INFO_BOX_SPEC_MEASURES exactly — keep in sync if that list
// changes. "reliability" is the LOTTR/TTTR/Freeflow pm3 join (old code's own
// internal key for this bucket is the confusingly-reused "speed" measure — this
// spec-facing name avoids colliding with AVL Graph's real speed-in-mph measure).
// "speed" (added 2026-08-12) is that real plain speed-in-mph measure — see
// ensure_info_box_speed_template's docstring in info_box_templates.py.
const INFO_BOX_MEASURES = ['speed', 'reliability', 'travelTime', 'length', 'aadt', 'hoursOfDelay'];
const INFO_BOX_BINS = ['amp', 'midd', 'pmp', 'we'];
// A graph's `measure` may be a single string or an array of >= 2 (multi-measure
// — N columns in one box, matching the old tool's real shape; see
// build_route_info_box_section_state_multi/build_route_compare_section_state_multi
// in the Python lib). Which combinations are actually join-compatible is
// deliberately NOT duplicated here — Python (INFO_BOX_MULTI_JOIN_GROUP) is the
// single source of truth, and composeInfoBoxGraphState surfaces its rejection
// as a clean build failure instead of re-implementing the same compatibility
// matrix in a second language (the exact "two independent implementations of
// one fact" risk this whole arc kept finding).
const measureList = m => Array.isArray(m) ? m : [m];

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

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
// A LIVE route entry's `startDate` may still carry an old embedded-time suffix
// ("2026-04-20T07:00") from before weekdays/startTime/endTime moved to graphs[] — routes[] here
// only ever wants the bare date, so --from-page reconstruction strips it rather than assuming
// the field is already bare.
function splitDateTime(combined) {
  if (!combined || !combined.includes('T')) return { date: combined };
  const [date, time] = combined.split('T');
  return { date, time };
}

// Dynamic Report support (route slots + Mechanism B's relative-date formula
// grammar) — see planning/transportny/tasks/current/report-spec-and-build-script.md's
// "Follow-on: Dynamic Report spec support". `relativeDateResolution.js` has zero
// imports of its own (no JSX, no bare specifiers), so it loads via a plain Node
// dynamic import — no need to boot the Vite SSR server just to validate a
// formula string against the real grammar. Hoisted above `runFromPage`'s own
// definition (not down by the spec-load/validation code that actually consumes
// most of it) because `--from-page` exits before ever reaching that section —
// both directions need the same sentinel/regexes. `spec.dynamicReport: true`
// is the only thing that turns a route slot on; the formula grammar itself is
// general (works on any report, Dynamic or not — Ryan's direction 2026-08-11),
// so it is NOT gated on this flag.
const { RELATIVE_DATE_REGEX, CALENDAR_POSITION_REGEX, TODAY_ANCHOR_COMP_ID } =
  await import(resolve(REPO, 'src/themes/transportny/components/ReportRouteList/relativeDateResolution.js'));
const DYNAMIC_REPORT_FILTERS = [
  { id: 'dyn-report-routes', searchKey: 'routes', useSearchParams: true, values: '', type: 'routeSlots' },
  { id: 'dyn-report-asof', searchKey: 'asOf', useSearchParams: true, values: '', type: 'baseDate' },
];

// ── args ───────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const VALUE_FLAGS = new Set(['--update', '--from-page', '--out', '--note']);
// `--replace` is a boolean flag (no value) — falls through to the generic
// `a.startsWith('--')` branch below, same as `--publish`/`--dry-run`/`--summary`.
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
  node scripts/npmrds-reports/report_build.mjs <spec.json> --replace [--publish]
  node scripts/npmrds-reports/report_build.mjs --from-page <page> [--out <spec.json>]

  --summary        print a plain-language description of what the spec will build; no writes, no Vite boot
  --dry-run        compose every graph's state and print it; no writes
  --publish        also create published section copies (default: draft only)
  --update <page>  reconcile the spec into an EXISTING page (id or slug) instead of creating a new one —
                    matches graphs by spec \`key\` against the page's stored key→trackingId map, so a
                    revision edits sections in place instead of minting a duplicate page. The page's title
                    updates if changed; its slug (URL) never does, even then.
  --note "..."     annotate this --update in the report's revision log (why the spec changed)
  --replace        delete any existing page at this spec's target slug, then build fresh — same page id
                    and reports_snap_2 row this template would otherwise reconcile via --update, but
                    starting clean instead of reconciling. Use when a structural change (a retired
                    framework section, a renamed key) means --update's sweep wouldn't clean up what's
                    there, and re-authoring every field by hand isn't worth it — mutually exclusive with
                    --update. The new page's id changes; anything that linked to the old id (not the
                    slug) breaks.
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
const REPLACE = flags.has('--replace');

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

// Exact port of the DMS page editor's own toSnakeCase()
// (packages/dms/src/patterns/page/pages/_utils/index.js) — same regex, same
// behavior. Same port convention as the Python converter's to_snake_case()
// (convert_old_reports_lib/pages.py).
function toSnakeCase(str) {
  if (!str) return str;
  const parts = String(str).match(/[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/g);
  return parts ? parts.map((x) => x.toLowerCase()).join('_') : str;
}

// The page slug this spec builds to, absent an explicit `--update` target —
// shared by the fresh-create branch and the `--replace` preflight above it,
// so the two can never compute a different slug for the same spec (which
// would make --replace delete the wrong page, or fail to delete the right
// one). ALWAYS derived from `spec.title` via toSnakeCase — same algorithm the
// admin UI's own getUrlSlug() uses, and the same one the DMS page editor
// recomputes url_slug to on every title save (round 63/65 of
// old-reports-conversion.md). A spec used to be able to hardcode a `slug`
// field that diverged from its own title (`spec.slug || ...`, and a
// different, non-matching fallback algorithm besides) — that divergence is
// exactly what silently broke the moment anyone saved the page in the admin
// UI (title save wins, no warning), which is what caused the golden-corpus
// probe manifest to drift out from under 4 real pages 3 times
// (2026-08-24/25/31). Computing the same slug the UI converges to means a
// save is a no-op on the slug — it can never drift again. `spec.slug` is no
// longer read; existing specs that set it are unaffected as long as it
// already matched toSnakeCase(title) (true for every real production spec in
// dynamic_report_specs/ as of 2026-08-31 — only the 4 probe-fixture
// golden-corpus specs actually diverged).
function computeTargetSlug() {
  const parentSlug = spec.parent || DEFAULT_PARENT_SLUG;
  return `${parentSlug}/${toSnakeCase(spec.title)}`;
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
  for (const key of ['title', 'description', 'slug', 'parent']) {
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
// section all share it.
//
// CORRECTED 2026-08-12: this used to gate on the `_infoBoxPick`/`_routeComparePick`
// marker composeInfoBoxGraphState/composeRouteCompareGraphState stamp onto every
// build THIS SCRIPT makes — but that marker is a report_build.mjs-only convention
// invented after Design Push #2; convert_old_reports.py (grep confirms: zero hits
// anywhere in convert_old_reports_lib) NEVER stamps it on any section it builds.
// So any Route Compare or Info Box section the Python converter built —
// successfully, no gap logged — was completely invisible to `--from-page`: not
// flagged `_needsReview` like an AVL Graph section with the same problem, just
// silently absent from graphSections and therefore the reconstructed spec. Found
// live 2026-08-12 comparing `annual_average_study`'s old template (id 278) against
// its current spec: 2 real "Route Compare Component" panels existed in the old
// template's graph_comps and were converted into real sections on the original
// page (confirmed via that conversion's own gap log showing `extra_measures_dropped`
// activity for both) — neither survived into the spec-driven rebuild.
//
// Fixed by matching structure instead of a marker only this script's own output
// carries:
//  - self-bound at all: an enabled `comparison_series` subscriber wired to the
//    `$self` sentinel (`SELF_PARAM_KEY_SENTINEL`, buildUdaConfig.js) — the EXACT
//    condition the live runtime's own `findSelfBoundGraphs` uses to decide a
//    section is a graph/stat consumer at all, not just this script's own
//    convention. Rules out the page's own Add-a-Route section (a verbatim
//    template clone with no such subscriber) the same as the marker check did.
//  - Route Compare vs Info Box, once self-bound: `ensure_route_compare_template`
//    (route_compare_template.py:53) always mints a `type: "delta"` column — Info
//    Box templates never have one. A durable, marker-independent tell.
function isGraphSectionElement(s) {
  const type = s.data.element['element-type'];
  if (['AVL Graph', 'Map'].includes(type)) return true;
  if (type !== 'Spreadsheet') return false;
  try {
    const state = JSON.parse(s.data.element['element-data']);
    if (state._infoBoxPick || state._routeComparePick) return true;
    const subscribers = state.display?._functions?.subscribers;
    return Array.isArray(subscribers) && subscribers.some(
      sub => sub?.functionId === 'comparison_series' && sub?.enabled && sub?.paramKey === '$self');
  } catch { return false; }
}

// ── --from-page: reverse a live page back into a spec ──────────────────────
function runFromPage(pageArg, outPath) {
  const page = dms(['page', 'show', pageArg, '--pattern', PATTERN]);
  const pageId = page?.id;
  if (!pageId) fail(`page "${pageArg}" not found.`);
  // `page show` doesn't return `filters` — only `raw get` returns the full row.
  // Needed to detect whether this page is a Dynamic Report (a `routeSlots`-typed
  // filter) — a page built before this feature (every old-report/template
  // conversion, including all 12 Dynamic Report catalog templates) has this
  // exact shape too, just never round-tripped through report_build.mjs before.
  const rawPage = dms(['raw', 'get', String(pageId)]);
  const isDynamicReport = (rawPage?.data?.filters || []).some(f => f.type === 'routeSlots');
  const snap = findSnapRow(pageId);
  if (!snap) fail(`no reports_snap_2 row found for page ${pageId} — this page was never built by `
    + `report_build.mjs, so there's nothing to reverse.`);
  if (snap.data.routes === undefined) {
    fail(`page ${pageId}'s reports_snap_2 row (id ${snap.id}) uses the OLD old-report-conversion shape `
      + `(route_comps/graph_comps), not report_build.mjs's routes[] shape. --from-page only supports `
      + `pages in this spec-driven builder's own shape.`);
  }

  const dump = dms(['page', 'dump', String(pageId), '--sections']);
  // `_expanded_sections` is built by unioning `page.data.sections` (published)
  // and `page.data.draft_sections` (draft) ids, deduped only by ROW id — a
  // page with `has_changes: false` (published matches draft, the common case)
  // has TWO rows per trackingId, so every downstream trackingId-keyed lookup
  // would silently double-count unless deduped here first. Found while wiring
  // Dynamic Report slot support, 2026-08-11, against `one_week_study` (its
  // first real exercise against an already-published page) — a real,
  // separate, pre-existing gap in this reconstruction, not introduced by
  // slots. Prefer the draft copy (what `--update` always edits and what a
  // rebuild should reproduce) when both exist.
  const draftIds = new Set((dump?.data?.draft_sections || []).map(s => s.id || s));
  function dedupeByTrackingId(list) {
    const byTid = new Map();
    for (const s of list) {
      const tid = s.data.trackingId;
      const existing = byTid.get(tid);
      if (!existing || (draftIds.has(String(s.id)) && !draftIds.has(String(existing.id)))) byTid.set(tid, s);
    }
    return [...byTid.values()];
  }
  const sections = dedupeByTrackingId(dump?._expanded_sections || []);
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
    if (!drifted) {
      console.error(`(page ${pageId} matches its stored spec exactly — echoing it back, no live reconstruction needed)`);
      writeSpecOut(stored, outPath);
      return;
    }
    console.error(`note: page ${pageId}'s live sections have drifted from the stored spec (hand-edited?) — reconstructing from live state instead`);
  }

  const routeEntries = JSON.parse(snap.data.routes || '[]');
  const graphSections = sections.filter(isGraphSectionElement);
  // Route→graph assignment must be reconstructed from each GRAPH's own live
  // `_measurePick.routeIds` (design push #2's real routing field, keyed by
  // `route_comp_id`), never from a route's own `graphIds` — that field is
  // dead write-once bookkeeping from conversion time (see useGraphPublish.js's
  // own header comment) and can reference `route_comp_id`s that no longer
  // exist at all (a route deleted/consolidated after conversion, its old
  // comp ids never scrubbed from the graphs that used to reference them).
  // Found live 2026-08-11 on `Single Route`: its AVL Graph sections' routeIds
  // included `comp-1`/`comp-3`/`comp-5`, none of which match any of the
  // page's 3 CURRENT routes (`comp-0`/`comp-2`/`comp-4`) — using `graphIds`
  // instead would have silently produced a spec with wrong/broken route
  // assignments. Index-aligned with `graphSections`/`graphs` below; filled in
  // per-branch since Map/Spreadsheet sections don't already parse `state`
  // the same way AVL Graph sections do.
  const graphLiveRouteIds = [];
  const graphs = graphSections.map((s, i) => {
    const key = `g${i + 1}`;
    const elType = s.data.element['element-type'];
    if (elType === 'Map') {
      let mapState = {};
      try { mapState = JSON.parse(s.data.element['element-data']); } catch { /* leave {} */ }
      const pick = mapState._routeMapPick || null;
      graphLiveRouteIds[i] = mapState.display?._measurePick?.routeIds || [];
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
      graphLiveRouteIds[i] = state.display?._measurePick?.routeIds || [];
      if (state._routeComparePick) {
        // RouteCompare's anchor/compare rows are order-based (whichever route
        // is first on the page), not a per-graph routeIds field — report-spec.md
        // documents it has no `_measurePick` concept of its own. If a live
        // section somehow does carry routeIds anyway, use them; otherwise this
        // stays [] and the route-assignment pass below falls back to "every
        // current route" for it, matching how it actually behaves at runtime.
        return { key, title: s.data.title || undefined, graphType: 'RouteCompare', measure: state._routeComparePick.measure };
      }
      if (state._infoBoxPick) {
        const pick = state._infoBoxPick;
        return {
          key, title: s.data.title || undefined, graphType: 'InfoBox',
          measure: pick.measure, grain: pick.grain || 'route',
          ...(pick.bin ? { bin: pick.bin } : {}),
        };
      }
      // No marker (a convert_old_reports.py-built section — see
      // isGraphSectionElement's 2026-08-12 correction above) — tell Route
      // Compare and Info Box apart by the one structural difference between
      // them (route_compare_template.py always mints a `type: "delta"`
      // column; Info Box never does), and flag the measure `_needsReview`
      // rather than guess it from a column's `customName` text, same honesty
      // rule the AVL Graph/Route Map fallbacks above already follow.
      const isRouteCompare = (state.columns || []).some(c => c.type === 'delta');
      return isRouteCompare
        ? { key, title: s.data.title || undefined, graphType: 'RouteCompare', measure: null,
            _needsReview: 'Route Compare measure not recoverable from this section (built by convert_old_reports.py, which never stamped the _routeComparePick marker) — re-pick manually' }
        : { key, title: s.data.title || undefined, graphType: 'InfoBox', measure: null, grain: 'route',
            _needsReview: 'Info Box measure/grain not recoverable from this section (built by convert_old_reports.py, which never stamped the _infoBoxPick marker) — re-pick manually' };
    }
    let state = {};
    try { state = JSON.parse(s.data.element['element-data']); } catch { /* leave {} */ }
    const pick = state.display?._measurePick || {};
    graphLiveRouteIds[i] = pick.routeIds || [];
    const invert = !!state.comparisonSeries?.combine?.invert;
    // Old-report/template conversions (convert_old_reports.py) never call
    // applyMeasurePick — they clone a shared graph-template row instead — and
    // Design-Push-2's later routing retrofit (section_builders.py) OVERWRITES
    // `_measurePick` wholesale with only weekdays/start/end/routeIds, wiping
    // whatever the template row may have carried. Found while wiring Dynamic
    // Report slot support, 2026-08-11 — a real, separate, pre-existing gap in
    // this reconstruction, not introduced by slots (every one of the 12
    // catalog templates hits this for every AVL Graph section). `display.
    // graphType` is the renderer's own field and survives independently, so
    // it's a reliable fallback; there's no equally durable field for measure/
    // resolution/comparisonMode without reverse-matching the raw column
    // expression against the live vocabulary (would need booting Vite here,
    // deliberately not done) — flag those as unrecoverable instead of
    // silently writing `undefined`, the same honesty this function already
    // gives Map/InfoBox/RouteCompare above.
    const graphType = pick.graphType || state.display?.graphType;
    const missing = ['measure', 'resolution', 'comparisonMode'].filter(f => pick[f] == null);
    const notes = [];
    if (invert) notes.push('comparisonMode is "difference" with combine.invert set — the original `anchor` route id is not recoverable; re-specify anchor by hand');
    if (missing.length) notes.push(`${missing.join('/')} not recoverable from this section (converted before applyMeasurePick ever composed it; display.graphType survives as a fallback but the rest was wiped by Design-Push-2's _measurePick retrofit) — re-pick manually`);
    // `_measurePick.routeWindows` (weekdays/startTime/endTime, per assigned route) IS present on
    // this live section, but translating it back into `weekdays`/`startTime`/`endTime`/
    // `routeWindows` on the reconstructed GRAPH — including collapsing back to a bare graph-level
    // default when every route's single variant happens to agree — isn't built yet. Flagged, not
    // silently dropped: re-specify the window by hand until this is written.
    if (pick.routeWindows && Object.keys(pick.routeWindows).length) {
      notes.push('weekdays/startTime/endTime not recoverable from this section yet (routeWindows recovery isn\'t built) — re-specify by hand');
    }
    return {
      key, title: s.data.title || undefined,
      graphType, measure: pick.measure, resolution: pick.resolution,
      comparisonMode: pick.comparisonMode,
      ...(state.display?.description ? { caption: state.display.description } : {}),
      ...(notes.length ? { _needsReview: notes.join('; ') } : {}),
    };
  });

  // `route_comp_id` -> spec-local id, built from ALL entries (slot or concrete)
  // before the main pass — a route's `derivedFromRoute` may point at either
  // kind of sibling, and forward references (deriving from a route declared
  // later in the array) are legal, same as the forward build direction allows.
  const specIdByCompId = new Map(routeEntries.map((e, i) => [e.route_comp_id, `r${i + 1}`]));
  // Reverse-lookup: which graphs' live routeIds include this route's
  // route_comp_id (see graphLiveRouteIds' own note above for why this, not
  // `e.graphIds`, is the correct source). A RouteCompare graph with no
  // per-graph routeIds recorded (the normal case — see its branch above)
  // falls back to "every current route", matching its real order-based,
  // not field-based, runtime behavior; any OTHER graph type with an empty
  // routeIds list genuinely feeds nothing, and stays that way.
  function feedsGraphKeysFor(compId) {
    return graphs
      .filter((g, gi) => (graphLiveRouteIds[gi]?.length ? graphLiveRouteIds[gi].includes(compId) : g.graphType === 'RouteCompare'))
      .map(g => g.key);
  }
  const routes = routeEntries.map((e, i) => {
    // A Dynamic Report route slot (see useDynamicReportRoutes.js) has no `id`/
    // `route_id`/`tmc_array` — those get overlaid live, never persisted. This
    // is the only reliable discriminator: a concrete route entry always has
    // one or the other (report_build.mjs writes `id: r.route_id`; the old
    // converter writes both `id` and `route_id`).
    const isSlot = e.route_id == null && e.id == null;
    // A derived date's persisted literal startDate/endDate is inert (always
    // superseded live once the formula resolves, which it always will for a
    // valid base) — reconstruct the clean formula-only shape rather than
    // carrying the stale literal forward. `derivedFromRoute` translates the
    // persisted `route_comp_id` back to a spec-local id (or passes `__TODAY__`
    // through unchanged) — the reverse of the write-time translation.
    const derived = e.dateFormula ? {
      dateFormula: e.dateFormula,
      derivedFromRoute: e.derivedFromRoute === TODAY_ANCHOR_COMP_ID
        ? TODAY_ANCHOR_COMP_ID
        : (specIdByCompId.get(e.derivedFromRoute)
          ?? (() => { throw new Error(`route ${i + 1} ("${e.name}") has derivedFromRoute "${e.derivedFromRoute}", which matches no sibling's route_comp_id — data looks corrupt.`); })()),
    } : {};
    // `e.weekdays`/the combined-datetime's time component may still be sitting on a live route's
    // own persisted fields (RouteRow.jsx's old storage, gaps #10/#11) — but weekdays/startTime/
    // endTime moved to graphs[] in the spec format, so they are deliberately NOT recovered onto
    // the reconstructed route here (routes[] would fail this script's own validation if they
    // were). RouteRow.jsx's own weekday-toggle/peak-preset UI is slated for removal (it writes a
    // field nothing reads anymore) — tracked separately, not done as part of this reconstruction
    // fix. See the graph reconstruction below for the real recovery path
    // (`_measurePick.routeWindows`, flagged `_needsReview` — not built yet).
    const start = derived.dateFormula ? {} : splitDateTime(e.startDate);
    const end = derived.dateFormula ? {} : splitDateTime(e.endDate);
    if (isSlot) {
      return {
        id: `r${i + 1}`,
        slot: true,
        name: e.name,
        ...(e.route_slot_group ? { route_slot_group: e.route_slot_group } : {}),
        ...(e.isPlaceholderName ? { isPlaceholderName: true } : {}),
        ...derived,
        ...(e.color ? { color: e.color } : {}),
        graphs: feedsGraphKeysFor(e.route_comp_id),
      };
    }
    return {
      id: `r${i + 1}`,
      route_id: Number(e.route_id ?? e.id),
      name: e.name,
      ...derived,
      ...(start.date ? { startDate: start.date } : {}),
      ...(end.date ? { endDate: end.date } : {}),
      ...(e.color ? { color: e.color } : {}),
      graphs: feedsGraphKeysFor(e.route_comp_id),
    };
  });

  // `tags`/`difficulty` round-trip (catalog metadata) — `page_path`/`graph_count`/
  // `counts_label` deliberately don't: they're derived fresh from the spec at build
  // time (see the `catalogFields` note near the snap-row write), so recovering their
  // OLD persisted values here would just reintroduce the exact staleness problem this
  // whole design avoids.
  writeSpecOut({
    title: page.title,
    slug: page.url_slug,
    ...(isDynamicReport ? { dynamicReport: true } : {}),
    ...(snap.data.description ? { description: snap.data.description } : {}),
    ...(snap.data.tags ? { tags: snap.data.tags } : {}),
    ...(snap.data.difficulty !== undefined ? { difficulty: snap.data.difficulty } : {}),
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
  // A `slot` route (Dynamic Report only) has no route_id yet — it's resolved by
  // whoever views the page, via `?routes=`. Route slots have no meaning outside
  // a Dynamic Report (there are exactly 12 of these today, all gated on
  // `spec.dynamicReport`) — never inferred from a missing `route_id` alone, so a
  // plain typo (forgetting `route_id`) fails loudly instead of silently becoming
  // a slot.
  if (r.slot) {
    if (!spec.dynamicReport) fail(`route "${r.id}" has \`slot: true\`, but \`dynamicReport\` isn't set on the spec — a route slot only means something on a Dynamic Report (see report-spec.md).`);
    if (r.route_id) fail(`route "${r.id}" has both \`slot: true\` and \`route_id\` — a slot has no route yet by definition; drop one or the other.`);
  } else if (!r.route_id) {
    fail(`route "${r.id}" needs a \`route_id\` (its DMS id in the Routes Data dataset), or \`slot: true\` if this is a Dynamic Report route slot.`);
  }
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
  // weekdays/startTime/endTime moved OFF routes[] and onto graphs[] — they only ever took
  // effect through the GRAPH's own `_measurePick` (useGraphPublish.js reads exactly
  // `route.startDate`/`route.endDate` here, nothing else off the route) — so a route still
  // carrying one is a stale spec, not a value that would just be silently ignored.
  if (r.weekdays !== undefined) fail(`route "${r.id}" has \`weekdays\` — that field now lives on graphs[] (see report-spec.md), not routes[]. Move it onto whichever graph(s) this route feeds.`);
  if (r.startTime !== undefined || r.endTime !== undefined) fail(`route "${r.id}" has \`startTime\`/\`endTime\` — those fields now live on graphs[] (see report-spec.md), not routes[]. Move them onto whichever graph(s) this route feeds, or into that graph's \`routeWindows\` if different routes on the same graph need different windows.`);
}

// ── relative-date formula validation (Mechanism B) ─────────────────────────
// `dateFormula`/`derivedFromRoute` are paired: a route deriving its date live
// (from another route in this same spec, or the synthetic "Today (view time)"
// anchor) never carries a literal startDate/endDate — those get computed at
// VIEW time by the exact same resolver loaded above, never persisted. Runs as
// its own pass (after every route's `id` is known) so `derivedFromRoute` can
// reference a route declared later in the array — forward references are
// legal, same as `routes[].graphs`/`graphs[].anchor` already allow.
const routeById = new Map(spec.routes.map(r => [r.id, r]));
for (const r of spec.routes) {
  if (!r.dateFormula && !r.derivedFromRoute) continue;
  if (!r.dateFormula || !r.derivedFromRoute) {
    fail(`route "${r.id}" has \`${r.dateFormula ? 'dateFormula' : 'derivedFromRoute'}\` but not the other — both are required together.`);
  }
  if (!CALENDAR_POSITION_REGEX.test(r.dateFormula) && !RELATIVE_DATE_REGEX.test(r.dateFormula)) {
    fail(`route "${r.id}" has an invalid \`dateFormula\` "${r.dateFormula}" — see relativeDateResolution.js's RELATIVE_DATE_REGEX/CALENDAR_POSITION_REGEX (or report-spec.md) for the grammar.`);
  }
  if (r.derivedFromRoute === r.id) fail(`route "${r.id}" has \`derivedFromRoute\` pointing at itself.`);
  if (r.derivedFromRoute !== TODAY_ANCHOR_COMP_ID) {
    const base = routeById.get(r.derivedFromRoute);
    if (!base) fail(`route "${r.id}" has \`derivedFromRoute: "${r.derivedFromRoute}"\`, which is not any route's \`id\` in this spec (use the literal "${TODAY_ANCHOR_COMP_ID}" to derive from the Today anchor instead).`);
    // Single-hop only — mirrors resolveRouteDates' own constraint (a base is
    // never itself derived). A spec that violates this would silently fail to
    // resolve at view time with no error, so this is a hard build error, not a
    // warning — see "A derive-from base can never itself be derived" in
    // traversing-report-pages.md.
    if (base.dateFormula) fail(`route "${r.id}" derives from "${r.derivedFromRoute}", but that route is itself derived (has its own \`dateFormula\`) — no 2-hop chaining. Point "${r.id}" at whatever "${r.derivedFromRoute}" itself derives from instead.`);
  }
  if (r.startDate || r.endDate) {
    console.warn(`  note: route "${r.id}" has both \`dateFormula\` and a literal \`startDate\`/\`endDate\` — the literal is inert and will be superseded live by the formula every time it resolves (which it always will, for a valid "${r.derivedFromRoute}" base). Drop the literal unless you specifically want a fallback for the (should-never-happen) case the formula fails to resolve.`);
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

// ── weekdays/startTime/endTime/routeWindows (graph-level — see the routes[] loop above for
// why these no longer live on routes[]) ────────────────────────────────────
// No graph-type restriction: unlike `resolution`/`comparisonMode`/`caption`, weekdays/time-of-
// day apply identically to AVL Graph, Map, InfoBox, and RouteCompare (all four ride the same
// `comparison_series`/`findSelfBoundGraphs` mechanism in useGraphPublish.js — confirmed by
// reading it directly, not assumed; see the live AM/PM test in traversing-report-pages.md).
for (const g of spec.graphs) {
  if (g.startTime !== undefined || g.endTime !== undefined) {
    if (!HHMM_RE.test(g.startTime || '') || !HHMM_RE.test(g.endTime || '')) {
      fail(`graph "${g.key}" has \`startTime\`/\`endTime\` but one is missing or not "HH:mm" — both are required together, 24-hour, e.g. "07:00"/"10:00".`);
    }
  }
  if (g.routeWindows === undefined) continue;
  if (typeof g.routeWindows !== 'object' || g.routeWindows === null || Array.isArray(g.routeWindows)) {
    fail(`graph "${g.key}"'s \`routeWindows\` must be an object keyed by routes[].id.`);
  }
  for (const [routeId, variants] of Object.entries(g.routeWindows)) {
    // Deliberately checked against `g._assigned`, not `spec.routes` as a whole — routeWindows
    // REFINES how an already-assigned route is filtered, it is never a second way to assign a
    // route to a graph. `routes[].graphs` stays the one place "which routes feed this graph" is
    // decided.
    if (!g._assigned.some(r => r.id === routeId)) {
      fail(`graph "${g.key}"'s \`routeWindows\` names "${routeId}", which isn't assigned to this graph (no route with that id lists "${g.key}" in its own \`graphs\`).`);
    }
    if (!Array.isArray(variants) || !variants.length) {
      fail(`graph "${g.key}"'s \`routeWindows["${routeId}"]\` must be a non-empty array — one entry per time this route should appear on the graph (almost always just one; 2+ means the SAME route shown more than once, e.g. once per peak window, instead of assigning it twice under different ids).`);
    }
    for (const v of variants) {
      if (v.startTime !== undefined || v.endTime !== undefined) {
        if (!HHMM_RE.test(v.startTime || '') || !HHMM_RE.test(v.endTime || '')) {
          fail(`graph "${g.key}"'s \`routeWindows["${routeId}"]\` has a variant with \`startTime\`/\`endTime\` but one is missing or not "HH:mm".`);
        }
      }
    }
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
  console.log(`  slug: ${computeTargetSlug()}`);
  if (spec.request) console.log(`\nClient request:\n  "${spec.request}"`);
  console.log(`\nRoutes (${spec.routes.length} instance${spec.routes.length === 1 ? '' : 's'}):`);
  for (const r of spec.routes) {
    const window = r.startDate && r.endDate
      ? `${r.startDate} → ${r.endDate}`
      : 'no date window (all available dates)';
    console.log(`  • ${r._name}`);
    console.log(`      route ${r.route_id} · ${window} · feeds: ${(r.graphs || []).join(', ') || 'NOTHING'}`);
    if (r.confidence) console.log(`      confidence: ${r.confidence.level}${r.confidence.note ? ` — ${r.confidence.note}` : ''}`);
  }
  const lowConf = lowConfidenceRoutes(spec);
  if (lowConf.length) {
    console.log(`\n⚠ NEEDS REVIEW — ${lowConf.length} route(s) marked low-confidence:`);
    for (const r of lowConf) console.log(`  • ${r._name}${r.confidence.note ? `: ${r.confidence.note}` : ''}`);
  }
  console.log(`\nGraphs (${spec.graphs.length}):`);
  // Semantics per useGraphPublish.js:34 — ONLY an explicit `false` excludes a day, so an absent
  // key means included. Enumerate all seven and subtract.
  const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const windowLabel = (weekdays, startTime, endTime) => {
    const included = weekdays ? DAYS.filter(d => weekdays[d] !== false) : DAYS;
    const days = weekdays && included.length < 7 ? included.map(d => d.slice(0, 3)).join(',') : 'all days';
    const time = startTime && endTime ? `${startTime}-${endTime}` : 'all day';
    return `${time}, ${days}`;
  };
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
    if (g.routeWindows && Object.keys(g.routeWindows).length) {
      for (const [routeId, variants] of Object.entries(g.routeWindows)) {
        variants.forEach((v, vi) => console.log(`      ${routeId}${variants.length > 1 ? ` (${vi + 1}/${variants.length})` : ''}: ${windowLabel(v.weekdays, v.startTime, v.endTime)}`));
      }
      const overridden = new Set(Object.keys(g.routeWindows));
      const defaulted = g._assigned.filter(r => !overridden.has(r.id));
      if (defaulted.length) console.log(`      ${defaulted.map(r => r.id).join(', ')}: ${windowLabel(g.weekdays, g.startTime, g.endTime)} (graph default)`);
    } else {
      console.log(`      window: ${windowLabel(g.weekdays, g.startTime, g.endTime)}`);
    }
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
  // `page show` doesn't return `filters` (confirmed by reading its output) —
  // only `raw get` returns the full row. Needed to decide whether this page
  // already has the routeSlots/baseDate pair `dynamicReport: true` requires.
  const rawPage = dms(['raw', 'get', String(pageId)]);
  updateCtx = {
    pageId,
    slug: page.url_slug,
    currentTitle: page.title,
    snapId: snap.id,
    oldSpec: snap.data._spec ? JSON.parse(snap.data._spec) : null,
    oldKeyMap: JSON.parse(snap.data._specKeyMap),
    oldRevisions: snap.data._specRevisions ? JSON.parse(snap.data._specRevisions) : [],
    sections: dump?._expanded_sections || [],
    existingFilters: rawPage?.data?.filters || [],
  };
  console.log(`reconciling into existing page ${pageId} (${updateCtx.slug})`);
}

// ── --replace preflight: delete any existing page at this spec's target slug,
// so the build below always takes the fresh-create path — never --update's
// reconcile path, whose section-deletion sweep only covers AVL Graph/Map/
// Spreadsheet types (see the comment above it) and so won't clean up e.g. a
// retired framework section (the title-block section retired 2026-08-17) left
// over from a page an older version of this script built. ──────────────────
if (REPLACE) {
  if (UPDATE_PAGE) fail('--replace and --update are mutually exclusive — --replace deletes and rebuilds fresh, --update reconciles in place.');
  const targetSlug = computeTargetSlug();
  // `dms page show` exits non-zero (throws, via execFileSync) for a slug that
  // doesn't exist yet — a normal, expected case here (the spec's first-ever
  // build), not a real error, so this is deliberately swallowed rather than
  // passed to `fail()` the way a genuine --update lookup failure is above.
  let existing = null;
  try { existing = dms(['page', 'show', targetSlug, '--pattern', PATTERN]); } catch { /* not found */ }
  if (existing?.id) {
    // `page delete` only deletes the page row itself — it does NOT cascade to the
    // page's own `reports_snap_2` row (a completely separate dataset/type, found the
    // same way `--update`'s preflight above does). Missing this the first time
    // --replace shipped left every rebuilt report with an orphaned snap row still
    // carrying the OLD report_id — invisible on the page itself, but very visible on
    // `/reports`, whose catalog cards are populated by querying `reports_snap_2`
    // directly (by tag, not by page reference) and so render BOTH the orphan and the
    // fresh row as separate cards for the same report. Found live 2026-08-17 the first
    // time all 12 templates were --replace'd in one session — 16 orphaned rows
    // accumulated (some templates had 3-4, going back to before --replace even
    // existed) before this was caught and cleaned up by hand. Delete it BEFORE the
    // page itself, while `existing.id` still resolves it.
    const staleSnap = findSnapRow(existing.id);
    // `--dry-run`'s own contract ("no writes") wins over --replace's delete —
    // report the deletion that WOULD happen without actually doing it, same
    // as every other write below being skipped under DRY_RUN.
    if (DRY_RUN) {
      console.log(`--replace --dry-run: would delete existing page ${existing.id} (${targetSlug})`
        + (staleSnap ? ` and its reports_snap_2 row ${staleSnap.id}` : ''));
    } else {
      if (staleSnap) dms(['raw', 'delete', APP, REPORTS_SNAP_TYPE, String(staleSnap.id)]);
      dms(['page', 'delete', String(existing.id), '--pattern', PATTERN]);
      console.log(`--replace: deleted existing page ${existing.id} (${targetSlug})`
        + (staleSnap ? ` and its reports_snap_2 row ${staleSnap.id}` : ' (no reports_snap_2 row found)'));
    }
  } else {
    console.log(`--replace: no existing page at ${targetSlug} yet — building fresh`);
  }
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
      // state is actually built. `measure` may be a string or an array of
      // >= 2 (multi-measure — join-compatibility is checked build-side in
      // Python, not duplicated here, see the const above).
      const infoBoxMeasures = measureList(g.measure);
      if (!infoBoxMeasures.length) fail(`graph "${g.key}": Info Box needs \`measure\` (a string, or an array of 2+ for a multi-measure box).`);
      for (const m of infoBoxMeasures) {
        if (!INFO_BOX_MEASURES.includes(m)) fail(`graph "${g.key}": unknown Info Box measure "${m}". Known: ${INFO_BOX_MEASURES.join(', ')}`);
      }
      if (g.grain && !['route', 'tmc'].includes(g.grain)) fail(`graph "${g.key}": Info Box grain must be "route" or "tmc", got "${g.grain}".`);
      if (infoBoxMeasures.includes('reliability') && !INFO_BOX_BINS.includes(g.bin)) fail(`graph "${g.key}": Info Box measure "reliability" needs \`bin\` — one of ${INFO_BOX_BINS.join(', ')} (AM Peak/Midday/PM Peak/Weekend — the only four periods source 1410 precomputes).`);
      if (g.caption) fail(`graph "${g.key}": Info Box has no caption/description render path (Spreadsheet has no GraphTitle-equivalent, unlike AVL Graph) — drop \`caption\` or move this graph to an AVL Graph type.`);
      continue;
    }
    if (g.graphType === 'RouteCompare') {
      // Route Compare Component is not an AVL Graph either — no `resolution`,
      // no `applyMeasurePick`, and (like Info Box) no caption render path.
      // See composeRouteCompareGraphState below for how its state is built.
      // `measure` may be a string or array of both ROUTE_COMPARE_MEASURES
      // entries (multi-measure — no join-compatibility concern here, both
      // measures already share the same join, see the const above).
      const compareMeasures = measureList(g.measure);
      if (!compareMeasures.length) fail(`graph "${g.key}": Route Compare needs \`measure\` (a string, or an array of both for a 2-measure box).`);
      for (const m of compareMeasures) {
        if (!ROUTE_COMPARE_MEASURES.includes(m)) fail(`graph "${g.key}": unknown Route Compare measure "${m}". Known: ${ROUTE_COMPARE_MEASURES.join(', ')}`);
      }
      if (g.caption) fail(`graph "${g.key}": Route Compare has no caption/description render path (Spreadsheet has no GraphTitle-equivalent, unlike AVL Graph) — drop \`caption\` or move this graph to an AVL Graph type.`);
      continue;
    }
    if (!graphTypes.has(g.graphType)) fail(`graph "${g.key}": unknown graphType "${g.graphType}". Known: ${[...graphTypes].join(', ')}`);
    if (!vocab.measures[g.measure]) fail(`graph "${g.key}": unknown measure "${g.measure}". Known: ${Object.keys(vocab.measures).join(', ')}`);
    if (!vocab.resolutions[g.resolution]) fail(`graph "${g.key}": unknown resolution "${g.resolution}". Known: ${Object.keys(vocab.resolutions).join(', ')}`);
    // composeMeasureConfig returns null (composes nothing) for this one combo — its own
    // comment explains why (avgHoursOfDelay's summary value is bucket-grain-dependent, no
    // equivalent of expressions.py's per-grain _avg_delay_summary_expr exists in the live
    // picker). report_build.mjs never checks applyMeasurePick's return value (matching the
    // live UI's own fire-and-forget call), so without this check a build would silently
    // write an uncomposed, broken section instead of failing loudly.
    if (g.resolution === 'summary' && g.measure === 'avgHoursOfDelay') fail(`graph "${g.key}": Bar Graph "summary" resolution doesn't support measure "avgHoursOfDelay" yet — its whole-range value depends on which time grain it's averaged from (day/weekday/5-minutes all give different numbers), and there's no live-picker equivalent of the old converter's per-grain expression. Pick a different measure, or use a normal time-bucketed resolution instead.`);
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
    // NPMRDS's own per-graph-type default legend position — seeded once, here, at composition
    // time, same seed point + reasoning as useAddGraphSection.js's own call (see
    // composeMeasureConfig.js's DEFAULT_LEGEND_POSITION_BY_GRAPH_TYPE doc comment).
    cmc.applyDefaultLegendPosition(state, g.graphType);
    const dwAPI = {
      setState: (fn) => fn(state),
      reconcileComparisonSeriesColumn: () => reconcileComparisonSeriesColumn(state),
    };
    mp.applyMeasurePick({ state, dwAPI, currentComponent: avlGraph }, {
      graphType: g.graphType,
      measure: g.measure,
      resolution: g.resolution,
      comparisonMode: g.comparisonMode || 'plain',
      // Lets composeMeasureConfig tell a real single-route magnitude BarGraph
      // (day/weekday/month breakdown of ONE route) apart from a genuine
      // multi-route comparison sharing the same x-axis — see its own comment
      // on `isSingleSeriesBarGraph`. Known here (unlike the live picker,
      // which only has this if a route was already assigned) because the
      // spec's route→graph assignment (`g._assigned`) is already resolved
      // above.
      seriesCount: g._assigned.length,
    });
    // The spec's explicit anchor, honored without reordering routes. Only set
    // when true so a normal-order difference graph's state stays byte-identical
    // to what the UI produces.
    if (g._invert) {
      state.comparisonSeries.combine = { ...(state.comparisonSeries.combine || {}), invert: true };
    }
    // No in-card chart title: the Section's own `title` (graphSectionData,
    // rendered by the generic section-header band — the same band Quick
    // Controls attaches to) is the one place a graph's title shows now.
    // Writing it into state.display.title too used to double it (once above
    // the card, once inside it) — see report-route-ui-parity-gaps.md.
    // `state.display.description` (below) is a different field — the
    // difference-mode subtitle — and keeps rendering inside the card via
    // GraphComponent.jsx's GraphTitle.
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
// planning/transportny/tasks/current/client-request-to-report-skill.md's 2026-07-27
// correction for why this wiring, not a from-scratch Map builder, was the
// actual gap. `opts.tmcs`/`startDate`/`endDate` are omitted for a --dry-run
// preview (year/shape only, placeholder paint); a real build calls this again
// after routes are resolved from the catalog, with real tmcs/dates, to get a
// choropleth baked from this report's own data.
function composeMapGraphState(g, { tmcs, startDate, endDate } = {}) {
  const years = (g._assigned || [])
    .map(r => (r.endDate || r.startDate || '').slice(0, 4))
    .filter(Boolean).map(Number);
  // No literal date anywhere across every assigned route — the normal case for a
  // Dynamic Report graph fed only by slot/derived routes, which never have a
  // build-time-resolvable date at all (their date is computed live, at view time).
  // Fall back to the current calendar year for the network geometry rather than
  // hard-failing the build: this only affects WHICH TMC-network vintage's geometry
  // renders as the placeholder backdrop (cosmetic), not the live choropleth
  // query/color, which re-bakes from the viewer's actually-resolved route/date once
  // picked (see the re-bake loop below, called again after route resolution).
  const year = years.length ? Math.max(...years) : new Date().getFullYear();
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
  const infoBoxMeasures = measureList(g.measure);
  const args = [CONVERTER_SCRIPT, '--route-info-box-section',
    '--info-box-measure', infoBoxMeasures.join(','), '--grain', grain];
  if (infoBoxMeasures.includes('reliability')) {
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
  let out;
  try {
    out = execFileSync('python3', args, { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    // Python's argparse ap.error() (used for both bad-measure-name and the
    // multi-measure join-compatibility rejection — see
    // check_info_box_measure_combo in info_box_templates.py) prints a clean
    // one-line reason to stderr before exiting nonzero; surface just that
    // instead of a raw execFileSync stack trace.
    const stderr = (e.stderr || '').toString().trim().split('\n').filter(Boolean);
    fail(`graph "${g.key}": Info Box builder rejected this spec:\n${stderr[stderr.length - 1] || e.message}`);
  }
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
  // `measure` stores whatever shape the spec gave (string or array) —
  // round-trips through --from-page unchanged either way.
  built.state._infoBoxPick = { measure: g.measure, grain,
    ...(infoBoxMeasures.includes('reliability') ? { bin: g.bin } : {}) };
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
  const compareMeasures = measureList(g.measure);
  const args = [CONVERTER_SCRIPT, '--route-compare-section', '--compare-measure', compareMeasures.join(',')];
  if (DRY_RUN) args.push('--dry-run');
  let out;
  try {
    out = execFileSync('python3', args, { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    const stderr = (e.stderr || '').toString().trim().split('\n').filter(Boolean);
    fail(`graph "${g.key}": Route Compare builder rejected this spec:\n${stderr[stderr.length - 1] || e.message}`);
  }
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
  // "Spreadsheet"). `measure` stores whatever shape the spec gave (string or
  // array) — round-trips through --from-page unchanged either way.
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
  // A Dynamic Report route slot has no route_id — it's resolved by whoever
  // views the page, via `?routes=` (see useDynamicReportRoutes.js). Nothing to
  // look up at build time; `r._row` stays unset, same as it would for a route
  // no one has ever picked yet.
  if (r.slot) {
    console.log(`  [slot] "${r._name}" — resolved at view time (route_slot_group: ${r.route_slot_group || '(none — one slot per group)'})`);
    continue;
  }
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
    // Real, previously-latent gap found while wiring Dynamic Report slot support,
    // 2026-08-11: leaving `composedStates[i]` untouched here means it stays the
    // `undefined` this graph started as (Map graphs are seeded `undefined` up
    // front, unlike every other graph type) — `JSON.stringify(undefined)` is the
    // JS value `undefined`, not a string, so the section would be WRITTEN WITH NO
    // `element-data` AT ALL, not the "placeholder paint renders" behavior
    // report-spec.md documents (that claim was only ever verified via --dry-run,
    // which calls composeMapGraphState unconditionally — a real build never did
    // until now). Call the same bare compose --dry-run already uses so a real
    // build gets the same valid placeholder shape instead of a broken section.
    console.warn(`  note: graph "${g.key}" (Route Map) has no resolvable tmcs/date range across its assigned routes — choropleth left unbaked, template placeholder paint renders instead`);
    const built = composeMapGraphState(g);
    composedStates[i] = built.state;
    g._mapElementType = built.elementType;
    continue;
  }
  const startDate = [...starts].sort()[0];
  const endDate = [...ends].sort().slice(-1)[0];
  console.log(`  baking Route Map choropleth for "${g.key}" — ${tmcs.size} TMCs, ${startDate}..${endDate}`);
  const built = composeMapGraphState(g, { tmcs: [...tmcs], startDate, endDate });
  composedStates[i] = built.state;
  g._mapElementType = built.elementType;
}

// ── wire route → graph routing onto `_measurePick.routeIds` ────────────────
// Changing this field's shape? Every corpus entry in
// scripts/npmrds-reports/report_probe_fixtures/golden-corpus.json tagged
// "display._measurePick.routeIds" needs re-verifying (`node
// scripts/npmrds-reports/probe_corpus.mjs --only <key>` before/after) — see
// src/dms/skills/regression-testing-npmrds-reports.md.
// Design push #2 (2026-08-06, see useGraphPublish.js's own header comment) moved
// route routing OFF the route (`routes[].graphIds` on the snap row) and ONTO each
// GRAPH's own `display._measurePick.routeIds` — `findSelfBoundGraphs` treats any
// section with an enabled comparison_series `$self` subscriber as self-bound
// regardless of element type, so AVL Graph, Map, and Info Box sections all read
// their assigned routes from this one field now (report-spec.md's "startTime/
// endTime" section live-verified this for Map/InfoBox on 2026-07-28, before this
// script existed). Missing this after the design push meant `_measurePick.routeIds`
// stayed `[]` (composeMeasureConfig has no such field, and Map/InfoBox's compose
// path — convert_old_reports.py — doesn't know about specific route assignments at
// all) — every graph on every spec-built report resolved zero routes, rendering
// completely blank with no error. Confirmed live 2026-08-07 building
// report_probe_fixtures/specs/plain-two-route-linegraph.json: `routes[].graphIds`
// was correctly wired, RRL showed "0 GRAPHS" per route, and no `/graph` query for
// the actual measure ever fired. Runs AFTER the Route Map re-bake loop above,
// which fully replaces `composedStates[i]` for Map graphs and would otherwise
// clobber this. `route_comp_id` here must match `routeEntries`'s own `comp-${i}`
// indexing below exactly — both index into `spec.routes` in declaration order.
{
  const routeCompId = new Map(spec.routes.map((r, i) => [r, `comp-${i}`]));
  for (const [i, g] of spec.graphs.entries()) {
    if (!composedStates[i]) continue; // Route Map with no resolvable tmcs/dates (see its own note above) leaves this undefined — same pre-existing guard, unrelated to this block.
    const state = composedStates[i];
    if (!state.display) state.display = {};
    const routeIds = g._assigned.map(r => routeCompId.get(r));
    // Every assigned route gets its own `_measurePick.routeWindows` entry now — no uniform-check,
    // no silently leaving the window unset when routes disagree (that was never correct: it made
    // a Bar Graph Summary/Route Compare with genuinely different per-row windows silently render
    // every row unfiltered instead of erroring or actually applying each row's own window). A
    // route with an explicit override (`g.routeWindows[route.id]`, validated above — possibly 2+
    // variants, the same route shown more than once under different filters) uses exactly that;
    // otherwise it gets the graph's own weekdays/startTime/endTime as its one variant.
    const defaultWindow = { weekdays: g.weekdays, start: g.startTime, end: g.endTime };
    const routeWindows = {};
    for (const r of g._assigned) {
      const override = g.routeWindows?.[r.id];
      routeWindows[routeCompId.get(r)] = override
        ? override.map(v => ({ weekdays: v.weekdays, start: v.startTime, end: v.endTime, ...(v.color ? { color: v.color } : {}) }))
        : [defaultWindow];
    }
    state.display._measurePick = {
      ...(state.display._measurePick || {}),
      routeIds,
      routeWindows,
    };
  }
}

// ── create OR reconcile the page ────────────────────────────────────────────
const pageTemplate = (dms(['raw', 'get', String(PAGE_TEMPLATE_ID)]))?.data;
if (!pageTemplate) fail(`could not load the Report Page template (row ${PAGE_TEMPLATE_ID}).`);

function templateFrameworkSections() {
  // Every draft_section on the Report Page template flagged templateRole=='framework'
  // (ReportRouteList, ReportPageHeader, and whatever else joins that list later) —
  // cloned/reconciled into every programmatically-built report, in template order.
  // A new structural component joins this list by flagging its own template section,
  // not by editing this function or either of its two call sites.
  const sections = (pageTemplate.draft_sections || []).filter(s => s?.templateRole === 'framework');
  if (!sections.length) fail(`Report Page template has no section flagged templateRole=='framework' (expected at least ReportRouteList).`);
  return sections;
}

let pageId, slug, parentRef, graphTrackingIds, sectionDatas;

// CORRECTION 2026-08-07 (same day, after Ryan pushed back on maintaining
// page-scaffolding facts twice across this script and convert_old_reports.py):
// the "Report Page" template row (`pageTemplate`, already loaded below) already
// carries the CORRECT `sidebarHideInView: true` and
// `draft_section_groups: [{name:'default', position:'content', theme:'flush'}]`
// — this script just never read either field off it when creating a page. The
// fix below is "copy from `pageTemplate`", NOT a second hardcoded literal (an
// earlier pass here — since removed — hardcoded a matching-by-coincidence copy
// of the template's own value, recreating the exact two-sources-of-truth problem
// this correction exists to avoid). If the template's own value is ever wrong,
// fix the template row (id `PAGE_TEMPLATE_ID`) — every future page from ANY
// generator inherits it for free; don't re-hardcode here.
//
// `theme:'flush'` — `pages.sectionGroup` styles[1], no padding, hugging the
// content edge. RRL's own section still carries `group:'sidebar'`
// (clonedSection, unchanged) to land in the rail: `sectionGroup.jsx`'s
// `sidebarGroup` lookup (`groupSource.find(g => g?.position === 'sidebar' ||
// g?.name === 'sidebar')`) falls back to a synthetic `{name:'sidebar',
// position:'sidebar', theme:'content'}` when the groups array has no explicit
// sidebar entry — exactly what `converted_reports/snapshot`'s own real
// `section_groups` (a single content-position entry) relies on. A first, WRONG
// attempt at this part of the fix (forcing every section's `group` to
// 'default') broke the rail entirely — RRL rendered as a full-width stacked
// band instead of the side rail, because a section without `group:'sidebar'`
// never reaches `sectionGroup.jsx`'s rail render path at all, regardless of
// what the groups array says.
//
// `sidebarHideInView: true` — separate bug, found live 2026-08-07 by Ryan on
// the PUBLISHED view (not edit mode): without it, `sectionGroup.jsx`'s rail
// column (`sideNavContainer1`) reserves its width unconditionally even when
// RRL never renders on a real page (by design — RRL is edit-mode-only), leaving
// a dead gray gap where content should fill the full width.

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

if (updateCtx) {
  // ── reconcile into the existing page ──────────────────────────────────
  ({ pageId, slug } = updateCtx);
  parentRef = JSON.stringify({ id: String(pageId), ref: `${APP}+${PAGE_TYPE}` });

  // Existing spec keys keep their trackingId (so `section update` edits them
  // in place); new keys mint one. Keys dropped from the spec are handled
  // below by diffing against the section list itself, not this map.
  graphTrackingIds = spec.graphs.map(g => updateCtx.oldKeyMap[g.key] || randomUUID());
  const keptTrackingIds = new Set(graphTrackingIds);

  // An Info Box graph is ALSO element-type "Spreadsheet" (unlike AVL Graph/Map,
  // which are unambiguous): exclude any Spreadsheet section this revision's OLD
  // key map already tracks as a graph key, so the sweep below doesn't misidentify
  // a pre-existing page's own frozen Add-a-Route-to-Report section (a page
  // built/reconciled before the standalone catalog section was retired — see
  // add-route-flow-improvements.md) as an Info Box graph.
  const trackedGraphTrackingIds = new Set(
    Object.entries(updateCtx.oldKeyMap).filter(([k]) => k !== 'title_block').map(([, v]) => v));

  // Framework sections (RRL, ReportPageHeader, whatever else the template later
  // flags templateRole=='framework') are matched to the existing page by
  // element-type and updated in place, reusing the page's own trackingId for
  // that type — same as RRL always did. A framework type the page doesn't have
  // yet (an older page reconciled after the template grows a new structural
  // component) is created fresh rather than failing: that's the expected,
  // normal case now that the template can gain framework sections over time,
  // not the hand-deleted-corruption signal a missing RRL section used to be
  // when RRL was the only framework type that could ever exist.
  const frameworkTmpls = templateFrameworkSections();
  const frameworkEntries = frameworkTmpls.map(tmpl => {
    const elementType = tmpl.element['element-type'];
    // Optional chaining on s.data: an id in page.sections/draft_sections can be
    // dangling (fetchByIds returns a null-data placeholder for a deleted row —
    // the same class of debris the app's own orphan-cleanup handling elsewhere
    // already treats as harmless) — don't let a stale reference crash the whole
    // reconcile when the real answer is just "not found, create fresh".
    const existing = updateCtx.sections.find(s => s.data?.element?.['element-type'] === elementType);
    return { data: clonedSection(tmpl, existing?.data.trackingId || randomUUID()), existingId: existing?.id, elementType };
  });

  // No Add-a-Route Spreadsheet section is created or re-synced here on purpose:
  // the Report Page template no longer has one to clone from (RRL's own inline
  // search replaces it, see add-route-flow-improvements.md). A page built before
  // that change still carries its own frozen copy — untouched by this reconcile
  // (it's excluded from the deletion sweep below the same way it always was),
  // per that task's explicit "don't retroactively touch existing pages" decision.
  const graphSectionDatasList = spec.graphs.map((g, i) => graphSectionData(g, i, graphTrackingIds[i]));
  sectionDatas = [...frameworkEntries.map(e => e.data), ...graphSectionDatasList];

  let created = 0, updated = 0, deleted = 0;
  for (const entry of frameworkEntries) {
    if (entry.existingId) {
      dms(['section', 'update', String(entry.existingId)], entry.data);
      updated++;
    } else {
      console.warn(`  note: page ${pageId} has no "${entry.elementType}" section yet — creating one from the template.`);
      const res = dms(['section', 'create', String(pageId), '--pattern', PATTERN], entry.data);
      if (!res?.id) fail(`failed to create the "${entry.elementType}" framework section.`);
      created++;
    }
  }
  for (const [i, g] of spec.graphs.entries()) {
    const tid = graphTrackingIds[i];
    const existing = updateCtx.sections.find(s => s.data?.trackingId === tid);
    const payload = { ...graphSectionDatasList[i], size: g.size ? String(g.size) : '' }; // explicit '' clears a size dropped by this revision (shallow-merge --data would otherwise leave a stale one)
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
  // dropped — delete them rather than leaving orphans. Deliberately isn't
  // swept by a generic "any lexical section not in the key map" rule, which
  // would risk deleting a Rich Text block an author added by hand elsewhere
  // on the page (this also means a pre-existing page's old title-block
  // section, from before that concept was retired, is left alone here rather
  // than auto-deleted — see report-route-ui-parity-gaps.md). AVL Graph/Map are unambiguous
  // element-types (an author-added one is fair game for the same sweep, same
  // as before); Spreadsheet is NOT — it's also the Add-a-Route section's own
  // element-type, so only count a Spreadsheet section as a graph section here
  // if it was actually tracked as one (an Info Box graph a PRIOR build/update
  // minted), never the untracked Add-a-Route sheet.
  for (const s of updateCtx.sections) {
    if (!s.data?.element) continue; // dangling reference (deleted row) — nothing to sweep
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
  // `dynamicReport: true` only ever ADDS the routeSlots/baseDate pair if
  // missing — never removes it, and never touches `filters` at all when the
  // spec doesn't say `dynamicReport: true` (this script never touched
  // `item.filters` before this feature; the safest default is to keep not
  // touching it unless explicitly asked). Idempotent: a page that already has
  // both is left alone, so re-running `--update` on an already-adopted Dynamic
  // Report is a no-op here.
  if (spec.dynamicReport) {
    const hasBoth = ['routeSlots', 'baseDate'].every(t => updateCtx.existingFilters.some(f => f.type === t));
    if (!hasBoth) {
      const kept = updateCtx.existingFilters.filter(f => f.type !== 'routeSlots' && f.type !== 'baseDate');
      dms(['raw', 'update', String(pageId)], { filters: [...kept, ...DYNAMIC_REPORT_FILTERS] });
      console.log('added routeSlots/baseDate page filters (this page is now a Dynamic Report)');
    }
  }
} else {
  // ── create a new page ───────────────────────────────────────────────────
  const parentSlug = spec.parent || DEFAULT_PARENT_SLUG;
  const parent = dms(['page', 'show', parentSlug, '--pattern', PATTERN]);
  const parentId = parent?.id;
  if (!parentId) fail(`parent page "${parentSlug}" not found — create it first, or set \`parent\` in the spec.`);

  slug = computeTargetSlug();
  // sidebar/sidebarHideInView/draft_section_groups all copied straight off the
  // template row — see the correction note above `clonedSection` for why this
  // must stay a copy, never a re-hardcoded literal.
  const pageRes = dms(['page', 'create', '--pattern', PATTERN, '--title', spec.title, '--slug', slug], {
    index: '0', parent: String(parentId), published: 'draft',
    sidebar: pageTemplate.sidebar || 'left',
    ...(pageTemplate.sidebarHideInView !== undefined ? { sidebarHideInView: pageTemplate.sidebarHideInView } : {}),
    ...(pageTemplate.draft_section_groups ? { draft_section_groups: pageTemplate.draft_section_groups } : {}),
    // Compact-sidenav override (`layout.options.sideNav.activeStyle: 1`) — the
    // template carries this but it was never copied here, so any page this
    // script creates (or a --replace-style recreate of an existing one) lost
    // it even though the 2026-08-07 rollout had hand-patched it onto the
    // original 16 template pages. See compact-sidenav-margin-bug.md.
    ...(pageTemplate.theme ? { theme: pageTemplate.theme } : {}),
    // `dynamicReport: true` is the ONLY thing that turns a page into a Dynamic
    // Report — mirrors `toggleDynamicReport` (ReportRouteList.jsx) exactly: both
    // filters always register together, `baseDate` included even though it's only
    // ever consulted once some route on the page actually derives from the Today
    // anchor (Ryan's call: keep the capability available without re-toggling).
    ...(spec.dynamicReport ? { filters: DYNAMIC_REPORT_FILTERS } : {}),
  });
  pageId = pageRes?.id;
  if (!pageId) fail('page create returned no id.');
  console.log(`created page id=${pageId} slug=${slug}`);

  parentRef = JSON.stringify({ id: String(pageId), ref: `${APP}+${PAGE_TYPE}` });
  graphTrackingIds = spec.graphs.map(() => randomUUID());
  sectionDatas = [
    ...templateFrameworkSections().map(tmpl => clonedSection(tmpl, randomUUID())),
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
    || [{ name: 'default', index: 0, theme: 'flush', position: 'content' }]; // defensive only — see note above
  dms(['raw', 'update', String(pageId)], {
    sections: publishedRefs, section_groups: groups, draft_section_groups: groups,
    sidebarHideInView: pageTemplate.sidebarHideInView,
    published: '', has_changes: false,
  });
  console.log(`published (published section rows: ${publishedRefs.map(r => r.id).join(', ')})`);
}

// ── reports_snap_2 row: the route instances ───────────────────────────────
// graphIds is COMPUTED from the spec's declared assignments — this is the step
// that, done by clicking, can silently fail to persist.
// `derivedFromRoute` in the spec is a spec-local `routes[].id` (or the literal
// `__TODAY__` sentinel) — the persisted shape needs the BASE's own
// `route_comp_id` instead (what `resolveRouteDates` actually looks up by), same
// translation `graphs[].anchor` already does for graphs. Built once, up front,
// so both branches below (slot and concrete) can share it.
const compIdByRouteId = new Map(spec.routes.map((r, i) => [r.id, `comp-${i}`]));
const routeEntries = spec.routes.map((r, i) => {
  const graphIds = (r.graphs || []).map(gk => graphTrackingIds[spec.graphs.findIndex(g => g.key === gk)]);
  const derived = r.dateFormula ? {
    dateFormula: r.dateFormula,
    derivedFromRoute: r.derivedFromRoute === TODAY_ANCHOR_COMP_ID ? TODAY_ANCHOR_COMP_ID : compIdByRouteId.get(r.derivedFromRoute),
  } : {};
  if (r.slot) {
    // A slot's persisted shape mirrors exactly what `handleAddRouteSlot`/
    // `addRoutes` write by hand today (see ReportRouteList.jsx/useReportRow.js) —
    // no `id`/`route_id`/`tmc_array`/any other catalog field, since those get
    // overlaid live by `useDynamicReportRoutes` on every page load, never
    // persisted. No literal startDate/endDate either — see the "inert literal"
    // warning above; a slot with a dateFormula never needs one, and a slot
    // without one (not expected today, but not forbidden) simply has no date
    // until a viewer picks a route AND the report gains a formula for it.
    return {
      name: r._name,
      route_comp_id: `comp-${i}`,
      ...(r.route_slot_group ? { route_slot_group: r.route_slot_group } : {}),
      ...(r.isPlaceholderName ? { isPlaceholderName: true } : {}),
      graphIds,
      ...derived,
      ...(r.color ? { color: r.color } : {}),
      isValid: true,
    };
  }
  const d = r._row;
  return {
    ...d,
    name: r._name,
    route_id: d.route_id ?? String(r.route_id),
    id: r.route_id,
    route_comp_id: `comp-${i}`,
    graphIds,
    ...derived,
    ...(r.startDate ? { startDate: r.startDate } : {}),
    ...(r.endDate ? { endDate: r.endDate } : {}),
    ...(r.color ? { color: r.color } : {}),
    isValid: true,
  };
});

const cleanSpec = stripInternal(spec);
const specKeyMap = Object.fromEntries(spec.graphs.map((g, i) => [g.key, graphTrackingIds[i]]));

// Catalog metadata (`/reports`'s category tiles, e.g. `converted_reports/reports` id
// 2208581) — read directly from each Card section's `filterGroups`: every one of the 5
// category tiles filters `reports_snap_2` on `{col: 'tags', op: 'filter', value:
// ['category:<x>']}`, so `tags` is the actual row-selection mechanism, not just display —
// a spec-built row missing it is invisible on the catalog, not just under-labeled.
// `page_path`/`graph_count`/`counts_label` are pure display cells on the same Card and are
// fully derivable from the spec itself (see reports-page-template-catalog.md's "graph_count/
// counts_label are static, authored at curation time" — that was true for the Python
// converter, which has no live source for them; report_build.mjs does, so compute rather
// than require an author to keep a redundant number in sync by hand). `tags`/`difficulty`
// stay author-supplied spec fields — there's no way to derive "which category" from graphs/
// routes alone. Written unconditionally (harmless on a non-catalog report; a `tags`-less
// row just never matches any category filter, same as today).
const catalogFields = {
  page_path: `/${slug}`,
  graph_count: spec.graphs.length,
  counts_label: `${spec.routes.length} routes · ${spec.graphs.length} graphs`,
  ...(spec.tags ? { tags: spec.tags } : {}),
  ...(spec.difficulty !== undefined ? { difficulty: spec.difficulty } : {}),
};

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
    ...catalogFields,
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
    ...catalogFields,
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
