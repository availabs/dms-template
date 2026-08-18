/* Shared building blocks for the WCDB admin seed.
 *
 * Everything the page builders need that is NOT page-specific: the CLI runner,
 * the lexical-state builders, the section payload shape, and the confirmed
 * source bindings. Kept in one module deliberately — the skill
 * (creating-pages-from-a-design-pattern.md §5.6.6b) records that re-deriving
 * these per page got them wrong on the first pass every time.
 *
 * DRAFT-ONLY. Nothing here publishes; `dms page publish` is a human's call.
 */
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

export const HOST = process.env.DMS_HOST || 'http://localhost:3001';
export const APP = process.env.DMS_APP || 'wcdb';
export const TYPE = process.env.DMS_TYPE || 'prod';

export const PATTERN = 'station_admin';
export const PAGE_TYPE = `${PATTERN}|page`;
export const COMPONENT_TYPE = `${PATTERN}|component`;
export const PARENT_REF = `${APP}+${PAGE_TYPE}`;

const CLI = 'src/dms/packages/dms/cli/bin/dms.js';

/* ── CLI ──────────────────────────────────────────────────────────────────
 * `--pattern` on every section call is not optional: without it
 * `resolvePagePattern` picks the app's FIRST pattern and writes the row under
 * it. The row still attaches, so nothing errors — the page just 500s on load
 * with "You do not have permission to view this page", which reads like an auth
 * failure and isn't.
 */
export function dms(args, { quiet = false } = {}) {
  try {
    return execFileSync('node', [CLI, ...args, '--host', HOST, '--app', APP, '--type', TYPE], {
      encoding: 'utf8',
      maxBuffer: 128 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (e) {
    if (!quiet) console.error(`  dms ${args.slice(0, 3).join(' ')} failed:\n${e.stderr || e.message}`);
    throw e;
  }
}
export const dmsJson = (args, opts) => JSON.parse(dms(args, opts));

/* ── Lexical builders ─────────────────────────────────────────────────────
 * A lexical section's `element-data.text` must be a real node TREE. A bare
 * string looks fine in a draft (the editor upgrades it on load) and renders
 * EMPTY once published — so a programmatic writer always builds the tree.
 */
const node = (extra) => ({ direction: null, format: '', indent: 0, version: 1, ...extra });

export const text = (t, format = 0) => ({
  type: 'text', text: t, detail: 0, format, mode: 'normal', style: '', version: 1,
});
export const para = (...kids) => node({ type: 'paragraph', textFormat: 0, textStyle: '', children: kids.length ? kids : [text('')] });
export const head = (tag, ...kids) => node({ type: 'heading', tag, children: kids.map((k) => (typeof k === 'string' ? text(k) : k)) });
export const hr = () => ({ type: 'horizontalrule', version: 1 });
export const icon = (iconName, styleKey) => ({ type: 'icon', iconName, version: 1, ...(styleKey ? { styleKey } : {}) });
export const button = (linkText, path = '#', style = 'default', keepSearchParams = false) => ({
  type: 'button', linkText, path, style, keepSearchParams, version: 1,
});
export const litem = (...kids) => node({ type: 'layout-item', children: kids });
export const lcontainer = (templateColumns, ...items) =>
  node({ type: 'layout-container', templateColumns, children: items });

/** A paragraph carrying a brand textSettings token key. */
export const styled = (styleKey, ...kids) =>
  node({ type: 'styled-paragraph', styleKey, textFormat: 0, textStyle: '', children: kids.map((k) => (typeof k === 'string' ? text(k) : k)) });

/** Wrap nodes into a lexical section's element-data.
 *
 *  The state lives at `text.ROOT` — `RichtextView` reads `text?.root` and
 *  renders nothing at all when it is absent. Building `text` as the root node
 *  itself (one level too shallow) produces a section that saves fine, reports
 *  success, and paints empty. */
export const lexical = (...children) => ({
  bgColor: 'rgba(0,0,0,0)',
  isCard: '',
  showToolbar: false,
  text: { root: node({ type: 'root', children }) },
});

/* Both LayoutContainerNode and LayoutItemNode report isShadowRoot() === true.
 * Nesting one inside the other makes Lexical hoist/mangle it at RENDER time —
 * the JSON serializes fine and the build logs success, and the header paints
 * empty. Cheap offline guard so that can't ship. */
export function assertFlatLexical(elementData) {
  const SHADOW = new Set(['layout-container', 'layout-item']);
  const root = elementData.text?.root;
  // Catch the shape bug too — an absent root renders an empty section, silently.
  if (!root || root.type !== 'root') throw new Error('lexical element-data has no text.root');
  (function walk(n, underShadow) {
    if (n.type === 'layout-container' && underShadow) {
      throw new Error('nested layout-container inside a shadow root — Lexical will mangle it at render');
    }
    for (const c of n.children || []) walk(c, underShadow || SHADOW.has(n.type));
  })(root, false);
  return elementData;
}

/* ── Section payloads ─────────────────────────────────────────────────────
 * `element-data` and `parent` are both JSON STRINGS — the server stores them
 * stringified, and the renderer reads `value.element['element-data']`. Keys at
 * the top level of `data` are ignored by the renderer, which is why the CLI's
 * --element-type/--title flags (old format) must not be used for real seeding.
 */
export function section({ pageId, group, elementType, elementData, size = '12',
                          componentType = COMPONENT_TYPE, parentRef = PARENT_REF, ...rest }) {
  const payload = {
    // NEVER a section title: a non-empty one renders a hardcoded ≥50px uppercase
    // band from theme.heading[level], which most themes don't define. Headings
    // belong in a lexical section where they stay author-editable brand text.
    title: '',
    // Defaults are the ADMIN pattern's; the public seed passes its own. A
    // section written with the wrong pattern type still attaches and still
    // saves — the page just dies on load with what looks like an auth error.
    type: componentType,
    group,
    parent: JSON.stringify({ id: String(pageId), ref: parentRef }),
    trackingId: randomUUID(),
    size,
    element: {
      'element-type': elementType,
      'element-data': JSON.stringify(elementData),
    },
  };
  for (const k of ['padding', 'height', 'border', 'radius', 'bg', 'rowspan']) {
    if (rest[k] != null) payload[k] = rest[k];
  }
  return payload;
}

export const lexicalSection = (opts) =>
  section({ ...opts, elementType: 'lexical', elementData: assertFlatLexical(opts.elementData) });

/* ── Bands ────────────────────────────────────────────────────────────────
 * A page is a list of BANDS, and each band names a layoutGroup style. Admin
 * pages use one visual treatment (`admin`) plus one modal band per dialog.
 */
export const band = ({ index, displayName, theme = 'admin', position = 'content', modal }) => ({
  name: randomUUID(),
  index,
  position,
  theme,
  displayName,
  ...(modal ? { isModal: true, modalParamKey: modal.paramKey, modalSize: modal.size || 'xl' } : {}),
});

/* ── Confirmed source bindings ────────────────────────────────────────────
 * Confirmed against the live pgEnv 2026-08-14 (source ids, view ids, semantic
 * primary keys, isEditable) and with the user before binding, per
 * using-a-datawrapper-card.md's source/version rule. `wcdb-dama` is a real
 * pgEnv on BOTH the local dms-server and dmsserver.availabs.org.
 *
 * `columns` here is the FULL source schema (what the renderer resolves field
 * names against) — an empty one renders a blank card. The per-section
 * projection is the section's own top-level `columns`.
 */
const pg = (source_id, view_id, name, type, columns) => ({
  source_id, view_id, isDms: false,
  env: 'wcdb-dama', srcEnv: 'wcdb-dama', baseUrl: '',
  type, name, view_name: '1',
  columns: columns.map(([n, t]) => ({ name: n, type: t, display_name: n })),
});

export const SOURCES = {
  // The live detection feed behind wcdb.fm/datasets/source/7. Binding copied
  // from the public playlist Spreadsheet (section 1964233), which already reads it.
  playlist: pg(7, 7, 'WCDB Stream Playlist', 'now_playing_stream', [
    ['id', 'INTEGER'], ['received_at', 'TIMESTAMPTZ'], ['timestamp_utc', 'TIMESTAMPTZ'], ['kind', 'TEXT'],
    ['title', 'TEXT'], ['artist_name', 'TEXT'], ['album', 'TEXT'], ['album_cover', 'TEXT'],
    ['release_date', 'TEXT'], ['label', 'TEXT'], ['genre_names', 'TEXT'], ['score', 'INTEGER'],
    ['played_duration', 'INTEGER'], ['acrid', 'TEXT'], ['isrc', 'TEXT'], ['spotify_track_id', 'TEXT'],
    ['youtube_vid', 'TEXT'], ['stream_id', 'INTEGER'],
    // provenance (added by this task — see data-types/now_playing/schema.js)
    ['provenance', 'TEXT'], ['edited_by', 'TEXT'], ['edited_at', 'TIMESTAMPTZ'],
    ['original_title', 'TEXT'], ['original_artist_name', 'TEXT'], ['original_score', 'INTEGER'],
  ]),
  djs: pg(8, 8, 'WCDB DJs', 'csv_dataset', [
    ['dj_id', 'INTEGER'], ['on_air_name', 'TEXT'], ['first_name', 'TEXT'], ['last_name', 'TEXT'],
    ['email', 'TEXT'], ['show_email', 'TEXT'], ['phone', 'TEXT'], ['status', 'TEXT'],
    ['started', 'TEXT'], ['ended', 'TEXT'], ['department', 'TEXT'], ['bio', 'TEXT'],
    ['when_not_dj', 'TEXT'], ['first_song', 'TEXT'], ['fav_artist', 'TEXT'], ['fav_song', 'TEXT'],
    ['notes', 'TEXT'], ['updated_at', 'TEXT'],
  ]),
  shows: pg(9, 9, 'WCDB Shows', 'csv_dataset', [
    ['show_id', 'INTEGER'], ['name', 'TEXT'], ['dj_id', 'INTEGER'], ['department', 'TEXT'],
    // `icon` is a glyph NAME from the theme's registry (`Mic`, `Disc`), not an
    // asset — which is why `image` had to be added rather than reusing it.
    ['icon', 'TEXT'], ['description', 'TEXT'], ['legacy_schedule_ids', 'TEXT'],
    // A photo URL for the show. Added 2026-08-15 for the home page's on-air
    // panel, which the design draws as a full-bleed photograph
    // (`scripts/wcdb-admin/add-shows-image-column.mjs`). Nullable and usually
    // null: the panel falls back to a generated gradient.
    ['image', 'TEXT'],
  ]),
  schedule: pg(10, 10, 'WCDB Schedule', 'csv_dataset', [
    ['airing_id', 'INTEGER'], ['show_id', 'INTEGER'], ['day', 'INTEGER'], ['start', 'TEXT'], ['end', 'TEXT'],
  ]),
  // Added 2026-08-15 for the public build. `administrators` replaces the legacy
  // `eBoard` source (unreadable through every supported path — see
  // scripts/wcdb-migrate/extract-administrators.mjs); `posts` is new.
  administrators: pg(12, 12, 'WCDB Administrators', 'csv_dataset', [
    ['admin_id', 'INTEGER'], ['department', 'TEXT'], ['department_index', 'INTEGER'],
    ['position', 'TEXT'], ['holder_name', 'TEXT'], ['dj_id', 'INTEGER'], ['email', 'TEXT'],
    ['office_hours', 'TEXT'], ['icon', 'TEXT'], ['sort', 'INTEGER'],
    ['term_start', 'TEXT'], ['term_end', 'TEXT'],
  ]),
  posts: pg(13, 13, 'WCDB Posts', 'csv_dataset', [
    ['post_id', 'INTEGER'], ['slug', 'TEXT'], ['title', 'TEXT'], ['category', 'TEXT'],
    ['published_at', 'TEXT'], ['author_name', 'TEXT'], ['author_dj_id', 'INTEGER'],
    ['excerpt', 'TEXT'], ['body', 'TEXT'], ['image', 'TEXT'], ['featured', 'TEXT'], ['status', 'TEXT'],
  ]),
  events: pg(11, 11, 'WCDB Events', 'csv_dataset', [
    ['event_id', 'INTEGER'], ['date', 'TEXT'], ['time', 'TEXT'], ['title', 'TEXT'],
    ['venue', 'TEXT'], ['price', 'TEXT'], ['description', 'TEXT'], ['status', 'TEXT'],
  ]),
};

/** The review threshold, set from the real score distribution (27,288 scored
 *  rows, median 100): <60 flags ~6%, <80 would flag 17.6% — one track in six,
 *  which no DJ works through. Decided with the user 2026-08-14. */
export const REVIEW_THRESHOLD = 60;

/* ── dataWrapper scaffolding ──────────────────────────────────────────────
 * A section that mounts through the dataWrapper and lacks any of
 * filters/columns/data/externalSource gets a FRESH default state seeded — which
 * takes `display` down with it, so the section renders page-level chrome and
 * none of its authored config. Always ship the full skeleton.
 *
 * `pageSize` is required even when usePagination is false: getData computes its
 * fetch range from it, and an undefined one makes the range NaN — the length
 * query fires, the data request silently never does, and the card renders blank
 * with no console error.
 */
export const dataSection = ({ source, columns, filters = [], display = {}, join, fetchMode = 'smart', data = [] }) => ({
  externalSource: source,
  columns,
  filters: { op: 'AND', groups: filters },
  display: { usePagination: false, pageSize: 10, fetchMode, ...display },
  data,
  join: join || { sources: {} },
});

/* ── The list card ────────────────────────────────────────────────────────
 * Every admin list in the design is ONE card: a title row, a column-header
 * row, hairline-separated rows, and a footer. A Card section renders one
 * record-card per row and nothing else, so the card's own chrome is built by
 * FUSING sections — the compound-card pattern from
 * creating-pages-from-a-design-pattern.md §5.6.10: adjacent sections, all on
 * the card background, with per-side `border` / per-corner `radius` /
 * per-side `padding` coordinated so their inner boxes touch into one surface.
 *
 *   title   ┐ border top+left+right, radius tl+tr, padding bottom 0
 *   header  │ border left+right,     padding top 0 bottom 0
 *   rows    │ border left+right,     padding top 0 bottom 0   ← the data Card
 *   footer  ┘ border left+right+bottom, radius bl+br, padding top 0
 *
 * The rows section uses `cardStyle: 'adminRow'` + `cardsGridGap: 0`, which is
 * what turns record-cards into hairline rows (see the theme's dataCard style).
 */
const CARD_BG = 'white';   // the sectionArray `backgrounds` key → --card-bg

export const fusedTop = { bg: CARD_BG, border: { top: true, left: true, right: true }, radius: { tl: true, tr: true }, padding: { bottom: '0' } };
export const fusedMid = { bg: CARD_BG, border: { left: true, right: true }, padding: { top: '0', bottom: '0' } };
export const fusedEnd = { bg: CARD_BG, border: { left: true, right: true, bottom: true }, radius: { bl: true, br: true }, padding: { top: '0' } };

/** A Card of `origin: 'static'` cells on the SAME track template as the list —
 *  the column-header row. It binds to the list's own source at pageSize 1
 *  because a Card renders one card per ROW, and static cells need a row to
 *  render into; the row's data is never read. */
export const staticRowSection = ({ source, tracks, cells, valueFontStyle = 'label', padding }) =>
  dataSection({
    source,
    columns: [
      // One REAL column, selectOnly. A Card whose columns are all `static` has
      // nothing to select, so the request falls back to a column named `data`
      // — which exists on a DMS source and not on an external pg one, so every
      // header row fired a query that errored with `column "data" does not
      // exist`. The static cells still render from staticValue.
      ...cells.map((c) => (typeof c === 'string'
      ? { name: `hdr_${c.replace(/\W+/g, '_') || 'blank'}`, origin: 'static', staticValue: c, show: true, hideHeader: true, valueFontStyle }
      : { name: `hdr_${(c.label || 'blank').replace(/\W+/g, '_')}`, origin: 'static', staticValue: c.label, show: true, hideHeader: true, valueFontStyle, justify: c.justify })),
    ],
    // ONE seeded blank row, and `cache` so the section never queries. A header
    // row has nothing to fetch: every cell is a literal. Left on a live mode it
    // issued a request with no real column, which the server answered with
    // `column "data" does not exist` (that fallback column exists on a DMS
    // source, not on an external pg one). `cache` + a row is the blank-row
    // fallback for static values.
    data: [{}],
    display: {
      pageSize: 1, usePagination: false, fetchMode: 'cache',
      cellsTracksTemplate: tracks, cellsGridSize: cells.length,
      cellsGridGap: 12, cellsPadding: padding ?? 0, cardsGridGap: 0, cardsPadding: 0,
      cardBorder: false, cardStyle: 'adminHeaderRow',
    },
  });
