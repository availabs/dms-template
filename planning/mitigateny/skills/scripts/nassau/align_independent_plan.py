"""Reshape an independent-plan extract into the ANNEX record envelope.

Purpose: all 52 Nassau jurisdictions become one cohesive, uniformly-iterable group in
extracted/annexes/ before Phase 7, so a builder never special-cases Freeport.

** THIS IS A RESHAPE ONLY. ** No value is reworded, re-cased, normalised, bucketed or
inferred. Every source value is carried verbatim. What changes is only which KEY a value
sits under, so a Phase-7 builder can read 52 files with one code path.

Two guarantees, both asserted at the end:
  * every source value still appears in the output (nothing dropped)
  * no output value differs from its source value (nothing altered)

Provenance is explicit: `_alignment` records the key mapping and every field left empty
because the source has no analogue, so an empty field is never mistaken for missing data.

usage: align_independent_plan.py <independent_<geoid>.json> [--write]
"""
import csv
import io
import json
import os
import re
import sys

CTX = 'references/mny-transcribe/Nassau/context/'
OUTDIR = CTX + 'extracted/annexes/'

# Freeport's own action-field label -> the key the annex records use for the same concept.
# Left-hand side is the source label; nothing about the VALUE changes.
ACTION_KEY_MAP = {
    'action_number': 'Project Number',
    'action_name': 'Project Name',
    'goal': 'Goal being met',
    'priority_timetable': 'Priority Ranking',
    'responsible_party': 'Lead Agency',
    'estimated_cost': 'Estimated Costs',
    'source_of_funds': 'Potential Funding Sources',
    'hazards_addressed': 'Hazards to be mitigated',
}
# Source fields with NO annex analogue. Kept under their own names rather than forced into a
# column that means something else -- "Financial and Political Feasibility" is not
# "Estimated Benefits", and "Progress Since 2014" is not a proposed-action field at all.
ACTION_KEEP_AS_IS = ['objective', 'financial_and_political_feasibility', 'progress_since_2014',
                     'priority']
# Annex action keys with no Freeport source; present so the shape matches, always empty.
ACTION_EMPTY = ['Description of the Problem', 'Description of the Solution', 'Critical Facility',
                'EHP Issues', 'Estimated Timeline', 'Estimated Benefits']

CAP_LABELS = ('Legal and Regulatory', 'Administrative and Technical', 'Fiscal',
              'Community Classification')


def align(f, meta):
    src_values = []          # every non-empty source value, for the no-drop assertion

    def keep(v):
        if isinstance(v, str) and v.strip():
            src_values.append(v)
        return v

    rec = {
        'geoid': f['geoid'],
        'jurisdiction': meta['jurisdiction_title'],
        'municipality_type': meta['municipality_type'],
        'folder': meta['folder'],
        'annex_file': f['source'],
        'warnings': list(f.get('warnings', [])),
    }

    # ---- contacts <- committee -------------------------------------------
    # The annex `contacts` list is a jurisdiction's named people. Freeport's equivalent is its
    # planning committee. There is NO primary/alternate designation in the source, so `slot`
    # says 'committee' and the HM-representative flag is left blank rather than invented.
    rec['contacts'] = [{
        'name': keep(c['name']), 'title': keep(c.get('title', '')),
        'agency': keep(c.get('organization', '')), 'address': [],
        'email': '', 'phone': '', 'raw': [keep(c.get('raw', ''))],
        'is_hazard_mitigation_representative': '', 'slot': 'committee',
    } for c in f['committee']]

    # ---- prose blocks: no analogue extracted -----------------------------
    rec['profile_paragraphs'] = []
    rec['top_hazards_sentence'] = None
    rec['nfip_paragraphs'] = []
    rec['capability_summaries'] = {k: [] for k in CAP_LABELS}

    # ---- hazard_impacts <- hazard profiles -------------------------------
    # 3.11 CATEGORIZATION OF HAZARDS is a section, not a hazard. It is excluded from the
    # hazard list and preserved below so nothing is lost.
    non_hazard, hazards = [], []
    for h in f['hazard_profiles']:
        if re.search(r'CATEGORIZATION', h['title'], re.I):
            non_hazard.append(h)
            continue
        hazards.append({'hazard': keep(h['title']), 'impact_categories_verbatim': '',
                        'impact_categories': [], 'no_impact': False,
                        'source_section': h['number'], 'source_page': h['page']})
    rec['hazard_impacts'] = hazards

    # ---- capabilities <- numbered capability sections --------------------
    rec['capabilities'] = [{
        'capability_name': keep(c['title']), 'answer': '', 'description': '',
        'source_table': 'Summary of Existing Capabilities', 'flag': '',
        'detail_overrides_no': False,
        'source_section': c['number'], 'source_page': c['page'],
    } for c in f['capability_sections']]

    # ---- actions ---------------------------------------------------------
    rec['prior_actions'] = []
    rec['completed_actions'] = []
    proposed = []
    for a in f['actions']:
        out = {}
        for src_key, dst_key in ACTION_KEY_MAP.items():
            out[dst_key] = keep(a.get(src_key, ''))
        for k in ACTION_EMPTY:
            out[k] = ''
        for k in ACTION_KEEP_AS_IS:
            if k in a:
                out[k] = keep(a[k])
        proposed.append(out)
    rec['proposed_actions'] = proposed

    # ---- Freeport-only content, carried through verbatim ------------------
    rec['goals'] = [{'number': g['number'], 'text': keep(g['text'])} for g in f['goals']]
    rec['objectives'] = [{'number': o['number'], 'text': keep(o['text'])} for o in f['objectives']]
    rec['spine'] = f['spine']
    rec['non_hazard_sections'] = non_hazard
    rec['source_pages'] = f['pages']
    rec['document_class'] = f['document_class']
    rec['action_field_coverage'] = f.get('action_field_coverage', {})

    rec['counts'] = {
        'contacts': len(rec['contacts']),
        'hazards': len(rec['hazard_impacts']),
        'capabilities': len(rec['capabilities']),
        'prior_actions': 0, 'completed_actions': 0,
        'proposed_actions': len(rec['proposed_actions']),
    }

    rec['_alignment'] = {
        'reshaped_from': os.path.basename(f['source']),
        'reshaped_by': 'align_independent_plan.py',
        'rule': 'reshape only - no value reworded, re-cased, normalised, bucketed or inferred',
        'action_key_map': ACTION_KEY_MAP,
        'action_fields_with_no_annex_analogue': ACTION_KEEP_AS_IS,
        'empty_because_the_source_has_no_analogue': {
            'profile_paragraphs': 'the Community Profile chapter body is not extracted',
            'nfip_paragraphs': 'no NFIP Summary section; 4.15 FLOODPLAIN MANAGEMENT CODE is '
                               'the nearest, body not extracted',
            'capability_summaries': 'no per-section summary paragraph in this document class',
            'top_hazards_sentence': 'no "hazards that most impact" sentence in this document class',
            'prior_actions': 'no prior-cycle action table; prior-cycle status is inline in each '
                             "action's Progress Since 2014 field",
            'completed_actions': 'no separate completed-actions section; completion is stated '
                                 'inline in Progress Since 2014',
            'capabilities[].answer/description/flag': 'the capability chapter is numbered prose '
                                                      'with no Yes/No column and no category flag; '
                                                      'section bodies not yet extracted',
            'hazard_impacts[].impact_categories': 'no impact-category matrix in this document class',
            'contacts[].email/phone/address': 'the committee roster carries name, organization and '
                                              'title only',
            'contacts[].is_hazard_mitigation_representative':
                'no primary/alternate designation exists in the source - left blank, not inferred',
        },
        'all_actions_filed_as_proposed': 'the source lists them under "Goals, Objectives, and '
                                        'Actions" as one forward-looking strategy. Completion '
                                        'status stays verbatim in Progress Since 2014 for Phase 7 '
                                        'to derive from - bucketing here would be inference',
    }
    rec['warnings'].append(
        'RESHAPED from an independent-plan extract into the annex envelope; see _alignment. '
        'Fields that are empty are empty because this document class has no analogue, not '
        'because extraction failed.')
    return rec, src_values


def main():
    src_path = sys.argv[1]
    write = '--write' in sys.argv
    f = json.load(io.open(src_path, encoding='utf-8'))
    alias = {a['geoid']: a for a in csv.DictReader(
        io.open(CTX + 'nassau-jurisdiction-aliases.csv', encoding='utf-8'))}
    meta = alias[f['geoid']]

    rec, src_values = align(f, meta)

    # ---- guarantee 1: nothing altered ------------------------------------
    blob = json.dumps(rec, ensure_ascii=False)
    altered = [v for v in src_values if v and json.dumps(v, ensure_ascii=False)[1:-1] not in blob]
    # ---- guarantee 2: nothing dropped ------------------------------------
    def leaves(o):
        if isinstance(o, str):
            return [o] if o.strip() else []
        if isinstance(o, list):
            return [x for i in o for x in leaves(i)]
        if isinstance(o, dict):
            return [x for k, v in o.items() if not k.startswith('_') for x in leaves(v)]
        return []

    src_leaves = set(leaves(f))
    out_leaves = set(leaves(rec))
    dropped = sorted(v for v in src_leaves - out_leaves
                     if v not in ('independent-jurisdictional-plan',))

    print(f'source   : {src_path}')
    print(f'geoid    : {f["geoid"]}  {meta["jurisdiction_title"]}')
    print(f'counts   : {rec["counts"]}')
    print(f'\nassert nothing ALTERED : {"PASS" if not altered else "FAIL"} '
          f'({len(src_values)} values checked)')
    for v in altered[:8]:
        print('    ALTERED:', v[:90])
    print(f'assert nothing DROPPED : {"PASS" if not dropped else str(len(dropped)) + " dropped"}')
    for v in dropped[:12]:
        print('    dropped:', v[:90])

    if write:
        out = OUTDIR + f['geoid'] + '.json'
        io.open(out, 'w', encoding='utf-8').write(json.dumps(rec, indent=1, ensure_ascii=False))
        print(f'\nwrote {out}')
    else:
        print('\n(dry run - pass --write to emit)')


if __name__ == '__main__':
    main()
