/**
 * The delete half of the report-fix loop: take a component off a page the way
 * the admin UI does.
 *
 * The UI's delete does NOT delete the section row. `remove` in
 * patterns/page/components/sections/sectionArray.jsx splices the entry out of
 * the array and hands it to `updateSections`, which PUTs `draft_sections` +
 * `has_changes: true` onto the PAGE and nothing onto the section. The row
 * survives as an orphan. This script does exactly that - which also makes the
 * delete reversible, because the baseline recorded the id's old `draftIndex`.
 *
 * (`dms section delete --page` is NOT the equivalent: it also issues
 * `dms data delete` on the row.)
 *
 * Guard rail: refuses to remove a section that looks authored. On the county
 * template a blank-body lexical WITH a title, a `level` and a tag is an
 * authoring slot - the heading a county writes its narrative under - and
 * deleting it deletes the template. A removable component is untitled,
 * untagged, has no `level`, and has no content. `--allow-nonempty` overrides,
 * and should be a stated decision.
 *
 * usage:
 *   node remove_from_page.mjs <run-dir> [--dry-run]
 *                             [--note-column Notes] [--note-value Deleted]
 *                             [--extra <pageId>:<sectionId>] [--allow-nonempty]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { fetchById, parseData } from '../../../../../src/dms/packages/dms/cli/src/utils/data.js';
import {
  config, client, snapshot, canonical, readJson, writeJson,
} from './fix_lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DMS = path.resolve(HERE, '../../../../../src/dms/packages/dms/cli/bin/dms.js');

const argv = process.argv.slice(2);
const runDir = argv.shift();
let dryRun = false, noteCol = 'Notes', noteVal = 'Deleted', allowNonEmpty = false;
const extras = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--dry-run') dryRun = true;
  else if (argv[i] === '--allow-nonempty') allowNonEmpty = true;
  else if (argv[i] === '--note-column') noteCol = argv[++i];
  else if (argv[i] === '--note-value') noteVal = argv[++i];
  else if (argv[i] === '--extra') extras.push(argv[++i]);
}
if (!runDir) throw new Error('usage: node remove_from_page.mjs <run-dir> [--dry-run] [--extra pageId:sectionId]');

function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const hdr = rows.shift().map((h) => h.replace(/^﻿/, ''));
  return rows.filter((r) => r.some((c) => c !== '')).map((r) => Object.fromEntries(hdr.map((h, i) => [h, r[i] ?? ''])));
}

const deepParse = (v) => {
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch { return v; }
};

/** Concatenated text of a lexical body; '' means the body renders blank. */
const textOf = (n, acc = []) => {
  if (!n || typeof n !== 'object') return acc;
  if (typeof n.text === 'string') acc.push(n.text);
  for (const k of ['children', 'root']) {
    if (n[k]) (Array.isArray(n[k]) ? n[k] : [n[k]]).forEach((x) => textOf(x, acc));
  }
  return acc;
};

/** The "is this actually removable" test - see the header note. */
function authoredReasons(data) {
  const why = [];
  if (data.title) why.push(`has a title (${JSON.stringify(data.title)})`);
  if (data.level !== undefined && data.level !== null && String(data.level) !== '') why.push(`has level ${JSON.stringify(data.level)}`);
  if (data.tags) why.push(`is tagged ${JSON.stringify(data.tags)}`);
  let ed = (data.element || {})['element-data'];
  ed = deepParse(ed);
  if (ed && typeof ed === 'object') {
    const text = textOf(ed.text || ed).join('').trim();
    if (text) why.push(`has ${text.length} chars of content`);
    else if (JSON.stringify(ed).includes('"src"')) why.push('contains an image');
  }
  return why;
}

const rows = fs.existsSync(`${runDir}/rows.csv`) ? parseCsv(fs.readFileSync(`${runDir}/rows.csv`, 'utf8')) : [];
const targets = rows
  .filter((r) => (r[noteCol] || '').trim() === noteVal)
  .map((r) => ({ fixId: r['Fix ID'] || '(no fix id)', id: r['Draft section ID'], pageId: r['Page ID'], fromReport: true }));
for (const e of extras) {
  const [pageId, id] = e.split(':');
  targets.push({ fixId: '(extra)', id, pageId, fromReport: false });
}
if (!targets.length) { console.log(`no rows with ${noteCol}="${noteVal}"`); process.exit(0); }

const c = config();
const falcor = client(c);

// ---- vet every target before touching any page -----------------------------
const vetted = [];
for (const t of targets) {
  const rec = { ...t, action: null, detail: '' };
  const baseFile = `${runDir}/baseline/${t.id}.json`;
  let base = fs.existsSync(baseFile) ? readJson(baseFile) : null;
  if (!base) {
    if (t.fromReport) {
      rec.action = 'REFUSED'; rec.detail = 'no baseline - run baseline.mjs first';
      vetted.push(rec); continue;
    }
    // an --extra target is not in the report, so snapshot it now
    base = await snapshot(falcor, c, t.id, t.pageId);
    writeJson(baseFile, base);
    rec.detail = 'baselined now (--extra)';
  }
  rec.base = base;

  if (!base.placement.inDraftSections) {
    rec.action = 'NO-OP'; rec.detail = 'already not in draft_sections';
    vetted.push(rec); continue;
  }
  const live = await snapshot(falcor, c, t.id, t.pageId);
  if (JSON.stringify(canonical(live.data)) !== JSON.stringify(canonical(base.data))) {
    rec.action = 'REFUSED';
    rec.detail = `live row drifted since baseline (updated_at ${base.updated_at} -> ${live.updated_at})`;
    vetted.push(rec); continue;
  }
  if (!live.placement.inDraftSections) {
    rec.action = 'NO-OP'; rec.detail = 'removed by someone else since the baseline';
    vetted.push(rec); continue;
  }
  const why = authoredReasons(live.data);
  if (why.length && !allowNonEmpty) {
    rec.action = 'REFUSED';
    rec.detail = `looks authored, not empty: ${why.join('; ')} - use --allow-nonempty only if that is deliberate`;
    vetted.push(rec); continue;
  }
  rec.action = 'TO REMOVE';
  rec.detail = `draft index ${live.placement.draftIndex} of ${live.placement.draftSectionCount}${why.length ? ` (NONEMPTY OVERRIDE: ${why.join('; ')})` : ''}`;
  rec.draftIndex = live.placement.draftIndex;
  vetted.push(rec);
}

for (const r of vetted) {
  console.log(`${r.fixId.padEnd(9)} ${String(r.id).padEnd(9)} ${r.action.padEnd(10)} ${r.detail}`);
}
if (vetted.some((r) => r.action === 'REFUSED')) {
  console.log('\nREFUSALS above - nothing written. Fix the report or the run, do not force.');
  writeJson(`${runDir}/removed.json`, { at: new Date().toISOString(), dryRun, results: vetted.map(({ base, ...r }) => r) });
  process.exitCode = 2;
  process.exit();
}

// ---- one page write per page, all of that page's targets at once -----------
const byPage = new Map();
for (const r of vetted.filter((x) => x.action === 'TO REMOVE')) {
  if (!byPage.has(r.pageId)) byPage.set(r.pageId, []);
  byPage.get(r.pageId).push(r);
}

const pageResults = [];
for (const [pageId, group] of byPage) {
  const pageRow = await fetchById(falcor, c.app, pageId, ['id', 'data']);
  const before = parseData(pageRow.data) || {};
  writeJson(`${runDir}/pages_before/${pageId}.json`, before);

  const ds = deepParse(before.draft_sections);
  if (!Array.isArray(ds)) throw new Error(`page ${pageId}: draft_sections is not an array`);
  const kill = new Set(group.map((g) => String(g.id)));
  // filter the ORIGINAL entries so their {id, ref} shape is preserved verbatim
  const next = ds.filter((e) => {
    const id = e && typeof e === 'object' ? String(e.id) : String(e);
    return !kill.has(id);
  });

  const rec = {
    pageId, slug: before.url_slug, removed: group.map((g) => ({ fixId: g.fixId, id: g.id, draftIndex: g.draftIndex })),
    before: ds.length, after: next.length, action: null,
  };
  if (ds.length - next.length !== kill.size) {
    rec.action = 'FAIL'; rec.detail = `expected to drop ${kill.size}, array moved ${ds.length} -> ${next.length}`;
    pageResults.push(rec); continue;
  }
  if (dryRun) {
    rec.action = 'WOULD WRITE';
    pageResults.push(rec); continue;
  }

  execFileSync(process.execPath, [DMS, 'page', 'update', pageId, '--data',
    JSON.stringify({ draft_sections: next, has_changes: true })],
  { encoding: 'utf8', env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });

  // ---- verify -------------------------------------------------------------
  const after = parseData((await fetchById(falcor, c.app, pageId, ['id', 'data'])).data) || {};
  const afterDs = deepParse(after.draft_sections);
  const arrayOk = JSON.stringify(canonical(afterDs)) === JSON.stringify(canonical(next));
  const drop = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => k !== 'draft_sections' && k !== 'has_changes' && k !== 'updated_at'));
  const restOk = JSON.stringify(canonical(drop(before))) === JSON.stringify(canonical(drop(after)));
  const flagOk = after.has_changes === true;

  // the section rows must be untouched - this write is page-side only
  const rowsOk = [];
  for (const g of group) {
    const now = await snapshot(falcor, c, g.id, pageId);
    const same = JSON.stringify(canonical(now.data)) === JSON.stringify(canonical(g.base.data));
    rowsOk.push({ id: g.id, rowUnchanged: same, stillInDraft: now.placement.inDraftSections });
  }
  const allRowsOk = rowsOk.every((x) => x.rowUnchanged && !x.stillInDraft);

  rec.action = (arrayOk && restOk && flagOk && allRowsOk) ? 'REMOVED' : 'FAIL';
  rec.detail = [
    arrayOk ? 'draft_sections as expected' : 'DRAFT_SECTIONS MISMATCH',
    restOk ? 'every other page attribute unchanged' : 'OTHER PAGE ATTRIBUTES MOVED',
    flagOk ? 'has_changes=true' : 'HAS_CHANGES NOT SET',
    allRowsOk ? 'section rows untouched and dereferenced' : 'SECTION ROW PROBLEM',
  ].join('; ');
  rec.rows = rowsOk;
  pageResults.push(rec);
}

console.log('');
for (const r of pageResults) {
  console.log(`page ${r.pageId} ${String(r.slug).padEnd(40)} ${String(r.action).padEnd(12)} ${r.before}->${r.after} sections, dropped ${r.removed.length}`);
  console.log(`     ${r.detail || ''}`);
  r.removed.forEach((x) => console.log(`     - ${x.id} (was draft index ${x.draftIndex}) ${x.fixId}`));
}
writeJson(`${runDir}/removed.json`, {
  at: new Date().toISOString(), dryRun, noteColumn: noteCol, noteValue: noteVal, allowNonEmpty,
  targets: vetted.map(({ base, ...r }) => r), pages: pageResults,
});
const bad = pageResults.filter((r) => r.action === 'FAIL');
console.log(`\n${dryRun ? 'dry run' : 'removed'}: ${pageResults.filter((r) => r.action === (dryRun ? 'WOULD WRITE' : 'REMOVED')).length}/${pageResults.length} page(s) ok -> ${runDir}/removed.json`);
if (bad.length) process.exitCode = 1;
