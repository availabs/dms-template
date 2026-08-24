"""Phase 6 — QA assertions over the extracted corpus, emitting a punch-list.

Every check here is designed to localise a DOCUMENT defect, not a parser bug. A failure is
something a human should read, so each finding carries the jurisdiction and the evidence.

usage: qa_assertions.py
"""
import collections
import csv
import io
import json
import os
import re
import sys

CTX = 'references/mny-transcribe/Nassau/context/'
ANN = CTX + 'extracted/annexes/'
OUT = CTX + 'qa-punchlist.csv'

CANON_HAZARDS = ['Coastal Hazards', 'Drought', 'Extreme Temperatures', 'Flooding',
                 'Ground Failure', 'Hurricane and Tropical Storms', 'Hail', 'Lightning',
                 'Severe Winter Weather', 'Tornados', 'Wind']
MONEY = re.compile(r'^\s*\$?\s*([\d,]+(?:\.\d+)?)\s*$')
# Words that mean the cell is PROSE, not a figure: comparing a fragment of prose against
# a clean number invents mismatches ("~$30-$50 per linear foot" parsed as 30 vs 80,000).
PROSE = re.compile(r'\b(m|million|billion|k|per|approx|approximately|estimate|estimated'
                   r'|about|tbd|unknown|varies|range|each|annually|linear|foot|feet|sq'
                   r'|hour)\b|[-–~+/]', re.I)


def money(s):
    """A dollar figure, or None when the cell is prose rather than a number."""
    t = (s or '').strip()
    if not t or PROSE.search(t):
        return None
    m = MONEY.match(t.replace('$', '').replace(' ', ''))
    if not m:
        return None
    try:
        return float(m.group(1).replace(',', ''))
    except ValueError:
        return None


def norm_name(s):
    return re.sub(r'[^a-z0-9]', '', (s or '').lower())


def main():
    alias = {a['geoid']: a for a in csv.DictReader(io.open(CTX + 'nassau-jurisdiction-aliases.csv',
                                                          encoding='utf-8'))}
    maws = json.load(io.open(CTX + 'extracted/maws.json', encoding='utf-8'))['worksheets']
    maw_by_geoid = collections.defaultdict(list)
    for m in maws:
        maw_by_geoid[m['geoid']].append(m)

    findings = []

    def add(geoid, check, severity, detail):
        findings.append({'geoid': geoid,
                         'jurisdiction': alias.get(geoid, {}).get('jurisdiction_title', ''),
                         'check': check, 'severity': severity, 'detail': detail})

    for fn in sorted(os.listdir(ANN)):
        d = json.load(io.open(ANN + fn, encoding='utf-8'))
        g = d['geoid']

        # 1 -- Table 2's hazard set must be the canonical 11 (county excepted)
        hz = [h['hazard'] for h in d['hazard_impacts']]
        if g == '36059':
            if hz:
                add(g, 'county-has-hazard-table', 'info',
                    'the county annex is expected to have no hazard-impacts table')
        elif hz != CANON_HAZARDS:
            add(g, 'hazard-set-deviation', 'high',
                f'expected the canonical 11, got {len(hz)}: '
                f'missing={set(CANON_HAZARDS) - set(hz)} extra={set(hz) - set(CANON_HAZARDS)}')

        # 2 -- NFIP ordinance: Table 3 answer vs the NFIP prose
        nfip = ' '.join(d['nfip_paragraphs'])
        cites_ord = bool(re.search(r'flood damage prevention', nfip, re.I))
        ord_rows = [c for c in d['capabilities']
                    if 'flood damage prevention' in c['capability_name'].lower()]
        ord_yes = any(c['answer'] == 'Yes' for c in ord_rows)
        ord_override = any(c['detail_overrides_no'] for c in ord_rows)
        if cites_ord and not ord_yes and not ord_override:
            add(g, 'nfip-ordinance-conflict', 'high',
                'NFIP section discusses a Flood Damage Prevention ordinance but Table 3 answers No '
                'with no detail, so no capability row was created')
        elif cites_ord and ord_override:
            add(g, 'nfip-ordinance-conflict', 'medium',
                'Table 3 answers No but the NFIP section cites the ordinance - capability row '
                'CREATED by the detail-beats-checkbox rule; verify the citation')

        # 3 -- checkbox/detail overrides are document defects worth listing
        ov = [c for c in d['capabilities'] if c['detail_overrides_no']]
        if len(ov) >= 5:
            add(g, 'systematic-checkbox-defect', 'high',
                f'{len(ov)} capability rows answer No while naming a real capability - this '
                f'jurisdiction\'s checkboxes are unreliable as a whole: '
                + '; '.join(c['capability_name'][:34] for c in ov[:6]))
        elif ov:
            for c in ov:
                add(g, 'checkbox-detail-override', 'low',
                    f'"{c["capability_name"]}" answered No, detail "{c["description"][:60]}"')

        # 4 -- proposed action numbering: contiguous, and matching the worksheets
        nums = [a.get('Project Number', '') for a in d['proposed_actions']]
        blank = [i for i, n in enumerate(nums) if not n.strip()]
        if blank:
            add(g, 'action-missing-number', 'high',
                f'{len(blank)} proposed action(s) have no Project Number')
        suf = []
        for n in nums:
            m = re.search(r'_(\d+)$', n.strip())
            if m:
                suf.append(int(m.group(1)))
        if suf:
            gaps = sorted(set(range(min(suf), max(suf) + 1)) - set(suf))
            if gaps:
                add(g, 'action-number-gap', 'medium',
                    f'project numbers {min(suf)}..{max(suf)} but missing {gaps}')
            dup = [k for k, v in collections.Counter(suf).items() if v > 1]
            if dup:
                add(g, 'action-number-duplicate', 'high', f'duplicated suffixes {dup}')

        # 5 -- worksheet cross-checks
        my_maws = maw_by_geoid.get(g, [])
        ann_nums = {n.strip() for n in nums if n.strip()}
        maw_nums = {m['project_number'].strip() for m in my_maws if m['project_number'].strip()}
        orphan = maw_nums - ann_nums
        if orphan:
            add(g, 'maw-orphan-project', 'high',
                f'worksheet project number(s) {sorted(orphan)} do not appear in the annex '
                f'action tables ({sorted(ann_nums)})')
        for m in my_maws:
            pn = m['project_number'].strip()
            match = next((a for a in d['proposed_actions']
                          if a.get('Project Number', '').strip() == pn), None)
            if not match:
                continue
            an, mn = match.get('Project Name', ''), m.get('project_name', '')
            if an and mn and norm_name(an) != norm_name(mn):
                add(g, 'maw-name-mismatch', 'low',
                    f'{pn}: annex "{an}" vs worksheet "{mn}"')
            araw, mraw = match.get('Estimated Costs', ''), m.get('Estimated Cost:', '')
            ac, mc = money(araw), money(mraw)
            if ac is not None and mc is not None and abs(ac - mc) > 0.5:
                add(g, 'maw-cost-mismatch', 'high',
                    f'{pn}: annex {ac:,.0f} vs worksheet {mc:,.0f}')
            elif araw.strip() and mraw.strip() and (ac is None) != (mc is None):
                add(g, 'cost-not-comparable', 'low',
                    f'{pn}: one side is prose - annex "{araw[:44]}" vs worksheet "{mraw[:44]}"')

        # 6 -- content completeness on the high-value prose
        if not d['nfip_paragraphs']:
            add(g, 'missing-nfip-prose', 'medium', 'no NFIP Summary paragraphs captured')
        empty_caps = [k for k, v in d['capability_summaries'].items()
                      if k != 'Community Classification' and not v]
        if empty_caps:
            add(g, 'missing-capability-summary', 'low',
                f'no authored summary paragraph for: {empty_caps}')
        if not d['top_hazards_sentence'] and g != '36059':
            add(g, 'missing-top-hazards-sentence', 'low',
                'Hazard Vulnerability heading carried no "hazards that most impact" sentence')
        if d['counts']['contacts'] < 2:
            add(g, 'incomplete-contacts', 'high',
                f'only {d["counts"]["contacts"]} contact(s) parsed')
        for w in d['warnings']:
            if w.startswith('unclassified table'):
                add(g, 'unclassified-table', 'high', w)

    # ---- corpus-level -----------------------------------------------------
    seen = {json.load(io.open(ANN + f, encoding='utf-8'))['geoid'] for f in os.listdir(ANN)}
    for gid, a in alias.items():
        if a['has_annex'] == 'yes' and gid not in seen:
            sev = 'info' if a['pipeline'] == 'freeport-standalone' else 'high'
            note = (' - expected: the standalone village plan, on its own track'
                    if sev == 'info' else '')
            add(gid, 'annex-not-extracted', sev,
                f'no extract produced for {a["annex_file"]}{note}')

    with io.open(OUT, 'w', encoding='utf-8', newline='') as fh:
        w = csv.DictWriter(fh, fieldnames=['severity', 'check', 'geoid', 'jurisdiction', 'detail'])
        w.writeheader()
        order = {'high': 0, 'medium': 1, 'low': 2, 'info': 3}
        for f in sorted(findings, key=lambda x: (order[x['severity']], x['check'], x['geoid'])):
            w.writerow({k: f[k] for k in ('severity', 'check', 'geoid', 'jurisdiction', 'detail')})

    print(f'wrote {OUT}  ({len(findings)} findings)\n')
    by = collections.Counter((f['severity'], f['check']) for f in findings)
    for (sev, chk), n in sorted(by.items(), key=lambda x: ({'high': 0, 'medium': 1, 'low': 2, 'info': 3}[x[0][0]], -x[1])):
        print(f'  {sev:7s} {n:3d}  {chk}')
    print()
    for f in findings:
        if f['severity'] == 'high':
            print(f'  HIGH  {f["jurisdiction"][:30]:32s} {f["check"]:28s} {f["detail"][:110]}')


if __name__ == '__main__':
    main()
