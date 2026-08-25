"""
Phase 7a - build the Capabilities_Catalogue insert payloads for Nassau.

All inserts (source 1068273). Target ~876 rows across 52 jurisdictions.

WHICH SOURCE ROWS BECOME A CATALOGUE ROW
  answer = Yes                          -> row. The jurisdiction has the capability.
  answer = No  AND detail_overrides_no  -> row. All 50 'No' rows carry a description, and
                                           the detail-beats-checkbox rule (owner, 2026-08-21)
                                           says the detail wins. The contradiction is recorded
                                           in the description so a reviewer can see it.
  answer = ''  AND a description        -> row. Blank checkbox, real content.
  answer = ''  AND no description       -> NO row, logged as an omission. Nothing to record.

CAPABILITY TYPE
`primary_capability_type` is marked `derived` in the crosswalk with no algorithm given, and
the 16-value vocabulary does not align with Hagerty's four tables -- notably there is no
"staff capacity" or "funding" type, so Administrative/Fiscal capabilities have to be placed
by judgement. Rather than bury 70 judgements in keyword heuristics, they are written out in
`capability-types.csv` (50 rows, each with a confidence and a reason), the same way the
Action Type tiers were. Anything missing from that table is reported, never guessed.

Freeport's 20 section-4 rows are handled by name, since they are one-off prose sections
rather than the standard Hagerty catalogue. Section 4 calls them "a summary of
accomplishments" and every body describes something the Village DID, so all 20 are
capabilities -- see scripts/fix_freeport_section4.py for why the titles mislead.

OUTPUTS  payloads/cap_<geoid>.json      [{data, _table, _row}]  <- insert_rows.mjs shape
         payloads/_cap_summary.json     totals, omissions, unmapped names

Usage: python build_capabilities.py [geoid ...]
"""
import json, io, os, sys, csv, re, collections

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import mny_schema as S

CTX = os.path.dirname(HERE)
EX = os.path.join(CTX, "extracted")
OUT = os.path.join(CTX, "payloads")
COUNTY_GEOID = "36059"
FREEPORT_GEOID = "3627485"
PLAN_DATE = "2020-12-16"
X = S.CHECKBOX["capabilities"]

# The source table's own category -> the Capabilities category checkbox. Already assigned
# during extraction as `flag`; named here so the mapping is visible.
FLAG_COLUMN = {
    "plan_guidance": "plan_guidance",
    "tool": "tool",
    "funding_source": "funding_source",
    "program": "program",
}

# capability type -> its checkbox column, so the boolean agrees with the select.
TYPE_CHECKBOX = {
    "Planning": "planning",
    "Codes/Ordinance/Zoning/Policy/Law/Governance": "codes_ordinance_zoning_policy_law_governance",
    "Establishing Long-Term Programs": "establishing_long_term_programs",
    "Studies and/or Risk Assessment": "studies_and_or_risk_assessment",
    "Project Scoping": "project_scoping",
    "Community Infrastructure (Drainage, Underground Utilities)":
        "community_infrastructure_drainage_underground_utilities",
    "Acquisition, Elevation or Relocation": "acquisition_elevation_or_relocation",
    "Floodproofing, other": "floodproofing_other",
    "Power (Microgrids, Emergency Power for Critical Facilities)":
        "power_microgrids_emergency_power_for_critical_facilities",
    "Coastal Protection": "coastal_protection",
    "Wetlands/Floodplains": "wetlands_floodplains",
    "Other Nature-Based Solutions": "other_nature_based_solutions",
    "Education, Awareness, Outreach": "education_awareness_outreach",
    "Preparedness & Response": "preparedness_response",
    "Other Large Flood Control (Levees, Floodwalls, Safe Rooms)":
        "other_large_flood_control_levees_floodwalls_safe_rooms",
    "Dam Rehabilitation/Removal": "dam_rehabilitation_removal",
}

# Freeport's 20 section-4 accomplishments -> capability type. Assigned from the BODY text
# (not the heading), which is what settles the capability-vs-problem-statement question.
FREEPORT_TYPES = {
    "EMERGENCY WARNING SYSTEM": "Preparedness & Response",
    "ACCURATE FLOOD DATA": "Studies and/or Risk Assessment",
    "FLOODING ON ROADS": "Community Infrastructure (Drainage, Underground Utilities)",
    "FLOOD DAMAGE FROM TIDAL WATERS BACKING UP THROUGH STORM DRAINS.":
        "Community Infrastructure (Drainage, Underground Utilities)",
    "IMPACT OF FLOODING ON RESIDENTIAL AND COMMERCIAL PROPERTIES":
        "Studies and/or Risk Assessment",
    "OUTREACH PROGRAMS.": "Education, Awareness, Outreach",
    "BULKHEADS MAINTENANCE PROGRAM": "Coastal Protection",
    "THE PROTECTION OF UTILITIES": "Power (Microgrids, Emergency Power for Critical Facilities)",
    "EMERGENCY OPERATIONS CENTER": "Preparedness & Response",
    "REDUCE WIND DAMAGES": "Floodproofing, other",
    "COMMUNITY EMERGENCY RESPONSE TEAM (CERT) TRAINING PROGRAM": "Preparedness & Response",
    "MANAGEMENT POLICY": "Codes/Ordinance/Zoning/Policy/Law/Governance",
    "MOBILIZATION PLAN": "Preparedness & Response",
    "POLICIES FOR CIVIL UNREST AND TERRORISM": "Preparedness & Response",
    "FLOODPLAIN MANAGEMENT CODE": "Codes/Ordinance/Zoning/Policy/Law/Governance",
    "MUTUAL AID AGREEMENT": "Preparedness & Response",
    "EMERGENCY MANAGEMENT PLAN": "Planning",
    "PUBLIC SAFETY COMMITTEE": "Establishing Long-Term Programs",
    "ZONING REGULATIONS TO INCLUDE FLOODPLAIN MANAGEMENT":
        "Codes/Ordinance/Zoning/Policy/Law/Governance",
    "WATER REGULATIONS AND PREVENTIVE MEASURES":
        "Codes/Ordinance/Zoning/Policy/Law/Governance",
}
# Freeport's own rows are accomplishments, so they read as programs rather than as one of
# Hagerty's four table categories.
FREEPORT_FLAG = "program"


def load_types():
    p = os.path.join(CTX, "capability-types.csv")
    out = {}
    for r in csv.DictReader(io.open(p, encoding="utf-8-sig")):
        out[r["capability_name"].strip()] = r
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    TYPES = load_types()
    ann_dir = os.path.join(EX, "annexes")
    want = sys.argv[1:] or sorted(f[:-5] for f in os.listdir(ann_dir) if f.endswith(".json"))

    errs, omissions, unmapped = [], [], collections.Counter()
    per, total = [], 0
    for geoid in want:
        A = json.load(io.open(os.path.join(ann_dir, geoid + ".json"), encoding="utf-8"))
        juris = A["jurisdiction"]
        agency = "Nassau County" if geoid == COUNTY_GEOID else juris
        rows = []
        for i, c in enumerate(A["capabilities"]):
            name = (c["capability_name"] or "").strip()
            desc = (c.get("description") or "").strip()
            ans = (c.get("answer") or "").strip()
            override = bool(c.get("detail_overrides_no"))

            if ans == "No" and not override:
                omissions.append(f"{geoid} {juris}: {name!r} answered No with no detail")
                continue
            if ans == "" and not desc:
                omissions.append(f"{geoid} {juris}: {name!r} blank with no description")
                continue

            # ---- capability type
            if c["source_table"] == "Summary of Existing Capabilities":
                ptype, stype, flag = FREEPORT_TYPES.get(name), "", FREEPORT_FLAG
                if not ptype:
                    unmapped[name] += 1
                    continue
            else:
                t = TYPES.get(name)
                if not t:
                    unmapped[name] += 1
                    continue
                ptype = t["primary_capability_type"].strip()
                stype = t["secondary_capability_type"].strip()
                flag = c.get("flag") or ""

            note = []
            if ans == "No" and override:
                note.append("Source contradiction: the annex checkbox answers \"No\" for "
                            "this capability, but the annex also supplies detail describing "
                            "it. Recorded per the detail-beats-checkbox rule.")
            body = desc + (("  " + " ".join(note)) if note else "")

            d = {
                "capability_name": name,
                "description": body or None,
                "primary_capability_type": ptype,
                "secondary_capability_type": stype or None,
                "administering_agency": agency,
                "administering_agency_type_fed_state_local_non_profit": ["Local"],
                "date_added": PLAN_DATE,
                "county": "Nassau",
                "geoid_county": COUNTY_GEOID,
                "geoid_juris": geoid,          # scalar for this dataset
                "jurisdiction": juris,
            }
            # Type checkbox must agree with the select.
            for ty in (ptype, stype):
                col = TYPE_CHECKBOX.get(ty or "")
                if ty and not col:
                    errs.append(f"{geoid}: capability type {ty!r} has no checkbox column")
                if col:
                    d[col] = X
            # Category checkbox from the source table.
            col = FLAG_COLUMN.get(flag)
            if col:
                d[col] = X
            elif flag:
                errs.append(f"{geoid}: unknown source flag {flag!r}")
            # Title/Role carries the staff detail for the Administrative table.
            if c["source_table"] == "Administrative and Technical" and desc:
                d["title_role"] = desc[:250]

            d = {k: v for k, v in d.items() if v not in (None, "", [])}
            errs += S.validate("capabilities", d, f"{geoid}/{name[:34]}")
            rows.append({"data": d, "_table": c["source_table"], "_row": i})

        json.dump(rows, io.open(os.path.join(OUT, f"cap_{geoid}.json"), "w",
                                encoding="utf-8"), ensure_ascii=False, indent=1)
        total += len(rows)
        per.append(dict(geoid=geoid, jurisdiction=juris, rows=len(rows)))

    json.dump(dict(rows=total, jurisdictions=len(want), errors=errs,
                   omissions=omissions, unmapped=dict(unmapped), per_jurisdiction=per),
              io.open(os.path.join(OUT, "_cap_summary.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)

    print(f"Capabilities: {total} insert rows across {len(want)} jurisdictions")
    print(f"     {len(omissions)} source row(s) deliberately not loaded")
    print(f"     {len(errs)} error(s), {len(unmapped)} unmapped capability name(s)")
    for n, c in unmapped.most_common(12):
        print(f"  UNMAPPED x{c}  {n[:76]}")
    for e in errs[:10]:
        print("  ERR ", e)
    return 1 if (errs or unmapped) else 0


if __name__ == "__main__":
    sys.exit(main())
