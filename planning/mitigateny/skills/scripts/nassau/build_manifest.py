"""Build the authoritative-file manifest for all 52 Nassau annex folders.

Default rule: exactly one annex .docx and N MAW*.docx per folder, take them.
The five folders that need a judgement call are listed explicitly below with the reason,
so the manifest records the decision rather than re-deriving it.
"""
import csv
import io
import os
import re

ROOT = 'references/mny-transcribe/Nassau/All Annexes'
OUT = 'references/mny-transcribe/Nassau/context/file-manifest.csv'
MAW = re.compile(r'^MAW[\d_]', re.I)   # NOTE: was ^MAW\d+ — that missed "MAW_3 …"

# folder -> (annex_file, maw_files, worksheet_pdfs, decision_reason)
OVERRIDE = {
    '04_TownofNorthHempstead': (
        '4_TOWN~2.docx', ['MAW1_Town_of_North_Hempstead_FINAL.docx',
                          'MAW2_Town_of_North_Hempstead_FINAL.docx'], [],
        'Two annex candidates, same 133 KB: a legacy 4_TOWN~2.DOC and 4_TOWN~2.docx. The .docx is '
        'readable (16 headings, 16 tables, 31,479 chars); python-docx cannot open the .DOC and it is '
        'a duplicate, not a different revision. 8.3 short filename is the delivered name - do not '
        'rename it, quote it.'),
    '17_VillageofGardenCity': (
        '17_Village of Garden City_Jurisdictional Annex 8-18-2021 FINAL EDITS.docx',
        ['archive/MAW1_Village_of_Garden_City_FINAL Revised.docx',
         'archive/MAW2_Village_of_Garden_City_FINAL.docx'],
        ['VGC_4 Cedar Valley Sanitary Lift Station.pdf'],
        'Root docx ("8-18-2021 FINAL EDITS", 14,649 chars) supersedes archive/…docx (13,910 chars) - '
        'same 14 headings and 9 tables, so it is a later revision of the same document, not a '
        'different one. BOTH MAW docx live in archive/ ONLY - a top-level-only scan reports zero '
        'MAWs for this folder, which is wrong. A third worksheet (VGC_4) ships as a 1-page PDF named '
        'after the project, not as MAW3.'),
    '49_VillageofWillistonPark': (
        '49_Village of Williston Park_Jurisdictional Annex.docx',
        ['MAW1_Village_of_Williston_Park_FINAL.docx',
         'MAW2_Village_of_Williston_Park_FINAL.docx',
         'MAW_3 NEW Williston Park.docx'], [],
        'Only one annex docx. The third file, "MAW_3 NEW Williston Park.docx", IS a worksheet '
        '(0 headings, 2 tables, 32,497 chars - the filled + instructions pair) but is named MAW_3, '
        'so a ^MAW\\d+ regex classifies it as an annex candidate. Underscore after MAW.'),
    '50_VillageofWoodsburgh': (
        '50_Village_of_Woodsburgh_Jurisdictional_Annex - FINAL Revisions.docx',
        ['MAW1_Village_of_Woodsburgh_FINAL.docx',
         'MAW2_Village_of_Woodsburgh_FINAL.docx'], [],
        '"- FINAL Revisions" (14,341 chars) supersedes the plain docx (13,352 chars); identical '
        '15-heading / 9-table structure, so a later revision of the same document. The later PDF '
        '(JA052_…Updated FINAL.pdf) corroborates. This is the only annex with a Completed Mitigation '
        'Actions section.'),
    '51_VillageofFreeport': (
        '51_Village of Freeport_Jurisdictional Annex.pdf', [], [],
        '** NOT A HAGERTY ANNEX ** Despite the filename, this 177-page PDF is the Village of '
        'Freeport\'s own standalone "2020 All Hazard Mitigation Plan" - 7 chapters, 10 hazard '
        'profiles with their own Previous Occurrences / Probability / Vulnerability subsections, 20 '
        'prose capability sections, and its own mitigation strategy. None of the 12 Hagerty spine '
        'headings appear. Text extracts cleanly (356,988 chars via pypdf) but it CANNOT go through '
        'the annex parser. Owner directed 2026-08-21 that the PDF be used; it needs its own '
        'crosswalk and is tracked as a separate track.'),
}

rows = []
for folder in sorted(os.listdir(ROOT)):
    fp = os.path.join(ROOT, folder)
    if not os.path.isdir(fp):
        continue
    if folder in OVERRIDE:
        annex, maws, wpdf, why = OVERRIDE[folder]
        rows.append([folder, annex, ';'.join(maws), len(maws), ';'.join(wpdf), 'reviewed', why])
        continue
    files = sorted(os.listdir(fp))
    docx = [f for f in files if f.lower().endswith('.docx') and not MAW.match(f)
            and not f.startswith('~$')]
    maws = [f for f in files if MAW.match(f) and f.lower().endswith('.docx')]
    assert len(docx) == 1, (folder, docx)
    rows.append([folder, docx[0], ';'.join(maws), len(maws), '', 'unambiguous',
                 'Exactly one annex .docx and no subfolders; MAW files match MAW<n>_<Jurisdiction>_FINAL.docx.'])

with io.open(OUT, 'w', encoding='utf-8', newline='') as fh:
    w = csv.writer(fh)
    w.writerow(['folder', 'annex_file', 'maw_files', 'n_maw', 'worksheet_pdfs', 'status', 'reason'])
    w.writerows(rows)

n_maw = sum(r[3] for r in rows)
print(f'wrote {OUT}')
print(f'  folders           : {len(rows)}')
print(f'  reviewed by hand  : {sum(1 for r in rows if r[5] == "reviewed")}')
print(f'  MAW docx          : {n_maw}')
print(f'  worksheet PDFs    : {sum(1 for r in rows if r[4])}')
print(f'  annex is a PDF    : {sum(1 for r in rows if r[1].lower().endswith(".pdf"))}')
