"""Dump the live attribute list for a forms source, with select options."""
import io
import json
import sys

D = 'references/mny-transcribe/Nassau/context/extracted/'
SIDS = {'1473468': 'Participation', '1473470': 'Hazards_of_Concern',
        '1068273': 'Capabilities_Catalogue', '1689772': 'Capacities'}

out = []
for sid, name in SIDS.items():
    d = json.load(io.open(D + f'live_{sid}.json', encoding='utf-8'))
    dd = d.get('data', d)
    cfg = dd.get('config')
    if isinstance(cfg, str):
        cfg = json.loads(cfg)
    out.append(f'\n{"=" * 78}\n=== {name}  (source {sid})  {len(cfg["attributes"])} attributes\n{"=" * 78}')
    for a in cfg['attributes']:
        n = str(a.get('name') or '')
        if len(n) > 70:                     # calculated SQL expressions
            out.append(f'  [calc] {str(a.get("display_name"))}')
            continue
        t = str(a.get('type'))
        req = ' REQ' if a.get('required') else ''
        o = a.get('options')
        if isinstance(o, str):
            try:
                o = json.loads(o)
            except Exception:
                o = None
        opts = ''
        if o:
            vals = [x['value'] if isinstance(x, dict) else str(x) for x in o]
            opts = '  opts=[' + ' | '.join(vals) + ']'
        out.append(f'  {n:44s} {t:12s}{req:4s} {a.get("display_name")}{opts}')

txt = '\n'.join(out)
io.open(D + 'live_schemas.txt', 'w', encoding='utf-8').write(txt)
print(txt)
