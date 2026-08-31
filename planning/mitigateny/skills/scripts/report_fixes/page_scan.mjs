/**
 * A live inventory of one page's DRAFT sections — the independent check that a
 * report row is pointing at the component it claims to.
 *
 * A report's `Draft section ID` can be resolved `positional`ly (see the skill),
 * and a positional id is only right while the arrays are aligned. This prints
 * what is actually on the page — index, id, trackingId, element type, title,
 * tags, and for lexical bodies whether there is any text in them — so a row can
 * be matched on *title + component kind*, which no id drift can fake.
 *
 * It also answers the two questions a delete sweep needs: which components are
 * genuinely empty, and whether draft and published are in trackingId
 * correspondence (a trackingId present in one array and not the other means the
 * page itself has drifted, and no fix should be written until that is explained).
 *
 * usage:
 *   node page_scan.mjs <page-id> [--json] [--find-trk <uuid> ...] [--no-published]
 */
import {
  config, client, refIds,
} from './fix_lib.mjs';
import {
  fetchById, parseData,
} from '../../../../../src/dms/packages/dms/cli/src/utils/data.js';

const argv = process.argv.slice(2);
const pageId = argv.shift();
if (!pageId) throw new Error('usage: node page_scan.mjs <page-id> [--json] [--find-trk <uuid>]');
let asJson = false, withPublished = true;
const findTrk = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--json') asJson = true;
  else if (argv[i] === '--no-published') withPublished = false;
  else if (argv[i] === '--find-trk') findTrk.push(argv[++i]);
}

const c = config();
const falcor = client(c);

/** Concatenated text of a lexical body — '' means the body renders as blank. */
const textOf = (n, acc = []) => {
  if (!n || typeof n !== 'object') return acc;
  if (typeof n.text === 'string') acc.push(n.text);
  for (const k of ['children', 'root']) {
    if (n[k]) (Array.isArray(n[k]) ? n[k] : [n[k]]).forEach((x) => textOf(x, acc));
  }
  return acc;
};

async function describe(id, i) {
  const row = await fetchById(falcor, c.app, id, ['id', 'data', 'updated_at']);
  if (!row) return { i, id, missing: true };
  const d = parseData(row.data) || {};
  const el = d.element || {};
  let ed = el['element-data'];
  if (typeof ed === 'string') { try { ed = JSON.parse(ed); } catch { /* keep string */ } }

  let content = '-';
  if (String(el['element-type']).includes('lexical')) {
    if (ed == null) content = 'EMPTY(no element-data)';
    else {
      const text = textOf(ed.text || ed).join('').trim();
      const hasImage = JSON.stringify(ed).includes('"src"');
      content = text ? `text:${text.length}` : (hasImage ? 'EMPTY(image only)' : 'EMPTY(blank body)');
    }
  }

  return {
    i,
    id: String(id),
    trackingId: d.trackingId ?? null,
    type: el['element-type'] ?? null,
    title: d.title ?? null,
    level: d.level ?? null,
    tags: d.tags ?? null,
    content,
    updated_at: row.updated_at,
  };
}

const page = await fetchById(falcor, c.app, pageId, ['id', 'data']);
if (!page) throw new Error(`page not found: ${pageId}`);
const pd = parseData(page.data) || {};
const draftIds = refIds(pd.draft_sections);
const pubIds = refIds(pd.sections);

const draft = [];
for (const [i, id] of draftIds.entries()) draft.push(await describe(id, i));

// trackingId correspondence between the two arrays: a key in one and not the
// other is page-level drift, and is worth knowing before any write.
let correspondence = null;
if (withPublished) {
  const trkOf = async (ids) => {
    const m = new Map();
    for (const id of ids) {
      const r = await fetchById(falcor, c.app, id, ['id', 'data']);
      const d = r ? parseData(r.data) || {} : {};
      m.set(String(d.trackingId), { id: String(id), title: d.title ?? null, type: (d.element || {})['element-type'] ?? null });
    }
    return m;
  };
  const dm = new Map(draft.map((s) => [String(s.trackingId), s]));
  const pm = await trkOf(pubIds);
  correspondence = {
    draftOnly: [...dm.keys()].filter((k) => !pm.has(k)).map((k) => dm.get(k)),
    publishedOnly: [...pm.keys()].filter((k) => !dm.has(k)).map((k) => pm.get(k)),
  };
}

const out = {
  page: { id: String(pageId), slug: pd.url_slug ?? '', title: pd.title ?? '', published: pd.published ?? null, has_changes: !!pd.has_changes, draftCount: draftIds.length, publishedCount: pubIds.length },
  draft,
  correspondence,
  found: findTrk.map((t) => ({ trackingId: t, inDraft: draft.find((s) => String(s.trackingId) === t) ?? null })),
};

if (asJson) {
  console.log(JSON.stringify(out, null, 1));
} else {
  const p = out.page;
  console.log(`page ${p.id}  ${p.slug}  published=${p.published ?? '(none)'} has_changes=${p.has_changes} draft=${p.draftCount} published=${p.publishedCount}\n`);
  for (const s of draft) {
    if (s.missing) { console.log(`${String(s.i).padStart(3)} ${String(s.id).padStart(8)}  MISSING ROW`); continue; }
    console.log(`${String(s.i).padStart(3)} ${s.id.padStart(8)} trk=${String(s.trackingId).slice(0, 8)} ${String(s.type).slice(0, 10).padEnd(10)} lvl=${String(s.level ?? '').padEnd(4)} tags=${String(s.tags ?? '').padEnd(15)} ${s.content.padEnd(23)} ${String(s.title ?? '')}`);
  }
  if (correspondence) {
    const { draftOnly, publishedOnly } = correspondence;
    console.log(`\ntrackingId correspondence: draft-only=${draftOnly.length} published-only=${publishedOnly.length}`
      + `${draftOnly.length || publishedOnly.length ? '  <-- page has drifted; explain before writing' : '  (exact)'}`);
    [...draftOnly, ...publishedOnly].forEach((s) => console.log(`   ${JSON.stringify(s)}`));
  }
  out.found.forEach((f) => console.log(`\ntrackingId ${f.trackingId}: ${f.inDraft ? `draft index ${f.inDraft.i} (id ${f.inDraft.id})` : 'NOT in this page\'s draft_sections'}`));
}
