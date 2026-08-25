"""
Phase 7c - assemble the Jurisdictions UPDATE payloads: row id + compiled lexical columns.

The last step before the write. Joins three things:

  payloads/juris_<geoid>_lexical.json      compiled lexical roots (compile_lexical.mjs)
  extracted/live_jurisdictions_nassau.json the row id to update, keyed by geoid
  nassau-jurisdiction-aliases.csv          the 70 in-scope jurisdictions

SCOPE IS 70, NOT 52. Six of the seven columns come from an annex and so only exist for the 52
that have one. `lhmp_planning_process` comes from the base plan's adoption-status table and
exists for all 70 -- and it is the ONLY field separating a jurisdiction that adopted the plan
from one that engaged and withdrew. Without it the 18 withdrawn villages read as participants.

WHY EVERY GEOID MUST RESOLVE TO EXACTLY ONE ROW. Nassau has 138 Jurisdictions rows: 70
municipalities, 67 CDPs (excluded -- not governments, nothing to transcribe into) and one
duplicate `Glen Cove` carrying census_type `cousub` at geoid 3605929113, the collision already
resolved in favour of 3629113. A geoid resolving to 0 or 2 rows means that resolution has
drifted, so it fails the run rather than picking one.

OUTPUTS  payloads/_juris_updates.json   [{geoid, row_id, jurisdiction, data:{...}}]

Usage: python build_juris_payloads.py
"""
import json, io, os, sys, csv, collections

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

CTX = os.path.dirname(HERE)
EX = os.path.join(CTX, "extracted")
PAY = os.path.join(CTX, "payloads")
COLUMNS = ["lhmp_municipality_profile", "growth_and_development_trends",
           "lhmp_risk_overview", "lhmp_problem_areas", "nfip",
           "lhmp_capacity_to_implement", "lhmp_planning_process"]


def main():
    aliases = {r["geoid"]: r for r in csv.DictReader(
        io.open(os.path.join(CTX, "nassau-jurisdiction-aliases.csv"), encoding="utf-8-sig"))}
    live = json.load(io.open(os.path.join(EX, "live_jurisdictions_nassau.json"),
                             encoding="utf-8"))

    errs, out = [], []
    fill = collections.Counter()
    for geoid, al in sorted(aliases.items()):
        rows = live.get(geoid) or []
        if len(rows) != 1:
            errs.append(f"{geoid} {al.get('jurisdiction_title','')}: resolved to "
                        f"{len(rows)} Jurisdictions row(s), expected exactly 1")
            continue
        lp = os.path.join(PAY, f"juris_{geoid}_lexical.json")
        if not os.path.exists(lp):
            errs.append(f"{geoid}: no compiled lexical file — run compile_lexical.mjs")
            continue
        data = json.load(io.open(lp, encoding="utf-8"))
        # Only send columns that actually have content. Sending an empty root would replace a
        # value someone else may have authored with a visually-blank lexical document.
        data = {k: v for k, v in data.items() if k in COLUMNS and v}
        if not data:
            errs.append(f"{geoid} {al.get('jurisdiction_title','')}: nothing to write")
            continue
        for k in data:
            fill[k] += 1
        out.append(dict(geoid=geoid, row_id=rows[0]["id"],
                        jurisdiction=al.get("jurisdiction_title", ""),
                        has_annex=al.get("has_annex"), data=data))

    json.dump(out, io.open(os.path.join(PAY, "_juris_updates.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)

    ncols = sum(fill.values())
    print(f"Jurisdictions: {len(out)} row update(s), {ncols} lexical column value(s)")
    for c in COLUMNS:
        print(f"     {fill[c]:3d}/{len(out)}  {c}")
    print(f"     {len(errs)} error(s)")
    for e in errs[:10]:
        print("  ERR ", e)
    return 1 if errs else 0


if __name__ == "__main__":
    sys.exit(main())
