"""
Phase 7a - build the Actions insert payloads for Nassau.

THE ONLY GREENFIELD BUILDER. Suffolk explicitly scoped Actions out ("Actions was out of scope
for this slice"), so unlike the other five this has no proven counterpart to work from, and
its checkbox encoding could not be calibrated against live rows.

  287 proposed  +  282 prior  +  2 completed  =  571 rows

MERGE: WORKSHEET-PRECEDENCE (owner, reversed from annex-precedence 2026-08-21)
Where an annex action and a Mitigation Action Worksheet describe the same project, the
worksheet wins -- it is more detailed and more deliberate. Joined on `(geoid, project_number)`
because project numbers are unique only WITHIN a jurisdiction: `VMP_1` is a real number in
both Massapequa Park and Munsey Park. A global join would file one village's worksheet under
another's action.

Two declared exceptions:
  - Village of Hempstead's roll-up worksheet covers VOH_1..VOH_8 and must NOT overwrite them.
    Its $1,005,000 is exactly the sum of the eight annex costs, so it is a different
    GRANULARITY, not a competing claim. The eight keep their own names and costs and inherit
    only the worksheet's worksheet-only fields.
  - Oyster Bay TOB_14 exists only on a worksheet; kept as a worksheet-sourced action.

GOALS -- the mapping is NOT 1:1 and assuming it would be is a silent semantic error.
Nassau's six goals and MNY's six booleans are in DIFFERENT ORDERS. Nassau Goal 1 is "Build
stronger", which is MNY goal *6*. Read from the base plan, not assumed:

  Nassau 1 Build stronger ................................. MNY 6 build_stronger6
  Nassau 2 Build/support local capacity to prepare,
           respond, recover .............................. MNY 1 health and safety (nearest)
  Nassau 3 Protect existing property ..................... MNY 3 exact
  Nassau 4 Increase awareness ............................ MNY 4 exact
  Nassau 5 Preserve/restore natural systems .............. MNY 5 exact
  Nassau 6 Coordination of land use / redevelopment ...... MNY 2 coordination (nearest)

ACTION TYPE: see planning/mitigateny/skills/action-type-algorithm.md for the owner's tier and
guardrail specification, implemented in `rank_types()` below.

OUTPUTS  payloads/act_<geoid>.json     [{data, _kind, _row}]
         payloads/_act_summary.json

Usage: python build_actions.py [geoid ...]
"""
import json, io, os, sys, csv, re, collections

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import mny_schema as S

CTX = os.path.dirname(HERE)
EX = os.path.join(CTX, "extracted")
OUT = os.path.join(CTX, "payloads")
COUNTY_GEOID = "36059"
PLAN_DATE = "2020-12-16"
X = S.CHECKBOX["actions"]   # "x" -- now calibrated against live rows, see mny_schema.py

# ---------------------------------------------------------------- goals (see docstring)
GOAL_MAP = {
    "1": "build_stronger6",
    "2": "protect_improve_the_health_and_safety_of_all_people_communities1",
    "3": "protect_existing_property3",
    "4": "increase_awareness4",
    "5": "preserve_restore_natural_systems5",
    "6": "federal_state_local_coordination2",
}

# ------------------------------------------------------------ action-type detection
# (boolean column, P/S/T select value, tier, within-tier rank, keyword pattern)
# The P/S/T value differs from the boolean for the two Tier-1 types with no select option.
TYPES = [
    ("dam_rehabilitation_removal", "Large Flood Control - Dams, Levees, Floodwalls; Safe Rooms",
     1, 1, r"\bdam\b|\bdams\b|impoundment"),
    ("other_large_flood_control_levees_floodwalls_safe_rooms",
     "Large Flood Control - Dams, Levees, Floodwalls; Safe Rooms", 1, 1,
     r"levee|floodwall|flood wall|safe room|berm|tide gate|sea ?wall|bulkhead|revetment|"
     r"sluice|\bwall\b|muscle wall|flood gate|weir"),
    ("community_infrastructure_drainage_underground_utilities",
     "Community Infrastructure - Drainage, Underground Utilities", 1, 2,
     r"drainage|storm ?water|storm ?drain|culvert|catch basin|sewer|water main|"
     r"underground|pump station|swale|outfall|dry well|recharge|"
     r"dredg|retention pond|detention|\bpond\b|force main|\bpipes?\b|water meter|"
     r"booster|SCADA|green infrastructure|water management|footbridge|\bbridge\b|"
     r"sand filter|separator"),
    ("coastal_protection", "Infrastructure Projects", 1, 3,
     r"coastal|shoreline|beach nourish|dune|jetty|groin|tidal|marsh|storm surge|"
     r"\bbay\b|waterfront|\bcanal\b"),
    # P/S/T-only value with no boolean of its own -- see action-type-algorithm.md. Detected
    # here because 15 Nassau actions literally name themselves "Infrastructure Project: ...".
    (None, "Infrastructure Projects", 1, 4,
     r"infrastructure project|reconstruction of|rebuild|replacement of .{0,30}building"),
    ("acquisition_elevation_or_relocation", "Property Protection - Acquisition, Elevation or Relocation",
     2, 1, r"acquisi|buy ?out|elevat|relocat|demolish|acquire"),
    ("floodproofing_other", "Property Protection - Floodproofing, other", 2, 2,
     r"floodproof|flood ?proof|dry ?flood|wet ?flood|back ?flow|check valve|"
     r"window film|wind ?resistant|storm shutter|impact glass|harden"),
    ("wetlands_floodplains", "Wetland Protection/ Restoration", 3, 1,
     r"wetland|floodplain restor|open space|conservation district|natural system|"
     r"watershed|restore and enhance"),
    ("power_microgrids_emergency_power_for_critical_facilities",
     "Power - Microgrids, Emergency Power for Critical Facilities", 4, 1,
     r"generator|microgrid|emergency power|back ?up power|standby power|power outage|"
     r"electrical power|utility line|overhead line|transformer"),
    ("codes_ordinance_zoning_policy_law_governance",
     "Codes/ Ordinance/ Zoning/ Policy/ Law/ Governance", 5, 1,
     r"ordinance|\bcode\b|zoning|\blaw\b|policy|regulation|permit requirement|"
     r"governance|adopt.{0,20}(?:code|ordinance|law)"),
    ("planning", "Plans", 6, 1,
     r"\bplan\b|\bplans\b|master plan|comprehensive plan|update its plan|planning"),
    ("studies_and_or_risk_assessment", "Studies and/or Risk Assessment", 6, 2,
     r"\bstudy\b|studies|assessment|analys|evaluat|survey|model|mapping|inventory"),
    ("project_scoping", "Project Scoping", 6, 3, r"scoping|feasibility|design phase|preliminary design"),
    ("establishing_long_term_programs", "Establishing Long-Term Programs", 6, 4,
     r"program|ongoing maintenance|maintenance program|routine|annual|"
     r"digitiz|scanning service|record.{0,12}(?:management|retention)"),
    ("education_awareness_outreach", "Education & Awareness", 7, 1,
     r"outreach|educat|awareness|newsletter|brochure|public information|website|notify"),
    ("preparedness_response", "Preparedness and Response", 7, 2,
     r"preparedness|response|emergency operations|drill|exercise|training|CERT|"
     r"warning system|siren|notification system|mutual aid|evacuat"),
]
# Types that exist only as a P/S/T select value, no boolean. Never detected directly; used
# only as substitutions or as the last-resort value.
OTHER_TYPE = ("other", "Other", 8, 2, None)
FALLBACK = ("other", "Prevention/Mitigation Projects", 8, 1, None)

PLANNING_FAMILY = {"planning", "studies_and_or_risk_assessment", "project_scoping",
                   "establishing_long_term_programs"}
OUTREACH_FAMILY = {"education_awareness_outreach", "preparedness_response"}

# ------------------------------------------------------------------ hazards
HAZARD_RULES = [
    (r"coastal", "Coastal Hazards"),
    (r"flood|tidal|inundat|storm surge", "Flooding"),
    (r"hurricane|tropical", "Hurricane"),
    (r"tornado", "Tornado"),
    (r"ice ?storm|icing", "Ice storm"),
    (r"nor'?easter|winter|snow|blizzard", "Snowstorm"),
    (r"wind|gale", "Wind"),
    (r"hail", "Hail"),
    (r"lightning|thunder", "Lightning"),
    (r"drought", "Drought"),
    (r"earthquake|seismic", "Earthquake"),
    (r"landslide|erosion|slope failure", "Landslide"),
    (r"extreme heat|heat wave", "Extreme Heat"),
    (r"extreme cold|cold wave", "Extreme Cold"),
    (r"wildfire|brush fire", "Wildfire"),
    (r"tsunami|seiche", "Tsunami/Seiche"),
]
ALL_HAZARDS = re.compile(
    r"\ball\b|all[- ]hazard|various|multi[- ]hazard|"
    # Consequence-phrased sources, not hazard-phrased: 75 actions describe what they mitigate
    # as "Frequent power outages" or "Local Emergencies". Many hazards cause those, and
    # `Hazards` is a required column, so they resolve to Most or All Hazards rather than being
    # left empty. Recorded as a judgement call, not a mapping.
    r"power ?outage|loss of (?:electrical )?power|electrical power|extreme weather|"
    r"local emergenc|power failure|severe weather", re.I)

# The DEPRECATED `Hazards` multiselect has its OWN vocabulary, and it is not the same as
# `primary_hazard_type`: it spells "Ice Storm" with a capital S, and it has no
# "Most or All Hazards" member at all. Writing the canonical labels straight into it fails
# validation on both counts.
DEPRECATED_HAZARDS = ["Avalanche", "Coastal Hazards", "Extreme Cold", "Drought", "Earthquake",
                      "Flooding", "Hail", "Extreme Heat", "Hurricane", "Ice Storm", "Landslide",
                      "Lightning", "Snowstorm", "Tornado", "Tsunami/Seiche", "Wildfire", "Wind"]


def deprecated_hazards(hz):
    """Canonical hazard labels -> the deprecated field's vocabulary."""
    if hz == ["Most or All Hazards"]:
        return list(DEPRECATED_HAZARDS)      # the field cannot say "all"; enumerate instead
    out = []
    for h in hz:
        v = "Ice Storm" if h == "Ice storm" else h
        if v in DEPRECATED_HAZARDS:
            out.append(v)
    return out
HAZARD_CHECKBOX = {
    "Coastal Hazards": "coastal_hazards", "Flooding": "flooding", "Hurricane": "hurricane",
    "Tornado": "tornado", "Ice storm": "ice_storm", "Snowstorm": "snowstorm", "Wind": "wind",
    "Hail": "hail", "Lightning": "lightning", "Drought": "drought", "Earthquake": "earthquake",
    "Landslide": "landslide", "Extreme Heat": "extreme_heat", "Extreme Cold": "extreme_cold",
    "Wildfire": "wildfire", "Tsunami/Seiche": "tsunami_seiche",
    "Most or All Hazards": "most_or_all_formal_hazards",
}

# ------------------------------------------------------------------ status / timeline / cost
STATUS_MAP = {           # normalised source status -> (action_status, implementation_status)
    "completed": ("Completed", "Completed"),
    "in progress": ("In-Progress", "In-Progress"),
    "ongoing": ("In-Progress", "In-Progress"),
    "not started": ("Proposed - Not Started", "Proposed"),
    "new": ("Proposed - Not Started", "Proposed"),
    "proposed": ("Proposed - Not Started", "Proposed"),
    "discontinued": ("Discontinued", "Discontinued/Paused"),
    "cancelled": ("Discontinued", "Discontinued/Paused"),
    "unresponsive": ("Progress Not Reported", "NA"),
    "not provided": ("Progress Not Reported", "NA"),
    "no response": ("Progress Not Reported", "NA"),
}
COST_BANDS = [
    (10_000, "<$10,000"), (50_000, "$10,000 - $50,000"), (150_000, "$50,000 - $150,000"),
    (500_000, "$150,000 - $500,000"), (1_000_000, "$500,000 - $1,000,000"),
    (2_000_000, "$1,000,000 - $2,000,000"), (10_000_000, "$2,000,000 - $10,000,000"),
    (50_000_000, "$10,000,000 - $50,000,000"),
]

notes, errs, unmapped_hazard = [], [], collections.Counter()


def clean(s):
    return re.sub(r"\s+", " ", str(s or "")).strip()


def money(s):
    """A number only when the string really is a cost. Prose returns None -- an earlier
    version parsed fragments out of sentences and produced four false HIGH cost bands."""
    s = clean(s)
    if not s or len(s) > 60:
        return None
    m = re.findall(r"\$\s?([\d,]+(?:\.\d+)?)", s)
    if not m:
        if re.fullmatch(r"[\d,]+(?:\.\d+)?", s):
            m = [s]
        else:
            return None
    try:
        return max(float(x.replace(",", "")) for x in m)
    except ValueError:
        return None


def cost_band(v):
    if v is None:
        return None
    if v == 0:
        return "No Associated Costs"
    for lim, label in COST_BANDS:
        if v < lim:
            return label
    return ">$50,000,000"


def timeline(s):
    """Free text -> the 5-value vocabulary. 108 distinct source spellings."""
    t = clean(s).lower()
    if not t:
        return None
    if re.search(r"ongoing|continuous|annual|as needed|dpw staff", t):
        return "Ongoing"
    yrs = None
    m = re.search(r"(\d+(?:\.\d+)?)\s*(?:\+\s*)?year", t)
    if m:
        yrs = float(m.group(1))
    else:
        m = re.search(r"(\d+)\s*month", t)
        if m:
            yrs = int(m.group(1)) / 12.0
        elif re.search(r"\bone year\b|\bwithin a year\b|\b1 yr\b", t):
            yrs = 1.0
        elif re.search(r"\btwo year", t):
            yrs = 2.0
        elif re.search(r"\bthree year", t):
            yrs = 3.0
        elif re.search(r"\bfive year|5-10 year|5 - 10 year", t):
            yrs = 5.0
    if yrs is None:
        return "Not Reported"
    if yrs < 2:
        return "Less than 2 years"
    if yrs <= 4:
        return "2-4 years"
    return "More than 4 years"


def hazards_of(text):
    t = clean(text)
    if not t:
        return []
    found, seen = [], set()
    for pat, name in HAZARD_RULES:
        if re.search(pat, t, re.I) and name not in seen:
            seen.add(name)
            found.append(name)
    if not found and ALL_HAZARDS.search(t):
        return ["Most or All Hazards"]
    if not found:
        unmapped_hazard[t[:48]] += 1
    return found


def detect_types(text):
    t = clean(text)
    return [ty for ty in TYPES if ty[4] and re.search(ty[4], t, re.I)]


def rank_types(found):
    """
    The owner's tier/guardrail algorithm. See skills/action-type-algorithm.md.
    Final score = tier score (guardrails 5.2 and 5.4 are inert by design -- both reference an
    undefined Boost step).
    """
    if not found:
        return [FALLBACK]
    ranked = sorted(found, key=lambda ty: (ty[2], ty[3]))
    tiers = {ty[2] for ty in found}

    def eligible_primary(ty):
        # 5.1 Structural Dominance
        if 1 in tiers and ty[2] != 1:
            return False
        # 5.3 Planning Ceiling
        if tiers & {1, 2, 3} and ty[0] in PLANNING_FAMILY:
            return False
        # 5.4 Policy Ceiling (Boost undefined -> same shape as 5.3)
        if tiers & {1, 2, 3} and ty[0] == "codes_ordinance_zoning_policy_law_governance":
            return False
        # 5.5 Outreach Lock
        if ty[0] in OUTREACH_FAMILY and not all(f[0] in OUTREACH_FAMILY for f in found):
            return False
        # 5.6 Other is last
        if ty[0] == "other":
            return False
        return True

    primary = next((ty for ty in ranked if eligible_primary(ty)), None)
    if primary is None:
        primary = ranked[0]
    rest = [ty for ty in ranked if ty is not primary]
    return [primary] + rest


def main():
    os.makedirs(OUT, exist_ok=True)
    M = json.load(io.open(os.path.join(EX, "maws.json"), encoding="utf-8"))
    ws = {}
    rollup_components = set()
    for w in M["worksheets"]:
        num = w.get("project_number")
        g = str(w.get("geoid") or "")
        if w.get("relationship") == "rollup" or w.get("precedence_applies") is False:
            # A roll-up must not overwrite its components; remember them so precedence is
            # skipped, but keep its worksheet-only fields available as shared context.
            for c in re.split(r"[,\s]+", str(num or "")):
                if c:
                    rollup_components.add((g, c))
            continue
        if num:
            ws[(g, str(num))] = w

    ann = os.path.join(EX, "annexes")
    want = sys.argv[1:] or sorted(f[:-5] for f in os.listdir(ann) if f.endswith(".json"))
    total = collections.Counter()
    per, enriched = [], 0

    for geoid in want:
        A = json.load(io.open(os.path.join(ann, geoid + ".json"), encoding="utf-8"))
        juris = A["jurisdiction"]
        rows = []

        # ---------------------------------------------- proposed AND completed actions
        # Woodsburgh's 2 completed actions use the PROPOSED-action shape (Project Name, Goal
        # being met, Hazards to be mitigated), not the prior-action shape (Action, Project
        # Status). Running them through the prior-action path silently dropped both, because
        # that path keys on a field they do not have. Same table shape, different status.
        proposed = ([("proposed", a) for a in A["proposed_actions"]] +
                    [("completed", a) for a in (A.get("completed_actions") or [])])
        for i, (kind_p, a) in enumerate(proposed):
            num = clean(a.get("Project Number"))
            w = ws.get((geoid, num))
            is_rollup_component = (geoid, num) in rollup_components
            if w:
                enriched += 1

            def pick(annex_key, maw_key, prefer_maw=True):
                av, mv = clean(a.get(annex_key)), clean(w.get(maw_key)) if w else ""
                if w and prefer_maw and mv and not is_rollup_component:
                    return mv
                return av or mv

            name = pick("Project Name", "Project Name:")
            problem = pick("Description of the Problem", "Description of the Problem:")
            solution = pick("Description of the Solution", "Description of the Solution:")
            lead = pick("Lead Agency", "Responsible Organization:")
            hz_src = clean(a.get("Hazards to be mitigated")) or (
                clean(w.get("Hazard of Concern:")) if w else "")

            hz = hazards_of(hz_src)
            types = rank_types(detect_types(f"{name} {solution} {problem}"))

            cost_txt = pick("Estimated Costs", "Estimated Cost:")
            cv = money(cost_txt)
            if cv is None and w:
                cv = money(a.get("Estimated Costs"))       # numeric falls back to the annex

            d = {
                "action_name": name,
                "action_number": num or None,
                "description_of_the_problem_problem_statement": problem or None,
                "description_of_the_solution_action_description": solution or None,
                "lead_agency_department": lead or None,
                # Owner, 2026-08-21: Woodsburgh's completed table sets Implementation Status
                # to Completed.
                "action_status": "Completed" if kind_p == "completed" else "Proposed - Not Started",
                "implementation_status": "Completed" if kind_p == "completed" else "Proposed",
                "action_status_date": PLAN_DATE,
                "action_creation_date": PLAN_DATE,
                "included_in_last_hmp": "Yes",
                "source_id": "Local",
                "county": ["Nassau"],
                "county_geoid": [COUNTY_GEOID],
                "geoid_juris": geoid,
                "jurisdiction": juris,
                "priority": clean(a.get("Priority Ranking")) or None,
                "potential_primary_funding_sources": pick("Potential Funding Sources",
                                                          "Potential Funding Sources:") or None,
                "estimated_time_required_for_project_implementation":
                    timeline(pick("Estimated Timeline",
                                  "Estimated Time Required for Project Implementation:")),
                "cost_range": cost_band(cv),
                "estimated_cost": str(int(cv)) if cv is not None else None,
                "cost_notes": cost_txt if cv is None and cost_txt else None,
                "related_to_a_critical_facility": {
                    "yes": "Yes", "no": "No"}.get(clean(a.get("Critical Facility")).lower(),
                                                  "Not Reported"),
                "are_there_known_environmental_historic_preservation_or_protected_species_concerns":
                    {"yes": "Yes", "no": "No", "unknown": "Not Reported"}.get(
                        clean(a.get("EHP Issues")).lower(), "Not Reported"),
                # No source in the Hagerty annex or the worksheet for any of these three.
                "is_this_action_addressing_climate_change": "Not Reported",
                "is_this_action_mitigating_climate_change_i_e_ghg_reduction": "Not Reported",
                "does_this_action_protect_repetitive_or_severe_repetitive_loss_properties":
                    "Not Reported",
                "Hazards": deprecated_hazards(hz) or None,
            }
            if w:
                d["existing_planning_mechanisms_to_be_used_in_implementation_if_any"] = clean(
                    w.get("Local Planning Mechanisms to be Used in Implementation, if any:")) or None
                alts = w.get("alternatives") or []
                if alts:
                    d["alternative_action_1"] = clean(alts[0]) or None
                cbn = []
                for k in ("Level of Protection:", "Useful Life:",
                          "Estimated Benefits (losses avoided):"):
                    v = clean(w.get(k))
                    if v:
                        cbn.append(f"{k.rstrip(':')}: {v}")
                if len(alts) > 1:
                    cbn.append("Alternative action 2: " + clean(alts[1]))
                if cbn:
                    d["cost_benefit_notes"] = "  ".join(cbn)
                if is_rollup_component:
                    d["dhses_comments"] = (
                        "Worksheet-precedence deliberately NOT applied: this action is one of "
                        "eight components of a programme-level roll-up worksheet whose cost is "
                        "the sum of the eight. The worksheet's shared fields are attached, but "
                        "its name and cost are not.")
            else:
                d["existing_planning_mechanisms_to_be_used_in_implementation_if_any"] = None

            # goals
            for g in re.findall(r"[1-6]", clean(a.get("Goal being met"))):
                col = GOAL_MAP.get(g)
                if col:
                    d[col] = X
            # hazard + action-type checkboxes and the three selects
            for h in hz:
                col = HAZARD_CHECKBOX.get(h)
                if col:
                    d[col] = X
            for slot, ty in zip(("primary", "secondary", "tertiary"), types[:3]):
                d[f"{slot}_action_type"] = ty[1]
            for ty in types:
                # `Infrastructure Projects` has no boolean of its own (ty[0] is None).
                if ty[0] and (ty[0] != "other" or ty is OTHER_TYPE):
                    d[ty[0]] = X
            for slot, h in zip(("primary", "secondary", "tertiary"), hz[:3]):
                d[f"{slot}_hazard_type"] = h

            d = {k: v for k, v in d.items() if v not in (None, "", [])}
            errs.extend(S.validate("actions", d, f"{geoid}/{num or name[:20]}"))
            rows.append({"data": d, "_kind": kind_p, "_row": i,
                         "_worksheet": bool(w)})
            total[kind_p] += 1

        # ------------------------------------------------------------- prior actions
        for kind, key in (("prior", "prior_actions"),):
            for i, a in enumerate(A.get(key) or []):
                sent = clean(a.get("Action"))
                if not sent:
                    continue
                raw = clean(a.get("Project Status")).lower()
                st = next((v for k, v in STATUS_MAP.items() if k in raw), None)
                if kind == "completed":
                    st = ("Completed", "Completed")
                if st is None:
                    st = ("Progress Not Reported", "NA")
                    if raw:
                        notes.append(f"{geoid}: prior-action status {raw!r} unmapped")
                hz = hazards_of(a.get("Risk Category"))
                types = rank_types(detect_types(sent))
                # The prior-action table gives one sentence, no separate name field.
                name = sent if len(sent) <= 120 else sent[:117].rsplit(" ", 1)[0] + "..."
                d = {
                    "action_name": name,
                    "description_of_the_solution_action_description": sent,
                    "description_of_the_problem_problem_statement":
                        clean(a.get("Project Status Description")) or None,
                    "action_status": st[0],
                    "implementation_status": st[1],
                    "action_status_date": PLAN_DATE,
                    "action_creation_date": PLAN_DATE,
                    "action_status_details": clean(a.get("Project Status Description")) or None,
                    "included_in_last_hmp": "Yes",
                    "source_id": "Local",
                    "county": ["Nassau"],
                    "county_geoid": [COUNTY_GEOID],
                    "geoid_juris": geoid,
                    "jurisdiction": juris,
                    "lead_agency_department": juris,
                    "dhses_comments": (
                        f"Prior-cycle action carried into the 2020 plan. `action_name` is "
                        f"derived by truncating the source sentence, which the prior-action "
                        f"table gives in place of a name; the full sentence is preserved in "
                        f"Description of the Solution."
                        if len(sent) > 120 else None),
                    "is_this_action_addressing_climate_change": "Not Reported",
                    "is_this_action_mitigating_climate_change_i_e_ghg_reduction": "Not Reported",
                    "does_this_action_protect_repetitive_or_severe_repetitive_loss_properties":
                        "Not Reported",
                    "related_to_a_critical_facility": "Not Reported",
                    "existing_planning_mechanisms_to_be_used_in_implementation_if_any": None,
                    "Hazards": deprecated_hazards(hz) or None,
                }
                for h in hz:
                    col = HAZARD_CHECKBOX.get(h)
                    if col:
                        d[col] = X
                for slot, ty in zip(("primary", "secondary", "tertiary"), types[:3]):
                    d[f"{slot}_action_type"] = ty[1]
                for ty in types:
                    if ty[0]:
                        d[ty[0]] = X
                for slot, h in zip(("primary", "secondary", "tertiary"), hz[:3]):
                    d[f"{slot}_hazard_type"] = h
                d = {k: v for k, v in d.items() if v not in (None, "", [])}
                errs.extend(S.validate("actions", d, f"{geoid}/{kind}/{i}"))
                rows.append({"data": d, "_kind": kind, "_row": i})
                total[kind] += 1

        json.dump(rows, io.open(os.path.join(OUT, f"act_{geoid}.json"), "w", encoding="utf-8"),
                  ensure_ascii=False, indent=1)
        per.append(dict(geoid=geoid, jurisdiction=juris, rows=len(rows)))

    n = sum(total.values())
    json.dump(dict(rows=n, by_kind=dict(total), worksheet_enriched=enriched,
                   errors=errs, notes=notes,
                   unmapped_hazard_text=dict(unmapped_hazard), per_jurisdiction=per),
              io.open(os.path.join(OUT, "_act_summary.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)

    print(f"Actions: {n} insert rows across {len(per)} jurisdictions")
    print(f"     {dict(total)}   expected 287 proposed + 282 prior + 2 completed = 571")
    print(f"     worksheet-enriched: {enriched}")
    print(f"     {len(errs)} error(s), {len(notes)} note(s), "
          f"{len(unmapped_hazard)} distinct unmapped hazard string(s)")
    for e in errs[:10]:
        print("  ERR ", e)
    for t, c in unmapped_hazard.most_common(8):
        print(f"  NO-HAZARD x{c:<3d} {t}")
    return 1 if errs else 0


if __name__ == "__main__":
    sys.exit(main())
