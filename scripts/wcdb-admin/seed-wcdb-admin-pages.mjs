#!/usr/bin/env node
/* Seed the five WCDB admin pages into the `station_admin` pattern.
 *
 *   export DMS_AUTH_TOKEN=…
 *   node scripts/wcdb-admin/seed-wcdb-admin-pages.mjs            # append
 *   WIPE=1 node scripts/wcdb-admin/seed-wcdb-admin-pages.mjs     # clean re-seed
 *
 * Source of truth for the design:
 *   src/themes/wcdb/WCDB Design System/dms_design_system/pages/admin/*.html
 * Task: project-planning/wcdb/tasks/current/build-wcdb-admin-pages.md
 *
 * ── DRAFT ONLY ───────────────────────────────────────────────────────────
 * Sections land in `draft_sections`; this never writes `sections` /
 * `section_groups` (the published pair) and never calls `page publish`.
 *
 * ── PHASE 2 · design fidelity ────────────────────────────────────────────
 * Every list is a FUSED CARD — title row, column-header row, hairline rows,
 * footer, sharing one surface (`listCard` below). Phase 1 rendered each row as
 * its own tile inside a 1020px centred column, which is what made the pages
 * read as generic sections rather than as the designed admin.
 */
import {
  dms, dmsJson, PATTERN, COMPONENT_TYPE, SOURCES, REVIEW_THRESHOLD, HOST, APP, TYPE,
  band, section, lexicalSection, lexical, styled, text, head,
  lcontainer, litem, dataSection, fusedTop, fusedMid, fusedEnd, staticRowSection,
} from './lib.mjs';

const WIPE = process.env.WIPE === '1';
const T = REVIEW_THRESHOLD;

// The nine-value vocabulary the migration settled on (`Hip-Hop/R&B` stays one
// value; the strays fold into Specialty).
const DEPARTMENTS = ['Hip-Hop/R&B', 'World', 'Rock', 'Metal', 'Jazz', 'Electronic', 'News', 'Sports', 'Specialty'];

// Status chips: the state the page opens on gets the station's one accent
// colour, everything else stays quiet.
const DJ_PILLS = { current: 'status_good', alumni: 'status_na' };
// The board's six departments, in the order the public page prints them.
const BOARD_DEPARTMENTS = ['Chief Administrators', 'Music Department', 'Publicity Department',
  'News & Sports Department', 'Engineering Department', 'DJ Training Department'];
// The blog's filter bar names these four.
const POST_CATEGORIES = ['Dispatches', 'Interviews', 'Liner notes', 'Studio diary'];
const EVENT_PILLS = { published: 'default', draft: 'status_bad' };

/* djs ⋈ shows, for the Shows page's host column.
 *
 * ONE hop, unlike the public schedule's two: there the DJ hangs off the show
 * which hangs off the airing, so the join key has to be written as a calculated
 * expression (`shows.dj_id as host_dj_id`). Here `shows` IS the base table, so
 * `dj_id` is a plain column on `ds` and the ordinary form works. */
const showHostJoin = {
  operator: '=',
  sources: {
    djs: {
      source: SOURCES.djs.source_id, view: SOURCES.djs.view_id,
      env: 'wcdb-dama', srcEnv: 'wcdb-dama', type: 'left', mergeStrategy: 'join',
      joinColumns: [{ dsColumn: 'dj_id', joinSourceColumn: 'dj_id' }],
      sourceInfo: SOURCES.djs,
    },
  },
};

/* The Show picker for the airing modals.
 *
 * The airing stores `show_id` and nothing else about the show — which is right, but
 * it meant both modals asked an author to type a show's integer id. The seed's own
 * warning ("typing one in again is how Full Court Press ended up in the data six
 * times") is what a free-text foreign key buys you.
 *
 * `mapped_options` is the existing lookup primitive: a `select` column whose option
 * list is fetched from another source, labelled by one set of columns and valued by
 * another. Two WCDB-specific decisions:
 *
 *  - `labelColumns` (plural), and it ends with `show_id`. Names are badly non-unique:
 *    the legacy import left **102 shows literally named "Show Name"** and 10 named
 *    "Alternative Rock Music", so name alone leaves 166 of 651 shows in an ambiguous
 *    option. Adding department only gets that to 157 — the collisions are junk data,
 *    not genuine same-name shows. Appending `show_id` makes every label unique
 *    (measured: 0 duplicate labels), which is the whole point of a picker whose
 *    output is a foreign key.
 *  - `notempty` on `name`, and NOTHING more. 54 of the 705 shows have no name at all
 *    and would render as 54 indistinguishable "N/A" rows, so they drop out. The
 *    placeholder-named ones are deliberately NOT filtered: 2 airings in the live
 *    schedule reference them, and a picker that hides the value its own row holds is
 *    worse than an ugly label. Cleaning those 102 shows is a data job, not a UI one.
 */
const SHOW_PICKER = JSON.stringify({
  sourceId: SOURCES.shows.source_id,
  viewId: SOURCES.shows.view_id,
  isDms: false,
  labelColumns: ['name', 'department', 'show_id'],
  labelSeparator: ' \u00b7 ',
  valueColumn: 'show_id',
  filter: { op: 'AND', groups: [{ col: 'name', op: 'notempty' }] },
});

/* ── page-level building blocks ──────────────────────────────────────────── */

/** The admin page header: breadcrumbs on top, then ONE baseline row of title +
 *  inline metadata — the design never stacks the meta under the title. The
 *  page's primary action is a sibling section so it can be a real Card trigger
 *  (only a Card cell can publish the action param a modal opens on). */
const pageHeader = (crumbs, title, meta) =>
  lexical(
    styled('label', text(crumbs.join('  ›  '))),
    lcontainer(
      'w-full !mt-0 items-baseline grid-cols-[max-content_1fr] gap-x-4',
      litem(styled('titleAdmin', text(title))),
      litem(styled('label', text(meta || ''))),
    ),
  );

/** The header row's action pill — a static Card cell whose click opens a modal. */
const headerAction = ({ source, label, paramKey, padding }) =>
  dataSection({
    source,
    columns: [{
      name: 'header_action', origin: 'static', staticValue: label,
      show: true, hideHeader: true, valueFontStyle: 'btnPrimary', justify: 'right',
    }],
    // A seeded blank row + `cache`: the button's cell is a literal, so there is
    // nothing to fetch. Left on a live mode it queried with no real column and
    // the server answered `column "data" does not exist` — that fallback column
    // exists on a DMS source, not on an external pg one. The row is what the
    // static cell renders into.
    data: [{}],
    display: {
      pageSize: 1, usePagination: false, fetchMode: 'cache',
      cellsGridSize: 1, cellsPadding: 0, cardBorder: false,
      // `plain`: the default card style paints its own rounded `--card-bg`
      // panel, which read as a stray tile behind the button. The SECTION paints
      // the surface (or none, in a page header).
      cardStyle: 'plain',
      // Inner inset, as a CSS padding string — a section's `padding` is the
      // page gutter OUTSIDE its box, so the button's distance from the card
      // border has to come from here. Default 0 for a bare header button.
      cardsPadding: padding ?? 0,
      _functions: { providers: [{ functionId: 'click_publish', enabled: true, paramKey, args: { column: 'header_action' } }] },
    },
  });

/** A segment of the "default is the design" control. The COUNT is the cell
 *  value; the label and the page variable it writes are column config. */
const pill = ({ expr, alias, label, paramKey, paramValue, activeWhenUnset }) => ({
  name: `${expr} as ${alias}`,
  normalName: alias,
  origin: 'calculated-column',
  type: 'filter_pill',
  show: true,
  hideHeader: true,
  pillLabel: label,
  paramKey,
  paramValue,
  ...(activeWhenUnset ? { activeWhenUnset: true } : {}),
});

/**
 * A list card — title row → column headers → hairline rows → footer, fused into
 * one surface. Returns the section descriptors for a band.
 */
const listCard = ({ title, titleMeta, link, tracks, headers, source, columns, filters, display = {}, join, footer, nav, rowGutter, action }) => [
  // The title row. With `action` the row is two sections — the title (8) and a
  // Card holding the page's primary button (4) — fused into the card's top
  // edge: the lexical keeps the top-left corner, the Card takes the top-right.
  // With `title: null` there is no title row at all: the NAVIGATOR is the top
  // row (left half) and the action Card the right half (the playlist, where a
  // "Tonight" title read as redundant beside the show the navigator names).
  ...(title === null ? [] : [{
    kind: 'lexical', ...fusedTop, padding: { top: '6', bottom: '0' },
    ...(action ? { size: '8', border: { top: true, left: true }, radius: { tl: true } } : {}),
    data: lexical(
      lcontainer(
        `w-full !mt-0 items-baseline ${action || !link ? 'grid-cols-[max-content_1fr]' : 'grid-cols-[max-content_1fr_max-content]'} gap-x-4`,
        litem(head('h4', title)),
        litem(styled('label', text(titleMeta || ''))),
        ...(action || !link ? [] : [litem(styled('metaLink', text(link)))]),
      ),
    ),
  }]),
  // An optional navigator strip — the playlist's ShowBlockNav (see
  // `showBlockNav` below). Under a title it is a full-width mid section; as
  // the top row it takes the top-left corner and its own inner gutter (`inset`).
  ...(nav ? [title === null
    ? {
        kind: nav.kind, size: action ? '6' : '12', height: 'fill',
        bg: 'white', border: { top: true, left: true, ...(action ? {} : { right: true }) },
        radius: { tl: true, ...(action ? {} : { tr: true }) }, padding: { top: '6', bottom: '0' },
        data: { ...nav.data, display: { ...nav.data.display, inset: '24px 24px 12px 24px' } },
      }
    : { kind: nav.kind, ...fusedMid, data: nav.data }] : []),
  ...(action ? [{
    kind: 'Card', size: title === null ? '6' : '4', height: 'fill',
    bg: 'white', border: { top: true, right: true }, radius: { tr: true }, padding: { top: '6', bottom: '0' },
    // Under a title: 24px top puts the button on the title's line. Beside the
    // navigator: 41px puts it on the navigator's show-name line. 24px right
    // mirrors the left inset.
    data: headerAction({ ...action, padding: title === null ? '41px 24px 0 0' : '24px 24px 0 0' }),
  }] : []),
  // Column headers on the SAME track template, so each label sits over the
  // column it names.
  { kind: 'Card', ...fusedMid, data: staticRowSection({ source, tracks, cells: headers, valueFontStyle: 'colHead', keyColumn: source.columns[0].name, rowGutter }) },
  {
    kind: 'Card', ...fusedMid,
    data: dataSection({
      source, columns, filters, join,
      display: {
        cellsTracksTemplate: tracks,
        cellsGridSize: headers.length,
        cellsGridGap: 12, cellsRowGap: 0, cellsPadding: 0, cellsVAlign: 'center',
        cardsGridGap: 0, cardBorder: false,
        // `cardsPadding: 0` is emitted as INLINE `padding: 0` on the very element
        // the theme's `adminRow` puts its `px-6 py-2` gutter on — so with it the
        // rows are flush against the card and only `min-h` gives them height.
        // `rowGutter: true` leaves the key out and lets the theme's gutter render
        // (the header strip drops it too, so the tracks stay aligned).
        ...(rowGutter ? {} : { cardsPadding: 0 }),
        // The style that turns record-cards into hairline rows.
        cardStyle: 'adminRow',
        ...display,
      },
    }),
  },
  {
    kind: 'lexical', ...fusedEnd, padding: { top: '0', bottom: '4' },
    data: lexical(styled('label', text(footer || ''))),
  },
];

/* ── The playlist's block navigator ──────────────────────────────────────
 * `ShowBlockNav` (src/themes/wcdb/ShowBlockNav.*) is bound to the schedule
 * joined to shows and DJs, works out the block the page is on — the show
 * airing at the page's `from` instant, or a 2-hour automation slice when
 * nothing is scheduled — and publishes its edges as the `from`/`to` page
 * variables. The log card filters `received_at` on them (see `BLOCK_LEAVES`).
 *
 * VIEW. The public site is served from schedule VIEW 22 ("Fall 2026"), not the
 * seed's `SOURCES.schedule` view 10 — the ScheduleGrid's publish repoints every
 * schedule-bound section of the `wcdb_main` pattern to the version it
 * publishes, but not sections in THIS pattern. Until that publish learns to
 * cover `station_admin`, a schedule publish means bumping this by hand. */
const PUBLIC_SCHEDULE_VIEW = { view_id: 22, view_name: 'Fall 2026' };

const SCHEDULE_NAV_JOIN = {
  operator: '=',
  sources: {
    shows: {
      source: SOURCES.shows.source_id, view: SOURCES.shows.view_id,
      env: 'wcdb-dama', srcEnv: 'wcdb-dama', type: 'left', mergeStrategy: 'join',
      joinColumns: [{ dsColumn: 'show_id', joinSourceColumn: 'show_id' }],
      sourceInfo: SOURCES.shows,
    },
    // Two hops: the DJ hangs off the show, so the key is written as an
    // expression on the joined table (same form as the public on-air card).
    djs: {
      source: SOURCES.djs.source_id, view: SOURCES.djs.view_id,
      env: 'wcdb-dama', srcEnv: 'wcdb-dama', type: 'left', mergeStrategy: 'join',
      joinColumns: [{ dsColumn: 'shows.dj_id as host_dj_id', joinSourceColumn: 'dj_id' }],
      sourceInfo: SOURCES.djs,
    },
  },
};

const showBlockNav = () => ({
  kind: 'ShowBlockNav',
  data: dataSection({
    source: { ...SOURCES.schedule, ...PUBLIC_SCHEDULE_VIEW },
    join: SCHEDULE_NAV_JOIN,
    columns: [
      { name: 'airing_id', show: true },
      { name: 'show_id', show: true },
      { name: 'day', show: true },
      { name: 'start', show: true },
      { name: 'end', show: true },
      { name: 'shows.name', normalName: 'name', show: true },
      { name: 'shows.department', normalName: 'department', show: true },
      { name: 'djs.on_air_name', normalName: 'on_air_name', show: true },
    ],
    display: {
      // The whole week in one fetch.
      pageSize: 500, usePagination: false, fetchMode: 'smart',
      tz: STATION_TZ, blockMinutes: 120,
      fromParamKey: 'from', toParamKey: 'to',
      idField: 'airing_id', showIdField: 'show_id', dayField: 'day', startField: 'start', endField: 'end',
      titleField: 'name', djField: 'on_air_name', departmentField: 'department',
      showEyebrow: 'Show', automationEyebrow: 'Automation', automationTitle: 'Automation',
      automationMeta: 'Music on rotation', liveLabel: 'On air', nowLabel: 'Now',
    },
  }),
});

/** The two leaves that confine a `received_at` list to the navigator's block.
 *  Defaults are a no-op range so the list is whole until the navigator writes. */
const BLOCK_LEAVES = [
  { col: 'received_at', op: 'gte', value: ['1970-01-01T00:00:00Z'], usePageFilters: true, searchParamKey: 'from' },
  { col: 'received_at', op: 'lt', value: ['2100-01-01T00:00:00Z'], usePageFilters: true, searchParamKey: 'to' },
];
const BLOCK_PAGE_FILTERS = [
  { id: 'wcdb-admin-block-from', searchKey: 'from', values: '', useSearchParams: true },
  { id: 'wcdb-admin-block-to', searchKey: 'to', values: '', useSearchParams: true },
];

/* ── SQL fragments ───────────────────────────────────────────────────────── */

// "Needs review" is a rule over two fields, so it lives in one calculated
// column that the queue control filters on.
const REVIEW_STATE = `case when kind = 'no-match' or (score is not null and score < ${T}) then 'needs' else 'ok' end`;
// 24-hour, from the timestamp — `formatFn: 'time'` renders 12-hour, which the
// design does not use. STATION time: `to_char` on a timestamptz renders in the
// server session zone (UTC on the hosted server), which put the log 4 hours
// ahead of the studio clock until 2026-09-12. Same zone the ingest's show
// resolver uses (data-types/now_playing/showResolver.js).
const STATION_TZ = 'America/New_York';
const PLAYED_AT = `to_char(received_at AT TIME ZONE '${STATION_TZ}', 'HH24:MI') as played_at`;
// The row's second line in one cell: ARTIST · ALBUM · YEAR.
const TRACK_META = `nullif(concat_ws(' · ', artist_name, album, left(release_date, 4)), '') as track_meta`;
const REAL_NAME = `nullif(trim(concat_ws(' ', first_name, last_name)), '') as real_name`;

const LOG_TRACKS = '58px 44px minmax(0,1fr) 120px 96px';
const DJ_TRACKS = 'minmax(0,1.2fr) minmax(0,1fr) 140px minmax(0,1.1fr) 100px 88px';
const EVENT_TRACKS = '64px minmax(0,1fr) 200px 90px 110px 88px';

/* ── the page inventory ──────────────────────────────────────────────────── */

const pages = [
  /* ═══ 1 · playlist — the landing page ═══════════════════════════════════ */
  {
    slug: 'playlist',
    title: 'Playlist',
    icon: 'Note',
    index: 0,
    filters: [{ id: 'wcdb-admin-queue', searchKey: 'queue', values: '', useSearchParams: true }, ...BLOCK_PAGE_FILTERS],
    bands: [
      {
        // The page header is the title alone: the primary action moved into the
        // log card's title row (2026-09-12), where the design's `Public spin
        // log →` link used to be.
        displayName: 'Header',
        sections: [
          { kind: 'lexical', size: '12', data: pageHeader(['Admin', 'Playlist'], 'Playlist.', 'Logging live · matched every 30s') },
        ],
      },
      {
        displayName: 'Log',
        sections: listCard({
          // No title row: the navigator names the show, so "Tonight" was redundant.
          title: null,
          // `+ Add a song` is the top-right half of the card, beside the navigator.
          action: { source: SOURCES.playlist, label: '+  Add a song', paramKey: 'add_song' },
          // The show / automation-block navigator sits between the title and the
          // column headers and publishes `from`/`to`; the rows below filter on them.
          nav: showBlockNav(),
          rowGutter: true,
          tracks: LOG_TRACKS,
          headers: ['Time', '', 'Track', 'Source', ''],
          source: SOURCES.playlist,
          columns: [
            // Time, art, source and the action all span the row's two lines so
            // they centre against the title + meta stack (`cellsVAlign: 'center'`).
            { name: PLAYED_AT, normalName: 'played_at', origin: 'calculated-column', show: true, hideHeader: true, valueFontStyle: 'rowMono', cellRowSpan: 2 },
            { name: 'album_cover', show: true, hideHeader: true, type: 'image', imageSize: 'imgFill', cellRowSpan: 2 },
            { name: 'title', show: true, hideHeader: true, valueFontStyle: 'rowTitle' },
            { name: 'provenance', show: true, hideHeader: true, type: 'provenance_badge', threshold: T, cellRowSpan: 2 },
            // Bound to the row id so a click publishes an id the edit modal can
            // filter on, while rendering the design's word, not the number.
            { name: 'id', show: true, hideHeader: true, type: 'row_action', actionLabel: 'Edit', actionIcon: 'EditPage', cellRowSpan: 2 },
            // Row 2: the only free track is the title's, so the meta lands under
            // the title with no spacer needed.
            { name: TRACK_META, normalName: 'track_meta', origin: 'calculated-column', show: true, hideHeader: true, valueFontStyle: 'rowMeta' },
            { name: 'kind', show: true, selectOnly: true },
            { name: 'score', show: true, selectOnly: true },
            { name: 'received_at', show: true, selectOnly: true, sort: 'desc' },
            // The calc column belongs in `columns`; the filter references it by
            // ALIAS. A leaf whose `col` carries `as <alias>` goes into the WHERE
            // clause verbatim and errors with `syntax error at or near "as"`.
            { name: `${REVIEW_STATE} as review_state`, normalName: 'review_state', origin: 'calculated-column', show: true, selectOnly: true },
          ],
          filters: [
            // An empty page value drops the leaf → no constraint, which is what
            // the `All` segment wants (it writes '').
            { col: 'review_state', op: 'filter', value: [], usePageFilters: true, searchParamKey: 'queue' },
            // The navigator's block. ANDed with the queue, so "needs review"
            // inside this show's hour is one URL.
            ...BLOCK_LEAVES,
          ],
          display: {
            pageSize: 40, usePagination: true, fetchMode: 'force',
            _functions: {
              providers: [{ functionId: 'click_publish', enabled: true, paramKey: 'edit_song', args: { column: 'id' } }],
              subscribers: [{ functionId: 'data_refresh', enabled: true, paramKey: 'song_added' }],
            },
          },
          footer: 'A gap and a low-confidence match are drawn in place, not filtered away',
        }),
      },
      {
        // The review bar, BELOW the log since 2026-09-12: the premise at the
        // left, the segmented control right.
        displayName: 'Review queue',
        sections: [
          {
            kind: 'lexical', size: '7', height: 'fill',
            bg: 'white', border: { top: true, left: true, bottom: true }, radius: { tl: true, bl: true },
            padding: { top: '4', bottom: '4' },
            data: lexical(
              styled('caption', text('Detected automatically')),
              styled('bodySmall', text('The stream is matched every 30s — you only fix what it got wrong')),
            ),
          },
          {
            kind: 'Card', size: '5', height: 'fill',
            bg: 'white', border: { top: true, right: true, bottom: true }, radius: { tr: true, br: true },
            padding: { top: '4', bottom: '4' },
            data: dataSection({
              source: SOURCES.playlist,
              columns: [
                // A static spacer takes the `1fr` track so BOTH pills sit together
                // at the right — without it the first pill lands in the wide
                // track and the two drift apart.
                { name: 'pill_spacer', origin: 'static', staticValue: '', show: true, hideHeader: true },
                pill({
                  expr: `count(*) FILTER (WHERE kind = 'no-match' OR (score IS NOT NULL AND score < ${T}))`,
                  alias: 'needs_review', label: 'Needs review', paramKey: 'queue', paramValue: 'needs',
                }),
                pill({ expr: 'count(*)', alias: 'all_rows', label: 'All', paramKey: 'queue', paramValue: '', activeWhenUnset: true }),
              ],
              // An aggregate-only card returns ONE row; the length query still
              // reports the raw count, so pageSize 1 or you get zero-clones.
              display: {
                pageSize: 1, fetchMode: 'force',
                cellsGridSize: 3, cellsTracksTemplate: '1fr max-content max-content',
                cellsGridGap: 8, cellsPadding: 0, cardBorder: false, cellsVAlign: 'center',
                // The pills' distance from the card border (a section's own
                // `padding` is the OUTER page gutter). `plain`: no stray panel.
                cardsPadding: '0 24px', cardStyle: 'plain',
              },
            }),
          },
        ],
      },
      {
        displayName: 'Add a song',
        modal: { paramKey: 'add_song', size: 'xl' },
        sections: [
          { kind: 'lexical', data: lexical(head('h4', 'Add a song.'), styled('label', text('Saved as “By DJ” — never overwritten by the matcher'))) },
          {
            kind: 'Card',
            data: dataSection({
              source: SOURCES.playlist,
              columns: [
                { name: 'title', show: true, type: 'text', customName: 'Title', placeholder: 'Track title', headerFontStyle: 'label' },
                { name: 'artist_name', show: true, type: 'text', customName: 'Artist', placeholder: 'Artist', headerFontStyle: 'label' },
                { name: 'album', show: true, type: 'text', customName: 'Album', placeholder: 'Album', headerFontStyle: 'label' },
                { name: 'release_date', show: true, type: 'text', customName: 'Year', placeholder: '1974', headerFontStyle: 'label' },
                { name: 'provenance', selectOnly: true, defaultValue: 'dj' },
                { name: 'kind', selectOnly: true, defaultValue: 'matched' },
                { name: 'edited_by', selectOnly: true, defaultFn: 'user' },
                { name: 'edited_at', selectOnly: true, defaultFn: 'now' },
                { name: 'timestamp_utc', selectOnly: true, defaultFn: 'now' },
              ],
              filters: [{ col: 'id', op: 'filter', value: ['-1'] }],
              display: {
                pageSize: 1, usePagination: false, allowAdddNew: true, cardBorder: false,
                cellsGridSize: 2, cellsGridGap: 16, headerValueLayout: 'col',
                addItemLabel: 'Add to playlist', closeModalOnAdd: 'add_song',
                _functions: { providers: [{ functionId: 'add_publish', enabled: true, paramKey: 'song_added' }] },
              },
            }),
          },
        ],
      },
      {
        displayName: 'Fix this track',
        modal: { paramKey: 'edit_song', size: 'xl' },
        sections: [
          { kind: 'lexical', data: lexical(head('h4', 'Fix this track.'), styled('label', text('Saving marks the row Corrected and keeps the original detection underneath'))) },
          {
            kind: 'Card',
            data: dataSection({
              source: SOURCES.playlist,
              columns: [
                { name: 'title', show: true, type: 'text', customName: 'Title', headerFontStyle: 'label', allowEditInView: true },
                { name: 'artist_name', show: true, type: 'text', customName: 'Artist', headerFontStyle: 'label', allowEditInView: true },
                { name: 'album', show: true, type: 'text', customName: 'Album', headerFontStyle: 'label', allowEditInView: true },
                { name: 'release_date', show: true, type: 'text', customName: 'Year', headerFontStyle: 'label', allowEditInView: true },
                { name: 'score', show: true, customName: 'Matched at', formatFn: 'percent', editable: false, headerFontStyle: 'label' },
                { name: 'original_title', show: true, customName: 'Detected as', editable: false, headerFontStyle: 'label' },
              ],
              filters: [{ col: 'id', op: 'filter', value: [], usePageFilters: true, searchParamKey: 'edit_song' }],
              display: {
                pageSize: 1, usePagination: false, cardBorder: false, allowEditInView: true, liveEdit: true, fetchMode: 'force',
                cellsGridSize: 2, cellsGridGap: 16, headerValueLayout: 'col',
                // A DJ can remove a track outright (a wrong match, a test row). Two-step
                // button; a confirmed delete closes this modal and refreshes the log
                // through the same `song_added` param the Add form publishes on.
                allowDelete: true, deleteItemLabel: 'Delete track', closeModalOnDelete: 'edit_song',
                _functions: { providers: [{ functionId: 'delete_publish', enabled: true, paramKey: 'song_added' }] },
              },
            }),
          },
        ],
      },
    ],
  },

  /* ═══ 2 · schedule ══════════════════════════════════════════════════════ */
  {
    slug: 'schedule',
    title: 'Schedule',
    icon: 'Calendar',
    index: 1,
    filters: [],
    bands: [
      {
        displayName: 'Header',
        sections: [
          { kind: 'lexical', size: '12', data: pageHeader(['Admin', 'Schedule'], 'Schedule.', 'Point and click — a block opens edit, an empty hour opens add') },
        ],
      },
      {
        displayName: 'The week',
        sections: [
          {
            kind: 'ScheduleGrid',
            data: dataSection({
              source: SOURCES.schedule,
              columns: [
                { name: 'airing_id', show: true },
                { name: 'show_id', show: true },
                { name: 'day', show: true },
                // `start` and especially `end` are Postgres keywords: emitted
                // bare, `end` is a syntax error and the whole row comes back as
                // an error object.
                { name: '"start" as start_at', normalName: 'start_at', origin: 'calculated-column', show: true },
                { name: '"end" as end_at', normalName: 'end_at', origin: 'calculated-column', show: true },
                { name: 'shows.name', show: true, normalName: 'name' },
                { name: 'shows.icon', show: true, normalName: 'icon' },
                { name: 'shows.dj_id', show: true, normalName: 'dj_id' },
                { name: 'shows.department', show: true, normalName: 'department' },
              ],
              display: {
                pageSize: 500, usePagination: false, fetchMode: 'smart',
                gridTitle: 'The week', weekStartsOn: 'Mon',
                startField: 'start_at', endField: 'end_at',
                addParamKey: 'add_airing', editParamKey: 'edit_airing',
                // THE LIVE POINTER, now that there is something to point at.
                // Phase 1 of this task documented the answer and could not use
                // it: publishing a version has to rewrite the PUBLIC section's
                // `view_id`, and the public schedule still bound the legacy
                // `Shows` source. The public build repointed it to source 10,
                // so section 1964968 (the week, on wcdb_main) is the section a
                // publish would repoint — and it IS the pointer, rather than a
                // settings row that can drift from it.
                // A publish rewrites every section bound to source 10 on EVERY page of
                // this pattern — the schedule page, the home rail, the show page,
                // station info, events, the playlist: 26 sections across 8 pages — in
                // both the published and draft section lists. The pages are discovered,
                // so nothing here needs updating when a ninth appears.
                liveTargetPattern: 'wcdb_main',
                // The playlist stream (source 7) tags each detection with the show that
                // was on air, resolved from a schedule version recorded in its own
                // metadata — so publishing has to move that pointer too, or new tracks
                // keep being attributed to the previous semester's shows.
                taggingSourceIds: String(SOURCES.playlist.source_id),
                openOnPublishedVersion: true,
              },
              // A version is a VIEW on the airings; the shows stay shared, which
              // is why they are joined rather than copied.
              join: {
                operator: '=',
                sources: {
                  shows: {
                    source: SOURCES.shows.source_id, view: SOURCES.shows.view_id,
                    env: 'wcdb-dama', srcEnv: 'wcdb-dama', type: 'left', mergeStrategy: 'join',
                    joinColumns: [{ dsColumn: 'show_id', joinSourceColumn: 'show_id' }],
                    sourceInfo: SOURCES.shows,
                  },
                },
              },
            }),
          },
        ],
      },
      {
        displayName: 'Add a show to this slot',
        modal: { paramKey: 'add_airing', size: '2xl' },
        sections: [
          { kind: 'lexical', data: lexical(head('h4', 'Put a show in this hour.'), styled('label', text('Pick a show that already exists — typing one in again is how Full Court Press ended up in the data six times'))) },
          {
            kind: 'Card',
            data: dataSection({
              source: SOURCES.schedule,
              columns: [
                { name: 'show_id', show: true, type: 'select', customName: 'Show', headerFontStyle: 'label', mapped_options: SHOW_PICKER },
                { name: 'day', show: true, type: 'text', customName: 'Day', headerFontStyle: 'label', usePageParams: true, pageParamKey: 'add_airing' },
                { name: '"start" as start_at', normalName: 'start_at', origin: 'calculated-column', show: true, type: 'text', customName: 'Starts', headerFontStyle: 'label' },
                { name: '"end" as end_at', normalName: 'end_at', origin: 'calculated-column', show: true, type: 'text', customName: 'Ends', headerFontStyle: 'label' },
              ],
              filters: [{ col: 'airing_id', op: 'filter', value: ['-1'] }],
              display: {
                pageSize: 1, usePagination: false, allowAdddNew: true, cardBorder: false,
                cellsGridSize: 2, cellsGridGap: 16, headerValueLayout: 'col',
                addItemLabel: 'Add to the schedule', closeModalOnAdd: 'add_airing',
              },
            }),
          },
        ],
      },
      {
        displayName: 'Edit this airing',
        modal: { paramKey: 'edit_airing', size: '2xl' },
        sections: [
          { kind: 'lexical', data: lexical(head('h4', 'This airing.'), styled('label', text('Day and time belong to the airing. The show’s name, DJ and description are shared by every airing of it, in every version.'))) },
          {
            kind: 'Card',
            data: dataSection({
              source: SOURCES.schedule,
              columns: [
                { name: 'day', show: true, type: 'text', customName: 'Day', headerFontStyle: 'label', allowEditInView: true },
                { name: '"start" as start_at', normalName: 'start_at', origin: 'calculated-column', show: true, customName: 'Starts', headerFontStyle: 'label' },
                { name: '"end" as end_at', normalName: 'end_at', origin: 'calculated-column', show: true, customName: 'Ends', headerFontStyle: 'label' },
                { name: 'show_id', show: true, type: 'select', customName: 'Show', headerFontStyle: 'label', allowEditInView: true, mapped_options: SHOW_PICKER },
              ],
              filters: [{ col: 'airing_id', op: 'filter', value: [], usePageFilters: true, searchParamKey: 'edit_airing' }],
              display: {
                pageSize: 1, usePagination: false, cardBorder: false, allowEditInView: true, liveEdit: true, fetchMode: 'force',
                cellsGridSize: 2, cellsGridGap: 16, headerValueLayout: 'col',
              },
            }),
          },
        ],
      },
    ],
  },

  /* ═══ 3 · djs ═══════════════════════════════════════════════════════════ */
  {
    slug: 'djs',
    title: 'DJs',
    icon: 'User',
    index: 2,
    filters: [
      { id: 'wcdb-admin-dj-status', searchKey: 'status', values: 'current', useSearchParams: true },
      { id: 'wcdb-admin-dj-search', searchKey: 'search', values: '', useSearchParams: true },
      { id: 'wcdb-admin-dj-dept', searchKey: 'department', values: '', useSearchParams: true },
    ],
    bands: [
      {
        displayName: 'Header',
        sections: [
          { kind: 'lexical', size: '9', data: pageHeader(['Admin', 'DJs'], 'DJs.', '891 on the roster') },
          { kind: 'Card', size: '3', data: headerAction({ source: SOURCES.djs, label: '+  Add DJ', paramKey: 'add_dj' }) },
        ],
      },
      {
        // ONE control bar, as the design draws it: search at the left, the
        // status segments and the department picker at the right.
        displayName: 'Controls',
        sections: [
          {
            kind: 'Filter', size: '6', height: 'fill',
            bg: 'white', border: { top: true, left: true, bottom: true }, radius: { tl: true, bl: true },
            padding: { top: '4', bottom: '4' },
            data: dataSection({
              source: SOURCES.djs,
              columns: [
                { name: 'on_air_name', customName: 'Search', show: true,
                  filters: [{ type: 'external', operation: 'like', values: [], usePageFilters: true, searchParamKey: 'search' }] },
              ],
              display: { pageSize: 1, filterStyle: 'chip', placement: 'inline', showAttribution: false },
            }),
          },
          {
            kind: 'Card', size: '4', height: 'fill',
            bg: 'white', border: { top: true, bottom: true }, padding: { top: '4', bottom: '4' },
            data: dataSection({
              source: SOURCES.djs,
              columns: [
                pill({ expr: "count(*) FILTER (WHERE status = 'current')", alias: 'current_count', label: 'Current', paramKey: 'status', paramValue: 'current', activeWhenUnset: true }),
                pill({ expr: "count(*) FILTER (WHERE status = 'alumni')", alias: 'alumni_count', label: 'Alumni', paramKey: 'status', paramValue: 'alumni' }),
                pill({ expr: 'count(*)', alias: 'all_count', label: 'All', paramKey: 'status', paramValue: '' }),
              ],
              display: {
                pageSize: 1, fetchMode: 'smart',
                cellsGridSize: 3, cellsTracksTemplate: 'max-content max-content max-content',
                cellsGridGap: 6, cellsPadding: 0, cardsPadding: 0, cardBorder: false, cellsVAlign: 'center',
              },
            }),
          },
          {
            // The department picker the design has and Phase 1 omitted.
            kind: 'Filter', size: '2', height: 'fill',
            bg: 'white', border: { top: true, right: true, bottom: true }, radius: { tr: true, br: true },
            padding: { top: '4', bottom: '4' },
            data: dataSection({
              source: SOURCES.djs,
              columns: [
                { name: 'department', customName: 'Department', show: true,
                  filters: [{ type: 'external', operation: 'filter', values: [], usePageFilters: true, searchParamKey: 'department' }] },
              ],
              display: { pageSize: 1, filterStyle: 'chip', placement: 'inline', showAttribution: false },
            }),
          },
        ],
      },
      {
        displayName: 'Roster',
        sections: listCard({
          title: 'The roster',
          titleMeta: '',
          link: '',
          tracks: DJ_TRACKS,
          headers: ['On-air name', 'Name', 'Department', 'Email', 'Started', { label: 'Status', justify: 'right' }],
          source: SOURCES.djs,
          columns: [
            { name: 'on_air_name', show: true, hideHeader: true, valueFontStyle: 'rowTitle', isLink: true, location: '/admin/dj_profile', searchParams: 'dj_id' },
            { name: REAL_NAME, normalName: 'real_name', origin: 'calculated-column', show: true, hideHeader: true, valueFontStyle: 'textSMReg' },
            { name: 'department', show: true, hideHeader: true, valueFontStyle: 'rowMeta' },
            // The design prints a known-absent value rather than leaving a gap.
            { name: "coalesce(nullif(email, ''), '— none on file —') as email_display", normalName: 'email_display', origin: 'calculated-column', show: true, hideHeader: true, valueFontStyle: 'rowMeta' },
            { name: "coalesce(nullif(started, ''), '–') as started_display", normalName: 'started_display', origin: 'calculated-column', show: true, hideHeader: true, valueFontStyle: 'rowMono' },
            { name: 'status', show: true, hideHeader: true, type: 'status_pill', pillColors: DJ_PILLS, justify: 'right' },
            { name: 'dj_id', show: true, selectOnly: true },
          ],
          filters: [
            { col: 'status', op: 'filter', value: [], usePageFilters: true, searchParamKey: 'status' },
            { col: 'department', op: 'filter', value: [], usePageFilters: true, searchParamKey: 'department' },
            // One box, many columns: an OR group of `like` leaves on the same
            // page variable. An empty box leaves every leaf empty, and an empty
            // leaf drops out — so empty = no constraint.
            {
              op: 'OR',
              groups: ['on_air_name', 'first_name', 'last_name', 'email'].map((col) => ({
                col, op: 'like', value: [], usePageFilters: true, searchParamKey: 'search',
              })),
            },
          ],
          display: { pageSize: 25, usePagination: true, fetchMode: 'smart' },
          footer: 'Click a name to open the profile',
        }),
      },
      {
        displayName: 'Add a DJ',
        modal: { paramKey: 'add_dj', size: 'xl' },
        sections: [
          { kind: 'lexical', data: lexical(head('h4', 'Add a DJ.'), styled('label', text('Six fields — a strict subset of the profile editor. The rest can be filled in later.'))) },
          {
            kind: 'Card',
            data: dataSection({
              source: SOURCES.djs,
              columns: [
                { name: 'on_air_name', show: true, type: 'text', customName: 'On-air name', headerFontStyle: 'label' },
                { name: 'first_name', show: true, type: 'text', customName: 'First name', headerFontStyle: 'label' },
                { name: 'last_name', show: true, type: 'text', customName: 'Last name', headerFontStyle: 'label' },
                { name: 'email', show: true, type: 'text', customName: 'Email', headerFontStyle: 'label' },
                { name: 'department', show: true, type: 'select', customName: 'Department', headerFontStyle: 'label',
                  options: DEPARTMENTS.map((v) => ({ label: v, value: v })) },
                { name: 'started', show: true, type: 'text', customName: 'Started', placeholder: 'YYYY-MM-DD', headerFontStyle: 'label' },
                // Status is an explicit fact, not derived from a date: 535 of
                // the 807 alumni have no end date, and 2 current DJs do.
                { name: 'status', selectOnly: true, defaultValue: 'current' },
                { name: 'dj_id', selectOnly: true, autoNumber: true },
                { name: 'updated_at', selectOnly: true, defaultFn: 'now' },
              ],
              filters: [{ col: 'dj_id', op: 'filter', value: ['-1'] }],
              display: {
                pageSize: 1, usePagination: false, allowAdddNew: true, cardBorder: false,
                cellsGridSize: 2, cellsGridGap: 16, headerValueLayout: 'col',
                addItemLabel: 'Add DJ', closeModalOnAdd: 'add_dj',
                _functions: { providers: [{ functionId: 'add_publish', enabled: true, paramKey: 'dj_added' }] },
              },
            }),
          },
        ],
      },
    ],
  },

  /* ═══ 4 · dj profile ════════════════════════════════════════════════════ */
  {
    slug: 'dj_profile',
    title: 'DJ Profile',
    icon: 'Microphone',
    index: 3,
    hideInNav: true,
    filters: [{ id: 'wcdb-admin-dj-id', searchKey: 'dj_id', values: '', useSearchParams: true }],
    bands: [
      {
        // The header names the DJ, not the page — it reads the record.
        displayName: 'Header',
        sections: [
          { kind: 'lexical', size: '12', data: lexical(styled('label', text('Admin  ›  DJs  ›  Profile'))) },
          {
            kind: 'Card', size: '12',
            data: dataSection({
              source: SOURCES.djs,
              columns: [
                { name: 'on_air_name', show: true, hideHeader: true, valueFontStyle: 'titleAdmin' },
                { name: REAL_NAME, normalName: 'real_name', origin: 'calculated-column', show: true, hideHeader: true, valueFontStyle: 'label' },
                { name: 'status', show: true, hideHeader: true, type: 'status_pill', pillColors: DJ_PILLS },
                { name: "concat('DJ_ID ', dj_id) as dj_id_label", normalName: 'dj_id_label', origin: 'calculated-column', show: true, hideHeader: true, valueFontStyle: 'label' },
                { name: "concat('EDITED ', left(coalesce(updated_at, ''), 10)) as edited_label", normalName: 'edited_label', origin: 'calculated-column', show: true, hideHeader: true, valueFontStyle: 'label' },
              ],
              filters: [{ col: 'dj_id', op: 'filter', value: [], usePageFilters: true, searchParamKey: 'dj_id' }],
              display: {
                pageSize: 1, usePagination: false, fetchMode: 'smart',
                cellsGridSize: 5, cellsTracksTemplate: 'max-content max-content max-content max-content 1fr',
                cellsGridGap: 12, cellsPadding: 0, cardsPadding: 0, cardBorder: false, cellsVAlign: 'baseline',
              },
            }),
          },
        ],
      },
      // Four grouped field cards, as the design has them — each its own card
      // with a display-italic title, rather than one flat list of 16 fields.
      ...[
        {
          title: 'Identity', note: 'Who this is, and how the site addresses them.',
          fields: [
            ['on_air_name', 'On-air name', 'text'],
            ['first_name', 'First name', 'text'],
            ['last_name', 'Last name', 'text'],
            ['email', 'Email', 'text'],
            ['phone', 'Phone', 'text'],
            ['show_email', 'Show email on the public profile', 'text'],
          ],
        },
        {
          title: 'Status & term',
          note: 'Status is an explicit choice, not derived from the end date: 535 of the 807 alumni have no end date at all, so a blank end date cannot mean “still on air”.',
          fields: [
            ['status', 'Status', 'select', [{ label: 'current', value: 'current' }, { label: 'alumni', value: 'alumni' }]],
            ['started', 'Started', 'text'],
            ['ended', 'Ended', 'text'],
          ],
        },
        {
          title: 'On air', note: 'The department drives the glyph the schedule and the public site show.',
          fields: [
            ['department', 'Department', 'select', DEPARTMENTS.map((v) => ({ label: v, value: v }))],
            ['bio', 'Bio', 'textarea'],
            ['when_not_dj', 'When not DJing', 'textarea'],
          ],
        },
        {
          title: 'Personality', note: 'What the public profile prints under the name.',
          fields: [
            ['first_song', 'First song', 'text'],
            ['fav_artist', 'Favourite artist', 'text'],
            ['fav_song', 'Favourite song', 'text'],
            ['notes', 'Notes (admin only)', 'textarea'],
          ],
        },
      ].map((g) => ({
        displayName: g.title,
        sections: [
          {
            kind: 'lexical', ...fusedTop, padding: { top: '6', bottom: '0' },
            data: lexical(head('h4', g.title), styled('label', text(g.note))),
          },
          {
            kind: 'Card', ...fusedEnd, padding: { top: '0', bottom: '6' },
            data: dataSection({
              source: SOURCES.djs,
              columns: g.fields.map(([name, label, type, options]) => ({
                name, show: true, type, customName: label, headerFontStyle: 'label',
                allowEditInView: true, ...(options ? { options } : {}), ...(type === 'textarea' ? { rows: 3 } : {}),
              })),
              filters: [{ col: 'dj_id', op: 'filter', value: [], usePageFilters: true, searchParamKey: 'dj_id' }],
              display: {
                pageSize: 1, usePagination: false, fetchMode: 'smart',
                cellsGridSize: 2, cellsGridGap: 16, cellsPadding: 0, cardsPadding: 0,
                cardBorder: false, allowEditInView: true, liveEdit: true, headerValueLayout: 'col',
              },
            }),
          },
        ],
      })),
      {
        // The aside's one destructive act, stated the way the design states it.
        displayName: 'Leaving the station',
        sections: [
          {
            kind: 'lexical', size: '12',
            bg: 'white', border: { top: true, left: true, right: true, bottom: true },
            radius: { tl: true, tr: true, bl: true, br: true }, padding: { top: '6', bottom: '6' },
            data: lexical(
              head('h4', 'Leaving the station'),
              styled('bodySmall', text('Setting the status to Alumni frees the slot and offers to record an end date. Nothing is deleted — the roster is a 40-year archive and rows are never removed.')),
            ),
          },
        ],
      },
    ],
  },

  /* ═══ 5 · events ════════════════════════════════════════════════════════ */
  {
    slug: 'events',
    title: 'Events',
    icon: 'Star',
    index: 4,
    filters: [{ id: 'wcdb-admin-event-state', searchKey: 'state', values: '', useSearchParams: true }],
    bands: [
      {
        displayName: 'Header',
        sections: [
          { kind: 'lexical', size: '9', data: pageHeader(['Admin', 'Events'], 'Events.', 'Upcoming first · past is kept, dimmed, not deleted') },
          { kind: 'Card', size: '3', data: headerAction({ source: SOURCES.events, label: '+  New event', paramKey: 'add_event' }) },
        ],
      },
      {
        displayName: 'State',
        sections: [
          {
            kind: 'Card',
            data: dataSection({
              source: SOURCES.events,
              columns: [
                pill({ expr: 'count(*)', alias: 'all_events', label: 'All', paramKey: 'state', paramValue: '', activeWhenUnset: true }),
                pill({ expr: "count(*) FILTER (WHERE status = 'published')", alias: 'published_count', label: 'Published', paramKey: 'state', paramValue: 'published' }),
                pill({ expr: "count(*) FILTER (WHERE status = 'draft')", alias: 'draft_count', label: 'Draft', paramKey: 'state', paramValue: 'draft' }),
              ],
              display: {
                pageSize: 1, fetchMode: 'smart',
                cellsGridSize: 4, cellsTracksTemplate: 'max-content max-content max-content 1fr',
                cellsGridGap: 8, cellsPadding: 0, cardsPadding: 0, cardBorder: false,
              },
            }),
          },
        ],
      },
      {
        displayName: 'Events',
        sections: listCard({
          title: 'Upcoming',
          titleMeta: '',
          link: 'Public events page →',
          tracks: EVENT_TRACKS,
          headers: ['Date', 'Event', 'Venue', 'Price', { label: 'Status', justify: 'right' }, ''],
          source: SOURCES.events,
          columns: [
            // The design's stacked numeral: day over month.
            { name: "to_char(date::date, 'DD') as day_num", normalName: 'day_num', origin: 'calculated-column', show: true, hideHeader: true, valueFontStyle: 'rowTitle' },
            { name: 'title', show: true, hideHeader: true, valueFontStyle: 'rowTitle' },
            { name: 'venue', show: true, hideHeader: true, valueFontStyle: 'rowMeta' },
            { name: "coalesce(nullif(price, ''), 'Free') as price_display", normalName: 'price_display', origin: 'calculated-column', show: true, hideHeader: true, valueFontStyle: 'rowMono' },
            { name: 'status', show: true, hideHeader: true, type: 'status_pill', pillColors: EVENT_PILLS, justify: 'right' },
            { name: 'event_id', show: true, hideHeader: true, type: 'row_action', actionLabel: 'Edit', actionIcon: 'EditPage' },
            // Row 2: the month under the day, the time under the title.
            { name: "upper(to_char(date::date, 'Mon')) as month_abbr", normalName: 'month_abbr', origin: 'calculated-column', show: true, hideHeader: true, valueFontStyle: 'rowMeta' },
            { name: "upper(concat_ws(' · ', to_char(date::date, 'Dy'), time)) as when_meta", normalName: 'when_meta', origin: 'calculated-column', show: true, hideHeader: true, valueFontStyle: 'rowMeta' },
            { name: 'date', show: true, selectOnly: true, sort: 'asc' },
          ],
          filters: [{ col: 'status', op: 'filter', value: [], usePageFilters: true, searchParamKey: 'state' }],
          display: {
            pageSize: 25, usePagination: true, fetchMode: 'smart',
            _functions: {
              providers: [{ functionId: 'click_publish', enabled: true, paramKey: 'edit_event', args: { column: 'event_id' } }],
              subscribers: [{ functionId: 'data_refresh', enabled: true, paramKey: 'event_added' }],
            },
          },
          footer: 'Past events are kept, never deleted',
        }),
      },
      {
        displayName: 'New event',
        modal: { paramKey: 'add_event', size: 'xl' },
        sections: [
          { kind: 'lexical', data: lexical(head('h4', 'New event.'), styled('label', text('It starts as a draft — “did I actually publish it” is the question this page gets asked most'))) },
          {
            kind: 'Card',
            data: dataSection({
              source: SOURCES.events,
              columns: [
                { name: 'title', show: true, type: 'text', customName: 'Title', headerFontStyle: 'label' },
                { name: 'date', show: true, type: 'text', customName: 'Date', placeholder: 'YYYY-MM-DD', headerFontStyle: 'label' },
                { name: 'time', show: true, type: 'text', customName: 'Time', placeholder: '8:00 pm', headerFontStyle: 'label' },
                { name: 'venue', show: true, type: 'text', customName: 'Venue', headerFontStyle: 'label' },
                { name: 'price', show: true, type: 'text', customName: 'Price', placeholder: 'Free', headerFontStyle: 'label' },
                { name: 'description', show: true, type: 'textarea', rows: 3, customName: 'Description', headerFontStyle: 'label' },
                { name: 'status', selectOnly: true, defaultValue: 'draft' },
                { name: 'event_id', selectOnly: true, autoNumber: true },
              ],
              filters: [{ col: 'event_id', op: 'filter', value: ['-1'] }],
              display: {
                pageSize: 1, usePagination: false, allowAdddNew: true, cardBorder: false,
                cellsGridSize: 2, cellsGridGap: 16, headerValueLayout: 'col',
                addItemLabel: 'Create event', closeModalOnAdd: 'add_event',
                _functions: { providers: [{ functionId: 'add_publish', enabled: true, paramKey: 'event_added' }] },
              },
            }),
          },
        ],
      },
      {
        displayName: 'Edit event',
        modal: { paramKey: 'edit_event', size: 'xl' },
        sections: [
          { kind: 'lexical', data: lexical(head('h4', 'This event.'), styled('label', text('Draft keeps it off the public site until you say otherwise'))) },
          {
            kind: 'Card',
            data: dataSection({
              source: SOURCES.events,
              columns: [
                { name: 'title', show: true, type: 'text', customName: 'Title', headerFontStyle: 'label', allowEditInView: true },
                { name: 'date', show: true, type: 'text', customName: 'Date', headerFontStyle: 'label', allowEditInView: true },
                { name: 'time', show: true, type: 'text', customName: 'Time', headerFontStyle: 'label', allowEditInView: true },
                { name: 'venue', show: true, type: 'text', customName: 'Venue', headerFontStyle: 'label', allowEditInView: true },
                { name: 'price', show: true, type: 'text', customName: 'Price', headerFontStyle: 'label', allowEditInView: true },
                { name: 'description', show: true, type: 'textarea', rows: 3, customName: 'Description', headerFontStyle: 'label', allowEditInView: true },
                { name: 'status', show: true, type: 'select', customName: 'Status', headerFontStyle: 'label', allowEditInView: true,
                  options: [{ label: 'draft', value: 'draft' }, { label: 'published', value: 'published' }] },
              ],
              filters: [{ col: 'event_id', op: 'filter', value: [], usePageFilters: true, searchParamKey: 'edit_event' }],
              display: {
                pageSize: 1, usePagination: false, cardBorder: false, allowEditInView: true, liveEdit: true, fetchMode: 'force',
                cellsGridSize: 2, cellsGridGap: 16, headerValueLayout: 'col',
              },
            }),
          },
        ],
      },
    ],
  },

  /* ═══ 6 · administrators — the executive board ══════════════════════════ */
  {
    slug: 'administrators',
    title: 'Administrators',
    icon: 'Trophy',
    index: 5,
    filters: [{ id: 'wcdb-admin-dept-filter', searchKey: 'admin_dept', values: '', useSearchParams: true }],
    bands: [
      {
        displayName: 'Header',
        sections: [
          { kind: 'lexical', size: '9', data: pageHeader(['Admin', 'Administrators'], 'Administrators.', 'The executive board · term 1 May 2026 – 1 May 2027') },
          { kind: 'Card', size: '3', data: headerAction({ source: SOURCES.administrators, label: '+  Add a role', paramKey: 'add_role' }) },
        ],
      },
      {
        displayName: 'Departments',
        sections: [
          {
            kind: 'Card',
            data: dataSection({
              source: SOURCES.administrators,
              columns: [
                pill({ expr: 'count(*)', alias: 'all_roles', label: 'All', paramKey: 'admin_dept', paramValue: '', activeWhenUnset: true }),
                // A role nobody holds is a first-class state, not an empty cell —
                // the design prints "Not listed" and the board still publishes a
                // working address for it.
                pill({ expr: "count(*) FILTER (WHERE holder_name ILIKE 'Not listed')", alias: 'unheld', label: 'Unheld', paramKey: 'admin_dept', paramValue: '__unheld__' }),
              ],
              display: {
                pageSize: 1, fetchMode: 'smart',
                cellsGridSize: 3, cellsTracksTemplate: 'max-content max-content 1fr',
                cellsGridGap: 8, cellsPadding: 0, cardsPadding: 0, cardBorder: false, cellsVAlign: 'center',
              },
            }),
          },
        ],
      },
      {
        displayName: 'Roles',
        sections: listCard({
          title: 'The board',
          titleMeta: 'In the order the public page prints them',
          link: 'Public station info →',
          tracks: '180px minmax(0,1fr) minmax(0,1.1fr) 150px 120px 88px',
          headers: ['Department', 'Role', 'Held by', 'Email', 'Office hours', ''],
          source: SOURCES.administrators,
          columns: [
            { name: 'department', show: true, hideHeader: true, valueFontStyle: 'rowMeta' },
            { name: 'position', show: true, hideHeader: true, valueFontStyle: 'rowTitle' },
            // `holder_name` is what renders — `dj_id` is the join for the public
            // page's profile link, and 5 of the 25 roles have no single DJ
            // behind them (two names, or nobody).
            { name: 'holder_name', show: true, hideHeader: true, valueFontStyle: 'textSMReg' },
            { name: "coalesce(nullif(email, ''), '— none listed —') as email_display", normalName: 'email_display', origin: 'calculated-column', show: true, hideHeader: true, valueFontStyle: 'rowMeta' },
            { name: "coalesce(nullif(office_hours, ''), '–') as hours_display", normalName: 'hours_display', origin: 'calculated-column', show: true, hideHeader: true, valueFontStyle: 'rowMeta' },
            { name: 'admin_id', show: true, hideHeader: true, type: 'row_action', actionLabel: 'Edit', actionIcon: 'EditPage' },
            { name: 'sort', show: true, selectOnly: true, sort: 'asc' },
            { name: 'dj_id', show: true, selectOnly: true },
          ],
          filters: [],
          display: {
            pageSize: 40, usePagination: false, fetchMode: 'smart',
            _functions: {
              providers: [{ functionId: 'click_publish', enabled: true, paramKey: 'edit_role', args: { column: 'admin_id' } }],
              subscribers: [{ functionId: 'data_refresh', enabled: true, paramKey: 'role_added' }],
            },
          },
          footer: 'A role with nobody in it reads “Not listed”, never “Vacant” — the department still publishes a working address',
        }),
      },
      {
        displayName: 'Add a role',
        modal: { paramKey: 'add_role', size: 'xl' },
        sections: [
          { kind: 'lexical', data: lexical(head('h4', 'Add a role.'), styled('label', text('The term is stored per role, so next year’s board is new rows — this year’s is kept'))) },
          {
            kind: 'Card',
            data: dataSection({
              source: SOURCES.administrators,
              columns: [
                { name: 'department', show: true, type: 'select', customName: 'Department', headerFontStyle: 'label',
                  options: BOARD_DEPARTMENTS.map((v) => ({ label: v, value: v })) },
                { name: 'position', show: true, type: 'text', customName: 'Role', headerFontStyle: 'label' },
                { name: 'holder_name', show: true, type: 'text', customName: 'Held by', placeholder: 'Not listed', headerFontStyle: 'label' },
                { name: 'dj_id', show: true, type: 'text', customName: 'DJ id (optional)', headerFontStyle: 'label' },
                { name: 'email', show: true, type: 'text', customName: 'Role email', headerFontStyle: 'label' },
                { name: 'office_hours', show: true, type: 'text', customName: 'Office hours', placeholder: 'By appointment', headerFontStyle: 'label' },
                { name: 'term_start', show: true, type: 'text', customName: 'Term start', placeholder: '2026-05-01', headerFontStyle: 'label' },
                { name: 'term_end', show: true, type: 'text', customName: 'Term end', placeholder: '2027-05-01', headerFontStyle: 'label' },
                { name: 'admin_id', selectOnly: true, autoNumber: true },
                { name: 'sort', selectOnly: true, autoNumber: true },
              ],
              filters: [{ col: 'admin_id', op: 'filter', value: ['-1'] }],
              display: {
                pageSize: 1, usePagination: false, allowAdddNew: true, cardBorder: false,
                cellsGridSize: 2, cellsGridGap: 16, headerValueLayout: 'col',
                addItemLabel: 'Add role', closeModalOnAdd: 'add_role',
                _functions: { providers: [{ functionId: 'add_publish', enabled: true, paramKey: 'role_added' }] },
              },
            }),
          },
        ],
      },
      {
        displayName: 'Edit role',
        modal: { paramKey: 'edit_role', size: 'xl' },
        sections: [
          { kind: 'lexical', data: lexical(head('h4', 'This role.'), styled('label', text('Changing who holds a role does not delete anything — last term’s rows stay put'))) },
          {
            kind: 'Card',
            data: dataSection({
              source: SOURCES.administrators,
              columns: [
                { name: 'department', show: true, type: 'select', customName: 'Department', headerFontStyle: 'label', allowEditInView: true,
                  options: BOARD_DEPARTMENTS.map((v) => ({ label: v, value: v })) },
                { name: 'position', show: true, type: 'text', customName: 'Role', headerFontStyle: 'label', allowEditInView: true },
                { name: 'holder_name', show: true, type: 'text', customName: 'Held by', headerFontStyle: 'label', allowEditInView: true },
                { name: 'dj_id', show: true, type: 'text', customName: 'DJ id', headerFontStyle: 'label', allowEditInView: true },
                { name: 'email', show: true, type: 'text', customName: 'Role email', headerFontStyle: 'label', allowEditInView: true },
                { name: 'office_hours', show: true, type: 'text', customName: 'Office hours', headerFontStyle: 'label', allowEditInView: true },
                { name: 'sort', show: true, type: 'text', customName: 'Order', headerFontStyle: 'label', allowEditInView: true },
              ],
              filters: [{ col: 'admin_id', op: 'filter', value: [], usePageFilters: true, searchParamKey: 'edit_role' }],
              display: {
                pageSize: 1, usePagination: false, cardBorder: false, allowEditInView: true, liveEdit: true, fetchMode: 'force',
                cellsGridSize: 2, cellsGridGap: 16, headerValueLayout: 'col',
              },
            }),
          },
        ],
      },
    ],
  },

  /* ═══ 7 · posts — the blog ══════════════════════════════════════════════ */
  {
    slug: 'posts',
    title: 'Posts',
    icon: 'Newspaper',
    index: 6,
    filters: [
      { id: 'wcdb-admin-post-state', searchKey: 'post_state', values: '', useSearchParams: true },
      { id: 'wcdb-admin-post-cat', searchKey: 'post_cat', values: '', useSearchParams: true },
    ],
    bands: [
      {
        displayName: 'Header',
        sections: [
          { kind: 'lexical', size: '9', data: pageHeader(['Admin', 'Posts'], 'Posts.', 'Dispatches, interviews, liner notes, studio diary') },
          { kind: 'Card', size: '3', data: headerAction({ source: SOURCES.posts, label: '+  New post', paramKey: 'add_post' }) },
        ],
      },
      {
        displayName: 'State',
        sections: [
          {
            kind: 'Card',
            data: dataSection({
              source: SOURCES.posts,
              columns: [
                pill({ expr: 'count(*)', alias: 'all_posts', label: 'All', paramKey: 'post_state', paramValue: '', activeWhenUnset: true }),
                pill({ expr: "count(*) FILTER (WHERE status = 'published')", alias: 'published_posts', label: 'Published', paramKey: 'post_state', paramValue: 'published' }),
                pill({ expr: "count(*) FILTER (WHERE status = 'draft')", alias: 'draft_posts', label: 'Draft', paramKey: 'post_state', paramValue: 'draft' }),
              ],
              display: {
                pageSize: 1, fetchMode: 'smart',
                cellsGridSize: 4, cellsTracksTemplate: 'max-content max-content max-content 1fr',
                cellsGridGap: 8, cellsPadding: 0, cardsPadding: 0, cardBorder: false,
              },
            }),
          },
        ],
      },
      {
        displayName: 'Posts',
        sections: listCard({
          title: 'Everything written',
          titleMeta: 'Newest first',
          link: 'Public blog →',
          tracks: '96px minmax(0,1fr) 140px 130px 110px 88px',
          headers: ['Date', 'Post', 'Category', 'By', { label: 'Status', justify: 'right' }, ''],
          source: SOURCES.posts,
          columns: [
            { name: 'published_at', show: true, hideHeader: true, valueFontStyle: 'rowMono', sort: 'desc' },
            { name: 'title', show: true, hideHeader: true, valueFontStyle: 'rowTitle' },
            { name: 'category', show: true, hideHeader: true, valueFontStyle: 'rowMeta' },
            { name: "coalesce(nullif(author_name, ''), '— unattributed —') as author_display", normalName: 'author_display', origin: 'calculated-column', show: true, hideHeader: true, valueFontStyle: 'rowMeta' },
            { name: 'status', show: true, hideHeader: true, type: 'status_pill', pillColors: EVENT_PILLS, justify: 'right' },
            { name: 'post_id', show: true, hideHeader: true, type: 'row_action', actionLabel: 'Edit', actionIcon: 'EditPage' },
            // Row 2: the excerpt under the title, as the public grid shows it.
            { name: 'row2_spacer_posts', origin: 'static', staticValue: '', show: true, hideHeader: true },
            { name: 'excerpt', show: true, hideHeader: true, valueFontStyle: 'rowMeta', cellSpan: 5 },
            { name: 'slug', show: true, selectOnly: true },
          ],
          filters: [
            { col: 'status', op: 'filter', value: [], usePageFilters: true, searchParamKey: 'post_state' },
            { col: 'category', op: 'filter', value: [], usePageFilters: true, searchParamKey: 'post_cat' },
          ],
          display: {
            pageSize: 25, usePagination: true, fetchMode: 'smart',
            _functions: {
              providers: [{ functionId: 'click_publish', enabled: true, paramKey: 'edit_post', args: { column: 'post_id' } }],
              subscribers: [{ functionId: 'data_refresh', enabled: true, paramKey: 'post_added' }],
            },
          },
          footer: 'A post is invisible on the public site until its status is published',
        }),
      },
      {
        displayName: 'New post',
        modal: { paramKey: 'add_post', size: '2xl' },
        sections: [
          { kind: 'lexical', data: lexical(head('h4', 'New post.'), styled('label', text('It starts as a draft. The slug is the public URL, so it is generated from the title and then left alone.'))) },
          {
            kind: 'Card',
            data: dataSection({
              source: SOURCES.posts,
              columns: [
                { name: 'title', show: true, type: 'text', customName: 'Title', headerFontStyle: 'label' },
                { name: 'slug', show: true, type: 'text', customName: 'Slug', placeholder: 'from-the-title', headerFontStyle: 'label' },
                { name: 'category', show: true, type: 'select', customName: 'Category', headerFontStyle: 'label',
                  options: POST_CATEGORIES.map((v) => ({ label: v, value: v })) },
                { name: 'published_at', show: true, type: 'text', customName: 'Date', placeholder: 'YYYY-MM-DD', headerFontStyle: 'label' },
                { name: 'author_name', show: true, type: 'text', customName: 'By', headerFontStyle: 'label' },
                { name: 'excerpt', show: true, type: 'textarea', rows: 2, customName: 'Excerpt', headerFontStyle: 'label' },
                { name: 'body', show: true, type: 'textarea', rows: 8, customName: 'Body', headerFontStyle: 'label' },
                { name: 'status', selectOnly: true, defaultValue: 'draft' },
                { name: 'featured', selectOnly: true, defaultValue: 'false' },
                { name: 'post_id', selectOnly: true, autoNumber: true },
              ],
              filters: [{ col: 'post_id', op: 'filter', value: ['-1'] }],
              display: {
                pageSize: 1, usePagination: false, allowAdddNew: true, cardBorder: false,
                cellsGridSize: 2, cellsGridGap: 16, headerValueLayout: 'col',
                addItemLabel: 'Create post', closeModalOnAdd: 'add_post',
                _functions: { providers: [{ functionId: 'add_publish', enabled: true, paramKey: 'post_added' }] },
              },
            }),
          },
        ],
      },
      {
        displayName: 'Edit post',
        modal: { paramKey: 'edit_post', size: '2xl' },
        sections: [
          { kind: 'lexical', data: lexical(head('h4', 'This post.'), styled('label', text('Featured puts it at the top of the blog and on the home page'))) },
          {
            kind: 'Card',
            data: dataSection({
              source: SOURCES.posts,
              columns: [
                { name: 'title', show: true, type: 'text', customName: 'Title', headerFontStyle: 'label', allowEditInView: true },
                { name: 'slug', show: true, type: 'text', customName: 'Slug', headerFontStyle: 'label', allowEditInView: true },
                { name: 'category', show: true, type: 'select', customName: 'Category', headerFontStyle: 'label', allowEditInView: true,
                  options: POST_CATEGORIES.map((v) => ({ label: v, value: v })) },
                { name: 'published_at', show: true, type: 'text', customName: 'Date', headerFontStyle: 'label', allowEditInView: true },
                { name: 'author_name', show: true, type: 'text', customName: 'By', headerFontStyle: 'label', allowEditInView: true },
                { name: 'featured', show: true, type: 'select', customName: 'Featured', headerFontStyle: 'label', allowEditInView: true,
                  options: [{ label: 'false', value: 'false' }, { label: 'true', value: 'true' }] },
                { name: 'excerpt', show: true, type: 'textarea', rows: 2, customName: 'Excerpt', headerFontStyle: 'label', allowEditInView: true },
                { name: 'body', show: true, type: 'textarea', rows: 10, customName: 'Body', headerFontStyle: 'label', allowEditInView: true },
                { name: 'status', show: true, type: 'select', customName: 'Status', headerFontStyle: 'label', allowEditInView: true,
                  options: [{ label: 'draft', value: 'draft' }, { label: 'published', value: 'published' }] },
              ],
              filters: [{ col: 'post_id', op: 'filter', value: [], usePageFilters: true, searchParamKey: 'edit_post' }],
              display: {
                pageSize: 1, usePagination: false, cardBorder: false, allowEditInView: true, liveEdit: true, fetchMode: 'force',
                cellsGridSize: 2, cellsGridGap: 16, headerValueLayout: 'col',
              },
            }),
          },
        ],
      },
    ],
  },

  /* ═══ 8 · shows ═════════════════════════════════════════════════════════
   * The shows themselves — name, DJ, department, description, and the photo.
   *
   * Added 2026-08-15 with the `image` column. Until now NOTHING in the admin
   * could write to `shows`: the schedule page joins it read-only, and its two
   * modals deliberately edit AIRINGS ("day and time belong to the airing; the
   * show's name, DJ and description are shared by every airing of it"). So a
   * show's own record had no editor anywhere, and adding `image` without this
   * page would have been adding a column nobody could ever fill.
   *
   * 705 rows — forty years of shows, most of them long off the air — so this
   * page leads with search rather than a state filter bar. */
  {
    slug: 'shows',
    title: 'Shows',
    icon: 'Mic',
    index: 2,
    filters: [
      { id: 'wcdb-admin-show-search', searchKey: 'show_search', values: '', useSearchParams: true },
      { id: 'wcdb-admin-show-dept', searchKey: 'show_dept', values: '', useSearchParams: true },
    ],
    bands: [
      {
        displayName: 'Header',
        sections: [
          { kind: 'lexical', size: '9', data: pageHeader(['Admin', 'Shows'], 'Shows.', 'One record per show — shared by every airing of it, in every schedule version') },
          { kind: 'Card', size: '3', data: headerAction({ source: SOURCES.shows, label: '+  New show', paramKey: 'add_show' }) },
        ],
      },
      {
        displayName: 'Department',
        sections: [
          {
            kind: 'Card',
            data: dataSection({
              source: SOURCES.shows,
              columns: [
                pill({ expr: 'count(*)', alias: 'all_shows', label: 'All', paramKey: 'show_dept', paramValue: '', activeWhenUnset: true }),
                ...DEPARTMENTS.slice(0, 5).map((d, i) => pill({
                  expr: `count(*) FILTER (WHERE department = '${d.replace(/'/g, "''")}')`,
                  alias: `dept_${i}`, label: d, paramKey: 'show_dept', paramValue: d,
                })),
              ],
              display: {
                pageSize: 1, fetchMode: 'smart',
                cellsGridSize: 7, cellsTracksTemplate: 'max-content max-content max-content max-content max-content max-content 1fr',
                cellsGridGap: 8, cellsPadding: 0, cardsPadding: 0, cardBorder: false,
              },
            }),
          },
        ],
      },
      {
        displayName: 'Shows',
        sections: listCard({
          title: 'Every show',
          titleMeta: 'A–Z',
          link: 'Public schedule →',
          tracks: '56px minmax(0,1fr) 150px 150px 88px',
          headers: ['', 'Show', 'Department', 'Host', ''],
          source: SOURCES.shows,
          join: showHostJoin,
          columns: [
            // The photo, at row scale. This is the column the page exists for:
            // it is the only place a station admin can see, at a glance, which
            // shows still have no picture behind them on the home page.
            // `type: 'image'` rather than the legacy `isImg` flag. The column
            // type is the one that carries `defaultImage` (shown when the row's
            // value is empty), renders nothing rather than a broken glyph when
            // there is neither, and — in edit mode — offers an UPLOAD widget on
            // an empty cell, so an editor never has to find a URL by hand.
            // No `defaultImage` here on purpose: in this list a blank photo
            // track is the signal the page exists to give.
            { name: 'ds.image', normalName: 'image', show: true, hideHeader: true, type: 'image', imageSize: 'imgFill' },
            { name: 'ds.name', normalName: 'name', show: true, hideHeader: true, valueFontStyle: 'rowTitle' },
            { name: 'ds.department', normalName: 'department', show: true, hideHeader: true, valueFontStyle: 'rowMeta' },
            { name: 'djs.on_air_name', normalName: 'on_air_name', show: true, hideHeader: true, valueFontStyle: 'rowMeta' },
            { name: 'ds.show_id', normalName: 'show_id', show: true, hideHeader: true, type: 'row_action', actionLabel: 'Edit', actionIcon: 'EditPage' },
            // Row 2: the description under the title, as the public show page
            // leads with it.
            { name: 'row2_spacer_shows', origin: 'static', staticValue: '', show: true, hideHeader: true },
            { name: 'ds.description', normalName: 'description', show: true, hideHeader: true, valueFontStyle: 'rowMeta', cellSpan: 4 },
          ],
          filters: [
            { col: 'department', op: 'filter', value: [], usePageFilters: true, searchParamKey: 'show_dept' },
            { col: 'ds.name', op: 'like', value: [], usePageFilters: true, searchParamKey: 'show_search' },
          ],
          display: {
            pageSize: 25, usePagination: true, fetchMode: 'smart',
            _functions: {
              providers: [{ functionId: 'click_publish', enabled: true, paramKey: 'edit_show', args: { column: 'show_id' } }],
              subscribers: [{ functionId: 'data_refresh', enabled: true, paramKey: 'show_added' }],
            },
          },
          footer: 'A show with no photo falls back to a generated gradient on the home page — it is never broken, just plainer',
        }),
      },
      {
        displayName: 'New show',
        modal: { paramKey: 'add_show', size: '2xl' },
        sections: [
          { kind: 'lexical', data: lexical(head('h4', 'New show.'), styled('label', text('Check it does not already exist first — typing one in again is how Full Court Press ended up in the data six times'))) },
          {
            kind: 'Card',
            data: dataSection({
              source: SOURCES.shows,
              columns: [
                { name: 'name', show: true, type: 'text', customName: 'Name', headerFontStyle: 'label' },
                { name: 'department', show: true, type: 'select', customName: 'Department', headerFontStyle: 'label',
                  options: DEPARTMENTS.map((v) => ({ label: v, value: v })) },
                { name: 'dj_id', show: true, type: 'text', customName: 'DJ id', headerFontStyle: 'label' },
                { name: 'icon', show: true, type: 'text', customName: 'Glyph', placeholder: 'Mic', headerFontStyle: 'label' },
                { name: 'description', show: true, type: 'textarea', rows: 4, customName: 'Description', headerFontStyle: 'label' },
                { name: 'image', show: true, type: 'text', customName: 'Photo URL', placeholder: 'https://…', headerFontStyle: 'label' },
                { name: 'show_id', selectOnly: true, autoNumber: true },
              ],
              filters: [{ col: 'show_id', op: 'filter', value: ['-1'] }],
              display: {
                pageSize: 1, usePagination: false, allowAdddNew: true, cardBorder: false,
                cellsGridSize: 2, cellsGridGap: 16, headerValueLayout: 'col',
                addItemLabel: 'Create show', closeModalOnAdd: 'add_show',
                _functions: { providers: [{ functionId: 'add_publish', enabled: true, paramKey: 'show_added' }] },
              },
            }),
          },
        ],
      },
      {
        displayName: 'Edit show',
        modal: { paramKey: 'edit_show', size: '2xl' },
        sections: [
          { kind: 'lexical', data: lexical(head('h4', 'This show.'), styled('label', text('These values are shared by every airing of the show, in every schedule version. The photo is what the home page draws behind the on-air panel — landscape crops read best.'))) },
          {
            kind: 'Card',
            data: dataSection({
              source: SOURCES.shows,
              columns: [
                { name: 'name', show: true, type: 'text', customName: 'Name', headerFontStyle: 'label', allowEditInView: true },
                { name: 'department', show: true, type: 'select', customName: 'Department', headerFontStyle: 'label', allowEditInView: true,
                  options: DEPARTMENTS.map((v) => ({ label: v, value: v })) },
                { name: 'dj_id', show: true, type: 'text', customName: 'DJ id', headerFontStyle: 'label', allowEditInView: true },
                { name: 'icon', show: true, type: 'text', customName: 'Glyph', headerFontStyle: 'label', allowEditInView: true },
                { name: 'description', show: true, type: 'textarea', rows: 5, customName: 'Description', headerFontStyle: 'label', allowEditInView: true, cellSpan: 2 },
                { name: 'image', show: true, type: 'text', customName: 'Photo URL', placeholder: 'https://…', headerFontStyle: 'label', allowEditInView: true, cellSpan: 2 },
              ],
              filters: [{ col: 'show_id', op: 'filter', value: [], usePageFilters: true, searchParamKey: 'edit_show' }],
              display: {
                pageSize: 1, usePagination: false, cardBorder: false, allowEditInView: true, liveEdit: true, fetchMode: 'force',
                cellsGridSize: 2, cellsGridGap: 16, headerValueLayout: 'col',
              },
            }),
          },
          // The photo, shown at size next to its URL — the only way an editor
          // can tell a good crop from a bad one without leaving the modal.
          {
            kind: 'Card',
            data: dataSection({
              source: SOURCES.shows,
              columns: [
                { name: 'image', show: true, hideHeader: true, type: 'image', imageSize: 'imgFill' },
              ],
              filters: [{ col: 'show_id', op: 'filter', value: [], usePageFilters: true, searchParamKey: 'edit_show' }],
              display: {
                pageSize: 1, usePagination: false, cardBorder: false, fetchMode: 'force',
                cellsGridSize: 1, cellsPadding: 0, cardsPadding: 0,
              },
            }),
          },
        ],
      },
    ],
  },

];

/* ── apply ───────────────────────────────────────────────────────────────── */

/* GUARD: is the pattern even READABLE?
 *
 * The reuse check below is "did `page list` return a page with this slug?", and an
 * empty answer means "first run, create it". But there is a second way to get an
 * empty answer: `station_admin` is a PERMISSIONED pattern (its authPermissions grant
 * `*` to user 175 and the group `wcdb Admin`), and an unauthorized caller — which the
 * CLI is unless DMS_AUTH_TOKEN carries an authorized account — gets the pattern back
 * as `id: 'no-access'` with ZERO pages. The seed then cheerfully creates a SECOND
 * copy of every page, which is how this run produced 8 duplicate admin pages and 85
 * orphan sections that had to be deleted by hand.
 *
 * Creating is only safe when we can prove we are seeing the whole pattern. Abort
 * otherwise: a loud failure costs a re-run, a silent one costs a cleanup.
 */
const patternRow = (dmsJson(['pattern', 'list', '--format', 'json']).items || [])
  .find((p) => (p.data?.name ?? p.name) === PATTERN);
if (!patternRow) {
  console.error(`\nABORT: pattern '${PATTERN}' not found on ${HOST} (app ${APP}, type ${TYPE}).`);
  process.exit(1);
}
if (String(patternRow.id) === 'no-access') {
  console.error(
    `\nABORT: pattern '${PATTERN}' is readable only to authorized accounts, and this run is not one.\n` +
    `Its pages are invisible from here, so every page would be CREATED as a duplicate.\n` +
    `Re-run with DMS_AUTH_TOKEN set to a token for an account the pattern grants` +
    ` (user 175 / group 'wcdb Admin'), e.g.\n\n` +
    `    DMS_AUTH_TOKEN=$(curl -s -X POST ${HOST}/login -H 'Content-Type: application/json' \\\n` +
    `      -d '{"email":"…","password":"…","project":"${APP}"}' | jq -r .user.token) \\\n` +
    `      node scripts/wcdb-admin/seed-wcdb-admin-pages.mjs\n`
  );
  process.exit(1);
}

// `page list` returns SUMMARY rows — id/type at the top level, everything else
// nested under `data`. Keying the reuse check off a top-level `url_slug` finds
// nothing and makes a duplicate page on every run.
const listed = dmsJson(['page', 'list', '--pattern', PATTERN, '--format', 'json']);
const existing = new Map(
  (listed.items || [])
    .map((p) => [p.data?.url_slug ?? p.url_slug, p])
    .filter(([slug]) => slug)
);

for (const page of pages) {
  let id = existing.get(page.slug)?.id;
  if (id) {
    console.log(`page ${page.slug} → reusing ${id}`);
  } else {
    const created = dmsJson(['page', 'create', '--pattern', PATTERN, '--title', page.title, '--slug', page.slug, '--format', 'json']);
    id = created.id || created.data?.id;
    console.log(`page ${page.slug} → created ${id}`);
  }

  const groups = page.bands.map((b, i) => band({ index: i, displayName: b.displayName, modal: b.modal }));

  // `--data` shallow-merges at the top level, so this replaces exactly these
  // keys and preserves the rest of the row. NEVER `--set` for arrays: it
  // deep-merges BY INDEX, so a re-run accumulates stale entries.
  const pageData = {
    title: page.title,
    icon: page.icon,
    index: page.index,
    filters: page.filters || [],
    draft_section_groups: groups,
  };
  if (page.hideInNav) pageData.hide_in_nav = true;
  if (WIPE) pageData.draft_sections = [];
  dms(['page', 'update', String(id), '--data', JSON.stringify(pageData)]);

  const created = [];
  page.bands.forEach((b, i) => {
    for (const s of b.sections) {
      const common = { pageId: id, group: groups[i].name, size: s.size || '12' };
      for (const k of ['padding', 'height', 'border', 'radius', 'bg', 'rowspan']) if (s[k] != null) common[k] = s[k];
      const payload = s.kind === 'lexical'
        ? lexicalSection({ ...common, elementData: s.data })
        : section({ ...common, elementType: s.kind, elementData: s.data });
      const row = dmsJson(['section', 'create', String(id), '--pattern', PATTERN, '--data', JSON.stringify(payload), '--format', 'json']);
      created.push(String(row.id || row.data?.id));
    }
  });

  // `section create` appends, and render order within a band is the order of
  // ids in draft_sections — so state the whole list rather than trusting
  // creation order to survive a re-run.
  if (WIPE) {
    dms(['page', 'update', String(id), '--data', JSON.stringify({
      draft_sections: created.map((sid) => ({ id: sid, ref: `${process.env.DMS_APP || 'wcdb'}+${COMPONENT_TYPE}` })),
    })]);
  }
  console.log(`  ${page.bands.length} bands · ${created.length} sections`);
}

console.log(`
Seeded as DRAFTS. Publish (a human, after review):
    for p in playlist schedule djs dj_profile events; do dms page publish "$p" --pattern ${PATTERN}; done
`);
