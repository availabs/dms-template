"""
Step 4: build Participation rows for one jurisdiction.

SOURCE IS NOT THE ANNEX. The annex names participation *types* per contributor, with no
dates. The only dated record of who attended what is the attendance matrix in
Volume III Appendix B ("Volume III - Suffolk Appendices_Public.docx", table 0, 144x13):
    cols 0-3  Jurisdiction / First Name / Last Name / Title-Role
    cols 4-12 one column per meeting, "X" marking attendance
The flattened text of that table is USELESS -- an "X" cannot be tied to its meeting
column -- so this walks the real docx cells via python-docx.

Emits payloads/part_<geoid>.json and .md   (writes nothing to the database)

Schema calibration against the 216 live rows (see the .md):
  - geoid_juris  -> bare STRING (40/40 most recent); geoid_county -> ARRAY. Inconsistent
    but that is the convention.
  - narrative / agenda_minutes are declared `lexical` but stored as PLAIN STRINGS
    (209/212 and 183/184). Plain strings here, unlike Jurisdictions and HOC.
  - `date`: the 40 most recent rows hold EXCEL SERIAL INTEGERS (46133 = 2026-04-21), an
    import artifact of the Westchester load. We write ISO strings, matching the column's
    declared `date` type and the 65 older rows.
  - duration / format / invite_method: NOT stated anywhere in the source -> left null
    rather than invented, even though 185/216 live rows have them.
  - `roles` is unused across all 216 rows -> left null.
  - `milestones` (34/216) would require inferring what attendance implies -> left null.

Usage: python build_participation.py [geoid]
"""
import json, glob, os, re, sys, datetime
import docx

HERE = os.path.dirname(os.path.abspath(__file__))
CTX = os.path.dirname(HERE)
SUFFOLK = os.path.dirname(CTX)
GEOID = sys.argv[1] if len(sys.argv) > 1 else "3610338000"

annex_dir = os.path.join(CTX, "extracted", "annexes")
af = [f for f in os.listdir(annex_dir) if f.startswith(GEOID + "_")][0]
A = json.load(open(os.path.join(annex_dir, af), encoding="utf8"))
J = A["jurisdiction"]

# Appendix B label for this jurisdiction. "Islip (Town)" -> "Islip, Town of".
# NOTE for the full 38-annex run: this transform will not hold for every name
# (e.g. "Village of the Branch"). Add an `appendix_b_label` column to
# suffolk-jurisdiction-aliases.csv rather than extending these heuristics.
OVERRIDES = {
    "3677519": "Branch, Village of the",
    "3610367059": "Shinnecock Tribal Nation",
    "3610390001": "Suffolk County Water Authority",
    "36103": "Suffolk County",
}


def appendix_label():
    if GEOID in OVERRIDES:
        return OVERRIDES[GEOID]
    m = re.match(r"^(.*?)\s*\((.*?)\)\s*$", J["jurisdictions_title"])
    return "%s, %s of" % (m.group(1), m.group(2)) if m else J["jurisdictions_title"]


LABEL = appendix_label()

# Meeting metadata. Expansions verified against Volume I:
#   line 42857 "A mitigation strategy workshop was conducted on April 15th and April
#   16th, 2026" -> MSW = Mitigation Strategy Workshop, dates match the header exactly.
#   line 1075 "Planning Partnership risk assessment meeting" -> PP / RA / SC confirmed.
#   CPT and GIS Kickoff are NOT defined anywhere in Volumes I or III -- unresolved, but
#   Islip attended neither. Resolve before loading a jurisdiction that did.
MEETINGS = {
    "CPT Kickoff": ("CPT Kickoff",
                    "Core planning team kickoff meeting. NOTE: 'CPT' is not expanded anywhere in Volumes I or III."),
    "GIS Kickoff": ("GIS Kickoff",
                    "GIS kickoff meeting. NOTE: not described in Volumes I or III."),
    "PP Kickoff": ("Planning Partnership Kick Off",
                   "Planning Partnership kickoff meeting."),
    "SC Kickoff": ("Steering Committee Kick Off",
                   "Steering Committee kickoff meeting."),
    "RA": ("Risk Assessment Meeting",
           "Planning Partnership risk assessment meeting."),
    "MSW": ("Mitigation Strategy Workshop",
            "Mitigation strategy workshop to develop focused problem statements based on "
            "the impacts of natural hazards in the County and their communities."),
    "Draft Plan": ("Draft Plan Review",
                   "Draft plan review meeting."),
}


def parse_header(h):
    """'MSW (4.15.26' -> ('MSW', '2026-04-15'). Header col 9 is missing its close paren."""
    m = re.match(r"^\s*(.*?)\s*\(\s*([\d.]+)\s*\)?\s*$", h)
    key, ds = m.group(1).strip(), m.group(2).strip(".")
    mm, dd, yy = ds.split(".")
    yy = int(yy)
    yy = yy + 2000 if yy < 100 else yy
    return key, datetime.date(yy, int(mm), int(dd)).isoformat()


doc_path = glob.glob(os.path.join(SUFFOLK, "Suffolk-JAs", "Volume III - Appendices", "*Public.docx"))[0]
T = docx.Document(doc_path).tables[0]
hdr = [c.text.strip().replace("\n", " ") for c in T.rows[0].cells]

meeting_cols = []
for ci in range(4, len(hdr)):
    key, iso = parse_header(hdr[ci])
    name, narrative = MEETINGS[key]
    meeting_cols.append({
        "col": ci, "label": hdr[ci], "key": key, "date": iso,
        "name": name, "narrative": narrative,
        # Shared across all jurisdictions so every annex references the same meeting.
        "uid": "Suffolk2026%03d" % (ci - 3),
    })

# Attendance for this jurisdiction
people = []
for r in T.rows[1:]:
    c = [x.text.strip().replace("\n", " ") for x in r.cells]
    if c[0].strip().lower() != LABEL.lower():
        continue
    people.append({
        "name": ("%s %s" % (c[1], c[2])).strip(), "title": c[3],
        "at": dict((m["col"], bool(c[m["col"]].strip())) for m in meeting_cols),
    })
# Jurisdictions CONFIRMED (owner, 2026-08-17) to have no Appendix B attendance record at
# all -- not a label-matching failure. Verified by searching the matrix for their names:
# neither appears in any form. Huntington Bay IS listed in Volume I's Table 22 planning
# partnership, so it joined the partnership but attended none of the nine tracked meetings.
# This is a WHITELIST, deliberately: any OTHER unmatched label still fails loudly, because
# that would mean the label transform is broken rather than the attendance genuinely absent.
NO_ATTENDANCE_RECORD = {
    "3637022": "Huntington Bay (Village)",
    "3677519": "Village of the Branch (Village)",
}
if not people:
    if GEOID in NO_ATTENDANCE_RECORD:
        print("%s has NO Appendix B attendance record (owner-confirmed 2026-08-17)."
              % NO_ATTENDANCE_RECORD[GEOID])
        print("  -> 0 Participation rows. Writing an empty payload so the batch can continue.")
        os.makedirs(os.path.join(CTX, "payloads"), exist_ok=True)
        with open(os.path.join(CTX, "payloads", "part_%s.json" % GEOID), "w", encoding="utf8") as fh:
            json.dump([], fh)
        md0 = [
            "# Participation payload review - %s (geoid %s)" % (J["jurisdictions_title"], GEOID),
            "",
            "**No rows.** This jurisdiction has no attendance record anywhere in the",
            "Volume III Appendix B matrix - it appears under no label in any form.",
            "Owner-confirmed 2026-08-17: create no Participation rows.",
            "",
            "Note Huntington Bay is listed in Volume I Table 22 (Planning Partnership), so",
            "absence here means it attended none of the nine tracked meetings, not that it",
            "did not participate in the plan.",
        ]
        with open(os.path.join(CTX, "payloads", "part_%s.md" % GEOID), "w", encoding="utf8") as fh:
            fh.write("\n".join(md0))
        raise SystemExit(0)
    raise SystemExit("No Appendix B rows matched jurisdiction label %r -- check the label transform. "
                     "If this jurisdiction genuinely has no attendance record, add it to "
                     "NO_ATTENDANCE_RECORD." % LABEL)

# Identity from juris_index.json (built from the Jurisdictions dataset). NEVER slice a
# county geoid out of a jurisdiction geoid: NY village geoids are 7 digits (36 + a
# 5-digit place code), so Amityville 3602044 slices to '36020', not '36103'.
IDX = json.load(open(os.path.join(CTX, "juris_index.json"), encoding="utf8")).get(GEOID)
if not IDX:
    raise SystemExit("geoid %s not in juris_index.json -- re-run build_index.py" % GEOID)

ident = {
    "geoid_juris": str(J["geoid"]),
    "geoid_county": [IDX["county_geoid"]],
    "jurisdiction": J["jurisdictions_title"],
    "county": IDX["county"],
}

out, skipped = [], []
for m in meeting_cols:
    att = [p for p in people if p["at"][m["col"]]]
    if not att:
        skipped.append(m)
        continue
    roster = "; ".join(("%s (%s)" % (p["name"], p["title"])) if p["title"] else p["name"] for p in att)
    data = dict(ident)
    data.update({
        "meeting_name": m["name"],
        "date": m["date"],
        "meeting_unique_id": m["uid"],
        "narrative": m["narrative"],
        "agenda_minutes": "Attendance (%s): %s" % (J["jurisdictions_title"], roster),
    })
    out.append({"_label": m["label"], "_attendees": [p["name"] for p in att], "data": data})

no_show = [p for p in people if not any(p["at"].values())]

os.makedirs(os.path.join(CTX, "payloads"), exist_ok=True)
with open(os.path.join(CTX, "payloads", "part_%s.json" % GEOID), "w", encoding="utf8") as fh:
    json.dump(out, fh, indent=1, ensure_ascii=False)

md = []
md.append("# Participation payload review - %s (geoid %s)" % (J["jurisdictions_title"], GEOID))
md.append("")
md.append("Source: **Volume III Appendix B attendance matrix** (`Volume III - Suffolk Appendices_Public.docx`, "
          "table 0, %dx%d) - *not* the annex. Target source `1473468` / view `1473469`. **%d new rows.**"
          % (len(T.rows), len(hdr), len(out)))
md.append("")
md.append("Appendix B label matched: `%s` -> %d people listed." % (LABEL, len(people)))
md.append("")
md.append("## Meetings")
md.append("")
md.append("| Appendix B column | Expansion | Date | `meeting_unique_id` | Attendees | Row? |")
md.append("|---|---|---|---|---:|---|")
for m in meeting_cols:
    att = [p for p in people if p["at"][m["col"]]]
    md.append("| `%s` | %s | %s | %s | %d | %s |"
              % (m["label"], m["name"], m["date"], m["uid"], len(att), "yes" if att else "- none attended"))
md.append("")
md.append("%s attended **%d of %d** tracked meetings. The %d with no attendance produce no row - a jurisdiction's "
          "absence from a meeting is not something to record as participation."
          % (J["jurisdictions_title"], len(out), len(meeting_cols), len(skipped)))
md.append("")
md.append("## Fields deliberately left null")
md.append("")
md.append("| Column | Live population | Why null |")
md.append("|---|---:|---|")
md.append("| `duration` | 215/216 | Appendix B records attendance only; no meeting lengths in Volumes I or III |")
md.append("| `format` | 185/216 | virtual vs in-person is not stated per meeting |")
md.append("| `invite_method` | 185/216 | not stated |")
md.append("| `milestones` | 34/216 | would require inferring what attendance implies |")
md.append("| `roles` | 0/216 | unused across the entire dataset |")
md.append("")
md.append("## Notes")
md.append("")
md.append("- **`date` is written as an ISO string**, not the Excel serial integer (`46133` = 2026-04-21) carried by "
          "the 40 most recent live rows. Those serials are an import artifact of the Westchester load; the column's "
          "declared type is `date` and 65 older rows use ISO.")
md.append("- **`narrative` is derived from the meeting label plus Volume I**, not authored per-jurisdiction. The MSW "
          "wording is near-verbatim from Volume I line 42857.")
md.append("- **`meeting_unique_id` follows the live `Sullivan2026NNN` pattern** as `Suffolk2026NNN`, numbered by "
          "Appendix B column order, so all 38 annexes reference the same id for the same meeting.")
md.append("- **`meeting_name` reuses live vocabulary where it exists** (`Planning Partnership Kick Off`, "
          "`Risk Assessment Meeting`). `Mitigation Strategy Workshop` is new - the live value is "
          "`Mitigation Strategy Meeting`, but Volume I and the Appendix B header both call it a workshop. "
          "`Steering Committee Kick Off` and `Draft Plan Review` are also new.")
if no_show:
    md.append("- **%d of %d listed people show no attendance mark** in any meeting column: %s. They are on the "
              "roster but attended none of the tracked meetings."
              % (len(no_show), len(people),
                 ", ".join("%s (%s)" % (p["name"], p["title"]) for p in no_show)))
md.append("")
md.append("## Cross-check against the Roles load (step 3)")
md.append("")
md.append("Appendix B and annex Table A disagree on spelling and coverage:")
md.append("")
md.append("| Appendix B | Annex Table A | Note |")
md.append("|---|---|---|")
md.append("| Dominique Mezzapesa | Dominick Mezzapesa | same person, spelling differs |")
md.append("| John Hillebrand | John Hillenbrand | same person, spelling differs |")
md.append("| Michael Andre (Planning) | *absent* | attended PP Kickoff but is not in Table A, so step 3 created "
          "no Roles row for him |")
md.append("")
md.append("## Every row")
for r in out:
    md.append("")
    md.append("### %s - %s  (`%s`)" % (r["data"]["meeting_name"], r["data"]["date"], r["_label"]))
    md.append("")
    for k, v in r["data"].items():
        if k in ("jurisdiction", "county", "geoid_juris", "geoid_county"):
            continue
        md.append("- `%s`: %s" % (k, v))
with open(os.path.join(CTX, "payloads", "part_%s.md" % GEOID), "w", encoding="utf8") as fh:
    fh.write("\n".join(md))

print("payload -> payloads/part_%s.json   (%d rows)" % (GEOID, len(out)))
print("review  -> payloads/part_%s.md" % GEOID)
print("label matched: %r -> %d people" % (LABEL, len(people)))
print("")
for m in meeting_cols:
    att = [p["name"] for p in people if p["at"][m["col"]]]
    mark = ("%d -> ROW" % len(att)) if att else "0 -> skip"
    print("  %-26s %s  %s  %-10s %s" % (m["label"], m["date"], m["uid"], mark, ", ".join(att)))
if no_show:
    print("\non roster but attended nothing: %s" % ", ".join(p["name"] for p in no_show))
