"""
Compare a freshly-fetched live dump against a preserved earlier one, row by row.

Run before writing when the payloads and the pre-write backup were computed against a snapshot
that has since aged. Two things go stale together and they matter for different reasons:

  * the MATCH decisions -- which payload rows become UPDATEs and which existing id they claim
  * the BACKUP -- what a rollback would restore. This is the more serious half: a rollback
    built from a stale snapshot restores the row to where it was two weeks ago, silently
    reverting whatever someone else did in between.

Reports added / removed / changed rows, and for changed rows the columns that differ.

Usage: python diff_live_snapshots.py [dataset ...]     (default: all found)
"""
import json, io, os, sys, collections

HERE = os.path.dirname(os.path.abspath(__file__))
CTX = os.path.dirname(HERE)
EX = os.path.join(CTX, "extracted")
OLD = os.path.join(EX, "_snapshot_20260825")

DATASETS = ["actions", "capabilities", "roles", "participation", "hoc", "jurisdictions"]


def load(path):
    """{row_id: data} from a {geoid: [{id, data}]} dump."""
    if not os.path.exists(path):
        return None
    d = json.load(io.open(path, encoding="utf-8"))
    out = {}
    for rows in d.values():
        for r in rows:
            out[str(r["id"])] = r["data"]
    return out


def norm(v):
    if v in (None, "", [], {}):
        return ""
    return json.dumps(v, sort_keys=True, ensure_ascii=False) if isinstance(v, (list, dict)) else str(v)


def main():
    want = sys.argv[1:] or DATASETS
    clean = True
    for ds in want:
        fn = f"live_{ds}_nassau.json"
        new, old = load(os.path.join(EX, fn)), load(os.path.join(OLD, fn))
        if new is None or old is None:
            print(f"{ds:14s} SKIP (missing {'new' if new is None else 'old'} dump)")
            continue

        added = sorted(set(new) - set(old))
        removed = sorted(set(old) - set(new))
        changed = collections.defaultdict(list)
        for rid in set(new) & set(old):
            for k in set(new[rid]) | set(old[rid]):
                if norm(new[rid].get(k)) != norm(old[rid].get(k)):
                    changed[rid].append(k)

        status = "unchanged" if not (added or removed or changed) else "CHANGED"
        if status == "CHANGED":
            clean = False
        print(f"{ds:14s} {len(old):5d} -> {len(new):5d} rows   "
              f"+{len(added)} -{len(removed)} ~{len(changed)}   {status}")
        for rid in added[:5]:
            print(f"      ADDED   {rid}")
        for rid in removed[:5]:
            print(f"      REMOVED {rid}")
        for rid, cols in list(changed.items())[:8]:
            print(f"      CHANGED {rid}: {', '.join(sorted(cols)[:6])}")
            for k in sorted(cols)[:3]:
                print(f"          {k}\n            was: {norm(old[rid].get(k))[:90]}"
                      f"\n            now: {norm(new[rid].get(k))[:90]}")

    print("\n" + ("No live change since the snapshot — the payloads, match decisions and "
                  "pre-write backup are all still valid."
                  if clean else
                  "LIVE DATA HAS MOVED. Re-run the matcher and re-take the backup before "
                  "writing; a rollback built from the old snapshot would revert whatever "
                  "changed in between."))
    return 0 if clean else 1


if __name__ == "__main__":
    sys.exit(main())
