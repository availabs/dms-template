import json, sys, re
blocks = json.load(open('../out/baseplan/blocks.json'))
# body starts at first "Heading 1" after TOC region; find index of block n==562 (Executive Summary)
start = next(i for i,b in enumerate(blocks) if b['n']>=562)
body = blocks[start:]
HEAD = re.compile(r'^(Heading|H\d )', re.I)
def lvl(b):
    s=b.get('style','')
    m=re.match(r'Heading (\d)', s)
    if m: return int(m.group(1))
    m=re.match(r'H(\d) Appendix', s)
    if m: return int(m.group(1))
    if s=='Appendix Title Cover': return 1
    return None
secs=[]
cur=None
for b in body:
    if b['kind']=='p' and lvl(b):
        cur={'n':b['n'],'lvl':lvl(b),'title':b['text'],'paras':[],'tables':0,'chars':0,'captions':[]}
        secs.append(cur)
    elif cur is not None:
        if b['kind']=='table':
            cur['tables']+=1
        elif b['style']=='Caption':
            cur['captions'].append(b['text'])
        else:
            cur['paras'].append(b)
            cur['chars']+=len(b['text'])
json.dump([{k:v for k,v in s.items()} for s in secs], open('../out/baseplan/sections.json','w'), indent=1)
with open('../out/baseplan/section_map.txt','w',encoding='utf-8') as f:
    for s in secs:
        ind='  '*(s['lvl']-1)
        flag = 'CONTENT' if s['chars']>40 else ('thin' if s['chars']>0 else 'EMPTY')
        f.write(f"{ind}H{s['lvl']} [{s['n']}] {s['title']}  -- {len(s['paras'])}p/{s['chars']}ch/{s['tables']}tbl  {flag}\n")
        if s['captions']: f.write(f"{ind}     cap: {' | '.join(s['captions'])[:200]}\n")
print('sections:',len(secs))
print('with content:',sum(1 for s in secs if s['chars']>40))
