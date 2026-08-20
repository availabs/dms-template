"""Annex extractor that DOES capture Word content-control checkboxes.

python-docx's Paragraph.text only walks <w:r> children that are direct children of
<w:p>. Every checkbox in a TetraTech annex lives inside a <w:sdt> content control, so
those runs -- and the checked/unchecked glyph -- are silently dropped. This walks the
XML directly instead.

Importable: para_text() / iter_block_items() / cell_text() are reused by preflight.py,
so nothing runs at import time.

usage: docx_outline2.py <docx> [--headings] [--maxchars N]
"""
import sys
from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph
from docx.oxml.ns import qn

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
W14 = '{http://schemas.microsoft.com/office/word/2010/wordml}'


def para_text(p_el):
    """Text of a <w:p>, including runs nested in <w:sdt> content controls.

    A checkbox sdt is emitted as [x] or [ ] so the selected option survives extraction.
    """
    out = []
    for node in p_el.iter():
        if node.tag == W + 'sdt':
            cb = node.find(f'.//{W14}checkbox')
            if cb is not None:
                checked = cb.find(f'{W14}checked')
                val = checked.get(f'{W14}val') if checked is not None else '0'
                out.append('[x]' if val in ('1', 'true') else '[ ]')
        elif node.tag == W + 't':
            # skip the glyph run belonging to a checkbox sdt (already emitted above)
            anc = node
            in_cb = False
            for _ in range(6):
                anc = anc.getparent()
                if anc is None:
                    break
                if anc.tag == W + 'sdt' and anc.find(f'.//{W14}checkbox') is not None:
                    in_cb = True
                    break
            if not in_cb:
                out.append(node.text or '')
    return ''.join(out).strip()


def iter_block_items(doc):
    for child in doc.element.body.iterchildren():
        if child.tag == qn('w:p'):
            yield Paragraph(child, doc)
        elif child.tag == qn('w:tbl'):
            yield Table(child, doc)


def cell_text(c):
    return " ".join(x for x in (para_text(p._p) for p in c.paragraphs) if x)


def row_cells(r):
    """Cell texts for a row, de-duplicating horizontally merged cells.

    Merged cells are returned once per grid column backed by the SAME <w:tc>. Dedupe on
    element identity, never on text -- deduping on text collapses adjacent distinct "[ ]"
    checkbox cells and misaligns scoring grids.
    """
    out, seen = [], None
    for c in r.cells:
        if c._tc is seen:
            continue
        seen = c._tc
        out.append(cell_text(c))
    return out


def main():
    path = sys.argv[1]
    headings_only = '--headings' in sys.argv
    maxchars = 400
    if '--maxchars' in sys.argv:
        maxchars = int(sys.argv[sys.argv.index('--maxchars') + 1])

    doc = Document(path)
    n = 0
    for block in iter_block_items(doc):
        n += 1
        if isinstance(block, Paragraph):
            style = block.style.name if block.style is not None else '?'
            txt = para_text(block._p)
            if not txt:
                continue
            if headings_only and not (style.lower().startswith('heading')
                                      or 'head' in style.lower()):
                continue
            print(f"[{n:5d}] <{style}> {txt[:maxchars]}")
        else:
            rows = block.rows
            print(f"[{n:5d}] <TABLE {len(rows)}x{len(block.columns)}>")
            if headings_only:
                if rows:
                    print("        HDR: " + " || ".join(c[:80] for c in row_cells(rows[0])))
                continue
            for ri, r in enumerate(rows):
                line = " || ".join(x[:maxchars] for x in row_cells(r))
                print(f"        r{ri}: {line[:1800]}")


if __name__ == '__main__':
    main()
