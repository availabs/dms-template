import json

from .config import GRAPH_TEMPLATE_TYPE
from .vocab import PM3_VIEW_BY_YEAR
from .template_specs import TEMPLATE_BASE_NAME
from .graph_templates import ensure_bridge_graph_templates, ensure_dynamic_bridge_template
from .compose_bridge import call_compose_bridge
from .db import dms, now_iso

# Round 79 (2026-08-27): this module used to hand-build every Info Box
# Spreadsheet shape directly — 5 near-identical measure builders (speed/
# travelTime/length/aadt/hoursOfDelay), each with its own route-vs-tmc grain
# branch and its own drift-detection copy — the same class of "second,
# independent reimplementation" of composeMeasureConfig.js's own logic round
# 76 eliminated for GridGraph. `composeTableMeasuresConfig` (built 2026-08-21
# for an unrelated Table checkbox feature, extended this round with a `grain`
# param + a `length`/`aadt` TMC-grain expression override — see that file's
# own comments) already produces the exact same shapes; the 5 static measures
# below are now BRIDGE_GRAPH_SPECS entries (see template_specs.py), minted/
# drift-checked generically by `ensure_bridge_graph_templates`. Every public
# function here keeps its EXACT prior signature/contract — every existing
# caller (`convert_report.py`, `convert_template.py`, `section_builders.py`,
# `report_build.mjs` via its own Info Box section CLI flags) is unaffected;
# only the internals changed from hand-built dicts to bridge calls.
#
# Two things stay genuinely Python-side, for real reasons, not inertia:
# 1. `ensure_pm3_join_template` (reliability: LOTTR/TTTR/Freeflow) — its
#    template NAME (and composition) depends on a per-report resolved
#    (year, bin) pair, not expressible as a static BRIDGE_GRAPH_SPECS entry.
#    Delegates to `ensure_dynamic_bridge_template`, the single-name sibling
#    of `ensure_bridge_graph_templates` built for exactly this case.
# 2. `ensure_bar_graph_summary_pm3_template` (Bar Graph Summary's
#    `freeflow-byDateRange` measure) — BarGraph-shaped, not Table-shaped, and
#    `composeMeasureConfig.js` (the chart-shaped composer) has no reliability
#    concept at all yet, unlike `composeTableMeasuresConfig`. Left hand-built,
#    same "real structural reason, not oversight" class as round 77's
#    held-back entries.


def ensure_pm3_join_template(grain, year, bin_, templates, dry_run):
    """Mint (or reuse/drift-fix) `{grain}_info_box_reliability_{year}_{bin_}`
    — one shared template per (grain, year, bin), reused across every report
    matching that year/bin, same model as every other Info Box measure.
    `bin_` must be one of RELIABILITY_BIN_BY_PEAK_FLAG's values (amp/midd/
    pmp) or 'we' — the caller (graph_reliability_bin) never passes anything
    else."""
    name = f"{grain}_info_box_reliability_{year}_{bin_}"
    spec = {
        "graphType": "Table", "measureKeys": [], "resolutionKey": "summary",
        "includeReliability": True, "reliabilityBin": bin_, "reliabilityYear": year,
        "grain": grain, "pageSize": 50, "showAttribution": True,
    }
    return ensure_dynamic_bridge_template(name, spec, templates, dry_run)


def ensure_info_box_traveltime_template(grain, templates, dry_run):
    """Mint (or reuse/drift-fix) `{grain}_info_box_traveltime`."""
    return ensure_bridge_graph_templates(
        {f"{grain}_info_box_traveltime"}, templates, dry_run)


def ensure_info_box_speed_template(grain, templates, dry_run):
    """Mint (or reuse/drift-fix) `{grain}_info_box_speed`."""
    return ensure_bridge_graph_templates(
        {f"{grain}_info_box_speed"}, templates, dry_run)


def ensure_info_box_length_template(grain, templates, dry_run):
    """Mint (or reuse/drift-fix) `{grain}_info_box_length`."""
    return ensure_bridge_graph_templates(
        {f"{grain}_info_box_length"}, templates, dry_run)


def ensure_info_box_aadt_template(grain, templates, dry_run):
    """Mint (or reuse/drift-fix) `{grain}_info_box_aadt`."""
    return ensure_bridge_graph_templates(
        {f"{grain}_info_box_aadt"}, templates, dry_run)


def ensure_info_box_delay_template(grain, templates, dry_run):
    """Mint (or reuse/drift-fix) `{grain}_info_box_delay`."""
    return ensure_bridge_graph_templates(
        {f"{grain}_info_box_delay"}, templates, dry_run)


def ensure_bar_graph_summary_pm3_template(year, templates, dry_run):
    """Mint (or reuse) `tmc_freeflow_summary_bar_graph_{year}` — Bar Graph
    Summary's `freeflow-byDateRange` measure (round 38, Phase B item (c)),
    one bar per route/comp via pm3's `speed_pctl_85` (same column Info Box's
    freeflow already uses, round 22's "current/correct pm3 value, not
    old-math replica" precedent — round 17 — extended here even though the
    old tool's own BarGraphSummary.jsx used a plain per-TMC speed mean for
    this key, not a percentile). Bin-independent (1410's speed percentiles
    have no time-of-day dimension) so only `year` needs resolving, same
    idiom as ensure_pm3_join_template but Bar-Graph-shaped (`xAxis:
    "__series"`, one calculated yAxis column) instead of a Spreadsheet.

    Kept hand-built (round 79): BarGraph-shaped, not Table-shaped —
    `composeMeasureConfig.js` (the chart-shaped composer `compose_bridge.mjs`
    calls for AVL Graph requests) has no reliability/pm3-join concept at all
    yet, unlike `composeTableMeasuresConfig`."""
    name = f"tmc_freeflow_summary_bar_graph_{year}"
    if templates.get(name) is not None:
        return templates  # static per year — nothing further to drift-check
    base = templates.get(TEMPLATE_BASE_NAME)
    if not base:
        raise RuntimeError(f"base template '{TEMPLATE_BASE_NAME}' not found")
    base_state = json.loads(base["data"]["stateJson"])
    view_id = PM3_VIEW_BY_YEAR[year]

    series_col = next(c for c in base_state["columns"]
                      if c.get("name") == "__series")
    series_col.setdefault("customName", "Route")
    x_col = {**series_col, "target": "xAxis"}
    freeflow_col = {"type": "calculated", "show": True,
                    "name": "pm3.speed_pctl_85 as freeflow", "target": "yAxis",
                    "fn": "avg", "customName": "Freeflow (mph)"}

    state = {
        "externalSource": base_state["externalSource"],
        "columns": [freeflow_col, x_col],
        "filters": base_state.get("filters") or {"op": "AND", "groups": []},
        "display": {**base_state.get("display", {}), "graphType": "BarGraph",
                    "legend": {"show": False}},
        "join": {"sources": {"pm3": {
            "pgFederated": {"pgEnv": "npmrds2", "table": f"s1410_v{view_id}_pm_3",
                            "schema": "gis_datasets"},
            "joinColumns": [{"dsColumn": "tmc", "joinSourceColumn": "tmc"}],
            "mergeStrategy": "join", "type": "left",
        }}},
        "customBuckets": base_state.get("customBuckets"),
        "comparisonSeries": base_state.get("comparisonSeries"),
    }

    if dry_run:
        print(f"[dry-run] would create template '{name}'")
        templates[name] = {"id": None, "data": {"name": name,
                           "stateJson": json.dumps(state),
                           "elementType": "AVL Graph",
                           "updatedAt": now_iso()}}
        return templates
    data = {
        "name": name, "slug": name,
        "stateJson": json.dumps(state),
        "layoutJson": base["data"].get("layoutJson"),
        "elementType": "AVL Graph", "componentType": "AVL Graph",
        "includesLayout": base["data"].get("includesLayout", False),
        "includesSource": base["data"].get("includesSource", True),
        "createdAt": now_iso(), "createdBy": base["data"].get("createdBy"),
        "updatedAt": now_iso(), "updatedBy": base["data"].get("updatedBy"),
    }
    r = dms(["raw", "create", "npmrdsv5", GRAPH_TEMPLATE_TYPE], data=data)
    templates[name] = {"id": r["id"], "data": data}
    print(f"created template '{name}' id={r['id']}")
    return templates


# ── Multi-measure Info Box composition (2026-08-12, ported to the bridge 2026-08-27) ──
# Ryan's old-tool comparison found the real Route Info Box shows N measures as
# N columns in ONE box (e.g. "Speed, Travel Time"). `composeTableMeasuresConfig`
# already accepts multiple `measureKeys` natively in one call, with its own
# generic union-join logic (round 76's own "one shared source of truth, not a
# second Python reimplementation" argument applies here too) — so this no
# longer needs to call each measure's own ensure_* function and manually
# stitch their columns/joins together; one bridge call does it.
#
# `reliability` is still deliberately excluded from combination with anything
# else: untested whether composeTableMeasuresConfig's join-merge produces a
# correct query when a pm3 join and a plain ClickHouse join coexist (its own
# code accepts the combination mechanically, but nobody has verified the
# result is CORRECT) — kept as an explicit guard rather than silently
# exercising new, unverified territory. speed/travelTime/length/aadt/
# hoursOfDelay all agree on table1=META_JOIN (hoursOfDelay's extra table2
# never collides — confirmed via buildJoinFromKeys' own Set-based union,
# which always resolves table1/table2 consistently regardless of measure
# order), so no other combination needs rejecting.
def check_info_box_measure_combo(measures):
    """Raises ValueError with a clear message if `measures` (a list of >= 2
    vocabulary.json measure keys) can't safely share one query. Called before
    any bridge call so a bad combo fails fast."""
    if "reliability" in measures:
        raise ValueError(
            "Info Box measure 'reliability' can't be combined with other measures yet "
            "— it needs a separate pm3 (pgFederated) join, a different mechanism from "
            "the plain joins every other measure uses, and combining the two hasn't "
            "been verified. Use 'reliability' alone, or drop it from this combination.")


def build_route_info_box_section_state_multi(measures, grain, templates, dry_run):
    """Multi-measure counterpart to build_route_info_box_section_state —
    composes fresh via one bridge call rather than cloning a shared template
    (mirrors composeMeasureConfig.js's own AVL Graph shape: no single named
    row is the source of truth for a combo). `measures` must be >= 2 vocab
    measure keys, already validated by check_info_box_measure_combo."""
    check_info_box_measure_combo(measures)
    composed = call_compose_bridge([{
        "key": "info_box_multi", "graphType": "Table", "measureKeys": list(measures),
        "resolutionKey": "summary", "grain": grain,
        "pageSize": 50, "showAttribution": True,
    }])
    if "info_box_multi" not in composed:
        raise RuntimeError(
            f"compose_bridge.mjs returned nothing for Info Box measures "
            f"{measures} (grain={grain}) — check they're known to "
            f"vocabulary.json's measures")
    # Never persisted as a named/shared template — this is this report's own
    # private composed state (mirrors composeMeasureConfig.js's AVL Graph
    # shape). report_build.mjs writes it straight into the section row.
    return "Spreadsheet", composed["info_box_multi"]
