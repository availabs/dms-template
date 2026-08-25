"""
Phase 7a - build the Hazards-of-Concern payloads for Nassau.

Almost entirely an UPDATE IN PLACE. All 70 Nassau jurisdictions already carry 17 seeded
rows each (70 x 17 = 1,190 rows, every one `hazard_of_concern = "Not Reported"`), so
creating rows for named hazards would produce a duplicate parallel grid. The only inserts
are Freeport's 6 `Other` rows.

Scope: the 52 jurisdictions with an annex. The 18 withdrawn villages are left untouched
(18 x 17 = 306 rows), which is why the run reports 884 updates, not 1,190.

INPUTS
  extracted/annexes/<geoid>.json    hazard_impacts (11 Hagerty hazards, boolean grid)
  extracted/baseplan.json           hazards_not_profiled, hazard_profile_boxes (county)
  extracted/hoc_nassau_view*.json   the 1,190 seeded rows -> the ids to update
  freeport-hazard-map.csv           Freeport's decided mapping (independent plan)

OUTPUTS  payloads/hoc_<geoid>_updates.json   [{id, hazard, data}]
         payloads/hoc_<geoid>_inserts.json   [{data}]     (Freeport only)
         payloads/_hoc_summary.json          run totals + every flagged judgement call
(The human review surface is built separately in 7b, from these payloads.)

Usage: python build_hoc.py [geoid ...]      (default: all in-scope)
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

# ---------------------------------------------------------------- taxonomy (owner-decided)
# Hagerty's 11 hazards -> 14 of MNY's 17 named types. Labels MUST match the STORED
# vocabulary exactly, including 'Ice storm' (lowercase s) and 'Tsunami/Seiche'.
MAPPING = {
    "Coastal Hazards":               (["Coastal Hazards"],                "1:1"),
    "Drought":                       (["Drought"],                        "1:1"),
    "Flooding":                      (["Flooding"],                       "1:1"),
    "Hail":                          (["Hail"],                           "1:1"),
    "Lightning":                     (["Lightning"],                      "1:1"),
    "Tornados":                      (["Tornado"],                        "1:1"),
    "Wind":                          (["Wind"],                           "1:1"),
    "Hurricane and Tropical Storms": (["Hurricane"],                      "1:1"),
    "Extreme Temperatures":          (["Extreme Cold", "Extreme Heat"],   "split"),
    "Ground Failure":                (["Earthquake", "Landslide"],        "split"),
    "Severe Winter Weather":         (["Ice storm", "Snowstorm"],         "split"),
}
# Named types Nassau never profiles. Base-plan Table 11 is the authority.
UNPROFILED = ["Avalanche", "Tsunami/Seiche", "Wildfire"]

# The verbatim sentence immediately ABOVE base-plan Table 11 -- the shared rationale for
# all three. Table 10 is NOT the source (that is 'Reason for Identification', for hazards
# that WERE profiled); miscited earlier in this project and corrected 2026-08-21.
EXCLUSION_SENTENCE = (
    "The following natural hazards are not included in this Plan based on State and "
    "Federal guidance and history of hazard occurrences that indicate these hazards are "
    "unlikely to occur or cause damage:"
)

# ------------------------------------------------- impact categories -> the 4 HOC booleans
CATEGORY_TO_FLAG = {
    "Housing":                        "buildings_vulnerability",
    "Infrastructure":                 "infrastructure_vulnerability",
    "Community":                      "population_vulnerability",
    "Health and Social Services":     "population_vulnerability",
    "Economy":                        "population_vulnerability",   # no MNY equivalent
    "Natural and Cultural Resources": "natural_env_vulnerability",
}
# Spelling variant found in 24 rows -- the source drops the 'and'. Without this alias
# those rows silently lose their natural-environment flag.
CATEGORY_ALIASES = {"Natural Cultural Resources": "Natural and Cultural Resources"}

# Categories that are not affirmative impacts.
NOT_AN_IMPACT = {"No Impact", "Information not provided"}

FLAGS = ["buildings_vulnerability", "infrastructure_vulnerability",
         "population_vulnerability", "natural_env_vulnerability"]
YES, NO = S.CHECKBOX["hoc"], "No"

# County-level box captions -> MNY labels (base plan, 12 boxes).
#
# The county vocabulary is NOT the annex vocabulary -- it has its own spellings
# ("Flooding/Inland", plural "Hurricanes"), and it splits Ground Failure into two boxes
# rather than combining them the way the annexes do. Mapped from the captions as they
# actually appear, verified against all 12.
#
# "Severe Storm" appears THREE times (table indices 30, 36, 44) and the three boxes are
# BYTE-IDENTICAL on every field. The base plan repeats one shared Severe Storm profile
# inside its Hail, Lightning and Wind sections, so all three MNY hazards legitimately
# receive that same profile and the assignment is order-independent -- there is no
# attribution to guess at.
COUNTY_BOX_MAP = {
    "Coastal Flooding/Wave Action":   ["Coastal Hazards"],
    "Drought":                        ["Drought"],
    "Extreme Temperatures":           ["Extreme Cold", "Extreme Heat"],
    "Flooding/Inland":                ["Flooding"],
    "Earthquake":                     ["Earthquake"],
    "Landslide":                      ["Landslide"],
    "Hurricanes and Tropical Storms": ["Hurricane"],
    "Severe Winter Weather":          ["Ice storm", "Snowstorm"],
    "Tornados":                       ["Tornado"],
    "Severe Storm":                   ["Hail", "Lightning", "Wind"],
}

notes = []          # every judgement call this run made, for the summary


def load_seeded():
    """(geoid, hazard label) -> row id, from the committed view dump."""
    rows = json.load(io.open(os.path.join(EX, "hoc_nassau_view1473471.json"), encoding="utf-8"))
    idx, byg = {}, collections.defaultdict(set)
    for r in rows:
        d = r["data"]
        gj = d.get("geoid_juris") or []
        g = str(gj[0]) if isinstance(gj, list) and gj else str(gj)
        idx[(g, d["hazard"])] = r["id"]
        byg[g].add(d["hazard"])
    return idx, byg


def norm_cat(c):
    return CATEGORY_ALIASES.get(c.strip(), c.strip())


def vuln_sentence(juris, hazard, cats, kind, source_hazard):
    """
    A self-declaring derived sentence. The Hagerty annex carries NO narrative vulnerability
    prose -- Table 2 is a boolean grid -- so anything in this field is derived by definition
    and must say so, or a reader will mistake it for authored text.
    """
    if not cats:
        return (f"No impact categories were recorded for {source_hazard} in the "
                f"{juris} annex. (Derived from the annex Local Hazard Impact table; the "
                f"Hagerty annex format carries no narrative vulnerability text.)")
    listed = ", ".join(cats[:-1]) + (" and " + cats[-1] if len(cats) > 1 else cats[0])
    split = ("" if kind != "split" else
             f" This value is inherited from the combined \"{source_hazard}\" profile, "
             f"which the MNY taxonomy splits into separate hazards.")
    return (f"The {juris} annex identifies impacts to {listed} for {source_hazard}. "
            f"(Derived from the annex Local Hazard Impact table; the Hagerty annex format "
            f"carries no narrative vulnerability text.){split}")


def build_named(juris, geoid, impacts):
    """hazard label -> the data dict to write, for one annex jurisdiction."""
    out = {}
    for h in impacts:
        src = h["hazard"]
        if src not in MAPPING:
            notes.append(f"{geoid} {juris}: unmapped source hazard {src!r} -- SKIPPED")
            continue
        targets, kind = MAPPING[src]
        raw = [norm_cat(c) for c in h["impact_categories"]]
        cats = [c for c in raw if c not in NOT_AN_IMPACT]
        unprovided = "Information not provided" in raw
        contradiction = bool(cats) and "No Impact" in raw

        if contradiction:
            notes.append(f"{geoid} {juris}: {src} ticks both 'No Impact' and {cats} -- "
                         f"resolved to Yes (an affirmative category is the more detailed "
                         f"answer); contradiction recorded in other_comments")

        concern = "Yes" if cats else "No"
        flags = {f: NO for f in FLAGS}
        for c in cats:
            f = CATEGORY_TO_FLAG.get(c)
            if f:
                flags[f] = YES
            else:
                notes.append(f"{geoid} {juris}: {src} category {c!r} has no MNY boolean")

        # Losses and contradictions go here so nothing is silently dropped.
        comments = []
        if "Economy" in cats:
            comments.append("Source impact category \"Economy\" has no MNY equivalent; "
                            "folded into People and Communities.")
        if "Natural and Cultural Resources" in cats:
            comments.append("Source impact category \"Natural and Cultural Resources\"; "
                            "the Cultural half has no MNY equivalent.")
        if contradiction:
            comments.append("Source contradiction: the annex ticks both \"No Impact\" and "
                            + ", ".join(f'"{c}"' for c in cats) + " for this hazard. "
                            "Resolved in favour of the affirmative categories.")
        if unprovided:
            comments.append("The annex records \"Information not provided\" for this "
                            "hazard. Set to No under the standing silence-is-No rule "
                            "rather than Not Reported; the non-answer is recorded here.")
        if kind == "split":
            comments.append(f"Derived by splitting the combined source hazard "
                            f"\"{src}\" across {len(targets)} MNY hazards.")

        for t in targets:
            out[t] = dict(
                hazard_of_concern=concern,
                general_vulnerability=vuln_sentence(juris, t, cats, kind, src),
                other_comments=" ".join(comments) or None,
                reason_for_exclusion=None,
                **flags)

    # The three Nassau never profiles.
    for t in UNPROFILED:
        out[t] = dict(
            hazard_of_concern="No",
            general_vulnerability=None,
            other_comments=None,
            reason_for_exclusion=(
                f"Not profiled in the Nassau County Hazard Mitigation Plan. Base-plan "
                f"Table 11 lists this hazard among those excluded county-wide, with the "
                f"stated rationale: “{EXCLUSION_SENTENCE}”"),
            **{f: NO for f in FLAGS})
    return out


def build_county():
    b = json.load(io.open(os.path.join(EX, "baseplan.json"), encoding="utf-8"))
    out = {}
    for box in b["hazard_profile_boxes"]:
        src = box["hazard"]
        targets = COUNTY_BOX_MAP.get(src)
        if not targets:
            notes.append(f"county: unmapped base-plan box {src!r} -- SKIPPED")
            continue
        detail = "; ".join(f"{k}: {v}" for k, v in box.items()
                           if k not in ("table_index", "hazard") and v)
        for t in targets:
            out[t] = dict(
                hazard_of_concern="Yes",
                general_vulnerability=(
                    f"Nassau County profiles {src} at the county level. Base-plan hazard "
                    f"profile: {detail}. (Derived from the base-plan hazard profile box; "
                    f"the county has no annex Local Hazard Impact table.)"),
                other_comments=(f"Derived by splitting the combined base-plan hazard "
                                f"“{src}”." if len(targets) > 1 else None),
                reason_for_exclusion=None,
                # The base-plan boxes rank and describe the hazard but do not assert which
                # asset classes are vulnerable, so the four booleans have no source here.
                **{f: NO for f in FLAGS})
    for t in UNPROFILED:
        out[t] = dict(
            hazard_of_concern="No", general_vulnerability=None, other_comments=None,
            reason_for_exclusion=(
                f"Not profiled in the Nassau County Hazard Mitigation Plan. Base-plan "
                f"Table 11 lists this hazard among those excluded county-wide, with the "
                f"stated rationale: “{EXCLUSION_SENTENCE}”"),
            **{f: NO for f in FLAGS})
    return out


def build_freeport():
    """Freeport is an independent plan, mapped row-by-row in freeport-hazard-map.csv."""
    rows = list(csv.DictReader(io.open(os.path.join(CTX, "freeport-hazard-map.csv"),
                                      encoding="utf-8-sig")))
    named, inserts = {}, []
    for r in rows:
        mny, kind, src = r["mny_hazard"].strip(), r["kind"].strip(), r["source_hazard"].strip()
        if kind == "named":
            named.setdefault(mny, dict(
                hazard_of_concern="Yes",
                general_vulnerability=(
                    f"The Village of Freeport's independent Hazard Mitigation Plan profiles "
                    f"this hazard as “{src}” (section {r['source_section']}). "
                    f"(Derived from the plan's hazard profile sections.)"),
                other_comments=(r["note"].strip() or None),
                reason_for_exclusion=None,
                **{f: NO for f in FLAGS}))
        elif kind == "not-profiled":
            named[mny] = dict(
                hazard_of_concern="No", general_vulnerability=None,
                other_comments=None,
                reason_for_exclusion=(
                    "Not profiled in the Village of Freeport's independent Hazard "
                    "Mitigation Plan. Set to No under the standing silence-is-No rule."),
                **{f: NO for f in FLAGS})
        elif kind == "other":
            inserts.append(dict(
                hazard="Other",
                hazard_name_if_other=r["hazard_name_if_other"].strip(),
                hazard_of_concern="Yes",
                general_vulnerability=(
                    f"The Village of Freeport's independent Hazard Mitigation Plan profiles "
                    f"“{src}” (section {r['source_section']}), which has no "
                    f"matching MNY hazard type. (Derived from the plan's hazard profile "
                    f"sections.)"),
                other_comments=(r["note"].strip() or None),
                **{f: NO for f in FLAGS}))
    return named, inserts


def main():
    os.makedirs(OUT, exist_ok=True)
    seeded, byg = load_seeded()
    aliases = {r["geoid"]: r for r in csv.DictReader(
        io.open(os.path.join(CTX, "nassau-jurisdiction-aliases.csv"), encoding="utf-8-sig"))}
    ann_dir = os.path.join(EX, "annexes")
    have = {f[:-5] for f in os.listdir(ann_dir) if f.endswith(".json")}
    want = sys.argv[1:] or sorted(have)

    tot_u = tot_i = 0
    errs, summary = [], []
    for geoid in want:
        A = json.load(io.open(os.path.join(ann_dir, geoid + ".json"), encoding="utf-8"))
        juris = A["jurisdiction"]
        if geoid == COUNTY_GEOID:
            named, inserts = build_county(), []
        elif geoid == FREEPORT_GEOID:
            named, inserts = build_freeport()
        else:
            named, inserts = build_named(juris, geoid, A["hazard_impacts"]), []

        # Every one of the 17 seeded rows must be accounted for -- no silent partial fills.
        expect = byg.get(geoid, set())
        missing = sorted(expect - set(named))
        extra = sorted(set(named) - expect)
        if missing:
            errs.append(f"{geoid} {juris}: {len(missing)} seeded row(s) unaddressed: {missing}")
        if extra:
            errs.append(f"{geoid} {juris}: built rows with no seeded target: {extra}")

        updates = []
        for hz, data in sorted(named.items()):
            rid = seeded.get((geoid, hz))
            if not rid:
                errs.append(f"{geoid} {juris}: no seeded row for {hz!r}")
                continue
            data = {k: v for k, v in data.items() if v is not None}
            errs += S.validate("hoc", data, f"{geoid}/{hz}")
            updates.append(dict(id=rid, hazard=hz, data=data))

        ins = []
        for d in inserts:
            d = {k: v for k, v in d.items() if v is not None}
            d.update(county="Nassau", geoid_county=36059,
                     geoid_juris=[geoid], jurisdiction=juris)
            errs += S.validate("hoc", d, f"{geoid}/insert")
            ins.append(dict(data=d))

        json.dump(updates, io.open(os.path.join(OUT, f"hoc_{geoid}_updates.json"), "w",
                                   encoding="utf-8"), ensure_ascii=False, indent=1)
        if ins:
            json.dump(ins, io.open(os.path.join(OUT, f"hoc_{geoid}_inserts.json"), "w",
                                   encoding="utf-8"), ensure_ascii=False, indent=1)

        yes = sum(1 for u in updates if u["data"].get("hazard_of_concern") == "Yes")
        tot_u += len(updates); tot_i += len(ins)
        summary.append(dict(geoid=geoid, jurisdiction=juris, updates=len(updates),
                            inserts=len(ins), yes=yes, no=len(updates) - yes,
                            pipeline=aliases.get(geoid, {}).get("pipeline", "?")))

    json.dump(dict(updates=tot_u, inserts=tot_i, jurisdictions=len(want),
                   errors=errs, notes=notes, per_jurisdiction=summary),
              io.open(os.path.join(OUT, "_hoc_summary.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)

    print(f"HOC: {tot_u} updates + {tot_i} inserts across {len(want)} jurisdictions")
    print(f"     expected 52 x 17 = 884 updates + 6 Freeport inserts")
    yes = sum(s["yes"] for s in summary)
    print(f"     hazard_of_concern  Yes={yes}  No={tot_u - yes}")
    print(f"     {len(notes)} judgement call(s) recorded, {len(errs)} error(s)")
    for e in errs[:15]:
        print("  ERR ", e)
    if len(errs) > 15:
        print(f"  ... and {len(errs) - 15} more (see _hoc_summary.json)")
    return 1 if errs else 0


if __name__ == "__main__":
    sys.exit(main())
