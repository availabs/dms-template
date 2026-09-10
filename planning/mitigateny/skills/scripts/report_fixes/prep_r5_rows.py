"""
Step 0 for the R5 "Deprecated column bound but not rendered" fix class.

Freezes rows out of a QA report CSV (by Fix ID) into a run folder's `rows.csv`,
and RESOLVES the one thing the report does not state: which `element-data.columns`
entry to remove.

The report names the deprecated column by its LIVE SOURCE TITLE - the
`(Delete) ...` display_name the source steward set - because that marker is the
evidence the column is deprecated. The component does not store that title; it
stores a stale one from whenever the column was bound. So the join is:

    report "What is wrong" -> quoted live title
      -> externalSource.columns[].display_name == that title
        -> that entry's `name`
          -> the component's own columns[] entry with the same `name`

Both halves are asserted, and the run refuses a row where either fails, rather
than falling back to matching on the component's own (stale) display_name.

usage:
  python prep_r5_rows.py <report.csv> <run-dir> --fix-id QA2-534 [--fix-id ...]
"""
import argparse, collections, csv, json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
DMS = os.path.abspath(os.path.join(HERE, '../../../../../src/dms/packages/dms/cli/bin/dms.js'))

TITLE_RE = re.compile(r'live title is "(.+?)"')

# A component snapshots its source schema under `externalSource` (v2) or
# `sourceInfo` (v1) - migrateToV2.js:203-226 is the authority, and dataWrapper
# migrates either at mount, so both shapes are live and neither is broken.
# Selecting on one key alone is what hid half the pattern from the T6 scan; see
# `cataloguing-and-fixing-data-fetch-mode.md` §2b.
SNAPSHOT_KEYS = ('externalSource', 'sourceInfo')


def source_snapshot(edo):
    """(key, columns) for whichever source-snapshot shape this component uses."""
    found = [k for k in SNAPSHOT_KEYS
             if isinstance(edo.get(k), dict) and isinstance(edo[k].get('columns'), list)]
    if len(found) != 1:
        raise SystemExit(
            f'expected exactly one source snapshot with a columns list, found {found or "none"} '
            f'(element-data keys: {sorted(edo)})')
    return found[0], edo[found[0]]['columns']


def section_element_data(section_id):
    out = subprocess.run(['node', DMS, 'section', 'dump', str(section_id)],
                         capture_output=True, text=True, encoding='utf-8')
    if out.returncode != 0:
        raise SystemExit(f'dms section dump {section_id} failed: {out.stderr[-500:]}')
    s = out.stdout
    s = s[s.index('{"id"'):]
    row = json.loads(s)
    raw = row['data']['element']['element-data']
    if not isinstance(raw, str):
        raise SystemExit(f'{section_id}: element-data is {type(raw).__name__}, not a JSON string')
    return row, json.loads(raw)


def from_r5_report(path, run_dir, ready_only=True):
    """Step 0 driven by a built `build_r5_report.py` CSV instead of the QA report.

    Preferred for a batch. That report has already resolved each row to a live
    `Column name` and classified it, and it resolves columns this script cannot:
    where the QA report quotes a title the source does not carry, the R5 report
    recovers the column by sweeping the component and pairs it back to a
    `Likely Fix ID`. Driving from the QA report would hold every one of those.

    `Remove column` is filled ONLY for rows whose disposition is ready. Every
    other row is emitted with it empty, so the writer records the deliberate
    non-write as SKIPPED rather than the row vanishing from the run.
    """
    with open(path, encoding='utf-8-sig', newline='') as f:
        rows = list(csv.DictReader(f))
    READY = 'Ready - hidden & unfiltered'
    out = []
    for r in rows:
        ready = r.get('Disposition') == READY
        o = dict(r)
        # a sweep-recovered column has no Fix ID of its own; carry the inferred
        # one prefixed so the run log never implies it was confirmed
        o['Fix ID'] = r.get('Fix ID') or (f'~{r["Likely Fix ID"]}' if r.get('Likely Fix ID') else '')
        o['Remove column'] = r.get('Column name', '') if (ready or not ready_only) else ''
        out.append(o)

    os.makedirs(run_dir, exist_ok=True)
    fields = list(rows[0].keys())
    if 'Remove column' not in fields:
        fields.append('Remove column')
    with open(os.path.join(run_dir, 'rows.csv'), 'w', encoding='utf-8', newline='') as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction='ignore')
        w.writeheader()
        w.writerows(out)

    counts = collections.Counter(r.get('Disposition', '') for r in rows)
    targets = sum(1 for r in out if r['Remove column'])
    secs = len({r['Draft section ID'] for r in out if r['Remove column']})
    for d, n in counts.most_common():
        print(f'  {n:>3}  {d}')
    print(f'\n{len(out)} row(s) -> {run_dir}/rows.csv  '
          f'({targets} target(s) over {secs} section(s), {len(out) - targets} held)')
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('report')
    ap.add_argument('run_dir')
    ap.add_argument('--fix-id', action='append')
    ap.add_argument('--from-r5-report', action='store_true',
                    help='`report` is a build_r5_report.py CSV; take its ready rows as targets')
    ap.add_argument('--all-rows', action='store_true',
                    help='with --from-r5-report: target every row, not only the ready ones. '
                         'Only with a stated reason - the readiness classification is the guard')
    args = ap.parse_args()

    if args.from_r5_report:
        from_r5_report(args.report, args.run_dir, ready_only=not args.all_rows)
        return
    if not args.fix_id:
        raise SystemExit('need --fix-id, or --from-r5-report')

    with open(args.report, encoding='utf-8-sig', newline='') as f:
        all_rows = list(csv.DictReader(f))
    by_id = {r['Fix ID']: r for r in all_rows}

    rows, evidence = [], []
    cache = {}
    for fid in args.fix_id:
        r = by_id.get(fid)
        if r is None:
            raise SystemExit(f'{fid}: not in {args.report}')
        if r['Class'] != 'R5':
            raise SystemExit(f'{fid}: Class is {r["Class"]!r}, not R5 - this prep is R5-only')

        m = TITLE_RE.search(r['What is wrong'])
        if not m:
            raise SystemExit(f'{fid}: could not read a live title out of "What is wrong"')
        live_title = m.group(1)

        sid = r['Draft section ID']
        if sid not in cache:
            cache[sid] = section_element_data(sid)
        row, edo = cache[sid]

        snap_key, snap_cols = source_snapshot(edo)
        src = [c for c in snap_cols if c.get('display_name') == live_title]
        if len(src) != 1:
            # The report's quoted title does not name exactly one live source
            # column. That is a defect in the REPORT, not something to work
            # around by relaxing the match - so the row is emitted unresolved
            # (empty value column -> the writer SKIPs it) and carried back to
            # the report owner. Aborting the batch instead would hide every
            # other row's verdict behind this one.
            out = dict(r)
            out['Remove column'] = ''
            out['Live column title'] = live_title
            rows.append(out)
            evidence.append({
                'fixId': fid, 'sectionId': sid, 'liveTitle': live_title,
                'columnName': None, 'boundIndex': None, 'storedTitle': None,
                'titleIsStale': None, 'status': 'UNRESOLVED - report title',
                'boundColumnCount': len(edo.get('columns', [])),
                'sourceSnapshotKey': snap_key, 'sourceColumnCount': len(snap_cols),
                'detail': f'{len(src)} columns in {snap_key}.columns titled {live_title!r} - expected exactly 1',
                'sectionUpdatedAt': row.get('updated_at'),
            })
            continue
        col_name = src[0]['name']

        own = [(i, c) for i, c in enumerate(edo.get('columns', [])) if c.get('name') == col_name]
        if len(own) > 1:
            raise SystemExit(f'{fid}: {len(own)} bound columns named {col_name!r} - ambiguous, refusing')

        out = dict(r)
        out['Live column title'] = live_title
        ev = {
            'fixId': fid, 'sectionId': sid,
            'liveTitle': live_title, 'columnName': col_name,
            'boundColumnCount': len(edo.get('columns', [])),
            'sourceSnapshotKey': snap_key,
            'sourceColumnCount': len(snap_cols),
            'sectionUpdatedAt': row.get('updated_at'),
        }

        if not own:
            # The column is already unbound - an earlier run did it, or an author
            # did. Not an error, and not a reason to abort the batch: emit the row
            # with an EMPTY value column so the writer reports it as SKIPPED and
            # the deliberate non-write stays on the record. Same convention the
            # fix-loop skill uses for a held row.
            out['Remove column'] = ''
            ev.update({'status': 'already unbound', 'boundIndex': None, 'storedTitle': None,
                       'titleIsStale': None})
        else:
            idx, bound = own[0]
            out['Remove column'] = col_name
            ev.update({'status': 'to remove', 'boundIndex': idx, 'boundEntry': bound,
                       'storedTitle': bound.get('display_name'),
                       'titleIsStale': bound.get('display_name') != live_title})

        rows.append(out)
        evidence.append(ev)

    ids = [r['Draft section ID'] for r in rows]
    if len(ids) != len(set(ids)):
        print('NOTE: rows share a section id - one row per (id, column) is fine here, '
              'but the writer must apply them in one pass per id.', file=sys.stderr)

    os.makedirs(args.run_dir, exist_ok=True)
    fields = list(all_rows[0].keys()) + ['Remove column', 'Live column title']
    with open(os.path.join(args.run_dir, 'rows.csv'), 'w', encoding='utf-8', newline='') as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)
    with open(os.path.join(args.run_dir, 'resolution.json'), 'w', encoding='utf-8') as f:
        json.dump({'report': args.report, 'evidence': evidence}, f, indent=1)

    for e in evidence:
        if e['status'].startswith('UNRESOLVED'):
            where = e['detail']
        elif e['boundIndex'] is None:
            where = f"NOT BOUND (of {e['boundColumnCount']} columns) - already unbound, will be SKIPPED"
        else:
            where = f"bound index {e['boundIndex']} of {e['boundColumnCount']}"
        title = ('' if e['storedTitle'] is None else
                 f"  stored title {e['storedTitle']!r} vs live {e['liveTitle']!r} "
                 f"({'STALE' if e['titleIsStale'] else 'same'})")
        print(f"{e['fixId']}  {e['sectionId']}  {e['columnName'] or '(unresolved)'}  {where}  "
              f"[{e['sourceSnapshotKey']}, {e['sourceColumnCount']} source cols]{title}")

    counts = collections.Counter(e['status'] for e in evidence)
    print(f"\n{len(rows)} row(s) -> {args.run_dir}/rows.csv")
    for k, n in counts.most_common():
        print(f'  {n:>3}  {k}')
    if counts.get('UNRESOLVED - report title'):
        print('\n  Unresolved rows carry an empty "Remove column" and will be SKIPPED by the writer.\n'
              '  They are report defects - carry them back to the report owner rather than relaxing the match.')


if __name__ == '__main__':
    main()
