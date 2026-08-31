/**
 * Inventory every DATA component of a pattern with its Data Fetch Mode setting
 * and its data source, for the T6 fetch-mode sweep.
 *
 * Sibling of `scan_pattern.mjs`, which deliberately does NOT read
 * `element-data` (it only needs identity + order for cross-pattern matching).
 * Fetch mode and source both live inside `element-data`, so this script parses
 * it. Output shape is flat — one record per component — because the consumer is
 * a report, not the alignment ladder.
 *
 * What it reads, and why each field is here:
 *
 *   display.fetchMode   the STORED setting: 'cache' | 'smart' | 'force', or absent
 *   display.readyToLoad the fallback input when fetchMode is absent
 *   externalSource      { source_id, view_id, name, srcEnv, isDms, ... }
 *
 * The resolved behaviour is NOT the stored setting. useDataLoader.js:245-247:
 *
 *   fetchMode = display.fetchMode ?? (display.readyToLoad === true ? 'smart' : 'cache')
 *
 * so an unset component silently behaves as 'smart' when `readyToLoad` is true
 * and 'cache' when it is not. Both are reported; a fix must be judged against
 * the resolved one.
 *
 * Source class (external vs internal) comes from `isDms`, and the picker label
 * is reproduced exactly as useDataSource.js:438-443 composes it:
 *
 *   envLabel = srcEnv.includes('+') ? srcEnv.split('+')[1] : envs[srcEnv].label
 *   label    = `${name}${envLabel ? ` [${envLabel}]` : ''}`
 *
 * For a DAMA source `srcEnv` is a bare pgEnv, so the label is the datasource's
 * own label — `external`. For a DMS source `srcEnv` is `<app>+<instance>`, so
 * the label is the INSTANCE SLUG, not the word "internal". Both the composed
 * label and the derived class are emitted so a report can show what an author
 * actually sees without inferring it.
 *
 * usage:
 *   node scan_fetchmode.mjs <patternId> <out.json> [--slugs <slugs.json>]
 *                           [--limit 300] [--kinds Card,Spreadsheet,Graph]
 *                           [--external-label external]
 *
 * Omit `--slugs` to scan every page in the pattern — T6 is a pattern-wide
 * finding, unlike the T5 tag work which was scoped to a report tab's pages.
 * Omit `--kinds` to inventory every element type that carries an
 * `externalSource`, which is how you find out what the kinds actually are.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { config, client, refIds } from './fix_lib.mjs';
import { fetchById, fetchByIds, parseData } from '../../../../../src/dms/packages/dms/cli/src/utils/data.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DMS = path.resolve(HERE, '../../../../../src/dms/packages/dms/cli/bin/dms.js');

const argv = process.argv.slice(2);
const patternId = argv.shift();
const outFile = argv.shift();
if (!patternId || !outFile) {
  throw new Error('usage: node scan_fetchmode.mjs <patternId> <out.json> [--slugs f] [--limit N] [--kinds a,b]');
}
let slugFile = null, limit = 300, kinds = null, externalLabel = 'external';
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--slugs') slugFile = argv[++i];
  else if (argv[i] === '--limit') limit = parseInt(argv[++i], 10);
  else if (argv[i] === '--kinds') kinds = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
  else if (argv[i] === '--external-label') externalLabel = argv[++i];
}
const want = slugFile ? new Set(JSON.parse(fs.readFileSync(slugFile, 'utf8'))) : null;

const deepParse = (v) => {
  if (typeof v !== 'string') return v;
  const t = v.trim();
  if (!(t.startsWith('{') || t.startsWith('['))) return v;
  try { return JSON.parse(t); } catch { return v; }
};

const c = config();
let falcor = client(c);

/** One retrying fetch — the hosted server drops long runs. */
async function withRetry(fn, what) {
  for (let a = 1; a <= 6; a++) {
    try { return await fn(); }
    catch (e) {
      if (a === 6) throw new Error(`${what}: ${e.message}`);
      await new Promise((r) => setTimeout(r, 1500 * a));
      falcor = client(c);
    }
  }
  return null;
}

// The page type depends on the pattern's doc_type and that resolver is private
// to the CLI's page command, so use the command rather than reimplementing it.
const listed = execFileSync(process.execPath,
  [DMS, 'page', 'list', '--pattern', String(patternId), '--limit', String(limit)],
  { encoding: 'utf8', env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
const parsed = JSON.parse(listed.slice(listed.search(/[[{]/)));
const items = Array.isArray(parsed) ? parsed : (parsed.items || []);
const pages = items
  .map((x) => ({ id: String(x.id), url_slug: (x.data || x).url_slug, title: (x.data || x).title }))
  .filter((p) => p.url_slug);
if (!pages.length) throw new Error(`pattern ${patternId}: no pages resolved - check the pattern id`);

const sel = pages.filter((p) => !want || want.has(p.url_slug));
const CHUNK = 40;

const out = {
  patternId: String(patternId),
  scannedAt: new Date().toISOString(),
  host: c.host,
  app: c.app,
  pageCount: pages.length,
  pagesScanned: sel.length,
  kindsFilter: kinds,
  components: [],
  elementTypeCensus: {},
  skippedNoSource: 0,
};

for (const p of sel) {
  const row = await withRetry(() => fetchById(falcor, c.app, p.id, ['id', 'data']), `page ${p.id}`);
  const pd = parseData(row.data) || {};
  const ids = refIds(pd.draft_sections);

  const byId = new Map();
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK);
    const got = await withRetry(
      () => fetchByIds(falcor, c.app, slice, ['id', 'data', 'updated_at']),
      `sections of page ${p.id}`,
    );
    for (const s of (got || [])) {
      if (!s) continue;
      byId.set(String(s.id), { row: s, d: parseData(s.data) || {} });
    }
  }

  ids.forEach((id, idx) => {
    const hit = byId.get(String(id));
    if (!hit) return;
    const { row: sRow, d } = hit;
    const el = d.element || {};
    const et = el['element-type'] ?? null;
    out.elementTypeCensus[String(et)] = (out.elementTypeCensus[String(et)] || 0) + 1;

    const ed = deepParse(el['element-data']);
    const edObj = (ed && typeof ed === 'object' && !Array.isArray(ed)) ? ed : {};
    const es = edObj.externalSource || null;
    const display = edObj.display || {};

    // A data component is one that binds a source. Kinds filter is applied on
    // top of that, never instead of it.
    if (!es) { out.skippedNoSource++; return; }
    if (kinds && !kinds.some((k) => String(et).toLowerCase().startsWith(k.toLowerCase()))) return;

    const stored = (display.fetchMode === undefined || display.fetchMode === null || display.fetchMode === '')
      ? null : String(display.fetchMode);
    const readyToLoad = display.readyToLoad;
    const resolved = stored ?? (readyToLoad === true ? 'smart' : 'cache');

    const srcEnv = es.srcEnv ?? es.env ?? null;
    const isDms = es.isDms === true;
    const envLabel = srcEnv && String(srcEnv).includes('+')
      ? String(srcEnv).split('+')[1]
      : (srcEnv ? externalLabel : null);

    out.components.push({
      patternId: String(patternId),
      pageId: String(p.id),
      pageSlug: p.url_slug,
      pageTitle: p.title ?? '',
      draftIndex: idx,
      draftSectionCount: ids.length,
      sectionId: String(sRow.id),
      trackingId: d.trackingId ?? null,
      title: d.title ?? null,
      elementType: et,
      hideInView: d.hideInView === true,
      tags: d.tags ?? null,
      storedFetchMode: stored,
      readyToLoad: readyToLoad === undefined ? null : readyToLoad,
      resolvedFetchMode: resolved,
      reliesOnFallback: stored === null,
      sourceId: es.source_id ?? null,
      viewId: es.view_id ?? null,
      sourceName: es.name ?? null,
      viewName: es.view_name ?? null,
      srcEnv,
      env: es.env ?? null,
      isDms,
      sourceClass: isDms ? 'internal' : 'external',
      sourceLabel: `${es.name ?? '(unnamed)'}${envLabel ? ` [${envLabel}]` : ''}`,
      hasJoin: !!(edObj.join && Object.keys(edObj.join.sources || {}).length),
      updated_at: sRow.updated_at ?? null,
    });
  });

  console.log(`  ${p.url_slug.padEnd(52)} ${ids.length} sections`);
}

fs.writeFileSync(outFile, JSON.stringify(out, null, 1));
const tally = (key) => out.components.reduce((a, x) => {
  a[String(x[key])] = (a[String(x[key]) ] || 0) + 1; return a;
}, {});
console.log(`\npattern ${patternId}: ${out.components.length} data components on ${sel.length} of ${pages.length} pages -> ${outFile}`);
console.log('  by element type   ', JSON.stringify(tally('elementType')));
console.log('  stored fetch mode ', JSON.stringify(tally('storedFetchMode')));
console.log('  resolved behaviour', JSON.stringify(tally('resolvedFetchMode')));
console.log('  source class      ', JSON.stringify(tally('sourceClass')));
console.log(`  sections with no externalSource (not data components): ${out.skippedNoSource}`);
