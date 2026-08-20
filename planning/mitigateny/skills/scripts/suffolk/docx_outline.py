"""Extract a docx annex to a readable outline: styled paragraphs + tables, in document order.

usage: docx_outline.py <docx> [--headings] [--maxchars N]
"""
import sys
from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph
from docx.oxml.ns import qn

path = sys.argv[1]
headings_only = '--headings' in sys.argv
maxchars = 400
if '--maxchars' in sys.argv:
    maxchars = int(sys.argv[sys.argv.index('--maxchars') + 1])

doc = Document(path)


def iter_block_items(parent):
    body = parent.element.body
    for child in body.iterchildren():
        if child.tag == qn('w:p'):
            yield Paragraph(child, parent)
        elif child.tag == qn('w:tbl'):
            yield Table(child, parent)


def cell_text(c):
    return " ".join(p.text.strip() for p in c.paragraphs if p.text.strip())


n = 0
for block in iter_block_items(doc):
    n += 1
    if isinstance(block, Paragraph):
        style = block.style.name if block.style is not None else '?'
        txt = block.text.strip()
        if not txt:
            continue
        if headings_only and not (style.lower().startswith('heading')
                                  or 'head' in style.lower()
                                  or style.startswith('Tt')):
            continue
        print(f"[{n:5d}] <{style}> {txt[:maxchars]}")
    else:
        rows = block.rows
        ncols = len(block.columns)
        print(f"[{n:5d}] <TABLE {len(rows)}x{ncols}>")
        if headings_only:
            # just first row
            if rows:
                print("        HDR: " + " || ".join(cell_text(c)[:80] for c in rows[0].cells))
            continue
        for ri, r in enumerate(rows):
            cells = [cell_text(c) for c in r.cells]
            # dedupe merged repeats
            out = []
            for c in cells:
                if out and out[-1] == c:
                    continue
                out.append(c)
            line = " || ".join(x[:maxchars] for x in out)
            print(f"        r{ri}: {line[:1800]}")
