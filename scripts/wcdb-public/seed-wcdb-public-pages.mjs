#!/usr/bin/env node
/* Seed the WCDB PUBLIC pages into the `wcdb_main` pattern.
 *
 *   export DMS_AUTH_TOKEN=…
 *   WIPE=1 node scripts/wcdb-public/seed-wcdb-public-pages.mjs
 *   WIPE=1 node scripts/wcdb-public/seed-wcdb-public-pages.mjs --only home,blog
 *
 * Design: src/themes/wcdb/WCDB Design System/dms_design_system/pages/*.html
 * Task:   project-planning/wcdb/tasks/current/build-wcdb-public-pages.md
 *
 * ── DRAFT ONLY, AND THIS IS THE LIVE SITE ────────────────────────────────
 * Sections land in `draft_sections`. Publishing a public page is a human's
 * deliberate act, page by page — this script never does it, and never writes
 * the published `sections` / `section_groups` pair.
 *
 * ── THE SHAPE OF A PUBLIC PAGE ───────────────────────────────────────────
 * Every mockup is the same two-column cutaway:
 *
 *   header band  → the LIVE RAIL (what is on air, what is playing). Sticky,
 *                  left, full height. Identical on all eight pages.
 *   content band → the page itself, ending in the shared footer.
 *
 * So the rail and the footer are built ONCE here and stamped onto every page.
 */
import {
  dms, dmsJson, SOURCES, band, section, lexicalSection, lexical, styled, text, head,
  lcontainer, litem, button, hr, dataSection, fusedTop, fusedMid, fusedEnd, staticRowSection,
} from '../wcdb-admin/lib.mjs';

const PATTERN = 'wcdb_main';
const COMPONENT_TYPE = `${PATTERN}|component`;
const APP = process.env.DMS_APP || 'wcdb';
const WIPE = process.env.WIPE === '1';
const ONLY = (process.argv.find((a) => a.startsWith('--only='))?.split('=')[1]
  || (process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : ''))
  .split(',').filter(Boolean);

/* ── the "now airing" projection ──────────────────────────────────────────
 * A weekly schedule has no absolute timestamp — every show airs every week —
 * so `now()` has to enter the maths at QUERY time. These calc columns project
 * each airing onto the current week and the time filter picks the row whose
 * interval contains now(). Recipe: `now-airing-card.md`.
 *
 * Rewritten here for the MIGRATED schema: real columns on an external pg
 * source (`day`, `"start"`, `"end"`) rather than the legacy JSONB
 * `data->>'show_day_start'`, and — because the migration dropped `end_day` —
 * an overnight show is `end <= start`, so the duration wraps by 24h rather
 * than by a day-of-week difference.
 */
const TZ = 'America/New_York';
// The MONDAY that starts the current week, at local midnight — because this
// dataset's `day` is **0 = Monday … 6 = Sunday** (`wcdb-migrate/transform.mjs`:
// "day 0 = Monday, to match the admin week grid"), NOT Postgres's `dow`, which
// is 0 = Sunday. Conflating the two shifts every airing by a day.
//
// `date_trunc('week', …)` returns Monday natively, so the right anchor needs no
// arithmetic at all. Two bugs lived in this one line before 2026-08-16:
//   1. `- interval '1 day'` moved it to Sunday to match an assumed 0 = Sunday.
//      On a Sunday, `date_trunc('week')` returns the Monday *before* it, so
//      minus a day landed on the PREVIOUS Sunday — every airing a week in the
//      past, nothing containing now(), card blank. Wrong one day in seven.
//   2. Fixing (1) by anchoring on Sunday still mismatched the data: day 0
//      (Monday) projected onto Sunday, so the card showed MONDAY's lineup on a
//      Sunday, self-consistently mislabelled.
// Anchoring on Monday and indexing with the dataset's own numbering makes both
// disappear.
const LOCAL_NOW = `(now() AT TIME ZONE '${TZ}')`;
const ANCHOR = `date_trunc('week', ${LOCAL_NOW}) AT TIME ZONE '${TZ}'`;
// Postgres dow (0 = Sun) → this dataset's day (0 = Mon). Sunday: (0+6)%7 = 6 ✓
const TODAY_DAY = `((extract(dow from ${LOCAL_NOW})::int + 6) % 7)`;
const PROJECTED = `(${ANCHOR} + (ds.day * interval '1 day') + NULLIF(ds."start",'')::interval)`;
// If the projection lands in the future, it is next week's — step back one.
const START_AT = `(${PROJECTED} - interval '7 days' * (${PROJECTED} > now())::int)`;
const RAW_DUR = `(NULLIF(ds."end",'')::interval - NULLIF(ds."start",'')::interval)`;
const DURATION = `(CASE WHEN ${RAW_DUR} <= interval '0 seconds' THEN ${RAW_DUR} + interval '24 hours' ELSE ${RAW_DUR} END)`;
const END_AT = `(${START_AT} + ${DURATION})`;

const nowAiringCalcs = [
  { name: `${START_AT} as start_at`, display_name: 'Start At', type: 'timestamp', display: 'calculated', show: false },
  { name: `${END_AT} as end_at`, display_name: 'End At', type: 'timestamp', display: 'calculated', show: false },
];
const nowAiringFilter = {
  col: 'start_at', op: 'time',
  value: { ranges: [{ kind: 'instant', at: 'now' }], compareEnd: 'end_at' },
};

// shows ⋈ schedule, the join every schedule-shaped section needs.
const showsJoin = {
  operator: '=',
  sources: {
    shows: {
      source: SOURCES.shows.source_id, view: SOURCES.shows.view_id,
      env: 'wcdb-dama', srcEnv: 'wcdb-dama', type: 'left', mergeStrategy: 'join',
      joinColumns: [{ dsColumn: 'show_id', joinSourceColumn: 'show_id' }],
      sourceInfo: SOURCES.shows,
    },
  },
};
// …and the DJ behind the show, for a host name.
const djsJoin = {
  operator: '=',
  sources: {
    shows: showsJoin.sources.shows,
    djs: {
      source: SOURCES.djs.source_id, view: SOURCES.djs.view_id,
      env: 'wcdb-dama', srcEnv: 'wcdb-dama', type: 'left', mergeStrategy: 'join',
      // TWO HOPS: the DJ hangs off the SHOW, not off the airing. A bare
      // `shows.dj_id` is prefixed by the builder into `ds.shows.dj_id`, which
      // is not a thing — an expression carrying " as " is treated as a
      // calculated join key and passed through, which is the documented way to
      // join against a value that only exists on a previously-joined table.
      joinColumns: [{ dsColumn: 'shows.dj_id as host_dj_id', joinSourceColumn: 'dj_id' }],
      sourceInfo: SOURCES.djs,
    },
  },
};

/* ── shared chrome ────────────────────────────────────────────────────────── */

/** The live rail — two cards in the sticky `header` band, on every page.
 *  What is ON AIR (from the schedule) above what is PLAYING (from the feed). */
const liveRail = () => [
  {
    // `padding: { bottom: '0' }` — the now-playing block butts straight against
    // the photo in the design; any bottom padding here shows as a band of card
    // background between them.
    //
    // NB the photo's height is EXPLICIT (`imgOnAir`), not filled.
    // The design's block is `flex-1` in a screen-height rail, and the obvious
    // move — `height: 'fill'` on the section — does not work today: measured on
    // the live page, the section keeps `flex: 0 1 auto` (the sentinel never
    // reaches it) and, more fundamentally, the `.relative` wrapper and the
    // sectionArray grid between the band and the section are content-sized
    // block/grid boxes, so there is no unbroken height chain to fill even if it
    // did. Fixing that is a layout change in the rail band, logged in Phase 6.
    // `radius` on the TOP corners only, and no padding at all.
    //
    // The radius is what makes the section CLIP (sectionArray gives a rounded
    // chrome box `overflow-hidden`): the photo is 178px taller than the box —
    // that is the whole point of `cellMarginBottom: -178`, which is what lets
    // the text ride up over it — so without clipping the image spills out of
    // its own section. It matches the rail card's own 18px top corners, so
    // nothing looks different; it just stops the photo escaping.
    //
    // Zero padding so the photo runs edge to edge and the now-playing block
    // below butts straight against it.
    kind: 'Card', band: 'rail',
    radius: { tl: true, tr: true },
    padding: { top: '0', bottom: '0', left: '0', right: '0' },
    data: dataSection({
      source: SOURCES.schedule,
      join: djsJoin,
      columns: [
        ...nowAiringCalcs,
        // THE PHOTO, as a backdrop — built from ordinary columns, not a
        // composite column type (`src/themes/CLAUDE.md`: configure the Card).
        //
        // The trick is `cellMarginBottom`: a negative bottom margin on the
        // image cell lets every cell AFTER it ride up over the photo's lower
        // third, which is exactly how the design pins the show identity to the
        // picture. Grid items paint in DOM order, so the text lands on top with
        // no z-index. Each line stays its own column — an author can still
        // retype, reorder or drop any of them.
        //
        // `defaultImage` covers the common case: almost no show has a photo
        // yet, and the design itself rotates among the station's library
        // rather than claiming a per-show picture.
        {
          name: 'shows.image', normalName: 'image', show: true, hideHeader: true,
          type: 'image', imageSize: 'imgOnAir',
          defaultImage: '/themes/wcdb/photos/live-spring-show-2024.jpg',
          cellPadding: 0, cellMarginBottom: -178,
          // Nothing to set: `defaultImage` already covers both the "show has no
          // photo" and the "no show at all" cases.
          blankDefault: '',
        },
        // THE SCRIM. An empty static cell pulled up over the photo's lower
        // half with a negative top margin, carrying the design's gradient as
        // its background. It comes BEFORE the text cells in DOM order, so it
        // paints over the photo and under the type — the whole stack is just
        // three ordinary columns leaning on each other's margins.
        //
        // Fixed dark in both modes, like the type tokens: a photograph does not
        // become light because the page did.
        {
          name: 'onair_scrim', origin: 'static', staticValue: '', show: true, hideHeader: true,
          cellBgColor: 'linear-gradient(to top, rgba(10,10,10,0.94), rgba(10,10,10,0.58) 45%, rgba(10,10,10,0.12))',
          // An empty cell has no height, so its box comes from padding — no new
          // knob needed. The margin maths: the image gives back 140px
          // (`cellMarginBottom: -178`), the scrim is 178px tall and gives the
          // same 178 back, so the text cells start at the SAME y as the scrim
          // and land on top of it. 140 ≈ the four text lines plus the bottom
          // gutter, which puts the identity in the photo's lower quarter where
          // the design has it.
          cellPadding: 0, cellPaddingTop: 178, cellMarginBottom: -178,
        },
        // The slot line — `THU · 11 PM – 1 AM`, the design's second question
        // after "is it live?". Built here rather than left out: the airing
        // already carries day/start/end.
        {
          name: `upper(concat_ws(' · ', (CASE ds.day WHEN 0 THEN 'Mon' WHEN 1 THEN 'Tue' WHEN 2 THEN 'Wed' WHEN 3 THEN 'Thu' WHEN 4 THEN 'Fri' WHEN 5 THEN 'Sat' WHEN 6 THEN 'Sun' END), concat(to_char(NULLIF(ds."start",'')::time, 'FMHH12 AM'), ' – ', to_char(NULLIF(ds."end",'')::time, 'FMHH12 AM')))) as slot_line`,
          normalName: 'slot_line', origin: 'calculated-column', show: true, hideHeader: true,
          valueFontStyle: 'onAirSlot', cellPadding: 0, cellMarginLeft: 24, cellMarginRight: 24,
          blankDefault: 'OFF THE SCHEDULE',
        },
        {
          name: 'shows.name', normalName: 'name', show: true, hideHeader: true,
          valueFontStyle: 'onAirTitle', cellPadding: 0, cellMarginLeft: 24, cellMarginRight: 24,
          blankDefault: '90.9 FM',
        },
        // The DJ is a NAME, so the design gives it the display voice rather
        // than a mono caption — second in the hierarchy, ahead of the genre.
        {
          name: "nullif(concat('w/ ', djs.on_air_name), 'w/ ') as host_line", normalName: 'host_line',
          origin: 'calculated-column', show: true, hideHeader: true,
          valueFontStyle: 'onAirHost', cellPadding: 0, cellMarginLeft: 24, cellMarginRight: 24,
          blankDefault: 'Music on rotation',
        },
        // The department, quiet, at the foot of the photo — the design's genre
        // line. The long `description` is deliberately NOT here; it never was
        // in the mockup and it was what made this card read as a paragraph.
        {
          name: 'shows.department', normalName: 'department', show: true, hideHeader: true,
          // NO `justify` here: the justify utilities carry a `rounded-md`
          // that lands on the chip itself and rounds the three corners that
          // must stay square. `mr-auto` in the token does the left-alignment.
          valueFontStyle: 'onAirGenre', blankDefault: '',
          // FLUSH to the corner: the chip's whole point is that it meets the
          // photo's bottom-left edge, so no side or bottom margin here. The
          // 24px inset the text lines above carry would break the join.
          cellPadding: 0, cellMarginTop: 14,
        },
        { name: 'shows.icon', normalName: 'icon', show: true, selectOnly: true },
      ],
      filters: [nowAiringFilter],
      display: {
        pageSize: 1, usePagination: false,
        // A boundary-crossing card: `useNowTick` reschedules it on the next
        // interval edge, so it must not serve a cached row.
        fetchMode: 'force',
        cardStyle: 'plain',
        cellsGridSize: 1, cellsGridGap: 2, cellsPadding: 0,
        cardBorder: false, cardsPadding: 0,
        // THE OFF-AIR STATE. There are real gaps in the week — today has one
        // between 3 and 4pm, and the overnight hours are unscheduled — and
        // without this the rail's largest element simply vanished, leaving a
        // 40px stub. `useBlankRowFallback` synthesizes one row from each
        // column's `blankDefault` when the query returns nothing, so the panel
        // keeps its shape and says something true instead of disappearing.
        //
        // NB the copy below is placeholder and should be the station's own —
        // "Music on rotation" is a guess at what 90.9 does off-schedule.
        useBlankRowFallback: true,
      },
    }),
  },
  {
    // The now-playing block. The design gives it its OWN surface tone so it
    // reads as a separate instrument rather than more rows of the show block
    // above it — hence the `bg` here rather than inheriting the rail card's.
    // No radius: this block is FUSED to the photo above it — in the design the
    // two surfaces meet on a straight edge, and the rail band's own
    // `overflow-hidden rounded-[18px]` already rounds the outside. Left to the
    // default, the section drew its own rounded top corners and the photo
    // appeared to end early, with a strip of card background showing through
    // the curve.
    kind: 'Card', band: 'rail', bg: 'tint',
    // Bottom corners only — the top edge meets the photo on a straight line.
    radius: { tl: false, tr: false, bl: true, br: true },
    // 16px (`pl-4`/`pr-4`), not the design's `px-6`: this block sits directly
    // under the genre chip, and 16 is the chip's own text inset — so the album
    // art lines up with the word in the chip rather than sitting 10px right of
    // it. Without the horizontal pair at all, the art ran into the rail's left
    // edge and `FULL PLAYLIST →` into its right.
    // Vertical padding is 2 — set here rather than in the UI because THIS
    // SCRIPT IS THE SOURCE OF TRUTH: every `WIPE=1` run replaces
    // `draft_sections` wholesale, so a value changed in the section editor is
    // silently reverted on the next seed. Anything meant to stick belongs here.
    //
    // Left/right stay at 4 (16px) on purpose: that is what lines the album art
    // up with the word in the genre chip above it. Dropping them to 2 would
    // break that alignment.
    padding: { top: '2', bottom: '2', left: '4', right: '4' },
    data: dataSection({
      source: SOURCES.playlist,
      // THE GRID. Three tracks — art | stack | button — over four rows:
      //
      //   row 1 │ NOW PLAYING · 11:47 pm        ·        FULL PLAYLIST →
      //   row 2 │ [ art ] │ title              │ [ play ]
      //   row 3 │   ⋮     │ artist             │    ⋮
      //   row 4 │   ⋮     │ album · year · label│   ⋮
      //
      // Column ORDER is load-bearing: the cells auto-flow, and the two
      // row-spanning cells (art, play) have to be placed before the lines that
      // flow past them. Previously this section declared `cellsGridSize: 4`
      // over a TWO-track template, so four cells wrapped into 2×2 and the track
      // title sat beside its own metadata.
      columns: [
        // Row 1 — the label row.
        {
          name: 'now_indicator', origin: 'static', staticValue: '', type: 'now_indicator',
          show: true, hideHeader: true, cellSpan: 2,
          // The design is careful that the two live claims differ: the show
          // block above says ON AIR, this one says NOW PLAYING.
          pillLabel: 'Now playing', metaPrefix: '',
        },
        {
          name: 'full_playlist_link', origin: 'static', staticValue: 'Full playlist →',
          show: true, hideHeader: true, valueFontStyle: 'npLink',
          isLink: true, location: '/playlist',
        },
        // Rows 2–4 — the content row.
        { name: 'album_cover', show: true, hideHeader: true, type: 'image', imageSize: 'imgArt', cellRowSpan: 3, cellPadding: 0 },
        { name: 'title', show: true, hideHeader: true, valueFontStyle: 'npTitle' },
        {
          name: 'stream_player', origin: 'static', staticValue: '', type: 'stream_player',
          show: true, hideHeader: true, cellRowSpan: 3,
        },
        { name: "nullif(artist_name, '') as artist_line", normalName: 'artist_line', origin: 'calculated-column', show: true, hideHeader: true, valueFontStyle: 'npArtist' },
        // `ALBUM · YEAR · LABEL` — its own line, not folded in with the artist.
        { name: "nullif(concat_ws(' · ', album, left(release_date, 4), label), '') as release_line", normalName: 'release_line', origin: 'calculated-column', show: true, hideHeader: true, valueFontStyle: 'npMeta' },
        { name: 'received_at', show: true, selectOnly: true, sort: 'desc' },
      ],
      filters: [{ col: 'kind', op: 'filter', value: ['matched'] }],
      display: {
        pageSize: 1, usePagination: false, fetchMode: 'force',
        // Track 3 is 124px, not the button's 60: it also carries the
        // `FULL PLAYLIST →` link on row 1, which wrapped to three lines in a
        // 60px track. `stream_player` centres itself, so the wider track costs
        // the button nothing.
        // `plain` — this section paints its own `--bg-2`; the default card
        // style would overpaint it with `--card-bg`, which is what made the
        // genre chip above look like a different colour.
        cardStyle: 'plain',
        cellsGridSize: 3, cellsTracksTemplate: '104px minmax(0,1fr) 124px',
        cellsGridGap: 20, cellsRowGap: 4, cellsPadding: 0, cellsVAlign: 'center',
        cardBorder: false, cardsPadding: 0,
      },
    }),
  },
];

/** The shared footer — the design's INVERTED card.
 *
 *  It flips the mode (a light block on the dark site) so the foot of the page
 *  reads as a separate object rather than more page — that is the section's
 *  whole visual job, and it was the biggest thing missing.
 *
 *  Three tiers, as the design lays them out: a left column carrying the
 *  station's own voice (eyebrow → headline → paragraph), two link columns to
 *  its right, then a hairline and a colophon split to the two edges.
 *
 *  NB the columns are a single 3-track grid rather than the design's
 *  `[1.4fr_1fr]` with a nested 2-up inside it: a lexical layout container
 *  inside a layout item is a nesting the editor does not handle predictably,
 *  and `1.4fr 0.5fr 0.5fr` lands in the same place visually.
 */
const footer = () => ({
  kind: 'lexical', size: '12', bg: 'inverted',
  radius: { tl: true, tr: true, bl: true, br: true },
  padding: { top: '8', bottom: '8', left: '8', right: '8' },
  data: lexical(
    lcontainer(
      'w-full !mt-0 grid-cols-1 md:grid-cols-[1.4fr_0.5fr_0.5fr] gap-10',
      litem(
        styled('footEyebrow', text('Stay tuned')),
        styled('footHeadline', text('Drop us your email.')),
        styled('footBody', text('Once-a-month dispatch from the studio — new shows, upcoming events, the occasional pledge drive. No spam, no algorithms.')),
      ),
      litem(
        styled('footListHead', text('Listen')),
        styled('footLink', text('Live stream')),
        styled('footLink', text('Schedule')),
        styled('footLink', text('Recent spins')),
        styled('footLink', text('Shows')),
      ),
      litem(
        styled('footListHead', text('Station')),
        styled('footLink', text('About')),
        styled('footLink', text('Pledge')),
        styled('footLink', text('Volunteer')),
        styled('footLink', text('Contact')),
      ),
    ),
    hr(),
    lcontainer(
      'w-full !mt-0 grid-cols-2 gap-3',
      litem(styled('footColophon', text('WCDB · 90.9 FM · SUNY Albany'))),
      litem(styled('footColophonEnd', text('© 1977–2026 · A student broadcast'))),
    ),
  ),
});

/** A public page header: eyebrow + big display title + lede. */
const pageHead = (eyebrow, title, lede) =>
  lexical(
    styled('caption', text(eyebrow)),
    head('h1', title),
    ...(lede ? [styled('bodySmall', text(lede))] : []),
  );

/* ── the pages ────────────────────────────────────────────────────────────── */

const SCHEDULE_TRACKS = '80px minmax(0,1fr) 150px 130px';
const SPIN_TRACKS = '58px 44px minmax(0,1fr) 150px';

/* The schedule's seven day groups, in the dataset's own order: **0 = Monday …
 * 6 = Sunday** (`wcdb-migrate/transform.mjs`, chosen to match the admin week
 * grid, which is `weekStartsOn: 'Mon'`). Labelled Sunday-first here previously,
 * which put every day's shows under the wrong heading. */
const WEEKDAYS = [
  { day: 0, label: 'Monday' }, { day: 1, label: 'Tuesday' }, { day: 2, label: 'Wednesday' },
  { day: 3, label: 'Thursday' }, { day: 4, label: 'Friday' }, { day: 5, label: 'Saturday' },
  { day: 6, label: 'Sunday' },
];

/* The executive board's six groups, in the design's order.
 *
 * The counts are the design's own (`04 ROLES`) and are written out here rather
 * than queried, because they belong to the group HEADER — a lexical section —
 * and a lexical cannot read the Card's row count. They match the 25 roles the
 * migration extracted (4+6+8+2+4+1). If the station adds a role through the
 * admin page the tile appears immediately and only this label goes stale;
 * closing that gap properly means a count-aware header, which is a primitive
 * the ledger already tracks. */
const BOARD_DEPARTMENTS = [
  { department: 'Chief Administrators', count: '04 roles' },
  { department: 'Music Department', count: '06 roles' },
  { department: 'Publicity Department', count: '08 roles' },
  { department: 'News & Sports Department', count: '02 roles' },
  { department: 'Engineering Department', count: '04 roles' },
  { department: 'DJ Training Department', count: '01 role' },
];

const pages = [
  /* ═══ home ══════════════════════════════════════════════════════════════ */
  {
    slug: 'home',
    title: 'Home',
    index: 0,
    filters: [],
    sections: [
      { kind: 'lexical', data: pageHead('WCDB Albany 90.9FM', 'WCDB Albany 90.9FM',
        'Student-run college radio at SUNY Albany. Forty-eight years on a hairline of the FM band, plus a streaming signal anyone, anywhere can pick up.') },

      // Today on air — the schedule strip. The design's row is
      // `[glyph][time][title over host][status]`, not four table columns: the
      // department is a GLYPH in the leading column so the eye can scan the
      // list by kind without reading a genre label on every line.
      ...listCardPublic({
        title: 'On now & up next', titleMeta: '', link: 'Full schedule →', linkPath: '/schedule',
        tracks: '34px 64px minmax(0,1fr) max-content',
        headers: null,
        source: SOURCES.schedule, join: djsJoin,
        columns: [
          // `formatFn: 'icon'` renders the theme's registered glyph for the
          // value — the `icon` column on `shows` already holds those names.
          // The glyph rides in a 34px disc, as the design draws it. The circle
          // is the `valueFontStyle` token — it lands on the value div, which is
          // the box wrapping the icon.
          { name: 'shows.icon', normalName: 'icon', show: true, hideHeader: true, formatFn: 'icon', hideIconLabel: true, iconClassName: 'size-[16px]', valueFontStyle: 'glyphDisc', cellRowSpan: 2 },
          { name: `to_char(NULLIF(ds."start",'')::time, 'FMHH12 am') as start_label`, normalName: 'start_label', origin: 'calculated-column', show: true, hideHeader: true, valueFontStyle: 'stripTime', cellRowSpan: 2 },
          { name: 'shows.name', normalName: 'name', show: true, hideHeader: true, valueFontStyle: 'stripTitle', isLink: true, location: '/show', searchParams: 'show_id' },
          // The right-hand column is a STATUS in the design — `Live` on the row
          // that is on air, a countdown on the ones still to come — not the
          // department, which the design does not put on this row at all.
          {
            name: `(CASE
                      WHEN ${LOCAL_NOW}::time >= NULLIF(ds."start",'')::time
                       AND ${LOCAL_NOW}::time <  NULLIF(ds."end",'')::time THEN 'Live'
                      WHEN NULLIF(ds."start",'')::time > ${LOCAL_NOW}::time
                        THEN concat('in ', to_char(NULLIF(ds."start",'')::time - ${LOCAL_NOW}::time, 'FMHH24"h" FMMI"m"'))
                      ELSE ''  -- unreachable: past airings are filtered out
                    END) as airing_status`,
            normalName: 'airing_status', origin: 'calculated-column', show: true, hideHeader: true,
            // `status_pill` so the LIVE row carries the station's on-air red
            // (`status_bad` → `--on-air` on `--on-air-soft`). Only exact values
            // can be mapped, and the countdowns are generated, so they fall
            // through the column type's default to the quiet bordered
            // `status_na` — the design draws those as plain text, so this is a
            // small, deliberate deviation in exchange for the red on the one
            // row that matters.
            type: 'status_pill', pillColors: { Live: 'status_bad' },
            justify: 'right', cellRowSpan: 2,
          },
          // Row 2 — the host, under the show name. No spacer cells: the glyph,
          // time and status each span both rows, so the ONLY free slot on row 2
          // is the title's own track and auto-flow puts the host there.
          { name: "nullif(concat('w/ ', djs.on_air_name), 'w/ ') as strip_host", normalName: 'strip_host', origin: 'calculated-column', show: true, hideHeader: true, valueFontStyle: 'stripHost' },
          { name: 'show_id', show: true, selectOnly: true },
          { name: 'day', show: true, selectOnly: true },
          { name: `ds."start"`, normalName: 'start_sort', show: true, selectOnly: true, sort: 'asc' },
          // The calc column lives in `columns`; the filter leaf references it by
          // ALIAS. A leaf whose `col` carries the `as <alias>` suffix is dropped
          // into the WHERE clause verbatim — `syntax error at or near "as"`.
          { name: `(CASE WHEN ds.day = ${TODAY_DAY} THEN 'yes' ELSE 'no' END) as is_today`,
            normalName: 'is_today', origin: 'calculated-column', show: true, selectOnly: true },
          // …and only the ones that have not finished. The design is explicit
          // that "this card's job is the next few hours, not the week", and a
          // list led by shows that ended this morning is not that.
          { name: `(CASE WHEN NULLIF(ds."end",'')::time > ${LOCAL_NOW}::time THEN 'yes' ELSE 'no' END) as still_to_come`,
            normalName: 'still_to_come', origin: 'calculated-column', show: true, selectOnly: true },
        ],
        // Only today's airings. NB `extract(dow …)` is 0 = Sunday but this
        // dataset's `day` is 0 = Monday, so the comparison goes through
        // TODAY_DAY rather than against the raw dow.
        // Text, not a boolean — the filter compares against string values, so
        // `= true` would match nothing.
        filters: [
          { col: 'is_today', op: 'filter', value: ['yes'] },
          { col: 'still_to_come', op: 'filter', value: ['yes'] },
        ],
        display: {
          pageSize: 8, usePagination: false, fetchMode: 'smart', cellsRowGap: 2,
          // `cardsPadding` is emitted INLINE on the row grid, so the `px-6` that
          // `adminRow` carries as a class never applies — `listCardPublic`
          // zeroes it by default and the glyph disc ended up flush against the
          // card's rounded edge, clipped by it. A CSS shorthand passes straight
          // through, so this restores the horizontal inset without touching the
          // vertical rhythm (`adminRow`'s `min-h` + centring still own that).
          cardsPadding: '14px 24px',
          // Wash the on-air row in the station's red. The design tints the whole
          // row rather than relying on the pill alone.
          highlightColumn: 'airing_status', highlightValue: 'Live',
        },
        // No footnote — the design's strip does not have one. `listCardPublic`
        // skips the footer section entirely when this is empty.
        footer: '',
      }),

      // From the blog — ONE featured post given the room the design gives it:
      // a kicker, a 44px headline, the excerpt, and an artwork block down the
      // right. Not the three-row table this was.
      {
        kind: 'Card',
        bg: 'white', border: { top: true, right: true, bottom: true, left: true },
        radius: { tl: true, tr: true, bl: true, br: true }, padding: { top: '8', bottom: '8' },
        data: dataSection({
          source: SOURCES.posts,
          columns: [
            { name: "upper(concat_ws(' · ', category, published_at, nullif(concat('By ', author_name), 'By '))) as post_kicker", normalName: 'post_kicker', origin: 'calculated-column', show: true, hideHeader: true, valueFontStyle: 'tileEyebrow' },
            // The artwork block — a gradient cell spanning all three rows down
            // the right, which is what `cellBgColor` taking a gradient buys.
            // The design draws generated art here, not a photograph.
            {
              name: 'feature_art', origin: 'static', staticValue: '', show: true, hideHeader: true,
              cellBgColor: 'linear-gradient(150deg, oklch(0.30 0.04 40), oklch(0.55 0.10 55))',
              cellRowSpan: 4, cellPadding: 0, cellPaddingTop: 300,
            },
            { name: 'title', show: true, hideHeader: true, valueFontStyle: 'featureTitle' },
            { name: 'excerpt', show: true, hideHeader: true, valueFontStyle: 'featureBody' },
            // The design closes the column with a read-through link.
            { name: 'feature_read', origin: 'static', staticValue: 'Read the dispatch', show: true, hideHeader: true, valueFontStyle: 'featureLink', isLink: true, location: '/blog' },
            { name: 'published_at', show: true, selectOnly: true, sort: 'desc' },
          ],
          filters: [
            { col: 'status', op: 'filter', value: ['published'] },
            { col: 'featured', op: 'filter', value: ['true'] },
          ],
          display: {
            pageSize: 1, usePagination: false, fetchMode: 'smart',
            cellsGridSize: 2, cellsTracksTemplate: 'minmax(0,1fr) 240px',
            cellsGridGap: 32, cellsRowGap: 14, cellsPadding: 0, cardBorder: false,
          },
        }),
      },

      // What's on — a 3-up grid of event tiles led by a big day number, which
      // is how the design sets them. Was a 3-column table.
      ...gridCardPublic({
        eyebrow: 'Off the air', title: 'In-person, this spring',
        count: 'All events →', countPath: '/events', gridSize: 3,
        source: SOURCES.events,
        columns: [
          { name: `to_char(date::date, 'DD') as day_num`, normalName: 'day_num', origin: 'calculated-column', show: true, hideHeader: true, valueFontStyle: 'eventDay' },
          { name: `upper(concat_ws(' · ', to_char(date::date, 'Mon'), to_char(date::date, 'Dy'), time)) as when_line`, normalName: 'when_line', origin: 'calculated-column', show: true, hideHeader: true, valueFontStyle: 'tileMeta' },
          { name: 'title', show: true, hideHeader: true, valueFontStyle: 'eventTitle', cellMarginTop: 10 },
          { name: "concat_ws(' · ', venue, coalesce(nullif(price, ''), 'Free')) as where_line", normalName: 'where_line', origin: 'calculated-column', show: true, hideHeader: true, valueFontStyle: 'eventWhere' },
          { name: 'date', show: true, selectOnly: true, sort: 'asc' },
          // The calc column lives HERE and the filter below references it by
          // ALIAS — a leaf whose `col` carries the `as <alias>` suffix goes into
          // the WHERE clause verbatim and dies with `syntax error at or near "as"`.
          { name: `(CASE WHEN date::date >= current_date THEN 'upcoming' ELSE 'past' END) as home_bucket`, normalName: 'home_bucket', origin: 'calculated-column', show: true, selectOnly: true },
        ],
        filters: [
          { col: 'status', op: 'filter', value: ['published'] },
          { col: 'home_bucket', op: 'filter', value: ['upcoming'] },
        ],
        // `tileSoft`: the design puts the event tiles on `--card-bg-soft` at a
        // 14px radius, a step lighter than the board's inset role tiles.
        display: { pageSize: 3, cardStyle: 'tileSoft' },
      }),

      // The station in numbers. Every figure is a real count — the design's
      // "184 listeners" is the one it cannot be (no listener telemetry), so it
      // is not shown rather than invented.
      //
      // The `Right now` eyebrow is a fused lexical above the figures, because
      // it labels the STRIP rather than any one of them.
      {
        kind: 'lexical', ...fusedTop, padding: { top: '8', bottom: '0' },
        data: lexical(styled('caption', text('Right now'))),
      },
      {
        kind: 'Card', ...fusedEnd, padding: { top: '5', bottom: '8' },
        data: dataSection({
          source: SOURCES.playlist,
          columns: [
            { name: "count(*) FILTER (WHERE received_at > now() - interval '7 days') as spins_week", normalName: 'spins_week', origin: 'calculated-column', show: true, customName: 'Spins this week', valueFontStyle: 'statValue', headerFontStyle: 'statLabel', headerValueLayout: 'col' },
            { name: "(extract(year from now())::int - 1977) as years_on_air", normalName: 'years_on_air', origin: 'calculated-column', show: true, customName: 'Years on air', valueFontStyle: 'statValue', headerFontStyle: 'statLabel' },
            { name: 'count(distinct title) as distinct_tracks', normalName: 'distinct_tracks', origin: 'calculated-column', show: true, customName: 'Tracks logged', valueFontStyle: 'statValue', headerFontStyle: 'statLabel' },
          ],
          display: {
            pageSize: 1, usePagination: false, fetchMode: 'smart',
            cellsGridSize: 3, cellsGridGap: 24, cardBorder: false, headerValueLayout: 'col',
            // The design puts the FIGURE above its label; the Card's default is
            // label-above-value. `reverse` is gated on `headerValueLayout: 'col'`
            // (Card.config.jsx `displayCdn`), which is why both keys are here.
            reverse: true,
          },
        }),
      },
      footer(),
    ],
  },

  /* ═══ schedule ══════════════════════════════════════════════════════════ */
  {
    slug: 'schedule',
    title: 'Schedule',
    index: 1,
    // `day` is live again — the design's "Filter by day" card drives it, and a
    // single list reacts to it. (It was briefly dead while the page was seven
    // stacked day sections, and an unconsumed variable is not free: it
    // serialises into the URL, so links arrived as `/schedule?day=`.)
    filters: [{ id: 'wcdb-pub-day', searchKey: 'day', values: '', useSearchParams: true }],
    sections: [
      { kind: 'lexical', data: pageHead('On air', 'The week.', 'Every show on 90.9, in the order it airs. 69 airings across seven days.') },
      // ── The design's "Filter by day" card ────────────────────────────
      // Seven tiles, each a `filter_pill` that writes the page's `day`
      // variable, with the airing count for that day underneath. The same
      // segmented-control primitive the admin pages use — this is what the
      // page was missing, and it replaces seven stacked day lists with one
      // list the reader steers.
      {
        kind: 'lexical', ...fusedTop, padding: { top: '6', bottom: '2' },
        data: lexical(styled('caption', text('Filter by day'))),
      },
      {
        kind: 'Card', ...fusedEnd, padding: { top: '0', bottom: '5' },
        data: dataSection({
          source: SOURCES.schedule,
          columns: [
            dayPill({ label: 'All week', paramValue: '', alias: 'all_days', expr: 'count(*)', activeWhenUnset: true }),
            ...WEEKDAYS.map(({ day, label }) => dayPill({
              label, paramValue: String(day), alias: `day_${day}`,
              expr: `count(*) FILTER (WHERE ds.day = ${day})`,
            })),
          ],
          display: {
            pageSize: 1, fetchMode: 'smart',
            cellsGridSize: 8, cellsGridGap: 8, cellsPadding: 0,
            cardsPadding: 0, cardBorder: false, cardStyle: 'plain',
          },
        }),
      },

      // ── One list, steered by that filter ─────────────────────────────
      // The design shows a single day (`card:friday-shows`); with nothing
      // picked this widens to the whole week, which is what the filter card's
      // own "All week" tile says it will do.
      ...listCardPublic({
        eyebrow: 'On air', title: 'The week', link: 'Subscribe iCal →',
        tracks: '34px 92px minmax(0,1fr) 130px',
        headers: null,
        source: SOURCES.schedule, join: djsJoin,
        columns: [
          { name: 'shows.icon', normalName: 'icon', show: true, hideHeader: true, formatFn: 'icon', hideIconLabel: true, iconClassName: 'size-[16px]', valueFontStyle: 'glyphDisc', cellRowSpan: 2 },
          {
            name: `upper(concat_ws(' · ', (CASE ds.day WHEN 0 THEN 'Mon' WHEN 1 THEN 'Tue' WHEN 2 THEN 'Wed' WHEN 3 THEN 'Thu' WHEN 4 THEN 'Fri' WHEN 5 THEN 'Sat' WHEN 6 THEN 'Sun' END), to_char(NULLIF(ds."start",'')::time, 'FMHH12 am'))) as when_label`,
            normalName: 'when_label', origin: 'calculated-column', show: true, hideHeader: true,
            valueFontStyle: 'stripTime', cellRowSpan: 2,
          },
          { name: 'shows.name', normalName: 'name', show: true, hideHeader: true, valueFontStyle: 'stripTitle', isLink: true, location: '/show', searchParams: 'show_id' },
          { name: 'shows.department', normalName: 'department', show: true, hideHeader: true, valueFontStyle: 'stripStatus', justify: 'right', cellRowSpan: 2 },
          { name: "nullif(concat('w/ ', djs.on_air_name), 'w/ ') as sched_host", normalName: 'sched_host', origin: 'calculated-column', show: true, hideHeader: true, valueFontStyle: 'stripHost' },
          { name: 'show_id', show: true, selectOnly: true },
          { name: 'day', show: true, selectOnly: true, sort: 'asc' },
          { name: `ds."start"`, normalName: 'start_sort', show: true, selectOnly: true, sort: 'asc' },
        ],
        filters: [{ col: 'day', op: 'filter', value: [], usePageFilters: true, searchParamKey: 'day' }],
        display: {
          pageSize: 100, usePagination: false, fetchMode: 'smart',
          cellsRowGap: 2, cardsPadding: '14px 24px',
        },
        footer: '',
      }),
      footer(),
    ],
  },

  /* ═══ djs ═══════════════════════════════════════════════════════════════ */
  {
    slug: 'djs',
    title: 'DJs',
    index: 2,
    filters: [
      { id: 'wcdb-pub-dj-dept', searchKey: 'department', values: '', useSearchParams: true },
      { id: 'wcdb-pub-dj-search', searchKey: 'search', values: '', useSearchParams: true },
    ],
    sections: [
      { kind: 'lexical', data: pageHead('On the roster', 'The DJs.', 'Eighty-four people currently on air, out of eight hundred and ninety-one who have been.') },
      // A 3-up tile grid, not a table (Phase 5 · C1). Each tile is the design's
      // DJ card: the handle in mono over the on-air name, the real name, and a
      // footer line naming the department and when they joined.
      ...gridCardPublic({
        title: 'On air now', count: 'Current DJs', gridSize: 3,
        source: SOURCES.djs,
        columns: [
          // `@HALFTONE` — the design's mono handle above the name. A derived
          // presentation of a column the dataset already has, so rung 2.
          { name: "concat('@', upper(replace(on_air_name, ' ', ''))) as handle", normalName: 'handle', origin: 'calculated-column', show: true, hideHeader: true, valueFontStyle: 'tileEyebrow' },
          { name: 'on_air_name', show: true, hideHeader: true, valueFontStyle: 'cardTitle' },
          { name: "nullif(trim(concat_ws(' ', first_name, last_name)), '') as real_name", normalName: 'real_name', origin: 'calculated-column', show: true, hideHeader: true, valueFontStyle: 'tileBody' },
          // `JAZZ · JOINED 2018` — the design's footer line. The roster's join
          // date is `started`, and it is TEXT of uneven shape, so the year is
          // taken with a regex rather than a cast that would throw on the rows
          // that hold something else. A DJ missing either half still gets a
          // clean single-value line rather than a stray separator — that is
          // what `concat_ws` over `nullif` buys.
          { name: "upper(nullif(concat_ws(' · ', nullif(department, ''), nullif(concat('Joined ', substring(started from '\\d{4}')), 'Joined ')), '')) as roster_line", normalName: 'roster_line', origin: 'calculated-column', show: true, hideHeader: true, valueFontStyle: 'tileMeta' },
          { name: 'dj_id', show: true, selectOnly: true },
          { name: 'on_air_name', normalName: 'on_air_sort', show: true, selectOnly: true, sort: 'asc' },
        ],
        filters: [
          { col: 'status', op: 'filter', value: ['current'] },
          { col: 'department', op: 'filter', value: [], usePageFilters: true, searchParamKey: 'department' },
          { op: 'OR', groups: ['on_air_name', 'first_name', 'last_name'].map((col) => ({ col, op: 'like', value: [], usePageFilters: true, searchParamKey: 'search' })) },
        ],
        display: { pageSize: 60, usePagination: true },
        footer: 'Alumni are kept — the roster is a forty-year archive',
      }),
      footer(),
    ],
  },

  /* ═══ spins — the public play log (the design's spins.html) ═════════════ */
  {
    slug: 'playlist',
    title: 'Playlist',
    index: 3,
    filters: [],
    sections: [
      { kind: 'lexical', data: pageHead('Recently played', 'Spins.', 'Everything 90.9 has played, newest first — logged automatically off the stream.') },
      ...listCardPublic({
        title: 'Recent spins', titleMeta: 'Newest first', link: '',
        tracks: SPIN_TRACKS,
        headers: ['Time', '', 'Track', 'Played'],
        source: SOURCES.playlist,
        columns: [
          { name: `to_char(received_at, 'HH24:MI') as played_at`, normalName: 'played_at', origin: 'calculated-column', show: true, hideHeader: true, valueFontStyle: 'rowMono' },
          { name: 'album_cover', show: true, hideHeader: true, type: 'image', imageSize: 'imgFill', cellRowSpan: 2 },
          { name: 'title', show: true, hideHeader: true, valueFontStyle: 'rowTitle' },
          { name: `to_char(received_at, 'Dy DD Mon') as played_on`, normalName: 'played_on', origin: 'calculated-column', show: true, hideHeader: true, valueFontStyle: 'rowMeta' },
          { name: 'row2_spacer_spins', origin: 'static', staticValue: '', show: true, hideHeader: true },
          { name: `nullif(concat_ws(' · ', artist_name, album, left(release_date, 4)), '') as track_meta`, normalName: 'track_meta', origin: 'calculated-column', show: true, hideHeader: true, valueFontStyle: 'rowMeta', cellSpan: 2 },
          { name: 'received_at', show: true, selectOnly: true, sort: 'desc' },
        ],
        // The public log shows what the station played — not the matcher's
        // unidentified stretches, which are an editorial problem, not content.
        filters: [{ col: 'kind', op: 'filter', value: ['matched'] }],
        display: { pageSize: 50, usePagination: true, fetchMode: 'force' },
        footer: 'Logged automatically off the stream every 30 seconds',
      }),
      footer(),
    ],
  },

  /* ═══ events ════════════════════════════════════════════════════════════ */
  {
    slug: 'events',
    title: 'Events',
    index: 4,
    filters: [],
    sections: [
      { kind: 'lexical', data: pageHead('Out of the studio', 'Events.', 'Shows, pledge drives and the occasional record fair.') },
      // The design splits UPCOMING from PAST — same columns, opposed date
      // filters, and the past list dimmed rather than dropped (the station
      // keeps its record). Two sections, no code: rung 4.
      ...eventsList({ title: 'Upcoming', meta: '', sortDir: 'asc', bucket: 'upcoming', footer: '' }),
      ...eventsList({
        title: 'Past', meta: 'Kept on the record', sortDir: 'desc', bucket: 'past', dim: true,
        footer: 'Past events are kept on the station’s record, never deleted',
      }),
      footer(),
    ],
  },

  /* ═══ station info ══════════════════════════════════════════════════════ */
  {
    slug: 'station_info',
    title: 'Station Info',
    index: 5,
    filters: [],
    sections: [
      { kind: 'lexical', data: pageHead('Contact', 'Station info.',
        'WCDB Albany 90.9 FM · Campus Center 316, 1400 Washington Avenue, Albany NY 12222 · Request line (518) 442-4242') },
      { kind: 'lexical', data: lexical(styled('caption', text('Term 1 May 2026 – 1 May 2027')), head('h2', 'Executive board.')) },
      // The board is SIX GROUP CARDS, each a 2-up grid of role tiles — not one
      // flat table with the department repeated down a column. See Phase 5's
      // worked measurement: as a table this section came out at 47% of the
      // design's height. A Card cannot emit per-group headers, so each
      // department is its own filtered section pair.
      ...BOARD_DEPARTMENTS.flatMap(({ department, count }) =>
        gridCardPublic({
          title: department, count, gridSize: 2,
          source: SOURCES.administrators,
          columns: [
            { name: 'position', show: true, hideHeader: true, valueFontStyle: 'tileEyebrow' },
            // A vacant role still gets a tile — the design shows the role and
            // the department address, which is the point of listing it.
            { name: "coalesce(nullif(holder_name, ''), 'Not listed') as holder_display", normalName: 'holder_display', origin: 'calculated-column', show: true, hideHeader: true, valueFontStyle: 'cardTitle' },
            // The address is deliberately BROKEN UP rather than printed whole
            // and never linked: the legacy page obfuscates it
            // (`name[at]wcdbfm[dot]com`) as an anti-spam measure, and the
            // design's readable form has to keep a strategy of its own. This one
            // is not a mailto and not a contiguous string in the DOM.
            { name: `nullif(replace(replace(email, '@', ' [at] '), '.com', ' [dot] com'), '') as email_display`, normalName: 'email_display', origin: 'calculated-column', show: true, hideHeader: true, valueFontStyle: 'tileMono' },
            { name: "coalesce(nullif(office_hours, ''), '–') as hours_display", normalName: 'hours_display', origin: 'calculated-column', show: true, hideHeader: true, valueFontStyle: 'tileMeta' },
            { name: 'sort', show: true, selectOnly: true, sort: 'asc' },
          ],
          filters: [{ col: 'department', op: 'filter', value: [department] }],
          display: { pageSize: 12 },
        })),
      { kind: 'lexical', data: lexical(styled('label', text('A role listed without a name is one nobody currently holds — the department address still reaches someone'))) },
      footer(),
    ],
  },

  /* ═══ show — one show, reached from the schedule ════════════════════════ */
  {
    slug: 'show',
    title: 'Show',
    index: 6,
    hideInNav: true,
    filters: [{ id: 'wcdb-pub-show-id', searchKey: 'show_id', values: '', useSearchParams: true }],
    sections: [
      { kind: 'lexical', data: lexical(styled('label', text('Schedule  ›  Show'))) },
      // The show itself.
      {
        kind: 'Card',
        bg: 'white', border: { top: true, right: true, bottom: true, left: true },
        radius: { tl: true, tr: true, bl: true, br: true }, padding: { top: '6', bottom: '6' },
        data: dataSection({
          source: SOURCES.shows,
          join: {
            operator: '=',
            sources: {
              djs: {
                source: SOURCES.djs.source_id, view: SOURCES.djs.view_id,
                env: 'wcdb-dama', srcEnv: 'wcdb-dama', type: 'left', mergeStrategy: 'join',
                joinColumns: [{ dsColumn: 'dj_id', joinSourceColumn: 'dj_id' }],
                sourceInfo: SOURCES.djs,
              },
            },
          },
          columns: [
            { name: 'ds.name', normalName: 'name', show: true, hideHeader: true, valueFontStyle: 'h1' },
            // `department` is on shows AND on djs — bare, it is ambiguous under
            // the join. The base table is `ds`.
            { name: "upper(concat_ws(' · ', ds.department, djs.on_air_name)) as show_meta", normalName: 'show_meta', origin: 'calculated-column', show: true, hideHeader: true, valueFontStyle: 'caption' },
            { name: 'ds.description', normalName: 'description', show: true, hideHeader: true, valueFontStyle: 'body' },
            { name: 'djs.bio', normalName: 'host_bio', show: true, customName: 'About the host', headerFontStyle: 'label', valueFontStyle: 'bodySmall' },
            { name: 'ds.show_id', normalName: 'show_id', show: true, selectOnly: true },
          ],
          filters: [{ col: 'show_id', op: 'filter', value: [], usePageFilters: true, searchParamKey: 'show_id' }],
          display: { pageSize: 1, usePagination: false, fetchMode: 'smart', cellsGridSize: 1, cellsGridGap: 10, cardBorder: false },
        }),
      },
      // When it airs.
      ...listCardPublic({
        title: 'When it airs', titleMeta: '', link: 'Full schedule →',
        tracks: '110px minmax(0,1fr)',
        headers: ['Day', 'Time'],
        source: SOURCES.schedule,
        columns: [
          // No join on this card, so there is no `ds` alias to qualify with —
          // `missing FROM-clause entry for table "ds"`.
          { name: `(CASE day WHEN 0 THEN 'Sunday' WHEN 1 THEN 'Monday' WHEN 2 THEN 'Tuesday' WHEN 3 THEN 'Wednesday' WHEN 4 THEN 'Thursday' WHEN 5 THEN 'Friday' WHEN 6 THEN 'Saturday' END) as day_label`, normalName: 'day_label', origin: 'calculated-column', show: true, hideHeader: true, valueFontStyle: 'rowMeta' },
          { name: `concat("start", ' – ', "end") as slot`, normalName: 'slot', origin: 'calculated-column', show: true, hideHeader: true, valueFontStyle: 'rowMono' },
          { name: 'day', show: true, selectOnly: true, sort: 'asc' },
        ],
        filters: [{ col: 'show_id', op: 'filter', value: [], usePageFilters: true, searchParamKey: 'show_id' }],
        display: { pageSize: 10, usePagination: false, fetchMode: 'smart' },
        footer: '',
      }),
      // Episodes, derived. See the note in the task file: the exact version of
      // this needs the play log TAGGED with the show that was on air. Until
      // then an "episode" is what played inside this show's airing window, and
      // the window is a day-of-week + time-of-day filter, not a show id.
      ...listCardPublic({
        title: 'Recently played on this show', titleMeta: 'Derived from the play log', link: 'All spins →',
        tracks: '120px 44px minmax(0,1fr)',
        headers: ['When', '', 'Track'],
        source: SOURCES.playlist,
        columns: [
          { name: `to_char(received_at, 'Dy DD Mon HH24:MI') as played_at`, normalName: 'played_at', origin: 'calculated-column', show: true, hideHeader: true, valueFontStyle: 'rowMono' },
          { name: 'album_cover', show: true, hideHeader: true, type: 'image', imageSize: 'imgFill' },
          { name: 'title', show: true, hideHeader: true, valueFontStyle: 'rowTitle' },
          { name: 'received_at', show: true, selectOnly: true, sort: 'desc' },
        ],
        filters: [{ col: 'kind', op: 'filter', value: ['matched'] }],
        display: { pageSize: 12, usePagination: false, fetchMode: 'smart' },
        footer: 'Until the play log records which show was on air, this is the station’s recent log rather than this show’s',
      }),
      footer(),
    ],
  },

  /* ═══ blog ══════════════════════════════════════════════════════════════ */
  {
    slug: 'blog',
    title: 'Blog',
    index: 7,
    filters: [{ id: 'wcdb-pub-post-cat', searchKey: 'category', values: '', useSearchParams: true }],
    sections: [
      { kind: 'lexical', data: pageHead('Dispatches', 'The blog.', 'Dispatches, interviews, liner notes and the studio diary.') },
      // The featured post, given the room the design gives it.
      {
        kind: 'Card',
        bg: 'white', border: { top: true, right: true, bottom: true, left: true },
        radius: { tl: true, tr: true, bl: true, br: true }, padding: { top: '6', bottom: '6' },
        data: dataSection({
          source: SOURCES.posts,
          columns: [
            { name: "upper(concat_ws(' · ', category, published_at, nullif(concat('By ', author_name), 'By '))) as post_meta", normalName: 'post_meta', origin: 'calculated-column', show: true, hideHeader: true, valueFontStyle: 'caption' },
            { name: 'title', show: true, hideHeader: true, valueFontStyle: 'h2' },
            { name: 'body', show: true, hideHeader: true, valueFontStyle: 'body' },
            { name: 'published_at', show: true, selectOnly: true, sort: 'desc' },
          ],
          filters: [
            { col: 'status', op: 'filter', value: ['published'] },
            { col: 'featured', op: 'filter', value: ['true'] },
          ],
          display: { pageSize: 1, usePagination: false, fetchMode: 'smart', cellsGridSize: 1, cellsGridGap: 10, cardBorder: false },
        }),
      },
      // A 2-up tile grid, not a table (Phase 5 · C1).
      ...gridCardPublic({
        title: 'Everything else', count: '', gridSize: 2,
        source: SOURCES.posts,
        columns: [
          { name: "upper(concat_ws(' · ', category, published_at)) as post_kicker", normalName: 'post_kicker', origin: 'calculated-column', show: true, hideHeader: true, valueFontStyle: 'tileEyebrow' },
          { name: 'title', show: true, hideHeader: true, valueFontStyle: 'cardTitle' },
          { name: 'excerpt', show: true, hideHeader: true, valueFontStyle: 'tileBody' },
          // `BY MATEO CORDERO · 4 MIN READ`. Read time at 200 wpm, estimated
          // from the body's length rather than a word count — close enough for
          // a kicker, and it costs no extra column. `greatest(…, 1)` so a short
          // post reads "1 min read" rather than "0".
          { name: "upper(nullif(concat_ws(' · ', nullif(concat('By ', author_name), 'By '), concat(greatest(round(length(body) / 5.0 / 200.0), 1), ' min read')), '')) as byline", normalName: 'byline', origin: 'calculated-column', show: true, hideHeader: true, valueFontStyle: 'tileMeta' },
          { name: 'published_at', show: true, selectOnly: true, sort: 'desc' },
          { name: 'slug', show: true, selectOnly: true },
        ],
        filters: [
          { col: 'status', op: 'filter', value: ['published'] },
          { col: 'featured', op: 'filter', value: ['false'] },
          { col: 'category', op: 'filter', value: [], usePageFilters: true, searchParamKey: 'category' },
        ],
        display: { pageSize: 24, usePagination: true },
        footer: 'Eighteen years of dispatches live in the archive',
      }),
      footer(),
    ],
  },
];

/** One tile of the schedule's "Filter by day" card.
 *
 *  A `filter_pill` cell: it writes the page's `day` variable when clicked and
 *  renders active when the variable already holds its value. The same
 *  segmented-control primitive the admin pages use for their state filters —
 *  the count under each label comes from the calc expression, so the tiles say
 *  how many airings a day actually holds.
 */
// A `function`, not a `const` arrow — it is called while the `pages` array
// above is being built, and only declarations are hoisted. (Same trap as
// `trackCount` below.)
function dayPill({ label, paramValue, alias, expr, activeWhenUnset }) {
  return {
    name: `${expr} as ${alias}`,
    normalName: alias,
    origin: 'calculated-column',
    type: 'filter_pill',
    show: true,
    hideHeader: true,
    pillLabel: label,
    paramKey: 'day',
    paramValue,
    ...(activeWhenUnset ? { activeWhenUnset: true } : {}),
  };
}

/** Count the columns in a `grid-template-columns` string.
 *  Splitting on spaces alone breaks on functional values — `minmax(0, 1fr)`
 *  would count as two. This matches parenthesised groups as single tokens.
 *  Used instead of `headers.length` so a headerless list (`headers: null`)
 *  still knows how wide its cell grid is. */
// A `function` declaration, not a `const` arrow: `listCardPublic` is called
// while the `pages` array above is being built, which is before any const in
// this section has initialised. Only declarations are hoisted.
function trackCount(t) { return (String(t).match(/(?:[^\s()]+|\([^)]*\))+/g) || []).length; }

/** The public list card — same fused composition as the admin's, in the
 *  public bands. Declared after `pages` only because it is hoisted. */
function listCardPublic({ title, eyebrow, titleMeta, link, linkPath, tracks, headers, source, columns, filters, display = {}, join, footer: foot }) {
  return [
    {
      kind: 'lexical', ...fusedTop, padding: { top: '6', bottom: '0' },
      data: lexical(
        lcontainer(
          'w-full !mt-0 items-baseline grid-cols-[max-content_1fr_max-content] gap-x-4',
          // `cardHeading` (28px display italic) rather than `h4`: the design
          // gives a carded section's own title one step below the page hero,
          // and `h4` was rendering it noticeably small. With an eyebrow the
          // heading steps up again to 36px, as the design sets a section that
          // owns a whole band.
          litem(
            ...(eyebrow ? [styled('caption', text(eyebrow))] : []),
            styled(eyebrow ? 'sectionHeading' : 'cardHeading', text(title)),
          ),
          litem(styled('label', text(titleMeta || ''))),
          // A real anchor when `linkPath` is given — `styled()` renders text,
          // which looks like a link and cannot be clicked. The lexical button
          // node is the only node type that navigates; `style` names an entry
          // in `theme.button.styles[]`.
          litem(link && linkPath
            ? button(link, linkPath, 'metaLink')
            : styled('metaLink', text(link || ''))),
        ),
      ),
    },
    // The column-header strip is OPTIONAL: pass `headers: null` to omit it.
    // Not every list in the design has one — the home page's schedule strip is
    // headerless, because its rows are self-describing (a glyph, a time, a
    // title) and a `TIME / SHOW` band above them is just noise.
    ...(headers ? [{ kind: 'Card', ...fusedMid, data: staticRowSection({ source, tracks, cells: headers, valueFontStyle: 'colHead', keyColumn: source.columns[0].name }) }] : []),
    {
      // The rows. When there is no footnote this is the LAST section of the
      // fused card, so it takes the bottom border and radius itself — an empty
      // footer lexical still renders its own padded band, which read as a strip
      // of dead space under every day of the schedule.
      kind: 'Card', ...(foot ? fusedMid : fusedEnd), ...(foot ? {} : { padding: { top: '0', bottom: '4' } }),
      data: dataSection({
        source, columns, filters, join,
        display: {
          cellsTracksTemplate: tracks, cellsGridSize: trackCount(tracks),
          cellsGridGap: 12, cellsRowGap: 0, cellsPadding: 0, cellsVAlign: 'center',
          cardsGridGap: 0, cardsPadding: 0, cardBorder: false, cardStyle: 'adminRow',
          ...display,
        },
      }),
    },
    ...(foot ? [{
      kind: 'lexical', ...fusedEnd, padding: { top: '0', bottom: '4' },
      data: lexical(styled('label', text(foot))),
    }] : []),
  ];
}

/** The events list, once per bucket.
 *
 *  The design splits UPCOMING from PAST. `date` is TEXT on this source, so the
 *  split is a calculated bucket column compared after a cast, filtered with the
 *  plainest operator there is — rather than a `time`-op range, which would need
 *  a second calc column just to give the operator a timestamp to bite on. The
 *  bucket is also what a future "this month" tab would filter.
 */
function eventsList({ title, meta, sortDir, bucket, dim = false, footer: foot }) {
  return listCardPublic({
    title, titleMeta: meta, link: '',
    tracks: '64px minmax(0,1fr) 200px 90px',
    headers: ['Date', 'Event', 'Venue', 'Price'],
    source: SOURCES.events,
    columns: [
      { name: `to_char(date::date, 'DD') as day_num`, normalName: 'day_num', origin: 'calculated-column', show: true, hideHeader: true, valueFontStyle: 'rowTitle' },
      { name: 'title', show: true, hideHeader: true, valueFontStyle: 'rowTitle' },
      { name: 'venue', show: true, hideHeader: true, valueFontStyle: 'rowMeta' },
      { name: "coalesce(nullif(price, ''), 'Free') as price_display", normalName: 'price_display', origin: 'calculated-column', show: true, hideHeader: true, valueFontStyle: 'rowMono' },
      { name: `upper(to_char(date::date, 'Mon')) as month_abbr`, normalName: 'month_abbr', origin: 'calculated-column', show: true, hideHeader: true, valueFontStyle: 'rowMeta' },
      { name: `upper(concat_ws(' · ', to_char(date::date, 'Dy'), time)) as when_meta`, normalName: 'when_meta', origin: 'calculated-column', show: true, hideHeader: true, valueFontStyle: 'rowMeta', cellSpan: 3 },
      { name: `(CASE WHEN date::date >= current_date THEN 'upcoming' ELSE 'past' END) as when_bucket`, normalName: 'when_bucket', origin: 'calculated-column', show: true, selectOnly: true },
      { name: 'date', show: true, selectOnly: true, sort: sortDir },
    ],
    filters: [
      { col: 'status', op: 'filter', value: ['published'] },
      { col: 'when_bucket', op: 'filter', value: [bucket] },
    ],
    display: { pageSize: 25, usePagination: false, fetchMode: 'smart', ...(dim ? { cardStyle: 'adminRowDim' } : {}) },
    footer: foot,
  });
}

/** The public GRID card — the counterpart of `listCardPublic`, and the fix for
 *  the Phase 5 C1 finding.
 *
 *  Most lists on these pages are NOT tables in the design; they are grids of
 *  tiles inside a titled group card. The board is six such groups (one per
 *  department, each a 2-up grid of role tiles); the DJ roster is one group with
 *  a 3-up grid; the blog is one group with a 2-up grid. Built as tables they
 *  came out at roughly half the design's height with the group repeated down a
 *  column, which is what made the pages read as wrong despite being wired right.
 *
 *  Composition, same fusing trick as the list card: a lexical header section
 *  carrying the group's title and count, fused to a Card below it whose records
 *  render with the theme's `tile` style. The group's surface belongs to the
 *  SECTIONS (fusedTop/fusedEnd), the tile's surface to the card style — neither
 *  paints the other's.
 *
 *  A Card cannot emit per-group headers, so where the design groups, the caller
 *  passes one call per group with its own filter. That is rung 4 of the ladder
 *  (arrangement), not a new component.
 */
function gridCardPublic({ title, eyebrow, count, countPath, source, columns, filters = [], join, gridSize = 2, display = {}, footer: foot }) {
  return [
    {
      kind: 'lexical', ...fusedTop, padding: { top: '6', bottom: '2' },
      data: lexical(
        lcontainer(
          'w-full !mt-0 items-baseline grid-cols-[1fr_max-content] gap-x-4',
          // The eyebrow sits ABOVE the title inside the same layout item, which
          // is how the design stacks it — not as a third column.
          litem(
            ...(eyebrow ? [styled('caption', text(eyebrow))] : []),
            styled(eyebrow ? 'sectionHeading' : 'groupTitle', text(title)),
          ),
          litem(count && countPath
            ? button(count, countPath, 'metaLink')
            : styled('groupCount', text(count || ''))),
        ),
      ),
    },
    {
      kind: 'Card', ...(foot ? fusedMid : fusedEnd), padding: foot ? { top: '0', bottom: '0' } : { top: '0', bottom: '6' },
      data: dataSection({
        source, columns, filters, join,
        display: {
          // The tiles.
          cardStyle: 'tile', cardsGridSize: gridSize, cardsGridGap: 12,
          cardsPadding: 0, cardBorder: false,
          // The group card's own inset (`p-7` in the design). Top is 0 because
          // the header section above already carries the group's top gutter —
          // `cardsGridPadding` pads the whole grid inside its box, which is a
          // different thing from `cardsPadding` (inside each tile) and from the
          // tile style's `p-5` (the tile's own gutter).
          cardsGridPadding: '0 24px 24px',
          // Inside a tile the cells stack. `cellsRowGap: 8` is the design's
          // `mt-2` between a tile's lines; `cellsPadding: 0` because the tile
          // style owns the inner gutter (`p-5`).
          cellsGridSize: 1, cellsGridGap: 0, cellsRowGap: 8, cellsPadding: 0,
          usePagination: false, fetchMode: 'smart',
          ...display,
        },
      }),
    },
    ...(foot ? [{
      kind: 'lexical', ...fusedEnd, padding: { top: '2', bottom: '4' },
      data: lexical(styled('label', text(foot))),
    }] : []),
  ];
}

/* ── apply ───────────────────────────────────────────────────────────────── */

const listed = dmsJson(['page', 'list', '--pattern', PATTERN, '--format', 'json']);
const existing = new Map(
  (listed.items || []).map((p) => [p.data?.url_slug ?? p.url_slug, p]).filter(([s]) => s)
);

for (const page of pages) {
  if (ONLY.length && !ONLY.includes(page.slug)) continue;

  let id = existing.get(page.slug)?.id;
  if (id) {
    console.log(`page ${page.slug} → reusing ${id}`);
  } else {
    const created = dmsJson(['page', 'create', '--pattern', PATTERN, '--title', page.title, '--slug', page.slug, '--format', 'json']);
    id = created.id || created.data?.id;
    console.log(`page ${page.slug} → created ${id}`);
  }

  // Two bands: the sticky rail, then the page. Their `theme` names are what
  // select the layoutGroup style AND (since the admin build) the sectionArray
  // style — `header` gets the cutaway panel, `content` the 1280 column.
  const groups = [
    band({ index: 0, displayName: 'Live rail', theme: 'header' }),
    band({ index: 1, displayName: 'Page', theme: 'content' }),
  ];

  const pageData = {
    title: page.title,
    index: page.index,
    filters: page.filters || [],
    draft_section_groups: groups,
  };
  if (page.hideInNav) pageData.hide_in_nav = true;
  if (WIPE) pageData.draft_sections = [];
  dms(['page', 'update', String(id), '--data', JSON.stringify(pageData)]);

  const created = [];
  const all = [...liveRail(), ...page.sections];
  for (const s of all) {
    const group = s.band === 'rail' ? groups[0].name : groups[1].name;
    const common = {
      pageId: id, group, size: s.size || '12',
      componentType: COMPONENT_TYPE, parentRef: `${APP}+${PATTERN}|page`,
    };
    for (const k of ['padding', 'height', 'border', 'radius', 'bg', 'rowspan']) if (s[k] != null) common[k] = s[k];
    const payload = s.kind === 'lexical'
      ? lexicalSection({ ...common, elementData: s.data })
      : section({ ...common, elementType: s.kind, elementData: s.data });
    const row = dmsJson(['section', 'create', String(id), '--pattern', PATTERN, '--data', JSON.stringify(payload), '--format', 'json']);
    created.push(String(row.id || row.data?.id));
  }

  if (WIPE) {
    dms(['page', 'update', String(id), '--data', JSON.stringify({
      draft_sections: created.map((sid) => ({ id: sid, ref: `${APP}+${COMPONENT_TYPE}` })),
    })]);
  }
  console.log(`  2 bands · ${created.length} sections`);
}

console.log(`
Seeded as DRAFTS on the PUBLIC pattern. This is the live site — publishing is a
human's deliberate act, page by page:

    dms page publish <slug> --pattern ${PATTERN}
`);
