from .compose_bridge import call_compose_bridge
from .graph_templates import ensure_bridge_graph_templates

# Round 78 (2026-08-27): this module used to hand-build Route Compare
# Component's Spreadsheet column shape directly (value column + `__ANCHOR__`
# delta column) — the same class of "second, independent reimplementation" of
# composeMeasureConfig.js's own logic that round 76 eliminated for GridGraph.
# `composeTableMeasuresConfig`'s `routeCompare`/`buildRouteCompareDeltaColumn`
# (built 2026-08-21 for an unrelated Table "Route Compare" checkbox feature)
# already produces the exact same shape — confirmed byte-identical
# `__ANCHOR__(...)` construction, rounding-residual guard, and
# `deltaGoodDirection` logic before migrating (see BRIDGE_GRAPH_SPECS'
# `route_compare_speed`/`route_compare_travelTime` entries in
# template_specs.py). Both public functions below keep their exact prior
# signatures/contracts — every existing caller (`convert_report.py`,
# `convert_template.py`, `section_builders.py`, `report_build.mjs` via
# `--route-compare-section`) is unaffected; only the internals changed from
# hand-built dicts to a bridge call.


def ensure_route_compare_template(measure, templates, dry_run):
    """Mint (or reuse/drift-fix) the SHARED, generic Route Compare Component
    Spreadsheet template for `measure` — one row per assigned comp (the
    report's own comparisonSeries arms), plus a delta column showing each
    row's %-difference from the ANCHOR (whichever comp is first in the page's
    own route list — dms-server's `__ANCHOR__(<expr>)` mechanism resolves
    this dynamically per request, same as every other self-bound section).

    Nothing report-specific is baked into the SQL (no base route, no literal
    label) — so, like every other BRIDGE_GRAPH_SPECS entry, this is one
    shared template per measure, reused across every report; delegates
    straight to `ensure_bridge_graph_templates` (mint + drift-detect) for the
    single name `route_compare_{measure}`."""
    name = f"route_compare_{measure}"
    return ensure_bridge_graph_templates({name}, templates, dry_run)


# ── Multi-measure Route Compare composition (2026-08-12, ported to the bridge 2026-08-27) ──
# Same "compose fresh, don't mint a combo-named template" shape as Info Box's
# build_route_info_box_section_state_multi — nothing report-specific is
# baked in here either, but a combo (e.g. Speed + Travel Time) isn't a
# BRIDGE_GRAPH_SPECS-minted named template the way a single measure is;
# `composeTableMeasuresConfig` already accepts multiple `measureKeys` natively
# in one call (unlike the old hand-built version, which stitched together two
# separately-minted single-measure templates' own columns), so this is a
# direct one-off bridge call, not a second composition path.
def build_route_compare_section_state_multi(measures, templates=None, dry_run=None):
    """Multi-measure counterpart to ensure_route_compare_template. `measures`
    must be >= 2 entries known to vocabulary.json's measures (speed/
    travelTime today). Returns (element_type, state) — mirrors
    build_route_info_box_section_state's return shape, not persisted as a
    named/shared template. `templates`/`dry_run` are no longer used
    internally (kept as optional params only so existing call sites that
    still pass them don't need updating)."""
    requests = [{"key": "route_compare_multi", "graphType": "Table",
                 "measureKeys": measures, "resolutionKey": "summary",
                 "routeCompare": True, "pageSize": 50, "showAttribution": True}]
    composed = call_compose_bridge(requests)
    if "route_compare_multi" not in composed:
        raise RuntimeError(
            f"compose_bridge.mjs returned nothing for Route Compare measures "
            f"{measures} — check they're known to vocabulary.json's measures")
    return "Spreadsheet", composed["route_compare_multi"]
