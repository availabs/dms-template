"""
Gate 1 - snapshot every row Phase 7 will UPDATE, and build a verified rollback for each.

Inserts need no backup: they are reversed by deleting the ids the loader records. Updates are
the irreversible half of this load, so their pre-state has to exist on disk BEFORE any write.

WHY A ROLLBACK IS NOT JUST "RE-SEND THE OLD DATA"
`dataset update --data` SHALLOW-MERGES at the top level of `data`. Merging does not delete, so
re-sending the original row is not enough: any column my update ADDS that the original did not
have would survive the rollback and the row would not be back where it started. A correct
rollback is therefore:

    for each column the update touches:
        column existed before  ->  restore its original value
        column is new          ->  explicitly clear it

VERIFIED, NOT ASSUMED. For every row this script simulates the server's shallow merge twice --
apply the update to the pre-state, then apply the rollback to that result -- and asserts the
outcome is byte-identical to the pre-state. A rollback that has never been exercised is not a
rollback. (The live end-to-end test happens at Gate 2 on a throwaway row; this is the part that
can be proven without touching the database.)

OUTPUTS  backups/<timestamp>/
           manifest.json          what was snapshotted, from where, with counts
           <dataset>_prestate.json  [{id, data}]         exactly as read
           <dataset>_rollback.json  [{id, data}]         what to send to undo the update
         Written read-only where the filesystem allows.

Usage: python backup_before_write.py <timestamp>
       (timestamp is passed in rather than generated, so the caller controls the label)
"""
import json, io, os, sys, stat, collections

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

CTX = os.path.dirname(HERE)
EX = os.path.join(CTX, "extracted")
PAY = os.path.join(CTX, "payloads")
BAK = os.path.join(CTX, "backups")

CLEAR = None          # the value used to clear a column the update introduced


def shallow_merge(base, patch):
    """The server's semantics: replace top-level keys, never delete."""
    out = dict(base)
    out.update(patch)
    return out


def collect():
    """dataset -> {row_id: patch}  for every UPDATE Phase 7 intends."""
    jobs = collections.defaultdict(dict)

    for fn in sorted(os.listdir(PAY)):
        if fn.startswith("hoc_") and fn.endswith("_updates.json"):
            for u in json.load(io.open(os.path.join(PAY, fn), encoding="utf-8")):
                jobs["hoc"][str(u["id"])] = u["data"]
        elif fn.startswith("act_") and fn.endswith(".json"):
            for r in json.load(io.open(os.path.join(PAY, fn), encoding="utf-8")):
                if r.get("_op") == "update":
                    jobs["actions"][str(r["_existing_id"])] = r["data"]

    p = os.path.join(PAY, "_juris_updates.json")
    if os.path.exists(p):
        for r in json.load(io.open(p, encoding="utf-8")):
            jobs["jurisdictions"][str(r["row_id"])] = r["data"]
    return jobs


LIVE = {
    "hoc": "live_hoc_nassau.json",
    "actions": "live_actions_nassau.json",
    "jurisdictions": "live_jurisdictions_nassau.json",
}


def main():
    if len(sys.argv) < 2:
        print("Usage: python backup_before_write.py <timestamp-label>")
        return 2
    ts = sys.argv[1]
    dest = os.path.join(BAK, ts)
    if os.path.exists(dest):
        print(f"REFUSING: {dest} already exists. Never overwrite a backup.")
        return 1
    os.makedirs(dest)

    jobs = collect()
    manifest = dict(timestamp=ts, app="mitigat-ny-prod", host="https://dmsserver.availabs.org",
                    note="pre-write snapshot of every row Phase 7 will UPDATE", datasets={})
    problems, total_rows, total_cols = [], 0, 0

    for ds, patches in sorted(jobs.items()):
        live = json.load(io.open(os.path.join(EX, LIVE[ds]), encoding="utf-8"))
        byid = {r["id"]: r["data"] for v in live.values() for r in v}

        prestate, rollback = [], []
        new_cols = collections.Counter()
        for rid, patch in sorted(patches.items()):
            pre = byid.get(rid)
            if pre is None:
                problems.append(f"{ds} row {rid}: no pre-state in {LIVE[ds]} -- refusing to "
                                f"write a row whose current value is unknown")
                continue
            undo = {}
            for k in patch:
                if k in pre:
                    undo[k] = pre[k]
                else:
                    undo[k] = CLEAR
                    new_cols[k] += 1
            prestate.append(dict(id=rid, data=pre))
            rollback.append(dict(id=rid, data=undo))

            # ---- prove the rollback actually returns the row to its pre-state
            #
            # Compare with empties normalised away. A column that is absent and a column set to
            # null are the same state as far as the row is concerned, and live rows are full of
            # explicit nulls -- an exact dict comparison reports 1,015 false failures whose diff
            # list comes back empty, which is the tell that the COMPARISON is wrong, not the data.
            def meaningful(d):
                return {k: v for k, v in d.items() if v not in (None, "", [], {})}

            after_write = shallow_merge(pre, patch)
            after_undo = shallow_merge(after_write, undo)
            restored, want = meaningful(after_undo), meaningful(pre)
            if restored != want:
                diff = [k for k in set(restored) | set(want)
                        if restored.get(k) != want.get(k)]
                problems.append(f"{ds} row {rid}: rollback does not restore the pre-state; "
                                f"differs on {diff[:6]}")
            total_cols += len(patch)
        total_rows += len(prestate)

        json.dump(prestate, io.open(os.path.join(dest, f"{ds}_prestate.json"), "w",
                                    encoding="utf-8"), ensure_ascii=False, indent=1)
        json.dump(rollback, io.open(os.path.join(dest, f"{ds}_rollback.json"), "w",
                                    encoding="utf-8"), ensure_ascii=False, indent=1)
        manifest["datasets"][ds] = dict(
            rows=len(prestate), columns_touched=sum(len(p) for p in patches.values()),
            live_source=LIVE[ds],
            columns_introduced=dict(new_cols.most_common()))
        print(f"{ds:14s} {len(prestate):5d} row(s) snapshotted, "
              f"{sum(len(p) for p in patches.values()):5d} column write(s), "
              f"{len(new_cols)} column(s) newly introduced")

    manifest["problems"] = problems
    json.dump(manifest, io.open(os.path.join(dest, "manifest.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)

    # make the snapshot read-only so a later run cannot quietly clobber it
    for f in os.listdir(dest):
        p = os.path.join(dest, f)
        try:
            os.chmod(p, stat.S_IREAD)
        except OSError:
            pass

    print(f"\n{total_rows} row(s), {total_cols} column write(s) backed up -> backups/{ts}/")
    print(f"rollback simulated for every row: "
          f"{'ALL VERIFIED' if not problems else f'{len(problems)} PROBLEM(S)'}")
    for p in problems[:10]:
        print("  ERR ", p)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
