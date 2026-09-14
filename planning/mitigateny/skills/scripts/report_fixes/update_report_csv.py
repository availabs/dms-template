"""
Write a run's outcome back into a report CSV, under the same contract the site
writes are held to: prove that ONLY the intended cells moved.

`update_workbook.py` (in the 2026-08-28 nonhazard prep folder) does this for an
.xlsx keyed on `(Fix ID, Pattern ID)`. This is the CSV equivalent for reports
that ship as a CSV - the QA2 draft report has no workbook.

It backs the file up, applies `--set "<Column>=<value>"` to the rows named by
`--fix-id`, re-reads the written file, and REFUSES (restoring the backup) if any
cell outside the targeted set differs, or if the row count or the header moved.

usage:
  python update_report_csv.py <report.csv> --fix-id QA2-534 \
      --set "Status=Fixed" --set "Date fixed=2026-09-02" --set "Notes=..."
"""
import argparse, csv, os, shutil, sys
from datetime import datetime


def read(path):
    with open(path, encoding='utf-8-sig', newline='') as f:
        r = csv.DictReader(f)
        return r.fieldnames, list(r)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('report')
    ap.add_argument('--fix-id', action='append', required=True)
    ap.add_argument('--set', action='append', required=True, dest='sets')
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()

    pairs = []
    for s in args.sets:
        if '=' not in s:
            raise SystemExit(f'--set needs "<Column>=<value>", got {s!r}')
        k, v = s.split('=', 1)
        pairs.append((k, v))

    fields, rows = read(args.report)
    for k, _ in pairs:
        if k not in fields:
            raise SystemExit(f'no column {k!r} in {args.report}')

    targets = {f: None for f in args.fix_id}
    for i, r in enumerate(rows):
        if r['Fix ID'] in targets:
            if targets[r['Fix ID']] is not None:
                raise SystemExit(f'{r["Fix ID"]}: appears more than once - refusing')
            targets[r['Fix ID']] = i
    missing = [f for f, i in targets.items() if i is None]
    if missing:
        raise SystemExit(f'not in the report: {", ".join(missing)}')

    changes = []
    for fid, i in targets.items():
        for k, v in pairs:
            if rows[i][k] != v:
                changes.append((fid, i, k, rows[i][k], v))

    for fid, _, k, old, new in changes:
        print(f'{fid}  {k}: {old!r} -> {new!r}')
    if not changes:
        print('nothing to change')
        return
    if args.dry_run:
        print(f'\ndry run - {len(changes)} cell(s) would change')
        return

    # Check writability BEFORE taking a backup. Excel holds an exclusive write
    # lock on an open .csv (os.access still reports writable), and a backup left
    # behind by a write that never happened is a false audit trail.
    try:
        with open(args.report, 'r+b'):
            pass
    except PermissionError as e:
        raise SystemExit(
            f'cannot open {args.report} for writing: {e}\n'
            'Another process holds an exclusive lock - almost always Excel with the .csv open. '
            'Close it and re-run; nothing has been changed and no backup was taken.')

    backup = f'{os.path.splitext(args.report)[0]}.BACKUP-{datetime.now():%Y%m%d-%H%M%S}.csv'
    shutil.copy2(args.report, backup)

    for _, i, k, _, new in changes:
        rows[i][k] = new
    try:
        with open(args.report, 'w', encoding='utf-8-sig', newline='') as f:
            w = csv.DictWriter(f, fieldnames=fields)
            w.writeheader()
            w.writerows(rows)
    except Exception:
        shutil.copy2(backup, args.report)
        os.remove(backup)
        raise

    # prove only the targeted cells moved
    f2, rows2 = read(args.report)
    _, rows0 = read(backup)
    problems = []
    if f2 != fields:
        problems.append(f'header changed: {fields} -> {f2}')
    if len(rows2) != len(rows0):
        problems.append(f'row count changed: {len(rows0)} -> {len(rows2)}')
    intended = {(i, k) for _, i, k, _, _ in changes}
    if not problems:
        for i, (a, b) in enumerate(zip(rows0, rows2)):
            for k in fields:
                if a[k] != b[k] and (i, k) not in intended:
                    problems.append(f'row {i} ({a["Fix ID"]}) column {k!r}: {a[k]!r} -> {b[k]!r}')
        for _, i, k, _, new in changes:
            if rows2[i][k] != new:
                problems.append(f'row {i} column {k!r} did not take: {rows2[i][k]!r}')

    if problems:
        shutil.copy2(backup, args.report)
        print('\nREFUSED - restored from backup:', file=sys.stderr)
        for p in problems[:20]:
            print('  ' + p, file=sys.stderr)
        raise SystemExit(2)

    print(f'\n{len(changes)} cell(s) written; every other cell of all {len(rows2)} rows '
          f'and the header re-read identical. backup: {backup}')


if __name__ == '__main__':
    main()
