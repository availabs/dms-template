import json, sys
secs = json.load(open('../out/baseplan/sections.json'))
targets = [int(x) for x in sys.argv[1:]]
by = {s['n']: s for s in secs}
for t in targets:
    s = by.get(t)
    if not s: print(f'--- [{t}] NOT FOUND'); continue
    print(f"=== H{s['lvl']} [{s['n']}] {s['title']}  ({len(s['paras'])}p / {s['chars']}ch / {s['tables']}tbl)")
    for p in s['paras']:
        print(f"  [{p['n']}][{p['style']}] {p['text']}")
    if s['captions']: print('  CAPTIONS:', s['captions'])
    print()
