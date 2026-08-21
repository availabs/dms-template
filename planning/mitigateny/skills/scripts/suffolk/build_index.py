"""
Build context/juris_index.json: geoid -> authoritative identity from the JURISDICTIONS
dataset, so no builder ever has to derive a county geoid by slicing a string.

Why this file exists: `geoid[:5]` is NOT the county geoid. NY village geoids are 7 digits
(36 + a 5-digit place code), so Amityville 3602044 slices to '36020', not '36103'. Only
10-digit cousub geoids and the 5-digit county geoid slice correctly. Slicing silently
mis-filed 25 of Suffolk's 38 jurisdictions.
"""
import json, subprocess, os, glob
CTX = r"C:/Code/dms-template/references/mny-transcribe/suffolk/context"
CLI = r"C:/Code/dms-template/src/dms/packages/dms/cli/bin/dms.js"
env = dict(os.environ)
o = subprocess.run(["node", CLI, "dataset", "query", "1346449", "--view", "1346450",
                    "--filter", "county_geoid=36103", "--limit", "2000", "--format", "json"],
                   capture_output=True, text=True, encoding="utf-8", env=env).stdout
live = json.loads(o[o.index("{"):])
byg = {}
for r in live["items"]:
    d = r["data"]
    byg[str(d["geoid"])] = {
        "row_id": r["id"], "geoid": str(d["geoid"]),
        "county_geoid": str(d.get("county_geoid")), "county": d.get("county"),
        "municipality_name": d.get("municipality_name"),
        "municipality_type": d.get("municipality_type"),
        "census_type": d.get("census_type"),
        "jurisdictions_title": "%s (%s)" % (d.get("municipality_name"), d.get("municipality_type")),
    }
print("Jurisdictions rows for county 36103: %d" % len(byg))

idx, missing = {}, []
for f in sorted(glob.glob(os.path.join(CTX, "extracted", "annexes", "*.json"))):
    if os.path.basename(f).startswith("_"): continue
    J = json.load(open(f, encoding="utf8"))["jurisdiction"]
    g = str(J["geoid"])
    if g in byg:
        idx[g] = byg[g]
    else:
        missing.append((g, J["jurisdictions_title"]))
        idx[g] = {"row_id": None, "geoid": g, "county_geoid": "36103", "county": "Suffolk",
                  "municipality_name": None, "municipality_type": J.get("municipality_type"),
                  "census_type": J.get("census_type"),
                  "jurisdictions_title": J["jurisdictions_title"], "_no_jurisdictions_row": True}
json.dump(idx, open(os.path.join(CTX, "juris_index.json"), "w", encoding="utf8"), indent=1, ensure_ascii=False)
print("indexed %d annex geoids -> juris_index.json" % len(idx))
bad = [(g, v["county_geoid"]) for g, v in idx.items() if v["county_geoid"] != "36103"]
print("county_geoid != 36103: %s" % (bad or "none"))
print("annex geoids with NO Jurisdictions row: %s" % (missing or "none"))
