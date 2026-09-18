#!/usr/bin/env node
/* Rewrite the shared footer on the public pages that ALREADY exist.
 *
 *   export DMS_HOST=https://dmsserver.availabs.org DMS_APP=wcdb DMS_TYPE=prod DMS_AUTH_TOKEN=…
 *   node scripts/wcdb-public/update-footer.mjs --dry-run     # read-only: shows what it would touch
 *   node scripts/wcdb-public/update-footer.mjs               # rewrites the DRAFT footer sections
 *
 * The footer is `footer.mjs` — the same definition the seed stamps onto new
 * pages — so this and a `WIPE=1` re-seed agree. Each page's footer is found by
 * content (the eyebrow `FOOTER_MARKER`), not by id: ids change on every
 * re-seed. Only `draft_sections` are written; publishing stays a human act:
 *
 *   dms page publish <slug> --pattern wcdb_main
 */
import { dms, dmsJson } from '../wcdb-admin/lib.mjs';
import { footerData, FOOTER_MARKER } from './footer.mjs';

const PATTERN = 'wcdb_main';
const SLUGS = ['home', 'schedule', 'djs', 'playlist', 'events', 'station_info', 'show', 'blog'];
const DRY = process.argv.includes('--dry-run');

const elementData = JSON.stringify(footerData());
const touched = [];

for (const slug of SLUGS) {
  const sections = dmsJson(['section', 'list', slug, '--draft', '--pattern', PATTERN]);
  const lexicals = (Array.isArray(sections) ? sections : sections.items || [])
    .filter((s) => s?.data?.['element-type'] === 'lexical');
  const footers = lexicals.filter((s) => {
    const row = dmsJson(['section', 'dump', String(s.id)]);
    const ed = row?.data?.element?.['element-data'] ?? row?.element?.['element-data'] ?? '';
    return String(ed).includes(FOOTER_MARKER);
  });
  if (footers.length !== 1) {
    console.log(`${slug}: expected one footer, found ${footers.length} — skipped`);
    continue;
  }
  const id = String(footers[0].id);
  if (DRY) {
    console.log(`${slug}: would rewrite draft section ${id}`);
  } else {
    dms(['section', 'update', id, '--data', JSON.stringify({ element: { 'element-type': 'lexical', 'element-data': elementData } })]);
    console.log(`${slug}: rewrote draft section ${id}`);
  }
  touched.push(slug);
}

if (!DRY && touched.length) {
  console.log(`\nDrafts updated. Publish when reviewed:\n${touched.map((s) => `  dms page publish ${s} --pattern ${PATTERN}`).join('\n')}`);
}
