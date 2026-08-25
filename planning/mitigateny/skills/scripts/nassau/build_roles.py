"""
Phase 7a - build the Roles insert payloads for Nassau.

Two sources, merged:
  annex contacts   123  (51 primary + 51 alternate + 21 Freeport committee) -- carry
                        email, phone and address, so they win any dedupe
  base-plan roster 190  (82 organisations) -- carries `core_planning_group`, and is the
                        ONLY source covering the 18 withdrawn villages

Roles is one of two datasets in scope for all 70 jurisdictions, not just the 52 with an
annex: a withdrawn village still sent people to the planning meetings, and the roster is
where that is recorded.

ONE ROW PER PERSON PER ROLE (owner, 2026-08-21). `role` is a SINGLE select live, despite the
workbook calling it multi-select, so a person holding two roles is two rows -- the row entity
is the role, not the person.

TITLE -> ROLE
114 distinct free-text titles map onto a 52-value vocabulary. Ordered keyword rules, first
match wins, most specific first -- 114 hand-written rows would not survive the next county,
whereas the rules mostly will. Every distinct title and the role it received is written to
`roles-title-map-report.csv` so the mapping is reviewed on its OUTPUT rather than on its
regexes, and anything unmatched is reported rather than defaulted silently.

Two defects in the live vocabulary, reported and worked around, not "fixed":
  - `Emergency Management Personnel` is listed TWICE (a duplicate option)
  - `Staekholder - Landowner` is a typo for Stakeholder

OUTPUTS  payloads/roles_<geoid>.json          [{data, _row}]
         payloads/_roles_summary.json
         roles-title-map-report.csv           review surface for the title mapping

Usage: python build_roles.py
"""
import json, io, os, sys, csv, re, collections

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import mny_schema as S

CTX = os.path.dirname(HERE)
EX = os.path.join(CTX, "extracted")
OUT = os.path.join(CTX, "payloads")
COUNTY_GEOID = "36059"

# ------------------------------------------------------------------ title -> role rules
# Ordered; first match wins. Anchored on the words that actually appear in Nassau's titles.
ROLE_RULES = [
    # elected / executive
    (r"^deputy\s+mayor",                    "Elected Official"),
    (r"\bmayor\b",                          "Community Chief Executive Officer - Mayor"),
    (r"village\s+administrator|city\s+manager|^administrator",
                                            "Community Chief Executive Officer - City Manager"),
    (r"county\s+executive",                 "Community Chief Executive Officer - County Executive"),
    (r"county\s+manager",                   "Community Chief Executive Officer - County Manager"),
    (r"\bsupervisor\b",                     "Community Chief Executive Officer - Other"),
    (r"\btrustee\b|councilman|councilwoman|council\s+member",
                                            "Elected Official"),
    # emergency management and responders
    (r"emergency\s+manage|\boem\b|office\s+of\s+emergency",
                                            "Emergency Management Personnel"),
    (r"\bfire\b|fire\s+commissioner",        "First Responder - Fire"),
    (r"police|constable|public\s+safety",   "First Responder - Police"),
    (r"\bems\b|paramedic|medical",          "First Responder - Medical"),
    # technical / professional
    (r"floodplain",                          "Floodplain Administrator"),
    (r"\bnfip\b",                            "NFIP Coordinator"),
    (r"\bcrs\b|community\s+rating",          "Community Rating System (CRS) Coordinator"),
    (r"\bgis\b|geographic\s+information",    "GIS Professional"),
    (r"building\s+inspector|superintendent\s+of\s+building|building\s+official|code\s+enforce",
                                             "Chief Building Official"),
    (r"\bengineer",                          "Civil Engineer"),  # also "Engineering Aide"
    (r"architect",                           "Design Professional - Engineer / Architect"),
    (r"\bsurveyor\b",                        "Land Surveyor"),
    (r"\battorney\b|\bcounsel\b|\blegal\b",  "Attorney"),
    (r"\bplanner\b|planning",                "Planner"),
    (r"highway",                             "Highway Superintendent"),
    (r"public\s+works|\bdpw\b|d\.p\.w|street\s+commissioner|superintendent",
                                             "Public Works Professional"),
    (r"environment|conservation|natural\s+resource",
                                             "Nature Resources / Environmental Protection Personnel"),
    (r"public\s+health|health\s+depart",     "Public Health Professional"),
    (r"grant",                               "Grant Writer"),
    (r"watershed",                           "Watershed Manager"),
    # Second pass, added after reviewing the 30 titles the first pass left unmapped. These
    # carry real functional content; what stays unmapped below is pure seniority wording that
    # genuinely does not say what the person does.
    (r"recovery|\bemo\b",                    "Emergency Management Personnel"),
    (r"mental\s+health",                     "Public Health Professional"),
    (r"sergeant|captain|\bofficer\b",        "First Responder - Police"),
    (r"road\s+commissioner|sanitation",      "Public Works Professional"),
    (r"\bpark\b|bay\s+protection",           "Nature Resources / Environmental Protection Personnel"),
    (r"insurance",                           "Stakeholder - Insurance Agent"),
    (r"business\s+owner",                    "Stakeholder - Business Leader"),
    # fiscal / administrative
    (r"treasurer|\bclerk\b|comptroller|\bfinance\b|\bbudget\b|examiner",
                                             "Fiscal Staff"),
]
# Titles that are pure seniority words with no functional content. Mapping these on the
# fallback would assert a role the source never states, so they are reported instead.
VAGUE = re.compile(r"^(director|deputy\s+director|commissioner|deputy\s+commissioner|"
                   r"executive\s+director|managing\s+associate|senior\s+managing\s+associate|"
                   r"associate|manager|coordinator|consultant|specialist|analyst|"
                   r"chair|chairman|chairperson|president|secretary|member|staff)\b", re.I)

# Organisations that are not Nassau municipalities. They attach to the county row and are
# required stakeholders by virtue of being external agencies at the table.
NON_MUNICIPAL_ROLE = {
    "FEMA": "Stakeholder - Other",
    "Federal Emergency Management Agency (FEMA)": "Stakeholder - Other",
    "NYS DHSES": "Stakeholder - Other",
    "New York State Department of Homeland Security and Emergency Services (NYS DHSES)":
        "Stakeholder - Other",
    "New York State Department of Environmental Conservation":
        "Nature Resources / Environmental Protection Personnel",
    "New York State Floodplain and Stormwater Managers Association": "Floodplain Administrator",
    "Hagerty Consulting": "Stakeholder - Other",
    "Long Island Regional Planning Council": "Planner",
    "Nassau County Soil and Water Conservation District":
        "Nature Resources / Environmental Protection Personnel",
    "Nassau County Village Officials Association": "Stakeholder - Civic Group",
    "New York City Emergency Management": "Emergency Management Personnel",
    "Suffolk County": "Emergency Management Personnel",
}

TYPE_WORDS = ("Village", "City", "Town", "County")


def norm_place(s):
    """
    Reduce either naming convention to (bare name, type) so the roster joins the alias table.
    The roster writes "Village of Atlantic Beach"; the alias table writes
    "Atlantic Beach (Village)". A direct string join matches 0 of 82.
    """
    s = re.sub(r"\s+", " ", (s or "").strip())
    # `Villages of Woodsburgh` (plural) is a real source variant -- allow the plural.
    m = re.match(r"^(Village|City|Town|County)s?\s+of\s+(.+)$", s, re.I)
    if m:
        return m.group(2).strip().lower(), m.group(1).title()
    m = re.match(r"^(.+?)\s*\((Village|City|Town|County)\)$", s, re.I)
    if m:
        return m.group(1).strip().lower(), m.group(2).title()
    m = re.match(r"^(.+?)\s+County$", s, re.I)
    if m:
        return m.group(1).strip().lower(), "County"
    return s.lower(), ""


def split_name(raw):
    """
    Contacts sometimes fuse the title onto the name with an en-dash:
      "Steven Cherson - Supterintendent of D.P.W."   (source typo kept verbatim)
    Left unsplit, `name` holds a name+title blob and the dedupe against the roster
    ("Steven Cherson") never matches.
    """
    raw = re.sub(r"\s+", " ", (raw or "").strip())
    m = re.split(r"\s+[–—-]\s+", raw, maxsplit=1)
    return (m[0].strip(), m[1].strip()) if len(m) == 2 else (raw, "")


def norm_person(n):
    return re.sub(r"[^a-z]", "", (n or "").lower())


def title_to_role(title, unmatched):
    t = (title or "").strip()
    if not t:
        return None
    for pat, role in ROLE_RULES:
        if re.search(pat, t, re.I):
            return role
    if VAGUE.match(t):
        unmatched[t] += 1
        return None
    unmatched[t] += 1
    return None


def main():
    os.makedirs(OUT, exist_ok=True)
    aliases = list(csv.DictReader(io.open(os.path.join(CTX, "nassau-jurisdiction-aliases.csv"),
                                          encoding="utf-8-sig")))
    by_place = {}
    for r in aliases:
        by_place[norm_place(r["jurisdiction_title"])] = r
        by_place[norm_place(r["municipality_name"] + " " +
                            (r["municipality_type"] or ""))] = r
    juris_of = {r["geoid"]: r["jurisdiction_title"] for r in aliases}

    people = collections.defaultdict(list)     # geoid -> [record]
    unmatched, notes, errs = collections.Counter(), [], []
    title_map = collections.Counter()          # (title, role) -> n

    # ---------------------------------------------------------------- annex contacts
    ann = os.path.join(EX, "annexes")
    for f in sorted(os.listdir(ann)):
        A = json.load(io.open(os.path.join(ann, f), encoding="utf-8"))
        g = A["geoid"]
        for i, c in enumerate(A["contacts"]):
            nm, fused_title = split_name(c.get("name"))
            title = (c.get("title") or "").strip() or fused_title
            role = title_to_role(title, unmatched)
            title_map[(title, role or "(unmapped)")] += 1
            people[g].append(dict(
                name=nm, title=title, role=role,
                agency=(c.get("agency") or "").strip(),
                email=(c.get("email") or "").strip(),
                phone=(c.get("phone") or "").strip(),
                address=", ".join(c.get("address") or []),
                hm_rep=(c.get("is_hazard_mitigation_representative") or "").strip(),
                slot=c.get("slot"), src="annex", _row=i))

    # ---------------------------------------------------------------- base-plan roster
    b = json.load(io.open(os.path.join(EX, "baseplan.json"), encoding="utf-8"))
    for i, p in enumerate(b["roster"]):
        org = (p.get("organization") or "").strip()
        title = (p.get("title") or "").strip()
        role = title_to_role(title, unmatched)
        if org in NON_MUNICIPAL_ROLE:
            g, role = COUNTY_GEOID, (role or NON_MUNICIPAL_ROLE[org])
            required, nonmuni = "Yes", True
        else:
            row = by_place.get(norm_place(org))
            if not row:
                errs.append(f"roster org {org!r} did not match any Nassau jurisdiction")
                continue
            g, required, nonmuni = row["geoid"], (
                "Yes" if p.get("core_planning_group") == "Yes" else "No"), False
        title_map[(title, role or "(unmapped)")] += 1
        people[g].append(dict(
            name=(p.get("name") or "").strip(), title=title, role=role,
            agency=org, email="", phone="", address="", hm_rep="",
            required=required, non_municipal=nonmuni, src="roster", _row=i))

    # ------------------------------------------------------- dedupe, annex contact wins
    total, per, dropped = 0, [], 0
    for g, rows in sorted(people.items()):
        best = {}
        for r in rows:
            k = norm_person(r["name"])
            if not k:
                continue
            prev = best.get(k)
            if prev is None:
                best[k] = r
            elif prev["src"] == "roster" and r["src"] == "annex":
                # Annex wins: it has email/phone/address. Keep the roster's extra facts.
                r = dict(r)
                r["required"] = prev.get("required", "No")
                best[k] = r
                dropped += 1
            else:
                # Roster duplicate of an annex contact -- carry its facts across, drop the row.
                if r["src"] == "roster":
                    prev.setdefault("required", r.get("required", "No"))
                dropped += 1

        out = []
        for r in best.values():
            if not r.get("role"):
                notes.append(f"{g}: {r['name']!r} title {r['title']!r} has no role mapping "
                             f"-- row still created with role left empty for review")
            d = {
                "name": r["name"],
                "title": r["title"] or None,
                "role": r.get("role") or None,
                "agency": r["agency"] or None,
                "email": r["email"] or None,
                "phone": r["phone"] or None,
                "address_optional": r["address"] or None,
                "hm_representative": r["hm_rep"] or None,
                "required_stakeholder": r.get("required") or None,
                "county": "Nassau",
                "geoid_county": [COUNTY_GEOID],
                "geoid_juris": [g],            # list for this dataset
                "jurisdiction": juris_of.get(g, ""),
            }
            if r.get("non_municipal"):
                d["comments"] = (f"Non-municipal participant representing {r['agency']}, "
                                 f"recorded against the county.")
            d = {k: v for k, v in d.items() if v not in (None, "", [])}
            errs.extend(S.validate("roles", d, f"{g}/{r['name'][:28]}"))
            out.append({"data": d, "_row": r["_row"], "_src": r["src"]})

        json.dump(out, io.open(os.path.join(OUT, f"roles_{g}.json"), "w", encoding="utf-8"),
                  ensure_ascii=False, indent=1)
        total += len(out)
        per.append(dict(geoid=g, jurisdiction=juris_of.get(g, ""), rows=len(out)))

    # ------------------------------------------------------------------ review surface
    with io.open(os.path.join(CTX, "roles-title-map-report.csv"), "w",
                 encoding="utf-8", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["source_title", "assigned_role", "n_people"])
        for (t, r), n in sorted(title_map.items(), key=lambda kv: (-kv[1], kv[0][0])):
            w.writerow([t, r, n])

    json.dump(dict(rows=total, jurisdictions=len(per), deduped_away=dropped,
                   errors=errs, notes=notes, unmapped_titles=dict(unmatched),
                   per_jurisdiction=per),
              io.open(os.path.join(OUT, "_roles_summary.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)

    mapped = sum(n for (t, r), n in title_map.items() if r != "(unmapped)")
    allp = sum(title_map.values())
    print(f"Roles: {total} insert rows across {len(per)} jurisdictions "
          f"({dropped} duplicate(s) merged)")
    print(f"     role assigned for {mapped}/{allp} people "
          f"({len(unmatched)} distinct title(s) unmapped)")
    print(f"     {len(errs)} error(s), {len(notes)} row(s) with an empty role")
    for e in errs[:8]:
        print("  ERR ", e)
    for t, n in unmatched.most_common(10):
        print(f"  UNMAPPED x{n:<3d} {t[:66]}")
    return 1 if errs else 0


if __name__ == "__main__":
    sys.exit(main())
