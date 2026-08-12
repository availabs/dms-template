#!/usr/bin/env node
// probe_corpus.mjs — golden-corpus batch mode over report_probe.mjs.
//
// Runs report_probe.mjs against every page listed in
// report_probe_fixtures/golden-corpus.json, normalizes each dump into a small comparable shape
// (per-section render state, console/page/SQL error signatures, per-/graph series counts), and
// either captures that as the new git-tracked baseline or diffs it against the stored one.
//
// This does NOT reimplement probing — it shells out to report_probe.mjs per page and reads its
// JSON dump, per that script's own "extend, don't fork" convention. It also does not attempt
// pixel/screenshot diffing (fragile — font rendering, timing); screenshots stay per-run artifacts
// for manual review only.
//
// Usage:
//   node scripts/npmrds-reports/probe_corpus.mjs --list
//   node scripts/npmrds-reports/probe_corpus.mjs --capture [--only key1,key2]
//   node scripts/npmrds-reports/probe_corpus.mjs [--only key1,key2]
//
// Options:
//   --list          print the manifest (key, baseline/verified dates, covers tags) and exit
//   --capture       (re)write the baseline for the selected entries instead of diffing — always
//                   explicit, this script never re-baselines silently on a passing OR failing run
//   --only <keys>   comma-separated manifest keys to restrict to (default: all entries)
//
// Exit code: 0 if every selected entry passes (or was captured) cleanly, 1 if any entry has a
// Blocker/Major finding, a missing baseline, or a probe process error.
//
// See planning/transportny/tasks/current/report-probe-expect-and-golden-corpus.md for the design
// record and planning/transportny/tasks/current/golden-corpus-manifest-and-batch-probe.md (if
// present) for this specific tool's own history.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FIXTURES_DIR = path.join(REPO, 'scripts/npmrds-reports/report_probe_fixtures');
const MANIFEST_PATH = path.join(FIXTURES_DIR, 'golden-corpus.json');
const BASELINE_DIR = path.join(FIXTURES_DIR, 'baselines');
const PROBE = path.join(REPO, 'scripts/npmrds-reports/report_probe.mjs');
const PROBE_OUT = path.join(REPO, 'scratchpad/npmrds-sub/tmp/probe_corpus');

// ---- args ------------------------------------------------------------------
const argv = process.argv.slice(2);
const opts = { capture: false, list: false, only: null };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--capture') opts.capture = true;
  else if (a === '--list') opts.list = true;
  else if (a === '--only') opts.only = argv[++i].split(',').map(s => s.trim());
  else { console.error(`unknown option: ${a}`); process.exit(2); }
}

function loadManifest() {
  const raw = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  if (!Array.isArray(raw.entries)) throw new Error(`${MANIFEST_PATH}: missing "entries" array`);
  return raw;
}
function saveManifest(manifest) {
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
}

const manifest = loadManifest();

if (opts.list) {
  console.log(`${'key'.padEnd(30)} ${'baseline'.padEnd(12)} ${'verified'.padEnd(12)} covers`);
  for (const e of manifest.entries) {
    console.log(`${e.key.padEnd(30)} ${String(e.baselineCapturedAt).padEnd(12)} ${String(e.lastVerifiedAt).padEnd(12)} ${e.covers.join(', ')}`);
  }
  process.exit(0);
}

let entries = manifest.entries;
if (opts.only) {
  entries = manifest.entries.filter(e => opts.only.includes(e.key));
  const missing = opts.only.filter(k => !manifest.entries.some(e => e.key === k));
  if (missing.length) { console.error(`unknown manifest key(s): ${missing.join(', ')}`); process.exit(2); }
}
if (!entries.length) { console.error('no matching entries'); process.exit(2); }

// ---- run report_probe.mjs for one entry, return its parsed JSON dump ------
function runProbe(entry) {
  mkdirSync(PROBE_OUT, { recursive: true });
  const args = [PROBE, entry.url, '--no-shot', '--out', PROBE_OUT];
  if (entry.authRequired) args.push('--auth');
  console.log(`  node ${path.relative(REPO, PROBE)} ${entry.url} ${entry.authRequired ? '--auth ' : ''}--no-shot`);
  try {
    execFileSync('node', args, { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    // report_probe.mjs only exits non-zero via --expect, which this script never passes — a
    // non-zero exit here means the probe process itself crashed (page never loaded, Playwright
    // error), not a normal finding. Surface it and let the JSON-dump existence check below catch
    // the case where nothing was written at all.
    console.log(`  probe process exited non-zero: ${String(e.message).split('\n')[0]}`);
  }
  // Mirrors report_probe.mjs's own slug computation exactly — must match or the JSON dump lookup
  // below silently misses (see report_probe.mjs's slug-sanitization fix for why this matters).
  const rawSlug = entry.url.startsWith('http') ? new URL(entry.url).pathname : entry.url;
  const slug = rawSlug.replace(/\W+/g, '_').replace(/^_+|_+$/g, '') || 'index';
  const jsonPath = path.join(PROBE_OUT, `probe_${slug}.json`);
  if (!existsSync(jsonPath)) throw new Error(`no JSON dump produced at ${jsonPath} — probe likely crashed before capture`);
  return JSON.parse(readFileSync(jsonPath, 'utf8'));
}

// ---- normalize a raw report_probe.mjs dump into the comparable baseline shape ----
// Restrict the diff to queries that actually carry this report's own measure/route data — a
// UDA `viewsById...options` (measure data) or `...colorDomain` (choropleth) call. Excludes
// generic Falcor/UDA plumbing (`dms","data",...,"byId"/"byIndex"/"length"` site-wide catalog
// reads, `uda",...,"sources","byIndex"/"length"` source-picker listings) that every page fires
// identically regardless of report content and that drift run-to-run on a shared dev DB purely
// from unrelated concurrent activity (found live 2026-08-10: a `sources` listing count query
// flagged a false "no longer fires" diff with zero connection to the page under test).
function isReportContentQuery(decoded) {
  return decoded.includes('"uda"') && (decoded.includes('"options"') || decoded.includes('"colorDomain"'));
}

function seriesCountFor(capture) {
  // Same technique as report_probe.mjs's own --expect: count `"label":"` occurrences in the
  // decoded seriesVariants text rather than re-parsing the nested stringified JSON.
  return (capture.decoded.match(/\\"label\\":\\"/g) || []).length;
}

// A network blip (this Wi-Fi's own flakiness, not a code regression) can make the page never
// really load at all — Chromium still returns a 200-shaped dump with a trivial body and
// net::ERR_* console noise instead of throwing. Without this guard that gets captured as a
// legitimate "0 sections, all blank" baseline (or diffed as a false "everything regressed"),
// silently poisoning the one artifact this whole framework depends on being trustworthy.
function looksLikeFailedLoad(raw) {
  const netErr = raw.consoleErrors.some(e => /net::ERR_/.test(e));
  const trivialBody = (raw.bodyText || '').trim().length < 50;
  return netErr || trivialBody;
}

function normalize(raw) {
  return {
    sections: raw.sections.map(s => ({
      title: s.title,
      // "has content" = real SVG ink OR a real-sized canvas — Map sections render via MapLibre
      // WebGL/canvas, never SVG, and an SVG-only check reads a correctly-rendered map as
      // permanently blank (found live 2026-08-10 on the Dynamic Report corpus candidate).
      hasContent: (s.svgs.length > 0 && s.svgs.some(v => v.paths + v.rects + v.circles > 0)) || (s.canvases || []).length > 0,
    })),
    consoleErrorSignatures: [...new Set(raw.consoleErrors)],
    pageErrorSignatures: [...new Set(raw.pageErrors)],
    sqlErrorSignatures: [...new Set((raw.sqlErrors || []).map(s => s.match))],
    badResponseCount: raw.badResponses.length,
    pendingCount: raw.stillPending.length,
    // Full decoded text as the match key — a short prefix isn't unique: this page's per-weekday
    // Bar Graph Summary queries all share the same view-id + options-JSON preamble and only
    // diverge later in the string (found live 2026-08-10: a 160-char prefix collapsed 43 distinct
    // queries into 31 keys, producing false "series count changed" diffs against its own fresh
    // baseline). Truncate only for display, at print time, never for matching.
    graphSummary: raw.graphCaptures
      .filter(c => isReportContentQuery(c.decoded))
      .map(c => ({
        decodedKey: c.decoded,
        status: c.status,
        seriesCount: seriesCountFor(c),
      })),
  };
}

// ---- diff two normalized snapshots, classify each finding by severity ------
function diffSnapshots(baseline, current) {
  const findings = [];
  const push = (severity, message) => findings.push({ severity, message });

  if (baseline.sections.length !== current.sections.length) {
    push('Blocker', `section count changed: ${baseline.sections.length} → ${current.sections.length}`);
  }
  const n = Math.min(baseline.sections.length, current.sections.length);
  for (let i = 0; i < n; i++) {
    const b = baseline.sections[i], c = current.sections[i];
    if (b.hasContent !== c.hasContent) {
      push('Blocker', `section[${i}] "${b.title || c.title}" rendering state changed: ` +
        `${b.hasContent ? 'had content' : 'was blank'} → ${c.hasContent ? 'has content' : 'blank'}`);
    }
  }

  for (const e of current.consoleErrorSignatures.filter(e => !baseline.consoleErrorSignatures.includes(e))) {
    push('Blocker', `new console error: ${e}`);
  }
  for (const e of baseline.consoleErrorSignatures.filter(e => !current.consoleErrorSignatures.includes(e))) {
    push('Info', `console error no longer occurs (may be a fix, confirm before re-capturing): ${e}`);
  }
  for (const e of current.pageErrorSignatures.filter(e => !baseline.pageErrorSignatures.includes(e))) {
    push('Blocker', `new uncaught page error: ${e}`);
  }
  for (const e of current.sqlErrorSignatures.filter(e => !baseline.sqlErrorSignatures.includes(e))) {
    push('Blocker', `new SQL error in a /graph response: ${e}`);
  }

  if (current.pendingCount > baseline.pendingCount) {
    push('Blocker', `requests pending at close increased: ${baseline.pendingCount} → ${current.pendingCount} (possible hung/unbounded query)`);
  }
  if (current.badResponseCount > baseline.badResponseCount) {
    push('Major', `non-200 API responses increased: ${baseline.badResponseCount} → ${current.badResponseCount}`);
  }

  // Match /graph captures between runs by decoded query text, not array position — capture order
  // isn't guaranteed stable across runs even when nothing changed.
  for (const bg of baseline.graphSummary) {
    const cg = current.graphSummary.find(g => g.decodedKey === bg.decodedKey);
    if (!cg) { push('Major', `a previously-captured /graph query no longer fires: ${bg.decodedKey.slice(0, 100)}...`); continue; }
    if (bg.seriesCount !== cg.seriesCount) {
      push('Major', `series count changed for "${bg.decodedKey.slice(0, 80)}...": ${bg.seriesCount} → ${cg.seriesCount}`);
    }
  }

  return findings;
}

// ---- Layer 3: known-good-value assertion, only runs when an entry sets expectedValue.value ----
function checkExpectedValue(entry, raw) {
  const ev = entry.expectedValue;
  if (!ev || ev.value == null) return null;
  // Matching on the route name alone isn't enough — a route-metadata lookup (e.g. RRL's own
  // route-list fetch) can mention the same name with none of the actual measure data, and even
  // among report-content-query-shaped captures, a paginated UDA fetch sends its own `length`-only
  // preflight (same options/join text, ships first) before the real `dataByIndex` data call
  // (found live 2026-08-10: both matched, `.find()` grabbed the count-only preflight). Require
  // `dataByIndex` explicitly — the only shape that actually returns computed values.
  const capture = raw.graphCaptures.find(c =>
    isReportContentQuery(c.decoded) && c.decoded.includes('dataByIndex') && c.decoded.includes(ev.matchRoute));
  if (!capture || !capture.body) {
    return { severity: 'Blocker', message: `expectedValue "${ev.description}": no matching /graph capture found (looked for "${ev.matchRoute}")` };
  }
  const nums = [];
  (function walk(o) {
    if (o == null || typeof o !== 'object') return;
    for (const v of Object.values(o)) { if (typeof v === 'number') nums.push(v); else walk(v); }
  })(capture.body);
  const hit = nums.find(v => Math.abs(v - ev.value) <= ev.toleranceAbs);
  if (!hit) {
    return {
      severity: 'Blocker',
      message: `expectedValue "${ev.description}": expected ≈${ev.value} (±${ev.toleranceAbs}), ` +
        `no returned value matched (saw: ${nums.slice(0, 10).join(', ')}${nums.length > 10 ? ', …' : ''})`,
    };
  }
  return null;
}

// ---- main --------------------------------------------------------------
const SEVERITY_ORDER = { Blocker: 0, Major: 1, Minor: 2, Info: 3 };
let anyBlockerOrMajor = false;
const today = new Date().toISOString().slice(0, 10);

for (const entry of entries) {
  console.log(`\n== ${entry.key} ==`);
  let raw;
  try {
    raw = runProbe(entry);
  } catch (e) {
    console.log(`  ERROR: ${e.message}`);
    anyBlockerOrMajor = true;
    continue;
  }
  if (looksLikeFailedLoad(raw)) {
    console.log(`  PROBE FAILED TO LOAD THE PAGE (network error or trivial body — not a code` +
      ` finding) — retry, not capturing/diffing this entry this run`);
    console.log(`    consoleErrors: ${raw.consoleErrors.slice(0, 2).join(' | ')}`);
    anyBlockerOrMajor = true;
    continue;
  }
  const current = normalize(raw);

  if (opts.capture) {
    mkdirSync(BASELINE_DIR, { recursive: true });
    writeFileSync(path.join(BASELINE_DIR, `${entry.key}.json`), JSON.stringify(current, null, 2) + '\n');
    entry.baselineCapturedAt = today;
    entry.lastVerifiedAt = today;
    console.log(`  captured baseline: ${current.sections.length} section(s), ${current.graphSummary.length} /graph quer(y/ies)`);
    continue;
  }

  const baselinePath = path.join(BASELINE_DIR, `${entry.key}.json`);
  if (!existsSync(baselinePath)) {
    console.log(`  NO BASELINE — run: node scripts/npmrds-reports/probe_corpus.mjs --capture --only ${entry.key}`);
    anyBlockerOrMajor = true;
    continue;
  }
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
  const findings = diffSnapshots(baseline, current);
  const evFinding = checkExpectedValue(entry, raw);
  if (evFinding) findings.push(evFinding);

  if (!findings.length) {
    console.log('  PASS — matches baseline');
    entry.lastVerifiedAt = today;
  } else {
    findings.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
    for (const f of findings) console.log(`  [${f.severity}] ${f.message}`);
    if (findings.some(f => f.severity === 'Blocker' || f.severity === 'Major')) anyBlockerOrMajor = true;
  }
}

saveManifest(manifest);
process.exit(anyBlockerOrMajor ? 1 : 0);
