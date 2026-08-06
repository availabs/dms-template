// Fixed, enumerable tag-category vocabularies for the tag-folder browser. These stand in for
// the old tool's folder browser (see research/route-creation/findings.md's folder-system writeup)
// without real folders in the data model — routes carry `county:`/`region:`/`agency:`-prefixed
// tags, and this file supplies the folder SHELLS to drill into. Deliberately hardcoded rather than
// discovered live: the UDA query engine has no groupBy-unnest path for multiselect columns (see
// planning/transportny/tasks/current/dynamic-reports-and-route-tags.md), and these three axes are genuinely
// fixed/enumerable (NY's counties, NYSDOT's 11 regions, a known agency/MPO code list) — no
// discovery query is needed to know what values CAN exist, only `array_contains` to find routes
// that have one.
//
// Region and agency values pulled 2026-07-31 from the old tool's own DB (`admin2.folders`,
// `dbq.py old`), not hand-copied from prior narrative notes, to get exact names/codes.

export const NY_COUNTIES = [
  'Albany', 'Allegany', 'Bronx', 'Broome', 'Cattaraugus', 'Cayuga', 'Chautauqua', 'Chemung',
  'Chenango', 'Clinton', 'Columbia', 'Cortland', 'Delaware', 'Dutchess', 'Erie', 'Essex',
  'Franklin', 'Fulton', 'Genesee', 'Greene', 'Hamilton', 'Herkimer', 'Jefferson', 'Kings',
  'Lewis', 'Livingston', 'Madison', 'Monroe', 'Montgomery', 'Nassau', 'New York', 'Niagara',
  'Oneida', 'Onondaga', 'Ontario', 'Orange', 'Orleans', 'Oswego', 'Otsego', 'Putnam',
  'Queens', 'Rensselaer', 'Richmond', 'Rockland', 'St. Lawrence', 'Saratoga', 'Schenectady',
  'Schoharie', 'Schuyler', 'Seneca', 'Steuben', 'Suffolk', 'Sullivan', 'Tioga', 'Tompkins',
  'Ulster', 'Warren', 'Washington', 'Wayne', 'Westchester', 'Wyoming', 'Yates',
];

// NYSDOT's own fixed 11-value enum, `admin2.folders` type='AVAIL', verbatim.
export const NYSDOT_REGIONS = [
  { number: 1, label: 'Region 1 - Capital District' },
  { number: 2, label: 'Region 2 - Mohawk Valley' },
  { number: 3, label: 'Region 3 - Central New York' },
  { number: 4, label: 'Region 4 - Genesee Valley' },
  { number: 5, label: 'Region 5 - Western New York' },
  { number: 6, label: 'Region 6 - Southern Tier/Central New York' },
  { number: 7, label: 'Region 7 - North Country' },
  { number: 8, label: 'Region 8 - Hudson Valley' },
  { number: 9, label: 'Region 9 - Southern Tier' },
  { number: 10, label: 'Region 10 - Long Island' },
  { number: 11, label: 'Region 11 - New York City' },
];

// Agency/ownership axis, `admin2.folders` type='group' filtered to real agency/MPO codes —
// NYSDOT's own internal divisions, NYSDOT itself, and MPO/external-partner codes. Excludes
// consultant accounts, test folders, and generic buckets found in the same raw folder list
// (e.g. "NYSDOT CONSULTANT", "NPMRDS New Users", "Test Folder") — those aren't an agency taxonomy.
export const AGENCY_CODES = [
  { code: 'NYSDOT', label: 'NYSDOT' },
  { code: 'WLD', label: 'WLD (Week-Long Deployment)' },
  { code: 'SDD', label: 'SDD (Single-Day Deployment)' },
  { code: 'TDD', label: 'TDD (Two-Day Deployment)' },
  { code: 'MDD', label: 'MDD (Multiple-Day Deployment)' },
  { code: 'AGFTC', label: 'AGFTC' },
  { code: 'BMTS', label: 'BMTS' },
  { code: 'CDTC', label: 'CDTC' },
  { code: 'GBNRTC', label: 'GBNRTC' },
  { code: 'GTC', label: 'GTC' },
  { code: 'HOCTS', label: 'HOCTS' },
  { code: 'ITCTC', label: 'ITCTC' },
  { code: 'NYMTC', label: 'NYMTC' },
  { code: 'NYSAMPO', label: 'NYSAMPO' },
  { code: 'OCTC', label: 'OCTC' },
  { code: 'PDCTC', label: 'PDCTC' },
  { code: 'SMTC', label: 'SMTC' },
  { code: 'UCTC', label: 'UCTC' },
];

// Provenance flag, not a value-pair — a single folder, always shown.
export const AUTO_GENERATED_TAG = 'auto_generated';

export const TAG_CATEGORIES = [
  { key: 'county', label: 'County', tagPrefix: 'county:', values: NY_COUNTIES.map(name => ({ value: `county:${name}`, label: name })) },
  { key: 'region', label: 'Region', tagPrefix: 'region:', values: NYSDOT_REGIONS.map(r => ({ value: `region:${r.number}`, label: r.label })) },
  { key: 'agency', label: 'Agency', tagPrefix: 'agency:', values: AGENCY_CODES.map(a => ({ value: `agency:${a.code}`, label: a.label })) },
];

// A result row's raw `tags` column arrives as a JSON-array string from most sources but can
// already be a real array — same shape/parsing need as ReportRouteList/utils.js's
// parseTmcArray, kept as its own small copy here since these are conceptually distinct fields
// (route tags vs. a route's TMC list), not one generic "parse this multiselect column" utility
// worth sharing across both.
export function parseTags(tags) {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags;
  try {
    return JSON.parse(tags);
  } catch (e) {
    return [];
  }
}

// Every known tag value → its human label, so a result row's tag chips read as "Dutchess" /
// "Region 8 - Hudson Valley" rather than the raw "county:Dutchess" storage string. Falls back to
// the raw tag for anything not in a fixed vocabulary (auto_generated has its own entry; a
// free-text project/custom tag has no entry and displays as-typed).
const TAG_LABEL_BY_VALUE = new Map(
  TAG_CATEGORIES.flatMap((c) => c.values.map((v) => [v.value, v.label]))
);
TAG_LABEL_BY_VALUE.set(AUTO_GENERATED_TAG, 'Auto-generated');

export function tagToLabel(tag) {
  return TAG_LABEL_BY_VALUE.get(tag) || tag;
}
