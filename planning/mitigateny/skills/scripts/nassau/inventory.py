"""Full file inventory of every Nassau annex folder, for the authoritative-file determination.

Lists every file (including subfolders) with size and mtime, and for readable .docx also
reports heading count, table shape signature and paragraph count so two revisions of the
same annex can be compared on content rather than on filename.
"""
import io
import os
import re
import sys
import json

sys.path.insert(0, 'references/mny-transcribe/Nassau/context/scripts')
from docx_outline2 import para_text, iter_block_items, cell_text  # noqa: E402
from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph

ROOT = 'references/mny-transcribe/Nassau/All Annexes'
MAW_RE = re.compile(r'^MAW\d+', re.I)


def probe(path):
    try:
        doc = Document(path)
    except Exception as e:  # noqa: BLE001
        return {'error': f'{type(e).__name__}'}
    heads, tbls, paras, chars = 0, [], 0, 0
    for b in iter_block_items(doc):
        if isinstance(b, Paragraph):
            t = para_text(b._p)
            if not t:
                continue
            paras += 1
            chars += len(t)
            if b.style and b.style.name.startswith(('Heading', 'SectionTitle')):
                heads += 1
        elif isinstance(b, Table):
            rows = len(b.rows)
            cols = max((len(r.cells) for r in b.rows), default=0)
            tbls.append(f'{rows}x{cols}')
            for r in b.rows:
                for c in r.cells:
                    chars += len(cell_text(c))
    return {'heads': heads, 'tables': ','.join(tbls), 'n_tables': len(tbls),
            'paras': paras, 'chars': chars}


out = []
for folder in sorted(os.listdir(ROOT)):
    fp = os.path.join(ROOT, folder)
    if not os.path.isdir(fp):
        continue
    entries = []
    for dirpath, _dirnames, filenames in os.walk(fp):
        rel = os.path.relpath(dirpath, fp)
        for fn in sorted(filenames):
            if fn.startswith('~$'):
                continue
            full = os.path.join(dirpath, fn)
            st = os.stat(full)
            e = {'name': (fn if rel == '.' else f'{rel}/{fn}'),
                 'kb': round(st.st_size / 1024),
                 'mtime': __import__('datetime').datetime.fromtimestamp(st.st_mtime).strftime('%Y-%m-%d'),
                 'kind': ('MAW' if MAW_RE.match(fn) else 'annex'),
                 'ext': os.path.splitext(fn)[1].lower()}
            if e['ext'] == '.docx' and e['kind'] == 'annex':
                e.update(probe(full))
            entries.append(e)
    out.append({'folder': folder, 'files': entries})

with io.open('references/mny-transcribe/Nassau/context/extracted/file_inventory.json', 'w',
             encoding='utf-8') as fh:
    json.dump(out, fh, indent=1, ensure_ascii=False)

# print only the folders that need a decision: >1 annex candidate, or no docx, or a subfolder
for rec in out:
    ann = [f for f in rec['files'] if f['kind'] == 'annex' and f['ext'] in ('.docx', '.doc')]
    pdf = [f for f in rec['files'] if f['kind'] == 'annex' and f['ext'] == '.pdf']
    maw = [f for f in rec['files'] if f['kind'] == 'MAW']
    mawpdf = [f for f in maw if f['ext'] == '.pdf']
    sub = [f for f in rec['files'] if '/' in f['name']]
    odd = [f for f in rec['files'] if f['ext'] not in ('.docx', '.doc', '.pdf')]
    flag = len(ann) != 1 or sub or odd or not maw or mawpdf or len(pdf) > 1
    if not flag:
        continue
    print(f"\n### {rec['folder']}   annex_docx={len(ann)} annex_pdf={len(pdf)} maw={len(maw)}")
    for f in rec['files']:
        extra = ''
        if 'chars' in f:
            extra = f"  heads={f['heads']} tbls={f['n_tables']} paras={f['paras']} chars={f['chars']}"
        elif 'error' in f:
            extra = f"  UNREADABLE {f['error']}"
        print(f"   [{f['kind']:5s}] {f['kb']:6d}KB {f['mtime']}  {f['name']}{extra}")
print(f"\n({len(out)} folders scanned; full inventory in extracted/file_inventory.json)")
