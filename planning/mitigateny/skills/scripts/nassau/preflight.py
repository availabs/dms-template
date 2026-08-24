"""Corpus pre-flight scan of the Nassau (Hagerty) jurisdictional annexes.

For every annex folder under "All Annexes", pick the annex docx (excluding MAW files),
walk its headings + table shapes, and emit one JSON record per folder.

Purpose: confirm the Hagerty section spine is uniform before committing to a parser,
and surface per-folder file-selection hazards (pdf-only, multiple docx revisions,
8.3 short names).

usage: preflight.py <all-annexes-dir> [out.json]
"""
import json
import os
import re
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
# docx_outline2.py lives beside this file in the working folder, and in
# planning/mitigateny/skills/scripts/suffolk/ in the committed copy.
sys.path[:0] = [_HERE, os.path.join(_HERE, os.pardir, 'suffolk')]
from docx_outline2 import para_text, iter_block_items, cell_text  # noqa: E402
from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph

ROOT = sys.argv[1]
OUT = sys.argv[2] if len(sys.argv) > 2 else None

MAW_RE = re.compile(r'^MAW\d+', re.I)


def pick_annex(folder):
    """Choose the annex docx in a folder. Returns (path, note)."""
    files = sorted(os.listdir(folder))
    docx = [f for f in files
            if f.lower().endswith(('.docx', '.doc'))
            and not f.startswith('~$')
            and not MAW_RE.match(f)]
    pdf = [f for f in files if f.lower().endswith('.pdf') and not MAW_RE.match(f)]
    if not docx:
        return None, f'NO DOCX (pdf only: {len(pdf)})'
    note = ''
    if len(docx) > 1:
        # prefer a name containing FINAL / Revisions, else the longest name
        pref = [f for f in docx if re.search(r'final|revision', f, re.I)]
        pick = (pref or sorted(docx, key=len, reverse=True))[0]
        note = f'{len(docx)} candidates, picked {pick!r}'
    else:
        pick = docx[0]
    if pick.lower().endswith('.doc'):
        note = (note + '; ' if note else '') + 'legacy .doc — python-docx cannot read'
    if '~' in pick:
        note = (note + '; ' if note else '') + '8.3 short filename'
    return os.path.join(folder, pick), note


def scan(path):
    doc = Document(path)
    blocks = []
    for b in iter_block_items(doc):
        if isinstance(b, Paragraph):
            t = para_text(b._p)
            if not t:
                continue
            blocks.append({'kind': 'p', 'style': b.style.name if b.style else '', 'text': t})
        elif isinstance(b, Table):
            rows = len(b.rows)
            cols = max((len(r.cells) for r in b.rows), default=0)
            hdr = [cell_text(c) for c in b.rows[0].cells] if rows else []
            col0 = [cell_text(r.cells[0]) for r in b.rows] if rows else []
            blocks.append({'kind': 'tbl', 'shape': f'{rows}x{cols}',
                           'rows': rows, 'cols': cols,
                           'header': hdr, 'col0': col0})
    return blocks


records = []
for name in sorted(os.listdir(ROOT)):
    folder = os.path.join(ROOT, name)
    if not os.path.isdir(folder):
        continue
    path, note = pick_annex(folder)
    rec = {'folder': name, 'file': os.path.basename(path) if path else None, 'note': note}
    maws = [f for f in sorted(os.listdir(folder)) if MAW_RE.match(f) and f.lower().endswith('.docx')]
    rec['maw_files'] = maws
    if path is None or path.lower().endswith('.doc'):
        rec['error'] = note
        records.append(rec)
        print(f'{name:34s} SKIP  {note}')
        continue
    try:
        blocks = scan(path)
    except Exception as e:  # noqa: BLE001
        rec['error'] = f'{type(e).__name__}: {e}'
        records.append(rec)
        print(f'{name:34s} ERROR {rec["error"]}')
        continue
    heads = [b for b in blocks if b['kind'] == 'p' and b['style'].startswith('Heading')]
    tbls = [b for b in blocks if b['kind'] == 'tbl']
    rec['headings'] = [{'style': h['style'], 'text': h['text'][:160]} for h in heads]
    rec['tables'] = [{'shape': t['shape'], 'header': t['header'][:4], 'col0': t['col0'][:30]} for t in tbls]
    rec['styles'] = sorted({b['style'] for b in blocks if b['kind'] == 'p'})
    rec['n_paras'] = sum(1 for b in blocks if b['kind'] == 'p')
    records.append(rec)
    print(f'{name:34s} heads={len(heads):2d} tbls={len(tbls):2d} paras={rec["n_paras"]:3d} '
          f'shapes={",".join(t["shape"] for t in tbls)}  {note}')

if OUT:
    with open(OUT, 'w', encoding='utf-8') as fh:
        json.dump(records, fh, indent=1, ensure_ascii=False)
    print(f'\nwrote {OUT}  ({len(records)} folders)')
