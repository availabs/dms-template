#!/usr/bin/env node
/**
 * compose_bridge.mjs — batch-compose AVL Graph section state via the REAL
 * `applyMeasurePick`, for the Python old-report converter to call.
 *
 *   node scripts/npmrds-reports/compose_bridge.mjs <requests.json>
 *
 * WHY THIS EXISTS
 * ---------------
 * `report_build.mjs` already proved this exact mechanism (see its own
 * "THE PARITY GUARANTEE" comment): load `MeasurePicker/index.js` and the AVL
 * Graph component config through Vite's SSR resolver, then call the SAME
 * `applyMeasurePick` the live in-app Measure Picker calls — not a
 * reimplementation. `convert_old_reports.py` (the OLD-report Python
 * converter) had its own SEPARATE, PARALLEL reimplementation of this same
 * graph-composition logic (`graph_templates.py`'s `ensure_graph_templates` +
 * `template_specs.py`'s `TEMPLATE_SPECS`) — which is exactly how bugs like
 * "GridGraph y-axis shows NaN" and "GridGraph confetti color scale" (fixed
 * 2026-08-12 here, not ported to Python until 2026-08-26) kept recurring:
 * a fix in one never reached the other by construction. This script is a
 * thin batch wrapper around the identical compose call `report_build.mjs`
 * already makes, so the Python converter can be a fourth caller instead of
 * a fork — see `dynamic-reports-and-route-tags.md`'s named root-cause
 * pattern (B) for the incident history this replaces.
 *
 * CONTRACT
 * --------
 * stdin (or the file path arg): a JSON array of request objects —
 *   { key, graphType, measureKey, resolutionKey, comparisonModeKey?,
 *     anchorInvert?, seriesCount?, summaryDelayGrainKey? }
 * `summaryDelayGrainKey` ('5-minutes'|'day'|'weekday') is only meaningful for
 * measureKey 'avgHoursOfDelay' + resolutionKey 'summary' — see
 * composeMeasureConfig.js's own comment for why that one combo needs it.
 * stdout: ONE line, a JSON object `{ [key]: composedStateOrNull }` — a
 * request composes to `null` when `measureKey`/`resolutionKey` is unknown to
 * `vocabulary.json` (same "compose nothing" contract `composeMeasureConfig`
 * itself uses, e.g. `isUnsupportedSummaryMeasure`). Everything else
 * (progress, Vite's own startup log lines) goes to stderr — callers should
 * only ever parse stdout, never assume it's the only output stream, mirroring
 * `convert_old_reports.py`'s own "take the last non-empty stdout line"
 * caller-side convention in `report_build.mjs`, just enforced here instead
 * of left to the caller.
 *
 * One Vite server for the whole batch (created once, closed once) — the
 * ~1-3s SSR-load cost is paid once per Python-converter RUN, not once per
 * template or per report; every individual `applyMeasurePick` call after
 * that is a plain in-memory JS function call, the same as inside
 * `report_build.mjs`'s own per-graph `.map()` loop.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

function readRequests() {
  const path = process.argv[2];
  const raw = path ? readFileSync(path, 'utf8') : readFileSync(0, 'utf8');
  const requests = JSON.parse(raw);
  if (!Array.isArray(requests)) {
    throw new Error('compose_bridge.mjs expects a JSON array of request objects');
  }
  return requests;
}

const requests = readRequests();

const { createServer } = await import('vite');
const server = await createServer({
  root: REPO, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error',
});

const results = {};
try {
  const mp = await server.ssrLoadModule(
    '/src/themes/transportny/components/MeasurePicker/index.js');
  const graphCfg = await server.ssrLoadModule(
    '/src/dms/packages/dms/src/patterns/page/components/sections/components/ComponentRegistry/graph_new/config.jsx');
  const avlGraph = graphCfg.default;

  for (const req of requests) {
    if (!req.key) throw new Error(`request missing "key": ${JSON.stringify(req)}`);
    // Fresh defaultState per request (structuredClone, same as
    // report_build.mjs's own per-graph .map()) — applyMeasurePick mutates in
    // place via dwAPI.setState, so each request needs its own clone, not a
    // shared/reused object.
    const state = structuredClone(avlGraph.defaultState);
    const dwAPI = { setState: (fn) => fn(state) };
    let composedOk = true;
    try {
      mp.applyMeasurePick({ state, dwAPI, currentComponent: avlGraph }, {
        graphType: req.graphType,
        measure: req.measureKey,
        resolution: req.resolutionKey,
        comparisonMode: req.comparisonModeKey || 'plain',
        anchorInvert: req.anchorInvert,
        seriesCount: req.seriesCount,
        // Round 77: converter-only field for the 3 avgHoursOfDelay-summary
        // buckets — see composeMeasureConfig.js's own comment.
        summaryDelayGrainKey: req.summaryDelayGrainKey,
      });
    } catch (err) {
      // applyMeasurePickToState returning false (unknown measure/resolution)
      // is the normal "compose nothing" contract (see composeMeasureConfig's
      // own null-return cases) and doesn't throw — this catch is only for a
      // genuine unexpected error, surfaced per-request rather than aborting
      // the whole batch.
      process.stderr.write(`compose_bridge: request "${req.key}" threw: ${err?.stack || err}\n`);
      composedOk = false;
    }
    // A no-op apply (unknown measure/resolution — applyMeasurePickToState's
    // own `if (!composed) return false`) never touches state.columns, which
    // starts `[]` on a fresh defaultState — checked here since
    // applyMeasurePick (the outer wrapper this script calls) has no own
    // return value to check. display.graphType is NOT a reliable signal:
    // avlGraph.defaultState already carries a non-empty default graphType,
    // so it stays truthy even on a no-op apply.
    results[req.key] = (composedOk && state.columns?.length > 0) ? state : null;
  }
} finally {
  await server.close();
}

process.stdout.write(JSON.stringify(results));
