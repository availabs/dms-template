"""Reconcile the base plan's attendance matrix (table 0) against the 52 annex folders.

Answers: are the jurisdictions that participated but have no annex CDPs, or real
municipalities we would be dropping?
"""
import csv
import io
import re
import sys

sys.path.insert(0, 'references/mny-transcribe/Nassau/context/scripts')
from docx_outline2 import cell_text  # noqa: E402
from docx import Document

BASE = ('references/mny-transcribe/Nassau/Base Plan and Appendices/'
        'Nassau County_HMP_Base_Plan_12.16.20.docx')
GEO = 'references/mny-transcribe/Nassau/context/extracted/nassau_geoids.tsv'
ALIAS = 'references/mny-transcribe/Nassau/context/nassau-jurisdiction-aliases.csv'

doc = Document(BASE)
t = doc.tables[0]
hdr = [cell_text(c) for c in t.rows[0].cells]
labels = [cell_text(r.cells[0]) for r in t.rows[1:]]
status = [cell_text(r.cells[-1]) for r in t.rows[1:]]

geo = list(csv.DictReader(io.open(GEO, encoding='utf-8'), delimiter='\t'))
alias = list(csv.DictReader(io.open(ALIAS, encoding='utf-8')))
annex_geoids = {a['geoid'] for a in alias}
annex_names = {a['municipality_name'].lower() for a in alias}


def norm(s):
    s = s.lower()
    s = re.sub(r'\b(village|town|city|county|incorporated|inc\.?)\b', ' ', s)
    s = re.sub(r'\bof\b', ' ', s)
    return re.sub(r'[^a-z]', '', s)


by_norm = {}
for g in geo:
    by_norm.setdefault(norm(g['Municipality Name']), []).append(g)


def typ_of(label):
    lo = label.lower()
    if 'county' in lo:
        return 'County'
    if lo.startswith('city') or ' city' in lo:
        return 'City'
    if lo.startswith('town') or ' town' in lo:
        return 'Town'
    if 'village' in lo:
        return 'Village'
    return '?'


print(f'attendance matrix: {len(labels)} jurisdiction rows, {len(hdr) - 2} meeting columns')
print(f'alias table      : {len(alias)} annex folders\n')

rows = []
for lab, st in zip(labels, status):
    if not lab:
        continue
    key = norm(lab)
    want = typ_of(lab)
    cands = by_norm.get(key, [])
    exact = [c for c in cands if c['Municipality Type'].lower() == want.lower()] or cands
    g = exact[0] if len(exact) == 1 else (exact[0] if exact else None)
    geoid = g['GeoID Number'] if g else ''
    mtype = g['Municipality Type'] if g else 'NOT IN CROSSWALK'
    has_annex = geoid in annex_geoids
    rows.append({'label': lab, 'status': st, 'geoid': geoid, 'type': mtype,
                 'has_annex': has_annex, 'n_cands': len(cands)})

orph = [r for r in rows if not r['has_annex']]
print(f'matrix rows WITHOUT an annex: {len(orph)}\n')
print(f"{'label':40s} {'status':12s} {'type':18s} geoid")
print('-' * 88)
for r in sorted(orph, key=lambda x: (x['type'], x['label'])):
    print(f"{r['label'][:39]:40s} {r['status'][:11]:12s} {r['type'][:17]:18s} {r['geoid']}")

import collections
print('\nby municipality type:', dict(collections.Counter(r['type'] for r in orph)))
print('by adoption status  :', dict(collections.Counter(r['status'] for r in orph)))

# and the reverse: annexes with no matrix row
matrix_geoids = {r['geoid'] for r in rows if r['geoid']}
missing = [a for a in alias if a['geoid'] not in matrix_geoids]
print(f'\nannex folders WITHOUT a matrix row: {len(missing)}')
for a in missing:
    print(f"   {a['folder']:34s} {a['jurisdiction_title']}")
