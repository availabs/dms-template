/**
 * STEP 2 of the report-fix loop: write the change the report recommends.
 *
 * Drives `dms section update <id> --set <attr>=<value>` - the CLI's own
 * read-modify-write path - one section at a time, mapping a report COLUMN onto
 * a section ATTRIBUTE. Nothing else in the row is touched.
 *
 * Refuses to write when:
 *   - there is no baseline for the id (step 1 was skipped);
 *   - the live row drifted since the baseline was taken (someone else edited);
 *   - the section is not in the page's `draft_sections`, or its group is not
 *     one of the page's `draft_section_groups`;
 *   - the attribute already holds the requested value (no-op, reported as such).
 *
 * usage:
 *   node apply.mjs <run-dir> --set-from "tags=Requirement" [--dry-run]
 *
 * `<run-dir>` is the folder holding `rows.csv` (the frozen report tab) and
 * `baseline/` (step 1's output).
 */
import fs from 'fs';
import { execFileSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { config, client, snapshot, canonical, readJson, writeJson } from './fix_lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DMS = path.resolve(HERE, '../../../../../src/dms/packages/dms/cli/bin/dms.js');

const argv = process.argv.slice(2);
const runDir = argv.shift();
let mapping = null, dryRun = false;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--set-from') mapping = argv[++i];
  else if (argv[i] === '--dry-run') dryRun = true;
}
if (!runDir || !mapping) {
  throw new Error('usage: node apply.mjs <run-dir> --set-from "<sectionAttr>=<csvColumn>" [--dry-run]');
}
const eq = mapping.indexOf('=');
const attr = mapping.slice(0, eq);
const column = mapping.slice(eq + 1);

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

const rows = parseCsv(fs.readFileSync(`${runDir}/rows.csv`, 'utf8'));
const c = config();
const falcor = client(c);

const results = [];
for (const r of rows) {
  const id = r['Draft section ID'];
  const want = r[column];
  const fixId = r['Fix ID'] || '(no fix id)';
  const rec = { fixId, id, attr, want, action: null, detail: '' };

  const baseFile = `${runDir}/baseline/${id}.json`;
  if (!fs.existsSync(baseFile)) {
    rec.action = 'REFUSED'; rec.detail = 'no baseline - run baseline.mjs first';
    results.push(rec); continue;
  }
  const base = readJson(baseFile);

  if (!want) {
    rec.action = 'SKIPPED'; rec.detail = `report column ${column} is empty`;
    results.push(rec); continue;
  }
  if (!base.placement.inDraftSections || !base.placement.sectionGroupInDraftGroups) {
    rec.action = 'REFUSED';
    rec.detail = `not a draft section in a draft section group (inDraftSections=${base.placement.inDraftSections}, groupInDraftGroups=${base.placement.sectionGroupInDraftGroups})`;
    results.push(rec); continue;
  }

  const live = await snapshot(falcor, c, id, base.placement.pageId ?? null);
  if (JSON.stringify(canonical(live.data)) !== JSON.stringify(canonical(base.data))) {
    rec.action = 'REFUSED';
    rec.detail = `live row drifted since baseline (updated_at ${base.updated_at} -> ${live.updated_at}) - re-baseline and re-review`;
    results.push(rec); continue;
  }
  if (String(live.data[attr] ?? '') === String(want)) {
    rec.action = 'NO-OP'; rec.detail = `${attr} already ${JSON.stringify(want)}`;
    results.push(rec); continue;
  }

  rec.from = live.data[attr] ?? null;
  if (dryRun) {
    rec.action = 'WOULD SET'; rec.detail = `${attr}: ${JSON.stringify(rec.from)} -> ${JSON.stringify(want)}`;
    results.push(rec); continue;
  }

  const out = execFileSync(process.execPath, [DMS, 'section', 'update', id, '--set', `${attr}=${want}`], {
    encoding: 'utf8', env: process.env, stdio: ['ignore', 'pipe', 'pipe'],
  });
  rec.action = 'SET';
  rec.detail = `${attr}: ${JSON.stringify(rec.from)} -> ${JSON.stringify(want)}`;
  rec.cliOutput = out.trim().split('\n').slice(-1)[0];
  results.push(rec);
}

for (const r of results) {
  console.log(`${r.fixId.padEnd(8)} ${String(r.id).padEnd(9)} ${r.action.padEnd(10)} ${r.detail}`);
}
writeJson(`${runDir}/applied.json`, { at: new Date().toISOString(), attr, column, dryRun, results });
console.log(`\n${dryRun ? 'dry run' : 'applied'} -> ${runDir}/applied.json`);
if (results.some((r) => r.action === 'REFUSED')) process.exitCode = 2;
