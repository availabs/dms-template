"""Verify extracted/annexes/ is a cohesive, uniformly-iterable group before Phase 7.

Asserts that a Phase-7 builder can read every record with one code path: the same envelope
keys, the same list-element keys, one record per in-scope jurisdiction, and no geoid drift.

usage: verify_group.py
"""
import collections
import csv
import io
import json
import os
import sys

CTX = 'references/mny-transcribe/Nassau/context/'
ANN = CTX + 'extracted/annexes/'

ENVELOPE = ['geoid', 'jurisdiction', 'municipality_type', 'folder', 'annex_file', 'warnings',
            'contacts', 'profile_paragraphs', 'top_hazards_sentence', 'nfip_paragraphs',
            'capability_summaries', 'hazard_impacts', 'capabilities', 'prior_actions',
            'proposed_actions', 'completed_actions', 'counts']
LIST_KEYS = {
    'contacts': ['name', 'title', 'agency', 'address', 'email', 'phone', 'raw',
                 'is_hazard_mitigation_representative', 'slot'],
    'hazard_impacts': ['hazard', 'impact_categories_verbatim', 'impact_categories', 'no_impact'],
    'capabilities': ['capability_name', 'answer', 'description', 'source_table', 'flag',
                     'detail_overrides_no'],
}

recs = {}
for fn in sorted(os.listdir(ANN)):
    if fn.endswith('.json'):
        recs[fn[:-5]] = json.load(io.open(ANN + fn, encoding='utf-8'))

alias = {a['geoid']: a for a in csv.DictReader(
    io.open(CTX + 'nassau-jurisdiction-aliases.csv', encoding='utf-8'))}
in_scope = {g for g, a in alias.items() if a['has_annex'] == 'yes'}

fail = []
print(f'records: {len(recs)}   in-scope jurisdictions: {len(in_scope)}')
if set(recs) != in_scope:
    fail.append(f'record set != in-scope set; missing={sorted(in_scope - set(recs))} '
                f'extra={sorted(set(recs) - in_scope)}')

for g, r in recs.items():
    missing = [k for k in ENVELOPE if k not in r]
    if missing:
        fail.append(f'{g}: envelope missing {missing}')
    if r.get('geoid') != g:
        fail.append(f'{g}: record geoid is {r.get("geoid")!r} - filename/geoid drift')
    if r.get('jurisdiction') != alias[g]['jurisdiction_title']:
        fail.append(f'{g}: jurisdiction {r.get("jurisdiction")!r} != alias '
                    f'{alias[g]["jurisdiction_title"]!r}')
    for lk, keys in LIST_KEYS.items():
        for i, item in enumerate(r.get(lk, [])):
            gap = [k for k in keys if k not in item]
            if gap:
                fail.append(f'{g}: {lk}[{i}] missing {gap}')
                break
    c = r.get('counts', {})
    for k, lk in (('contacts', 'contacts'), ('hazards', 'hazard_impacts'),
                  ('capabilities', 'capabilities'), ('prior_actions', 'prior_actions'),
                  ('completed_actions', 'completed_actions'),
                  ('proposed_actions', 'proposed_actions')):
        if c.get(k) != len(r.get(lk, [])):
            fail.append(f'{g}: counts[{k}]={c.get(k)} but len({lk})={len(r.get(lk, []))}')

# per-class shape report
byclass = collections.Counter(r.get('document_class', 'hagerty-annex') for r in recs.values())
print('document classes:', dict(byclass))
tot = collections.Counter()
for r in recs.values():
    for k, v in r['counts'].items():
        tot[k] += v
print('group totals   :', dict(tot))

# action key uniformity across classes
keysets = collections.Counter()
for r in recs.values():
    for a in r['proposed_actions']:
        keysets[tuple(sorted(a))] += 1
print(f'\ndistinct proposed_action key sets: {len(keysets)}')
for ks, n in keysets.most_common():
    print(f'   {n:4d} actions  ({len(ks)} keys)')
common = set.intersection(*[set(k) for k in keysets]) if keysets else set()
print(f'   keys present in EVERY action: {len(common)} -> {sorted(common)}')

print()
if fail:
    print(f'FAIL ({len(fail)}):')
    for f in fail[:25]:
        print('   ', f)
    sys.exit(1)
print('PASS - one code path reads all records')
