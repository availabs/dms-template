"""Emit the per-jurisdiction and per-column tables for the annex crosswalk report."""
import io, json, os, collections

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'out')

A = json.load(io.open(os.path.join(OUT, 'annex_sections.json'), encoding='utf-8'))
C = json.load(io.open(os.path.join(OUT, 'crosswalk.json'), encoding='utf-8'))
D = json.load(io.open(os.path.join(OUT, 'discrepancies.json'), encoding='utf-8'))

AMB = {x['file']: x['rows'] for x in D.get('ambiguous_row', [])}

per = collections.defaultdict(lambda: {'cols': 0, 'chars': 0})
cols_by_file = collections.defaultdict(set)
for c in C:
    per[c['file']]['cols'] += 1
    per[c['file']]['chars'] += c['chars']
    cols_by_file[c['file']].add(c['column'])

ALLCOLS = sorted({c['column'] for c in C})

lines = []
lines.append('| Annex file | Dataset row | geoid | Jurisdiction | Cols | Chars | Note |')
lines.append('|---|---|---|---|--:|--:|---|')
for stem in sorted(A):
    rec = A[stem]
    tgt = rec['target']
    juris = f'{tgt[0]} ({tgt[1]})' if tgt else '—'
    row = rec['row_id'] or ''
    note = []
    if stem in AMB:
        note.append(f'**ambiguous** — {" / ".join(AMB[stem])}')
        row = '**?**'
    missing = set(ALLCOLS) - cols_by_file[stem]
    if missing:
        note.append('no ' + ', '.join(sorted(missing)))
    lines.append(f'| `{stem}` | {row or "—"} | {rec["geoid"] or "—"} | {juris} | '
                 f'{per[stem]["cols"]} | {per[stem]["chars"]:,} | {"; ".join(note)} |')

io.open(os.path.join(OUT, 'per_jurisdiction.md'), 'w', encoding='utf-8', newline='\n').write('\n'.join(lines) + '\n')

# per-column table
cl = []
cl.append('| ord | Annex page Card | Column | Display name | Annexes | Chars |')
cl.append('|--:|---|---|---|--:|--:|')
bycol = collections.defaultdict(lambda: {'n': 0, 'chars': 0, 'ord': 0, 'section': '', 'display': ''})
for c in C:
    b = bycol[c['column']]
    b['n'] += 1
    b['chars'] += c['chars']
    b['ord'] = c['sec_ord']
    b['section'] = c['section']
    b['display'] = c['display_name']
for col, b in sorted(bycol.items(), key=lambda kv: kv[1]['ord']):
    cl.append(f'| {b["ord"]} | {b["section"]} | `{col}` | {b["display"]} | {b["n"]}/45 | {b["chars"]:,} |')
io.open(os.path.join(OUT, 'per_column.md'), 'w', encoding='utf-8', newline='\n').write('\n'.join(cl) + '\n')

print('\n'.join(cl))
print()
print(f'wrote per_jurisdiction.md ({len(A)} rows) and per_column.md')
