#!/usr/bin/env python3
"""Parse one season sheet out of references/wcdb/WCDB SCHEDULE.xlsx into airings.

    python3 scripts/wcdb-admin/parse-schedule-xlsx.py "Fall 2026" > slots.json

Reads the xlsx with zipfile + ElementTree — openpyxl is not installed in this env and
the format is simple enough not to need it.

THE SHEET IS A DJ GRID, NOT A SHOW GRID. Columns are days (starting SUNDAY), rows are
hours (row 2 = 12AM-1AM), and each cell holds a DJ's on-air name — occasionally a show
name instead ("Training Show", "The Social Workers"). Resolving those labels to show_ids
is the loader's job, not this script's.

A VERTICALLY MERGED CELL IS ONE MULTI-HOUR AIRING with its text in the top cell, so the
merge list is the only place the duration lives. Horizontal merges are banners and are
ignored.
"""
import json, re, sys, zipfile
from xml.etree import ElementTree as ET

NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
      'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
XLSX = 'references/wcdb/WCDB SCHEDULE.xlsx'

# Sheet column → the dataset's `day`. The dataset numbers days 0 = MONDAY (see the
# migration and the public on-air card); the sheet's week starts on Sunday.
DAY = {'B': 6, 'C': 0, 'D': 1, 'E': 2, 'F': 3, 'G': 4, 'H': 5}
DAYNAME = {0: 'Mon', 1: 'Tue', 2: 'Wed', 3: 'Thu', 4: 'Fri', 5: 'Sat', 6: 'Sun'}


def main(sheet_name):
    z = zipfile.ZipFile(XLSX)
    shared = [''.join(t.text or '' for t in si.iter('{%s}t' % NS['m']))
              for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si', NS)] \
        if 'xl/sharedStrings.xml' in z.namelist() else []

    rels = {r.get('Id'): r.get('Target')
            for r in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
    target = None
    for sh in ET.fromstring(z.read('xl/workbook.xml')).find('m:sheets', NS):
        if sh.get('name') == sheet_name:
            target = rels[sh.get('{%s}id' % NS['r'])].lstrip('/')
            if not target.startswith('xl/'):
                target = 'xl/' + target
    if not target:
        sys.exit(f'no sheet named {sheet_name!r} in {XLSX}')

    root = ET.fromstring(z.read(target))
    cells = {}
    for cell in root.iter('{%s}c' % NS['m']):
        col, row = re.match(r'([A-Z]+)(\d+)', cell.get('r')).groups()
        v, isel = cell.find('m:v', NS), cell.find('m:is', NS)
        if cell.get('t') == 's' and v is not None:
            txt = shared[int(v.text)]
        elif isel is not None:
            txt = ''.join(x.text or '' for x in isel.iter('{%s}t' % NS['m']))
        elif v is not None:
            txt = v.text
        else:
            continue
        if str(txt).strip():
            cells[(int(row), col)] = str(txt).strip()

    mc = root.find('m:mergeCells', NS)
    span = {}
    for m in (mc if mc is not None else []):
        a, b = m.get('ref').split(':')
        c1, r1 = re.match(r'([A-Z]+)(\d+)', a).groups()
        c2, r2 = re.match(r'([A-Z]+)(\d+)', b).groups()
        if c1 == c2:
            span[(int(r1), c1)] = int(r2) - int(r1) + 1

    slots = []
    for (row, col), txt in sorted(cells.items()):
        if row == 1 or col not in DAY:      # day header / hour-label column
            continue
        hours = span.get((row, col), 1)
        start = row - 2                     # row 2 is the midnight slot
        slots.append({'day': DAY[col], 'dayname': DAYNAME[DAY[col]], 'start': start,
                      'hours': hours, 'end': start + hours, 'label': txt})

    slots.sort(key=lambda s: (s['day'], s['start']))
    print(json.dumps(slots, indent=1))
    print(f'{len(slots)} airings, {sum(s["hours"] for s in slots)} of 168 hours',
          file=sys.stderr)


main(sys.argv[1] if len(sys.argv) > 1 else 'Fall 2026')
