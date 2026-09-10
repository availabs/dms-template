# -*- coding: utf-8 -*-
"""Second-pass extraction: per-paragraph RUN formatting + true list membership.

    python docx_runs.py "<baseplan>.docx" ../out/baseplan

Writes  <outdir>/runs.json  ->  { "<block n>": {style, list, runs:[{text,b,i}]} }

Block numbering is identical to docx_dump.py (same iter_block_items walk, same
"skip empty paragraphs" rule), so `n` joins straight onto blocks.json /
sections.json. Keep the two walks in sync or the join silently misaligns.

Why a second pass instead of extending docx_dump.py: blocks.json is already
cited by block number all over the crosswalk and the task doc. Rewriting it
risks renumbering; this only adds.

Two things python-docx makes easy to get wrong:

* `run.bold` is tri-state - True / False / None. None means "inherit from the
  style", NOT "not bold". A heading run is usually None and still renders bold.
  We resolve None against the paragraph style's own bold, so a Body Text run
  with None is correctly not-bold.
* A paragraph is a list item either by STYLE (`List Paragraph`, `Bullet 1`) or
  by direct numbering (`w:pPr/w:numPr`), and IEM uses both. Style alone misses
  paragraphs that carry numPr with a Body Text style. `numId`/`ilvl` are also
  what tell bullet from number apart.
"""
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


def style_is_bold(style):
    """Walk the style chain; return True if the style itself sets bold."""
    seen = 0
    while style is not None and seen < 10:
        try:
            if style.font is not None and style.font.bold is not None:
                return bool(style.font.bold)
        except Exception:
            pass
        style = getattr(style, 'base_style', None)
        seen += 1
    return False


def load_numbering(docx_path):
    """numId -> {ilvl: numFmt} from word/numbering.xml.

    python-docx does not expose numFmt, and it is the only thing that separates a
    BULLET list from a NUMBERED one. Guessing "bullet" is wrong: on the IEM base
    plan 8 of 53 list paragraphs are `decimal` (numId 30 and 32, both in the
    Monitoring/Updating subsections).
    """
    import zipfile
    from lxml import etree
    W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
    try:
        z = zipfile.ZipFile(docx_path)
        if 'word/numbering.xml' not in z.namelist():
            return {}
        root = etree.fromstring(z.read('word/numbering.xml'))
    except Exception:
        return {}
    abs_fmt = {}
    for an in root.iter(W + 'abstractNum'):
        aid = an.get(W + 'abstractNumId')
        lv = {}
        for l in an.iter(W + 'lvl'):
            f = l.find(W + 'numFmt')
            lv[l.get(W + 'ilvl')] = f.get(W + 'val') if f is not None else None
        abs_fmt[aid] = lv
    out = {}
    for nm in root.iter(W + 'num'):
        a = nm.find(W + 'abstractNumId')
        if a is not None:
            out[nm.get(W + 'numId')] = abs_fmt.get(a.get(W + 'val'), {})
    return out


def list_info(p):
    """(is_list, numId, ilvl) from direct numbering, else style name.

    numId="0" is Word's *remove numbering* sentinel, not a list id - it must not
    make a paragraph a list on its own. A list STYLE still wins (block [769] is
    `Bullet 1` with numId=0 and is genuinely a bullet).
    """
    numId = ilvl = None
    pPr = p._p.find(qn('w:pPr'))
    if pPr is not None:
        numPr = pPr.find(qn('w:numPr'))
        if numPr is not None:
            nid = numPr.find(qn('w:numId'))
            lvl = numPr.find(qn('w:ilvl'))
            if nid is not None:
                numId = nid.get(qn('w:val'))
            if lvl is not None:
                ilvl = lvl.get(qn('w:val'))
    st = (p.style.name if p.style is not None else '') or ''
    by_style = st in ('List Paragraph', 'Bullet 1') or st.lower().startswith('list')
    by_num = numId is not None and numId != '0'
    return (by_num or by_style), numId, ilvl


def _run_text(r_el):
    """Text of a w:r, including tabs and breaks, in document order."""
    out = []
    for c in r_el.iter():
        if c.tag == qn('w:t'):
            out.append(c.text or '')
        elif c.tag == qn('w:tab'):
            out.append('\t')
        elif c.tag in (qn('w:br'), qn('w:cr')):
            out.append('\n')
    return ''.join(out)


def _bold_of(r_el, st_bold):
    """Resolve a w:r's bold, honouring the tri-state inherit rule."""
    rPr = r_el.find(qn('w:rPr'))
    if rPr is not None:
        b = rPr.find(qn('w:b'))
        if b is not None:
            v = b.get(qn('w:val'))
            return v not in ('0', 'false', 'none')
    return st_bold


def _italic_of(r_el):
    rPr = r_el.find(qn('w:rPr'))
    if rPr is not None:
        it = rPr.find(qn('w:i'))
        if it is not None:
            return it.get(qn('w:val')) not in ('0', 'false', 'none')
    return False


def walk_runs(p, st_bold):
    """Runs in document order, INCLUDING those nested in w:hyperlink.

    `Paragraph.runs` only returns w:r children directly under w:p, so every run
    inside a w:hyperlink is silently dropped. On the IEM base plan that lost the
    text of 10 "Sources:" citations - the paragraphs read
    'Sources: ; ; and U.S. Census Bureau QuickFacts.' with the linked publication
    names missing. Walk the children instead, and carry the URL out so the
    formatter can emit a real lexical link node.
    """
    rels = p.part.rels
    out = []
    for child in p._p.iterchildren():
        if child.tag == qn('w:r'):
            t = _run_text(child)
            if t:
                out.append({'text': t, 'b': _bold_of(child, st_bold),
                            'i': _italic_of(child)})
        elif child.tag == qn('w:hyperlink'):
            rid = child.get(qn('r:id'))
            url = None
            if rid and rid in rels:
                url = rels[rid].target_ref
            anchor = child.get(qn('w:anchor'))
            for r_el in child.iter(qn('w:r')):
                t = _run_text(r_el)
                if not t:
                    continue
                run = {'text': t, 'b': _bold_of(r_el, st_bold),
                       'i': _italic_of(r_el)}
                if url:
                    run['url'] = url          # external link
                elif anchor:
                    run['anchor'] = anchor    # internal bookmark - not a link node
                out.append(run)
    return out


def main():
    path, outdir = sys.argv[1], sys.argv[2]
    os.makedirs(outdir, exist_ok=True)
    doc = Document(path)
    numbering = load_numbering(path)

    out = {}
    n = 0
    for item in iter_block_items(doc):
        if isinstance(item, Paragraph):
            if not item.text.strip():
                continue                      # same skip rule as docx_dump.py
            n += 1
            st = item.style.name if item.style is not None else ''
            st_bold = style_is_bold(item.style)
            is_list, numId, ilvl = list_info(item)

            runs = walk_runs(item, st_bold)

            # coalesce adjacent runs with identical formatting - Word splits runs
            # on spellcheck/rsid boundaries, so "**Flood** **of** **2006**" is
            # commonly 3+ runs that must render as one bold span.
            merged = []
            for r in runs:
                m = merged[-1] if merged else None
                same = (m is not None and m['b'] == r['b'] and m['i'] == r['i']
                        and m.get('url') == r.get('url'))
                if same:
                    m['text'] += r['text']
                else:
                    merged.append(dict(r))

            fmt = None
            if is_list:
                if numId and numId != '0':
                    fmt = numbering.get(numId, {}).get(ilvl or '0')
                fmt = fmt or 'bullet'      # style-only lists are bullets
            out[str(n)] = {
                'style': st, 'list': is_list, 'numId': numId, 'ilvl': ilvl,
                'numFmt': fmt, 'ordered': fmt not in (None, 'bullet'),
                'style_bold': st_bold, 'runs': merged,
            }
        else:
            n += 1                            # tables occupy a number, no runs

    json.dump(out, open(os.path.join(outdir, 'runs.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)

    # ---- summary
    nlist = sum(1 for v in out.values() if v['list'])
    nlink = sum(1 for v in out.values() if any(r.get('url') for r in v['runs']))
    nlinks = sum(sum(1 for r in v['runs'] if r.get('url')) for v in out.values())
    nbold = sum(1 for v in out.values() if any(r['b'] for r in v['runs']))
    allbold = sum(1 for v in out.values()
                  if v['runs'] and all(r['b'] for r in v['runs']))
    partial = sum(1 for v in out.values()
                  if any(r['b'] for r in v['runs']) and not all(r['b'] for r in v['runs']))
    print('paragraphs with runs:   %d' % len(out))
    print('list paragraphs:        %d' % nlist)
    print('with any bold run:      %d' % nbold)
    print('  entirely bold:        %d' % allbold)
    print('  partially bold:       %d  <- the real lead-in labels' % partial)
    print('paragraphs with links:  %d  (%d link runs)' % (nlink, nlinks))
    nb = sum(1 for v in out.values() if v['list'] and not v['ordered'])
    no = sum(1 for v in out.values() if v['list'] and v['ordered'])
    print('  bullet / numbered:    %d / %d' % (nb, no))
    print('wrote %s' % os.path.join(outdir, 'runs.json'))


if __name__ == '__main__':
    main()
