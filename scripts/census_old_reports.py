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
      buildable      - Route Line/Bar Graph + TMC Grid Graph (types that
                       already have an AVL Graph equivalent) missing only a
                       measure/resolution/dataColumn combination
      no_equivalent  - stat panels/maps/diff-compare shapes ruled
                       gap-log-only by user decisions (2026-07-08)
      tail           - graph types never yet examined
  - Gap-kind counts (relative_date, overrides, mixed resolution, ...).
  - Route-level work: catalog upserts needed, point-drawn routes needing
    falcor resolution, routes missing everywhere.

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
    ROUTES_CATALOG_TABLE, analyze_graph, flatten_route_comps,
    route_settings_gaps, aadt_override_of, psql_old, psql_new,
)

OUT_DIR = os.path.join(REPO, "scratchpad/npmrds-sub/old-reports/census")

# Old graph types that already have a working AVL Graph equivalent — an
# unmapped key on one of these is a buildable capability (new calculated
# column / template), not a new component.
BUILDABLE_TYPES = {"Route Line Graph", "Route Bar Graph", "TMC Grid Graph"}
# Ruled gap-log-only (user decisions 2026-07-08): diff/compare are a
# different graph SHAPE; the rest are stat-panel/map component types with no
# AVL Graph equivalent ("same treatment as Route Map", task item 4).
NO_EQUIVALENT_TYPES = {
    "Route Difference Graph", "Route Compare Component", "TMC Difference Grid",
    "Route Map", "Route Info Box", "TMC Info Box", "Bar Graph Summary",
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
        if GRAPH_TEMPLATE_MAP.get(key):
            mapped.append((g, info, GRAPH_TEMPLATE_MAP[key]))
        else:
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

    # single-blocker flips: reports whose ENTIRE unmapped set is one key
    single_blocker_flips = Counter()
    for r in records:
        distinct = set(r["unmapped_keys"])
        if r["class"] in ("partial", "none") and len(distinct) == 1:
            single_blocker_flips[next(iter(distinct))] += 1

    # greedy cumulative: adding keys most-instances-first, how many reports
    # reach fully-convertible
    remaining = {r["id"]: set(r["unmapped_keys"]) for r in records
                 if r["class"] in ("partial", "none")}
    greedy = []
    covered = set()
    for key, _ in key_instances.most_common():
        covered.add(key)
        flipped = sum(1 for s in remaining.values() if s <= covered)
        greedy.append({"key": list(map(str, key)),
                       "cumulative_full_reports":
                           flipped + class_counts["full"]})
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
                       "route_stats")}, indent=2))


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
