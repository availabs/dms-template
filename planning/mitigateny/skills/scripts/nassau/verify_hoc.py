"""Verify the HOC assumption for Nassau, across BOTH views of source 1473470.

Payload key is `items` (not rows/data/results) — getting that wrong returns a silent zero.
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
OUT = 'references/mny-transcribe/Nassau/context/extracted/'


def dump(view, limit=500, offset=0):
    args = ['node', 'src/dms/packages/dms/cli/bin/dms.js', 'dataset', 'dump', '1473470',
            '--limit', str(limit), '--offset', str(offset)]
    if view:
        args[7:7] = ['--view', view]
    r = subprocess.run(args, capture_output=True, text=True, env=ENV,
                       encoding='utf-8', errors='replace')
    o = r.stdout or ''
    i = o.find('{')
    if i < 0:
        raise SystemExit('no JSON: ' + (r.stderr or '')[:300])
    return json.loads(o[i:]).get('items', [])


def gj(v):
    """geoid_juris comes as a list, or as a STRING holding a JSON array."""
    if isinstance(v, list):
        return str(v[0]) if v else ''
    if isinstance(v, str) and v.startswith('['):
        try:
            a = json.loads(v)
            return str(a[0]) if a else ''
        except Exception:
            return v.strip('[]')
    return str(v) if v is not None else ''


alias = list(csv.DictReader(io.open(ALIAS, encoding='utf-8')))
alias_geoids = {a['geoid'] for a in alias}

for view in ('1473471', '1603024'):
    allrows, offset = [], 0
    while True:
        page = dump(view, 500, offset)
        allrows += page
        if len(page) < 500:
            break
        offset += 500
        if offset > 60000:
            print('  !! stopped at 60k rows')
            break

    nassau = [r for r in allrows
              if gj(r.get('data', {}).get('geoid_juris')) in alias_geoids
              or str(r.get('data', {}).get('geoid_county')) == '36059']
    print(f'\n{"=" * 74}\nVIEW {view}: {len(allrows)} rows statewide, {len(nassau)} matching Nassau')
    if not nassau:
        continue
    d = [r['data'] for r in nassau]
    per = collections.Counter(gj(x.get('geoid_juris')) for x in d)
    print(f'  distinct Nassau geoid_juris : {len(per)}')
    print(f'  rows-per-jurisdiction shape : {dict(collections.Counter(per.values()))}')
    print(f'  hazard_of_concern           : {dict(collections.Counter(str(x.get("hazard_of_concern")) for x in d))}')
    hz = sorted({str(x.get('hazard')) for x in d})
    print(f'  hazard values ({len(hz)})        : {hz}')
    filled = {k: sum(1 for x in d if x.get(k) not in (None, '', [], {}))
              for k in ('general_vulnerability', 'likelihood', 'future_occurrence_assessment',
                        'other_comments', 'reason_for_exclusion', 'hazard_name_if_other',
                        'climate_change', 'secondary_hazards')}
    print(f'  non-empty content columns   : {filled}')
    missing = [a for a in alias if a['geoid'] not in per]
    print(f'  alias jurisdictions with NO HOC rows: {len(missing)}')
    for a in missing:
        print(f'      {a["geoid"]:12s} {a["jurisdiction_title"]:34s} annex={a["has_annex"]:3s} {a["adoption_status"]}')
    io.open(OUT + f'hoc_nassau_view{view}.json', 'w', encoding='utf-8').write(
        json.dumps(nassau, indent=1))
    print(f'  -> wrote extracted/hoc_nassau_view{view}.json')
