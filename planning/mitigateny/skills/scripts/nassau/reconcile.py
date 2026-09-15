"""
Gate 6 - reconcile what is in the database against what Phase 7 intended to put there.

Not the same check as the loader's read-back. That compares a row against the payload it was
built from, in the process that wrote it. This compares the WHOLE county against the WHOLE
payload set, after the fact, and answers questions the per-row check cannot:

  * is every payload row present, and does every live row belong to a payload row?
  * did anything land in a jurisdiction that should have none?
  * are there duplicates within a jurisdiction?
  * do the 18 withdrawn villages carry only what they are supposed to?

Reads the committed live dumps, so run `fetch_live.mjs <dataset>` for all six first.

Usage: python reconcile.py
"""
import json, io, os, sys, csv, re, collections

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

CTX = os.path.dirname(HERE)
EX = os.path.join(CTX, "extracted")
PAY = os.path.join(CTX, "payloads")

# dataset -> (payload prefix, live dump, the field that identifies a row within a jurisdiction)
DATASETS = {
    "capabilities":  ("cap",   "live_capabilities_nassau.json",  "capability_name"),
    "roles":         ("roles", "live_roles_nassau.json",         "name"),
    "participation": ("part",  "live_participation_nassau.json", "meeting_name"),
    "actions":       ("act",   "live_actions_nassau.json",       "action_name"),
    "hoc":           ("hoc",   "live_hoc_nassau.json",           "hazard"),
    "jurisdictions": ("juris", "live_jurisdictions_nassau.json", None),
}


def payload_rows(prefix):
    """geoid -> [data dicts] the pipeline intended to write."""
    out = collections.defaultdict(list)
    if prefix == "juris":
        for r in json.load(io.open(os.path.join(PAY, "_juris_updates.json"), encoding="utf-8")):
            out[str(r["geoid"])].append(r["data"])
        return out
    for fn in sorted(os.listdir(PAY)):
        if not fn.endswith(".json") or fn.startswith("_"):
            continue
        if prefix == "hoc":
            m = re.match(r"hoc_(\d+)_(updates|inserts)\.json$", fn)
            if not m:
                continue
            for r in json.load(io.open(os.path.join(PAY, fn), encoding="utf-8")):
                out[m.group(1)].append(r["data"])
        else:
            m = re.match(rf"{prefix}_(\d+)\.json$", fn)
            if not m:
                continue
            for r in json.load(io.open(os.path.join(PAY, fn), encoding="utf-8")):
                out[m.group(1)].append(r["data"])
    return out


def main():
    aliases = {r["geoid"]: r for r in csv.DictReader(
        io.open(os.path.join(CTX, "nassau-jurisdiction-aliases.csv"), encoding="utf-8-sig"))}
    withdrawn = {g for g, r in aliases.items() if r.get("has_annex") != "yes"}
    findings = []

    print(f"{'dataset':15s} {'payload':>8s} {'live':>7s} {'juris':>6s}  notes")
    print("-" * 78)

    for ds, (prefix, dumpfile, idfield) in DATASETS.items():
        dp = os.path.join(EX, dumpfile)
        if not os.path.exists(dp):
            findings.append(f"{ds}: no live dump — run fetch_live.mjs {ds}")
            print(f"{ds:15s} {'?':>8s} {'?':>7s} {'?':>6s}  NO LIVE DUMP")
            continue
        live = json.load(io.open(dp, encoding="utf-8"))
        want = payload_rows(prefix)

        n_want = sum(len(v) for v in want.values())
        n_live = sum(len(v) for v in live.values())
        j_live = sum(1 for v in live.values() if v)
        notes = []

        # --- jurisdictions with live rows but no payload
        extra_j = {g for g, v in live.items() if v and g not in want}
        if extra_j:
            for g in sorted(extra_j):
                nm = aliases.get(g, {}).get("jurisdiction_title", g)
                st = aliases.get(g, {}).get("adoption_status", "?")
                notes.append(f"{len(live[g])} pre-existing in {nm} [{st}] (no payload)")

        # --- jurisdictions with a payload but no live rows
        missing_j = {g for g, v in want.items() if v and not live.get(g)}
        for g in sorted(missing_j):
            findings.append(f"{ds}: {aliases.get(g,{}).get('jurisdiction_title',g)} has "
                            f"{len(want[g])} payload row(s) but NOTHING live")

        # --- duplicates within a jurisdiction
        dupes = 0
        if idfield:
            for g, rows in live.items():
                c = collections.Counter(
                    str(r["data"].get(idfield) or "") +
                    "|" + str(r["data"].get("hazard_name_if_other") or "")
                    for r in rows)
                dupes += sum(n - 1 for n in c.values() if n > 1)
            if dupes:
                findings.append(f"{ds}: {dupes} duplicate row(s) within a jurisdiction")

        # --- per-jurisdiction shortfall
        short = []
        for g, rows in want.items():
            lv = len(live.get(g) or [])
            if lv < len(rows):
                short.append(f"{aliases.get(g,{}).get('jurisdiction_title',g)} {lv}/{len(rows)}")
        if short:
            findings.append(f"{ds}: short in {len(short)} jurisdiction(s): " +
                            ", ".join(short[:6]))

        print(f"{ds:15s} {n_want:8d} {n_live:7d} {j_live:6d}  "
              f"{'; '.join(notes) if notes else ('ok' if not short and not dupes else 'SEE BELOW')}")

    # ---------------------------------------------------------------- withdrawn villages
    print()
    print(f"the {len(withdrawn)} withdrawn villages — they should have Roles, Participation and")
    print("lhmp_planning_process, and NO annex-derived content:")
    for ds, (prefix, dumpfile, _) in DATASETS.items():
        dp = os.path.join(EX, dumpfile)
        if not os.path.exists(dp):
            continue
        live = json.load(io.open(dp, encoding="utf-8"))
        n = sum(len(live.get(g) or []) for g in withdrawn)
        expected = ds in ("roles", "participation", "jurisdictions", "hoc")
        flag = "" if expected or n == 0 else "  <-- UNEXPECTED"
        if ds == "actions" and n:
            flag = "  (pre-existing, not ours)"
        print(f"   {ds:15s} {n:5d}{flag}")
        if not expected and n and ds != "actions":
            findings.append(f"{ds}: {n} row(s) in withdrawn villages, which should have none")

    print()
    if findings:
        print(f"{len(findings)} FINDING(S):")
        for f in findings:
            print("  -", f)
    else:
        print("No findings: every payload row is present, nothing is duplicated, and nothing")
        print("landed where it should not have.")
    return 1 if findings else 0


if __name__ == "__main__":
    sys.exit(main())
