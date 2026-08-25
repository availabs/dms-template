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


# --------------------------------------------------------------------------
# Verified project-number corrections, keyed on (folder, wrong number).
#
# Keying on the FOLDER as well as the number is not defensive padding -- it is required.
# "VMP_1" and "VMP_2" are GENUINE project numbers in two other annexes (Massapequa Park and
# Munsey Park), because project numbers are only unique WITHIN a jurisdiction. A correction
# keyed on the number alone would rewrite their real actions.
#
# Muttontown (owner decision 2026-08-21): its two worksheets are numbered VMP_* while its annex
# uses VMTT_*. Three independent checks confirm the worksheets are Muttontown's and that the
# SUFFIX is already correct, so only the prefix is wrong:
#   * Responsible Organization reads "Village of Muttontown" on both
#   * project names match the annex (VMP_2 "Remsens Lane Culvert" = VMTT_2 "Remsen's Lane
#     Culvert"; VMP_1 "Catch Basin Midlane South" = VMTT_1, same name)
#   * the problem narratives match the annex near-verbatim
# Root cause is prefix ambiguity, not a copy-paste: Munsey Park, Muttontown and Massapequa Park
# all abbreviate to VMP.
PROJECT_NUMBER_CORRECTIONS = {
    ('34_VillageofMuttontown', 'VMP_1'): 'VMTT_1',
    ('34_VillageofMuttontown', 'VMP_2'): 'VMTT_2',
}


# Worksheets whose relationship to the annex is not one-to-one (owner decisions 2026-08-21).
#
# ORPHAN_ACTIONS: the worksheet is the ONLY source for a real action -- the annex table simply
# does not list it. Oyster Bay's annex stops at TOB_13; TOB_14 exists only as a worksheet and
# carries every field a proposed action needs. Phase 7 emits an Actions row from the worksheet.
ORPHAN_ACTIONS = {
    ('05_TownofOysterBay', 'TOB_14'): 'annex table stops at TOB_13; keep this as an action '
                                      'sourced from the worksheet alone',
}
#
# ROLLUPS: ONE worksheet describes a PROGRAMME covering several annex actions, so it is a
# different granularity -- not a competing statement about the same thing. Worksheet-precedence
# therefore does NOT apply to its name, cost or narrative; those would overwrite N specific
# projects with one generic description and inflate the cost N-fold.
#
# Village of Hempstead MAW1 is numbered "VOH_1, VOH_2, ... VOH_8" and named "Emergency Generator
# Installation". PROOF it is a roll-up: its cost is $1,005,000.00, which is EXACTLY the sum of
# the eight annex costs (100+180+120+70+95+155+155+130 thousand). The annex names eight specific
# firehouses; the worksheet names none of them.
ROLLUPS = {
    ('20_VillageofHempstead', 'VOH_1, VOH_2, VOH_3, VOH_4, VOH_5, VOH_6, VOH_7, VOH_8'): {
        'covers': ['VOH_1', 'VOH_2', 'VOH_3', 'VOH_4', 'VOH_5', 'VOH_6', 'VOH_7', 'VOH_8'],
        'precedence_applies': False,
        'note': 'programme-level roll-up; cost equals the sum of the eight components. Attach '
                'worksheet-only fields (Level of Protection, Useful Life, Local Planning '
                'Mechanisms, alternatives) to all eight as shared context, but do NOT overwrite '
                'their names, costs or narratives.',
    },
}


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
        # Rows pair two label/value couples across the width. Taking "the next non-empty
        # cell" is wrong when the value cell is EMPTY -- it falls through to the NEXT LABEL.
        # VRG_1 has empty Level of Protection / Useful Life / Estimated Cost cells and so
        # reported its cost as the literal string "Estimated Benefits (losses avoided):".
        def value_after(cells):
            for v in cells:
                if not v:
                    continue
                if v.endswith(':'):      # hit the next label -> this field is genuinely empty
                    return ''
                return v
            return ''

        pairs = [(lab, value_after(vals))]
        for i, v in enumerate(vals):
            if v.endswith(':') and i + 1 < len(vals):
                pairs.append((v, value_after(vals[i + 1:])))
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
            raw_pn = (rec.get('Project Number:') or '').strip()
            corrected = PROJECT_NUMBER_CORRECTIONS.get((m['folder'], raw_pn))
            rec['project_number'] = corrected or raw_pn
            rec['project_number_source'] = raw_pn
            if corrected:
                rec['project_number_corrected'] = True
                tot['project_number_corrected'] += 1
                warn.append(f'{m["folder"]}/{fn}: project number "{raw_pn}" corrected to '
                            f'"{corrected}" (verified by name + problem text + responsible org)')
            rec['project_name'] = rec.get('Project Name:', '')
            if not rec['project_number']:
                warn.append(f'{m["folder"]}/{fn}: no Project Number - cannot join')
            key = (m['folder'], raw_pn)
            if key in ORPHAN_ACTIONS:
                rec['creates_action'] = True
                rec['relationship'] = 'orphan-action'
                rec['relationship_note'] = ORPHAN_ACTIONS[key]
                tot['orphan_actions_kept'] += 1
                warn.append(f'{m["folder"]}/{fn}: {raw_pn} has no annex row - kept as a '
                            f'worksheet-only action')
            elif key in ROLLUPS:
                r = ROLLUPS[key]
                rec['relationship'] = 'rollup'
                rec['covers'] = r['covers']
                rec['precedence_applies'] = r['precedence_applies']
                rec['relationship_note'] = r['note']
                rec['project_number'] = ''          # it is not a single project number
                tot['rollup_worksheets'] += 1
                warn.append(f'{m["folder"]}/{fn}: programme-level roll-up covering '
                            f'{len(r["covers"])} actions - worksheet-precedence NOT applied')
            else:
                rec['relationship'] = 'one-to-one'
                rec['precedence_applies'] = True

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
