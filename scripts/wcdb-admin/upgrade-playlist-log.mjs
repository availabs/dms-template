#!/usr/bin/env node
/* Bring the LIVE admin playlist drafts up to what seed-wcdb-admin-pages.mjs now
 * describes, without wiping the other pages' drafts:
 *
 *   1. the log's time column in STATION time (it was the server's UTC);
 *   2. the row gutter (drop `cardsPadding: 0` on the log rows + header strip);
 *   3. time / source / action cells spanning both row lines, no spacer;
 *   4. a `ShowBlockNav` section between the title and the header strip;
 *   5. `from`/`to` registered on the page and two range leaves on the log;
 *   6. the `+ Add a song` button moved from the page header into the log's
 *      title row (top-right corner of the card), the `Public spin log →` link
 *      removed, the header lexical widened to 12;
 *   7. the Review queue band moved BELOW the log, its pills pulled together
 *      at the right and inset 24px from the border (they sat on it);
 *   8. the "Tonight · By show" title row REMOVED — the navigator names the
 *      show — so the navigator (left half) and the action Card (right half)
 *      are the card's top row;
 *   9. the "Fix this track" modal Card gets `allowDelete` (two-step Delete
 *      track button; closes the modal, refreshes the log via `song_added`).
 *
 *   export DMS_HOST=https://dmsserver.availabs.org DMS_APP=wcdb DMS_TYPE=prod
 *   export DMS_AUTH_TOKEN=…        # an account in the `wcdb Admin` group
 *   node scripts/wcdb-admin/upgrade-playlist-log.mjs [--dry-run]
 *
 * Idempotent: re-running finds the navigator already there and rewrites the
 * same values. DRAFT ONLY — a human publishes (`dms page publish playlist
 * --pattern station_admin`).
 */
import { dms, dmsJson, PATTERN, COMPONENT_TYPE, APP, section, lexical, lcontainer, litem, head, styled, text } from './lib.mjs';

const DRY = process.argv.includes('--dry-run');
const STATION_TZ = 'America/New_York';
const PLAYED_AT = `to_char(received_at AT TIME ZONE '${STATION_TZ}', 'HH24:MI') as played_at`;

const log = (...a) => console.log(...a);
const parseED = (row) => JSON.parse(row.data.element['element-data']);
const withED = (row, ed, extra = {}) => ({ ...extra, element: { ...row.data.element, 'element-data': JSON.stringify(ed) } });
// `section update` is by id and takes no --pattern (only create/delete do).
const write = (what, args) => { if (DRY) { log(`  [dry-run] ${what}`); return; } dms(args); log(`  ${what}`); };

/* ── the page ─────────────────────────────────────────────────────────────── */
const listed = dmsJson(['page', 'list', '--pattern', PATTERN, '--format', 'json']);
const page = (listed.items || []).find((p) => (p.data?.url_slug ?? p.url_slug) === 'playlist');
if (!page) {
  console.error(`ABORT: no 'playlist' page visible in pattern '${PATTERN}'. Is DMS_AUTH_TOKEN an account in the 'wcdb Admin' group?`);
  process.exit(1);
}
const pageId = String(page.id);
const pageRow = dmsJson(['raw', 'get', pageId]);
const pageData = pageRow.data || pageRow;
const draftIds = (pageData.draft_sections || []).map((s) => String(s.id));
log(`page ${pageId} · ${draftIds.length} draft sections`);

/* ── find the log's sections ──────────────────────────────────────────────── */
const rows = draftIds.map((id) => dmsJson(['section', 'dump', id]));
const byId = Object.fromEntries(rows.map((r) => [String(r.id), r]));
const isCard = (r) => r.data.element?.['element-type'] === 'Card';
const raw = (r) => r.data.element?.['element-data'] || '';

const logCard = rows.find((r) => isCard(r) && raw(r).includes('as played_at'));
const header = rows.find((r) => isCard(r) && raw(r).includes('hdr_Time'));
const existingNav = rows.find((r) => r.data.element?.['element-type'] === 'ShowBlockNav');
if (!logCard || !header) {
  console.error('ABORT: could not find the log card (played_at) and/or the header strip (hdr_Time) among the drafts.');
  process.exit(1);
}
const headerIdx = draftIds.indexOf(String(header.id));
// The (now removed) "Tonight" title: a lexical above the header strip that
// still carries the word. Absent after the first run.
const titleLexical = draftIds.slice(0, headerIdx).reverse().map((id) => byId[id])
  .find((r) => r.data.element?.['element-type'] === 'lexical' && /Tonight/.test(raw(r)));
log(`log card ${logCard.id} · header ${header.id} · title ${titleLexical?.id} · nav ${existingNav?.id ?? '(none)'}`);

/* ── 1–3 + 5b: the log card ───────────────────────────────────────────────── */
{
  const ed = parseED(logCard);
  const cols = ed.columns.filter((c) => c.name !== 'row2_spacer');
  const bump = (pred, patch) => { const c = cols.find(pred); if (c) Object.assign(c, patch); };
  bump((c) => /as played_at$/.test(c.name), { name: PLAYED_AT, cellRowSpan: 2 });
  bump((c) => c.name === 'provenance', { cellRowSpan: 2 });
  bump((c) => c.name === 'id' && c.type === 'row_action', { cellRowSpan: 2 });
  ed.columns = cols;
  delete ed.display.cardsPadding;
  const groups = (ed.filters?.groups || []).filter((g) => !(g.usePageFilters && ['from', 'to'].includes(g.searchParamKey)));
  groups.push(
    { col: 'received_at', op: 'gte', value: ['1970-01-01T00:00:00Z'], usePageFilters: true, searchParamKey: 'from' },
    { col: 'received_at', op: 'lt', value: ['2100-01-01T00:00:00Z'], usePageFilters: true, searchParamKey: 'to' },
  );
  ed.filters = { op: 'AND', groups };
  ed.data = [];
  write(`log card ${logCard.id}: station time, row gutter, row spans, block leaves`,
    ['section', 'update', String(logCard.id), '--data', JSON.stringify(withED(logCard, ed))]);
}

/* ── 2b: the header strip keeps its tracks aligned ────────────────────────── */
{
  const ed = parseED(header);
  delete ed.display.cardsPadding;
  write(`header strip ${header.id}: row gutter`,
    ['section', 'update', String(header.id), '--data', JSON.stringify(withED(header, ed))]);
}

/* ── 4: the navigator ─────────────────────────────────────────────────────── */
const navData = () => {
  // Binding copied from the seed's `showBlockNav()` — kept in step by hand; the
  // seed is the source of truth for a re-seed, this file for the live drafts.
  const pg = (source_id, view_id, name, type, columns, view_name = '1') => ({
    source_id, view_id, isDms: false, env: 'wcdb-dama', srcEnv: 'wcdb-dama', baseUrl: '', type, name, view_name,
    columns: columns.map(([n, t]) => ({ name: n, type: t, display_name: n })),
  });
  const schedule = pg(10, 22, 'WCDB Schedule', 'csv_dataset',
    [['airing_id', 'INTEGER'], ['show_id', 'INTEGER'], ['day', 'INTEGER'], ['start', 'TEXT'], ['end', 'TEXT']], 'Fall 2026');
  const shows = pg(9, 9, 'WCDB Shows', 'csv_dataset',
    [['show_id', 'INTEGER'], ['name', 'TEXT'], ['dj_id', 'INTEGER'], ['department', 'TEXT'], ['icon', 'TEXT'], ['description', 'TEXT'], ['legacy_schedule_ids', 'TEXT'], ['image', 'TEXT']]);
  const djs = pg(8, 8, 'WCDB DJs', 'csv_dataset',
    [['dj_id', 'INTEGER'], ['on_air_name', 'TEXT'], ['first_name', 'TEXT'], ['last_name', 'TEXT'], ['email', 'TEXT'], ['show_email', 'TEXT'], ['phone', 'TEXT'], ['status', 'TEXT'], ['started', 'TEXT'], ['ended', 'TEXT'], ['department', 'TEXT'], ['bio', 'TEXT'], ['when_not_dj', 'TEXT'], ['first_song', 'TEXT'], ['fav_artist', 'TEXT'], ['fav_song', 'TEXT'], ['notes', 'TEXT'], ['updated_at', 'TEXT']]);
  return {
    externalSource: schedule,
    join: {
      operator: '=',
      sources: {
        shows: { source: 9, view: 9, env: 'wcdb-dama', srcEnv: 'wcdb-dama', type: 'left', mergeStrategy: 'join', joinColumns: [{ dsColumn: 'show_id', joinSourceColumn: 'show_id' }], sourceInfo: shows },
        djs: { source: 8, view: 8, env: 'wcdb-dama', srcEnv: 'wcdb-dama', type: 'left', mergeStrategy: 'join', joinColumns: [{ dsColumn: 'shows.dj_id as host_dj_id', joinSourceColumn: 'dj_id' }], sourceInfo: djs },
      },
    },
    columns: [
      { name: 'airing_id', show: true }, { name: 'show_id', show: true }, { name: 'day', show: true },
      { name: 'start', show: true }, { name: 'end', show: true },
      { name: 'shows.name', normalName: 'name', show: true },
      { name: 'shows.department', normalName: 'department', show: true },
      { name: 'djs.on_air_name', normalName: 'on_air_name', show: true },
    ],
    filters: { op: 'AND', groups: [] },
    display: {
      pageSize: 500, usePagination: false, fetchMode: 'smart',
      tz: STATION_TZ, blockMinutes: 120, fromParamKey: 'from', toParamKey: 'to',
      idField: 'airing_id', showIdField: 'show_id', dayField: 'day', startField: 'start', endField: 'end',
      titleField: 'name', djField: 'on_air_name', departmentField: 'department',
      showEyebrow: 'Show', automationEyebrow: 'Automation', automationTitle: 'Automation',
      automationMeta: 'Music on rotation', liveLabel: 'On air', nowLabel: 'Now',
    },
    data: [],
  };
};

let navId = existingNav ? String(existingNav.id) : null;
if (existingNav) {
  const ed = parseED(existingNav);
  write(`navigator ${navId}: refresh binding/display`,
    ['section', 'update', navId, '--data', JSON.stringify(withED(existingNav, { ...ed, ...navData(), data: ed.data || [] }))]);
} else {
  const h = header.data;
  const payload = section({
    pageId, group: h.group, elementType: 'ShowBlockNav', elementData: navData(), size: h.size || '12',
    bg: h.bg, border: { left: true, right: true }, padding: { top: '0', bottom: '0' },
  });
  if (DRY) {
    log('  [dry-run] create ShowBlockNav section after the title lexical');
  } else {
    const row = dmsJson(['section', 'create', pageId, '--pattern', PATTERN, '--data', JSON.stringify(payload), '--format', 'json']);
    navId = String(row.id || row.data?.id);
    log(`  created navigator ${navId}`);
  }
}

/* ── 6 + 8: the card's top row = navigator (left) + action (right) ───────── */
const groups = pageData.draft_section_groups || [];
const groupNamed = (n) => groups.find((g) => g.displayName === n);
const headerGroup = groupNamed('Header'), logGroup = groupNamed('Log'), reviewGroup = groupNamed('Review queue');
const actionCard = rows.find((r) => isCard(r) && raw(r).includes('"header_action"') && raw(r).includes('add_song'));
const headerLexical = rows.find((r) => r.data.element?.['element-type'] === 'lexical' && r.data.group === headerGroup?.name);
const NAV_INSET = '24px 24px 12px 24px';
if (navId && logGroup) {
  // The navigator takes the top-left corner and carries the card's inner gutter
  // itself (`inset`, inline) — a section's `padding` is the page gutter outside.
  const navRow = existingNav || (DRY ? null : dmsJson(['section', 'dump', navId]));
  if (navRow) {
    const ed = parseED(navRow);
    ed.display = { ...ed.display, inset: NAV_INSET };
    write(`navigator ${navId}: top-left corner, half width, inset`,
      ['section', 'update', navId, '--data', JSON.stringify(withED(navRow, ed, {
        size: actionCard ? '6' : '12', height: 'fill', bg: 'white',
        border: { top: true, left: true, ...(actionCard ? {} : { right: true }) },
        radius: { tl: true, ...(actionCard ? {} : { tr: true }) }, padding: { top: '6', bottom: '0' },
      }))]);
  } else {
    log('  [dry-run] navigator (to be created): top-left corner, half width, inset');
  }
}
if (actionCard && logGroup) {
  // The action Card is the top-right half. `plain` so it paints no panel of
  // its own; 41px top puts the button on the navigator's show-name line.
  const aED = parseED(actionCard);
  aED.display = { ...aED.display, cardStyle: 'plain', cardsPadding: '41px 24px 0 0' };
  write(`action card ${actionCard.id}: top-right half of the Log card`,
    ['section', 'update', String(actionCard.id), '--data', JSON.stringify(withED(actionCard, aED, {
      group: logGroup.name, size: '6', height: 'fill', bg: 'white',
      border: { top: true, right: true }, radius: { tr: true }, padding: { top: '6', bottom: '0' },
    }))]);
}
if (headerLexical && headerLexical.data.size !== '12') {
  write(`header lexical ${headerLexical.id}: size 12`,
    ['section', 'update', String(headerLexical.id), '--data', JSON.stringify({ size: '12' })]);
}
// The title row goes: the navigator names the show, "Tonight" read as redundant.
const removedIds = new Set();
if (titleLexical && /Tonight/.test(raw(titleLexical))) {
  write(`title ${titleLexical.id}: removed`,
    ['section', 'delete', String(titleLexical.id), '--page', pageId, '--pattern', PATTERN]);
  removedIds.add(String(titleLexical.id));
}

/* ── 7: the review pills — together, and off the border ───────────────────── */
const pillCard = rows.find((r) => isCard(r) && raw(r).includes('"filter_pill"') && raw(r).includes('needs_review'));
if (pillCard) {
  const ed = parseED(pillCard);
  const cols = ed.columns.filter((c) => c.name !== 'pill_spacer');
  cols.unshift({ name: 'pill_spacer', origin: 'static', staticValue: '', show: true, hideHeader: true });
  ed.columns = cols;
  ed.display = { ...ed.display, cardsPadding: '0 24px', cardStyle: 'plain' };
  write(`pill card ${pillCard.id}: spacer track, 24px inset, no panel`,
    ['section', 'update', String(pillCard.id), '--data', JSON.stringify(withED(pillCard, ed))]);
}

/* ── 9: delete in the Fix modal ───────────────────────────────────────────── */
const fixCard = rows.find((r) => isCard(r) && raw(r).includes('"edit_song"') && raw(r).includes('"liveEdit":true'));
if (fixCard) {
  const ed = parseED(fixCard);
  const providers = (ed.display._functions?.providers || []).filter((p) => p.functionId !== 'delete_publish');
  providers.push({ functionId: 'delete_publish', enabled: true, paramKey: 'song_added' });
  ed.display = { ...ed.display, allowDelete: true, deleteItemLabel: 'Delete track', closeModalOnDelete: 'edit_song',
    _functions: { ...(ed.display._functions || {}), providers } };
  // The row must carry its primary key for delete (and the live-edit save) to target it.
  if (!ed.columns.some((c) => c.name === 'id')) ed.columns.push({ name: 'id', show: true, selectOnly: true });
  ed.data = [];
  write(`fix-track card ${fixCard.id}: allowDelete + delete_publish`,
    ['section', 'update', String(fixCard.id), '--data', JSON.stringify(withED(fixCard, ed))]);
}

/* ── 5a + order: page variables, band order, section order ────────────────── */
{
  const filters = (pageData.filters || []).filter((f) => !['from', 'to'].includes(f.searchKey));
  filters.push(
    { id: 'wcdb-admin-block-from', searchKey: 'from', values: '', useSearchParams: true },
    { id: 'wcdb-admin-block-to', searchKey: 'to', values: '', useSearchParams: true },
  );
  const ref = `${APP}+${COMPONENT_TYPE}`;
  // Sections: [header lexical] [nav, action, header strip, rows, footer] [review …] [modals …]
  let order = draftIds.filter((id) => id !== navId && id !== String(actionCard?.id) && !removedIds.has(id));
  if (navId) order.splice(order.indexOf(String(header.id)), 0, navId);
  if (actionCard) order.splice(order.indexOf(navId ?? String(header.id)) + (navId ? 1 : 0), 0, String(actionCard.id));
  const draft_sections = order.map((id) => ({ id, ref: (pageData.draft_sections || []).find((s) => String(s.id) === id)?.ref || ref }));
  // Bands: Review queue goes right after Log; everything else keeps its relative order.
  let draft_section_groups = groups;
  if (logGroup && reviewGroup) {
    const rest = groups.filter((g) => g !== reviewGroup);
    rest.splice(rest.indexOf(logGroup) + 1, 0, reviewGroup);
    draft_section_groups = rest.map((g, i) => ({ ...g, index: i }));
  }
  write(`page ${pageId}: register from/to, bands [${draft_section_groups.map((g) => g.displayName).join(' › ')}], order [${order.join(',')}]`,
    ['page', 'update', pageId, '--data', JSON.stringify({ filters, draft_sections, draft_section_groups, has_changes: true })]);
}

log(DRY ? '\nDry run — nothing written.' : `\nDone (drafts). Review at /admin/edit/playlist, then a human publishes:\n    dms page publish playlist --pattern ${PATTERN}`);
