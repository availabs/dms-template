# -*- coding: utf-8 -*-
"""Build the Westchester Base Plan -> pattern 2448336 Annotation-slot crosswalk."""
import json, csv
from collections import Counter

secs = {s['n']: s for s in json.load(open('../out/baseplan/sections.json'))}
inv = json.load(open('../out/inventory.json'))

SUB = 'https://westchester-2026.mitigateny.org'

slot_index = {}
for pid, e in inv.items():
    for s in e['slots']:
        slot_index[str(s['id'])] = (pid, e['title'], e['slug'], s['order'], s['title'], s['filled'])

# ---------------------------------------------------------------- county level
M = [
 (562, '2449721', 'HIGH', 'D1-SO-2 DECIDED 2026-09-08 - DISTRIBUTE, part 1/4. PARA [563] ONLY (what mitigation is; what the Plan is) -> The Plan > Executive Summary, order 3. Slot was EMPTY. [592] from D1-SO-3 follows it here. SKIPPED from [562]: [564] (collaborative process / Planning Committee - covered county-specifically by [1881] -> 2449737, 1,854 ch) and [565] (what the risk assessment does - covered by [838] -> 2465617, 2,146 ch); transcribing either duplicates richer text verbatim on the site.'),
 (562, '2450060', 'MEDIUM', 'D1-SO-2 DECIDED 2026-09-08 - DISTRIBUTE, part 2/4. PARA [566] ONLY (what the capability assessment evaluates) -> Capabilities Assessment > Planning and Regulatory > Local Context, order 5, placed immediately BEFORE [1844] (the D1-SO-1 fill). Under C1 there is no new Capabilities page-opener slot, so this is the fallback home; [1844] then carries the more concrete framing.'),
 (562, '2450098', 'HIGH', 'D1-SO-2 DECIDED 2026-09-08 - DISTRIBUTE, part 3/4. PARA [567] ONLY (mitigation strategy, goals, action evaluation) -> Strategies > Overview > Local Context, order 3. 2450098 guidance is an EXACT match: "Provide a concise overview of the County mitigation strategy ... serve as an introduction to the sections that follow." Emitted BEFORE [1783]s sentence 1, which is the narrower definitional statement.'),
 (569, None, 'SKIP', 'FEMA approval placeholder ("will be completed following review by DHSES and FEMA Region 2"). No content yet.'),
 (575, None, 'SKIP', 'Assurances of Continued Compliance - generic Stafford Act / DMA 2000 / 44 CFR 201 framing. Shared LHMP_IA cards cover this; do not transcribe.'),
 (580, None, 'SKIP', 'D1-SO-5 DECIDED 2026-09-08 - SKIP at zero cost. [588] reads "The County Executive transmittal letter and signature will be inserted in the final Plan" - a drafting placeholder, so there is no final content to load. Under C1 no Home slot is added. PUNCH-LIST: revisit when IEM supplies the signed letter.'),
 (589, '2449714', 'HIGH', 'D1-SO-3 DECIDED 2026-09-08 - DISTRIBUTE, part 1/3. PARAS [590]+[591] (430.8 sq mi; 45 jurisdictions = 6 cities / 19 towns / 23 villages; the three coterminous town-villages counted once; source line) -> The Local Environment > Executive Summary, order 3. Slot was EMPTY, and its guidance asks for "who and what defines your community". This is the only content that reaches it - the [562] distribution alone does not.'),
 (589, '2449721', 'HIGH', 'D1-SO-3 DECIDED 2026-09-08 - DISTRIBUTE, part 2/3. PARA [592] ONLY (how the Plan is organized) -> The Plan > Executive Summary, order 3, appended AFTER [563].'),

 (605, '2454034', 'HIGH', 'People and Communities Overview > Local Context -> page Local Context (order 3). Title, position and guidance all agree.'),
 (609, '2449856', 'HIGH', 'OWNER DECISION 2026-09-08: Demographic Statistics -> Local Populations at Highest Risk (order 8), not 2454034. Better fit than the original recommendation: 2449856 guidance asks to "describe the populations at highest risk ... increased vulnerability ... due to social, economic, and/or physical factors", and doc [610] is literally the topic sentence for [620]s enumeration (age, disability, income, language, housing tenure, transportation access). PREPEND before [620] under a bold "Demographic Statistics" lead-in - M-list order controls this. NOTE: paras [611]/[612]/[614] are county demographic totals (population counts, density, housing units, median income, education) that match 2454034s guidance instead; see the task doc for the optional split.'),
 (620, '2449856', 'HIGH', 'Exact title match, order 8.'),
 (630, '2449861', 'HIGH', 'Exact title match, order 10.'),
 (638, '2453621', 'HIGH', 'Exact title match, order 18.'),
 (643, '2453621', 'HIGH', 'OWNER CONFIRMED 2026-09-08 (D4 row 2): Future Population Projections -> Population Change (order 18). No own slot; 2453621 guidance explicitly asks to "Consider future/projected population growth". APPEND after [638].'),
 (648, '2449862', 'HIGH', 'Economic and Development Trends > Local Context -> Local Context order 20 (guidance = economic / development).'),
 (654, '2449864', 'HIGH', 'Governance Structure -> "Governance Structure " order 22.'),
 (660, '2449877', 'HIGH', 'Neighboring Communities > Local Context -> Local Context order 29 (guidance = neighboring communities).'),
 (None, '2449870', 'EMPTY', 'Special Districts (order 25): doc [657]/[658] carry no prose. Leave empty or hide.'),

 (665, '2449884', 'HIGH', 'Overview > Local Context -> Local Context order 4 (big-picture built environment).'),
 (671, '2449882', 'HIGH', 'Critical Buildings and Infrastructure > Local Context -> Local Context order 8.'),
 (685, '2458839', 'HIGH', 'Infrastructure > Local Context -> Local Context order 12 (guidance = broad infrastructure overview).'),
 (689, '2449888', 'HIGH', 'Water Infrastructure > Local Context -> Local Context order 15 (guidance = water conveyance / supply).'),
 (695, '2449895', 'HIGH', 'Transportation > Local Context -> Local Context order 19 (guidance = transportation).'),
 (700, '2449905', 'HIGH', 'Energy > Local Context -> Local Context order 22 (guidance = energy).'),
 (706, '2449899', 'HIGH', 'Communications > Local Context -> Local Context order 25 (guidance = communications).'),
 (710, '2449901', 'HIGH', 'Buildings > Local Context -> Local Context order 28. NOTE: 2449901 guidance text is a duplicate of 2449882 (template defect), but its position on the page is Buildings.'),
 (716, '2449908', 'HIGH', 'Historic Properties -> "Historic Properties" order 32.'),
 (721, '2449913', 'HIGH', 'Changes in Development > What Has Changed -> "What\'s Changed" order 37.'),
 (735, '2449918', 'HIGH', 'Codes Enforcement -> "Codes Enforcement" order 43. The two source tables (Code-Enforcement Responsibilities, Countywide and Local Planning Capabilities) are platform data - narrate, do not transcribe.'),
 (743, '2449915', 'HIGH', 'Codes and Enforcement > National Flood Insurance Program (NFIP) -> "National Flood Insurance Program (NFIP)" order 45.'),

 (751, '2449784', 'HIGH', 'Overview > Local Context -> Local Context order 3.'),
 (757, '2449784', 'MEDIUM', 'OWNER DECISION 2026-09-08: Open Space Parcel Statistics -> Natural Environment > Overview > Local Context (order 3), APPENDED after [751]. Was LOW/2464950. Transcribe the narration only ([758] and [761]) - NOT table 760, which is data. Note the doc holds TWO disagreeing open-space inventories: table 760 (earlier County land-use summary, ~70,000 ac / >24% of land area) and table 768 under [762] (Westchester 2033 GIS, 82,490.5 ac across 6,734 parcels). [758] cites the earlier one.'),
 (762, '2464950', 'HIGH', 'County Open Space Plan -> "County Open Space Plan" order 10.'),
 (773, '2449798', 'HIGH', 'Firewise Communities -> "Firewise Communities " order 17.'),
 (776, '2449802', 'HIGH', 'Water and Air > Local Context -> Local Context order 21 (guidance = water and air).'),
 (781, '2449807', 'HIGH', 'Water Quality -> "Water Quality" order 24.'),
 (784, '2449810', 'HIGH', 'Air Quality -> "Air Quality" order 25.'),
 (790, '2449814', 'HIGH', 'Wildlife > Local Context -> Local Context order 28 (guidance = wildlife).'),
 (794, '2449809', 'HIGH', 'Forestry Local Context -> "Forestry Local Context" order 31.'),
 (None, '2449796', 'EMPTY', 'Buyouts/Acquisitions Local Context (order 15): doc [770]/[772] empty. Leave empty or hide.'),

 (802, '2450152', 'HIGH', 'NFIP Participation Summary -> exact title match, order 3.'),
 (810, '2450153', 'HIGH', 'Floodplain Administrators > Local Context -> Local Context order 10, which sits directly after the "Floodplain Administrators" Card (order 7). NOTE: 2450153 guidance still reads "latest Flood Insurance Rate Map" - stale guidance, a template defect, not a mapping problem.'),
 (817, '2450162', 'HIGH', 'Community Rating System -> exact title match, order 16.'),

 (825, '2449750', 'HIGH', 'Overview > Local Context -> the page\'s single Local Context, order 5.'),

 (838, '2465617', 'HIGH', 'The Risk > Executive Summary -> "Executive Summary" order 3.'),
 (842, None, 'SKIP', 'D1-SO-6 DECIDED 2026-09-08 - SKIP per county. The five definitions (hazard / exposure / vulnerability / consequence / risk) are identical for all 62 counties; loading them into a county slot puts platform-wide content in county-owned space. RAISE WITH AVAIL as a shared LHMP_IA glossary card on The Risk, authored once. Not appended to 2465617.'),
 (844, '2450266', 'HIGH', 'Risk Analysis Process Summary -> exact title match, order 5.'),
 (873, '2465369', 'MEDIUM', 'Data Sources and Limitations. Best fit is the Natural Hazards page Local Context order 9, whose guidance asks for "overall methodology ... outside data sources used in the methodology". Alternative: append to 2450266 on The Risk.'),
 (878, None, 'SKIP', 'Countywide Hazard Summary Matrix - a source-citation line for a table the platform renders itself. Do not transcribe.'),

 (884, '2465395', 'HIGH', 'Natural Hazards > Overview > Executive Summary -> "Executive Summary" order 2.'),

 (1721, '2450125', 'HIGH', 'Single sentence: "Non-natural hazards were not evaluated as part of this Plan update." -> Local Context order 4.'),

 (1725, '2449756', 'HIGH', 'Climate Change > Overview > Local Context -> the page\'s single Local Context, order 5.'),
 (1730, '2449756', 'MEDIUM', 'Shared Socioeconomic Pathways (9,999 ch / 14 paras). The page has only ONE Annotation. Recommend APPEND to 2449756 after [1725] under an SSP sub-heading. NOTE: order 12 on this page is a 21k-char shared "CLIMATE IMPACTS MATRIX" block (component 2449734) - do NOT write there. Owner decision: merge, or request a second Annotation.'),

 (1751, '2450055', 'HIGH', 'Presidential Disasters > Executive Summary -> "Executive Summary" order 3 (guidance = presidential disaster declarations).'),
 (1762, '2450057', 'HIGH', 'State Emergency Declarations > Local Context -> Local Context order 7 (guidance = state emergency declarations).'),
 (1770, '2450061', 'HIGH', 'Local Emergency Declarations > Local Context -> Local Context order 10 (guidance = local emergency declarations).'),

 (1783, '2450098', 'MEDIUM', 'OWNER DECISION 2026-09-08 - SPLIT, part 1 of 2. Doc [1783] is split at the sentence boundary its author already wrote. FIRST SENTENCE of [1784] only ("Mitigation goals and objectives provide the policy framework for selecting, prioritizing, and implementing actions that reduce long-term risk to people, property, infrastructure, and natural systems.") -> 2450098, Strategies > Overview > Local Context, order 3. That slot was previously UNMAPPED. Its guidance asks for "a concise overview of the County mitigation strategy ... communicate the overall intent of what the county aims to achieve and serve as an introduction to the sections that follow" - and this is the only chapter-level sentence in the Strategies chapter that does that job. If D1-SO-2 lands as recommended, [567] also comes here and the two complement each other.'),
 (1783, '2450104', 'MEDIUM', 'OWNER DECISION 2026-09-08 - SPLIT, part 2 of 2. SECOND SENTENCE of [1784] ("For this plan, goals and objectives are defined as follows:") plus [1785] ("Goals: broad, long-term policy statements...") and [1786] ("Objectives: specific supporting statements...") -> 2450104, PREPENDED before [1788]. These three define the two terms and hinge directly into the list, so they belong immediately above it: define, then list. 2450104 guidance says "LIST the county goals and objectives", which [1787] satisfies; the definitions are its lead-in, not its content.'),
 (1787, '2450104', 'HIGH', 'County Goals and Objectives -> exact title match, order 7. 26 paragraphs (goals plus objectives) - preserve the list structure.'),
 (1815, '2450077', 'HIGH', 'Action Development > Local Context -> Local Context order 10 (guidance = how strategies and actions were identified and prioritized).'),
 (1818, '2450179', 'HIGH', 'Problem Area Identification -> exact title match, order 13.'),
 (1820, '2450072', 'HIGH', 'Prioritization and Cost Evaluation -> "Prioritization & Cost Evaluation" order 15.'),
 (1823, '2450073', 'HIGH', 'Funding Sources Local Context -> exact title match, order 20.'),
 (1827, '2450076', 'HIGH', 'Capabilities Highlights -> exact title match, order 24.'),
 (1830, '2450075', 'HIGH', 'Implementation and Integration > Local Context -> Local Context order 27 (guidance = implementation over the last five years, plus forward intent).'),
 (1832, '2450167', 'HIGH', 'Exact title match, order 30.'),
 (1834, '2450165', 'HIGH', 'Exact title match, order 32.'),
 (1836, '2450166', 'HIGH', 'Exact title match, order 34.'),
 (1838, '2450169', 'HIGH', 'Exact title match, order 36.'),

 (1843, '2450060', 'MEDIUM', 'D1-SO-1 DECIDED 2026-09-08 (C1-revised) - PARA [1844] ONLY (how the partners assessed capability, and why) -> Capabilities Assessment > Planning and Regulatory > Local Context, order 5, under an h3 "About this Assessment" lead-in, AFTER [566] and BEFORE [1851]. SKIPPED: [1845]-[1848], one sentence each naming Planning and Regulatory / Administrative and Technical / Financial / Education and Outreach - PURE NAVIGATION, because the page renders those four as its own Cards, each with its own Local Context box already receiving [1851]/[1857]/[1863]/[1869]. Dropping them also removes the original objection to this fallback (that [1845] would announce "Planning and Regulatory" from inside the Planning-and-Regulatory slot). Under C1 no new page-opener slot is added to county_template.'),
 (1851, '2450060', 'HIGH', 'Planning and Regulatory Capabilities > Local Context -> Local Context order 5 (guidance = planning and regulatory).'),
 (1857, '2450058', 'HIGH', 'Administrative and Technical Capabilities > Local Context -> Local Context order 11 (guidance = administrative and technical).'),
 (1863, '2450069', 'HIGH', 'Education and Outreach > Local Context -> Local Context order 17 (guidance = education and outreach).'),
 (1869, '2450067', 'HIGH', 'Financial Capabilities > Local Context -> Local Context order 23 (guidance = financial).'),
 (1825, '2450067', 'MEDIUM', 'OWNER DECISION 2026-09-08: Local Funding Capabilities -> Capabilities Assessment > Financial Capabilities > Local Context (order 23), APPENDED after [1869]/[1871] under a bold "Local Funding Capabilities" lead-in. Overrides both the original recommendation (2450073 on Strategies) and the document placement (doc puts [1825] under Strategies > Capacity to Implement, next to [1823]). Rationale: every sentence is about money, and 2450067 guidance asks for "the types of resources the county can access ... the general approach to securing funding ... established relationships with state and federal funding programs" AND "if there are any gaps in financial capabilities, give a brief summary" - the larger-vs-smaller-municipality contrast IS a gaps statement. NOT split to 2450058: the admin/technical-sounding items (engineering or planning staff, consultant support, intermunicipal partnerships) sit inside one sentence whose subject is what larger vs smaller municipalities can afford, and 2450058 already takes 2,702 ch from [1857]. CAVEAT: ~80%% of [1826] is already said at greater length in [1871] and [1824] - see the task doc.'),

 (1881, '2449737', 'HIGH', 'About the Process > Overview > Local Context -> Local Context order 3.'),
 (589, '2449737', 'HIGH', 'D1-SO-3 DECIDED 2026-09-08 - DISTRIBUTE, part 3/3. PARAS [593]+[598] (what changed since the last plan; update history) -> About the Process > Overview > Local Context, order 3, appended AFTER [1881]. SKIPPED from [589]: [594] and [599]-[602] plus Table 1 - Stafford Act / DMA 2000 / 44 CFR 201 framing, covered by shared LHMP_IA cards.'),
 (1885, '2449754', 'HIGH', 'Other Related Planning Processes -> exact title match, order 5.'),
 (None, '2449738', 'EMPTY', 'Organizational Structure - Planning Teams (order 8): doc [1888] has the heading but no prose. Leave empty; flag to the consultant - planning-team structure belongs here.'),
 (1889, '2465735', 'HIGH', 'Jurisdictional Representation -> exact title match, order 10. Only 365 ch - thin against the guidance ask (representation statistics, gaps, who is and is not participating).'),
 (1891, '2449733', 'HIGH', 'Jurisdictional Engagement Process -> exact title match, order 13.'),
 (1898, '2449735', 'HIGH', 'Stakeholder Outreach and Engagement -> exact title match, order 15.'),
 (1904, '2449757', 'HIGH', 'Public Participation -> exact title match, order 20.'),
 (1911, '2449758', 'HIGH', 'Public Comment -> exact title match, order 22.'),
 (None, '2449743', 'EMPTY', 'Technical Data and Existing Resources (order 25): doc [1915] empty. Leave empty; flag to the consultant.'),
 (1919, '2463655', 'HIGH', 'Adoption > Local Context -> Local Context order 32, whose guidance is explicitly the jurisdictional adoption process.'),
 (562, '2463655', 'MEDIUM', 'D1-SO-2 DECIDED 2026-09-08 - DISTRIBUTE, part 4/4. PARA [568] ONLY (adoption, five-year cycle, FEMA eligibility) -> About the Process > Adoption > Local Context, order 32, appended AFTER [1919] and paired with [572] per D1-SO-4.'),
 (572, '2463655', 'MEDIUM', 'D1-SO-4 DECIDED 2026-09-08 - MERGE into About the Process > Adoption > Local Context (order 32), after [1919] and after [568]. Transcribe the NON-DUPLICATIVE part only: the resolution-content detail (plan title and date, where executed resolutions are held). [573]-[574] largely restate [1920]-[1922], which [1919] already brings to this slot - do not repeat them.'),
 (1926, '2449748', 'HIGH', 'Monitoring and Progress Tracking -> part of "Monitoring, Evaluating, and Updating the Plan" order 35. THREE doc subsections merge into this one slot (1 of 3).'),
 (1929, '2449748', 'HIGH', 'Evaluating Method and Schedule -> same slot 2449748 (2 of 3).'),
 (1936, '2449748', 'HIGH', 'Plan Updating Approach -> same slot 2449748 (3 of 3).'),
 (1944, '2449747', 'HIGH', 'Plan for Integration with Other Plans -> exact title match, order 37.'),
 (None, '2449745', 'EMPTY', 'Continued Public Engagement (order 39): the doc carries no matching prose. Leave empty; flag to the consultant (44 CFR 201.6(c)(4)(iii)).'),

 (None, '2450116', 'EMPTY', 'Track Progress > Executive Summary: the doc has no Track Progress chapter. Leave empty.'),
 (None, '2452231', 'EMPTY', 'Annual Maintenance > Change Log: no doc source. Leave empty.'),

 (1956, None, 'SKIP', 'Appendix A placeholder (one sentence, "as those materials are completed"). Appendices are document artifacts, not pattern content.'),
 (1958, None, 'SKIP', 'Appendix A > Adoption Resolutions placeholder.'),
 (1960, None, 'SKIP', 'Appendix A > Participating-Jurisdiction Adoption Status placeholder.'),
 (1962, None, 'SKIP', 'Appendix A > FEMA Approval Documentation placeholder.'),
 (1964, None, 'SKIP', 'Appendix B placeholder.'),
]

rows = []


def add(doc_n, slot, conf, note, group):
    s = secs.get(doc_n) if doc_n else None
    si = slot_index.get(str(slot)) if slot else None
    rows.append({
        'group': group,
        'doc_block': doc_n or '',
        'doc_level': 'H%d' % s['lvl'] if s else '',
        'doc_heading': s['title'] if s else '',
        'doc_chars': s['chars'] if s else 0,
        'doc_paras': len(s['paras']) if s else 0,
        'doc_tables': s['tables'] if s else 0,
        'page_id': si[0] if si else '',
        'page_title': si[1] if si else '',
        'page_url': '%s/%s' % (SUB, si[2]) if si else '',
        'slot_id': slot or '',
        'slot_title': si[4] if si else '',
        'slot_order': si[3] if si else '',
        'slot_prefilled': ('yes' if si[5] else 'no') if si else '',
        'confidence': conf,
        'note': note,
    })


for doc_n, slot, conf, note in M:
    si = slot_index.get(str(slot)) if slot else None
    add(doc_n, slot, conf, note, si[1] if si else 'front matter / no target')

# --------------------------------------------------------------- hazard pages
HAZ_PAGE = {
    'Avalanche (not profiled)': '2448386', 'Coastal Hazards': '2448355', 'Drought': '2448356',
    'Earthquake': '2448343', 'Extreme Cold': '2448347', 'Extreme Heat': '2448393',
    'Flooding': '2448350', 'Hail': '2448348', 'Hurricane/Tropical Storm': '2448394',
    'Ice Storm': '2448357', 'Landslide': '2448358', 'Lightning': '2448349',
    'Snowstorm': '2448346', 'Tornado': '2448387', 'Wildfire': '2448390', 'Wind': '2448391',
}
SLOTMAP = [
    ('Overview', 'Local Hazard Summary', 'MEDIUM', 'Doc "Overview" (Location / Extent / Probability / Data Limitations). Platform order 5 is a shared data Card of the same name; the nearest Annotation is "Local Hazard Summary" (order 9). Merge with "General Vulnerability" there.'),
    ('General Vulnerability', 'Local Hazard Summary', 'HIGH', 'Doc "General Vulnerability" and slot "Local Hazard Summary" carry the same 44 CFR tags (B2-a, B2-b) and the same position (before the historic-occurrence data block). Platform order 10 Card "General Vulnerability" is data, not prose.'),
    ('Local Hazard Summary', 'Local Hazard Summary', 'HIGH', 'Exact title match.'),
    ('Declarations and Their Effects on the County', 'Declarations and Their Effects on the County', 'HIGH', 'Exact title match.'),
    ('Featured Event', 'Featured Event', 'HIGH', 'Exact title match.'),
    ('County Assessment', 'County Assessment', 'HIGH', 'Exact title match.'),
    ('Local Risk Assessment', 'County Assessment', 'HIGH', 'LIGHTNING ONLY: the doc has no "County Assessment" heading; the county-level assessment prose sits under H4 "Local Risk Assessment" instead. Platform order 35 is a plain lexical header of that name, so the target is the "County Assessment" Annotation.'),
    ('Jurisdictional Assessment', 'Jurisdictional Assessment', 'HIGH', 'Exact title match.'),
    ('Built Environment: Local Risk Summary', 'Built Environment - Local Risk Summary', 'HIGH', 'Title match (colon vs dash).'),
    ('People and Communities: Local Risk Summary', 'People and Communities - Local Risk Summary', 'HIGH', 'Title match (colon vs dash).'),
    ('Natural Environment: Local Risk Summary', 'Natural Environment - Local Risk Summary', 'HIGH', 'Title match (colon vs dash).'),
    ('Local Capabilities', 'Local Capabilities', 'HIGH', 'Exact title match.'),
    ('Local Actions', 'Local Actions', 'HIGH', 'Exact title match.'),
    ('Featured Strategy', 'Featured Strategy', 'HIGH', 'Exact title match.'),
]

allsecs = sorted(secs.values(), key=lambda s: s['n'])
haz_h3 = [s for s in allsecs if s['lvl'] == 3 and 889 <= s['n'] < 1719]
for i, h in enumerate(haz_h3):
    end = haz_h3[i + 1]['n'] if i + 1 < len(haz_h3) else 1719
    pid = HAZ_PAGE[h['title']]
    pslots = {s['title'].strip(): s for s in inv[pid]['slots']}
    inner = [s for s in allsecs if h['n'] < s['n'] < end]
    claimed = set()
    for dh, st, conf, note in SLOTMAP:
        hit = next((s for s in inner if s['title'].strip() == dh), None)
        if hit is None or hit['chars'] <= 40:
            continue
        slot = pslots.get(st)
        if slot is None:
            add(hit['n'], None, 'GAP',
                note + '  ** The "%s" slot DOES NOT EXIST on this page - template defect, see the drift table. **' % st,
                h['title'])
            continue
        claimed.add(st)
        add(hit['n'], slot['id'], conf, note, h['title'])
    for t, s in pslots.items():
        if t not in claimed:
            if s['filled']:
                add(None, s['id'], 'PREFILLED',
                    'Already carries template cross-reference text ("%s"). Not a county-content slot - do not overwrite.'
                    % s['text'][:90], h['title'])
            else:
                add(None, s['id'], 'EMPTY',
                    'No source prose in the %s profile for this slot. Leave empty.' % h['title'], h['title'])

json.dump(rows, open('../out/crosswalk.json', 'w'), indent=1)
FIELDS = ['group', 'doc_block', 'doc_level', 'doc_heading', 'doc_chars', 'doc_paras', 'doc_tables',
          'page_id', 'page_title', 'page_url', 'slot_id', 'slot_title', 'slot_order',
          'slot_prefilled', 'confidence', 'note']
with open('../out/westchester-baseplan-crosswalk.csv', 'w', newline='', encoding='utf-8-sig') as f:
    w = csv.DictWriter(f, fieldnames=FIELDS)
    w.writeheader()
    for r in rows:
        w.writerow(r)

c = Counter(r['confidence'] for r in rows)
print('rows:', len(rows), dict(c))
mapped = [r for r in rows if r['slot_id'] and r['confidence'] in ('HIGH', 'MEDIUM', 'LOW')]
print('slots receiving content:', len({r['slot_id'] for r in mapped}))
print('doc sections with a target:', len({r['doc_block'] for r in mapped if r['doc_block']}))
print('total chars to transcribe:', sum(r['doc_chars'] for r in mapped))
print('slots left EMPTY:', len({r['slot_id'] for r in rows if r['confidence'] == 'EMPTY'}))
print('doc sections with NO target (GAP/PARTIAL):',
      len([r for r in rows if r['confidence'] in ('GAP', 'PARTIAL')]))
