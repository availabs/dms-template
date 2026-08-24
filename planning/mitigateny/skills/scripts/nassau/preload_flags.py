"""Pre-load census: for every forms dataset, how many Nassau rows already exist?

This is what the "pre-load flags" question is really about — whether each dataset's load is
an UPDATE of pre-seeded rows or an INSERT of new ones, and which jurisdictions are ready.
"""
import collections
import csv
import io
import json
import os
import subprocess

ENV = dict(os.environ, DMS_HOST='https://dmsserver.availabs.org',
           DMS_APP='mitigat-ny-prod', DMS_TYPE='prod')
ALIAS = 'references/mny-transcribe/Nassau/context/nassau-jurisdiction-aliases.csv'

SOURCES = {
    'Hazards_of_Concern': ('1473470', '1473471'),
    'Roles': ('1473295', None),
    'Participation': ('1473468', None),
    'Capabilities_Catalogue': ('1068273', None),
    'Capacities': ('1689772', None),
    'Jurisdictions': ('1346449', None),
}


def dump(sid, view, limit, offset):
    args = ['node', 'src/dms/packages/dms/cli/bin/dms.js', 'dataset', 'dump', sid,
            '--limit', str(limit), '--offset', str(offset)]
    if view:
        args += ['--view', view]
    r = subprocess.run(args, capture_output=True, text=True, env=ENV,
                       encoding='utf-8', errors='replace')
    o = r.stdout or ''
    i = o.find('{')
    if i < 0:
        return None
    return json.loads(o[i:]).get('items', [])


def gj(v):
    if isinstance(v, list):
        return [str(x) for x in v]
    if isinstance(v, str) and v.startswith('['):
        try:
            return [str(x) for x in json.loads(v)]
        except Exception:
            return [v.strip('[]')]
    return [str(v)] if v not in (None, '') else []


alias = list(csv.DictReader(io.open(ALIAS, encoding='utf-8')))
geoids = {a['geoid'] for a in alias}
by_geoid = {a['geoid']: a for a in alias}

print(f'{"dataset":24s} {"total":>7s} {"Nassau":>7s} {"juris":>6s}  operation')
print('-' * 78)
results = {}
for name, (sid, view) in SOURCES.items():
    allrows, offset = [], 0
    while True:
        page = dump(sid, view, 500, offset)
        if page is None:
            break
        allrows += page
        if len(page) < 500:
            break
        offset += 500
        if offset > 60000:
            break
    nas, seen = [], collections.Counter()
    for r in allrows:
        d = r.get('data', {})
        hits = [g for g in gj(d.get('geoid_juris') or d.get('geoid')) if g in geoids]
        cc = str(d.get('geoid_county') or d.get('county_geoid') or '')
        if hits or cc == '36059':
            nas.append(d)
            for h in hits:
                seen[h] += 1
    op = 'UPDATE pre-seeded rows' if len(nas) > 100 else ('INSERT (nothing pre-seeded)' if not nas else 'mixed - inspect')
    print(f'{name:24s} {len(allrows):7d} {len(nas):7d} {len(seen):6d}  {op}')
    results[name] = (allrows, nas, seen)

# --- detail on the two that matter for readiness ----------------------------
for name in ('Jurisdictions', 'Hazards_of_Concern'):
    allrows, nas, seen = results[name]
    missing = [a for a in alias if a['geoid'] not in seen]
    print(f'\n{name}: {len(seen)} of 70 alias jurisdictions present; {len(missing)} missing')
    for a in missing[:20]:
        print(f'    {a["geoid"]:12s} {a["jurisdiction_title"]:34s} annex={a["has_annex"]:3s} {a["adoption_status"]}')

# --- write the flags back onto the alias table ------------------------------
_, _, hoc_seen = results['Hazards_of_Concern']
_, _, jur_seen = results['Jurisdictions']
for a in alias:
    a['in_jurisdictions'] = 'yes' if a['geoid'] in jur_seen else 'no'
    a['n_hoc_rows'] = hoc_seen.get(a['geoid'], 0)
    a['in_hoc'] = 'yes' if hoc_seen.get(a['geoid']) else 'no'
with io.open(ALIAS, 'w', encoding='utf-8', newline='') as fh:
    w = csv.DictWriter(fh, fieldnames=list(alias[0].keys()))
    w.writeheader()
    w.writerows(alias)
print(f'\nwrote pre-load flags into {ALIAS}')
print('  in_jurisdictions:', dict(collections.Counter(a['in_jurisdictions'] for a in alias)))
print('  in_hoc          :', dict(collections.Counter(a['in_hoc'] for a in alias)))
print('  n_hoc_rows      :', dict(collections.Counter(a['n_hoc_rows'] for a in alias)))
