import json, re
secs = json.load(open('../out/baseplan/sections.json'))
# Natural Hazards H2 at 882; hazards are H3 from 889 to 1719(non-natural H2)
haz_starts = [s for s in secs if s['lvl']==3 and 889 <= s['n'] < 1719]
bounds = []
for i,h in enumerate(haz_starts):
    end = haz_starts[i+1]['n'] if i+1 < len(haz_starts) else 1719
    bounds.append((h['title'], h['n'], end))
SUBS = ['Overview','General Vulnerability','Local Hazard Summary',
        'Declarations and Their Effects on the County','Featured Event',
        'County Assessment','Jurisdictional Assessment',
        'Built Environment: Local Risk Summary','People and Communities: Local Risk Summary',
        'Natural Environment: Local Risk Summary','Local Capabilities','Local Actions','Featured Strategy']
rows=[]
for title, a, b in bounds:
    inner = [s for s in secs if a < s['n'] < b]
    rec = {'hazard': title, 'n': a}
    for sub in SUBS:
        hits = [s for s in inner if s['title'].strip()==sub]
        if hits:
            tot = sum(h['chars'] for h in hits)
            rec[sub] = f"{hits[0]['n']}:{tot}" if tot else f"{hits[0]['n']}:0"
        else:
            rec[sub] = '-'
    rows.append(rec)
json.dump(rows, open('../out/baseplan/hazard_matrix.json','w'), indent=1)
hdr = ['hazard'] + SUBS
w = [26] + [10]*len(SUBS)
abbr = {'Overview':'Ovw','General Vulnerability':'GenVuln','Local Hazard Summary':'LclHazSum',
 'Declarations and Their Effects on the County':'Declns','Featured Event':'FeatEvt',
 'County Assessment':'CntyAsmt','Jurisdictional Assessment':'JurAsmt',
 'Built Environment: Local Risk Summary':'BE-LRS','People and Communities: Local Risk Summary':'PC-LRS',
 'Natural Environment: Local Risk Summary':'NE-LRS','Local Capabilities':'LclCap',
 'Local Actions':'LclAct','Featured Strategy':'FeatStrat'}
print(f"{'hazard':26}" + ''.join(f"{abbr[s]:>12}" for s in SUBS))
for r in rows:
    print(f"{r['hazard'][:25]:26}" + ''.join(f"{r[s]:>12}" for s in SUBS))
