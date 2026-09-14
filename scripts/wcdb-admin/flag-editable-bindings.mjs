#!/usr/bin/env node
/* Stamp `externalSource.isEditable: true` on every station_admin Card that writes
 * (allowEditInView / allowAdddNew / allowDelete) and is bound to a wcdb-dama source
 * whose metadata says `isEditable`.
 *
 * WHY. The dataWrapper gates every write — and, for external sources, the very
 * request for a row `id` — on the SECTION's `externalSource.isEditable`, not the
 * source's metadata. The seed's `pg()` binding never set it (fixed in lib.mjs), so
 * the admin's live-edit forms saved nothing and rows arrived without a key. The
 * source picker writes the flag when an author binds through the UI, which is why
 * the one card that was rebound by hand (schedule Add) already had it.
 *
 *   export DMS_HOST=… DMS_APP=wcdb DMS_TYPE=prod DMS_AUTH_TOKEN=…   # wcdb Admin
 *   node scripts/wcdb-admin/flag-editable-bindings.mjs [--dry-run]
 *
 * Idempotent, DRAFT ONLY (a human publishes each page).
 */
import { dms, dmsJson, PATTERN, HOST } from './lib.mjs';

const DRY = process.argv.includes('--dry-run');
const env = 'wcdb-dama';

/* Which sources are editable — asked of the graph, not assumed. */
const token = process.env.DMS_AUTH_TOKEN;
const listed = dmsJson(['page', 'list', '--pattern', PATTERN, '--format', 'json']);
const pages = listed.items || [];
if (!pages.length) { console.error(`ABORT: no pages visible in '${PATTERN}' — is DMS_AUTH_TOKEN a wcdb Admin?`); process.exit(1); }

const sourceIds = new Set();
const cards = [];
for (const p of pages) {
  const slug = p.data?.url_slug;
  const secs = dmsJson(['section', 'list', String(p.id), '--pattern', PATTERN, '--draft']);
  for (const s of secs) {
    if (s.data?.['element-type'] !== 'Card') continue;
    const row = dmsJson(['section', 'dump', String(s.id)]);
    let ed; try { ed = JSON.parse(row.data.element['element-data']); } catch { continue; }
    const d = ed.display || {}; const es = ed.externalSource || {};
    if (!(d.allowEditInView || d.allowAdddNew || d.allowDelete)) continue;
    if (es.isDms || es.env !== env || !es.source_id) continue;
    sourceIds.add(es.source_id);
    cards.push({ slug, id: String(row.id), row, ed });
  }
}

const paths = JSON.stringify([['uda', env, 'sources', 'byId', [...sourceIds], 'metadata']]);
const res = await fetch(`${HOST}/graph?paths=${encodeURIComponent(paths)}&method=get`, { headers: { Authorization: `Bearer ${token}` } });
const graph = await res.json();
const editable = new Set();
for (const [id, v] of Object.entries(graph?.jsonGraph?.uda?.[env]?.sources?.byId || {})) {
  let m = v.metadata; m = m && m.$type ? m.value : m; if (typeof m === 'string') { try { m = JSON.parse(m); } catch { m = {}; } }
  if (m?.isEditable) editable.add(+id);
}
console.log(`editable sources: ${[...editable].join(', ')}`);

let n = 0;
for (const { slug, id, row, ed } of cards) {
  const sid = +ed.externalSource.source_id;
  if (!editable.has(sid)) { console.log(`  ${slug.padEnd(14)} ${id}: source ${sid} not editable — skipped`); continue; }
  const already = ed.externalSource.isEditable === true;
  // Housekeeping from the playlist investigation: a temporary `kind` probe column.
  const cols = ed.columns.filter((c) => !(c.name === 'kind' && c.selectOnly && slug === 'playlist' && ed.display.liveEdit));
  const changed = !already || cols.length !== ed.columns.length;
  if (!changed) { console.log(`  ${slug.padEnd(14)} ${id}: ok`); continue; }
  ed.externalSource = { ...ed.externalSource, isEditable: true };
  ed.columns = cols;
  ed.data = [];
  const payload = { element: { ...row.data.element, 'element-data': JSON.stringify(ed) } };
  if (DRY) console.log(`  [dry-run] ${slug.padEnd(14)} ${id}: isEditable → true`);
  else { dms(['section', 'update', id, '--data', JSON.stringify(payload)]); console.log(`  ${slug.padEnd(14)} ${id}: isEditable → true`); }
  n++;
}
console.log(DRY ? `\nDry run — ${n} section(s) would change.` : `\n${n} section(s) updated (drafts). Publish each page after review.`);
