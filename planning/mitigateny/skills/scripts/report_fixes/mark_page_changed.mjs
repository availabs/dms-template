/**
 * STEP 2b of the report-fix loop: flip the owning page's `has_changes` flag.
 *
 * `dms section update` writes the section row and nothing else. The admin UI's
 * equivalent edit does more: a section attribute change bubbles through
 * `updateAttribute` -> `onChange` -> `updateSections`
 * (patterns/page/components/sections/sectionGroup.jsx), which also PUTs
 * `has_changes: true` onto the PAGE row.
 *
 * That flag is what the pattern editor and the edit pane read to show a page as
 * having unpublished changes
 * (`page.published === 'draft' || !!page.has_changes` - pagesEditor.jsx:40,
 * editPane/index.jsx:55). Skip it and your draft edit is real but invisible to
 * whoever decides what to publish.
 *
 * Only touches `has_changes`; `draft_sections`, `sections` and every other page
 * attribute are read back and asserted unchanged.
 *
 * usage: node mark_page_changed.mjs <run-dir> [--dry-run]
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { fetchById, parseData } from '../../../../../src/dms/packages/dms/cli/src/utils/data.js';
import { config, client, canonical, readJson, writeJson } from './fix_lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DMS = path.resolve(HERE, '../../../../../src/dms/packages/dms/cli/bin/dms.js');

const argv = process.argv.slice(2);
const runDir = argv.shift();
const dryRun = argv.includes('--dry-run');
if (!runDir) throw new Error('usage: node mark_page_changed.mjs <run-dir> [--dry-run]');

const applied = readJson(`${runDir}/applied.json`);
// The loop's section writers each name their success verb after what they did:
// `apply.mjs` / `apply_element_data_key.mjs` report SET,
// `remove_element_data_column.mjs` reports REMOVED. Both are a section write and
// both need the page flag, so match on the set of write verbs, not on one string.
const WRITE_ACTIONS = new Set(['SET', 'REMOVED']);
const written = applied.results.filter((r) => WRITE_ACTIONS.has(r.action));
if (!written.length) { console.log('nothing was written in this run'); process.exit(0); }

const pageIds = [...new Set(written.map((r) => readJson(`${runDir}/baseline/${r.id}.json`).placement.pageId))];

const c = config();
const falcor = client(c);
const results = [];

for (const pageId of pageIds) {
  const before = parseData((await fetchById(falcor, c.app, pageId, ['id', 'data'])).data) || {};
  const rec = { pageId, slug: before.url_slug, before: before.has_changes ?? null, action: null };

  if (before.has_changes === true) {
    rec.action = 'NO-OP';
  } else if (dryRun) {
    rec.action = 'WOULD SET';
  } else {
    execFileSync(process.execPath, [DMS, 'page', 'update', pageId, '--set', 'has_changes=true'],
      { encoding: 'utf8', env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });

    const after = parseData((await fetchById(falcor, c.app, pageId, ['id', 'data'])).data) || {};
    const drop = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => k !== 'has_changes'));
    const clean = JSON.stringify(canonical(drop(before))) === JSON.stringify(canonical(drop(after)));
    rec.after = after.has_changes ?? null;
    rec.action = (after.has_changes === true && clean) ? 'SET' : 'FAIL';
    rec.detail = clean ? 'every other page attribute unchanged' : 'OTHER PAGE ATTRIBUTES MOVED - investigate';
  }
  results.push(rec);
}

results.forEach((r) => console.log(`page ${r.pageId} ${String(r.slug).padEnd(38)} has_changes ${JSON.stringify(r.before)} -> ${r.action}  ${r.detail || ''}`));
writeJson(`${runDir}/page_flag.json`, { at: new Date().toISOString(), dryRun, results });
if (results.some((r) => r.action === 'FAIL')) process.exitCode = 1;
