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
// test folders and generic buckets found in the same raw folder list (e.g. "Test Folder").
// Shared verbatim with report tags (round 82, old-reports-conversion.md) — Ryan's call: routes
// and reports use the SAME agency vocabulary, not two separate lists. The last 4 entries
// (AVAIL/MHV/NYSDOT_CONSULTANT/NPMRDS_NEW_USERS) were added for that round: they're real
// `admin2.folders` group folders with actual REPORT membership (347/870 reports across all 8
// agency folders) that hadn't shown up in the original route-side taxonomy pass. The Python
// converter (`scripts/npmrds-reports/convert_old_reports_lib/db.py`'s `fetch_agency_tag`) writes
// `agency:<code>` tags using its own hardcoded copy of the old-folder-name → code mapping for
// exactly these 8 — keep that dict's codes in sync with this list if either changes.
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
  { code: 'AVAIL', label: 'AVAIL' },
  { code: 'MHV', label: 'MHV' },
  { code: 'NYSDOT_CONSULTANT', label: 'NYSDOT Consultant' },
  { code: 'NPMRDS_NEW_USERS', label: 'NPMRDS New Users' },
  // Added 2026-09-01 (routes-reports-users-mesh.md, Workstream D): real `npmrdsv5` login groups
  // (queried live from `avail_auth`) that this hand-curated list — mined from the OLD tool's
  // `admin2.folders`, never from the live auth system — didn't know about. Codes are
  // `groupNameToAgencyTag()`'s slug of the real group name below (see that function), so a
  // viewer's own group tag always resolves to something browsable here.
  { code: 'ECTC', label: 'ECTC' }, // group: "ECTC"
  { code: 'MPOS', label: 'MPOs' }, // group: "MPOs"
  { code: 'MTA', label: 'MTA' }, // group: "MTA"
  { code: 'NPMRDS_PM3_NEW_USERS', label: 'NPMRDS_PM3 New Users' }, // group: "NPMRDS_PM3 New Users"
  { code: 'NPMRDS_PUBLIC', label: 'NPMRDS Public' }, // group: "NPMRDS Public"
  { code: 'NPMRDSV5_PUBLIC', label: 'npmrdsv5 Public' }, // group: "npmrdsv5 Public"
  { code: 'NYSDOT_ADMIN', label: 'NYSDOT Admin' }, // group: "NYSDOT Admin"
  { code: 'TRAFFIC_MANAGEMENT_GROUP', label: 'Traffic Management Group' }, // group: "Traffic Management Group"
];

// Provenance flag, not a value-pair — a single folder, always shown. Also one of the two
// "curated, shown to everyone regardless of ownership" markers for the picker visibility rule
// below (routes-reports-users-mesh.md, Workstream D item 6) — every `tmc_linear` auto-generated
// route already carries this from generation time (Workstream C), so no backfill needed here.
export const AUTO_GENERATED_TAG = 'auto_generated';

// The reports-side twin of AUTO_GENERATED_TAG — the other "curated, shown to everyone" marker.
// Unlike AUTO_GENERATED_TAG this DOES need a one-time backfill: it's applied to the Dynamic
// Report template `reports_snap_2` rows (identified by `_built_from_spec` pointing at
// `dynamic_report_specs/*.json`, NOT the golden-corpus test fixtures), not written at creation
// time by anything yet.
export const DYNAMIC_REPORT_TEMPLATE_TAG = 'dynamic_report_template';

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
TAG_LABEL_BY_VALUE.set(DYNAMIC_REPORT_TEMPLATE_TAG, 'Dynamic Report template');

export function tagToLabel(tag) {
  if (isUserTag(tag)) return 'You';
  return TAG_LABEL_BY_VALUE.get(tag) || tag;
}

// --- User/group tag conventions (routes-reports-users-mesh.md, Workstream D, 2026-09-01) ---
// A client-side-only ownership signal layered on top of the county/region/agency vocabulary
// above: a `user:<id>` tag (mirrors the immutable, system-stamped `created_by` DMS column, but is
// a real, visible, removable tag an author can see/manage) plus `agency:<CODE>` tags derived from
// the viewer's OWN live login groups (`CMSContext`'s `user.groups`, itself sourced from the real
// `avail_auth` DB — see `patterns/auth/context.js`/`jwt.js`) rather than the hardcoded
// AGENCY_CODES list above. That keeps a viewer's own selectable/default tags always correct even
// before AGENCY_CODES has been hand-extended for some brand-new group — AGENCY_CODES only needs
// updating so a tag becomes BROWSABLE via the drill-down tree, never to make it assignable.

export const USER_TAG_PREFIX = 'user:';

export function makeUserTag(userId) {
  return `${USER_TAG_PREFIX}${userId}`;
}

export function isUserTag(tag) {
  return typeof tag === 'string' && tag.startsWith(USER_TAG_PREFIX);
}

export function isAgencyTag(tag) {
  return typeof tag === 'string' && tag.startsWith('agency:');
}

// Real login-group name -> canonical `agency:<CODE>` tag value. Uppercase + underscore (matching
// AGENCY_CODES' own style) reproduces the existing codes exactly wherever the two lists already
// agreed — confirmed live 2026-09-01, e.g. "NPMRDS New Users" -> NPMRDS_NEW_USERS, already in the
// list above — and mints a sensible new one otherwise ("NYSDOT Admin" -> NYSDOT_ADMIN).
export function slugifyGroupName(name) {
  return (name || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

export function groupNameToAgencyTag(groupName) {
  return `agency:${slugifyGroupName(groupName)}`;
}

// `public` is a synthetic pseudo-group the client-side auth layer appends to EVERY user's
// `user.groups` regardless of real membership (`patterns/auth/api.js`'s `getAPI().getUser`) — not
// a real agency; excluded here so it doesn't spam every report/route with a meaningless
// `agency:PUBLIC` tag.
const NON_AGENCY_GROUPS = new Set(['public']);

function realGroupTags(user) {
  return (user?.groups || [])
    .filter((g) => !NON_AGENCY_GROUPS.has(String(g).toLowerCase()))
    .map(groupNameToAgencyTag);
}

// The default tag set a brand-new report/route should be created with: the author's own user tag
// plus one agency tag per real login group they belong to. `user` is the CMSContext user object
// (`{id, groups}`) — returns `[]` for a logged-out/incomplete user rather than throwing, so
// callers can use this unconditionally.
export function defaultTagsForUser(user) {
  if (!user?.id) return [];
  return [makeUserTag(user.id), ...realGroupTags(user)];
}

// Whether `tag` is something `user` is ALLOWED to add — blocks committing an agency tag for a
// group the user isn't actually in ("should not be allowed to add agency tags if they are not a
// part of that agency," routes-reports-users-mesh.md). Non-agency tags (county/region/custom
// free-form) are always allowed; a user's own `user:` tag is always allowed too.
export function isTagAllowedForUser(tag, user) {
  if (!isAgencyTag(tag)) return true;
  return new Set(realGroupTags(user)).has(tag);
}

// The reverse direction of tagToLabel, for free-form entry points (ReportTagsEditor.jsx,
// SaveRouteModal.jsx's TagsInputField) that let an author type a tag rather than pick one from
// the fixed-vocabulary browse tree. 2026-08-31 bug (old-reports-conversion.md, "Round 83"):
// typing the bare code/label of a KNOWN category value (e.g. "AVAIL") committed the raw text
// verbatim instead of the canonical prefixed value ("agency:AVAIL") the Tag Browser's
// array_contains filter actually matches on — the tag then displayed correctly (tagToLabel falls
// back to the raw string, which coincidentally read the same) but was permanently unfindable by
// category. Case-insensitively matches typed text against every known value's code/label and
// returns the canonical `prefix:value` form when found; falls through to the trimmed raw text
// unchanged for genuine free-form tags (a project number, a scratch label) — those are not
// supposed to resolve to anything, this only closes the gap for text that collides with a value
// already in the fixed vocabulary.
export function canonicalizeTag(rawText) {
  const text = (rawText || '').trim();
  if (!text) return text;
  const q = text.toLowerCase();
  for (const category of TAG_CATEGORIES) {
    for (const v of category.values) {
      if (v.value.toLowerCase() === q || v.label.toLowerCase() === q) return v.value;
    }
  }
  return text;
}
