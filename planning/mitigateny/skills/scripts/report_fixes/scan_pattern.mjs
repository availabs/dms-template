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
let slugFile = null, limit = 300;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--slugs') slugFile = argv[++i];
  else if (argv[i] === '--limit') limit = parseInt(argv[++i], 10);
}
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
const out = { patternId: String(patternId), pageCount: pages.length, scannedAt: new Date().toISOString(), pages: {} };
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
