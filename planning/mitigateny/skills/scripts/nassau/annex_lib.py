"""Shared parsing helpers for the Nassau (Hagerty) annex corpus.

Adds two things docx_outline2 does not have:

* `cell_lines()` — the POC cells hold ONE paragraph containing `<w:br/>` line breaks, not
  several paragraphs. `para_text()` walks `w:t` nodes and joins with '', so the breaks vanish
  and the cell reads `Mayor Timothy Tenke, MayorCity of Glen Cove9 Glen Street...`. This keeps
  them.
* table classification by (shape + column-0 labels), never by header text or row count —
  see the profile's corpus variances.
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), os.pardir, 'suffolk'))

from docx.table import Table                                    # noqa: E402
from docx.text.paragraph import Paragraph                       # noqa: E402
from docx_outline2 import iter_block_items, para_text           # noqa: E402

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'


def para_lines(p_el):
    """Text of a <w:p>, with '\\n' where a <w:br/> or <w:cr/> appears."""
    out = []
    for node in p_el.iter():
        if node.tag in (W + 'br', W + 'cr'):
            out.append('\n')
        elif node.tag == W + 't':
            out.append(node.text or '')
    return ''.join(out)


def cell_lines(c):
    """Non-empty lines of a table cell, honouring both paragraphs and line breaks."""
    lines = []
    for p in c.paragraphs:
        for ln in para_lines(p._p).split('\n'):
            ln = ln.strip()
            if ln:
                lines.append(ln)
    return lines


def cell_text(c):
    return ' '.join(cell_lines(c))


def row_cells(r):
    """Cell texts for a row, de-duplicating horizontally merged cells by <w:tc> identity."""
    out, seen = [], None
    for c in r.cells:
        if c._tc is seen:
            continue
        seen = c._tc
        out.append(cell_text(c))
    return out


def row_cell_objs(r):
    out, seen = [], None
    for c in r.cells:
        if c._tc is seen:
            continue
        seen = c._tc
        out.append(c)
    return out


# ---------------------------------------------------------------- tables ----
def table_grid(t):
    """(rows x cols, col0 labels, full grid) with merged cells de-duplicated per row."""
    grid = [row_cells(r) for r in t.rows]
    col0 = [g[0] if g else '' for g in grid]
    return grid, col0


FOOTNOTE = re.compile(r'^\d+(?=[A-Z])|\d+$')


def delabel(s):
    """Strip superscript footnote markers fused into a label.

    Five annexes render the POC header as "1Primary Point of Contact" - a superscript footnote
    reference lands in the same run, so exact-match classification silently fails and the whole
    contact table is dropped. Tetra Tech annexes do the same thing with TRAILING digits on hazard
    names ("Flood1"), so strip both ends.
    """
    return FOOTNOTE.sub('', (s or '').strip()).strip()


def classify(t):
    """Name a table from its column-0 labels and shape. Returns a key or None."""
    grid, col0 = table_grid(t)
    n = len(grid)
    w = max((len(g) for g in grid), default=0)
    c0 = [delabel(c) for c in col0]
    first = c0[0] if c0 else ''

    if first == 'Primary Point of Contact':
        return 'poc'
    if first == 'Demographic':
        return 'demographics'
    if first == 'Hazard' and n >= 10:
        return 'hazard_impacts'
    if first == 'Regulatory Tool':
        return 'cap_regulatory'
    if first == 'Staff / Personnel Resource':
        return 'cap_staff'
    if first == 'Resources':
        return 'cap_fiscal'
    if first == 'Classification':
        return 'cap_classification'
    # actions -------------------------------------------------------------
    if c0[:2] == ['Project Number', 'Project Name']:
        return 'proposed_actions'
    if c0[:2] == ['Project Name', 'Goal being met']:
        return 'completed_actions'
    if first == 'Action':
        return 'prior_actions_transposed' if len(c0) > 1 and c0[1] == 'Risk Category' \
            else 'prior_actions_rowwise'
    return None


def transposed_records(grid):
    """A transposed table -> one dict per data COLUMN, keyed by the column-0 label.

    Field labels are in column 0; every additional column is one record. Trailing all-empty
    rows and columns are ignored (Long Beach's proposed table is 15x8, not 14x8).
    """
    labels = [g[0].strip() for g in grid]
    ncol = max((len(g) for g in grid), default=0)
    recs = []
    for ci in range(1, ncol):
        rec, any_val = {}, False
        for ri, lab in enumerate(labels):
            if not lab:
                continue
            row = grid[ri]
            val = row[ci].strip() if ci < len(row) else ''
            rec[lab] = val
            if val:
                any_val = True
        if any_val:
            recs.append(rec)
    return recs


def rowwise_records(grid):
    """A normal row-per-record table -> one dict per data row, keyed by the header row."""
    if not grid:
        return []
    hdr = [h.strip() for h in grid[0]]
    out = []
    for row in grid[1:]:
        if not any(c.strip() for c in row):
            continue
        out.append({(hdr[i] if i < len(hdr) and hdr[i] else f'col{i}'): row[i].strip()
                    for i in range(len(row))})
    return out


# ------------------------------------------------------------------ POC ----
EMAIL = re.compile(r'[\w.+-]+@[\w-]+\.[\w.]+')
PHONE = re.compile(r'\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}')
ZIPLINE = re.compile(r',\s*[A-Z]{2}\s+\d{5}')


def parse_poc(lines):
    """Parse a labelless POC blob into fields. `lines` is cell_lines() output.

    Line 1 is "<Name>, <Title>"; then agency, street, city/state/ZIP, email, phone in
    whatever order they appear. Email and phone are matched, not positional.
    """
    if not lines:
        return None
    rec = {'name': '', 'title': '', 'agency': '', 'address': [], 'email': '', 'phone': '',
           'raw': lines}
    head = lines[0]
    if ',' in head:
        rec['name'], rec['title'] = [x.strip() for x in head.split(',', 1)]
    else:
        rec['name'] = head.strip()
    for ln in lines[1:]:
        m = EMAIL.search(ln)
        if m:
            rec['email'] = m.group(0)
            continue
        if PHONE.search(ln) and not any(ch.isalpha() for ch in ln.replace('ext', '')):
            rec['phone'] = ln.strip()
            continue
        if not rec['agency']:
            rec['agency'] = ln.strip()
            continue
        rec['address'].append(ln.strip())
    return rec


# -------------------------------------------------------------- headings ----
def strip_doubled_heading(text, tail='Hazard Vulnerability'):
    """The Hazard Vulnerability heading is "<sentence><sentence>Hazard Vulnerability".

    Returns (sentence_or_None, heading). 46 of 51 annexes double the sentence; 5 have none.
    """
    t = (text or '').strip()
    if not t.endswith(tail):
        return None, t
    body = t[:-len(tail)].strip()
    if not body:
        return None, tail
    half = len(body) // 2
    if len(body) % 2 == 0 and body[:half] == body[half:]:
        body = body[:half]
    else:                                     # tolerate a non-exact repeat
        m = re.match(r'^(.*?[.!])\1', body)
        if m:
            body = m.group(1)
    return body.strip(), tail


def blocks_of(doc):
    """(kind, style, text_or_table) tuples in document order."""
    for b in iter_block_items(doc):
        if isinstance(b, Paragraph):
            yield ('p', (b.style.name if b.style else ''), para_text(b._p))
        elif isinstance(b, Table):
            yield ('tbl', '', b)
