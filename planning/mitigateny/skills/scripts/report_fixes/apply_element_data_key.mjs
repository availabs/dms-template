/**
 * The nested-key half of the fix loop: set ONE key inside a section's
 * `element['element-data']` payload.
 *
 * `apply.mjs` cannot do this. It drives `dms section update --set <attr>=<v>`,
 * which lodash-merges into the TOP LEVEL of `data` - fine for `tags`, wrong for
 * anything inside `element-data`, because that attribute is a JSON *string*.
 * `--set element.element-data.display.fetchMode=force` would merge an object
 * over a string and destroy the payload; `--set element.element-data=<json>`
 * would be JSON.parsed by `parseSetPairs` and change the attribute's TYPE from
 * string to object. Neither is acceptable.
 *
 * So this script does the only safe thing: parse the string, set the one key,
 * re-serialise, and prove the new string differs from the old one by exactly
 * that key and nothing else.
 *
 * ── Why the proof is possible at all ──────────────────────────────────────
 * These payloads are written by `JSON.stringify`, so
 * `JSON.stringify(JSON.parse(s)) === s` holds byte-for-byte. The script
 * ASSERTS that round-trip before writing and REFUSES the row if it fails -
 * without it, re-serialising could reformat a payload of 30k characters and no
 * leaf-level diff would ever reveal it. That refusal is the point: a row whose
 * payload is not stringify-canonical needs a human, not a retry.
 *
 * ── Why a full `data` object is passed to the CLI ─────────────────────────
 * `dms section update --data <file>` writes the object through
 * `dms data edit`. Whether that call full-replaces `data` or merges it is
 * irrelevant here, because the object supplied IS the row's current `data`
 * with one key changed: replace and merge produce the same result. Passing a
 * file rather than inline JSON also keeps a 30k payload out of argv.
 *
 * Refuses to write when:
 *   - there is no baseline for the id (step 1 was skipped);
 *   - the live row drifted since the baseline was taken;
 *   - the section is not in the page's `draft_sections`, or its group is not
 *     one of the page's `draft_section_groups`;
 *   - `element-data` is absent, is not a string, or is not stringify-canonical;
 *   - the re-serialised string differs from the original anywhere other than
 *     the target key;
 *   - the key already holds the requested value (reported as NO-OP).
 *
 * usage:
 *   node apply_element_data_key.mjs <run-dir> --key display.fetchMode
 *                                   --value-from "Target fetch mode" [--dry-run]
 *
 * `<run-dir>` holds `rows.csv` (the frozen report rows) and `baseline/`.
 * A row whose value column is empty is SKIPPED - that is how a deliberately
 * held row stays in the run's record instead of vanishing from it.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { config, client, snapshot, canonical, readJson, writeJson } from './fix_lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DMS = path.resolve(HERE, '../../../../../src/dms/packages/dms/cli/bin/dms.js');

const argv = process.argv.slice(2);
const runDir = argv.shift();
let keyPath = null, valueColumn = null, dryRun = false;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--key') keyPath = argv[++i];
  else if (argv[i] === '--value-from') valueColumn = argv[++i];
  else if (argv[i] === '--dry-run') dryRun = true;
}
if (!runDir || !keyPath || !valueColumn) {
  throw new Error('usage: node apply_element_data_key.mjs <run-dir> --key <a.b.c> --value-from "<csvColumn>" [--dry-run]');
}

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

const getIn = (o, keys) => keys.reduce((a, k) => (a == null ? a : a[k]), o);
function setIn(o, keys, v) {
  let cur = o;
  for (let i = 0; i < keys.length - 1; i++) {
    if (cur[keys[i]] == null || typeof cur[keys[i]] !== 'object') cur[keys[i]] = {};
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = v;
}
function delIn(o, keys) {
  const parent = getIn(o, keys.slice(0, -1));
  if (parent && typeof parent === 'object') delete parent[keys[keys.length - 1]];
}

const keys = keyPath.split('.');
const rows = parseCsv(fs.readFileSync(`${runDir}/rows.csv`, 'utf8'));
const c = config();
const falcor = client(c);
fs.mkdirSync(`${runDir}/payloads`, { recursive: true });

const results = [];
for (const r of rows) {
  const id = r['Draft section ID'];
  const want = (r[valueColumn] ?? '').trim();
  const fixId = r['Fix ID'] || '(no fix id)';
  const rec = { fixId, id, keyPath, want, action: null, detail: '' };

  const baseFile = `${runDir}/baseline/${id}.json`;
  if (!fs.existsSync(baseFile)) {
    rec.action = 'REFUSED'; rec.detail = 'no baseline - run baseline.mjs first';
    results.push(rec); continue;
  }
  const base = readJson(baseFile);

  if (!want) {
    rec.action = 'SKIPPED';
    rec.detail = `report column "${valueColumn}" is empty` + (r.Notes ? ` - ${r.Notes}` : '');
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

  const el = live.data.element || {};
  const raw = el['element-data'];
  if (typeof raw !== 'string') {
    rec.action = 'REFUSED';
    rec.detail = `element-data is ${raw === undefined ? 'absent' : typeof raw}, not a JSON string`;
    results.push(rec); continue;
  }

  let obj;
  try { obj = JSON.parse(raw); }
  catch (e) { rec.action = 'REFUSED'; rec.detail = `element-data is not parseable JSON: ${e.message}`; results.push(rec); continue; }

  // The canonicality assertion. Without it, "only one key changed" is unprovable.
  const roundTrip = JSON.stringify(obj);
  rec.payloadChars = raw.length;
  rec.roundTripCanonical = roundTrip === raw;
  if (!rec.roundTripCanonical) {
    rec.action = 'REFUSED';
    rec.detail = `element-data is not stringify-canonical (${raw.length} chars -> ${roundTrip.length}); re-serialising would reformat it. Needs a human.`;
    results.push(rec); continue;
  }

  const current = getIn(obj, keys);
  if (String(current ?? '') === want) {
    rec.action = 'NO-OP'; rec.detail = `${keyPath} already ${JSON.stringify(want)}`;
    results.push(rec); continue;
  }
  rec.from = current ?? null;

  setIn(obj, keys, want);
  const next = JSON.stringify(obj);

  // Prove minimality at the STRING level: strip the key back out of the new
  // object and the serialisation must be byte-identical to what we started
  // with. This catches a reordered key, a re-encoded unicode escape, a number
  // that round-tripped to a different literal - anything a leaf diff of the
  // parsed form would silently accept.
  const check = JSON.parse(next);
  if (current === undefined) delIn(check, keys); else setIn(check, keys, current);
  if (JSON.stringify(check) !== raw) {
    rec.action = 'REFUSED';
    rec.detail = 'reverting the key does not reproduce the original payload byte-for-byte - refusing to write';
    results.push(rec); continue;
  }
  rec.payloadCharsAfter = next.length;
  rec.payloadDelta = next.length - raw.length;

  if (dryRun) {
    rec.action = 'WOULD SET';
    rec.detail = `${keyPath}: ${JSON.stringify(rec.from)} -> ${JSON.stringify(want)} (payload ${raw.length} -> ${next.length} chars, +${rec.payloadDelta})`;
    results.push(rec); continue;
  }

  // Full current `data` with the one key changed - see the header note on why
  // replace-vs-merge does not matter for this shape.
  const payload = JSON.parse(JSON.stringify(live.data));
  payload.element = { ...el, 'element-data': next };
  const payloadFile = path.resolve(`${runDir}/payloads/${id}.json`);
  fs.writeFileSync(payloadFile, JSON.stringify(payload));

  const out = execFileSync(process.execPath, [DMS, 'section', 'update', id, '--data', payloadFile], {
    encoding: 'utf8', env: process.env, stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Read back and assert the payload is EXACTLY the string we computed.
  const after = await snapshot(falcor, c, id, base.placement.pageId ?? null);
  const rawAfter = (after.data.element || {})['element-data'];
  rec.exactPayloadMatch = rawAfter === next;
  rec.typeStillString = typeof rawAfter === 'string';
  rec.action = (rec.exactPayloadMatch && rec.typeStillString) ? 'SET' : 'FAIL';
  rec.detail = [
    `${keyPath}: ${JSON.stringify(rec.from)} -> ${JSON.stringify(want)}`,
    rec.typeStillString ? 'element-data still a string' : 'ELEMENT-DATA TYPE CHANGED',
    rec.exactPayloadMatch ? 'payload byte-identical to the computed string' : 'PAYLOAD DIFFERS FROM COMPUTED',
  ].join('; ');
  rec.cliOutput = out.trim().split('\n').slice(-1)[0]?.slice(0, 120);
  results.push(rec);
}

for (const r of results) {
  console.log(`${r.fixId.padEnd(8)} ${String(r.id).padEnd(9)} ${r.action.padEnd(10)} ${r.detail}`);
}
writeJson(`${runDir}/applied.json`, {
  at: new Date().toISOString(), attr: `element-data:${keyPath}`, column: valueColumn, dryRun, results,
});
console.log(`\n${dryRun ? 'dry run' : 'applied'} -> ${runDir}/applied.json`);
if (results.some((r) => r.action === 'REFUSED' || r.action === 'FAIL')) process.exitCode = 2;
