"""Structural pre-flight across every annex chapter.

Confirms the section spine holds, catches variant chapters, and produces real per-jurisdiction
counts so the batch extraction can be estimated instead of extrapolated from samples.

Content is NOT mapped here -- shapes and counts only.

usage: preflight.py <annex-dir> [--json out.json]
"""
import sys, os, re, json, glob
from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph
from docx.oxml.ns import qn

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from docx_outline2 import para_text  # reuse the checkbox-aware text extractor

ANNEX_DIR = sys.argv[1]
OUT = None
if '--json' in sys.argv:
    OUT = sys.argv[sys.argv.index('--json') + 1]

EXPECTED_H2 = [
    'Introduction',
    'Hazard Mitigation Planning Team',
    'Community Profile',
    'Jurisdictional Risk Assessment',
    'Growth/Development Trends',
    'National Flood Insurance Program Compliance',
    'Jurisdictional Capability Inventory and Assessment',
    'Mitigation Strategy and Prioritization',
]


def iter_blocks(doc):
    for child in doc.element.body.iterchildren():
        if child.tag == qn('w:p'):
            yield Paragraph(child, doc)
        elif child.tag == qn('w:tbl'):
            yield Table(child, doc)


def cell(c):
    return " ".join(x for x in (para_text(p._p) for p in c.paragraphs) if x)


def analyze(path):
    doc = Document(path)
    r = {
        'file': os.path.basename(path),
        'title': None, 'h2': [], 'h3': [], 'captions': [],
        'tables': [], 'n_tables': 0,
        'prior_actions': 0, 'proposed_actions': 0,
        'identified_issues': 0, 'hoc_rows': None,
        'roles_rows': None, 'ordinances_yes': 0, 'plans_yes': 0,
        'admin_yes': 0, 'fiscal_rows': None, 'outreach_rows': None,
        'prioritization_rows': 0, 'checked_boxes': 0, 'issue_styles': set(),
        'warnings': [],
    }
    section = None
    for b in iter_blocks(doc):
        if isinstance(b, Paragraph):
            style = b.style.name if b.style is not None else ''
            txt = para_text(b._p)
            if not txt:
                continue
            if style == 'Heading 1' and r['title'] is None:
                r['title'] = txt
            elif style == 'Heading 2':
                r['h2'].append(txt)
                section = txt
            elif style == 'Heading 3':
                r['h3'].append(txt)
                section = txt
            elif style == 'Caption':
                r['captions'].append(txt)
            elif section == 'Identified Issues' and (
                    style.startswith('Tt List Bullet') or style == 'List Paragraph'):
                # style varies by chapter: most use Tt List Bullet, some use List Paragraph
                r['identified_issues'] += 1
                r['issue_styles'].add(style)
        else:
            rows, cols = len(b.rows), len(b.columns)
            r['n_tables'] += 1
            hdr = cell(b.rows[0].cells[0]) if rows else ''
            r['tables'].append({'shape': f'{rows}x{cols}', 'hdr': hdr[:60], 'section': section})
            # classify by signature
            # Classify by SECTION + shape, not header text: a few chapters vary the first
            # cell's wording, which silently undercounts if you key on "Lead Agency".
            sec = section or ''
            if sec.startswith('Status of Previous Mitigation Actions') and cols == 2 and rows >= 12:
                r['prior_actions'] += 1
            elif sec.startswith('Proposed Hazard Mitigation Actions') and cols in (2, 3) and rows >= 15:
                r['proposed_actions'] += 1
            elif cols == 2 and rows == 13 and re.match(r'^\d{4}-', hdr):
                r['prior_actions'] += 1
            elif hdr == 'Hazard Name' and cols == 2:
                r['hoc_rows'] = rows - 1
            elif hdr == 'Hazard Name' and cols == 7:
                r['hazard_ranking_rows'] = rows - 1
            elif hdr.startswith('Primary Point of Contact'):
                r['roles_rows'] = rows
            elif hdr == 'Capability Type' and cols == 5:
                yes = sum(1 for i in range(1, rows)
                          if cell(b.rows[i].cells[1]).strip().lower().startswith('yes'))
                if 'Ordinance' in (section or '') or any(
                        'Ordinance' in c for c in r['captions'][-2:]):
                    r['ordinances_yes'] += yes
                else:
                    r['plans_yes'] += yes
            elif hdr == 'Capability Type' and cols in (3, 4):
                r['admin_yes'] = sum(1 for i in range(1, rows)
                                     if cell(b.rows[i].cells[1]).strip().lower().startswith('yes'))
            elif hdr == 'Capability Type' and cols == 2:
                if r['fiscal_rows'] is None:
                    r['fiscal_rows'] = rows - 1
                else:
                    r['outreach_rows'] = rows - 1
            elif hdr == 'Hazard' and cols == 6:
                r['adaptive_capacity_rows'] = rows - 2
            elif cols >= 17:
                r['prioritization_rows'] = max(0, rows - 2)

    # checkbox tally straight from the XML
    import zipfile
    x = zipfile.ZipFile(path).read('word/document.xml').decode('utf8', 'replace')
    r['checked_boxes'] = len(re.findall(r'w14:checked w14:val="1"', x))

    missing = [h for h in EXPECTED_H2 if h not in r['h2']]
    if missing:
        r['warnings'].append('missing H2: ' + '; '.join(missing))
    extra = [h for h in r['h2'] if h not in EXPECTED_H2]
    if extra:
        r['warnings'].append('unexpected H2: ' + '; '.join(extra))
    if r['hoc_rows'] not in (None, 14):
        r['warnings'].append(f"Table F has {r['hoc_rows']} hazards (expected 14)")
    if r['proposed_actions'] == 0:
        r['warnings'].append('no proposed actions found')
    return r


files = sorted(glob.glob(os.path.join(ANNEX_DIR, 'Chapter *.docx')),
               key=lambda p: int(re.search(r'Chapter (\d+)', p).group(1)))
results = []
for f in files:
    try:
        results.append(analyze(f))
    except Exception as e:
        results.append({'file': os.path.basename(f), 'error': str(e), 'warnings': ['FAILED']})

hdr = f"{'chapter':<42} {'H2':>3} {'tbl':>4} {'prior':>6} {'prop':>5} {'issue':>6} {'hoc':>4} {'chk':>5}"
print(hdr)
print('-' * len(hdr))
for r in results:
    if 'error' in r:
        print(f"{r['file'][:42]:<42} ERROR {r['error'][:60]}")
        continue
    print(f"{r['file'][:42]:<42} {len(r['h2']):>3} {r['n_tables']:>4} {r['prior_actions']:>6} "
          f"{r['proposed_actions']:>5} {r['identified_issues']:>6} "
          f"{(r['hoc_rows'] if r['hoc_rows'] is not None else '-'):>4} {r['checked_boxes']:>5}")

ok = [r for r in results if 'error' not in r]
print()
print(f"chapters: {len(results)}  |  parsed: {len(ok)}  |  failed: {len(results)-len(ok)}")
print(f"prior actions   total: {sum(r['prior_actions'] for r in ok)}")
print(f"proposed actions total: {sum(r['proposed_actions'] for r in ok)}")
print(f"identified issues total: {sum(r['identified_issues'] for r in ok)}")
print()
print("WARNINGS")
for r in results:
    for w in r.get('warnings', []):
        print(f"  {r['file'][:46]:<46} {w}")

if OUT:
    for r in results:
        if isinstance(r.get('issue_styles'), set):
            r['issue_styles'] = sorted(r['issue_styles'])
    json.dump(results, open(OUT, 'w', encoding='utf8'), indent=1)
    print(f"\nwrote {OUT}")
