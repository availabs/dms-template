"""
Phase 7b - match the to-be-loaded rows against rows that ALREADY EXIST in the system, so a
row representing an action the catalogue already holds becomes an UPDATE instead of a
duplicate INSERT.

Owner-specified 2026-08-24. Nassau already has **189 existing Actions rows across 38 of its
jurisdictions**, so without this step the load would have created a parallel duplicate set for
a third of the county.

  How the 189 were nearly missed: `--filter county=Nassau` returns 0 rows. The filter is
  compiled from the column's DECLARED type, and `county` is declared `multiselect`, which
  always returns 0 regardless of what is stored. Filtering per jurisdiction on `geoid_juris`
  (declared `select`) is what works. See mny_schema.py.

METHOD
Jaccard similarity on token sets, computed ONLY within the same (county, jurisdiction) pair --
a geoid never matches across jurisdictions. Three fields are compared, per the owner:

  action_name                                       weight 0.40
  description_of_the_problem_problem_statement      weight 0.30
  description_of_the_solution_action_description    weight 0.30   ("the action")

A pair matches when the weighted score reaches MATCH or the name alone is near-identical
(NAME_ONLY) -- a renamed description should not hide an obvious same-action, and neither
should a reworded name when the substance is identical.

Assignment is GREEDY and ONE-TO-ONE by descending score. Each existing row may be claimed by
at most one payload row; without that, two payload rows could both carry the same
`_existing_id` and the load would update one record twice, silently losing one of them.

Everything from REVIEW upward is written to the report, including pairs below the match
threshold, because a Jaccard cut-off is a judgement call and near-misses are exactly what a
reviewer needs to see. Nothing below MATCH is applied.

OUTPUTS  rewrites payloads/<pfx>_<geoid>.json adding `_op` ("insert" | "update") and
         `_existing_id`; leaves the `data` untouched
         match-report-<dataset>.csv   every candidate pair at or above REVIEW

Usage: python match_existing.py actions [--apply]
       python match_existing.py capabilities [--apply]
   (without --apply it is a dry run and writes only the report)
"""
import json, io, os, sys, csv, re, collections

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

CTX = os.path.dirname(HERE)
EX = os.path.join(CTX, "extracted")
OUT = os.path.join(CTX, "payloads")

MATCH = 0.50        # weighted score at or above which a pair is treated as the same row
NAME_ONLY = 0.85    # a name this similar is a match on its own
REVIEW = 0.30       # reported for human review, never applied

# ----------------------------------------------------------------------------------------
# TWO MATCH MODES, and picking the wrong one is the mistake to avoid.
#
# `jaccard` is for rows whose identity lives in FREE TEXT -- an action or a capability is the
# same one when its name and prose say the same thing, and it may be reworded between cycles.
#
# `key`     is for rows that have a NATURAL KEY. A person is the same person when the name
#           matches; a meeting is the same meeting on the same date. Running Jaccard on those
#           would be actively worse than useless: "Ann Smith" vs "Ann Jones" scores 0.33 on a
#           two-token set, and a threshold low enough to catch real spelling variants would
#           also merge different people. Short structured fields do not carry enough tokens for
#           set overlap to mean anything.
#
# So: Jaccard where the text is the identity, exact normalised keys where a key exists.
DATASETS = {
    "actions": dict(
        mode="jaccard", prefix="act", live="live_actions_nassau.json",
        fields=[("action_name", 0.40),
                ("description_of_the_problem_problem_statement", 0.30),
                ("description_of_the_solution_action_description", 0.30)],
        label="action_name"),
    "capabilities": dict(
        mode="jaccard", prefix="cap", live="live_capabilities_nassau.json",
        fields=[("capability_name", 0.50), ("description", 0.50)],
        label="capability_name"),
    # A role row IS a (person, role) pair -- that is the row entity the owner defined, so it is
    # also the key. Same person listed under two roles is two rows, and must stay two rows.
    "roles": dict(
        mode="key", prefix="roles", live="live_roles_nassau.json",
        key=["name", "role"], label="name"),
    # A meeting is identified by which meeting and when. `geoid` is already implied by the
    # per-jurisdiction grouping, so it is not repeated in the key.
    "participation": dict(
        mode="key", prefix="part", live="live_participation_nassau.json",
        key=["meeting_name", "date"], label="meeting_name"),
}

# Dropped before comparison: these words appear in nearly every mitigation action and inflate
# every pair's similarity toward a common floor, which flattens the signal.
STOP = set("""a an the and or of to in for on at by with from as is are be been will would
shall may can this that these those it its their his her which who whom whose into onto
about over under between during through within without upon per via not no nor but if then
than so such other others any all both each few more most some own same too very
village city town county nassau new york ny state
action project program mitigation hazard hazards
""".split())

TOKEN = re.compile(r"[a-z0-9]+")

# ----------------------------------------------------------------------------------------
# DISCRIMINATOR GUARD -- the thing that makes this safe rather than nearly safe.
#
# Jaccard on token sets rates "Well 1 generator" against "Well 4 Generator" at 0.925, and
# "Generator Installation - East End Fire House" against "...West End Fire House" at 0.886.
# Both are ABOVE the name-only threshold, and both are DIFFERENT FACILITIES. Left alone they
# would overwrite the wrong existing action -- and the Village of Hempstead alone has eight
# near-identically-named fire-house generator projects.
#
# The greedy one-to-one assignment happened to reject them, but only because the correct pair
# claimed the slot first. That is ordering luck, not correctness.
#
# So: whatever distinguishes two names must MATCH. If the symmetric difference of the two name
# token sets contains a number or a compass direction, the pair is refused outright regardless
# of score. Those are precisely the tokens that carry "which one" in this corpus.
DISCRIM_COMPASS = ("north", "south", "east", "west", "upper", "lower", "inner", "outer")


def is_discriminator(t):
    if t.isdigit():
        return True
    return any(t.startswith(c) for c in DISCRIM_COMPASS)


def tokens(s, keep_short=False):
    """
    Token set for comparison.

    `keep_short` keeps 1-2 character tokens, which the general filter drops as noise. It MUST
    be on for names: the bare digit in "Well 1" versus "Well 4" is the only thing telling the
    two apart, and dropping it made the two names identical.
    """
    if not isinstance(s, str):
        s = "" if s is None else str(s)
    out = set()
    for t in TOKEN.findall(s.lower()):
        if t in STOP:
            continue
        if len(t) > 2 or (keep_short and (t.isdigit() or len(t) > 1)):
            out.add(t)
    return out


def jaccard(a, b):
    if not a or not b:
        return 0.0
    i = len(a & b)
    return i / float(len(a | b)) if i else 0.0


def discriminators_conflict(name_a, name_b):
    """True when the two names are told apart by a number or a direction."""
    a, b = tokens(name_a, keep_short=True), tokens(name_b, keep_short=True)
    return any(is_discriminator(t) for t in (a ^ b))


def main():
    if len(sys.argv) < 2 or sys.argv[1] not in DATASETS:
        print(f"Usage: python match_existing.py <{'|'.join(DATASETS)}> [--apply]")
        return 2
    which = sys.argv[1]
    apply_ = "--apply" in sys.argv
    cfg = DATASETS[which]

    # ------------------------------------------------------------------ self-test
    # Nassau has 0 existing Roles and Participation rows, so a real run exercises the key path
    # against nothing and proves nothing about it. `--selftest` feeds the payload back in as the
    # "existing" set: every row must then match itself, exactly once. That is the only check
    # available before a county turns up with real data in these datasets.
    if "--selftest" in sys.argv:
        n_rows = n_ok = 0
        problems = []
        for fn in sorted(os.listdir(OUT)):
            if not (fn.startswith(cfg["prefix"] + "_") and fn.endswith(".json")):
                continue
            payload = json.load(io.open(os.path.join(OUT, fn), encoding="utf-8"))
            n_rows += len(payload)
            if cfg["mode"] == "key":
                seen = collections.Counter()
                for p in payload:
                    k = tuple(re.sub(r"[^a-z0-9]+", " ", str(p["data"].get(f) or "").lower()).strip()
                              for f in cfg["key"])
                    seen[k] += 1
                    if any(k):
                        n_ok += 1
                    else:
                        problems.append(f"{fn}: row has an EMPTY key {cfg['key']} -- it can "
                                        f"never match and will always insert")
                for k, c in seen.items():
                    if c > 1 and any(k):
                        problems.append(f"{fn}: key {k} appears {c}x within one jurisdiction -- "
                                        f"only the first could ever be matched")
            else:
                for p in payload:
                    a = tokens(p["data"].get(cfg["label"]), keep_short=True)
                    if a and jaccard(a, a) == 1.0:
                        n_ok += 1
                    else:
                        problems.append(f"{fn}: row {p['data'].get(cfg['label'], '')[:50]!r} "
                                        f"yields no comparable tokens -- it can never match")
        print(f"selftest {which} ({cfg['mode']} mode): {n_ok}/{n_rows} row(s) are self-matchable")
        for p in problems[:15]:
            print("  PROBLEM", p)
        if len(problems) > 15:
            print(f"  ... and {len(problems) - 15} more")
        print("  OK" if not problems else f"  {len(problems)} problem(s)")
        return 1 if problems else 0

    live_path = os.path.join(EX, cfg["live"])
    if not os.path.exists(live_path):
        print(f"MISSING {live_path}\n"
              f"Run the fetch script first -- refusing to report 'no existing rows' when the "
              f"truth is 'not fetched'. That distinction is exactly what the broken county "
              f"filter blurred.")
        return 1
    live = json.load(io.open(live_path, encoding="utf-8"))

    rows_out, report = [], []
    n_pay = n_live = n_match = n_review = n_refused = 0
    per = []

    for fn in sorted(os.listdir(OUT)):
        if not (fn.startswith(cfg["prefix"] + "_") and fn.endswith(".json")):
            continue
        geoid = fn[len(cfg["prefix"]) + 1:-5]
        payload = json.load(io.open(os.path.join(OUT, fn), encoding="utf-8"))
        existing = live.get(geoid) or []
        n_pay += len(payload)
        n_live += len(existing)

        LBL = cfg["label"]

        # ------------------------------------------------------------------ key mode
        if cfg["mode"] == "key":
            def keyof(d):
                parts = []
                for f in cfg["key"]:
                    v = d.get(f)
                    v = "" if v is None else str(v)
                    # Normalise away the differences that are NOT identity: case, punctuation,
                    # doubled spaces. Everything else must match exactly.
                    parts.append(re.sub(r"[^a-z0-9]+", " ", v.lower()).strip())
                return tuple(parts)

            ex_by_key = {}
            for e in existing:
                ex_by_key.setdefault(keyof(e["data"]), []).append(e)
            claimed = set()
            for p in payload:
                k = keyof(p["data"])
                cand = [e for e in ex_by_key.get(k, []) if e["id"] not in claimed]
                if not cand or not any(k):
                    continue
                e = cand[0]
                claimed.add(e["id"])
                p["_op"] = "update"
                p["_existing_id"] = e["id"]
                p["_match_key"] = " | ".join(k)
                n_match += 1
                report.append(dict(
                    geoid=geoid, payload_row=(p["data"].get(LBL) or "")[:90],
                    existing_id=e["id"],
                    existing_row=(e["data"].get(LBL) or "")[:90],
                    score=1.0, outcome="applied (exact key)"))
            for p in payload:
                p.setdefault("_op", "insert")
            if apply_:
                json.dump(payload, io.open(os.path.join(OUT, fn), "w", encoding="utf-8"),
                          ensure_ascii=False, indent=1)
            per.append(dict(geoid=geoid, payload=len(payload), existing=len(existing),
                            updates=len(claimed)))
            continue

        # ------------------------------------------------------------------ jaccard mode
        # pre-tokenise both sides once. Field 0 is the name and keeps its short tokens.
        pay_tok = [[tokens(p["data"].get(f), keep_short=(f == LBL))
                    for f, _ in cfg["fields"]] for p in payload]
        ex_tok = [[tokens(e["data"].get(f), keep_short=(f == LBL))
                   for f, _ in cfg["fields"]] for e in existing]

        pairs = []
        for i, pt in enumerate(pay_tok):
            for j, et in enumerate(ex_tok):
                per_field = [jaccard(pt[k], et[k]) for k in range(len(cfg["fields"]))]
                score = sum(w * v for (_, w), v in zip(cfg["fields"], per_field))
                conflict = discriminators_conflict(payload[i]["data"].get(LBL),
                                                   existing[j]["data"].get(LBL))
                if score >= REVIEW or per_field[0] >= NAME_ONLY:
                    pairs.append((score, per_field, i, j, conflict))
        pairs.sort(key=lambda x: -x[0])

        # greedy one-to-one
        taken_pay, taken_ex = set(), set()
        for score, pf, i, j, conflict in pairs:
            if conflict:
                # Refused on evidence, not on score -- these two name different things.
                n_refused += 1
                report.append(dict(
                    geoid=geoid,
                    payload_row=(payload[i]["data"].get(LBL) or "")[:90],
                    existing_id=existing[j]["id"],
                    existing_row=(existing[j]["data"].get(LBL) or "")[:90],
                    score=round(score, 3),
                    **{f"j_{f[:26]}": round(v, 3) for (f, _), v in zip(cfg["fields"], pf)},
                    outcome="REFUSED - discriminator conflict"))
                continue
            is_match = score >= MATCH or pf[0] >= NAME_ONLY
            claimed = ""
            if is_match and i not in taken_pay and j not in taken_ex:
                taken_pay.add(i)
                taken_ex.add(j)
                claimed = "applied"
                payload[i]["_op"] = "update"
                payload[i]["_existing_id"] = existing[j]["id"]
                payload[i]["_match_score"] = round(score, 3)
                n_match += 1
            elif is_match:
                claimed = "skipped (already claimed)"
            else:
                claimed = "below threshold - review only"
                n_review += 1
            report.append(dict(
                geoid=geoid,
                payload_row=(payload[i]["data"].get(LBL) or "")[:90],
                existing_id=existing[j]["id"],
                existing_row=(existing[j]["data"].get(cfg["label"]) or "")[:90],
                score=round(score, 3),
                **{f"j_{f[:26]}": round(v, 3) for (f, _), v in zip(cfg["fields"], pf)},
                outcome=claimed))

        for p in payload:
            p.setdefault("_op", "insert")
        if apply_:
            json.dump(payload, io.open(os.path.join(OUT, fn), "w", encoding="utf-8"),
                      ensure_ascii=False, indent=1)
        per.append(dict(geoid=geoid, payload=len(payload), existing=len(existing),
                        updates=len(taken_pay)))

    if report:
        cols = list(report[0].keys())
        with io.open(os.path.join(CTX, f"match-report-{which}.csv"), "w",
                     encoding="utf-8", newline="") as fh:
            w = csv.DictWriter(fh, fieldnames=cols)
            w.writeheader()
            for r in sorted(report, key=lambda r: -r["score"]):
                w.writerow(r)

    print(f"{which}: {n_pay} payload row(s) vs {n_live} existing row(s)  [{cfg['mode']} mode]")
    print(f"     {n_match} matched -> UPDATE   {n_pay - n_match} -> INSERT")
    if cfg["mode"] == "jaccard":
        print(f"     {n_review} near-miss pair(s) reported for review, not applied")
        print(f"     {n_refused} pair(s) REFUSED on a discriminator conflict "
              f"(a number or direction tells the two names apart)")
        print(f"     thresholds: match>={MATCH}  name-only>={NAME_ONLY}  report>={REVIEW}")
    else:
        print(f"     exact key: {' + '.join(cfg['key'])} "
              f"(case and punctuation normalised, nothing else)")
    if n_live == 0:
        print(f"     NOTE: 0 existing rows. Verify that zero with "
              f"`node fetch_live.mjs {which} --verify` before believing it -- a filter on a "
              f"column declared multiselect returns 0 whatever the content.")
    if report:
        print(f"     -> match-report-{which}.csv")
    if not apply_:
        print("     --dry: payloads NOT rewritten (pass --apply to mark them)")
    hot = [p for p in per if p["updates"]]
    for p in sorted(hot, key=lambda p: -p["updates"])[:10]:
        print(f"       {p['geoid']}  {p['updates']} update(s) of {p['payload']} "
              f"(existing {p['existing']})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
