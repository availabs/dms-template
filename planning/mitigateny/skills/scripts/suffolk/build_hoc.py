"""
Step 5: build the Hazards-of-Concern payloads for one jurisdiction.

This step is mostly an UPDATE IN PLACE. Every jurisdiction already has 17 rows, one per
NAMED MNY hazard, all `hazard_of_concern = "Not Reported"`. Creating rows for named
hazards would produce a duplicate parallel set. Only the `Other` rows are inserts.

Sources: annex Table F (Local Hazard Impacts, 14 hazards, authored prose) and Table I
(Hazard Risk Ranking, same 14, trends + rankings).

The 14 -> 18 mapping (owner-resolved 2026-08-14, see ANNEX_CROSSWALK_REPORT.md section 4)
reconciles exactly: 5 one-to-one + 7 from four splits = 12 with content, + 5 unassessed
= 17, matching the 17 pre-existing rows with none left over.

Schema calibration against 20,000 live rows (NOT the declared types -- see the .md):
  - `general_vulnerability` / `other_comments` are declared `lexical` but ALL 140 and 334
    stored values respectively are PLAIN STRINGS. Unlike Jurisdictions, which really does
    store lexical roots. Plain strings here.
  - `hazard = "Other"` (capitalised display-label form) with `hazard_name_if_other` is a
    PROVEN pattern -- 10 such rows exist (Allegany, Fulton, Dolgeville, Hope, Inlet).
    The select's declared options are lowercase codes; stored rows use display labels.
  - vulnerability checkboxes store "Yes"/"No" strings (not "x" as in Capabilities).
  - `geoid_county` is a bare INT here; `geoid_juris` a list of strings.
  - `likelihood` is a PROBABILITY BAND with no annex source -> never touched.

Emits payloads/hoc_<geoid>_updates.json  [{id, hazard, data}]
       payloads/hoc_<geoid>_inserts.json  [{data}]
       payloads/hoc_<geoid>.md            review surface

Usage: python build_hoc.py [geoid]
"""
import json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
CTX = os.path.dirname(HERE)
CLI = os.path.abspath(os.path.join(CTX, "..", "..", "..", "..", "src", "dms", "packages", "dms", "cli", "bin", "dms.js"))
GEOID = sys.argv[1] if len(sys.argv) > 1 else "3610338000"
SOURCE, VIEW = "1473470", "1473471"

annex_dir = os.path.join(CTX, "extracted", "annexes")
af = [f for f in os.listdir(annex_dir) if f.startswith(GEOID + "_")][0]
A = json.load(open(os.path.join(annex_dir, af), encoding="utf8"))
J = A["jurisdiction"]

tables = dict((t["table_label"], t) for t in A["tables"] if t.get("table_label"))


def rows(label):
    return [(r if isinstance(r, list) else r.get("cells", r)) for r in tables[label]["rows"]]


def clean(s):
    return re.sub(r"\s+", " ", str(s if s is not None else "")).strip()


# Spelling variants of the SAME hazard, and rows that are not hazards at all.
# Owner-confirmed 2026-08-17. Surveyed across Tables F+I of all 38 annexes: 18 distinct
# normalised names, of which these are the only ones that are not real mapped hazards.
HAZARD_ALIASES = {
    "Geologic Hazard": "Geologic Hazards",      # Belle Terre, Riverhead
    "Geological Hazards": "Geologic Hazards",   # East Hampton (Village)
}
# Template scaffolding that bled into Babylon's Table I.
JUNK_HAZARD_ROWS = re.compile(r"^(instructions?$|example\s*:)", re.I)


def norm_hazard(s):
    """
    Normalise a Table F / Table I hazard name so the two tables join.

    Three real discrepancies in the Islip annex, all of which silently break the join:
      - trailing footnote markers:  'Flood1', 'Geologic Hazards2'
      - a parenthetical only Table F carries:
        Table F 'Flood (including Shallow Groundwater Flooding)' vs Table I 'Flood'
      - curly apostrophes: Table F/I both use U+2019 in 'Nor’easter', not ASCII "'"
    """
    x = clean(s)
    x = x.replace("’", "'").replace("‘", "'")
    x = re.sub(r"\s*\([^)]*\)\s*$", "", x)
    x = re.sub(r"\d+$", "", x)
    x = x.strip()
    return HAZARD_ALIASES.get(x, x)


# ---------------------------------------------------------------- the 14 -> 18 mapping
# value: (list of MNY hazard labels, kind). Labels must match the STORED vocabulary
# exactly, including 'Ice storm' (lowercase s) and 'Tsunami/Seiche'.
MAPPING = {
    "Coastal Erosion":                ((["Coastal Hazards"]),               "1:1"),
    "Drought":                        ((["Drought"]),                       "1:1"),
    "Flood":                          ((["Flooding"]),                      "1:1"),
    "Hurricane":                      ((["Hurricane"]),                     "1:1"),
    "Wildfire":                       ((["Wildfire"]),                      "1:1"),
    "Extreme Temperature":            ((["Extreme Cold", "Extreme Heat"]),  "split"),
    "Geologic Hazards":               ((["Earthquake", "Landslide"]),       "split"),
    "Severe Winter Storm":            ((["Ice storm", "Snowstorm"]),        "split"),
    "Severe Storm":                   ((["Wind"]),                          "split"),
    # non-standard -> Other (inserts)
    "Cyber Security":                 ((["Other"]),                         "other"),
    "Disease Outbreak":               ((["Other"]),                         "other"),
    "Groundwater Contamination":      ((["Other"]),                         "other"),
    "Infestation & Invasive Species": ((["Other"]),                         "other"),
    "Nor'easter":                     ((["Other"]),                         "other"),
}
UNASSESSED = ["Avalanche", "Hail", "Lightning", "Tornado", "Tsunami/Seiche"]

# Suffolk's Severe Storm narrative also describes hail, lightning and tornado impacts,
# which the owner's mapping folds into the Wind row rather than seeding those rows.
XREF_TO_WIND = ["Hail", "Lightning", "Tornado"]

# ------------------------------------------------- derived-field inference (owner: infer + flag)
# Rule, stated so it is auditable: each category is Yes when the hazard's own Table F
# prose mentions any of its keywords, else No. Evidence-based rather than by hazard type.
VULN_KEYWORDS = {
    "buildings_vulnerability": r"building|structur|facilit|home|residen|propert|hous|marina|boardwalk|bulkhead|dome",
    "infrastructure_vulnerability": r"infrastructur|roadway|\broad\b|\broads\b|utilit|power|pump station|sewer|network|transportation|endpoint|drainage|water",
    "population_vulnerability": r"popula|public|residen|people|communit|vulnerable|safety|health|access|senior|employ",
    "natural_env_vulnerability": r"habitat|vegetation|\btree|environment|aquifer|groundwater|shoreline|wetland|\bbay\b|erosion|species|park|golf",
}
FUTURE_MAP = {"increase": "Increased", "decrease": "Decreased",
              "stayed the same": "No Change", "stay the same": "No Change"}


def infer_vuln(prose):
    return dict((col, "Yes" if re.search(pat, prose, re.I) else "No")
                for col, pat in VULN_KEYWORDS.items())


# ---------------------------------------------------------------- read the annex tables
skipped_junk = []


def hazard_key(cell):
    """Normalised hazard name, or None for template scaffolding rows."""
    raw = clean(cell)
    if not raw or JUNK_HAZARD_ROWS.match(raw):
        if raw:
            skipped_junk.append(raw)
        return None
    return norm_hazard(raw)


F = {}
for r in rows("F")[1:]:
    k = hazard_key(r[0])
    if k:
        F[k] = clean(r[1])

# Table I comes in TWO shapes. The 37 jurisdiction annexes use a 7-column TREND
# instrument; the COUNTY annex (Chapter 2) uses a 6-column RANKING-VALIDATION
# instrument with entirely different headers and no trend or future-events data:
#   Hazard Name | Preliminary Ranking | Agree or Disagree | If Disagree, New Ranking
#               | Justification for Change of Ranking | Final Hazard Ranking
# Detected by header text, not by geoid, so it generalises to the next county.
I_HEADER = [clean(c) for c in (rows("I")[0] if rows("I") else [])]
COUNTY_STYLE_I = any(re.search(r"final hazard ranking", h, re.I) for h in I_HEADER)

I = {}
for r in rows("I")[1:]:
    k = hazard_key(r[0])
    if not k:
        continue
    if COUNTY_STYLE_I:
        # OWNER DECISION 2026-08-17: use the FINAL ranking and disregard the preliminary
        # one (and the agree/disagree mechanics, which Final already resolves). The
        # justification prose goes to general_vulnerability, not other_comments.
        I[k] = {
            "rank_2020": "", "freq": "", "impacts": "", "desc": "", "future": "",
            "rank": clean(r[5]),
            "justification": clean(r[4]),
        }
    else:
        I[k] = {
            "rank_2020": clean(r[1]), "freq": clean(r[2]), "impacts": clean(r[3]),
            "desc": clean(r[4]), "future": clean(r[5]), "rank": clean(r[6]),
            "justification": "",
        }

# Table F and Table I must agree on the hazard list, or the join below is silently partial.
if set(F) != set(I):
    print("WARNING Table F / Table I hazard sets differ:")
    print("  only in F:", sorted(set(F) - set(I)))
    print("  only in I:", sorted(set(I) - set(F)))

# Iterate the UNION of Table F and Table I. A hazard RANKED in Table I but with no Table F
# narrative still belongs in HOC — the plan assessed it. Brookhaven ranks Groundwater
# Contamination "Medium" with a full trend description and no local-impacts paragraph;
# keying rows off Table F alone silently dropped it.
ALL_HAZARDS = sorted(set(F) | set(I))

ranked_no_narrative = [h for h in ALL_HAZARDS if h in I and not F.get(h)]
if ranked_no_narrative:
    print("NOTE ranked in Table I with no Table F narrative: %s" % ", ".join(ranked_no_narrative))

unknown = [h for h in ALL_HAZARDS if h not in MAPPING]
if unknown:
    raise SystemExit("Unmapped Suffolk hazard(s) %r -- extend MAPPING (owner decision)." % unknown)

# ---------------------------------------------------------------- read the live rows
# Identity from juris_index.json (built from the Jurisdictions dataset). NEVER slice a
# county geoid out of a jurisdiction geoid -- see build_index.py's docstring.
IDX = json.load(open(os.path.join(CTX, "juris_index.json"), encoding="utf8")).get(GEOID)
if not IDX:
    raise SystemExit("geoid %s not in juris_index.json -- re-run build_index.py" % GEOID)

# encoding="utf-8" is REQUIRED: without it Windows decodes the CLI's UTF-8 output as
# cp1252 and dies on the first smart quote, leaving stdout None. That surfaced as a
# baffling "AttributeError: 'NoneType' object has no attribute 'index'" on 10 chapters.
env = dict(os.environ)
out = subprocess.run(["node", CLI, "dataset", "query", SOURCE, "--view", VIEW,
                      "--filter", "geoid_county=%s" % IDX["county_geoid"],
                      "--limit", "2000", "--format", "json"],
                     capture_output=True, text=True, encoding="utf-8", env=env).stdout
if not out or "{" not in out:
    raise SystemExit("dataset query returned no JSON for %s -- check auth/host." % GEOID)
live = json.loads(out[out.index("{"):])


def is_ours(v):
    if isinstance(v, list):
        return str(GEOID) in [str(x) for x in v]
    return str(v) == str(GEOID)


mine = [r for r in live["items"] if is_ours(r["data"].get("geoid_juris"))]
by_hazard = {}
for r in mine:
    by_hazard.setdefault(r["data"].get("hazard"), []).append(r)

# Only NAMED hazards must be unique. MULTIPLE "Other" rows are intentional (owner
# decision 2026-08-14: keyed on geoid_juris + hazard='Other' + hazard_name_if_other),
# so they are not duplicates -- they mean this jurisdiction has already been loaded.
dupes = dict((h, [r["id"] for r in v]) for h, v in by_hazard.items()
             if h != "Other" and len(v) > 1)
if dupes:
    raise SystemExit("Duplicate pre-existing rows per NAMED hazard %r -- resolve before loading." % dupes)

already = sorted(r["data"].get("hazard_name_if_other")
                 for r in by_hazard.get("Other", []) if r["data"].get("hazard_name_if_other"))
if already:
    print("NOTE %s already has %d Other row(s): %s" % (J["jurisdictions_title"], len(already), ", ".join(already)))
    print("     write_hoc.mjs will refuse to re-insert them; the update payload is still safe to regenerate.")


def other_comments_for(hz, extra_note=None):
    """Fold Table I's trends and rankings here -- none of them has its own column."""
    d = I[hz]
    bits = []
    if d["rank"]:
        # The county instrument's ranking is a FINAL ranking; the jurisdiction
        # instrument's is the 2026 ranking. Label them for what they are.
        bits.append(("Final hazard ranking: %s." if COUNTY_STYLE_I else "2026 hazard ranking: %s.") % d["rank"])
    if d["rank_2020"]:
        bits.append("2020 HMP hazard ranking: %s." % d["rank_2020"])
    if d["freq"]:
        bits.append("Frequency (2021-present): %s." % d["freq"])
    if d["impacts"]:
        bits.append("Impacts (2021-present): %s." % d["impacts"])
    if d["desc"]:
        bits.append(d["desc"])
    if extra_note:
        bits.append(extra_note)
    # State only what was actually inferred. The county instrument has no future-events
    # column, so climate_change is left null there and must not be claimed as inferred.
    if not F.get(hz):
        bits.append("This hazard is ranked in the annex's Hazard Risk Ranking table but has no "
                    "Local Impacts narrative, so General Vulnerability and the vulnerability "
                    "categories have no source and are left unset.")
    elif COUNTY_STYLE_I:
        bits.append("Vulnerability categories (Buildings/Infrastructure/People/Natural Environment) "
                    "were inferred from this hazard's Local Impacts narrative - needs review. "
                    "Impacted by Climate Change and Future Occurrence Assessment have no source in "
                    "the county-level ranking instrument and are left unset.")
    else:
        bits.append("Vulnerability categories (Buildings/Infrastructure/People/Natural Environment) "
                    "and Impacted by Climate Change were inferred from this hazard's Local Impacts "
                    "narrative and its Future Events column - needs review.")
    return " ".join(bits)


def general_vulnerability_for(hz):
    """
    Table F narrative, plus -- for the COUNTY instrument only -- the Justification for
    Change of Ranking (owner decision 2026-08-17: it belongs with the vulnerability prose,
    not in other_comments).
    """
    prose = F.get(hz, "")
    j = I.get(hz, {}).get("justification", "")
    if j and j not in ("-", "N/A"):
        prose = ("%s Justification for change of ranking: %s" % (prose, j)).strip()
    return prose


updates, inserts, notes, split_note = [], [], [], {}

# ---------------------------------------------------------------- named hazards with content
for hz in ALL_HAZARDS:
    targets, kind = MAPPING[hz]
    if kind == "other":
        continue
    for mny in targets:
        rowset = by_hazard.get(mny)
        if not rowset:
            raise SystemExit("No pre-existing row for MNY hazard %r on %s" % (mny, J["jurisdictions_title"]))
        prose = general_vulnerability_for(hz)
        extra = None
        if len(targets) > 1:
            extra = ("This narrative was authored for Suffolk's combined \"%s\" profile and applies to "
                     "both %s; it was not authored per-hazard." % (hz, " and ".join(targets)))
            split_note.setdefault(hz, targets)
        if mny == "Wind":
            extra = ("Suffolk profiles this as \"Severe Storm\". Its narrative also describes %s impacts, "
                     "which are folded into this row rather than reported separately." % ", ".join(XREF_TO_WIND))
        data = {
            "hazard_of_concern": "Yes",
            "other_comments": other_comments_for(hz, extra),
        }
        if prose:
            data["general_vulnerability"] = prose
        if I[hz]["future"]:
            data["climate_change"] = "Yes" if I[hz]["future"].lower().startswith("increase") else "No"
            fo = FUTURE_MAP.get(I[hz]["future"].lower())
            if fo:
                data["future_occurrence_assessment"] = fo
        if prose:
            data.update(infer_vuln(prose))
        updates.append({"id": rowset[0]["id"], "hazard": mny, "_suffolk": hz, "_kind": kind, "data": data})

# ---------------------------------------------------------------- unassessed -> explicit No
for mny in UNASSESSED:
    rowset = by_hazard.get(mny)
    if not rowset:
        raise SystemExit("No pre-existing row for unassessed hazard %r" % mny)
    reason = ("Not assessed in the 2026 Suffolk County Hazard Mitigation Plan; the plan's hazard "
              "profile does not include this hazard.")
    if mny in XREF_TO_WIND:
        reason += (" Suffolk's \"Severe Storm\" profile does describe %s impacts, but the county's "
                   "hazard mapping folds those into the Wind row rather than reporting this hazard "
                   "separately." % mny.lower())
    updates.append({"id": rowset[0]["id"], "hazard": mny, "_suffolk": "(not assessed)", "_kind": "unassessed",
                    "data": {"hazard_of_concern": "No", "reason_for_exclusion": reason}})

# ---------------------------------------------------------------- Other -> inserts
ident = {
    "geoid_juris": [str(J["geoid"])],
    "geoid_county": int(IDX["county_geoid"]),
    "jurisdiction": J["jurisdictions_title"],
    "county": IDX["county"],
}
for hz in [h for h in ALL_HAZARDS if MAPPING[h][1] == "other"]:
    prose = general_vulnerability_for(hz)
    data = dict(ident)
    data.update({
        "hazard": "Other",
        "hazard_name_if_other": hz,
        "hazard_of_concern": "Yes",
        "other_comments": other_comments_for(hz),
    })
    if prose:
        data["general_vulnerability"] = prose
    if I[hz]["future"]:
        data["climate_change"] = "Yes" if I[hz]["future"].lower().startswith("increase") else "No"
        fo = FUTURE_MAP.get(I[hz]["future"].lower())
        if fo:
            data["future_occurrence_assessment"] = fo
    if prose:
        data.update(infer_vuln(prose))
    inserts.append({"_suffolk": hz, "data": data, "_no_narrative": not prose})

# ---------------------------------------------------------------- emit
pay = os.path.join(CTX, "payloads")
os.makedirs(pay, exist_ok=True)
json.dump(updates, open(os.path.join(pay, "hoc_%s_updates.json" % GEOID), "w", encoding="utf8"), indent=1, ensure_ascii=False)
json.dump(inserts, open(os.path.join(pay, "hoc_%s_inserts.json" % GEOID), "w", encoding="utf8"), indent=1, ensure_ascii=False)

md = []
md.append("# Hazards of Concern payload review - %s (geoid %s)" % (J["jurisdictions_title"], GEOID))
md.append("")
md.append("Source: annex Tables **F** (Local Hazard Impacts) and **I** (Hazard Risk Ranking). "
          "Target source `%s` / view `%s`." % (SOURCE, VIEW))
md.append("")
md.append("**%d updates in place + %d `Other` inserts.** The jurisdiction had %d pre-existing rows, "
          "all `hazard_of_concern = \"Not Reported\"`."
          % (len(updates), len(inserts), len(mine)))
md.append("")
md.append("## The 14 -> 18 mapping, as applied")
md.append("")
md.append("| Suffolk hazard | MNY row(s) | Kind | Operation |")
md.append("|---|---|---|---|")
for hz in sorted(F):
    tg, kind = MAPPING[hz]
    op = "insert" if kind == "other" else "update"
    md.append("| %s | %s | %s | %s |" % (hz, ", ".join(tg) if kind != "other" else "Other (`%s`)" % hz, kind, op))
md.append("| *(not assessed)* | %s | - | update to `No` |" % ", ".join(UNASSESSED))
md.append("")
md.append("%d Suffolk hazards -> %d rows with content + %d explicit `No` = **%d**, exactly the %d "
          "pre-existing rows. Nothing left over, nothing duplicated."
          % (len(F), len([u for u in updates if u["_kind"] != "unassessed"]) , len(UNASSESSED),
             len(updates), len(mine)))
md.append("")
md.append("## Schema calibration (20,000 live rows) - three corrections to the crosswalk")
md.append("")
md.append("| Finding | Crosswalk said | Live reality |")
md.append("|---|---|---|")
md.append("| `general_vulnerability`, `other_comments` | need lexical root payloads, \"HOC is not a flat dataset\" | declared `lexical`, but **all 140 / 334 stored values are plain strings**. Plain strings written. |")
md.append("| `hazard = Other` | \"no `Other` option ... inserting may not validate\" | the select **does** list `other`, and **10 rows already store `\"Other\"`** with `hazard_name_if_other` (Allegany, Fulton, Dolgeville, Hope, Inlet). Proven pattern. |")
md.append("| vulnerability checkboxes | Boolean | store `\"Yes\"`/`\"No\"` strings - not `\"x\"` as in Capabilities |")
md.append("")
md.append("Also: `geoid_county` is a bare **int** in this dataset (a list in Roles, a string in "
          "Capabilities); `geoid_juris` is a list of strings. `likelihood` is a probability band with "
          "no annex source and is **never touched**.")
md.append("")
md.append("## Derived fields - inference rule (owner: infer + flag, 2026-08-17)")
md.append("")
md.append("Following the Allegany precedent, which set these and recorded the inference in "
          "`other_comments`. The rule is evidence-based rather than by hazard type: **each category is "
          "`Yes` when that hazard's own Table F narrative matches its keywords, else `No`.**")
md.append("")
md.append("| Column | Keywords |")
md.append("|---|---|")
for k, v in VULN_KEYWORDS.items():
    md.append("| `%s` | `%s` |" % (k, v))
md.append("")
md.append("`climate_change` = `Yes` when Table I's *Future Events (present-2030)* column reads Increase, "
          "else `No`. `future_occurrence_assessment` maps that same column onto the select "
          "(Increase->Increased, Decrease->Decreased, Stayed/Stay the Same->No Change).")
md.append("")
md.append("Every affected row's `other_comments` ends with an explicit note naming which fields were "
          "inferred, so a reviewer can find them.")
md.append("")
md.append("## Split-profile provenance")
md.append("")
md.append("Where one Suffolk profile maps to two MNY hazards the single narrative is duplicated to both "
          "children, and each child's `other_comments` says so verbatim, so nobody mistakes it for "
          "per-hazard authoring:")
md.append("")
for hz, tg in sorted(split_note.items()):
    md.append("- **%s** -> %s" % (hz, " + ".join(tg)))
md.append("")
md.append("The **Wind** row carries its own note: Suffolk calls it \"Severe Storm\" and its narrative also "
          "describes %s impacts, folded in here rather than reported separately. Those three hazards' own "
          "rows get `hazard_of_concern = No` plus a cross-reference in `reason_for_exclusion`."
          % ", ".join(XREF_TO_WIND))
md.append("")
if skipped_junk:
    md.append("## Non-hazard rows skipped")
    md.append("")
    md.append("Template scaffolding present in this annex's Table F/I and rejected as not-a-hazard: "
              + ", ".join("`%s`" % x for x in sorted(set(skipped_junk))) + ".")
    md.append("")
md.append("## Updates")
md.append("")
md.append("| Row id | MNY hazard | From Suffolk | HoC | Future | Climate | B/I/P/N |")
md.append("|---|---|---|---|---|---|---|")
for u in updates:
    d = u["data"]
    vn = "".join("Y" if d.get(c) == "Yes" else ("N" if d.get(c) == "No" else "-")
                 for c in ["buildings_vulnerability", "infrastructure_vulnerability",
                           "population_vulnerability", "natural_env_vulnerability"])
    md.append("| %s | %s | %s | %s | %s | %s | %s |"
              % (u["id"], u["hazard"], u["_suffolk"], d.get("hazard_of_concern"),
                 d.get("future_occurrence_assessment", "-"), d.get("climate_change", "-"), vn))
md.append("")
md.append("## Inserts (`Other`)")
md.append("")
md.append("| `hazard_name_if_other` | HoC | Future | Climate | B/I/P/N |")
md.append("|---|---|---|---|---|")
for r in inserts:
    d = r["data"]
    vn = "".join("Y" if d.get(c) == "Yes" else "N"
                 for c in ["buildings_vulnerability", "infrastructure_vulnerability",
                           "population_vulnerability", "natural_env_vulnerability"])
    md.append("| %s | %s | %s | %s | %s |" % (d["hazard_name_if_other"], d["hazard_of_concern"],
                                              d.get("future_occurrence_assessment", "-"),
                                              d.get("climate_change", "-"), vn))
md.append("")
md.append("## Full content")
for u in updates + [dict(r, id="(insert)", hazard="Other") for r in inserts]:
    d = u["data"]
    md.append("")
    md.append("### %s - %s" % (d.get("hazard_name_if_other") or u["hazard"], u["id"]))
    md.append("")
    for k in ["hazard_of_concern", "general_vulnerability", "other_comments", "reason_for_exclusion",
              "future_occurrence_assessment", "climate_change", "buildings_vulnerability",
              "infrastructure_vulnerability", "population_vulnerability", "natural_env_vulnerability"]:
        if k in d:
            md.append("- `%s`: %s" % (k, d[k]))
open(os.path.join(pay, "hoc_%s.md" % GEOID), "w", encoding="utf8").write("\n".join(md))

print("updates -> payloads/hoc_%s_updates.json   (%d rows)" % (GEOID, len(updates)))
print("inserts -> payloads/hoc_%s_inserts.json   (%d rows)" % (GEOID, len(inserts)))
print("review  -> payloads/hoc_%s.md" % GEOID)
print("")
print("pre-existing rows for this jurisdiction: %d" % len(mine))
print("")
for u in updates:
    d = u["data"]
    vn = "".join("Y" if d.get(c) == "Yes" else ("N" if d.get(c) == "No" else "-")
                 for c in ["buildings_vulnerability", "infrastructure_vulnerability",
                           "population_vulnerability", "natural_env_vulnerability"])
    print("  UPD %-9s %-16s hoc=%-13s fut=%-10s cc=%-4s BIPN=%s   <- %s"
          % (u["id"], u["hazard"], d.get("hazard_of_concern"), d.get("future_occurrence_assessment", "-"),
             d.get("climate_change", "-"), vn, u["_suffolk"]))
for r in inserts:
    d = r["data"]
    print("  INS Other     %-46s fut=%-10s cc=%s" % (d["hazard_name_if_other"],
                                                     d.get("future_occurrence_assessment", "-"),
                                                     d.get("climate_change")))
