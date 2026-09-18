# -*- coding: utf-8 -*-
"""Build the slot -> source crosswalk for the Nassau base plan narrative.

    python build_crosswalk.py [outdir]

Reads   <outdir>/inventory.json   the 256 Annotation slots (target)
        <outdir>/sections.json    the 153 source sections
Writes  <outdir>/crosswalk.csv    one row per slot, reviewable

WHAT IS MECHANICAL AND WHAT IS NOT
The 16 hazard pages are 185 of the 256 slots, and Nassau's hazard sections are perfectly
regular -- Characteristics / Location and Extent / Recent Occurrences / Probability / Impacts
and Vulnerability, every time. So most hazard slots resolve by RULE:

    County Assessment                 <- Characteristics + Location and Extent + Probability
    Declarations and Their Effects    <- Recent Occurrences
    Local Hazard Summary              <- only for hazards Nassau does not profile

One does NOT resolve by rule. `Impacts and Vulnerability` is a single mixed section that has to
feed three separate slots (Built Environment / People and Communities / Natural Environment),
and reading Coastal Hazards' seven paragraphs shows why a rule cannot do it: one is explicitly
about the natural environment, one about life and property, and two more are about mitigation
efforts and climate change -- which belong to other slots entirely. Those rows are emitted as
`needs-triage` with the candidate paragraphs listed, for a per-paragraph pass.

THE HAZARD MAPPING is the one already proven on 884 Hazards-of-Concern rows, so it is carried
over rather than re-derived. Tsunami/Seiche has no 2.0 page (documented convention); Land
Subsidence has no page either and folds into landslide.
"""
import json, io, os, csv, sys, re, collections

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "../../../../../../references/mny-transcribe/Nassau/context/baseplan/out")
OUT = os.path.abspath(OUT)

# platform hazard page -> the Nassau H2 section title that feeds it
HAZARD_SOURCE = {
    "coastal_hazards": "Coastal Hazards",
    "drought": "Drought",
    "extreme_cold": "Extreme Temperatures",
    "extreme_heat": "Extreme Temperatures",
    "flooding": "Flooding",
    "earthquake": "Ground Failure Hazards",
    "landslide": "Ground Failure Hazards",
    "hail": "Hail",
    "hurricane": "Hurricanes and Tropical Storms",
    "lightning": "Lightning",
    "tornado": "Tornados",
    "ice_storm": "Severe Winter Weather",
    "snowstorm": "Severe Winter Weather",
    "wind": "Straight-Line Wind",
}
# Nassau profiles neither; base-plan Table 11 names them as county-wide exclusions.
NOT_PROFILED = {"avalanche", "wildfire"}
SPLIT_PARENTS = {"Extreme Temperatures", "Ground Failure Hazards", "Severe Winter Weather"}

# slot title -> (source subsection titles, disposition, note)
HAZARD_RULES = {
    "County Assessment": (
        ["Characteristics", "Location and Extent", "Probability", "Probability of Occurrence"],
        "section-fill", "the hazard's own description, extent and likelihood"),
    "Declarations and Their Effects on the County": (
        ["Recent Occurrences"], "section-fill", "the plan's occurrence history"),
    "Built Environment - Local Risk Summary": (
        ["Impacts and Vulnerability"], "needs-triage", "per-paragraph split, see module docstring"),
    "People and Communities - Local Risk Summary": (
        ["Impacts and Vulnerability"], "needs-triage", "per-paragraph split"),
    "Natural Environment - Local Risk Summary": (
        ["Impacts and Vulnerability"], "needs-triage", "per-paragraph split"),
    "Featured Event": (
        [], "gap-empty", "no single event is written up as a feature; leave empty rather than "
                         "promote one arbitrarily"),
    "Jurisdictional Assessment": (
        [], "separate-track", "jurisdictional content lives in the 52 annexes, which are 2.0 "
                              "FORM pages, not Annotation slots"),
    "Local Capabilities": (
        [], "auto-populated", "the platform renders the capabilities table by geoid; 896 rows "
                              "already loaded"),
    "Local Actions": (
        [], "auto-populated", "the platform renders the actions table by geoid; 617 rows "
                              "already loaded"),
    "Featured Strategy": (
        [], "gap-empty", "no strategy is singled out in the base plan"),
    "Local Hazard Summary": (
        [], "gap-empty", "used only for hazards the county does not profile"),
}


# ----------------------------------------------------------------------------------------
# NON-HAZARD SLOTS.
#
# Keyed by (page slug, slot ORDER) rather than by title, because "Local Context" appears 20+
# times across these pages and its meaning comes entirely from its position and its Inline
# Guidance. Keying on title alone would collapse eight distinct Built Environment slots into
# one.
#
# Value: (source block numbers, disposition, note). Blocks cite sections.json.
NONHAZARD = {
    # ---- The Plan / About the Process  <- Ch.2 Planning Process + Ch.6 implementation
    ("the_plan/about_the_process", 3):  ([43, 63, 66], "section-fill", "the update process and its meetings"),
    ("the_plan/about_the_process", 5):  ([34], "section-fill", "Plan Organization describes the related planning context"),
    ("the_plan/about_the_process", 8):  ([45, 48, 51, 54, 57], "section-fill", "the five planning bodies"),
    ("the_plan/about_the_process", 10): ([25], "section-fill", "Participating Jurisdictions (Ch.1)"),
    ("the_plan/about_the_process", 13): ([63, 66], "section-fill", "how jurisdictions were engaged"),
    ("the_plan/about_the_process", 15): ([57, 70, 72], "section-fill", "stakeholder group + outreach strategy"),
    ("the_plan/about_the_process", 20): ([60, 74, 76, 78], "section-fill", "public, MailChimp, social media, surveys"),
    ("the_plan/about_the_process", 22): ([78], "section-fill", "public surveys are the only comment record"),
    ("the_plan/about_the_process", 25): ([81], "section-fill", "Data Sources"),
    ("the_plan/about_the_process", 32): ([611], "section-fill", "Plan Adoption (Ch.6)"),
    ("the_plan/about_the_process", 35): ([617], "section-fill", "Plan Maintenance (Ch.6)"),
    ("the_plan/about_the_process", 37): ([633], "section-fill", "Plan Integration (Ch.6)"),
    ("the_plan/about_the_process", 39): ([627], "section-fill", "Public Engagement (Ch.6)"),

    # ---- The Plan / Strategies  <- Ch.6 + Ch.5
    ("the_plan/strategies", 3):  ([585], "section-fill", "strategy overview"),
    ("the_plan/strategies", 7):  ([588], "section-fill", "Mitigation Strategy Goals"),
    ("the_plan/strategies", 10): ([596, 602], "section-fill", "development + identification of actions"),
    ("the_plan/strategies", 13): ([602], "section-fill", "problem areas are identified alongside actions"),
    ("the_plan/strategies", 15): ([614], "section-fill", "Action Prioritization"),
    ("the_plan/strategies", 20): ([548], "section-fill", "Fiscal Capabilities carries funding sources"),
    ("the_plan/strategies", 24): ([521], "section-fill", "Progress after Superstorm Sandy is the capability highlight"),
    ("the_plan/strategies", 27): ([598, 604], "section-fill", "updates to the 2014 plan + the 2020 action plan"),
    ("the_plan/strategies", 30): ([565], "section-fill", "Planning for Displaced Residents (Ch.5)"),
    ("the_plan/strategies", 32): ([566, 574], "section-fill", "intermediate + long-term housing"),
    ("the_plan/strategies", 34): ([578], "section-fill", "Planning for Evacuation and Sheltering"),
    ("the_plan/strategies", 36): ([578], "section-fill", "the same section covers shelters"),

    # ---- The Plan / Capabilities Assessment  <- Ch.5, one slot per capability family
    ("the_plan/capabilities_assessment", 5):  ([539], "section-fill", "Legal and Regulatory"),
    ("the_plan/capabilities_assessment", 11): ([546], "section-fill", "Administrative and Technical"),
    ("the_plan/capabilities_assessment", 17): ([70, 72], "section-fill", "outreach is the nearest education and outreach capability"),
    ("the_plan/capabilities_assessment", 23): ([548], "section-fill", "Fiscal Capabilities"),

    # ---- Local Environment / People and Communities  <- Ch.3 County Profile
    ("the_local_environment/people_and_communities", 4):  ([84, 86, 89], "section-fill", "location and density"),
    ("the_local_environment/people_and_communities", 9):  ([92, 95, 100], "section-fill", "social vulnerability, access and functional needs"),
    ("the_local_environment/people_and_communities", 11): ([], "gap-empty", "no transient or seasonal population narrative"),
    ("the_local_environment/people_and_communities", 19): ([89], "section-fill", "population density stands in for change"),
    ("the_local_environment/people_and_communities", 21): ([118], "section-fill", "Economy"),
    ("the_local_environment/people_and_communities", 23): ([], "gap-empty", "governance structure is not described"),
    ("the_local_environment/people_and_communities", 26): ([], "gap-empty", "special districts are not described"),
    ("the_local_environment/people_and_communities", 30): ([], "gap-empty", "neighbouring counties are not discussed"),

    # ---- Local Environment / Natural Environment  <- Ch.3
    ("the_local_environment/natural_environment", 3):  ([107, 108, 110, 113], "section-fill", "climate, land cover, hydrology"),
    ("the_local_environment/natural_environment", 10): ([], "gap-empty", "no county open space plan narrative"),
    ("the_local_environment/natural_environment", 15): ([], "gap-empty", "no land-acquisition narrative"),
    ("the_local_environment/natural_environment", 17): ([], "gap-empty", "no Firewise or WUI content; the county does not profile wildfire"),
    ("the_local_environment/natural_environment", 21): ([113], "section-fill", "Hydrology and Hydrography"),
    ("the_local_environment/natural_environment", 24): ([113], "section-fill", "water quality sits inside hydrology"),
    ("the_local_environment/natural_environment", 25): ([], "gap-empty", "air quality is not discussed"),
    ("the_local_environment/natural_environment", 28): ([], "gap-empty", "wildlife management is not discussed"),
    ("the_local_environment/natural_environment", 31): ([110], "section-fill", "Land Cover is the nearest forestry content"),

    # ---- Local Environment / Built Environment  <- Ch.3 + Ch.5
    # The eight "Local Context" slots ask for infrastructure BY TYPE -- water, transportation,
    # energy, communications. Nassau has ONE Critical Facilities section, not per-type coverage,
    # so the type-specific slots are gaps rather than the same section pasted four times.
    ("the_local_environment/built_environment", 4):  ([84, 126, 128], "section-fill", "built-environment overview"),
    ("the_local_environment/built_environment", 8):  ([128], "section-fill", "Critical Facilities"),
    ("the_local_environment/built_environment", 12): ([128], "section-fill", "Critical Facilities, broad infrastructure"),
    ("the_local_environment/built_environment", 15): ([113], "section-fill", "hydrology is the only water-infrastructure content"),
    ("the_local_environment/built_environment", 19): ([], "gap-empty", "no transportation-infrastructure narrative"),
    ("the_local_environment/built_environment", 22): ([], "gap-empty", "no energy-infrastructure narrative"),
    ("the_local_environment/built_environment", 25): ([], "gap-empty", "no communications-infrastructure narrative"),
    ("the_local_environment/built_environment", 28): ([128], "section-fill", "Critical Facilities"),
    ("the_local_environment/built_environment", 32): ([], "gap-empty", "historic properties are not described"),
    ("the_local_environment/built_environment", 37): ([], "gap-empty", "no development-change narrative"),
    ("the_local_environment/built_environment", 43): ([539], "section-fill", "Legal and Regulatory covers code enforcement"),
    ("the_local_environment/built_environment", 45): ([563], "section-fill", "NFIP Summary (Ch.5)"),

    # ---- NFIP / dams / climate / disasters / methodology
    ("the_local_environment/nfip_floodplain_management", 3):  ([563], "section-fill", "NFIP Summary"),
    ("the_local_environment/nfip_floodplain_management", 10): ([313], "section-fill", "the Flooding chapter NFIP subsection"),
    ("the_local_environment/nfip_floodplain_management", 16): ([554], "section-fill", "Community Classification covers CRS"),
    ("the_local_environment/high_hazard_dams", 5): ([], "gap-empty", "the plan does not profile dams"),
    ("the_risk/climate_change", 5): ([116], "section-fill", "Climate Projections"),
    ("the_risk/non_natural_hazards", 4): ([], "gap-empty", "Nassau profiles no non-natural hazards"),
    ("the_risk/disasters", 7): ([], "gap-empty", "state emergency declarations are not summarised"),
    ("the_risk/disasters", 10): ([], "gap-empty", "the local declaration process is not described"),
    ("the_risk/natural_hazards", 9): ([140, 141], "section-fill", "Methodology, Data and Tools"),
    ("the_risk", 5): ([141], "section-fill", "the risk-analysis methodology"),
    ("track_progress/annual_maintenance", 4): ([], "gap-empty", "no change log exists in a 2020 plan; it accrues after adoption"),
}
# Executive Summary slots take the plan's own executive summary, by section.
# Landing-page Executive Summary slots <- the plan's own Executive Summary subsections,
# which are exactly Planning Process / Risk Assessment / Mitigation Strategy / Plan Organization.
EXEC_SUMMARY = {
    "the_risk": 5,                      # Executive Summary: Risk Assessment
    "the_local_environment": 5,         # nearest: the risk-assessment framing of the county
    "the_plan": 3,                      # Executive Summary: Planning Process
    "track_progress": 7,                # Executive Summary: Mitigation Strategy
    "the_risk/disasters": 5,
    "the_risk/natural_hazards": 5,
}


def main():
    inv = json.load(io.open(os.path.join(OUT, "inventory.json"), encoding="utf-8"))
    secs = json.load(io.open(os.path.join(OUT, "sections.json"), encoding="utf-8"))

    # index the hazard subsections: parent H2 title -> {subsection title: section}
    haz_subs = collections.defaultdict(dict)
    cur = None
    for s in secs:
        if s["lvl"] == 2 and s["title"] in set(HAZARD_SOURCE.values()):
            cur = s["title"]
        elif s["lvl"] == 2:
            cur = None
        elif cur and s["lvl"] >= 3:
            haz_subs[cur].setdefault(s["title"], s)

    rows = []
    for page in sorted(inv.values(), key=lambda v: v["slug"]):
        slug = page["slug"]
        leaf = slug.split("/")[-1]
        is_hazard = slug.startswith("the_risk/natural_hazards/")
        for slot in page["slots"]:
            title = (slot["title"] or "").strip()
            rec = dict(page=slug, slot=title or "(untitled)", slot_id=slot["id"],
                       already_filled="yes" if slot["filled"] else "",
                       source_sections="", source_blocks="", chars="",
                       disposition="", confidence="", note="")

            if not is_hazard:
                byn = {s["n"]: s for s in secs}
                key = (slug, slot.get("order"))
                if title == "Executive Summary" and slug in EXEC_SUMMARY:
                    blocks = [EXEC_SUMMARY[slug]]
                    disp, note = "section-fill", "the plan's own executive summary section"
                elif key in NONHAZARD:
                    blocks, disp, note = NONHAZARD[key]
                elif slug == "home":
                    blocks, disp, note = [], "auto-populated", (
                        "the landing page ships filled by the template; all six slots are "
                        "already populated and none is county-authored")
                elif slot.get("filled"):
                    blocks, disp, note = [], "auto-populated", (
                        "already filled by the template, not by this transcription")
                else:
                    blocks, disp, note = [], "todo", "unmapped - needs a decision"
                found = [byn[b] for b in blocks if b in byn]
                missing = [b for b in blocks if b not in byn]
                rec.update(
                    source_sections="; ".join(s["title"] for s in found),
                    source_blocks="; ".join(str(s["n"]) for s in found),
                    chars=sum(s["chars"] for s in found) or "",
                    disposition=disp,
                    confidence="high" if disp == "section-fill" and found else "",
                    note=note + (f"  MISSING BLOCKS {missing}" if missing else ""))
                rows.append(rec)
                continue

            if leaf in NOT_PROFILED:
                if title == "Local Hazard Summary":
                    rec.update(disposition="derived", confidence="high",
                               note="Nassau does not profile this hazard; base-plan Table 11 "
                                    "names it a county-wide exclusion. Write the exclusion "
                                    "rationale here, matching the HOC reason_for_exclusion.")
                else:
                    rec.update(disposition="gap-empty", confidence="high",
                               note="hazard not profiled by the county")
                rows.append(rec)
                continue

            parent = HAZARD_SOURCE.get(leaf)
            rule = HAZARD_RULES.get(title)
            if slot.get("filled") and rule is None:
                # Template-authored, not county content. Flooding carries one such untitled
                # slot: a cross-reference sentence pointing at the NFIP section below.
                rec.update(disposition="auto-populated", confidence="high",
                           note="already filled by the template, not by this transcription")
                rows.append(rec)
                continue
            if parent is None or rule is None:
                rec.update(disposition="todo", note="no rule for this slot")
                rows.append(rec)
                continue

            want, disp, note = rule
            found = [haz_subs[parent][w] for w in want if w in haz_subs[parent]]
            rec.update(
                source_sections="; ".join(s["title"] for s in found),
                source_blocks="; ".join(str(s["n"]) for s in found),
                chars=sum(s["chars"] for s in found) or "",
                disposition=disp if found or not want else "gap-empty",
                confidence=("high" if disp == "section-fill" and found else
                            "" if disp == "needs-triage" else "high"),
                note=note + (f"  [source: {parent}]" if parent else "") +
                     ("  SPLIT: this page shares its source with a sibling; the parent section "
                      "covers both." if parent in SPLIT_PARENTS else "") +
                     ("  NOTE: no matching subsection found." if want and not found else ""))
            rows.append(rec)

    p = os.path.join(OUT, "crosswalk.csv")
    with io.open(p, "w", encoding="utf-8-sig", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)

    d = collections.Counter(r["disposition"] for r in rows)
    haz = [r for r in rows if r["page"].startswith("the_risk/natural_hazards/")]
    print(f"crosswalk: {len(rows)} slot(s)  ->  {p}")
    print(f"  hazard-page slots: {len(haz)}   other: {len(rows)-len(haz)}")
    for k, v in d.most_common():
        print(f"    {v:4d}  {k}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
