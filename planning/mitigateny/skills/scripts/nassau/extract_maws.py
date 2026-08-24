"""Phase 6 — extract the 142 NYS DHSES Mitigation Action Worksheets.

Each MAW .docx holds TWO 26-row transposed tables: the filled worksheet, then a blank
INSTRUCTIONS template whose cells read "Provide a detailed narrative of the problem...".
Take the filled one only.

The critical join rule: MAW file numbering does NOT match project numbering (Glen Cove's
MAW1 is CGC_3). Join on the worksheet's own "Project Number:" row, never the filename.

usage: extract_maws.py
"""
import collections
import csv
import io
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from annex_lib import blocks_of, table_grid                      # noqa: E402
from docx import Document                                        # noqa: E402

ROOT = 'references/mny-transcribe/Nassau/All Annexes'
CTX = 'references/mny-transcribe/Nassau/context/'
OUT = CTX + 'extracted/maws.json'

INSTRUCTION_MARKERS = (
    'Each action must have a unique project',
    'Provide a detailed narrative of the problem',
    'Identify the hazard being addressed',
    'This section should be completed during plan maintenance',
)
LABELS = ('Project Name:', 'Project Number:', 'Hazard of Concern:', 'Description of the Problem:',
          'Description of the Solution:', 'Level of Protection:', 'Useful Life:', 'Estimated Cost:',
          'Prioritization:', 'Estimated Time Required for Project Implementation:',
          'Responsible Organization:', 'Date of Status Report:', 'Report of Progress:',
          'Update Evaluation of the Problem and/or Solution:')


def is_instructions(grid):
    flat = ' '.join(c for row in grid for c in row)
    return any(m in flat for m in INSTRUCTION_MARKERS)


def parse_maw(grid):
    """A 26-row transposed worksheet -> one dict. Values sit to the RIGHT of each label."""
    rec, alts = {}, []
    for row in grid:
        if not row:
            continue
        lab = row[0].strip()
        vals = [c.strip() for c in row[1:]]
        if lab == 'Alternatives:':
            cells = [v for v in vals if v]
            if cells and cells[0] != 'Action':          # skip the header row
                alts.append({'action': cells[0] if len(cells) > 0 else '',
                             'estimated_cost': cells[1] if len(cells) > 1 else '',
                             'evaluation': cells[2] if len(cells) > 2 else ''})
            continue
        if lab.startswith('Is this project related to a Critical Facility'):
            # plain-text "X" in one cell of a merged Yes/No grid, NOT a Word checkbox
            marked = [i for i, v in enumerate(vals) if v.upper() == 'X']
            yes_i = next((i for i, v in enumerate(vals) if v.lower() == 'yes'), None)
            no_i = next((i for i, v in enumerate(vals) if v.lower() == 'no'), None)
            ans = ''
            for mi in marked:
                if yes_i is not None and no_i is not None:
                    ans = 'Yes' if abs(mi - yes_i) < abs(mi - no_i) else 'No'
                elif yes_i is not None:
                    ans = 'Yes'
            rec['critical_facility'] = ans
            rec['_critical_facility_raw'] = vals
            continue
        # rows that pair two label/value couples across the width
        pairs = [(lab, next((v for v in vals if v), ''))]
        for i, v in enumerate(vals):
            if v.endswith(':') and i + 1 < len(vals):
                nxt = next((x for x in vals[i + 1:] if x), '')
                pairs.append((v, nxt))
        for k, v in pairs:
            k = k.strip()
            if k and k.endswith(':') and k not in rec:
                rec[k] = v
    rec['alternatives'] = alts
    return rec


def main():
    manifest = list(csv.DictReader(io.open(CTX + 'file-manifest.csv', encoding='utf-8')))
    alias = {a['folder']: a for a in csv.DictReader(io.open(CTX + 'nassau-jurisdiction-aliases.csv',
                                                           encoding='utf-8')) if a['folder']}
    out, warn = [], []
    tot = collections.Counter()
    for m in manifest:
        if not m['maw_files']:
            if m['worksheet_pdfs']:
                warn.append(f'{m["folder"]}: worksheet delivered as PDF only '
                            f'({m["worksheet_pdfs"]}) - not extracted here')
            else:
                warn.append(f'{m["folder"]}: no worksheets at all')
            continue
        geoid = alias[m['folder']]['geoid']
        for fn in m['maw_files'].split(';'):
            path = os.path.join(ROOT, m['folder'], fn)
            doc = Document(path)
            grids = [table_grid(p)[0] for k, _s, p in blocks_of(doc) if k == 'tbl']
            filled = [g for g in grids if not is_instructions(g)]
            tot['files'] += 1
            tot['tables_seen'] += len(grids)
            tot['instruction_tables_skipped'] += len(grids) - len(filled)
            if not filled:
                warn.append(f'{m["folder"]}/{fn}: every table looks like the instructions template')
                continue
            rec = parse_maw(filled[0])
            rec['geoid'] = geoid
            rec['folder'] = m['folder']
            rec['maw_file'] = fn
            rec['project_number'] = rec.get('Project Number:', '')
            rec['project_name'] = rec.get('Project Name:', '')
            if not rec['project_number']:
                warn.append(f'{m["folder"]}/{fn}: no Project Number - cannot join')
            fnum = re.match(r'MAW[_]?(\d+)', fn, re.I)
            rec['file_index'] = fnum.group(1) if fnum else ''
            if rec['file_index'] and rec['project_number'] and \
                    not rec['project_number'].endswith('_' + rec['file_index']):
                tot['file_index_mismatch'] += 1
            out.append(rec)

    io.open(OUT, 'w', encoding='utf-8').write(json.dumps(
        {'worksheets': out, 'totals': dict(tot), 'warnings': warn}, indent=1, ensure_ascii=False))
    print(f'wrote {OUT}')
    for k, v in tot.items():
        print(f'  {k:32s} {v}')
    print(f'  worksheets parsed                {len(out)}')
    print(f'  with a project number            {sum(1 for r in out if r["project_number"])}')
    print(f'  with >=1 real alternative        {sum(1 for r in out if len(r["alternatives"]) > 1)}')
    print(f'  critical_facility resolved       {sum(1 for r in out if r.get("critical_facility"))}')
    print(f'\n  warnings ({len(warn)}):')
    for w in warn:
        print('   ', w)


if __name__ == '__main__':
    main()
