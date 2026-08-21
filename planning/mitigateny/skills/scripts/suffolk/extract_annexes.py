"""Batch-extract every jurisdictional annex to structured JSON.

FAITHFUL DUMP ONLY -- no crosswalk mapping happens here. Every table is captured verbatim
alongside its section context and a caption, so a later change to an owner decision costs a
re-map rather than a re-extract.

Encodes the five variances found by preflight.py:
  1. Table F hazard count varies (13 or 14)  -> never assume; record what's there
  2. Numbered H2 headings ("34.4 Jurisdictional Risk Assessment") -> regex-tolerant matching
  3. Identified Issues use Tt List Bullet OR List Paragraph -> accept both, track nesting
  4. Action tables vary their first cell's wording -> classify by SECTION + SHAPE
  5. Action tables vs prioritization rows can disagree -> flag, never fail

Jurisdiction identity comes from suffolk-jurisdiction-aliases.csv, never from parsed names.

usage: extract_annexes.py <annex-dir> <out-dir> [--only <chapter-no>]
"""
import csv, json, os, re, sys, zipfile
from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph
from docx.oxml.ns import qn

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from docx_outline2 import para_text, row_cells

BASE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ALIASES = os.path.join(BASE, 'suffolk-jurisdiction-aliases.csv')

ANNEX_DIR, OUT_DIR = sys.argv[1], sys.argv[2]
ONLY = None
if '--only' in sys.argv:
    ONLY = int(sys.argv[sys.argv.index('--only') + 1])

# variance 2: tolerate "34.4 " style numeric prefixes on headings
NUM_PREFIX = re.compile(r'^\d+(\.\d+)*\s+')
CAPTION_TABLE = re.compile(r'^Table\s+([A-Z]+)\.\s*(.*)$', re.I)
CAPTION_ACTION = re.compile(r'^Action\s+(.+?)\.\s*(.*)$', re.I)
# Action IDs contain hyphens ("2020-Islip-001"), so the id/name separator must be the em/en
# dash only -- splitting on a plain hyphen truncates the ID. Spacing around it is inconsistent
# ("...-015— Backup Power"), hence \s*. Falls back to a space-padded hyphen if no dash is present.
# Prefixes are not always the plan year: Suffolk County carries SBU-### (Stony Brook University)
# and SBSH-### (Stony Brook Southampton Hospital) alongside 2020-<Juris>-###.
PRIOR_ID = re.compile(r'^((?:\d{4}|[A-Z]{2,})-[^—–]*?)\s*[—–]\s*(.*)$')
PRIOR_ID_ALT = re.compile(r'^((?:\d{4}|[A-Z]{2,})-\S+)\s+-\s+(.*)$')


def parse_prior_id(hdr):
    m = PRIOR_ID.match(hdr) or PRIOR_ID_ALT.match(hdr)
    return (m.group(1).strip(), m.group(2).strip()) if m else (None, None)


def clean_heading(t):
    return NUM_PREFIX.sub('', (t or '').strip())


def iter_blocks(doc):
    for child in doc.element.body.iterchildren():
        if child.tag == qn('w:p'):
            yield Paragraph(child, doc)
        elif child.tag == qn('w:tbl'):
            yield Table(child, doc)


def table_rows(tbl):
    return [row_cells(r) for r in tbl.rows]


def as_kv(rows):
    """Key/value view of a 2+ column instrument table. Keys are not unique in every table
    (proposed-action tables repeat 'Alternative:'), so collisions are collected into a list."""
    kv = {}
    for r in rows:
        if len(r) < 2 or not r[0]:
            continue
        k, v = r[0].rstrip(':').strip(), r[1:]
        v = v[0] if len(v) == 1 else v
        if k in kv:
            if not isinstance(kv[k], list) or not isinstance(kv[k][0], list):
                kv[k] = [kv[k]]
            kv[k].append(v)
        else:
            kv[k] = v
    return kv


def extract(path, alias):
    doc = Document(path)
    out = {
        'jurisdiction': alias,
        'provenance': {'chapter_file': os.path.basename(path)},
        'headings': [], 'tables': [], 'identified_issues': [],
        'additional_mitigation_efforts': [],
        'prior_actions': [], 'proposed_actions': [],
        'warnings': [],
    }
    h2 = h3 = h4 = None
    pending_caption = None
    tindex = 0

    for block in iter_blocks(doc):
        if isinstance(block, Paragraph):
            style = block.style.name if block.style is not None else ''
            txt = para_text(block._p)
            if not txt:
                continue
            if style == 'Heading 1':
                out['title'] = txt
            elif style == 'Heading 2':
                h2, h3, h4 = clean_heading(txt), None, None
                out['headings'].append({'level': 2, 'text': h2, 'raw': txt})
            elif style == 'Heading 3':
                h3, h4 = clean_heading(txt), None
                out['headings'].append({'level': 3, 'text': h3, 'raw': txt})
            elif style == 'Heading 4':
                h4 = clean_heading(txt)
                out['headings'].append({'level': 4, 'text': h4, 'raw': txt})
            elif style == 'Caption':
                pending_caption = txt
            # variance 3: two bullet styles, plus nesting suffixes
            elif style.startswith('Tt List Bullet') or style == 'List Paragraph':
                depth = 1
                m = re.search(r'Bullet (\d)$', style)
                if m:
                    depth = int(m.group(1))
                item = {'text': txt, 'depth': depth, 'style': style}
                if h3 == 'Identified Issues':
                    out['identified_issues'].append(item)
                elif h3 == 'Additional Mitigation Efforts':
                    out['additional_mitigation_efforts'].append(item)
            continue

        # --- table ---
        tindex += 1
        rows = table_rows(block)
        nrows, ncols = len(rows), len(block.columns)
        caption = pending_caption
        pending_caption = None
        hdr = rows[0][0] if rows and rows[0] else ''

        rec = {
            'index': tindex, 'shape': f'{nrows}x{ncols}',
            'n_rows': nrows, 'n_cols': ncols,
            'section': h2, 'subsection': h3, 'subsubsection': h4,
            'caption': caption, 'first_cell': hdr,
            'rows': rows,
        }
        m = CAPTION_TABLE.match(caption or '')
        if m:
            rec['table_label'] = m.group(1).upper()
            rec['table_name'] = m.group(2).strip()
        out['tables'].append(rec)

        # variance 4: classify action tables by SECTION + SHAPE, never by header text.
        # "Status of Previous Mitigation Actions" is an H4 in some chapters and an H3 in
        # others, so test both levels -- and keep the action-ID fallback, since that is what
        # actually catches them when the heading level differs.
        sec = h3 or ''
        sub = h4 or ''
        is_prior = ncols == 2 and nrows >= 12 and (
            sec.startswith('Status of Previous Mitigation Actions')
            or sub.startswith('Status of Previous Mitigation Actions')
            or sec.startswith('Past Mitigation Action Status')
            or PRIOR_ID.match(hdr))
        if is_prior:
            aid, aname = parse_prior_id(hdr)
            out['prior_actions'].append({
                'table_index': tindex,
                'action_id': aid,
                'action_name': aname,
                'raw_header': hdr,
                'fields': as_kv(rows[1:]),
            })
        elif sec.startswith('Proposed Hazard Mitigation Actions') and ncols in (2, 3) and nrows >= 15:
            am = CAPTION_ACTION.match(caption or '')
            out['proposed_actions'].append({
                'table_index': tindex,
                'action_id': am.group(1).strip() if am else None,
                'action_name': am.group(2).strip() if am else None,
                'caption': caption,
                'fields': as_kv(rows),
            })

    # checkbox tally (QA signal that content controls were seen)
    x = zipfile.ZipFile(path).read('word/document.xml').decode('utf8', 'replace')
    out['provenance']['checked_boxes'] = len(re.findall(r'w14:checked w14:val="1"', x))

    # Some proposed-action tables carry no Caption paragraph, so they have no id/name. Table V
    # lists every action in the same order, so recover identity positionally -- but ONLY when the
    # two agree on count, otherwise the alignment is unsafe.
    pri_tbl = [t for t in out['tables'] if t['n_cols'] >= 17]
    pri_list = []
    if pri_tbl:
        for r in pri_tbl[0]['rows'][2:]:
            if len(r) >= 2 and r[0]:
                pri_list.append((r[0].strip(), r[1].strip()))
    if pri_list and len(pri_list) == len(out['proposed_actions']):
        for i, pa in enumerate(out['proposed_actions']):
            if not pa['action_id']:
                num, name = pri_list[i]
                pa['action_id'] = re.sub(r'^Action\s+', '', num).strip()
                pa['action_name'] = name
                pa['id_source'] = 'prioritization-table (positional; table had no caption)'
            else:
                pa['id_source'] = 'caption'

    # ---- QA, never fatal ----
    # variance 1: hazard count is whatever it is
    tf = [t for t in out['tables'] if t['first_cell'] == 'Hazard Name' and t['n_cols'] == 2]
    out['n_hazards_table_f'] = (tf[0]['n_rows'] - 1) if tf else None
    if out['n_hazards_table_f'] not in (None, 14):
        out['warnings'].append(
            f"Table F has {out['n_hazards_table_f']} hazards (14 is typical) - row math must be per-jurisdiction")
    # variance 5: cross-check action tables against the prioritization grid.
    # Count rows that actually carry a project number -- the header band is 2 rows in most
    # chapters but not all, so "n_rows - 2" produces false mismatches.
    n_pri = len(pri_list)
    out['n_prioritization_rows'] = n_pri
    if pri_tbl and n_pri != len(out['proposed_actions']):
        out['warnings'].append(
            f"action tables ({len(out['proposed_actions'])}) != prioritization rows ({n_pri}) - document defect, needs a human")
    if not out['proposed_actions']:
        out['warnings'].append('no proposed actions found')
    # duplicate action IDs are a consultant numbering defect -- flag, never silently dedupe,
    # since the two rows are genuinely different actions
    for label, coll in (('prior', out['prior_actions']), ('proposed', out['proposed_actions'])):
        seen = {}
        for p in coll:
            if p['action_id']:
                seen.setdefault(p['action_id'], []).append(p['action_name'])
        for aid, names in seen.items():
            if len(names) > 1:
                out['warnings'].append(
                    f"duplicate {label} action id {aid!r} used by {len(names)} different actions: "
                    + ' | '.join(str(n)[:40] for n in names))
        missing = [p for p in coll if not p['action_id']]
        if missing:
            out['warnings'].append(
                f"{len(missing)} {label} action(s) have no recoverable id")
    return out


aliases = {r['chapter_file']: r for r in csv.DictReader(open(ALIASES, encoding='utf8'))}
os.makedirs(OUT_DIR, exist_ok=True)

results = []
for fname, alias in sorted(aliases.items(), key=lambda kv: int(kv[1]['chapter_no'])):
    if ONLY is not None and int(alias['chapter_no']) != ONLY:
        continue
    path = os.path.join(ANNEX_DIR, fname)
    try:
        rec = extract(path, alias)
    except Exception as e:
        print(f"  FAILED {fname}: {e}")
        results.append({'file': fname, 'error': str(e)})
        continue
    slug = re.sub(r'[^a-z0-9]+', '-', alias['annex_name'].lower()).strip('-')
    dest = os.path.join(OUT_DIR, f"{alias['geoid']}_{slug}.json")
    with open(dest, 'w', encoding='utf8') as fh:
        json.dump(rec, fh, indent=1, ensure_ascii=False)
    results.append({
        'file': fname, 'geoid': alias['geoid'], 'name': alias['annex_name'],
        'tables': len(rec['tables']), 'prior': len(rec['prior_actions']),
        'proposed': len(rec['proposed_actions']), 'issues': len(rec['identified_issues']),
        'hazards': rec['n_hazards_table_f'], 'boxes': rec['provenance']['checked_boxes'],
        'warnings': rec['warnings'], 'out': os.path.basename(dest),
    })

hdr = f"{'geoid':>11} {'jurisdiction':<32}{'tbl':>4}{'prior':>6}{'prop':>5}{'issue':>6}{'hzd':>4}{'chk':>6}"
print(hdr)
print('-' * len(hdr))
for r in results:
    if 'error' in r:
        print(f"  ERROR {r['file']}: {r['error'][:60]}")
        continue
    print(f"{r['geoid']:>11} {r['name'][:32]:<32}{r['tables']:>4}{r['prior']:>6}"
          f"{r['proposed']:>5}{r['issues']:>6}{str(r['hazards']):>4}{r['boxes']:>6}")

ok = [r for r in results if 'error' not in r]
print()
print(f"extracted {len(ok)}/{len(results)} annexes -> {OUT_DIR}")
print(f"  tables {sum(r['tables'] for r in ok)} | prior {sum(r['prior'] for r in ok)} | "
      f"proposed {sum(r['proposed'] for r in ok)} | issues {sum(r['issues'] for r in ok)} | "
      f"checked boxes {sum(r['boxes'] for r in ok)}")
print()
print("WARNINGS")
any_w = False
for r in ok:
    for w in r['warnings']:
        any_w = True
        print(f"  {r['name'][:34]:<34} {w}")
if not any_w:
    print("  none")

json.dump(results, open(os.path.join(OUT_DIR, '_manifest.json'), 'w', encoding='utf8'),
          indent=1, ensure_ascii=False)
print(f"\nwrote {os.path.join(OUT_DIR, '_manifest.json')}")
