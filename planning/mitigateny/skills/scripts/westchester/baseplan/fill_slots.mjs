// Write the Westchester base-plan fill spec into pattern 2448336's draft_sections.
//
//   node fill_slots.mjs                 dry run (default)
//   node fill_slots.mjs --apply         write
//   node fill_slots.mjs --apply 2449721 2450060 ...   write only these slots
//
// Follows the Delaware/Schenectady fill path (skills/scripts/*/fill_md.mjs):
// read the component, MERGE text into its existing element-data (never replace it,
// or isCard/bgColor/showToolbar are lost), write {element, status}.
import { byIds, edit } from './fq.js';
import { buildRootBlocks2 } from './lexical.mjs';
import fs from 'fs';
import path from 'path';

const OUT = path.resolve('../out');
const APPLY = process.argv.includes('--apply');
const only = process.argv.slice(2).filter(a => /^\d+$/.test(a));

const spec = JSON.parse(fs.readFileSync(path.join(OUT, 'fill_spec.json'), 'utf8'));
const work = only.length ? spec.filter(e => only.includes(String(e.slot_id))) : spec;
if (only.length && work.length !== only.length) {
  console.error(`asked for ${only.length} slots, matched ${work.length}`);
  process.exit(1);
}

function lexLen(root) {
  const walk = n => (n?.text || '') + (n?.children || []).map(walk).join('');
  return root ? walk(root).trim().length : 0;
}

const ids = work.map(e => String(e.slot_id));
const cur = await byIds(ids, ['id', 'data']);

const results = [];
let wrote = 0, skipped = 0, failed = 0;

for (const e of work) {
  const id = String(e.slot_id);
  const row = cur[id];
  if (!row) { console.error(`MISSING  ${id}`); skipped++; results.push({ id, status: 'missing' }); continue; }

  const d = row.data || {};
  const el = d.element || {};
  let ed = el['element-data'];
  ed = typeof ed === 'string' ? JSON.parse(ed) : (ed || {});

  // Guard: only ever write grey Annotation boxes (constraint C2).
  if (ed.isCard !== 'Annotation') {
    console.error(`WARN     ${id} isCard=${JSON.stringify(ed.isCard)} - SKIP`);
    skipped++; results.push({ id, status: 'not_annotation', isCard: ed.isCard }); continue;
  }

  const root = buildRootBlocks2(e.blocks);
  const expect = lexLen(root);

  // merge, don't replace.
  // buildRootBlocks2 returns the bare ROOT NODE. Page components store
  // {text:{root:<node>}}; only dataset columns take the bare {root:<node>}.
  // Assigning the node straight to ed.text writes it one level too shallow -
  // the content is all there but nothing finds text.root, so the box renders
  // empty. This bit us on the 2449714 canary; keep the wrapper.
  ed.text = { root };
  const payload = {
    element: { 'element-type': 'lexical', 'element-data': JSON.stringify(ed) },
    status: e.status,
  };

  const label = `${id}  ${String(e.page_title).slice(0, 24).padEnd(24)} ${String(e.slot_title).slice(0, 30).padEnd(30)}`;
  if (!APPLY) {
    console.log(`DRY      ${label} <- ${String(e.blocks.length).padStart(3)} blocks / ${String(expect).padStart(6)} ch`);
    results.push({ id, status: 'dry', blocks: e.blocks.length, expect });
    continue;
  }

  try {
    await edit(id, payload);
  } catch (err) {
    console.error(`FAIL     ${label} ${String(err.message || err).slice(0, 200)}`);
    failed++; results.push({ id, status: 'write_failed', err: String(err.message || err).slice(0, 400) });
    continue;
  }
  console.log(`WROTE    ${label} <- ${String(e.blocks.length).padStart(3)} blocks / ${String(expect).padStart(6)} ch`);
  wrote++;
  results.push({ id, status: 'ok', blocks: e.blocks.length, expect });
}

fs.writeFileSync(path.join(OUT, APPLY ? 'fill_results.json' : 'fill_results_dry.json'),
  JSON.stringify(results, null, 1));

if (APPLY) {
  console.error(`\napplied ${wrote}, skipped ${skipped}, failed ${failed} of ${work.length}`);
  console.error('now run:  node verify_slots.mjs');
} else {
  const tot = results.reduce((a, r) => a + (r.expect || 0), 0);
  console.error(`\nDRY RUN - ${work.length} slots, ${tot} chars, ${skipped} would skip. Re-run with --apply.`);
}
