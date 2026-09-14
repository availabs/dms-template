# -*- coding: utf-8 -*-
"""Render the crosswalk markdown tables from crosswalk.json."""
import json
from collections import OrderedDict, Counter

rows = json.load(open('../out/crosswalk.json'))

PAGE_ORDER = [
    'front matter / no target',
    'The Local Environment', 'People and Communities', 'Built Environment',
    'Natural Environment', 'NFIP - Floodplain Management', 'High Hazard Dams',
    'The Risk', 'Natural Hazards', 'Non-natural Hazards', 'Climate Change', 'Disasters',
    'Avalanche (not profiled)', 'Coastal Hazards', 'Drought', 'Earthquake', 'Extreme Cold',
    'Extreme Heat', 'Flooding', 'Hail', 'Hurricane/Tropical Storm', 'Ice Storm', 'Landslide',
    'Lightning', 'Snowstorm', 'Tornado', 'Wildfire', 'Wind',
    'The Plan', 'Strategies', 'Capabilities Assessment', 'About the Process',
    'Track Progress', 'Annual Maintenance',
]

groups = OrderedDict()
for r in rows:
    groups.setdefault(r['group'], []).append(r)
ordered = [g for g in PAGE_ORDER if g in groups] + [g for g in groups if g not in PAGE_ORDER]

BADGE = {'HIGH': 'High', 'MEDIUM': 'Medium', 'LOW': 'Low', 'GAP': '**GAP**', 'PREFILLED': '_pre-filled_',
         'PARTIAL': '**Partial**', 'SKIP': 'Skip', 'EMPTY': '_leave empty_'}

out = []
HAZ = set(PAGE_ORDER[PAGE_ORDER.index('Avalanche (not profiled)'):PAGE_ORDER.index('Wind') + 1])

for g in ordered:
    rs = groups[g]
    fills = [r for r in rs if r['confidence'] in ('HIGH', 'MEDIUM', 'LOW')]
    empties = [r for r in rs if r['confidence'] in ('EMPTY', 'PREFILLED')]
    others = [r for r in rs if r['confidence'] in ('GAP', 'PARTIAL', 'SKIP')]
    pid = next((r['page_id'] for r in rs if r['page_id']), '')
    purl = next((r['page_url'] for r in rs if r['page_url']), '')
    head = '### %s' % g
    if pid:
        head += '  ·  page `%s`  ·  [%s](%s)' % (pid, purl.replace('https://westchester-2026.mitigateny.org', ''), purl)
    out.append(head)
    out.append('')
    if fills or others:
        out.append('| Doc block | Doc heading | chars | → draft_section | Slot title | ord | Conf. | Notes |')
        out.append('|---|---|--:|---|---|--:|---|---|')
        for r in sorted(fills + others, key=lambda x: (int(x['doc_block']) if x['doc_block'] else 0)):
            slot = '`%s`' % r['slot_id'] if r['slot_id'] else '—'
            out.append('| %s | %s %s | %s | %s | %s | %s | %s | %s |' % (
                '[%s]' % r['doc_block'] if r['doc_block'] else '—',
                r['doc_level'], r['doc_heading'], r['doc_chars'] or '—',
                slot, r['slot_title'] or '—', r['slot_order'] if r['slot_order'] != '' else '—',
                BADGE[r['confidence']], r['note']))
        out.append('')
    if empties:
        if g in HAZ:
            out.append('_Leave empty (no source prose):_ ' +
                       ', '.join('%s `%s`%s' % (r['slot_title'] or '(untitled)', r['slot_id'],
                                                 ' **[pre-filled - do not overwrite]**' if r['confidence'] == 'PREFILLED' else '')
                                 for r in empties))
        else:
            out.append('**Slots to leave empty**')
            out.append('')
            out.append('| draft_section | Slot title | ord | Why |')
            out.append('|---|---|--:|---|')
            for r in empties:
                out.append('| `%s` | %s | %s | %s |' % (r['slot_id'], r['slot_title'], r['slot_order'], r['note']))
        out.append('')

open('../out/crosswalk_tables.md', 'w', encoding='utf-8').write('\n'.join(out))

c = Counter(r['confidence'] for r in rows)
mapped = [r for r in rows if r['slot_id'] and r['confidence'] in ('HIGH', 'MEDIUM', 'LOW')]
stats = {
    'rows': len(rows), 'counts': dict(c),
    'slots_receiving': len({r['slot_id'] for r in mapped}),
    'doc_sections_mapped': len({r['doc_block'] for r in mapped if r['doc_block']}),
    'chars': sum(r['doc_chars'] for r in mapped),
    'empty_slots': len({r['slot_id'] for r in rows if r['confidence'] == 'EMPTY'}),
}
json.dump(stats, open('../out/stats.json', 'w'), indent=1)
print(json.dumps(stats, indent=1))
# per-page fill counts
print('\nper-page slots receiving content:')
for g in ordered:
    f = len({r['slot_id'] for r in groups[g] if r['confidence'] in ('HIGH', 'MEDIUM', 'LOW') and r['slot_id']})
    e = len({r['slot_id'] for r in groups[g] if r['confidence'] == 'EMPTY'})
    print('  %-30s fill=%-3d empty=%d' % (g[:29], f, e))
