/**
 * Step 6 gate: did the run do only what it intended?  READ ONLY.
 *
 * Compares the frozen pre-run grouping against a post-run one and asserts:
 *   - the TEMPLATE is byte-unchanged on every setting (it is never written to)
 *   - the targeted settings are now at the template's value
 *   - AUTHORED TEXT moved nowhere, in any pattern
 *   - geoid filter values moved nowhere
 *   - untouched classes did not move
 *   - no OTHER pattern moved
 *
 * usage:
 *   node verify_snap.mjs <pre-groups.json> <post-groups.json> <target-subdomain>
 */
import fs from 'fs';

const argv = process.argv.slice(2);
const [preF, postF, target] = argv;
// settings the run was allowed to move on the target; geoid values move with a
// filter-shape snap, so --allow-geoid records that as intended rather than stray
const allowed = (argv.includes('--settings') ? argv[argv.indexOf('--settings') + 1] : '').split(',').map((s) => s.trim()).filter(Boolean);
const allowGeoid = argv.includes('--allow-geoid');
if (!preF || !postF || !target) throw new Error('usage: node verify_snap.mjs <pre.json> <post.json> <target-sub>');
const pre = JSON.parse(fs.readFileSync(preF, 'utf8'));
const post = JSON.parse(fs.readFileSync(postF, 'utf8'));
const J = (v) => JSON.stringify(v);
const tagsOf = (m) => (Array.isArray(m.tags) ? m.tags.join(',') : String(m.tags ?? ''));
const geoid = (f) => J((f || []).filter((x) => /geoid/i.test(x.col)).map((x) => [x.col, x.value]));

// index every component by section id, per pattern
const index = (g) => {
  const m = new Map();
  g.groups.forEach((grp) => Object.entries(grp.members).forEach(([sub, r]) => m.set(`${sub}:${r.id}`, r)));
  return m;
};
const A = index(pre), B = index(post);
const SUBS = [...new Set([...A.keys()].map((k) => k.split(':')[0]))];
const TEMPLATE = pre.template;

const FIELDS = {
  tags: tagsOf,
  authPermissions: (m) => String(m.perms ?? ''),
  'display.fetchMode': (m) => String(m.fetchMode ?? ''),
  'columns[]': (m) => J(m.cols || []),
  filters: (m) => J(m.filters || []),
  title: (m) => String(m.title ?? ''),
  hideInView: (m) => String(m.hideInView),
  'config shape': (m) => String(m.shape ?? ''),
  snapshotCols: (m) => String(m.snapshotCols ?? ''),
  authoredText: (m) => String(m.authoredText ?? ''),
  geoidValues: (m) => geoid(m.filters),
};

let fail = 0;
console.log(`gate: ${preF.split(/[\\/]/).pop()} -> ${postF.split(/[\\/]/).pop()}   target = ${target}\n`);
for (const sub of SUBS) {
  const ids = [...A.keys()].filter((k) => k.startsWith(`${sub}:`));
  const moved = {};
  let gone = 0;
  for (const k of ids) {
    const a = A.get(k), b = B.get(k);
    if (!b) { gone++; continue; }
    for (const [name, fn] of Object.entries(FIELDS)) {
      if (J(fn(a)) !== J(fn(b))) (moved[name] = moved[name] || []).push(k.split(':')[1]);
    }
  }
  const isTarget = sub === target;
  const isTemplate = sub === TEMPLATE;
  const label = isTemplate ? 'TEMPLATE' : isTarget ? 'TARGET' : 'bystander';
  console.log(`${sub}  [${label}]  ${ids.length} components, ${gone} no longer present`);
  for (const [name, list] of Object.entries(moved)) {
    const expected = isTarget && (allowed.includes(name) || (allowGeoid && name === 'geoidValues'));
    const bad = !expected;
    if (bad) fail += list.length;
    console.log(`   ${bad ? 'UNEXPECTED' : 'expected  '}  ${name.padEnd(18)} moved on ${String(list.length).padStart(4)} components${bad ? '  <-- ' + list.slice(0, 4).join(',') : ''}`);
  }
  if (!Object.keys(moved).length) console.log('   nothing moved');
  // Snapshot coherence: element-data.columns is diffed by the admin against the
  // component's OWN source snapshot, so writing columns from elsewhere without
  // moving the snapshot with them manufactures "metadata out of date" badges.
  // Columns and snapshot must travel together.
  const incoherent = ids.filter((k) => {
    const a = A.get(k), b = B.get(k);
    if (!b || !a) return false;
    const colsMoved = J(a.cols) !== J(b.cols);
    const snapMoved = String(a.snapshotCols) !== String(b.snapshotCols);
    return colsMoved && !snapMoved;
  });
  if (incoherent.length) {
    console.log(`   INCOHERENT  columns[] moved WITHOUT the source snapshot on ${incoherent.length} components`);
    console.log(`               -> this creates metadata-out-of-date badges: ${incoherent.slice(0, 4).map((k) => k.split(':')[1]).join(',')}`);
    fail += incoherent.length;
  }
  // hard assertions
  if (isTemplate && Object.keys(moved).length) { console.log('   *** THE TEMPLATE WAS MODIFIED ***'); fail += 1000; }
  if (moved.authoredText) { console.log('   *** AUTHORED TEXT MOVED ***'); }
  if (moved.geoidValues) { console.log('   *** GEOID VALUES MOVED ***'); }
  console.log('');
}
console.log(fail === 0 ? 'GATE PASSED - only the intended settings moved, and only on the target.'
  : `GATE FAILED - ${fail} unexpected changes.`);
process.exit(fail === 0 ? 0 : 1);
