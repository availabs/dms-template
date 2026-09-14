"""
Independent audit of an R5 column-removal run.

`validate_element_data_column.mjs` and the writer share `fix_lib.mjs`, so a bug in
that shared path could pass validation and still be wrong. This re-reads every
section through the plain CLI and re-derives the verdict from `rows.csv` alone -
it never opens `applied.json` or `validation.json`, so it cannot inherit the run's
own bookkeeping.

For each row of `rows.csv` it asserts:

  target row (`Remove column` filled)  -> the column is GONE from columns[]
                                       -> and STILL PRESENT in the source snapshot
  held row   (`Remove column` empty)   -> nothing is claimed about a column, but the
                                          section must still be fetchable

and per section: every column that was NOT targeted is still bound, in its original
relative order, so the splice took only what it was asked for.

    python audit_r5.py <run-dir>
"""
import collections, csv, json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
DMS = os.path.abspath(os.path.join(HERE, '../../../../../src/dms/packages/dms/cli/bin/dms.js'))
SNAPSHOT_KEYS = ('externalSource', 'sourceInfo')


def dump(section_id):
    out = subprocess.run(['node', DMS, 'section', 'dump', str(section_id)],
                         capture_output=True, text=True, encoding='utf-8')
    if out.returncode != 0:
        raise SystemExit(f'dms section dump {section_id} failed: {out.stderr[-400:]}')
    s = out.stdout
    row = json.loads(s[s.index('{"id"'):])
    raw = row['data']['element']['element-data']
    return row, json.loads(raw), raw


def main():
    run_dir = sys.argv[1]
    with open(os.path.join(run_dir, 'rows.csv'), encoding='utf-8-sig', newline='') as f:
        rows = list(csv.DictReader(f))

    by_section = collections.OrderedDict()
    for r in rows:
        by_section.setdefault(r['Draft section ID'], []).append(r)

    problems, checks = [], 0
    for n, (sid, group) in enumerate(by_section.items(), 1):
        targets = [r['Remove column'] for r in group if r['Remove column']]
        base_file = os.path.join(run_dir, 'baseline', f'{sid}.json')
        base_cols = None
        if os.path.exists(base_file):
            b = json.load(open(base_file, encoding='utf-8'))
            base_cols = [c.get('name') for c in
                         json.loads(b['data']['element']['element-data'])['columns']]

        try:
            row, edo, raw = dump(sid)
        except SystemExit as e:
            problems.append(f'{sid}: not fetchable - {e}')
            continue

        names = [c.get('name') for c in edo.get('columns', [])]
        snap_key = next((k for k in SNAPSHOT_KEYS
                         if isinstance(edo.get(k), dict)
                         and isinstance(edo[k].get('columns'), list)), None)
        snap_names = {c.get('name') for c in edo[snap_key]['columns']} if snap_key else set()

        for t in targets:
            checks += 1
            if t in names:
                problems.append(f'{sid}: {t!r} is STILL BOUND')
            if snap_key and t not in snap_names:
                problems.append(f'{sid}: {t!r} is missing from {snap_key}.columns '
                                f'- the source snapshot was altered')

        if base_cols is not None:
            checks += 1
            expected = [c for c in base_cols if c not in targets]
            if names != expected:
                problems.append(f'{sid}: surviving columns are not the baseline minus the '
                                f'targets in order ({len(base_cols)} -> {len(names)}, '
                                f'expected {len(expected)})')

        print(f'[{n}/{len(by_section)}] {sid}  {len(targets)} removed, '
              f'{len(names)} columns remain', file=sys.stderr)

    held = sum(1 for r in rows if not r['Remove column'])
    tgt = sum(1 for r in rows if r['Remove column'])
    print(f'\n{len(rows)} rows: {tgt} target(s), {held} held')
    print(f'{checks} live assertion(s) over {len(by_section)} sections')
    if problems:
        print(f'\n{len(problems)} PROBLEM(S):')
        for p in problems:
            print('  ' + p)
        raise SystemExit(1)
    print('\nAUDIT CLEAN - every targeted column is unbound, every source snapshot intact, '
          'every surviving column in its original order')


if __name__ == '__main__':
    main()
