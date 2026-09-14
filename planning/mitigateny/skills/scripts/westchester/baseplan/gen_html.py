# -*- coding: utf-8 -*-
"""Emit the shareable crosswalk page from crosswalk.json."""
import json, html, io
from collections import OrderedDict

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
CHAPTER = OrderedDict([
    ('Front matter', ['front matter / no target']),
    ('The Local Environment', ['The Local Environment', 'People and Communities', 'Built Environment',
                               'Natural Environment', 'NFIP - Floodplain Management', 'High Hazard Dams']),
    ('The Risk', ['The Risk', 'Natural Hazards', 'Non-natural Hazards', 'Climate Change', 'Disasters']),
    ('Hazard profiles', ['Avalanche (not profiled)', 'Coastal Hazards', 'Drought', 'Earthquake',
                         'Extreme Cold', 'Extreme Heat', 'Flooding', 'Hail', 'Hurricane/Tropical Storm',
                         'Ice Storm', 'Landslide', 'Lightning', 'Snowstorm', 'Tornado', 'Wildfire', 'Wind']),
    ('The Plan', ['The Plan', 'Strategies', 'Capabilities Assessment', 'About the Process']),
    ('Track Progress', ['Track Progress', 'Annual Maintenance']),
])

groups = OrderedDict()
for r in rows:
    groups.setdefault(r['group'], []).append(r)

E = lambda s: html.escape(str(s if s is not None else ''))
CLS = {'HIGH': 'c-high', 'MEDIUM': 'c-med', 'LOW': 'c-low', 'GAP': 'c-gap',
       'PARTIAL': 'c-gap', 'SKIP': 'c-skip', 'EMPTY': 'c-empty', 'PREFILLED': 'c-empty'}
LBL = {'HIGH': 'High', 'MEDIUM': 'Medium', 'LOW': 'Low', 'GAP': 'Gap',
       'PARTIAL': 'Partial', 'SKIP': 'Skip', 'EMPTY': 'Empty', 'PREFILLED': 'Pre-filled'}

# ------------------------------------------------------------------ table body
tbl = []
for chap, gl in CHAPTER.items():
    present = [g for g in gl if g in groups]
    if not present:
        continue
    tbl.append('<tr class="chap"><td colspan="7">%s</td></tr>' % E(chap))
    for g in present:
        rs = groups[g]
        pid = next((r['page_id'] for r in rs if r['page_id']), '')
        purl = next((r['page_url'] for r in rs if r['page_url']), '')
        label = E(g) if g != 'front matter / no target' else 'No target on any page'
        if pid:
            slug = purl.replace('https://westchester-2026.mitigateny.org', '')
            meta = ('<span class="pg-id">page %s</span>'
                    '<a class="pg-link" href="%s" target="_blank" rel="noopener">%s</a>'
                    % (E(pid), E(purl), E(slug)))
        else:
            meta = '<span class="pg-id">&mdash;</span>'
        tbl.append('<tr class="pg"><td colspan="7"><span class="pg-name">%s</span>%s</td></tr>'
                   % (label, meta))
        order = {'HIGH': 0, 'MEDIUM': 0, 'LOW': 0, 'PARTIAL': 0, 'GAP': 0, 'SKIP': 1,
                 'EMPTY': 2, 'PREFILLED': 2}
        for r in sorted(rs, key=lambda x: (order[x['confidence']],
                                           int(x['doc_block']) if x['doc_block'] else 10 ** 6,
                                           int(x['slot_order']) if x['slot_order'] != '' else 0)):
            conf = r['confidence']
            doc = ('<span class="blk">%s</span> <span class="lvl">%s</span> %s'
                   % (E(r['doc_block']), E(r['doc_level']), E(r['doc_heading']))) if r['doc_block'] \
                else '<span class="nil">no source prose</span>'
            ch = ('%s' % r['doc_chars']) if r['doc_chars'] else '&mdash;'
            slot = ('<code>%s</code>' % E(r['slot_id'])) if r['slot_id'] else '<span class="nil">&mdash;</span>'
            stitle = E(r['slot_title']) or ('<span class="nil">(untitled)</span>' if r['slot_id'] else '&mdash;')
            sord = E(r['slot_order']) if r['slot_order'] != '' else '&mdash;'
            tbl.append(
                '<tr class="row %s" data-conf="%s" data-q="%s">'
                '<td class="c-doc">%s</td>'
                '<td class="c-num">%s</td>'
                '<td class="c-slot">%s</td>'
                '<td class="c-st">%s</td>'
                '<td class="c-num">%s</td>'
                '<td class="c-conf"><span class="chip %s">%s</span></td>'
                '<td class="c-note">%s</td></tr>'
                % (CLS[conf], conf,
                   E((r['doc_heading'] + ' ' + r['slot_title'] + ' ' + g + ' ' + str(r['slot_id']) +
                      ' ' + str(r['doc_block'])).lower()),
                   doc, ch, slot, stitle, sord, CLS[conf], LBL[conf], E(r['note'])))
tbl = '\n'.join(tbl)

HAZ_COL = [
    ('H4', 'Overview', 'order 5', 'Card &mdash; shared data', 'card'),
    ('', '', 'order 9', '<b>Annotation</b> &middot; Local Hazard Summary', 'anno'),
    ('H4', 'General Vulnerability', 'order 10', 'Card &mdash; internal data', 'card'),
    ('H4', 'Potential Impacts &hellip; Presidential Disaster Declarations', 'orders 12&ndash;27',
     'Spreadsheets, Graphs, Map', 'card'),
    ('H5', 'Declarations and Their Effects on the County', 'order 29', '<b>Annotation</b> &middot; same title', 'anno'),
    ('H5', 'Featured Event', 'order 34', '<b>Annotation</b> &middot; same title', 'anno'),
    ('H4', 'Local Risk Assessment', 'order 35', 'lexical header', 'card'),
    ('H4', 'County Assessment', 'order 37', '<b>Annotation</b> &middot; same title', 'anno'),
    ('H4', 'Jurisdictional Assessment', 'order 40', '<b>Annotation</b> &middot; same title', 'anno'),
    ('H4', 'Modeled Risk / Total EAL (Map)', 'orders 42&ndash;44', 'Card, Map', 'card'),
    ('H5', 'Built Environment: Local Risk Summary', 'order 47', '<b>Annotation</b> &middot; colon &rarr; dash', 'anno'),
    ('H5', 'People and Communities: Local Risk Summary', 'order 50', '<b>Annotation</b> &middot; colon &rarr; dash', 'anno'),
    ('H5', 'Natural Environment: Local Risk Summary', 'order 53', '<b>Annotation</b> &middot; colon &rarr; dash', 'anno'),
    ('H5', 'Local Capabilities', 'order 58', '<b>Annotation</b> &middot; same title', 'anno'),
    ('H5', 'Local Actions', 'order 63', '<b>Annotation</b> &middot; same title', 'anno'),
    ('H5', 'Featured Strategy', 'order 68', '<b>Annotation</b> &middot; same title', 'anno'),
]
haz = '\n'.join(
    '<tr class="%s"><td class="hz-lvl">%s</td><td class="hz-doc">%s</td>'
    '<td class="hz-ord">%s</td><td class="hz-cmp">%s</td></tr>' % (k, l or '&mdash;', d or '<i>no doc heading</i>', o, c)
    for l, d, o, c, k in HAZ_COL)

page = io.open('template.html', encoding='utf-8').read()
page = page.replace('<!--TABLE-->', tbl).replace('<!--HAZ-->', haz)
io.open('../out/westchester-crosswalk.html', 'w', encoding='utf-8').write(page)
print('wrote ../out/westchester-crosswalk.html  (%d table rows)' % len(rows))
