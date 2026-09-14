"""Westchester jurisdictional annexes -> Jurisdictions dataset crosswalk.

The IEM annex .docx files are authored against the v3 annex page's component order:
each heading is a Card title, in page order. So we align the doc's flat paragraph
stream against the page's ordered section titles and attribute the prose between
headings to the section that opened it.

python-docx trap: these files carry NO heading styles -- every paragraph is
style "Normal". Section detection is by title match in page order, not by style.

Outputs (all under ../out/):
  annex_sections.json   per-jurisdiction (section -> text, chars)
  crosswalk.csv         one row per (jurisdiction, section) mapping
  crosswalk.json        machine-readable, the load spec's input
  discrepancies.json    everything needing owner review
"""
import io, json, os, re, sys, csv
from collections import OrderedDict, Counter, defaultdict
from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph
from docx.oxml.ns import qn

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'out')
ANNEX_DIR = os.path.join(HERE, '..', '..', 'Final Plan', 'Draft Annexes')

JURIS_SOURCE = '1346449'
JURIS_VIEW = '1346450'
COUNTY_GEOID = '36119'

# ---------------------------------------------------------------- page model

comps = json.load(io.open(os.path.join(OUT, 'annex_page_components.json'), encoding='utf-8'))
cols = json.load(io.open(os.path.join(OUT, 'juris_columns.json'), encoding='utf-8'))
LEXICAL = {c['name'] for c in cols if c.get('type') == 'lexical'}
DISPLAY = {c['name']: (c.get('display_name') or c['name']) for c in cols}

# Ordered list of titled components on the annex page. A component is a FILL TARGET
# when its single shown column is a lexical column of the Jurisdictions source.
SECTIONS = []
for c in comps:
    title = (c.get('title') or '').strip()
    if not title:
        continue
    shown = c.get('shown') or []
    col = None
    if len(shown) == 1 and shown[0].get('name') in LEXICAL and not c.get('source'):
        col = shown[0]['name']
    SECTIONS.append({
        'ord': c['order'], 'comp': c['id'], 'title': title,
        'et': c['et'], 'column': col,
        'kind': 'fill' if col else ('data' if c['et'] in ('Spreadsheet', 'Map') else 'shared'),
    })

TITLES = [s['title'].lower() for s in SECTIONS]

# ------------------------------------------------------------- docx parsing

def iter_blocks(parent):
    for child in parent.element.body.iterchildren():
        if child.tag == qn('w:p'):
            yield Paragraph(child, parent)
        elif child.tag == qn('w:tbl'):
            yield Table(child, parent)


def parse_docx(path):
    doc = Document(path)
    out = []
    n = 0
    for item in iter_blocks(doc):
        n += 1
        if isinstance(item, Paragraph):
            t = item.text.strip()
            if t:
                out.append({'n': n, 'kind': 'p', 'text': t,
                            'style': item.style.name if item.style is not None else ''})
        else:
            out.append({'n': n, 'kind': 'table',
                        'nrows': len(item.rows), 'ncols': len(item.columns)})
    return out


# Paragraphs that are placeholders for content the platform renders itself.
PLACEHOLDER = re.compile(
    r'^(table from working copy|embedded table already filled|embedded\s+table|'
    r'embedded\s+map|embedded\s+infrastructure table|table from mitigate ny|'
    r'hazard mitigation representatives table|planning process table|'
    r'learn more)\.?$', re.I)

# The annex page slot is misspelled "Historic Occurances"; 11 annexes spell it
# correctly. Without this alias their prose falls into the preceding section.
# Heading spellings that differ from the page's Card title. The full corpus was swept
# (see the fuzzy scan in the task doc); these four are the only variants that exist.
# Without them the prose silently lands in the preceding section.
ALIAS = {
    'historic occurrences': 'historic occurances',              # 11 annexes
    'historic occurences': 'historic occurances',               # Port Chester, Tarrytown ("OccurEnces")
    'buildings by land use': 'buildings by landuse',            # Pound Ridge
    'historic properties/districts (if applicable)':
        'historic properties/district (if applicable)',         # Westchester County
}


def sectionize(blocks, juris_label):
    """Align the flat paragraph stream against SECTIONS in page order."""
    sections = OrderedDict()
    cursor = 0          # index into SECTIONS; only ever moves forward
    current = None
    unmatched_head = []
    for b in blocks:
        if b['kind'] != 'p':
            continue
        t = b['text']
        low = t.lower().strip().rstrip(':')
        low = ALIAS.get(low, low)
        # does this paragraph open the next (or a later) expected section?
        hit = None
        for j in range(cursor, len(SECTIONS)):
            if TITLES[j] == low:
                hit = j
                break
        if hit is not None and len(t) < 90:
            cursor = hit + 1
            current = dict(SECTIONS[hit], idx=hit)
            key = f"{hit:02d}::{current['title']}"
            sections[key] = {'idx': hit, 'ord': current['ord'], 'title': current['title'],
                             'comp': current['comp'], 'column': current['column'],
                             'kind': current['kind'], 'paras': [], 'first_block': b['n']}
            continue
        if current is None:
            unmatched_head.append(t)
            continue
        if PLACEHOLDER.match(low):
            continue
        sections[f"{current['idx']:02d}::{current['title']}"]['paras'].append(t)
    for s in sections.values():
        s['text'] = '\n\n'.join(s['paras'])
        s['chars'] = len(s['text'])
    return sections, unmatched_head


# --------------------------------------------------------------- dataset rows

rows = json.load(io.open(os.path.join(OUT, 'juris_rows_36119.json'), encoding='utf-8'))['items']


def lex_len(v):
    if not v:
        return 0
    if isinstance(v, str):
        try:
            v = json.loads(v)
        except Exception:
            return len(v)
    def walk(n):
        t = n.get('text', '') or ''
        for c in (n.get('children') or []):
            t += ' ' + walk(c)
        return t
    r = v.get('root') if isinstance(v, dict) else None
    return len(walk(r).strip()) if r else 0


REAL = []
for r in rows:
    d = r['data'] or {}
    if (d.get('census_type') or '').lower() == 'cdp':
        continue
    REAL.append({
        'row_id': str(r['id']),
        'geoid': d.get('geoid'),
        'census_type': d.get('census_type'),
        'muni_type': d.get('municipality_type'),
        'name': d.get('municipality_name'),
        'existing': {k: lex_len(d.get(k)) for k in LEXICAL if lex_len(d.get(k)) > 0},
    })

# ------------------------------------------------- filename -> dataset row map
# Keys are the docx filename stem after "Westchester_Jurisdictional_Annex_".
# Value: (municipality_name, municipality_type) identifying the dataset row, or
# None where the mapping needs an owner decision.
FILE_MAP = {
    'Ardsley':            ('Ardsley', 'Village'),
    'Bedford':            ('Bedford', 'Town'),
    'BriarcliffManor':    ('Briarcliff Manor', 'Village'),
    'Bronxville':         ('Bronxville', 'Village'),
    'Buchanan':           ('Buchanan', 'Village'),
    'CityOfRye':          ('Rye', 'City'),
    'Cortlandt':          ('Cortlandt', 'Town'),
    'Croton-on-Hudson':   ('Croton-on-Hudson', 'Village'),
    'DobbsFerry':         ('Dobbs Ferry', 'Village'),
    'Eastchester':        ('Eastchester', 'Town'),
    'Elmsford':           ('Elmsford', 'Village'),
    'Greenburgh':         ('Greenburgh', 'Town'),
    'Harrison':           ('Harrison', 'Town'),
    'HastingsOnHudson':   ('Hastings-on-Hudson', 'Village'),
    'Irvington':          ('Irvington', 'Village'),
    'Larchmont':          ('Larchmont', 'Village'),
    'Lewisboro':          ('Lewisboro', 'Town'),
    'MamaroneckVillage':  ('Mamaroneck', 'Village'),
    'MountKisco':         ('Mount Kisco', 'Village'),
    'MountVernon':        ('Mount Vernon', 'City'),
    'NewCastle':          ('New Castle', 'Town'),
    'NewRochelle':        ('New Rochelle', 'City'),
    'NorthCastle':        ('North Castle', 'Town'),
    'NorthSalem':         ('North Salem', 'Town'),
    'Ossining':           ('Ossining', 'Village'),
    'Peekskill':          ('Peekskill', 'City'),
    'Pelham':             ('Pelham', 'Village'),
    'PelhamManor':        ('Pelham Manor', 'Village'),
    'Pleasantville':      ('Pleasantville', 'Village'),
    'PortChester':        ('Port Chester', 'Village'),
    'PoundRidge':         ('Pound Ridge', 'Town'),
    'Rye':                ('Rye', 'Town'),
    'RyeBrook':           ('Rye Brook', 'Village'),
    'Scarsdale':          ('Scarsdale', 'Village'),
    'SleepyHollow':       ('Sleepy Hollow', 'Village'),
    'Somers':             ('Somers', 'Town'),
    'Tarrytown':          ('Tarrytown', 'Village'),
    'TownMamaroneck':     ('Mamaroneck', 'Town'),
    'TownOfPelham':       ('Pelham', 'Town'),
    'TownOssining':       ('Ossining', 'Town'),
    'Tuckahoe':           ('Tuckahoe', 'Village'),
    'WestchesterCounty':  ('Westchester', 'County'),
    'WhitePlains':        ('White Plains', 'City'),
    'Yonkers':            ('Yonkers', 'City'),
    'Yorktown':           ('Yorktown', 'Town'),
}


# D-A1 (owner decision 2026-09-04): where the statewide dataset carries both a Census
# Place row and a Census MCD ("cousub") row for the same jurisdiction, write to the PLACE
# row. Precedent: Schenectady's City of Schenectady loaded to Place row 1348106, and no
# county has ever been loaded to a lowercase `cousub` city row.
ROW_OVERRIDE = {
    'CityOfRye':   '1679791',   # Place / City,  geoid 3664309   (MCD twin 1348065)
    'MountVernon': '1679799',   # Place / City,  geoid 3649121   (MCD twin 1347657)
    'NewRochelle': '1679991',   # Place / City,  geoid 3650617   (MCD twin 1347713)
    'Peekskill':   '1680001',   # Place / City,  geoid 3656979   (MCD twin 1347875)
    'Yonkers':     '1679971',   # Place / City,  geoid 3684000   (MCD twin 1348530)
    'Harrison':    '1347244',   # Place / Town,  geoid 3632402   (MCD twin 1347243)
}


def find_row(name, mtype):
    hits = [r for r in REAL if r['name'] == name
            and (r['muni_type'] or '').lower() == mtype.lower()]
    return hits


# ------------------------------------------------------------------- run

files = sorted(f for f in os.listdir(ANNEX_DIR) if f.lower().endswith('.docx'))
print(f'{len(files)} annex files', file=sys.stderr)

all_sections = {}
cross = []
disc = defaultdict(list)
section_presence = Counter()

for fn in files:
    stem = fn[len('Westchester_Jurisdictional_Annex_'):-len('.docx')]
    blocks = parse_docx(os.path.join(ANNEX_DIR, fn))
    secs, head = sectionize(blocks, stem)
    styles = Counter(b.get('style') for b in blocks if b['kind'] == 'p')

    tgt = FILE_MAP.get(stem)
    rowhits = find_row(*tgt) if tgt else []
    if stem in ROW_OVERRIDE:
        rowhits = [r for r in rowhits if r['row_id'] == ROW_OVERRIDE[stem]]
        disc['row_override_applied'].append(
            {'file': stem, 'row_id': ROW_OVERRIDE[stem], 'rule': 'D-A1 Census Place'})
    if not tgt:
        disc['unmapped_file'].append({'file': stem})
    elif len(rowhits) == 0:
        disc['no_dataset_row'].append({'file': stem, 'looked_for': tgt})
    elif len(rowhits) > 1:
        disc['ambiguous_row'].append({'file': stem, 'looked_for': tgt,
                                      'rows': [r['row_id'] for r in rowhits]})
    row = rowhits[0] if len(rowhits) == 1 else None

    all_sections[stem] = {
        'file': fn, 'target': tgt,
        'row_id': row['row_id'] if row else None,
        'geoid': row['geoid'] if row else None,
        'n_blocks': len(blocks), 'styles': dict(styles),
        'unmatched_head': head,
        'sections': {k: {kk: vv for kk, vv in v.items() if kk != 'paras'}
                     for k, v in secs.items()},
        'text': {k: v['text'] for k, v in secs.items()},
    }

    for key, s in secs.items():
        section_presence[s['comp']] += 1
        if s['chars'] == 0:
            continue
        if s['kind'] == 'fill':
            cross.append({
                'file': stem, 'row_id': row['row_id'] if row else '',
                'geoid': row['geoid'] if row else '',
                'jurisdiction': f"{tgt[0]} ({tgt[1]})" if tgt else stem,
                'sec_ord': s['ord'], 'section': s['title'],
                'column': s['column'], 'display_name': DISPLAY.get(s['column'], ''),
                'chars': s['chars'],
                'existing_chars': (row['existing'].get(s['column'], 0) if row else 0),
                'conf': 'High',
            })
        else:
            disc['prose_on_non_fill_section'].append({
                'file': stem, 'section': s['title'], 'ord': s['ord'],
                'kind': s['kind'], 'comp': s['comp'], 'chars': s['chars'],
                'preview': s['text'][:180],
            })

json.dump(all_sections, io.open(os.path.join(OUT, 'annex_sections.json'), 'w', encoding='utf-8'),
          indent=1, ensure_ascii=False)

# ---- coverage: fill targets the annexes never populate
fill_titles = [s for s in SECTIONS if s['kind'] == 'fill']
never = [s for s in fill_titles if section_presence.get(s['comp'], 0) == 0]
disc['fill_slot_never_used'] = [{'ord': s['ord'], 'title': s['title'],
                                 'column': s['column'], 'comp': s['comp']} for s in never]

# ---- dataset rows with no annex file
mapped_rows = set()
for stem, t in FILE_MAP.items():
    hits = find_row(*t)
    if stem in ROW_OVERRIDE:
        hits = [r for r in hits if r['row_id'] == ROW_OVERRIDE[stem]]
    for r in hits:
        mapped_rows.add(r['row_id'])
disc['dataset_row_no_annex'] = [
    {'row_id': r['row_id'], 'name': r['name'], 'muni_type': r['muni_type'],
     'census_type': r['census_type'], 'geoid': r['geoid'],
     'has_existing_content': bool(r['existing'])}
    for r in REAL if r['row_id'] not in mapped_rows]

# ---- rows that already carry prose the load would overwrite
disc['existing_content_overwrite'] = []
for c in cross:
    if c['existing_chars'] > 0:
        disc['existing_content_overwrite'].append(
            {'row_id': c['row_id'], 'jurisdiction': c['jurisdiction'],
             'column': c['column'], 'existing_chars': c['existing_chars'],
             'incoming_chars': c['chars']})

# ---- lexical columns with no Card on the annex page
page_cols = {s['column'] for s in SECTIONS if s['column']}
disc['column_not_on_page'] = sorted(LEXICAL - page_cols)

json.dump({k: v for k, v in disc.items()},
          io.open(os.path.join(OUT, 'discrepancies.json'), 'w', encoding='utf-8'),
          indent=1, ensure_ascii=False)
json.dump(cross, io.open(os.path.join(OUT, 'crosswalk.json'), 'w', encoding='utf-8'),
          indent=1, ensure_ascii=False)

with io.open(os.path.join(OUT, 'crosswalk.csv'), 'w', encoding='utf-8', newline='') as f:
    w = csv.DictWriter(f, fieldnames=list(cross[0].keys()))
    w.writeheader()
    w.writerows(cross)

# ------------------------------------------------------------------ summary
print(f'\ncrosswalk rows: {len(cross)}')
print(f'jurisdictions with a mapped row: {len({c["row_id"] for c in cross if c["row_id"]})}')
print(f'distinct columns receiving content: {len({c["column"] for c in cross})}')
print(f'total chars: {sum(c["chars"] for c in cross):,}')
print('\nfill-target coverage (of %d annex files):' % len(files))
for s in fill_titles:
    n = section_presence.get(s['comp'], 0)
    print(f'  ord {s["ord"]:>2}  {s["title"][:44]:44} {s["column"][:40]:40} {n}/{len(files)}')
print('\ndiscrepancy counts:')
for k, v in disc.items():
    print(f'  {k}: {len(v)}')
