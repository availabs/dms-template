"""
Phase 7a - build the Jurisdictions lexical-column markdown for Nassau.

52 rows x 7 lexical columns. This is an UPDATE to existing Jurisdictions rows (source
1346449), not an insert. Output is markdown, which 7c compiles to lexical roots -- the
markdown is the owner-review surface, so it is deliberately the artifact a human corrects.

  growth_and_development_trends   profile_paragraphs, middle
  lhmp_municipality_profile       profile_paragraphs, first
  lhmp_risk_overview              top_hazards_sentence
  lhmp_capacity_to_implement      capability_summaries (the 4 table narratives)
  lhmp_problem_areas              nfip_paragraphs classified as flood-extent / named places
  nfip                            nfip_paragraphs classified as NFIP administration
  lhmp_planning_process           adoption status

WHY CLASSIFY RATHER THAN INDEX
`profile_paragraphs` is structurally stable and can be positional: verified across all 51
Hagerty records, the FIRST paragraph always carries area/population and the LAST is always
the "Refer to the County Profile section" cross-reference. 51/51 on both.

`nfip_paragraphs` is NOT stable -- between 0 and 5 paragraphs, and only 26 of 51 open with a
flood-extent statement. Nineteen instead open with a boilerplate section intro ("This section
provides a summary of the floodplain management capabilities for X..."), which under the
standing boilerplate rule is dropped rather than transcribed. So these are classified by
content and anything unrecognised falls to `nfip` (the section it came from) and is counted.

A negative statement is still problem-areas content: "The Village is in an area of minimal
flood hazard" answers the question and is kept, not discarded as empty.

OUTPUTS  payloads/juris_<geoid>.json    {column: markdown}
         payloads/juris_<geoid>.md      the same content as one reviewable document
         payloads/_juris_summary.json   per-column fill counts + unclassified paragraphs

Usage: python build_jurisdictions.py
"""
import json, io, os, sys, csv, re, collections

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

CTX = os.path.dirname(HERE)
EX = os.path.join(CTX, "extracted")
OUT = os.path.join(CTX, "payloads")
COUNTY_GEOID = "36059"
FREEPORT_GEOID = "3627485"

COLUMNS = ["lhmp_municipality_profile", "growth_and_development_trends",
           "lhmp_risk_overview", "lhmp_problem_areas", "nfip",
           "lhmp_capacity_to_implement", "lhmp_planning_process"]

# Boilerplate: template framing that repeats across annexes. Dropped, not transcribed.
BOILERPLATE = [
    re.compile(r"^\s*This section provides a summary of the floodplain management "
               r"capabilities", re.I),
    re.compile(r"^\s*Refer to the County Profile section", re.I),
]
# The two classes are SCORED rather than tested in order. A first-match-wins test sent 49 of
# 51 records to `nfip`, because an admin term like "ordinance" or "flood insurance rate map"
# appears inside flood-extent paragraphs too ("...minimal flood hazard, according to FEMA
# flood insurance rate maps" is a problem-areas statement). Counting distinct signal hits on
# each side and taking the stronger separates them; a tie falls to `nfip`, the section the
# paragraph came from.
PROBLEM_AREAS = re.compile(
    r"flood[- ]prone|low[- ]lying|minimal flood hazard|100-year floodplain|"
    r"special flood hazard area|prone to flooding|street flooding|vulnerable to|"
    r"\bcreek\b|\bbeach\b|\bbay\b|\bcanal\b|\bshore\b|\binlet\b|\bharbor\b|\bmarina\b|"
    r"\bpond\b|\briver\b|back bay|waterfront", re.I)
NFIP_ADMIN = re.compile(
    r"administers the NFIP|responsible for floodplain|floodplain administrat|"
    r"building permit|site plan review|substantial damage|community rating system|"
    r"\bCRS\b|\bCAV\b|\bCAC\b|RiskMAP|Risk MAP|barrier|good standing|"
    r"map (?:accuracy|revision)|participat\w+ in the NFIP|enforce|"
    r"Flood Damage Prevention Ordinance|minimum requirements|compliance audit|"
    r"Community Assistance (?:Visit|Contact)|NFIP requirements", re.I)
# A THIRD class the first pass missed entirely: measures the jurisdiction has already taken.
# These are neither problem areas nor NFIP administration -- they are evidence of capacity,
# so they join the capability narratives in `lhmp_capacity_to_implement`.
MEASURES = re.compile(
    r"\binstalls?\b|\brepaves?\b|\bclears?\b|(?:have|has|been) elevated|adopted the|"
    r"commenced with|utilized a grant|working on a|mitigates? (?:future )?loss|"
    r"to (?:reduce|mitigate) (?:future )?(?:loss|flood)|"
    r"steps that the (?:Village|City|Town) takes", re.I)


def classify(p):
    """
    'problem' | 'nfip' | 'measures', by which class shows the most distinct signals.

    A compound paragraph -- "The Village installs new drainage... The Flood Damage Prevention
    Ordinance was last amended 08/05/2009..." -- is common, and NFIP wins those ties on
    purpose: the ordinance citation and amendment date are specifically called for, and are
    the higher-value half. The measures sentence rides along rather than being dropped.
    """
    score = {
        "problem": len(set(m.group(0).lower() for m in PROBLEM_AREAS.finditer(p))),
        "nfip": len(set(m.group(0).lower() for m in NFIP_ADMIN.finditer(p))),
        "measures": len(set(m.group(0).lower() for m in MEASURES.finditer(p))),
    }
    if not any(score.values()):
        return None
    best = max(score.values())
    for k in ("nfip", "problem", "measures"):      # nfip breaks ties
        if score[k] == best:
            return k


def is_boilerplate(p):
    return any(b.search(p) for b in BOILERPLATE)


def md(paras):
    return "\n\n".join(p.strip() for p in paras if p and p.strip())


def main():
    os.makedirs(OUT, exist_ok=True)
    aliases = {r["geoid"]: r for r in csv.DictReader(
        io.open(os.path.join(CTX, "nassau-jurisdiction-aliases.csv"), encoding="utf-8-sig"))}
    ann = os.path.join(EX, "annexes")
    have_annex = {f[:-5] for f in os.listdir(ann) if f.endswith(".json")}

    # ALL 70, not just the 52 with an annex.
    #
    # `lhmp_planning_process` carries the 2020 adoption status, and the crosswalk is explicit
    # about why that matters: it is "the ONLY field distinguishing a jurisdiction that adopted
    # the plan from one that engaged and withdrew - without it, 18 villages look like plan
    # participants." Those 18 have no annex, so iterating the annex files silently skipped
    # exactly the jurisdictions the field exists to distinguish. Every other column stays blank
    # for them, because there is no source.
    want = sorted(aliases.keys())

    fill = collections.Counter()
    unclassified, notes = [], []
    per = []

    for geoid in want:
        al = aliases.get(geoid, {})
        if geoid in have_annex:
            A = json.load(io.open(os.path.join(ann, geoid + ".json"), encoding="utf-8"))
            juris = A["jurisdiction"]
        else:
            A = {}                      # withdrawn village: adoption status only
            juris = al.get("jurisdiction_title", "")
        col = {c: "" for c in COLUMNS}

        # ---- profile paragraphs: positional, verified stable 51/51
        ps = [p for p in A.get("profile_paragraphs") or []]
        keep = [p for p in ps if not is_boilerplate(p)]
        if keep:
            col["lhmp_municipality_profile"] = keep[0].strip()
            if len(keep) > 1:
                col["growth_and_development_trends"] = md(keep[1:])
        elif ps:
            notes.append(f"{geoid} {juris}: every profile paragraph was boilerplate")

        # ---- risk overview
        s = (A.get("top_hazards_sentence") or "").strip()
        if s:
            col["lhmp_risk_overview"] = s

        # ---- nfip paragraphs: classified by content, not position
        prob, nfip, measures = [], [], []
        for p in A.get("nfip_paragraphs") or []:
            if is_boilerplate(p):
                continue
            k = classify(p)
            if k == "problem":
                prob.append(p)
            elif k == "measures":
                measures.append(p)
            elif k == "nfip":
                nfip.append(p)
            else:
                nfip.append(p)     # it came from the NFIP section; default there
                unclassified.append(f"{geoid} {juris}: {p[:110]}")
        col["lhmp_problem_areas"] = md(prob)
        col["nfip"] = md(nfip)

        # ---- capacity to implement: the four table narratives, labelled
        caps = A.get("capability_summaries") or {}
        blocks = []
        for table, paras in caps.items():
            body = md(paras)
            if body:
                blocks.append(f"**{table}**\n\n{body}")
        if measures:
            blocks.append("**Flood mitigation measures already taken**\n\n" + md(measures))
        col["lhmp_capacity_to_implement"] = "\n\n".join(blocks)

        # ---- planning process: adoption status, the only field distinguishing the 18
        status = (al.get("adoption_status") or "").strip()
        if status:
            col["lhmp_planning_process"] = (
                f"Participation in the 2020 Nassau County Multi-Jurisdictional Hazard "
                f"Mitigation Plan: **{status}**. Attended "
                f"{al.get('meetings_attended') or '0'} of the 7 planning meetings recorded "
                f"in the county's attendance matrix.")

        for c in COLUMNS:
            if col[c].strip():
                fill[c] += 1

        json.dump(col, io.open(os.path.join(OUT, f"juris_{geoid}.json"), "w",
                               encoding="utf-8"), ensure_ascii=False, indent=1)
        with io.open(os.path.join(OUT, f"juris_{geoid}.md"), "w", encoding="utf-8",
                     newline="\n") as fh:
            fh.write(f"# {juris} — geoid {geoid}\n\n")
            for c in COLUMNS:
                fh.write(f"## {c}\n\n{col[c].strip() or '_(no source content)_'}\n\n")
        per.append(dict(geoid=geoid, jurisdiction=juris,
                        filled=sum(1 for c in COLUMNS if col[c].strip())))

    json.dump(dict(jurisdictions=len(want), fill_by_column=dict(fill),
                   unclassified_paragraphs=unclassified, notes=notes, per_jurisdiction=per),
              io.open(os.path.join(OUT, "_juris_summary.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)

    print(f"Jurisdictions: {len(want)} records x {len(COLUMNS)} lexical columns")
    for c in COLUMNS:
        print(f"     {fill[c]:3d}/{len(want)}  {c}")
    print(f"     {len(unclassified)} paragraph(s) defaulted to `nfip` unclassified")
    for n in notes[:6]:
        print("  NOTE", n)
    return 0


if __name__ == "__main__":
    sys.exit(main())
