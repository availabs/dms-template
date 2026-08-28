/**
 * STEP 1 of the report-fix loop: snapshot every section a report row targets,
 * BEFORE anything is written.
 *
 * Captures the whole row - title, level, group, tags, authPermissions and the
 * full `element` payload (lexical body / Card config / …) - plus the placement
 * facts that tell you the id is the one an author actually edits: which page
 * owns it, whether it sits in `draft_sections`, and which draft section group.
 *
 * usage:
 *   node baseline.mjs <out-dir> <sectionId> [sectionId ...]
 *   node baseline.mjs <out-dir> --from-csv <file.csv> [--id-column "Draft section ID"]
 *                                                     [--page-column "Page ID"]
 *                                                     [--where "Col=Value"]
 *
 * Placement is resolved against the page the report names, NOT the section's
 * own `data.parent` - see the note in fix_lib.snapshot(). With bare section ids
 * on the command line there is no page to resolve against, so `parent` is used
 * and a cloned page's sections will read as ORPHAN. Prefer --from-csv.
 */
import fs from 'fs';
import { config, client, snapshot, writeJson } from './fix_lib.mjs';

const argv = process.argv.slice(2);
const outDir = argv.shift();
if (!outDir) throw new Error('usage: node baseline.mjs <out-dir> <sectionId ...>');

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

let ids = [];
let pageOf = new Map();
let source = null;
if (argv[0] === '--from-csv') {
  const file = argv[1];
  let idCol = 'Draft section ID';
  let pageCol = 'Page ID';
  let where = null;
  for (let i = 2; i < argv.length; i += 2) {
    if (argv[i] === '--id-column') idCol = argv[i + 1];
    if (argv[i] === '--page-column') pageCol = argv[i + 1];
    if (argv[i] === '--where') where = argv[i + 1];
  }
  let rows = parseCsv(fs.readFileSync(file, 'utf8'));
  if (where) {
    const [k, v] = where.split('=');
    rows = rows.filter((r) => r[k] === v);
  }
  ids = [...new Set(rows.map((r) => r[idCol]).filter(Boolean))];
  rows.forEach((r) => { if (r[idCol] && r[pageCol]) pageOf.set(r[idCol], r[pageCol]); });
  source = { csv: file, idColumn: idCol, pageColumn: pageCol, where, rows: rows.length };
} else {
  ids = argv.filter(Boolean);
}
if (!ids.length) throw new Error('no section ids to snapshot');

const c = config();
const falcor = client(c);

const manifest = { takenAt: new Date().toISOString(), host: c.host, app: c.app, source, sections: [] };
for (const id of ids) {
  const snap = await snapshot(falcor, c, id, pageOf.get(id) ?? null);
  writeJson(`${outDir}/${id}.json`, snap);
  const p = snap.placement;
  manifest.sections.push({
    id: snap.id,
    title: snap.data.title || '(untitled)',
    elementType: snap.data.element?.['element-type'] ?? snap.data['element-type'] ?? null,
    tags: snap.data.tags ?? null,
    page: `${p.pageSlug} (${p.pageId})`,
    inDraftSections: p.inDraftSections,
    sectionGroupId: p.sectionGroupId,
    sectionGroupInDraftGroups: p.sectionGroupInDraftGroups,
    parentMatchesPage: p.parentMatchesPage,
    updated_at: snap.updated_at,
  });
  const flag = p.inDraftSections ? 'draft' : (p.inPublishedSections ? 'PUBLISHED-ONLY' : 'ORPHAN');
  const par = p.parentMatchesPage === false ? ' parent≠page' : '';
  console.log(`${snap.id}${par}  ${flag.padEnd(14)} group=${String(p.sectionGroupId).padEnd(38)} tags=${JSON.stringify(snap.data.tags ?? null).padEnd(10)} ${snap.data.title || '(untitled)'}`);
}
writeJson(`${outDir}/_manifest.json`, manifest);
console.log(`\nbaseline: ${manifest.sections.length} section(s) -> ${outDir}`);

const bad = manifest.sections.filter((s) => !s.inDraftSections || !s.sectionGroupInDraftGroups);
if (bad.length) {
  console.log('\nWARNING - not editable as a draft section (do not write to these):');
  bad.forEach((s) => console.log(`  ${s.id}  inDraftSections=${s.inDraftSections} sectionGroupInDraftGroups=${s.sectionGroupInDraftGroups}`));
  process.exitCode = 2;
}
