"""Build the Nassau jurisdiction alias table.

Covers ALL 70 jurisdictions in the plan, not just the 52 with annexes, because the 18
that withdrew still carry Roles and Participation content (owner, 2026-08-21).

Identity is keyed on geoid, never on a parsed name. Owner decisions 2026-08-21:
  - Glen Cove uses 3629113 (the Place row), not the 3605929113 cousub row.
  - "Rockville Centre" is correct; the annex folder says "Center".
  - The 18 Withdrawn villages are in scope for Roles + Participation only.

Note on keys: an annex folder's spelling is NOT reliable (Rockville Center/Centre), so
`seen` and the matrix lookup are both keyed on the RESOLVED crosswalk name, not the folder.
And the leftover matrix rows are asserted to be Withdrawn rather than assumed to be.
"""
import collections
import csv
import io
import re
import sys

sys.path.insert(0, 'references/mny-transcribe/Nassau/context/scripts')
from docx_outline2 import cell_text  # noqa: E402
from docx import Document

GEO = 'references/mny-transcribe/Nassau/context/extracted/nassau_geoids.tsv'
MAN = 'references/mny-transcribe/Nassau/context/file-manifest.csv'
BASE = ('references/mny-transcribe/Nassau/Base Plan and Appendices/'
        'Nassau County_HMP_Base_Plan_12.16.20.docx')
OUT = 'references/mny-transcribe/Nassau/context/nassau-jurisdiction-aliases.csv'

OVERRIDE = {
    '01_CityofGlenCove': ('3629113',
                          'Two crosswalk rows exist (3605929113 cousub / 3629113 Place). Owner chose '
                          '3629113, 2026-08-21.'),
    '39_VillageofRockvilleCenter': ('3663264',
                                    'Folder spells it "Center"; correct spelling is "Centre". Owner '
                                    'confirmed 2026-08-21.'),
    '00_NassauCounty': ('36059', 'The county row itself.'),
}


def norm(s):
    """Letters only."""
    return re.sub(r'[^a-z]', '', s.lower())


def norm_label(s):
    """Base-plan matrix labels: "Village of X" / "City of X" / "Nassau County"."""
    s = re.sub(r'^\s*(incorporated\s+)?(village|town|city)\s+of\s+', '', s.strip(), flags=re.I)
    s = re.sub(r'\s+county\s*$', '', s, flags=re.I)
    return norm(s)


geo = list(csv.DictReader(io.open(GEO, encoding='utf-8'), delimiter='\t'))
manifest = list(csv.DictReader(io.open(MAN, encoding='utf-8')))

by_norm = collections.defaultdict(list)
for g in geo:
    by_norm[norm(g['Municipality Name'])].append(g)

doc = Document(BASE)
matrix = {}
for r in doc.tables[0].rows[1:]:
    cells = [cell_text(c) for c in r.cells]
    if not cells[0]:
        continue
    matrix[norm_label(cells[0])] = (cells[-1], sum(1 for c in cells[1:-1] if c.strip()), cells[0])

rows = []
seen = set()

# --- the 52 annex folders ----------------------------------------------------
for m in manifest:
    folder = m['folder']
    bare = re.sub(r'^\d+_', '', folder)
    typ = ('County' if folder == '00_NassauCounty'
           else 'City' if bare.lower().startswith(('cityof', 'city of'))
           else 'Town' if bare.lower().startswith(('townof', 'town of'))
           else 'Village')
    if folder in OVERRIDE:
        geoid, note = OVERRIDE[folder]
        g = next(x for x in geo if x['GeoID Number'] == geoid)
    else:
        key = re.sub(r'^(cityof|townof|villageof)', '', norm(bare))
        cands = [x for x in by_norm[key] if x['Municipality Type'].lower() == typ.lower()]
        assert len(cands) == 1, (folder, key, cands)
        g, note = cands[0], ''
        geoid = g['GeoID Number']

    # key everything on the RESOLVED name, never the folder's spelling
    mkey = norm(g['Municipality Name'])
    st, nmeet, _ = matrix.get(mkey, ('', 0, ''))
    seen.add(mkey)

    rows.append({
        'geoid': geoid, 'municipality_name': g['Municipality Name'],
        'jurisdiction_title': g['Jurisdiction Title'],
        'municipality_type': g['Municipality Type'], 'census_type': g['Census Type'],
        'county_geoid': g['county geoid'], 'folder': folder, 'annex_file': m['annex_file'],
        'n_maw': m['n_maw'],
        'pipeline': ('freeport-standalone' if m['annex_file'].lower().endswith('.pdf')
                     else 'hagerty-annex'),
        'has_annex': 'yes', 'adoption_status': st or 'not in matrix',
        'meetings_attended': nmeet, 'in_scope_for': 'all datasets', 'notes': note,
    })

# --- matrix rows with no annex ------------------------------------------------
leftover = [(k, v) for k, v in sorted(matrix.items(), key=lambda kv: kv[1][2]) if k not in seen]
statuses = {v[0] for _, v in leftover}
assert statuses == {'Withdrawn'}, f'leftover matrix rows are not all Withdrawn: {statuses}'

for key, (st, nmeet, label) in leftover:
    cands = [x for x in by_norm[key] if x['Municipality Type'].lower() == 'village']
    assert len(cands) == 1, (label, key, cands)
    g = cands[0]
    rows.append({
        'geoid': g['GeoID Number'], 'municipality_name': g['Municipality Name'],
        'jurisdiction_title': g['Jurisdiction Title'],
        'municipality_type': g['Municipality Type'], 'census_type': g['Census Type'],
        'county_geoid': g['county geoid'], 'folder': '', 'annex_file': '', 'n_maw': 0,
        'pipeline': 'base-plan-only', 'has_annex': 'no', 'adoption_status': st,
        'meetings_attended': nmeet, 'in_scope_for': 'Roles + Participation only',
        'notes': (f'Participated then withdrew before adoption; base-plan matrix label "{label}". '
                  'No annex exists, so there is no Actions / Capabilities / HOC content.'),
    })

assert len({r['geoid'] for r in rows}) == len(rows), 'geoid collision'
assert not [r for r in rows if r['adoption_status'] == 'not in matrix'], \
    'every jurisdiction should appear in the attendance matrix'

with io.open(OUT, 'w', encoding='utf-8', newline='') as fh:
    w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
    w.writeheader()
    w.writerows(rows)

print(f'wrote {OUT}')
print(f'  rows {len(rows)}   distinct geoids {len({r["geoid"] for r in rows})}   collisions 0')
for field in ('has_annex', 'adoption_status', 'pipeline', 'municipality_type', 'census_type'):
    print(f'  {field:18s}', dict(collections.Counter(r[field] for r in rows)))
print(f'  CDPs in scope     : {sum(1 for r in rows if r["municipality_type"].lower() == "cdp")}')
