import { logScale, isOwnedByCurrentUser } from '../PickerModal/pickerScoring';
import { parseTags } from './tagCategories';
import { parseTmcArray } from '../ReportRouteList/utils';

// Prominence-weighted default sort for the route picker (npmrds-picker-modals.html item 2,
// 2026-08-25). Replaces a flat `created_at desc`/`name asc` sort — the real finding behind
// this: raw geometry size is a bad prominence proxy. In Albany county, NY-32 (34 TMCs) and
// NY-85 (28 TMCs) out-measure I-87 (12 TMCs) despite I-87 being the far more significant road.
// Road class is weighted ahead of size for exactly this reason. Weights are illustrative and
// freely redirectable; the SHAPE (road class → log-scaled size → has-tags → ownership →
// fragment penalty, summed) is what matters.
//
// There is no separate "road" column on the real routes catalog — road is embedded in `name`
// (e.g. "I-87 36001 NORTHBOUND #12000212 (2024)") — so road class is read via a name-prefix
// regex, not a dedicated field.
const ROAD_CLASS = [
  [/^I-\d/i, 40],
  [/^US-\d/i, 28],
  [/^NY-\d/i, 16],
];

function roadClassScore(name) {
  const n = name || '';
  for (const [re, score] of ROAD_CLASS) if (re.test(n)) return score;
  return 6; // CR-/local/named roads
}

export function isFragment(row) {
  return parseTmcArray(row?.tmc_array).length === 1;
}

// Server-side "exclude single-TMC fragments" filter leaf for the unscoped (non-search) views —
// a raw SQL expression in `col` (Step 2b's "option A" pattern: no matching section column, so
// mapFilterGroupCols passes it through to the server verbatim), guarded against the ~5% of rows
// whose `tmc_array` isn't valid JSON (falls back to 2 — i.e. NOT treated as a fragment, never
// hide something we're not sure about).
//
// Why this has to happen server-side, not just client-side re-sort: confirmed live 2026-08-25 —
// 52,633 of ~73,464 real routes (72%) are single-TMC fragments, AND the 80 most-recently-created
// rows in the whole catalog are ALL fragments (a bulk batch). A client-side re-sort of a
// created_at-ordered LIMIT-60 fetch never even sees a non-fragment row in that case — the
// candidate pool itself has to exclude fragments, or the default view is empty modulo the reveal.
export const EXCLUDE_FRAGMENTS_FILTER = {
  col: "case when (data->>'tmc_array') ~ '^\\[' then jsonb_array_length((data->>'tmc_array')::jsonb) else 2 end",
  op: 'gt',
  value: 1,
};

// A NAME SEARCH can't use EXCLUDE_FRAGMENTS_FILTER (fragments must still surface when a search
// directly matches one — the collapseFragments design decision) — but it still needs fragments
// to not DROWN OUT real matches within the fetch LIMIT. Confirmed live 2026-08-25: searching
// "87" against the real catalog returns thousands of raw-TMC-code-named single-TMC rows
// (`T2870095500573W_...`, an unrelated legacy import batch) that also contain "87", so an
// unordered/arbitrary-order LIMIT 40 can come back 100% junk fragments with I-87 nowhere in it —
// a client-side re-sort can't fix a candidate pool that never included the real match. This
// `selectOnly` calculated column ranks non-fragments first (`sort:'asc'` puts `false`/0 before
// `true`/1) so the SQL LIMIT itself is fragment-safe: real matches always make the cut, fragments
// only fill remaining slots. Same "option A" raw-SQL-in-a-column-name pattern as
// EXCLUDE_FRAGMENTS_FILTER, added via fetchCatalogRows.js's `extraColumns`.
export const FRAGMENT_RANK_SORT_COLUMN = {
  name: "case when (data->>'tmc_array') ~ '^\\[' then (jsonb_array_length((data->>'tmc_array')::jsonb) = 1) else false end as frag_rank",
  origin: 'calculated-column',
  type: 'calculated',
  formatFn: ' ',
  show: true,
  normalName: 'frag_rank',
  selectOnly: true,
  sort: 'asc',
};

// Same fix, same reason, for a SECOND real-data population that ALSO drowns out real matches
// within the search LIMIT: raw-numeric-id-named legacy rows (e.g. "1004262_3787_LATHAM CIRCLE",
// "1006110_3411_100C 100C87011002") — real multi-TMC routes, so FRAGMENT_RANK_SORT_COLUMN alone
// doesn't move them out of the way. Confirmed live 2026-08-25: even after fragment-ranking, an
// "87" search's top 40 was entirely this family, still with no I-87. This ranks
// recognizable-road-class names (I-/US-/NY- prefix — the same ROAD_CLASS prefixes routeScore()
// weighs client-side) ahead of everything else, SQL-side, for the same "the LIMIT truncation has
// to include the good candidates" reason — the client-side routeScore() re-sort already handles
// the FINAL display order correctly once the fetch actually contains real matches; this column
// only has to get them past the LIMIT.
export const ROAD_CLASS_RANK_SORT_COLUMN = {
  name: "case when (data->>'name') ~* '^(i|us|ny)-[0-9]' then 0 else 1 end as road_rank",
  origin: 'calculated-column',
  type: 'calculated',
  formatFn: ' ',
  show: true,
  normalName: 'road_rank',
  selectOnly: true,
  sort: 'asc',
};

export function routeScore(row, { currentUserId } = {}) {
  const tmcCount = parseTmcArray(row?.tmc_array).length;
  let s = roadClassScore(row?.name);
  s += logScale(tmcCount, 20, 4); // geometry size, log-scaled so it never dominates road class
  if (parseTags(row?.tags).length > 0) s += 10; // carries real classification tags (county/region/agency)
  if (isOwnedByCurrentUser(row?.created_by, currentUserId)) s += 25; // yours — boosted, not just filterable
  if (tmcCount === 1) s -= 15; // single-TMC fragment penalty — the auto-generated-route audit finding
  return s;
}
