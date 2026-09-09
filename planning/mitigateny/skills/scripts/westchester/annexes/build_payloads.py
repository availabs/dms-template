"""Turn the annex crosswalk into per-row {column: lexicalRoot} payload files.

Implements the owner decisions of 2026-09-04 (task doc D-A1 … D-A8):

  D-A1  ambiguous jurisdictions -> the Census Place row (applied in build_crosswalk.py)
  D-A3  Bedford's prior-cycle prose is overwritten
  D-A5  ord 38 "Disaster and Local Emergencies" local paragraphs -> lhmp_historic_occurances
        ord 54 "Strategy"                                        -> lhmp (prepended)
  D-A8  ord 20 stray (Westchester County)                        -> historic_prop_dist
        ord 35 stray (Port Chester, Tarrytown)                   -> lhmp_historic_occurances

Where a column receives more than one contribution, each is introduced by an h3 lead-in
naming its source section, so the merge stays legible and reversible. A column with a
single contribution gets no heading. Prose is verbatim; only headings are added.
"""
import io, json, os, collections

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'out')
PAY = os.path.join(OUT, 'payloads')
os.makedirs(PAY, exist_ok=True)

A = json.load(io.open(os.path.join(OUT, 'annex_sections.json'), encoding='utf-8'))

# page-ord -> (target column, lead-in label, paragraph slice)
REASSIGN = {
    38: ('lhmp_historic_occurances', 'Local Emergency Management', slice(2, None)),
    54: ('lhmp',                     'Strategy',                   slice(None)),
    20: ('historic_prop_dist',       'Historic Properties and Districts', slice(None)),
    35: ('lhmp_historic_occurances', 'Historic Occurrences',       slice(None)),
}
# lead-in labels for native fill sections, used only when a column is shared
NATIVE_LABEL = {
    37: 'Historic Occurrences',
    59: 'Action Development',
    22: 'Historic Properties and Districts',
}

# ------------------------------------------------------------------ lexical


def text_node(t):
    return {'detail': 0, 'format': 0, 'mode': 'normal', 'style': '',
            'text': t, 'type': 'text', 'version': 1}


def paragraph(t):
    return {'children': [text_node(t)] if t else [], 'direction': 'ltr' if t else None,
            'format': '', 'indent': 0, 'type': 'paragraph', 'version': 1,
            'textFormat': 0, 'textStyle': ''}


def heading(t, tag='h3'):
    return {'children': [text_node(t)], 'direction': 'ltr', 'format': '',
            'indent': 0, 'type': 'heading', 'version': 1, 'tag': tag}


def root(children):
    return {'root': {'children': children, 'direction': 'ltr', 'format': '',
                     'indent': 0, 'type': 'root', 'version': 1}}


# ------------------------------------------------------------------ assemble

spec = []
skipped_rows = []
for stem in sorted(A):
    rec = A[stem]
    row_id = rec['row_id']
    if not row_id:
        skipped_rows.append(stem)
        continue

    # contributions[column] = [(sort_key, label_or_None, [paras])]
    contrib = collections.defaultdict(list)
    for key, s in rec['sections'].items():
        txt = rec['text'].get(key, '')
        paras = [p.strip() for p in txt.split('\n\n') if p.strip()]
        if not paras:
            continue
        o = s['ord']
        if s['kind'] == 'fill' and s['column']:
            contrib[s['column']].append((o, NATIVE_LABEL.get(o), paras))
        elif o in REASSIGN:
            col, label, sl = REASSIGN[o]
            part = paras[sl]
            if part:
                contrib[col].append((o, label, part))

    columns = {}
    for col, items in contrib.items():
        items.sort(key=lambda x: x[0])
        multi = len(items) > 1
        children = []
        for _o, label, paras in items:
            if multi and label:
                children.append(heading(label))
            children.extend(paragraph(p) for p in paras)
        columns[col] = root(children)

    fn = os.path.join(PAY, f'{row_id}_{stem}.json')
    io.open(fn, 'w', encoding='utf-8', newline='\n').write(
        json.dumps(columns, indent=1, ensure_ascii=False))
    spec.append({
        'file': stem, 'row_id': row_id, 'geoid': rec['geoid'],
        'jurisdiction': f"{rec['target'][0]} ({rec['target'][1]})",
        'payload': os.path.relpath(fn, OUT).replace('\\', '/'),
        'columns': sorted(columns),
        'n_columns': len(columns),
        'chars': sum(len(p) for items in contrib.values() for _o, _l, ps in items for p in ps),
        'merged': {c: [i[0] for i in v] for c, v in contrib.items() if len(v) > 1},
    })

json.dump(spec, io.open(os.path.join(OUT, 'load_spec.json'), 'w', encoding='utf-8'),
          indent=1, ensure_ascii=False)

print(f'{len(spec)} rows, {sum(x["n_columns"] for x in spec)} column writes, '
      f'{sum(x["chars"] for x in spec):,} chars')
if skipped_rows:
    print('no dataset row (skipped):', skipped_rows)
cc = collections.Counter(c for x in spec for c in x['columns'])
print('\nper-column write counts:')
for c, n in sorted(cc.items(), key=lambda kv: -kv[1]):
    print(f'  {c:38} {n}')
mg = collections.Counter(c for x in spec for c in x['merged'])
print('\nmerged columns:', dict(mg))
