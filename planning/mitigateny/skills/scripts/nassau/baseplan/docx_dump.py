import sys, os, json
from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph
from docx.oxml.ns import qn

def iter_block_items(parent):
    body = parent.element.body
    for child in body.iterchildren():
        if child.tag == qn('w:p'):
            yield Paragraph(child, parent)
        elif child.tag == qn('w:tbl'):
            yield Table(child, parent)

path = sys.argv[1]
outdir = sys.argv[2]
os.makedirs(outdir, exist_ok=True)
doc = Document(path)
blocks = []
n = 0
for item in iter_block_items(doc):
    if isinstance(item, Paragraph):
        txt = item.text.strip()
        st = item.style.name if item.style is not None else ''
        if not txt:
            continue
        n += 1
        blocks.append({'n': n, 'kind': 'p', 'style': st, 'text': txt})
    else:
        n += 1
        rows = []
        for r in item.rows:
            cells = []
            seen = set()
            for c in r.cells:
                if id(c._tc) in seen: continue
                seen.add(id(c._tc))
                cells.append(' / '.join(p.text.strip() for p in c.paragraphs if p.text.strip()))
            rows.append(cells)
        blocks.append({'n': n, 'kind': 'table', 'nrows': len(item.rows), 'ncols': len(item.columns), 'rows': rows})

json.dump(blocks, open(os.path.join(outdir,'blocks.json'),'w'), indent=1)

# flat text dump
with open(os.path.join(outdir,'full.txt'),'w',encoding='utf-8') as f:
    for b in blocks:
        if b['kind']=='p':
            f.write(f"{b['n']:5d} [{b['style']}] {b['text']}\n")
        else:
            f.write(f"{b['n']:5d} [TABLE {b['nrows']}x{b['ncols']}]\n")
            for r in b['rows'][:40]:
                f.write(f"          | {' | '.join(x[:90] for x in r)}\n")

# heading outline
with open(os.path.join(outdir,'outline.txt'),'w',encoding='utf-8') as f:
    for b in blocks:
        if b['kind']=='p' and b['style'].lower().startswith('heading'):
            try: lvl = int(b['style'].split()[-1])
            except: lvl = 1
            f.write('  '*(lvl-1) + f"H{lvl} [{b['n']}] {b['text']}\n")
        elif b['kind']=='p' and b['style'] in ('Title','Subtitle'):
            f.write(f"** [{b['n']}] {b['style']}: {b['text']}\n")

styles = {}
for b in blocks:
    if b['kind']=='p': styles[b['style']] = styles.get(b['style'],0)+1
print('blocks:', len(blocks), 'tables:', sum(1 for b in blocks if b['kind']=='table'))
print('styles:', json.dumps(styles, indent=1, sort_keys=True))
