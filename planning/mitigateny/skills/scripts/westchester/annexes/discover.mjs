// Dump the Westchester annex page's components and their Jurisdictions-column bindings.
// Reads are anonymous (component rows read fine without a token).
import { byIds, graph, atom } from './fq.js';
import fs from 'fs';

const APP = 'mitigat-ny-prod';
const PAGE = process.argv[2] || '2448345'; // the_plan/jurisdictional_annexes/jurisdictional_annex_form

function lexText(ed) {
  try {
    const walk = n => { let t = n.text || ''; if (n.children) n.children.forEach(c => t += ' ' + walk(c)); return t; };
    return ed && ed.text && ed.text.root ? walk(ed.text.root).replace(/\s+/g, ' ').trim() : '';
  } catch (e) { return ''; }
}

const j = await graph([['dms', 'data', APP, 'byId', Number(PAGE), ['data']]]);
let pd = atom(j.jsonGraph?.dms?.data?.[APP]?.byId?.[PAGE]?.data);
if (typeof pd === 'string') { try { pd = JSON.parse(pd); } catch (e) { pd = {}; } }
const order = (pd.draft_sections || []).map(x => String(x.id));
console.error(`page ${PAGE}: ${order.length} draft components (published: ${(pd.sections || []).length})`);

const rows = await byIds(order, ['id', 'type', 'data']);
const comps = order.map((id, i) => {
  const r = rows[id];
  if (!r) return { id, order: i, missing: true };
  const d = r.data || {};
  const el = d.element || {};
  let ed = el['element-data'];
  if (typeof ed === 'string') { try { ed = JSON.parse(ed); } catch (e) { ed = {}; } }
  ed = ed || {};

  // A Card bound to a dataset column carries columns[]; the shown one has show:true.
  const cols = Array.isArray(ed.columns) ? ed.columns : [];
  const shown = cols.filter(c => c && c.show);
  const src = ed.dataRequest?.source || ed.sourceInfo?.source_id || ed.source || null;
  const view = ed.dataRequest?.view || ed.sourceInfo?.view_id || ed.view || null;

  return {
    id, order: i,
    et: el['element-type'],
    isCard: ed.isCard || '',
    title: d.title || ed.title || '',
    source: src, view,
    n_cols: cols.length,
    shown: shown.map(c => ({
      name: c.name, display: c.display_name || c.customName || null,
      type: c.type || null, fmt: c.formatFn || null,
    })),
    all_cols: cols.map(c => c.name),
    text_len: lexText(ed).length,
    preview: lexText(ed).slice(0, 120),
  };
});

fs.writeFileSync(new URL('../out/annex_page_components.json', import.meta.url), JSON.stringify(comps, null, 1));

for (const c of comps) {
  const s = c.shown && c.shown.length ? c.shown.map(x => `${x.name}${x.display ? ' [' + x.display + ']' : ''}`).join(', ') : '';
  console.log(
    String(c.order).padStart(3),
    (c.id || '').padEnd(9),
    (c.et || '').padEnd(14),
    (c.isCard || '').padEnd(20),
    JSON.stringify(c.title || '').padEnd(38),
    c.source ? `src=${c.source}/${c.view}` : '',
    s ? '-> ' + s : ''
  );
}
