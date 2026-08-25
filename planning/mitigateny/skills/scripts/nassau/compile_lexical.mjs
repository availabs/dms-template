/**
 * Phase 7c - compile the reviewed Jurisdictions markdown into lexical column values.
 *
 * 52 jurisdictions x 7 lexical columns. Reuses scripts/suffolk/lexical.mjs, the root builder
 * proven on the Schenectady and Delaware loads -- this file only adds the markdown front end.
 *
 * SCOPE IS SMALLER THAN THE PHASE-7 PLAN ASSUMED. The plan warned that HOC's
 * `general_vulnerability` / `other_comments` / `reason_for_exclusion` and Participation's
 * `narrative` / `agenda_minutes` are "lexical too". They are declared lexical and they are
 * stored as PLAIN STRINGS -- measured against 20,000 live rows during the Suffolk load and
 * re-confirmed on Nassau's 1,190 seeded HOC rows. Compiling those would produce a value the UI
 * does not expect. Only the Jurisdictions columns are genuinely lexical.
 *
 * MARKDOWN SUPPORTED, and no more than the generator emits (surveyed across all 52 records:
 * 156 whole-line bolds, 52 inline bolds, zero lists):
 *
 *   blank line          -> block separator
 *   **whole line**      -> heading (h4)  e.g. the capability-table labels
 *   **inline**          -> bold text run
 *
 * Anything else is carried through as literal text rather than silently reinterpreted.
 *
 * VERIFICATION. Every compiled root is flattened back to text and compared against the source
 * markdown stripped of its markers. A mismatch fails the run. That is what makes this a
 * compilation rather than a re-authoring -- the prose in the database has to be the prose that
 * was reviewed.
 *
 * Usage: node compile_lexical.mjs [--verbose]
 * Writes: payloads/juris_<geoid>_lexical.json   {column: {root:{...}}}
 */
import fs from 'node:fs';
import path from 'node:path';
// scripts -> context -> Nassau -> mny-transcribe -> references -> repo root  = five levels
import { buildRoot, rootToText } from '../../../../../planning/mitigateny/skills/scripts/suffolk/lexical.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const CTX = path.resolve(HERE, '..');
const PAY = path.join(CTX, 'payloads');
const VERBOSE = process.argv.includes('--verbose');

/** `a **b** c` -> [{t:'a '},{t:'b',b:true},{t:' c'}] */
const inlineRuns = (line) => {
  const runs = [];
  let i = 0;
  const re = /\*\*(.+?)\*\*/g;
  let m;
  while ((m = re.exec(line)) !== null) {
    if (m.index > i) runs.push({ t: line.slice(i, m.index) });
    runs.push({ t: m[1], b: true });
    i = m.index + m[0].length;
  }
  if (i < line.length) runs.push({ t: line.slice(i) });
  return runs.length ? runs : [{ t: line }];
};

const mdToBlocks = (md) => {
  const blocks = [];
  for (const raw of md.split(/\n\s*\n/)) {
    const para = raw.trim().replace(/\s*\n\s*/g, ' ');
    if (!para) continue;
    const whole = para.match(/^\*\*(.+)\*\*$/);
    if (whole && !whole[1].includes('**')) {
      blocks.push({ t: 'h', text: whole[1].trim(), tag: 'h4' });
    } else {
      blocks.push({ t: 'p', runs: inlineRuns(para) });
    }
  }
  return blocks;
};

/** The markdown with its markers removed and whitespace collapsed — the comparison basis. */
const plain = (md) => md.replace(/\*\*/g, '').split(/\s+/).filter(Boolean).join(' ');

const files = fs.readdirSync(PAY).filter(f => /^juris_\d+\.json$/.test(f)).sort();
let nCols = 0, nBlocks = 0, nHead = 0, nBold = 0;
const problems = [];

for (const f of files) {
  const geoid = f.slice(6, -5);
  const cols = JSON.parse(fs.readFileSync(path.join(PAY, f), 'utf8'));
  const out = {};
  for (const [col, md] of Object.entries(cols)) {
    if (!md || !md.trim()) continue;          // blank stays blank; do not write an empty root
    const blocks = mdToBlocks(md);
    const root = buildRoot(blocks);
    nCols++;
    nBlocks += blocks.length;
    nHead += blocks.filter(b => b.t === 'h').length;
    nBold += blocks.filter(b => b.t === 'p' && b.runs.some(r => r.b)).length;

    // round-trip: the compiled prose must be the reviewed prose
    const before = plain(md);
    const after = plain(rootToText(root));
    if (before !== after) {
      const at = [...before].findIndex((ch, i) => ch !== after[i]);
      problems.push(`${geoid}/${col}: round-trip mismatch at char ${at}\n` +
        `    md   : ${before.slice(Math.max(0, at - 40), at + 60)}\n` +
        `    root : ${after.slice(Math.max(0, at - 40), at + 60)}`);
    }
    out[col] = root;
  }
  fs.writeFileSync(path.join(PAY, `juris_${geoid}_lexical.json`), JSON.stringify(out, null, 1));
  if (VERBOSE) console.log(`  ${geoid}: ${Object.keys(out).length} column(s)`);
}

console.log(`compiled ${nCols} lexical column value(s) across ${files.length} jurisdictions`);
console.log(`     ${nBlocks} block(s): ${nHead} heading(s), ${nBold} paragraph(s) with bold runs`);
console.log(problems.length
  ? `\n${problems.length} ROUND-TRIP FAILURE(S):\n${problems.slice(0, 10).join('\n')}`
  : `     round-trip verified: every compiled value flattens back to its source markdown`);
process.exit(problems.length ? 1 : 0);
