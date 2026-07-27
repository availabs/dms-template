#!/usr/bin/env node
/**
 * report_build.mjs — build an NPMRDS report page from a declarative spec.
 *
 *   node scripts/report_build.mjs <spec.json> [--summary|--dry-run] [--publish] [--verify]
 *
 * WHY THIS EXISTS
 * ---------------
 * A report is a DMS page (from the "Report Page" page template) carrying a
 * ReportRouteList panel, N AVL Graph sections, and an "Add a Route" Spreadsheet,
 * plus one `reports_snap_2` row holding the route instances. Building that by
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
 * See documentation/report-spec.md for the spec format, and
 * planning/tasks/current/report-spec-and-build-script.md for the design record.
 */

import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ── DMS content constants (mirrors scripts/convert_old_reports.py) ──────────
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

// ── args ───────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flags = new Set(argv.filter(a => a.startsWith('--')));
const positional = argv.filter(a => !a.startsWith('--'));
const specPath = positional[0];

if (!specPath) {
  console.error(`usage: node scripts/report_build.mjs <spec.json> [--summary|--dry-run] [--publish] [--verify]

  --summary   print a plain-language description of what the spec will build; no writes, no Vite boot
  --dry-run   compose every graph's state and print it; no writes
  --publish   also create published section copies (default: draft only)
  --verify    after building, load the page and assert it actually renders
`);
  process.exit(1);
}

const SUMMARY_ONLY = flags.has('--summary');
const DRY_RUN = flags.has('--dry-run');
const DO_PUBLISH = flags.has('--publish');
const DO_VERIFY = flags.has('--verify');

// ── spec load + validation ─────────────────────────────────────────────────
const spec = JSON.parse(readFileSync(resolve(specPath), 'utf8'));

function fail(msg) {
  console.error(`\nSPEC ERROR: ${msg}\n`);
  process.exit(1);
}

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
  console.log(`\nRoutes (${spec.routes.length} instance${spec.routes.length === 1 ? '' : 's'}):`);
  for (const r of spec.routes) {
    const window = r.startDate && r.endDate ? `${r.startDate} → ${r.endDate}` : 'no date window (all available dates)';
    // Semantics per useGraphPublish.js:34 — ONLY an explicit `false` excludes a
    // day, so an absent key means included. Enumerate all seven and subtract.
    const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const included = r.weekdays ? DAYS.filter(d => r.weekdays[d] !== false) : DAYS;
    const days = r.weekdays ? ` [${included.length === 7 ? 'all days' : included.map(d => d.slice(0, 3)).join(',')}]` : '';
    console.log(`  • ${r._name}`);
    console.log(`      route ${r.route_id} · ${window}${days} · feeds: ${(r.graphs || []).join(', ') || 'NOTHING'}`);
  }
  console.log(`\nGraphs (${spec.graphs.length}):`);
  for (const g of spec.graphs) {
    const mode = g.comparisonMode === 'difference'
      ? `difference (${g.anchor || g._assigned[0].id} − others${g._invert ? ', inverted' : ''})`
      : 'each route as its own series';
    console.log(`  • ${g.title || g.key} — ${g.graphType}, ${g.measure}, ${RES_LABEL[g.resolution] || g.resolution} buckets`);
    console.log(`      ${mode}; ${g._assigned.length} route(s): ${g._assigned.map(r => r.id).join(', ')}`);
    if (g.why) console.log(`      why: ${g.why}`);
  }
  console.log('\n(no changes made — drop --summary to build)\n');
  process.exit(0);
}

// ── dms CLI wrapper ────────────────────────────────────────────────────────
// Per CLAUDE.md all DMS reads/writes go through the CLI, which owns type
// resolution and config. Same approach the Python converter uses.
function dms(args, data) {
  const full = ['--host', HOST, '--app', APP, '--type', SITE_TYPE, ...args];
  if (data !== undefined) full.push('--data', JSON.stringify(data));
  const out = execFileSync('dms', full, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const trimmed = out.trim();
  if (!trimmed) return null;
  try { return JSON.parse(trimmed); } catch { return trimmed; }
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
    return state;
  });
} finally {
  await server.close();
}

if (DRY_RUN) {
  console.log(JSON.stringify(spec.graphs.map((g, i) => ({
    key: g.key, title: g.title, invert: !!g._invert, state: composedStates[i],
  })), null, 2));
  console.log('\n(--dry-run: nothing written)\n');
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
  console.log(`  ${r.route_id} "${d.name || r._name}" — ${tmcCount} TMCs`);
}

// ── create the page ───────────────────────────────────────────────────────
const pageTemplate = (dms(['raw', 'get', String(PAGE_TEMPLATE_ID)]))?.data;
if (!pageTemplate) fail(`could not load the Report Page template (row ${PAGE_TEMPLATE_ID}).`);

function templateSectionByType(elementType) {
  const found = (pageTemplate.draft_sections || [])
    .find(s => s?.element?.['element-type'] === elementType);
  if (!found) fail(`Report Page template has no "${elementType}" section.`);
  return found;
}

const parentSlug = spec.parent || DEFAULT_PARENT_SLUG;
const parent = dms(['page', 'show', parentSlug, '--pattern', PATTERN]);
const parentId = parent?.id;
if (!parentId) fail(`parent page "${parentSlug}" not found — create it first, or set \`parent\` in the spec.`);

const slug = spec.slug || `${parentSlug}/${String(spec.title).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`;
const pageRes = dms(['page', 'create', '--pattern', PATTERN, '--title', spec.title, '--slug', slug],
  { index: '0', parent: String(parentId), sidebar: pageTemplate.sidebar || 'left', published: 'draft' });
const pageId = pageRes?.id;
if (!pageId) fail('page create returned no id.');
console.log(`created page id=${pageId} slug=${slug}`);

// ── assemble sections: RRL, graphs, Add-a-Route ───────────────────────────
const parentRef = JSON.stringify({ id: String(pageId), ref: `${APP}+${PAGE_TYPE}` });

function clonedSection(tmplSection, trackingId) {
  return {
    type: COMPONENT_TYPE,
    group: tmplSection.group || 'default',
    ...(tmplSection.level ? { level: tmplSection.level } : {}),
    title: tmplSection.title || '',
    parent: parentRef,
    trackingId,
    element: {
      'element-type': tmplSection.element['element-type'],
      'element-data': tmplSection.element['element-data'],
    },
  };
}

const graphTrackingIds = spec.graphs.map(() => randomUUID());

const sectionDatas = [
  clonedSection(templateSectionByType('ReportRouteList'), randomUUID()),
  ...spec.graphs.map((g, i) => ({
    type: COMPONENT_TYPE,
    group: 'default',
    title: g.title || '',
    parent: parentRef,
    trackingId: graphTrackingIds[i],
    ...(g.size ? { size: String(g.size) } : {}),
    element: {
      'element-type': 'AVL Graph',
      // element-data is a JSON STRING, not an object (see the CLI skill's
      // element-data gotcha) — a nested object here is silently unusable.
      'element-data': JSON.stringify(composedStates[i]),
    },
  })),
  clonedSection(templateSectionByType('Spreadsheet'), randomUUID()),
];

const draftIds = sectionDatas.map(sd => dms(['section', 'create', String(pageId), '--pattern', PATTERN], sd)?.id);
console.log(`created ${draftIds.length} draft sections: ${draftIds.join(', ')}`);

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
    ...(r.startDate ? { startDate: r.startDate } : {}),
    ...(r.endDate ? { endDate: r.endDate } : {}),
    ...(r.color ? { color: r.color } : {}),
    ...(r.weekdays ? { weekdays: r.weekdays } : {}),
    isValid: true,
  };
});

const snapRes = dms(['raw', 'create', APP, REPORTS_SNAP_TYPE], {
  report_id: String(pageId),
  routes: JSON.stringify(routeEntries),
  name: spec.title,
  description: spec.description || '',
  _built_from_spec: specPath,
  ...(spec.request ? { _client_request: spec.request } : {}),
});
console.log(`created reports_snap_2 row id=${snapRes?.id} (${routeEntries.length} route instances)`);

// ── verify ────────────────────────────────────────────────────────────────
// Structural assertions first — these catch the silent-failure class directly,
// without needing a browser.
let problems = 0;
for (const e of routeEntries) {
  if (!e.graphIds.length) { console.error(`  FAIL route "${e.name}" has empty graphIds — it will feed no graph`); problems++; }
}
for (const [i, g] of spec.graphs.entries()) {
  const feeding = routeEntries.filter(e => e.graphIds.includes(graphTrackingIds[i]));
  if (!feeding.length) { console.error(`  FAIL graph "${g.key}" has no routes pointing at it`); problems++; }
  const st = composedStates[i];
  if (st.display?.fetchMode !== 'force') { console.error(`  FAIL graph "${g.key}" missing display.fetchMode:"force" — it will never query live`); problems++; }
  if (!st.comparisonSeries?.enabled) { console.error(`  FAIL graph "${g.key}" comparisonSeries not enabled — assigned routes won't render as series`); problems++; }
  const sub = (st.display?._functions?.subscribers || []).find(s => s.functionId === 'comparison_series');
  if (!sub || sub.paramKey !== '$self') { console.error(`  FAIL graph "${g.key}" missing the $self comparison_series subscriber`); problems++; }
}
console.log(problems === 0 ? '\nstructural checks: all passed' : `\nstructural checks: ${problems} PROBLEM(S)`);

if (DO_VERIFY) {
  console.log('\nloading the page to verify it renders...');
  try {
    const probe = execFileSync('node', [resolve(REPO, 'scripts/report_probe.mjs'), slug],
      { encoding: 'utf8', cwd: REPO, maxBuffer: 64 * 1024 * 1024 });
    console.log(probe.split('\n').slice(-25).join('\n'));
  } catch (e) {
    console.error(`  probe failed: ${e.message.split('\n')[0]}`);
    problems++;
  }
}

console.log(`\n${problems === 0 ? 'OK' : 'BUILT WITH PROBLEMS'} — /${slug}${DO_PUBLISH ? '' : '  (draft only; add --publish, or publish from the UI)'}`);
process.exit(problems === 0 ? 0 : 1);
