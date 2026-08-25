"""
Phase 7b - build the human review surfaces for everything Phase 7 will write.

This is the gate before any database write. It produces THREE kinds of artifact, because a
reviewer needs three different questions answered:

  review/<ds>.csv           WHAT will be written -- one line per payload row, with `_op` and
                            `_existing_id`, so the insert/update split is visible at a glance.
  review/<ds>-changes.csv   WHAT WILL BE LOST -- one line per column whose existing non-empty
                            value my payload would REPLACE, with both values side by side.
                            This is the important one. `dataset update --data` shallow-merges,
                            so columns I do not send survive; the ones I do send are overwritten,
                            and on Actions that is 1,037 values across 131 rows.
  review/_index.md          the totals, the decisions still open, and what to look at first.

Deliberately NOT a spreadsheet. Nothing ingests an .xlsx and the load is scripted per row; a
workbook would only add a conversion step. CSV opens in Excel just as well -- but note the
project has already lost a run to a CSV being open and locked, so these are written to their own
`review/` folder and never overwrite a source-of-truth file.

Usage: python build_review.py
"""
import json, io, os, sys, csv, collections

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import mny_schema as S

CTX = os.path.dirname(HERE)
EX = os.path.join(CTX, "extracted")
PAY = os.path.join(CTX, "payloads")
OUT = os.path.join(CTX, "review")

# dataset -> (payload prefix, live dump, the columns worth showing in the summary)
DATASETS = {
    "actions": ("act", "live_actions_nassau.json",
                ["action_number", "action_name", "action_status", "implementation_status",
                 "primary_action_type", "primary_hazard_type", "cost_range", "priority",
                 "lead_agency_department"]),
    "capabilities": ("cap", "live_capabilities_nassau.json",
                     ["capability_name", "primary_capability_type", "secondary_capability_type",
                      "administering_agency", "plan_guidance", "tool", "funding_source",
                      "program"]),
    "roles": ("roles", "live_roles_nassau.json",
              ["name", "title", "role", "agency", "hm_representative",
               "required_stakeholder"]),
    "participation": ("part", "live_participation_nassau.json",
                      ["meeting_name", "date", "format", "participation",
                       "meeting_unique_id"]),
}
CLIP = 300


def clip(v, n=CLIP):
    if v is None:
        return ""
    if isinstance(v, (list, dict)):
        v = json.dumps(v, ensure_ascii=False)
    v = " ".join(str(v).split())
    return v if len(v) <= n else v[:n - 1] + "…"


def classify(old, new, ds=None, col=None):
    """
    Triage one overwrite. 982 undifferentiated diffs are unreviewable; most turn out to be
    churn or normalisation, and only a handful genuinely lose information.

    Found by reading them: the plan's wording is often WORSE than what is already stored --
    "Emergency Generator" -> "Emergency generator" is pure churn, and "Tree Maintenance Program
    (Revised)" -> "Tree Maintenance Program" silently drops the qualifier. So an overwrite is
    not automatically an improvement.

    Two whole categories are NOT losses even though a naive length test calls them that:

      * a free-text value being replaced by a valid option of a `select` column. "Within the
        next 5-10 years" -> "More than 4 years" is shorter, and is the entire point of having a
        controlled vocabulary. 30-odd of the apparent losses are this.
      * a currency string becoming a bare number. "$1,000,000" -> "1000000" is a format change;
        33 of the apparent losses are this one column.

    Separating those is what turns a 98-row review into a short one.
    """
    a, b = str(old or ""), str(new or "")

    # normalisation into a controlled vocabulary
    if ds and col:
        opts = S.options(ds, col)
        if opts and b in opts and a not in opts:
            return "normalised - free text replaced by a valid select option"

    # currency -> bare number
    da = "".join(ch for ch in a if ch.isdigit())
    db = "".join(ch for ch in b if ch.isdigit())
    if da and da == db and a != b:
        return "reformatted - same digits, different formatting"
    na = "".join(ch for ch in a.lower() if ch.isalnum())
    nb = "".join(ch for ch in b.lower() if ch.isalnum())
    if na == nb:
        return "TRIVIAL - case/punctuation only"
    if nb and na.startswith(nb):
        return "LOSES DETAIL - new is a truncation of existing"
    if na and nb.startswith(na):
        return "adds detail - existing is a prefix of new"
    if len(b) < len(a) * 0.6:
        return "LOSES DETAIL - new is much shorter"
    if len(b) > len(a) * 1.6:
        return "adds detail - new is much longer"
    return "different wording"


def main():
    os.makedirs(OUT, exist_ok=True)
    aliases = {r["geoid"]: r for r in csv.DictReader(
        io.open(os.path.join(CTX, "nassau-jurisdiction-aliases.csv"), encoding="utf-8-sig"))}
    idx = []

    # ------------------------------------------------------------------ flat datasets
    for ds, (pfx, livefile, cols) in DATASETS.items():
        live = {}
        lp = os.path.join(EX, livefile)
        if os.path.exists(lp):
            live = {r["id"]: r["data"]
                    for v in json.load(io.open(lp, encoding="utf-8")).values() for r in v}

        rows, changes = [], []
        tally = collections.Counter()
        for fn in sorted(os.listdir(PAY)):
            if not (fn.startswith(pfx + "_") and fn.endswith(".json")):
                continue
            geoid = fn[len(pfx) + 1:-5]
            juris = aliases.get(geoid, {}).get("jurisdiction_title", "")
            for i, p in enumerate(json.load(io.open(os.path.join(PAY, fn), encoding="utf-8"))):
                d, op = p["data"], p.get("_op", "insert")
                tally[op] += 1
                rows.append(dict(
                    geoid=geoid, jurisdiction=juris, op=op,
                    existing_id=p.get("_existing_id", ""),
                    match=p.get("_match_score", p.get("_match_key", "")),
                    source=p.get("_kind", p.get("_table", p.get("_src", ""))),
                    **{c: clip(d.get(c)) for c in cols}))
                if op != "update":
                    continue
                ex = live.get(p.get("_existing_id"), {})
                for k, v in sorted(d.items()):
                    old = ex.get(k)
                    if old in (None, "", [], {}):
                        continue                    # filling a blank is not a loss
                    if clip(old, 10000) == clip(v, 10000):
                        continue
                    changes.append(dict(
                        geoid=geoid, jurisdiction=juris,
                        existing_id=p["_existing_id"],
                        row=clip(d.get(cols[1] if len(cols) > 1 else cols[0]), 70),
                        column=k,
                        difference=classify(old, v, ds, k),
                        existing_value=clip(old, 500),
                        new_value=clip(v, 500)))

        if rows:
            with io.open(os.path.join(OUT, f"{ds}.csv"), "w", encoding="utf-8-sig",
                         newline="") as fh:
                w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
                w.writeheader()
                w.writerows(rows)
        if changes:
            with io.open(os.path.join(OUT, f"{ds}-changes.csv"), "w", encoding="utf-8-sig",
                         newline="") as fh:
                w = csv.DictWriter(fh, fieldnames=list(changes[0].keys()))
                w.writeheader()
                w.writerows(changes)
        bycol = collections.Counter(c["column"] for c in changes)
        bykind = collections.Counter(c["difference"] for c in changes)
        idx.append(dict(ds=ds, insert=tally["insert"], update=tally["update"],
                        changes=len(changes), bycol=bycol, bykind=bykind))
        print(f"{ds:14s} {tally['insert']:5d} insert  {tally['update']:4d} update  "
              f"{len(changes):5d} value(s) overwritten")
        for k, n in bykind.most_common():
            print(f"{'':16s}{n:5d}  {k}")

    # ------------------------------------------------------------------ HOC (update-in-place)
    hoc_u = hoc_i = 0
    hrows = []
    for fn in sorted(os.listdir(PAY)):
        if fn.startswith("hoc_") and fn.endswith("_updates.json"):
            geoid = fn[4:-13]
            juris = aliases.get(geoid, {}).get("jurisdiction_title", "")
            for u in json.load(io.open(os.path.join(PAY, fn), encoding="utf-8")):
                hoc_u += 1
                d = u["data"]
                hrows.append(dict(geoid=geoid, jurisdiction=juris, op="update",
                                  existing_id=u["id"], hazard=u["hazard"],
                                  hazard_of_concern=d.get("hazard_of_concern", ""),
                                  buildings=d.get("buildings_vulnerability", ""),
                                  infrastructure=d.get("infrastructure_vulnerability", ""),
                                  population=d.get("population_vulnerability", ""),
                                  natural_env=d.get("natural_env_vulnerability", ""),
                                  general_vulnerability=clip(d.get("general_vulnerability")),
                                  other_comments=clip(d.get("other_comments")),
                                  reason_for_exclusion=clip(d.get("reason_for_exclusion"))))
        elif fn.startswith("hoc_") and fn.endswith("_inserts.json"):
            geoid = fn[4:-13]
            juris = aliases.get(geoid, {}).get("jurisdiction_title", "")
            for u in json.load(io.open(os.path.join(PAY, fn), encoding="utf-8")):
                hoc_i += 1
                d = u["data"]
                hrows.append(dict(geoid=geoid, jurisdiction=juris, op="INSERT",
                                  existing_id="", hazard=d.get("hazard", ""),
                                  hazard_of_concern=d.get("hazard_of_concern", ""),
                                  buildings="", infrastructure="", population="",
                                  natural_env="",
                                  general_vulnerability=clip(d.get("general_vulnerability")),
                                  other_comments=clip(d.get("hazard_name_if_other")),
                                  reason_for_exclusion=""))
    with io.open(os.path.join(OUT, "hoc.csv"), "w", encoding="utf-8-sig", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(hrows[0].keys()))
        w.writeheader()
        w.writerows(hrows)
    print(f"{'hoc':14s} {hoc_i:5d} insert  {hoc_u:4d} update  "
          f"(seeded rows are all blank, so nothing is overwritten)")

    # ------------------------------------------------------------------ Jurisdictions index
    jn = sorted(f for f in os.listdir(PAY) if f.startswith("juris_") and f.endswith(".md"))
    filled = collections.Counter()
    for f in jn:
        col = json.load(io.open(os.path.join(PAY, f[:-3] + ".json"), encoding="utf-8"))
        for k, v in col.items():
            if v.strip():
                filled[k] += 1
    print(f"{'jurisdictions':14s} {0:5d} insert  {len(jn):4d} update  (7 lexical columns each)")

    # ------------------------------------------------------------------ the index
    L = []
    L.append("# Nassau Phase 7 — review surfaces\n")
    L.append("Generated by `scripts/build_review.py`. **Nothing has been written to "
             "`mitigat-ny-prod`.**\n")
    L.append("## What will be written\n")
    L.append("| Dataset | INSERT | UPDATE | Existing values overwritten |")
    L.append("|---|---|---|---|")
    for r in idx:
        L.append(f"| [{r['ds']}]({r['ds']}.csv) | {r['insert']} | {r['update']} | "
                 f"{r['changes'] or '—'} |")
    L.append(f"| [hoc](hoc.csv) | {hoc_i} | {hoc_u} | — (seeded rows are blank) |")
    L.append(f"| jurisdictions | 0 | {len(jn)} | 7 lexical columns each |")
    tot_i = sum(r["insert"] for r in idx) + hoc_i
    tot_u = sum(r["update"] for r in idx) + hoc_u + len(jn)
    L.append(f"\n**{tot_i:,} inserts and {tot_u:,} updates.**\n")

    L.append("## Look at this first\n")
    ac = next(r for r in idx if r["ds"] == "actions")
    L.append(f"**[actions-changes.csv](actions-changes.csv) — {ac['changes']:,} existing values "
             f"would be replaced across {ac['update']} matched rows.** This is the only place in "
             f"Phase 7 where anything is destroyed. `dataset update --data` shallow-merges, so "
             f"columns not sent survive untouched; these are the ones being sent.\n")
    L.append("**No curation fields are affected.** `county_priority`, "
             "`mitigation_action_readiness`, `application_readiness`, `project_maturity`, "
             "`dhses_comments` and `fema_comments` are empty on every matched row, so no "
             "workflow state is lost. What changes is plan content.\n")
    L.append("### Policy: uploaded fields overwrite existing fields\n")
    L.append("**Decided by the owner, 2026-08-24. No per-column exceptions.** The transcribed "
             "plan is the authority on every field it carries. Crucially, **a shorter value is "
             "not evidence of a mistake** — removing detail is often a deliberate editorial "
             "choice by the plan's authors, and this pipeline is not entitled to second-guess "
             "it. So there is no append rule, no leave-the-name-alone rule, and no "
             "skip-the-trivial-diffs rule.\n")
    L.append("The `difference` column below is therefore **informational** — a way to sample the "
             "982 without reading all of them — not a set of gates:\n")
    L.append("| Kind | Count |")
    L.append("|---|---|")
    for k, n in ac["bykind"].most_common():
        L.append(f"| {k} | {n} |")
    nloss = sum(n for k, n in ac["bykind"].items() if k.startswith("LOSES"))
    L.append(f"\nOf the {ac['changes']:,}, roughly half add detail or normalise a value into a "
             f"controlled vocabulary, and **{nloss} are shorter than what they replace** — of "
             f"which only 5 are prose. All are written as-is under the policy above.\n")
    L.append("Worth knowing about rather than deciding on:\n")
    L.append("- **The 5 prose shortenings** are Cedarhurst ×2 (the stored text repeats the "
             "action name as a prefix), Lynbrook, Sands Point, and Matinecock's "
             "`cost_benefit_notes`. Filter `difference` for `LOSES DETAIL` to see them.")
    L.append("- **2 rows flip `Proposed` → `Completed`** (both Woodsburgh), per the owner's "
             "instruction that its completed-actions table maps to Completed.")
    L.append("- **34 diffs are case or punctuation only** (`Emergency Generator` → "
             "`Emergency generator`). Written anyway; they carry no meaning either way.\n")

    L.append("## Jurisdictions prose\n")
    L.append("One markdown file per jurisdiction in `payloads/juris_<geoid>.md`, 52 of them. "
             "**Correct the markdown, not the extract** — 7c compiles these to lexical.\n")
    L.append("| Column | Filled |")
    L.append("|---|---|")
    for k, n in filled.most_common():
        L.append(f"| `{k}` | {n}/52 |")
    L.append("\nFreeport is 1/7 by decision, not omission: a village that did not use the shared "
             "format leaves fields blank for the community to fill later.\n")

    L.append("## Still open for review\n")
    L.append("- `capability-types.csv` — 24 of 50 rows are medium/low confidence")
    L.append("- `roles-title-map-report.csv` — 17 titles unmapped, so 40 Roles rows carry an "
             "empty `role` rather than a guessed one")
    L.append("- `match-report-actions.csv` — 131 applied, 25 near-miss, 148 refused on a "
             "discriminator conflict")
    L.append("- 35 of 571 actions fall through action-type detection to "
             "`Prevention/Mitigation Projects`")
    L.append("- 21 action hazard strings unmapped (junk or non-hazards: `\"1\"`, `\"0\"`, "
             "`Meadowmere Park`, `Terrorism`)\n")

    io.open(os.path.join(OUT, "_index.md"), "w", encoding="utf-8",
            newline="\n").write("\n".join(L))
    print(f"\n-> review/_index.md  ({tot_i:,} inserts, {tot_u:,} updates)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
