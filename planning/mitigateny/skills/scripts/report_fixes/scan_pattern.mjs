/**
 * Inventory every draft section of every page in a PATTERN, in one pass.
 *
 * The unit of work for cross-pattern propagation is the pattern, not the page:
 * `county_template` and each county draft are separate patterns holding
 * near-identical page trees. This writes one JSON per pattern —
 * `{ patternId, pages: { <url_slug>: { pageId, sections: [...] } } }` — which
 * `match_patterns.py` then aligns.
 *
 * Sections are fetched in batches through `fetchByIds`, so a 26-page /
 * 1,800-section pattern costs ~50 round trips rather than 1,800.
 *
 * usage:
 *   node scan_pattern.mjs <patternId> <out.json> [--slugs <slugs.json>] [--limit 300]
 *                          [--settings] [--sub <subdomain>]
 *
 * --settings also records each section's component settings (source, fetch mode,
 * filters, columns, tags, permissions, authored vs dataset text) for the
 * snap-to-county-template catalogue. Opt-in: without it the output is unchanged.
 * --sub stamps the pattern's subdomain into the file, which the catalogue uses
 * for its per-domain columns and links.
 *
 * `--slugs` restricts the scan to the pages a report actually references (a
 * JSON array of `url_slug` strings) — usually what you want, since a pattern
 * carries 50+ pages and a report tab touches a couple of dozen.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import {
  config, client, refIds,
} from './fix_lib.mjs';
import {
  fetchById, fetchByIds, parseData,
} from '../../../../../src/dms/packages/dms/cli/src/utils/data.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DMS = path.resolve(HERE, '../../../../../src/dms/packages/dms/cli/bin/dms.js');

const argv = process.argv.slice(2);
const patternId = argv.shift();
const outFile = argv.shift();
if (!patternId || !outFile) {
  throw new Error('usage: node scan_pattern.mjs <patternId> <out.json> [--slugs <slugs.json>] [--limit N]');
}
let slugFile = null, limit = 300, settings = false, sub = null;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--slugs') slugFile = argv[++i];
  else if (argv[i] === '--limit') limit = parseInt(argv[++i], 10);
  else if (argv[i] === '--settings') settings = true;
  else if (argv[i] === '--sub') sub = argv[++i];
}

// --settings adds the component-setting fields the snap-to-template catalogue
// needs. Opt-in, so every existing caller's output shape is unchanged.
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const filterLeaves = (node) => {
  const out = [];
  const walk = (x) => {
    if (!x || typeof x !== 'object') return;
    if (Array.isArray(x)) return x.forEach(walk);
    if (x.col) out.push({ col: norm(x.col), value: x.value ?? null, upf: !!x.usePageFilters, spk: x.searchParamKey ?? null, op: x.op ?? null });
    if (x.groups) x.groups.forEach(walk);
  };
  walk(node);
  return out;
};
// Lexical bodies and cached dataset rows both hold "text" leaves, and they must
// never be conflated: authoredText is the county's own writing, datasetText is
// data that goes stale. See template-and-duplicate-patterns.md section 5b.
const lexWords = (v) => {
  const s = typeof v === 'string' ? v : JSON.stringify(v ?? '');
  return (s.match(/"text":"((?:[^"\\]|\\.)*)"/g) || []).map((x) => x.slice(8, -1))
    .filter((t) => t.trim()).join(' ').replace(/\s+/g, ' ').trim();
};
const settingsOf = (d) => {
  const raw = (d.element || {})['element-data'];
  let e = raw;
  if (typeof raw === 'string') { try { e = JSON.parse(raw); } catch { e = {}; } }
  e = e || {};
  const src = e.sourceInfo || e.externalSource || {};
  // display.* minus the two cached, per-instance values that are not settings
  const display = { ...(e.display || {}) };
  delete display.totalLength; delete display.loadMoreId;
  return {
    // layout: how the component is placed and shaped on the page
    size: d.size ?? null,
    border: d.border ?? null,
    offset: d.offset ?? null,
    rowspan: d.rowspan ?? null,
    group: d.group ?? null,
    display,
    bgColor: e.bgColor ?? null,
    isCard: e.isCard ?? null,
    perms: d.authPermissions ? String(d.authPermissions) : '',
    shape: e.externalSource ? 'v2' : (e.sourceInfo ? 'v1' : ''),
    sourceId: src.source_id ?? null,
    sourceName: src.name ?? '',
    snapshotCols: (src.columns || []).length,
    fetchMode: e.display?.fetchMode ?? null,
    readyToLoad: e.display?.readyToLoad ?? null,
    filters: filterLeaves(e.filters ?? e.dataRequest?.filterGroups),
    cols: (e.columns || []).map((x) => norm(x.name)),
    authoredText: e.text !== undefined ? lexWords(e.text) : '',
    datasetText: Array.isArray(e.data) ? lexWords(e.data) : '',
  };
};
const want = slugFile ? new Set(JSON.parse(fs.readFileSync(slugFile, 'utf8'))) : null;

const c = config();
const falcor = client(c);

// List the pattern's pages through the CLI. The page type depends on the
// pattern's own doc_type, and the resolver for that is private to the CLI's
// page command - so use the command rather than reimplementing it.
const listed = execFileSync(process.execPath,
  [DMS, 'page', 'list', '--pattern', String(patternId), '--limit', String(limit)],
  { encoding: 'utf8', env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
const json = listed.slice(listed.search(/[[{]/));
const parsed = JSON.parse(json);
const items = Array.isArray(parsed) ? parsed : (parsed.items || []);
const pages = items
  .map((x) => ({ id: String(x.id), url_slug: (x.data || x).url_slug }))
  .filter((p) => p.url_slug);
if (!pages.length) throw new Error(`pattern ${patternId}: no pages resolved - check the pattern id`);

const sel = pages.filter((p) => !want || want.has(p.url_slug));
const out = { patternId: String(patternId), subdomain: sub, pageCount: pages.length, scannedAt: new Date().toISOString(), pages: {} };
const CHUNK = 60;

for (const p of sel) {
  const row = await fetchById(falcor, c.app, p.id, ['id', 'data']);
  const pd = parseData(row.data) || {};
  const ids = refIds(pd.draft_sections);
  const byId = new Map();
  for (let i = 0; i < ids.length; i += CHUNK) {
    for (const s of await fetchByIds(falcor, c.app, ids.slice(i, i + CHUNK), ['id', 'data'])) {
      const d = parseData(s.data) || {};
      byId.set(String(s.id), {
        id: String(s.id),
        trk: d.trackingId ?? null,
        title: d.title ?? null,
        level: d.level ?? null,
        tags: d.tags ?? null,
        et: (d.element || {})['element-type'] ?? null,
        hideInView: d.hideInView === true,
        ...(settings ? settingsOf(d) : {}),
      });
    }
  }
  // keep draft_sections order — index is what the alignment tiers reason about
  out.pages[p.url_slug] = {
    pageId: String(p.id),
    sections: ids.map((id, i) => ({ i, ...(byId.get(String(id)) || { id: String(id), trk: null }) })),
  };
  console.log(`  ${p.url_slug} (${ids.length})`);
}

fs.writeFileSync(outFile, JSON.stringify(out));
console.log(`pattern ${patternId}: ${Object.keys(out.pages).length} of ${pages.length} pages scanned -> ${outFile}`);
