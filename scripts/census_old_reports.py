#!/usr/bin/env python3
"""
Full-corpus gap census over ALL old NPMRDS reports (admin2.reports).

Analysis-only: runs every report through the converter's own analyze path
(imported from convert_old_reports.py so the census cannot drift from real
conversion behavior) with NO writes anywhere, NO falcor point-route
resolution, and only a handful of bulk SQL reads (old DB: reports + routes
existence; new DB: one route-catalog id sweep).

Answers, corpus-wide:
  - How many reports would convert fully / partially / not-at-all today?
  - Every unmapped (graph type x measure x resolution x dataColumn) key,
    ranked by graph-instance and report count, split into:
      buildable      - types with a PROVEN AVL Graph shape (line/bar/grid +
                       Bar Graph Summary + Route Compare) missing only a
                       measure/resolution/dataColumn combination
      no_equivalent  - no built new-side shape yet (Route Map, diff shapes,
                       info boxes outside the reliability bucket) — round 24
                       reopened these as in-scope targets
      tail           - graph types never yet examined
  - Gap-kind counts (relative_date, overrides, mixed resolution, ...).
  - Route-level work: catalog upserts needed, point-drawn routes needing
    falcor resolution, routes missing everywhere.
  - Round-33 report-level mirror: `no_valid_routes` shells (reports the
    converter would refuse to page at all), cross-referenced against
    already-converted `report_<id>` pages in the new DB (task item (e)).

Usage:
  python3 scripts/census_old_reports.py

Outputs:
  scratchpad/npmrds-sub/old-reports/census/census.json        (full detail)
  scratchpad/npmrds-sub/old-reports/census/census_summary.md  (ranked tables)
"""

import json
import os
import sys
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from convert_old_reports import (  # noqa: E402
    REPO, GRAPH_TEMPLATE_MAP, TEMPLATE_SPECS, COLOR_RANGE_GRAPH_TYPES,
    ROUTES_CATALOG_TABLE, INFO_BOX_GRAIN, INFO_BOX_BUCKET, PM3_VIEW_BY_YEAR,
    ROUTE_COMPARE_BUCKET, MEASURE_EXPR, PAGE_TYPE,
    analyze_graph, flatten_route_comps, route_settings_gaps,
    aadt_override_of, graph_max_year, graph_reliability_bin, psql_old, psql_new,
)

OUT_DIR = os.path.join(REPO, "scratchpad/npmrds-sub/old-reports/census")

# Old graph types with a PROVEN new-side AVL Graph shape — an unmapped key
# on one of these is a buildable capability (new calculated column /
# template spec / MEASURE_EXPR entry), not a new component. Bar Graph
# Summary's one-bar-per-arm shape proved in rounds 34-36; Route Compare's
# base+delta shape in round 25.
BUILDABLE_TYPES = {"Route Line Graph", "Route Bar Graph", "TMC Grid Graph",
                   "Bar Graph Summary", "Route Compare Component"}
# No built new-side shape yet. Round 24 REOPENED Route Map / Route
# Difference / TMC Difference Grid as in-scope targets (the 2026-07-08
# gap-log-only ruling was reversed), so this bucket now means "needs shape
# work before spec work", not "ruled out". Route/TMC Info Box have a shape
# ONLY for the reliability bucket (speed x travel_time_all, resolved
# dynamically); their unmapped keys are either pm3 data gaps (speed
# measure: year/bin/coverage) or unproven other-measure info boxes, so
# they stay here rather than in buildable.
NO_EQUIVALENT_TYPES = {
    "Route Difference Graph", "TMC Difference Grid",
    "Route Map", "Route Info Box", "TMC Info Box",
}
# Templates whose calculated column consumes table1.aadt (delay/CO2) — the
# only place overrides.aadt matters (mirrors convert_report's `consuming`).
AADT_CONSUMING_TEMPLATES = {
    name for name, spec in TEMPLATE_SPECS.items()
    if "table1.aadt" in json.dumps(spec)
}


def bucket_of(graph_type):
    if graph_type in BUILDABLE_TYPES:
        return "buildable"
    if graph_type in NO_EQUIVALENT_TYPES:
        return "no_equivalent"
    return "tail"


def fetch_all_reports(batch=100):
    ids = [int(x) for x in psql_old(
        "SELECT id FROM admin2.reports ORDER BY id").split()]
    reports = []
    for i in range(0, len(ids), batch):
        chunk = ",".join(map(str, ids[i:i + batch]))
        out = psql_old(
            "SELECT json_agg(row_to_json(t)) FROM (SELECT id, name, "
            "route_comps, graph_comps, station_comps, color_range "
            f"FROM admin2.reports WHERE id IN ({chunk}) ORDER BY id) t")
        reports.extend(json.loads(out))
    return reports


def fetch_old_route_facts(route_ids, batch=2000):
    """{route_id(str): {"point_drawn": bool}} for ids that exist in
    admin2.routes. tmc_array falsy (SQL NULL / json null / []) means the
    route is point-drawn and needs falcor resolution at convert time."""
    facts = {}
    ids = sorted(route_ids)
    for i in range(0, len(ids), batch):
        chunk = ",".join(map(str, ids[i:i + batch]))
        out = psql_old(
            "SELECT json_agg(row_to_json(t)) FROM (SELECT id, "
            "(tmc_array IS NULL OR tmc_array = 'null'::jsonb "
            "OR tmc_array = '[]'::jsonb) AS point_drawn "
            f"FROM admin2.routes WHERE id IN ({chunk})) t")
        for r in json.loads(out) or []:
            facts[str(r["id"])] = {"point_drawn": r["point_drawn"]}
    return facts


def fetch_catalog_route_ids():
    out = psql_new(f"SELECT data->>'route_id' FROM {ROUTES_CATALOG_TABLE}")
    return {line.strip() for line in out.split("\n") if line.strip()}


def fetch_converted_pages():
    """{old_report_id(int): page_id} for already-converted `report_<id>`
    pages live in the new DB (convert_report's slug scheme)."""
    out = psql_new(
        "SELECT json_agg(row_to_json(t)) FROM (SELECT id, "
        "data->>'url_slug' AS slug FROM dms_npmrdsv5.data_items "
        f"WHERE type = '{PAGE_TYPE}' "
        "AND data->>'url_slug' LIKE 'report\\_%') t")
    pages = {}
    for row in (json.loads(out) if out else None) or []:
        suffix = (row["slug"] or "")[len("report_"):]
        if suffix.isdigit():
            pages[int(suffix)] = row["id"]
    return pages


def analyze_report(old):
    """Mirror convert_report's analysis phase (convert_old_reports.py) with
    zero side effects. Returns the per-report census record."""
    gaps = []
    route_comps = flatten_route_comps(old.get("route_comps"), gaps)
    if old.get("station_comps"):
        gaps.append({"kind": "station_comps",
                     "detail": f"{len(old['station_comps'])} station comps"})
    comps_by_id = {rc.get("compId"): rc for rc in route_comps
                   if rc.get("compId")}
    for rc in route_comps:
        route_settings_gaps(rc.get("settings") or {}, rc.get("name"), gaps)

    analyzed = [(g, analyze_graph(g, comps_by_id, gaps))
                for g in old.get("graph_comps") or []]
    mapped, unmapped_keys, skipped_graphs = [], [], []
    for g, info in analyzed:
        key = (info["type"], info["measure"], info["resolution"],
               info["data_column"])
        # Route/TMC Info Box and Route Compare Component aren't in
        # GRAPH_TEMPLATE_MAP (they're resolved dynamically per report/graph —
        # see convert_old_reports.py's INFO_BOX_GRAIN / ROUTE_COMPARE_BUCKET
        # branches in convert_report) — mirror those dynamic checks here so
        # the census doesn't mis-count them.
        grain = INFO_BOX_GRAIN.get(info["type"])
        is_route_compare = info["type"] == "Route Compare Component"
        if grain:
            in_bucket = (info["measure"], info["data_column"]) == INFO_BOX_BUCKET
            year = graph_max_year(info, comps_by_id) if in_bucket else None
            bin_ = graph_reliability_bin(info, comps_by_id) if in_bucket else None
            if in_bucket and year in PM3_VIEW_BY_YEAR and bin_ is not None:
                mapped.append((g, info,
                               f"{grain}_info_box_reliability_{year}_{bin_}"))
                continue
        elif is_route_compare:
            if (info["measure"] in MEASURE_EXPR and key[1:] == ROUTE_COMPARE_BUCKET
                    and len(info["assigned"]) >= 2):
                mapped.append((g, info, f"route_compare_{info['measure']}"))
                continue
        elif GRAPH_TEMPLATE_MAP.get(key):
            mapped.append((g, info, GRAPH_TEMPLATE_MAP[key]))
            continue
        unmapped_keys.append(key)
        skipped_graphs.append(g)
        gaps.append({"kind": "unmapped_graph", "detail": {
            "graph": g.get("id"), "key": list(map(str, key))}})

    # overrides.aadt per mapped graph (mirrors convert_report)
    aadt_applied = 0
    for g, info, tmpl_name in mapped:
        per_comp = [aadt_override_of(comps_by_id[c]) for c in info["assigned"]]
        distinct = set(per_comp)
        if tmpl_name in AADT_CONSUMING_TEMPLATES and distinct != {None}:
            if len(distinct) == 1:
                aadt_applied += 1
            else:
                gaps.append({"kind": "aadt_override_mixed",
                             "graph": g.get("id"),
                             "detail": sorted(str(x) for x in distinct)})

    if old.get("color_range") and any(
            g.get("type") in COLOR_RANGE_GRAPH_TYPES for g in skipped_graphs):
        gaps.append({"kind": "color_range", "detail": True})

    n = len(analyzed)
    m = len(mapped)
    klass = ("no_graphs" if n == 0 else
             "full" if m == n else
             "none" if m == 0 else "partial")
    return {
        "id": old["id"], "name": old.get("name"),
        "n_graphs": n, "n_mapped": m, "class": klass,
        "unmapped_keys": unmapped_keys,
        "route_ids": sorted({str(rc.get("routeId")) for rc in route_comps
                             if rc.get("routeId")}),
        "n_route_comps": len(route_comps),
        "aadt_override_applied_graphs": aadt_applied,
        "gap_kinds": sorted({g["kind"] for g in gaps}),
        "gaps": gaps,
    }


def main():
    reports = fetch_all_reports()
    print(f"fetched {len(reports)} reports from admin2.reports")

    records, errors = [], []
    for old in reports:
        try:
            records.append(analyze_report(old))
        except Exception as e:  # real-world jsonb — survive bad rows
            errors.append({"id": old.get("id"), "error": repr(e)})
    print(f"analyzed {len(records)} reports ({len(errors)} errors)")

    # ── route-level facts (bulk, once) ──────────────────────────────────
    all_route_ids = sorted({rid for r in records for rid in r["route_ids"]})
    old_route_facts = fetch_old_route_facts(all_route_ids)
    catalog_ids = fetch_catalog_route_ids()
    print(f"route ids referenced: {len(all_route_ids)}; in old admin2.routes: "
          f"{len(old_route_facts)}; new catalog rows: {len(catalog_ids)}")
    route_stats = {
        "referenced": len(all_route_ids),
        "missing_everywhere": sorted(
            rid for rid in all_route_ids
            if rid not in old_route_facts and rid not in catalog_ids),
        "needs_catalog_insert": sum(
            1 for rid in all_route_ids
            if rid in old_route_facts and rid not in catalog_ids),
        "point_drawn_needing_falcor": sum(
            1 for rid in all_route_ids
            if old_route_facts.get(rid, {}).get("point_drawn")),
    }

    # ── round-33 report-level mirror: no_valid_routes shells ────────────
    # convert_report skips page creation when a report HAS route comps and
    # none of them resolves a real tmc_array (build_route_entry: the tmc
    # comes from admin2.routes' tmc_array or convert-time falcor resolution
    # of point-drawn routes — the new catalog is never consulted for tmc
    # data). Statically: a comp definitely resolves iff its route is in
    # admin2.routes with a real tmc_array; a point-drawn route MIGHT
    # resolve via the old prod API at convert time (unknowable here).
    converted_pages = fetch_converted_pages()
    for r in records:
        valid = [rid for rid in r["route_ids"]
                 if rid in old_route_facts
                 and not old_route_facts[rid]["point_drawn"]]
        unknown = [rid for rid in r["route_ids"]
                   if old_route_facts.get(rid, {}).get("point_drawn")]
        if r["n_route_comps"] == 0:
            r["route_validity"] = "no_route_comps"
        elif valid:
            r["route_validity"] = "ok"
        elif unknown:
            r["route_validity"] = "hinges_on_point_resolution"
        else:
            r["route_validity"] = "no_valid_routes"
        r["converted_page_id"] = converted_pages.get(r["id"])
    validity_counts = Counter(r["route_validity"] for r in records)
    shells = [r for r in records if r["route_validity"] == "no_valid_routes"]

    # ── aggregates ──────────────────────────────────────────────────────
    class_counts = Counter(r["class"] for r in records)
    total_graphs = sum(r["n_graphs"] for r in records)
    total_mapped = sum(r["n_mapped"] for r in records)

    key_instances = Counter()
    key_reports = defaultdict(set)
    for r in records:
        for key in r["unmapped_keys"]:
            key_instances[key] += 1
            key_reports[key].add(r["id"])

    bucket_instances = Counter()
    bucket_report_sets = defaultdict(set)
    type_instances = Counter()
    measure_instances_buildable = Counter()
    resolution_instances_buildable = Counter()
    for key, n in key_instances.items():
        gtype, measure, resolution, dcol = key
        b = bucket_of(gtype)
        bucket_instances[b] += n
        bucket_report_sets[b] |= key_reports[key]
        type_instances[gtype] += n
        if b == "buildable":
            measure_instances_buildable[measure] += n
            resolution_instances_buildable[str(resolution)] += n

    gap_kind_instances = Counter()
    gap_kind_reports = defaultdict(set)
    for r in records:
        for g in r["gaps"]:
            gap_kind_instances[g["kind"]] += 1
            gap_kind_reports[g["kind"]].add(r["id"])

    # single-blocker flips: reports whose ENTIRE unmapped set is one key.
    # no_valid_routes shells are excluded from flip/greedy metrics — they
    # can never produce a page, so "flipping to full" is vacuous for them
    # (round-36 finding: shell report 678 falsely inflated round 34's
    # flip count).
    single_blocker_flips = Counter()
    for r in records:
        distinct = set(r["unmapped_keys"])
        if (r["class"] in ("partial", "none") and len(distinct) == 1
                and r["route_validity"] != "no_valid_routes"):
            single_blocker_flips[next(iter(distinct))] += 1

    # greedy cumulative: adding keys most-instances-first, how many reports
    # reach fully-convertible (page-producing reports only)
    full_producible = sum(1 for r in records if r["class"] == "full"
                          and r["route_validity"] != "no_valid_routes")
    remaining = {r["id"]: set(r["unmapped_keys"]) for r in records
                 if r["class"] in ("partial", "none")
                 and r["route_validity"] != "no_valid_routes"}
    greedy = []
    covered = set()
    for key, _ in key_instances.most_common():
        covered.add(key)
        flipped = sum(1 for s in remaining.values() if s <= covered)
        greedy.append({"key": list(map(str, key)),
                       "cumulative_full_reports":
                           flipped + full_producible})
        if len(greedy) >= 30:
            break

    summary = {
        "total_reports": len(records),
        "errors": errors,
        "class_counts": dict(class_counts),
        "graph_instances": {"total": total_graphs, "mapped": total_mapped,
                            "unmapped": total_graphs - total_mapped},
        "bucket_instances": dict(bucket_instances),
        "bucket_reports": {b: len(s) for b, s in bucket_report_sets.items()},
        "route_stats": route_stats,
        "route_validity_counts": dict(validity_counts),
        "full_producible": full_producible,
        "no_valid_routes_shells": [
            {"id": r["id"], "name": r["name"], "class": r["class"],
             "n_graphs": r["n_graphs"],
             "converted_page_id": r["converted_page_id"]}
            for r in shells],
        "converted_pages_total": len(converted_pages),
        "converted_shell_pages": [
            {"report_id": r["id"], "page_id": r["converted_page_id"]}
            for r in shells if r["converted_page_id"]],
        "gap_kinds": {k: {"instances": gap_kind_instances[k],
                          "reports": len(gap_kind_reports[k])}
                      for k in gap_kind_instances},
        "unmapped_keys_ranked": [
            {"key": list(map(str, key)), "bucket": bucket_of(key[0]),
             "instances": n, "reports": len(key_reports[key]),
             "single_blocker_flips": single_blocker_flips.get(key, 0)}
            for key, n in key_instances.most_common()],
        "unmapped_by_type": dict(type_instances.most_common()),
        "buildable_unmapped_by_measure":
            dict(measure_instances_buildable.most_common()),
        "buildable_unmapped_by_resolution":
            dict(resolution_instances_buildable.most_common()),
        "greedy_key_coverage": greedy,
    }

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(os.path.join(OUT_DIR, "census.json"), "w") as f:
        json.dump({"summary": summary, "reports": records}, f, indent=1)
    write_summary_md(summary)
    print(f"\nwrote {OUT_DIR}/census.json and census_summary.md")
    print(json.dumps({k: summary[k] for k in
                      ("class_counts", "graph_instances", "bucket_instances",
                       "route_stats", "route_validity_counts",
                       "converted_pages_total")}, indent=2))


def write_summary_md(s):
    L = []
    L.append("# Old-report conversion gap census\n")
    L.append(f"All {s['total_reports']} `admin2.reports` run through the "
             "converter's analyze path (analysis-only, "
             "`scripts/census_old_reports.py`).\n")
    cc = s["class_counts"]
    gi = s["graph_instances"]
    L.append("## Convertibility today\n")
    L.append("| class | reports | meaning |")
    L.append("|---|---|---|")
    L.append(f"| full | {cc.get('full', 0)} | every graph maps to a template |")
    L.append(f"| partial | {cc.get('partial', 0)} | some graphs map |")
    L.append(f"| none | {cc.get('none', 0)} | has graphs, none map |")
    L.append(f"| no_graphs | {cc.get('no_graphs', 0)} | route-list-only report |")
    L.append(f"\nGraph instances: **{gi['mapped']} / {gi['total']}** mapped "
             f"({gi['unmapped']} unmapped).\n")
    L.append("## Report-level route validity (round-33 `no_valid_routes` "
             "mirror)\n")
    L.append("Graph-mapping class above is orthogonal to whether the "
             "converter would produce a page at all: a report whose every "
             "route comp lacks a resolvable `tmc_array` is skipped "
             "entirely (permanently-empty shell otherwise).\n")
    rv = s["route_validity_counts"]
    L.append("| validity | reports | meaning |")
    L.append("|---|---|---|")
    L.append(f"| ok | {rv.get('ok', 0)} | ≥1 route with a real tmc_array — "
             "page producible |")
    L.append(f"| hinges_on_point_resolution | "
             f"{rv.get('hinges_on_point_resolution', 0)} | only point-drawn "
             "routes; page depends on convert-time falcor TMC resolution |")
    L.append(f"| no_valid_routes | {rv.get('no_valid_routes', 0)} | shell — "
             "converter skips page creation |")
    L.append(f"| no_route_comps | {rv.get('no_route_comps', 0)} | no routes "
             "at all (page created, nothing to feed graphs) |")
    shells = s["no_valid_routes_shells"]
    if shells:
        L.append("\nShell reports (never producible): "
                 + ", ".join(f"{r['id']} ({r['class']})" for r in shells)
                 + ".")
    csp = s["converted_shell_pages"]
    L.append(f"\nConverted pages live in the new DB: "
             f"**{s['converted_pages_total']}**."
             + (" **Shells with a live converted page (should be deleted, "
                "task item (e)): "
                + ", ".join(f"report {p['report_id']} → page {p['page_id']}"
                            for p in csp) + ".**" if csp
                else " No shell has a live converted page."))
    L.append("")
    bi = s["bucket_instances"]
    br = s["bucket_reports"]
    L.append("Unmapped instances by bucket: "
             + ", ".join(f"**{b}** {bi[b]} (in {br[b]} reports)"
                         for b in ("buildable", "no_equivalent", "tail")
                         if b in bi) + ".\n")
    L.append("## Unmapped (type × measure × resolution × dataColumn), ranked\n")
    L.append("`flips` = reports that become fully convertible from this one "
             "key alone.\n")
    L.append("| # | bucket | graph type | measure | resolution | dataColumn "
             "| instances | reports | flips |")
    L.append("|---|---|---|---|---|---|---|---|---|")
    for i, row in enumerate(s["unmapped_keys_ranked"][:40], 1):
        t, m, res, dc = row["key"]
        L.append(f"| {i} | {row['bucket']} | {t} | {m} | {res} | {dc} "
                 f"| {row['instances']} | {row['reports']} "
                 f"| {row['single_blocker_flips']} |")
    L.append("\n## Buildable-bucket marginals\n")
    L.append("By measure: " + ", ".join(
        f"{m} {n}" for m, n in s["buildable_unmapped_by_measure"].items())
        + ".\n")
    L.append("By resolution: " + ", ".join(
        f"{r} {n}" for r, n in s["buildable_unmapped_by_resolution"].items())
        + ".\n")
    L.append("By graph type (all buckets): " + ", ".join(
        f"{t} {n}" for t, n in s["unmapped_by_type"].items()) + ".\n")
    L.append("## Gap kinds (converter gap-report semantics)\n")
    L.append("| kind | instances | reports |")
    L.append("|---|---|---|")
    for k, v in sorted(s["gap_kinds"].items(),
                       key=lambda kv: -kv[1]["instances"]):
        L.append(f"| {k} | {v['instances']} | {v['reports']} |")
    rs = s["route_stats"]
    L.append("\n## Route-level work (not capability gaps)\n")
    L.append(f"- {rs['referenced']} distinct routes referenced by reports")
    L.append(f"- {rs['needs_catalog_insert']} need a Routes Data catalog "
             "insert at convert time")
    L.append(f"- {rs['point_drawn_needing_falcor']} are point-drawn (null "
             "tmc_array) and need old-falcor TMC resolution at convert time")
    L.append(f"- {len(rs['missing_everywhere'])} missing everywhere (broken "
             "references in the old system too): "
             + ", ".join(rs["missing_everywhere"][:20])
             + ("..." if len(rs["missing_everywhere"]) > 20 else ""))
    L.append("\n## Greedy coverage (cumulative fully-convertible reports as "
             "keys are added, most-instances-first)\n")
    L.append(f"Baseline = {s['full_producible']} page-producing full reports "
             "(`no_valid_routes` shells excluded from baseline and flips).\n")
    L.append("| +key | cumulative full reports |")
    L.append("|---|---|")
    for row in s["greedy_key_coverage"]:
        L.append(f"| {' / '.join(row['key'])} "
                 f"| {row['cumulative_full_reports']} |")
    if s["errors"]:
        L.append("\n## Analysis errors\n")
        for e in s["errors"]:
            L.append(f"- report {e['id']}: {e['error']}")
    with open(os.path.join(OUT_DIR, "census_summary.md"), "w") as f:
        f.write("\n".join(L) + "\n")


if __name__ == "__main__":
    main()
