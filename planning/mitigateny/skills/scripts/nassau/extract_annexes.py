"""Phase 6 — batch-extract the Hagerty annex corpus to structured JSON.

Driven by file-manifest.csv (never a glob) and keyed on the alias table's geoid.
One JSON per jurisdiction in extracted/annexes/, plus a run summary.

usage: extract_annexes.py [--only <folder-substring>]
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
from annex_lib import (blocks_of, cell_lines, classify, parse_poc, rowwise_records,  # noqa: E402
                       strip_doubled_heading, table_grid, transposed_records, row_cell_objs)
from docx import Document                                                            # noqa: E402

ROOT = 'references/mny-transcribe/Nassau/All Annexes'
CTX = 'references/mny-transcribe/Nassau/context/'
OUTDIR = CTX + 'extracted/annexes/'

CAP_TABLES = {
    'cap_regulatory': ('Legal and Regulatory', 'plan_guidance'),
    'cap_staff': ('Administrative and Technical', 'tool'),
    'cap_fiscal': ('Fiscal', 'funding_source'),
    'cap_classification': ('Community Classification', 'program'),
}
SECTIONS = ['Hazard Mitigation Plan Points of Contact', 'Profile', 'Hazard Vulnerability',
            'Capability Assessment', 'Legal and Regulatory Capability Assessment',
            'Administrative and Technical Capability Assessment', 'Fiscal Capability Assessment',
            'Community Classification Assessment', 'National Flood Insurance Program Summary',
            'Mitigation Strategy', 'Previous Mitigation Actions', 'Completed Mitigation Actions',
            'Proposed Mitigation Actions', 'Mitigation Action Worksheets']


# Longest first: "Legal and Regulatory Capability Assessment".endswith("Capability Assessment")
# is True, so a shortest-first scan collapses all four subsections into their parent heading.
SECTIONS_BY_LEN = sorted(SECTIONS, key=len, reverse=True)


def norm_heading(t):
    """Match by suffix — the Hazard Vulnerability heading carries a doubled sentence prefix."""
    t = (t or '').strip().rstrip(':')
    for s in SECTIONS_BY_LEN:
        if t == s:
            return s
    for s in SECTIONS_BY_LEN:
        if t.endswith(s):
            return s
    if re.match(r'^Project Table #', t):
        return 'Proposed Mitigation Actions'
    return None


# The 14 canonical proposed-action field labels, and the variants seen in the corpus.
# Whitespace is collapsed before matching, so "PriorityRanking" (Sea Cliff, no space) resolves
# without an explicit alias; "Hazard Ranking" (Bayville) needs one -- verified to hold
# High/Medium/Low priority values, not hazard names.
CANON_ACTION_LABELS = [
    'Project Number', 'Project Name', 'Goal being met', 'Hazards to be mitigated',
    'Priority Ranking', 'Description of the Problem', 'Description of the Solution',
    'Critical Facility', 'EHP Issues', 'Estimated Timeline', 'Lead Agency', 'Estimated Costs',
    'Estimated Benefits', 'Potential Funding Sources',
]
ACTION_LABEL_ALIASES = {'hazardranking': 'Priority Ranking'}
_CANON_BY_SQUASH = {re.sub(r'\s+', '', c).lower(): c for c in CANON_ACTION_LABELS}


def canon_action_label(label):
    """Canonical label + whether it was a variant. Keys only; values are never touched."""
    squash = re.sub(r'\s+', '', (label or '')).lower()
    hit = _CANON_BY_SQUASH.get(squash) or ACTION_LABEL_ALIASES.get(squash)
    if not hit:
        return label, False
    return hit, hit != (label or '').strip()


def canonicalise_actions(records, rec, table_label):
    """Rewrite action-record KEYS to the canonical labels, warning on each variant."""
    out = []
    for r in records:
        new_r, seen_variants = {}, []
        for k, v in r.items():
            ck, was_variant = canon_action_label(k)
            if was_variant:
                seen_variants.append((k, ck))
            new_r[ck] = v
        if seen_variants:
            for orig, ck in seen_variants:
                rec['warnings'].append(
                    f'LABEL VARIANT ({table_label}): field labelled "{orig}" canonicalised to '
                    f'"{ck}" - value carried verbatim')
            new_r['_source_labels'] = {ck: orig for orig, ck in seen_variants}
        out.append(new_r)
    return out


# Verified project-number corrections applied to the ANNEX side, keyed on (folder, wrong).
# Owner decision 2026-08-21, Cove Neck: the worksheet writes "VCN-1" and the annex "VCN_1";
# use the hyphen. Consistent with worksheet-precedence. Keyed on the folder because project
# numbers are unique only WITHIN a jurisdiction.
# NOTE the visible consequence: VCN-1 then sits alongside VCN_2 / VCN_3 / VCN_4, so one of Cove
# Neck's four actions carries a different separator from its siblings. Cosmetic, in a text field.
ANNEX_NUMBER_CORRECTIONS = {
    ('12_VillageofCoveNeck', 'VCN_1'): 'VCN-1',
}


def yesno(v):
    """Answers are not clean Yes/No — test whether the value BEGINS with no/yes."""
    s = (v or '').strip().lower()
    if s.startswith('no'):
        return 'No'
    if s.startswith('yes'):
        return 'Yes'
    return ''


def extract(path, meta):
    doc = Document(path)
    rec = {'geoid': meta['geoid'], 'jurisdiction': meta['jurisdiction_title'],
           'municipality_type': meta['municipality_type'], 'folder': meta['folder'],
           'annex_file': os.path.basename(path), 'warnings': []}
    prose = collections.defaultdict(list)
    tables = collections.defaultdict(list)
    cur = None
    top_hazards = None

    for kind, style, payload in blocks_of(doc):
        if kind == 'p':
            if style.startswith('Heading') or style == 'SectionTitle':
                sent, head = strip_doubled_heading(payload)
                if sent:
                    top_hazards = sent
                h = norm_heading(head) or norm_heading(payload)
                cur = h or cur
            elif style in ('Normal', 'Body Text') and payload.strip():
                if cur:
                    prose[cur].append(payload.strip())
        else:
            key = classify(payload)
            if key:
                tables[key].append(payload)
            else:
                g, c0 = table_grid(payload)
                rec['warnings'].append(
                    f'unclassified table {len(g)}x{max((len(x) for x in g), default=0)} '
                    f'col0={c0[:3]}')

    # ---- points of contact ------------------------------------------------
    rec['contacts'] = []
    if tables['poc']:
        cells = row_cell_objs(tables['poc'][0].rows[1])
        for i, c in enumerate(cells[:2]):
            p = parse_poc(cell_lines(c))
            if p:
                p['is_hazard_mitigation_representative'] = 'Yes' if i == 0 else 'No'
                p['slot'] = 'primary' if i == 0 else 'alternate'
                rec['contacts'].append(p)
    else:
        rec['warnings'].append('no POC table')

    # ---- profile prose ----------------------------------------------------
    rec['profile_paragraphs'] = prose.get('Profile', [])
    rec['top_hazards_sentence'] = top_hazards
    rec['nfip_paragraphs'] = prose.get('National Flood Insurance Program Summary', [])
    rec['capability_summaries'] = {
        label: prose.get(f'{label} Capability Assessment', [])
        for label in ('Legal and Regulatory', 'Administrative and Technical', 'Fiscal',
                      'Community Classification')
    }

    # ---- hazard impacts ---------------------------------------------------
    rec['hazard_impacts'] = []
    if tables['hazard_impacts']:
        grid, _ = table_grid(tables['hazard_impacts'][0])
        for row in grid[1:]:
            if len(row) < 2 or not row[0].strip():
                continue
            cats = [c.strip() for c in re.split(r',(?![^(]*\))', row[1]) if c.strip()]
            rec['hazard_impacts'].append({'hazard': row[0].strip(),
                                          'impact_categories_verbatim': row[1].strip(),
                                          'impact_categories': cats,
                                          'no_impact': row[1].strip().lower() == 'no impact'})
    elif meta['geoid'] != '36059':
        rec['warnings'].append('no hazard-impacts table (expected only for the county)')

    # ---- capabilities -----------------------------------------------------
    rec['capabilities'] = []
    for key, (label, flag) in CAP_TABLES.items():
        for t in tables[key]:
            grid, _ = table_grid(t)
            for row in grid[1:]:
                if not row or not row[0].strip():
                    continue
                name = row[0].strip()
                ans = yesno(row[1]) if len(row) > 1 else ''
                detail = row[2].strip() if len(row) > 2 else ''
                if key == 'cap_classification' and not detail and ans == '':
                    detail = row[1].strip() if len(row) > 1 else ''
                override = (ans == 'No' and bool(detail))
                if ans == 'No' and not detail:
                    continue                       # genuine absence -> no row
                rec['capabilities'].append({
                    'capability_name': name, 'answer': ans, 'description': detail,
                    'source_table': label, 'flag': flag,
                    'detail_overrides_no': override})
                if override:
                    rec['warnings'].append(
                        f'OVERRIDE: {label} / "{name}" answered No but carries detail '
                        f'"{detail[:60]}" -> row created')

    # ---- the NFIP-prose override -----------------------------------------
    # The owner's rule is "prefer the answer with more detailed information". For the flood
    # damage prevention ordinance the detail is NOT in Table 3's citation cell -- it is in the
    # NFIP Summary prose, which names an amendment date and a legal citation. 29 of 51 annexes
    # answer No in Table 3 while citing a real ordinance in prose, so applying the rule only
    # within a table row loses the capability for over half the corpus.
    nfip_txt = ' '.join(rec['nfip_paragraphs'])
    m = re.search(r'[^.]*Flood Damage Prevention Ordinance[^.]*(?:\.[^.]*){0,2}', nfip_txt)
    cites = bool(m and re.search(r'\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|L\.?L\.?|Chapter|§|Local Law',
                                 m.group(0)))
    if cites:
        existing = next((c for c in rec['capabilities']
                         if 'flood damage prevention' in c['capability_name'].lower()), None)
        sentence = m.group(0).strip()
        if existing is None:
            rec['capabilities'].append({
                'capability_name': 'NFIP Flood Damage Prevention Ordinance(s)',
                'answer': 'No', 'description': sentence,
                'source_table': 'Legal and Regulatory', 'flag': 'plan_guidance',
                'detail_overrides_no': True, 'detail_from': 'NFIP Summary prose'})
            rec['warnings'].append(
                'OVERRIDE (NFIP prose): Table 3 answered No with no citation, but the NFIP '
                f'Summary cites an ordinance -> row created from prose: "{sentence[:80]}"')
        elif not existing.get('description'):
            existing['description'] = sentence
            existing['detail_from'] = 'NFIP Summary prose'

    # ---- actions ----------------------------------------------------------
    rec['prior_actions'], rec['proposed_actions'], rec['completed_actions'] = [], [], []
    for t in tables['prior_actions_transposed']:
        rec['prior_actions'] += transposed_records(table_grid(t)[0])
    for t in tables['prior_actions_rowwise']:
        rec['prior_actions'] += rowwise_records(table_grid(t)[0])
        rec['warnings'].append('prior actions are ROW-WISE, not transposed')
    for t in tables['completed_actions']:
        rec['completed_actions'] += canonicalise_actions(
            transposed_records(table_grid(t)[0]), rec, 'completed actions')
    for t in tables['proposed_actions']:
        rec['proposed_actions'] += canonicalise_actions(
            transposed_records(table_grid(t)[0]), rec, 'proposed actions')
    for a in rec['proposed_actions']:
        raw = (a.get('Project Number') or '').strip()
        fixed = ANNEX_NUMBER_CORRECTIONS.get((meta['folder'], raw))
        if fixed:
            a['Project Number'] = fixed
            a['_project_number_source'] = raw
            rec['warnings'].append(
                f'NUMBER CORRECTED: annex "{raw}" -> "{fixed}" to match the worksheet '
                f'(owner decision: use the hyphen)')

    rec['counts'] = {'contacts': len(rec['contacts']),
                     'hazards': len(rec['hazard_impacts']),
                     'capabilities': len(rec['capabilities']),
                     'prior_actions': len(rec['prior_actions']),
                     'completed_actions': len(rec['completed_actions']),
                     'proposed_actions': len(rec['proposed_actions'])}
    return rec


def main():
    only = None
    if '--only' in sys.argv:
        only = sys.argv[sys.argv.index('--only') + 1]

    alias = {a['folder']: a for a in csv.DictReader(io.open(CTX + 'nassau-jurisdiction-aliases.csv',
                                                           encoding='utf-8')) if a['folder']}
    manifest = list(csv.DictReader(io.open(CTX + 'file-manifest.csv', encoding='utf-8')))
    os.makedirs(OUTDIR, exist_ok=True)

    tot = collections.Counter()
    summary, skipped = [], []
    for m in manifest:
        if only and only.lower() not in m['folder'].lower():
            continue
        if not m['annex_file'].lower().endswith('.docx'):
            skipped.append((m['folder'], m['annex_file'], 'not a Hagerty annex docx'))
            continue
        meta = alias[m['folder']]
        path = os.path.join(ROOT, m['folder'], m['annex_file'])
        rec = extract(path, meta)
        io.open(OUTDIR + f'{meta["geoid"]}.json', 'w', encoding='utf-8').write(
            json.dumps(rec, indent=1, ensure_ascii=False))
        for k, v in rec['counts'].items():
            tot[k] += v
        summary.append({'folder': m['folder'], 'geoid': meta['geoid'],
                        'jurisdiction': meta['jurisdiction_title'],
                        **rec['counts'], 'warnings': len(rec['warnings'])})
        w = f'  ({len(rec["warnings"])} warnings)' if rec['warnings'] else ''
        print(f'{m["folder"][:34]:36s} {meta["geoid"]:12s} '
              f'poc={rec["counts"]["contacts"]} hz={rec["counts"]["hazards"]:2d} '
              f'cap={rec["counts"]["capabilities"]:2d} prior={rec["counts"]["prior_actions"]:3d} '
              f'compl={rec["counts"]["completed_actions"]} '
              f'prop={rec["counts"]["proposed_actions"]:2d}{w}')

    io.open(CTX + 'extracted/annex_extract_summary.json', 'w', encoding='utf-8').write(
        json.dumps({'per_jurisdiction': summary, 'totals': dict(tot),
                    'skipped': skipped}, indent=1, ensure_ascii=False))
    print('\n=== TOTALS ===')
    for k, v in tot.items():
        print(f'  {k:20s} {v}')
    print(f'  jurisdictions        {len(summary)}')
    if skipped:
        print('  skipped:', skipped)


if __name__ == '__main__':
    main()
