"""
Phase 7a - build the Participation insert payloads for Nassau.

ROW MODEL: one row per (jurisdiction, meeting attended). `geoid_juris` is never multi-valued
(owner, 2026-08-21), so a meeting with 51 attendees is 51 rows, not one row with 51 geoids.

  243 attendance marks  -> 243 jurisdiction rows
  + 2 county-level rows -> the Stakeholder Webinar and the Public Meeting/Webinar, the two
                           events with no per-jurisdiction attendance column because they
                           were not jurisdiction-attended
  = 245 rows

That is 245 rather than the 254 first projected: the earlier figure added all 11 narrative
meetings on top of the 243 marks, which would have double-counted the nine that the matrix
already covers -- Nassau County itself appears in the matrix as a jurisdiction.

TWO VOCABULARY MISMATCHES, both explicit maps rather than fuzzy matching:
  - the attendance matrix has 7 column names, and none of them is spelled the way the
    narrative spells the same meeting ("Core Planning Group Kickoff" vs "Core Planning Group
    Kick-Off Meeting", "Jurisdiction" vs "Jurisdictional Consultation Calls")
  - 9 distinct meeting names occupy 11 narrative rows, because two meetings ran over two
    dates each

SPLIT MEETINGS. The Pre-Workshop Webinar ran 19 + 20 Feb and the Consultation Calls ran
25 Jun - 16 Jul. The matrix has ONE column for each, so it records that a jurisdiction
attended the event, NOT which date. Emitting two rows per jurisdiction would assert
attendance on both days, which the source does not say -- so each attendee gets ONE row
carrying the first date, with `meeting_unique_id` tying the pair together and the date range
stated in the narrative.

STORAGE. `narrative` and `agenda_minutes` are declared `lexical` but stored as PLAIN STRINGS
(measured during the Suffolk load). `geoid_juris` is a bare scalar in this dataset.

`format` IS derivable for Nassau, unlike Suffolk -- every narrative states in-person vs
webinar vs phone conference. `duration` and `invite_method` remain unsourced; Appendix A
(49 MB, PDF-only, unexamined) is the likely home for both.

OUTPUTS  payloads/part_<geoid>.json    [{data, _row}]
         payloads/_part_summary.json

Usage: python build_participation.py
"""
import json, io, os, sys, csv, re, collections

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import mny_schema as S
from build_roles import norm_place

CTX = os.path.dirname(HERE)
EX = os.path.join(CTX, "extracted")
OUT = os.path.join(CTX, "payloads")
COUNTY_GEOID = "36059"

# attendance-matrix column -> the narrative meeting name it refers to. Explicit because no
# column is spelled the way the narrative spells it.
COLUMN_TO_MEETING = {
    "Core Planning Group Kickoff":                    "Core Planning Group Kick-Off Meeting",
    "Planning Committee Pre-Workshop Webinar":         "Planning Committee Pre-Workshop Webinar",
    "Planning Committee Workshop":                     "Planning Committee Workshop",
    "Risk Review and Mitigation Webinar":              "Risk Review and Mitigation Strategy Webinar",
    "Jurisdiction Consultation Calls":                 "Jurisdictional Consultation Calls",
    "Planning Committee Mitigation Strategy Webinar":  "Planning Committee Mitigation Strategy Review Webinar",
    "Planning Committee Plan Review Webinar":          "Planning Committee Review Webinar",
}
# Meetings with no attendance column -- county-level events, one row each.
COUNTY_ONLY = ["Stakeholder Webinar", "Public Meeting/ Webinar"]

# Derived from each narrative's own wording; the live vocabulary is Virtual|In-Person|Phone Call.
FORMAT_RULES = [
    (r"phone con|conference call|one-hour phone", "Phone Call"),
    (r"in-person", "In-Person"),
    (r"webinar", "Virtual"),
]


def fmt_of(m):
    blob = (m.get("meeting_name", "") + " " + (m.get("narrative") or "")).lower()
    for pat, val in FORMAT_RULES:
        if re.search(pat, blob):
            return val
    return None


def main():
    os.makedirs(OUT, exist_ok=True)
    b = json.load(io.open(os.path.join(EX, "baseplan.json"), encoding="utf-8"))
    A = list(csv.DictReader(io.open(os.path.join(CTX, "nassau-jurisdiction-aliases.csv"),
                                    encoding="utf-8-sig")))
    by_place, juris_of = {}, {}
    for r in A:
        by_place[norm_place(r["jurisdiction_title"])] = r["geoid"]
        by_place[norm_place(r["municipality_name"] + " " + (r["municipality_type"] or ""))] = r["geoid"]
        juris_of[r["geoid"]] = r["jurisdiction_title"]

    # meeting name -> its narrative rows (1, or 2 for a split meeting), earliest first
    by_name = collections.defaultdict(list)
    for m in b["meetings"]:
        by_name[m["meeting_name"]].append(m)
    for v in by_name.values():
        v.sort(key=lambda m: m["date"])

    errs, notes = [], []
    rows = collections.defaultdict(list)

    def add(geoid, meeting_name, mrows, why):
        first = mrows[0]
        split = len(mrows) > 1
        dates = [m["date"] for m in mrows]
        uid = re.sub(r"[^a-z0-9]+", "_", meeting_name.lower()).strip("_")
        narrative = (first.get("narrative") or "").strip()
        if split:
            narrative += (f" (This event ran over {len(mrows)} dates: "
                          f"{', '.join(dates)}. The county's attendance matrix records "
                          f"attendance at the event but not which date, so one row is "
                          f"created carrying the first date.)")
        d = {
            "meeting_name": meeting_name,
            "date": first["date"],
            "narrative": narrative or None,
            "format": [fmt_of(first)] if fmt_of(first) else None,
            "participation": why,
            "meeting_unique_id": uid,
            "county": "Nassau",
            "geoid_county": [COUNTY_GEOID],
            "geoid_juris": geoid,          # scalar in this dataset
            "jurisdiction": juris_of.get(geoid, ""),
        }
        d = {k: v for k, v in d.items() if v not in (None, "", [])}
        errs.extend(S.validate("participation", d, f"{geoid}/{meeting_name[:30]}"))
        rows[geoid].append({"data": d, "_meeting": meeting_name})

    # ------------------------------------------------------ 243 jurisdiction-meeting rows
    seen = set()
    for i, a in enumerate(b["attendance"]):
        col, lab = a["meeting_column"], a["jurisdiction_label"]
        name = COLUMN_TO_MEETING.get(col)
        if not name:
            errs.append(f"attendance column {col!r} has no narrative meeting")
            continue
        g = by_place.get(norm_place(lab))
        if not g:
            errs.append(f"attendance label {lab!r} did not match a jurisdiction")
            continue
        if (g, name) in seen:
            notes.append(f"{g}: duplicate mark for {name!r} -- second occurrence skipped")
            continue
        seen.add((g, name))
        add(g, name, by_name[name], f"Attended, per the county's attendance matrix "
                                    f"(column “{col}”).")

    # ------------------------------------------------------------- 2 county-level events
    for name in COUNTY_ONLY:
        if name not in by_name:
            errs.append(f"county-only meeting {name!r} not found in the narrative")
            continue
        add(COUNTY_GEOID, name, by_name[name],
            "County-level event with no per-jurisdiction attendance column in the plan.")

    total = 0
    for g, rs in sorted(rows.items()):
        json.dump(rs, io.open(os.path.join(OUT, f"part_{g}.json"), "w", encoding="utf-8"),
                  ensure_ascii=False, indent=1)
        total += len(rs)

    unfilled = collections.Counter()
    for rs in rows.values():
        for r in rs:
            for k in ("duration", "invite_method", "agenda_minutes"):
                if k not in r["data"]:
                    unfilled[k] += 1

    json.dump(dict(rows=total, jurisdictions=len(rows), errors=errs, notes=notes,
                   unsourced_fields=dict(unfilled),
                   per_jurisdiction=[dict(geoid=g, rows=len(rs)) for g, rs in sorted(rows.items())]),
              io.open(os.path.join(OUT, "_part_summary.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)

    print(f"Participation: {total} insert rows across {len(rows)} jurisdictions")
    print(f"     expected 243 attendance marks + 2 county-level events = 245")
    print(f"     {len(errs)} error(s), {len(notes)} note(s)")
    for k, v in unfilled.items():
        print(f"     unsourced: {k} empty on {v}/{total}")
    for e in errs[:8]:
        print("  ERR ", e)
    return 1 if errs else 0


if __name__ == "__main__":
    sys.exit(main())
