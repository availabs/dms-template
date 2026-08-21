"""Build the annex-chapter -> geoid alias table.

Jurisdiction identity must come from ONE explicit table, never from names parsed out of
chapter filenames or document titles. Names disagree across every source:

  annex file            "Chapter 31 - Shinnecock Tribal Nation.docx"
  document H1           "Shinnecock Tribal Nation"
  actions workbook      "Shinnecock (Tribal Nation)"
  Jurisdictions dataset "Shinnecock (Reservation)"
  HOC dataset           (no rows)

...and all four are the same place, geoid 3610367059. Keying on names silently files content
under the wrong jurisdiction; keying on this table cannot.

Emits suffolk-jurisdiction-aliases.csv.
"""
import csv, json, os, re, sys
import openpyxl
from pyxlsb import open_workbook

BASE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
JWB = os.path.join(BASE, '..', 'LHMP-Jurisdicions-Datasets',
                   'MNY-Workbook-with-Jurisidictions-data.xlsb')
AWB = os.path.join(BASE, 'Suffolk_County_Actions_2.0_reconciled v2.xlsx')
PF = os.path.join(BASE, 'context', 'extracted', 'preflight.json')
HOC = os.path.join(BASE, 'context', 'hoc_suffolk_rows.json')
OUT = os.path.join(BASE, 'suffolk-jurisdiction-aliases.csv')

COUNTY_GEOID = '36103'

# Non-census entities needing a synthetic geoid. Block 36103 + 9xxxx is verified unused
# statewide (0 of 970 cousub geoids use a 9-prefixed suffix), so it cannot collide.
SYNTHETIC = {
    'Suffolk County Water Authority': {
        'geoid': '3610390001',
        'municipality_name': 'Suffolk County Water Authority',
        'municipality_type': 'Authority',
        'census_type': 'Non-Census',
        'note': 'SYNTHETIC geoid - no census geography. Needs a new Jurisdictions row.',
    },
}


def norm(s):
    return re.sub(r'[^a-z0-9]', '', (s or '').lower())


# --- Jurisdictions dataset (statewide export) -> Suffolk rows by geoid ---
juris = {}
with open_workbook(JWB) as wb:
    with wb.get_sheet('Jurisdictions-Data') as sh:
        for i, row in enumerate(sh.rows()):
            v = [c.v for c in row]
            if i == 0:
                continue
            if str(v[5] or '') != 'Suffolk':
                continue
            g = v[1]
            if g is None:
                continue
            g = str(int(g)) if isinstance(g, float) else str(g)
            juris[g] = {'title': v[0], 'municipality_type': v[3],
                        'census_type': v[4], 'municipality_name': v[36]}

# --- Actions workbook -> jurisdiction label + geoid ---
awb = openpyxl.load_workbook(AWB, read_only=True, data_only=True)
ws = awb['Actions']
it = ws.iter_rows(values_only=True)
next(it)
actions = {}
for r in it:
    label, g = r[2], r[3]
    if g is not None:
        g = str(int(g)) if isinstance(g, float) else str(g)
    actions.setdefault(label, {'geoid': g, 'n': 0})
    actions[label]['n'] += 1

# --- HOC live rows -> geoid present? ---
hoc_geoids = set()
if os.path.exists(HOC):
    raw = json.load(open(HOC, encoding='utf8'))
    for r in raw.get('items', raw):
        for g in (r['data'].get('geoid_juris') or []):
            hoc_geoids.add(str(g))

# --- annex chapters ---
pf = json.load(open(PF, encoding='utf8'))
chapters = [r for r in pf if 'error' not in r and not r['file'].startswith('Chapter 1 -')]

# resolve each chapter -> geoid, via the actions workbook label, then by name against Jurisdictions
by_norm_action = {norm(k): k for k in actions}
by_norm_juris = {norm(v['title']): g for g, v in juris.items()}

rows = []
for ch in chapters:
    f = ch['file']
    chapter_no = int(re.search(r'Chapter (\d+)', f).group(1))
    raw_name = re.match(r'Chapter \d+ - (.+)\.docx', f).group(1)
    expanded = raw_name.replace(' (T)', ' (Town)').replace(' (V)', ' (Village)')

    # 1. try the actions workbook label
    cand = [expanded, raw_name,
            expanded.replace(' Tribal Nation', ' (Tribal Nation)')]
    label = next((by_norm_action[norm(c)] for c in cand if norm(c) in by_norm_action), None)
    geoid = actions[label]['geoid'] if label else None

    # 2. synthetic override for non-census entities
    syn = SYNTHETIC.get(raw_name)
    if syn:
        geoid = syn['geoid']

    # 3. fall back to a name match against the Jurisdictions dataset
    if geoid is None:
        geoid = next((by_norm_juris[norm(c)] for c in cand if norm(c) in by_norm_juris), None)

    j = juris.get(geoid or '')
    rows.append({
        'chapter_file': f,
        'chapter_no': chapter_no,
        'annex_name': raw_name,
        'geoid': geoid or '',
        'jurisdictions_title': (j or syn or {}).get('title') or (syn or {}).get('municipality_name', ''),
        'municipality_type': (j or syn or {}).get('municipality_type', ''),
        'census_type': (j or syn or {}).get('census_type', ''),
        'actions_label': label or '',
        'n_actions_workbook': actions[label]['n'] if label else 0,
        'in_jurisdictions': 'yes' if j else 'NO',
        'in_hoc': 'yes' if geoid in hoc_geoids else 'NO',
        'note': (syn or {}).get('note', ''),
    })

rows.sort(key=lambda r: r['chapter_no'])
cols = ['chapter_no', 'chapter_file', 'annex_name', 'geoid', 'jurisdictions_title',
        'municipality_type', 'census_type', 'actions_label', 'n_actions_workbook',
        'in_jurisdictions', 'in_hoc', 'note']
with open(OUT, 'w', encoding='utf8', newline='') as fh:
    w = csv.DictWriter(fh, fieldnames=cols)
    w.writeheader()
    w.writerows(rows)

print(f"wrote {OUT}  ({len(rows)} chapters)")
print()
unresolved = [r for r in rows if not r['geoid']]
print('chapters with NO geoid:', len(unresolved))
for r in unresolved:
    print('   !', r['chapter_file'])
print()
print('needs a Jurisdictions row created:')
for r in rows:
    if r['in_jurisdictions'] == 'NO':
        print(f"   + {r['annex_name']:<36} geoid={r['geoid']}  {r['note']}")
print()
print('needs HOC rows created:')
for r in rows:
    if r['in_hoc'] == 'NO':
        print(f"   + {r['annex_name']:<36} geoid={r['geoid']}")
print()
dupes = {}
for r in rows:
    dupes.setdefault(r['geoid'], []).append(r['annex_name'])
col = {g: n for g, n in dupes.items() if len(n) > 1}
print('geoid collisions across chapters:', col if col else 'none')
