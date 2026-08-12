import json
import os
import uuid

from .config import COMPONENT_TYPE, GAPS_DIR, PATTERN, REPORTS_SNAP_TYPE
from .vocab import BAR_SUMMARY_PM3_BUCKET, COLOR_RANGE_GRAPH_TYPES, DIFFERENCE_GRAPH_TYPES, GRAPH_TEMPLATE_MAP, INFO_BOX_AADT_BUCKET, INFO_BOX_BUCKET, INFO_BOX_DELAY_BUCKET, INFO_BOX_GRAIN, INFO_BOX_LENGTH_BUCKET, INFO_BOX_TRAVELTIME_BUCKETS, PM3_VIEW_BY_YEAR, RELIABILITY_BIN_LABELS, ROUTE_COMPARE_BUCKET
from .expressions import ROUTE_MAP_AVGDELAY_RESOLUTION_SLUG, ROUTE_MAP_AVGDELAY_VALUE_EXPR_BY_RESOLUTION, aadt_override_of
from .template_specs import MEASURE_EXPR
from .db import dms, fetch_old_report, fetch_old_routes, flatten_route_comps, now_iso
from .dates import report_is_pre_2017_only, resolve_relative_dates
from .transforms import build_route_entry, group_route_comps, route_comp_display_name, route_comp_merge_key
from .graph_templates import ensure_graph_templates, graph_max_year, graph_reliability_bin, load_graph_templates
from .info_box_templates import ensure_bar_graph_summary_pm3_template, ensure_info_box_aadt_template, ensure_info_box_delay_template, ensure_info_box_length_template, ensure_info_box_traveltime_template, ensure_pm3_join_template
from .route_compare_template import ensure_route_compare_template
from .route_map import GEOMETRY_TILE_VIEWS, ensure_route_map_avghoursofdelay_template, ensure_route_map_hoursofdelay_template, ensure_route_map_none_template, ensure_route_map_speed_template, ensure_route_map_traveltime_template
from .section_builders import analyze_graph, build_cloned_section_data, build_graph_section_data, load_page_template, resolve_difference_pair, resolve_tmc_array, template_framework_sections
from .pages import compute_report_slug, delete_converted_page, ensure_parent_page, ensure_route_in_catalog, find_page_by_old_report_id

# ── Main conversion ──────────────────────────────────────────────────────────

def convert_report(old_id, dry_run=False, replace=False):
    gaps = []
    old = fetch_old_report(old_id)
    print(f"\n=== old report {old_id}: '{old['name']}' ===")

    existing = find_page_by_old_report_id(old_id)
    if existing:
        if not replace:
            raise RuntimeError(
                f"page for old report {old_id} already exists (id {existing}) "
                f"— pass --replace")
        if dry_run:
            print(f"[dry-run] would delete existing page {existing} first")
        else:
            delete_converted_page(existing)

    title = old["name"] or f"Report {old_id}"
    slug = compute_report_slug(title, exclude_id=existing)

    # -- old-side pieces
    route_comps = flatten_route_comps(old.get("route_comps"), gaps)
    resolve_relative_dates(route_comps, gaps)

    # A report where EVERY route_comp is pre-2017-only has nothing
    # recoverable to convert — npmrds.s583_v982_NPMRDS_V6 (the fact table
    # backing every measure in this pipeline) starts in 2017, so no amount
    # of template work will ever make it render real data. Checked before
    # any old-route fetch or graph analysis since it needs nothing else;
    # mirrors the no_valid_routes report-level skip below (round 39,
    # restored round 53 after rounds 41-52's rewrites silently dropped it).
    if report_is_pre_2017_only(route_comps):
        gaps.append({"kind": "pre_2017_only",
                     "detail": "every route_comp in this report predates "
                               "2017-01-01 (npmrds.s583_v982_NPMRDS_V6 starts "
                               "2017) — permanently unrecoverable, page not "
                               "created"})
        verb = "would skip" if dry_run else "skipped"
        print(f"[{verb}] creating page '{slug}' ('{old['name']}') — every "
              f"route_comp in this report predates 2017")
        return finish(old_id, old, None, gaps, dry_run)

    old_routes = fetch_old_routes([rc["routeId"] for rc in route_comps
                                   if rc.get("routeId")])
    if old.get("station_comps"):
        gaps.append({"kind": "station_comps",
                     "detail": f"{len(old['station_comps'])} station comps not converted"})
    # Stamp each comp with its old-client display name (settings.compTitle
    # substitution — see route_comp_display_name). These become the
    # comparison-series `__series` labels, so sibling comps of one route MUST
    # get distinct names or their arms visually merge into one series. Any
    # residual collision (two comps whose resolved titles are literally
    # identical) is deduped with the compId — the old client keyed rows by
    # compId and only DISPLAYED the name, so duplicates were harmless there;
    # here the label IS the series key.
    seen_names = {}
    for rc in route_comps:
        # Stashed before the peak/date-labeled display name overwrites
        # rc["name"] below — the merged-route-entry generic-name fallback
        # (when old_route itself has no name) needs the comp's own bare
        # pre-substitution name, not the compTitle-rendered one.
        rc["_raw_name"] = rc.get("name")
        name = route_comp_display_name(rc, old_routes.get(str(rc.get("routeId"))))
        if name in seen_names:
            deduped = f"{name} ({rc.get('compId')})"
            gaps.append({"kind": "route_name_deduped", "route": name,
                         "detail": f"{rc.get('compId')} renamed to '{deduped}' "
                                   f"(same resolved title as {seen_names[name]})"})
            name = deduped
        else:
            seen_names[name] = rc.get("compId")
        rc["name"] = name
    # Round 40 bug fix: 817/854 corpus reports (96%) have at least one
    # graph_comp with no `id` field at all (the documented old shape,
    # `id: 'graph-comp-N'`, simply isn't there for most of the corpus —
    # confirmed directly, not just the handful of "ancient version 2"
    # reports the id-less case was previously assumed to be limited to).
    # Every dynamic per-graph decision below (Info Box template choice,
    # Route Compare, Bar Graph Summary pm3 year) is keyed by `g.get("id")`
    # in an in-memory dict — when multiple graphs in the same report share
    # `id: None`, they collide on that key and whichever is processed LAST
    # silently overwrites every earlier graph's template assignment, even
    # though the eventual new-side section/trackingId is unique and
    # unaffected. Live-caught 2026-07-14 on report 33: a `speed` reliability
    # graph and an `avgTT-byDateRange` graph were both silently overwritten
    # with the report's (unrelated) `aadt` graph's template. Fix: assign a
    # stable, unique-within-this-report synthetic id (array position) to
    # any graph_comp missing one, before any gid-keyed dict is built.
    for i, g in enumerate(old.get("graph_comps") or []):
        if g.get("id") is None:
            g["id"] = f"graph-idx-{i}"
    # -- per-graph analysis + template mapping
    comps_by_id = {rc.get("compId"): rc for rc in route_comps if rc.get("compId")}
    graph_templates = load_graph_templates()
    page_template = load_page_template()
    analyzed = [(g, analyze_graph(g, comps_by_id, gaps))
                for g in old.get("graph_comps") or []]

    # Route Difference Graph / TMC Difference Grid (round 52): resolve the old
    # tool's Main/Compare pair FIRST — before template selection — because the
    # graph renders at the PAIR's settings, not across every assigned comp
    # (analyze_graph's generic branch derives resolution/dataColumn from the
    # full assigned set, which on a multi-comp report can be "mixed" even
    # though the pair itself agrees). Runs before `needed` below so the
    # re-derived resolution participates in template minting.
    route_diff_invert = {}
    route_diff_gap_logged = set()
    comp_order = [rc.get("compId") for rc in route_comps]
    for g, info in analyzed:
        if info["type"] not in DIFFERENCE_GRAPH_TYPES:
            continue
        gid = g.get("id")
        pair, why = resolve_difference_pair(g.get("state") or {}, route_comps,
                                            old_routes)
        if not pair:
            gaps.append({"kind": "route_difference_no_pair", "graph": gid,
                         "detail": why})
            route_diff_gap_logged.add(gid)
            continue
        main_rc, compare_rc = pair
        info["assigned"] = [main_rc["compId"], compare_rc["compId"]]
        # Pair partners always share settings.resolution (matcher
        # requirement); a string state.resolution still overrides, exactly
        # as in analyze_graph (non-string malformations were already
        # gap-logged there).
        state_res = (g.get("state") or {}).get("resolution")
        info["resolution"] = (state_res if isinstance(state_res, str) and state_res
                              else (main_rc.get("settings") or {}).get("resolution")
                              or "5-minutes")
        pair_cols = {(rc.get("settings") or {}).get("dataColumn")
                     for rc in (main_rc, compare_rc)}
        if len(pair_cols) == 1:
            info["data_column"] = next(iter(pair_cols))
        else:
            info["data_column"] = None
            gaps.append({"kind": "route_difference_mixed_data_columns",
                         "graph": gid, "detail": sorted(map(str, pair_cols))})
        # Published variant order follows the page's shared route list (RRL
        # publishes routes filtered per graph, in list order) — when Main sits
        # AFTER Compare there (reversed explicit pairs are real, e.g. old
        # report 12's ['comp-1','comp-0']), the section's combine config gets
        # invert=true so the rendered subtraction stays Main − Compare.
        route_diff_invert[gid] = (comp_order.index(main_rc["compId"])
                                  > comp_order.index(compare_rc["compId"]))

    needed = {GRAPH_TEMPLATE_MAP.get((i["type"], i["measure"], i["resolution"],
                                      i["data_column"]))
              for _, i in analyzed if i["type"] not in INFO_BOX_GRAIN} - {None}
    graph_templates = ensure_graph_templates(needed, graph_templates, dry_run)

    # Route/TMC Info Box: resolve + mint the period-matched pm3 template per
    # graph (see INFO_BOX_GRAIN above) before the main mapping pass below, so
    # it can use the same graph_templates lookup as every other graph type.
    info_box_tmpl_name = {}
    info_box_bin_year = {}
    info_box_gap_logged = set()
    for g, info in analyzed:
        grain = INFO_BOX_GRAIN.get(info["type"])
        if not grain:
            continue
        gid = g.get("id")
        measure_col = (info["measure"], info["data_column"])
        if measure_col in INFO_BOX_TRAVELTIME_BUCKETS:
            # Round 38 (Phase B) + round 40 (plain `travelTime` alias): plain
            # CH travel time, no pm3/year/bin dependency — see
            # ensure_info_box_traveltime_template.
            graph_templates = ensure_info_box_traveltime_template(
                grain, graph_templates, dry_run)
            info_box_tmpl_name[gid] = f"{grain}_info_box_traveltime"
            continue
        if measure_col == INFO_BOX_LENGTH_BUCKET:
            graph_templates = ensure_info_box_length_template(
                grain, graph_templates, dry_run)
            info_box_tmpl_name[gid] = f"{grain}_info_box_length"
            continue
        if measure_col == INFO_BOX_AADT_BUCKET:
            graph_templates = ensure_info_box_aadt_template(
                grain, graph_templates, dry_run)
            info_box_tmpl_name[gid] = f"{grain}_info_box_aadt"
            continue
        if measure_col == INFO_BOX_DELAY_BUCKET:
            graph_templates = ensure_info_box_delay_template(
                grain, graph_templates, dry_run)
            info_box_tmpl_name[gid] = f"{grain}_info_box_delay"
            continue
        if measure_col != INFO_BOX_BUCKET:
            continue  # outside the join's bucket — falls through to the
                      # generic "no template mapping" gap below, same as any
                      # other uncovered GRAPH_TEMPLATE_MAP combination
        year = graph_max_year(info, comps_by_id)
        bin_ = graph_reliability_bin(info, comps_by_id)
        if year is None:
            gaps.append({"kind": "info_box_year_undetermined", "graph": gid,
                         "detail": "no assigned comp has a startDate/endDate "
                                   "to period-match the pm3 join"})
            info_box_gap_logged.add(gid)
        elif year not in PM3_VIEW_BY_YEAR:
            gaps.append({"kind": "info_box_year_outside_pm3_coverage", "graph": gid,
                         "detail": f"max year {year} outside 1410's "
                                   f"{min(PM3_VIEW_BY_YEAR)}-{max(PM3_VIEW_BY_YEAR)} coverage"})
            info_box_gap_logged.add(gid)
        elif bin_ is None:
            gaps.append({"kind": "info_box_bin_undetermined", "graph": gid,
                         "detail": "assigned comp(s) don't land unambiguously on "
                                   "exactly one of 1410's real bins (amp/midd/pmp/"
                                   "we) — e.g. 0 or 2-3 peak flags true, a mixed "
                                   "weekday+weekend selection, or a custom "
                                   "startTime/endTime with no peak flag; no "
                                   "precomputed value exists for any of those"})
            info_box_gap_logged.add(gid)
        else:
            graph_templates = ensure_pm3_join_template(grain, year, bin_, graph_templates, dry_run)
            info_box_tmpl_name[gid] = f"{grain}_info_box_reliability_{year}_{bin_}"
            info_box_bin_year[gid] = (year, bin_)

    # Bar Graph Summary freeflow-byDateRange: same per-report/year pm3 join as
    # the Info Box reliability bucket above, but bin-independent — see
    # BAR_SUMMARY_PM3_BUCKET/ensure_bar_graph_summary_pm3_template.
    bar_summary_pm3_tmpl_name = {}
    bar_summary_pm3_gap_logged = set()
    for g, info in analyzed:
        if (info["type"] != "Bar Graph Summary"
                or (info["measure"], info["data_column"]) != BAR_SUMMARY_PM3_BUCKET):
            continue
        gid = g.get("id")
        year = graph_max_year(info, comps_by_id)
        if year is None:
            gaps.append({"kind": "bar_summary_freeflow_year_undetermined", "graph": gid,
                         "detail": "no assigned comp has a startDate/endDate "
                                   "to period-match the pm3 join"})
            bar_summary_pm3_gap_logged.add(gid)
        elif year not in PM3_VIEW_BY_YEAR:
            gaps.append({"kind": "bar_summary_freeflow_outside_pm3_coverage", "graph": gid,
                         "detail": f"max year {year} outside 1410's "
                                   f"{min(PM3_VIEW_BY_YEAR)}-{max(PM3_VIEW_BY_YEAR)} coverage"})
            bar_summary_pm3_gap_logged.add(gid)
        else:
            graph_templates = ensure_bar_graph_summary_pm3_template(year, graph_templates, dry_run)
            bar_summary_pm3_tmpl_name[gid] = f"tmc_freeflow_summary_bar_graph_{year}"

    # Route Compare Component: base (first assigned comp) + N compare rows,
    # %-diff-from-base via a delta column (round 24) — see
    # ensure_route_compare_template above. Only ROUTE_COMPARE_BUCKET is
    # supported this round; anything else falls through to the generic
    # unmapped_graph gap below, same as any other uncovered combination.
    route_compare_tmpl_name = {}
    route_compare_gap_logged = set()
    for g, info in analyzed:
        if info["type"] != "Route Compare Component":
            continue
        gid = g.get("id")
        if info["measure"] not in MEASURE_EXPR:
            continue  # outside this round's supported measure — generic gap below
        # Resolution is deliberately NOT part of this match (2026-07-20):
        # ensure_route_compare_template's MEASURE_EXPR is a whole-date-range
        # self-aggregating expression with no resolution dimension at all,
        # matching RouteCompareComponent.jsx's own real behavior (see the
        # resolution_irrelevant note in analyze_graph above) — info["resolution"]
        # is frequently None here (mixed across comps) and that's fine.
        if (info["measure"], info["data_column"]) != (ROUTE_COMPARE_BUCKET[0], ROUTE_COMPARE_BUCKET[2]):
            continue
        if len(info["assigned"]) < 2:
            gaps.append({"kind": "route_compare_insufficient_comps", "graph": gid,
                         "detail": f"{len(info['assigned'])} assigned comp(s), need >= 2 "
                                   f"(one base + at least one compare row)"})
            route_compare_gap_logged.add(gid)
            continue
        graph_templates = ensure_route_compare_template(
            info["measure"], graph_templates, dry_run)
        route_compare_tmpl_name[gid] = f"route_compare_{info['measure']}"

    # Route Map: "none" (geometry-only overview map, M0b), "speed" (CH-joined
    # choropleth, M2 — 256 corpus instances / 214 reports / 45 single-blocker
    # flips, the single biggest lever in the corpus), "travelTime" (M3 —
    # same shape as speed, see ensure_route_map_traveltime_template),
    # "hoursOfDelay" (M3 — two-source join, resolution-invariant, see
    # HOURS_OF_DELAY_VALUE_EXPR), "avgHoursOfDelay" (M3 — the one Route Map
    # measure that IS resolution-dependent, see
    # ROUTE_MAP_AVGDELAY_VALUE_EXPR_BY_RESOLUTION; scoped to day/5-minutes
    # only, the only resolutions the real corpus uses). One shared template
    # per network YEAR for each of the others (graph_max_year, same
    # period-matching idiom as the pm3 join above); resolution is irrelevant
    # to none/speed/travelTime/hoursOfDelay (round-41 scope note: whole-range
    # per-TMC aggregate).
    route_map_tmpl_name = {}
    route_map_gap_logged = set()
    for g, info in analyzed:
        if info["type"] != "Route Map" or info["measure"] not in (
                "none", "speed", "travelTime", "hoursOfDelay", "avgHoursOfDelay"):
            continue
        gid = g.get("id")
        if (info["measure"] == "avgHoursOfDelay"
                and info["resolution"] not in ROUTE_MAP_AVGDELAY_VALUE_EXPR_BY_RESOLUTION):
            gaps.append({"kind": "route_map_avghoursofdelay_unsupported_resolution",
                         "graph": gid,
                         "detail": f"resolution {info['resolution']!r} not built "
                                   f"(only day/5-minutes are — 0 corpus instances "
                                   f"at any other resolution as of round 50)"})
            route_map_gap_logged.add(gid)
            continue
        year = graph_max_year(info, comps_by_id)
        if year is not None:
            # Clamp into the provisioned geometry-view range: pre-2017 dates
            # only reach here on mixed reports (pre-2017-ONLY reports are
            # skipped upstream), and the oldest network is the best stand-in.
            year = min(max(year, min(GEOMETRY_TILE_VIEWS)),
                       max(GEOMETRY_TILE_VIEWS))
        if year is None:
            gaps.append({"kind": "route_map_no_year", "graph": gid,
                         "detail": "no parseable comp dates to pick a "
                                   "geometry network year"})
            route_map_gap_logged.add(gid)
            continue
        if info["measure"] == "none":
            graph_templates = ensure_route_map_none_template(
                year, graph_templates, dry_run)
            route_map_tmpl_name[gid] = f"route_map_none_{year}"
        elif info["measure"] == "speed":
            graph_templates = ensure_route_map_speed_template(
                year, graph_templates, dry_run)
            route_map_tmpl_name[gid] = f"route_map_speed_{year}"
        elif info["measure"] == "travelTime":
            graph_templates = ensure_route_map_traveltime_template(
                year, graph_templates, dry_run)
            route_map_tmpl_name[gid] = f"route_map_travelTime_{year}"
        elif info["measure"] == "hoursOfDelay":
            graph_templates = ensure_route_map_hoursofdelay_template(
                year, graph_templates, dry_run)
            route_map_tmpl_name[gid] = f"route_map_hoursOfDelay_{year}"
        else:
            # NOTE: deliberately-scoped local names (avgdelay_resolution/
            # avgdelay_slug), not `resolution`/`slug` -- this loop runs
            # inside convert_report(), which has its OWN function-level
            # `slug = f"report_{old_id}"` (the actual page slug) set earlier;
            # Python has no per-block scoping, so reusing either name here
            # would silently clobber that variable for the rest of the
            # function. Caught live: report 1056/1033 both got created with
            # slug "day"/"5min" instead of "report_1056"/"report_1033"
            # before this rename.
            avgdelay_resolution = info["resolution"]
            graph_templates = ensure_route_map_avghoursofdelay_template(
                year, avgdelay_resolution, graph_templates, dry_run)
            avgdelay_slug = ROUTE_MAP_AVGDELAY_RESOLUTION_SLUG[avgdelay_resolution]
            route_map_tmpl_name[gid] = f"route_map_avgHoursOfDelay_{avgdelay_slug}_{year}"

    convertible, skipped = [], []
    for g, info in analyzed:
        gid = g.get("id")
        is_info_box = info["type"] in INFO_BOX_GRAIN
        is_route_compare = info["type"] == "Route Compare Component"
        is_route_map = info["type"] == "Route Map"
        is_bar_summary_pm3 = (info["type"] == "Bar Graph Summary"
                             and (info["measure"], info["data_column"]) == BAR_SUMMARY_PM3_BUCKET)
        key = (info["type"], info["measure"], info["resolution"],
               info["data_column"])
        # A pairless difference graph must skip even though its bucket has a
        # template — the old tool renders nothing below 2 matched comps, and
        # a converted section with <2 assigned comps would just be an empty
        # placeholder wired to a real template.
        if gid in route_diff_gap_logged:
            skipped.append(g)
            continue  # specific reason already gap-logged in the pre-pass
        tmpl_name = (info_box_tmpl_name.get(gid) if is_info_box
                    else route_compare_tmpl_name.get(gid) if is_route_compare
                    else route_map_tmpl_name.get(gid) if is_route_map
                    else bar_summary_pm3_tmpl_name.get(gid) if is_bar_summary_pm3
                    else GRAPH_TEMPLATE_MAP.get(key))
        if tmpl_name and tmpl_name in graph_templates:
            convertible.append((g, info, graph_templates[tmpl_name]))
            continue
        skipped.append(g)
        if (gid in info_box_gap_logged or gid in route_compare_gap_logged
                or gid in route_map_gap_logged or gid in bar_summary_pm3_gap_logged):
            continue  # specific reason already gap-logged above
        gaps.append({"kind": "unmapped_graph", "detail": {
            "graph": gid, "graph_type": info["type"],
            "measure": info["measure"], "resolution": info["resolution"],
            "dataColumn": info["data_column"],
            "reason": ("no template mapping" if not tmpl_name
                       else f"template '{tmpl_name}' not found in DB")}})

    # overrides.aadt — decide per convertible graph whether the override can
    # be baked into its cloned calculated column. Only templates whose
    # expressions read table1.aadt consume it (delay/CO₂) — on anything else
    # the override was query-inert in the old tool too (getAADT is only called
    # from the delay/CO₂ calcs), so nothing is lost or logged. Overrides on
    # comps feeding SKIPPED graphs are subsumed by those graphs' own
    # unmapped_graph gaps (the whole graph is lost, not just its override).
    graph_aadt_overrides = []
    for g, info, tmpl in convertible:
        per_comp = [aadt_override_of(comps_by_id[c]) for c in info["assigned"]]
        distinct = set(per_comp)
        consuming = "table1.aadt" in (tmpl["data"].get("stateJson") or "")
        value = None
        if consuming and distinct != {None}:
            if len(distinct) == 1:
                value = per_comp[0]
            else:
                # per-comp overrides diverge but the calculated column is
                # shared across every comparison-series arm — can't express
                gaps.append({"kind": "aadt_override_mixed",
                             "graph": g.get("id"),
                             "detail": sorted(str(x) for x in distinct)})
        graph_aadt_overrides.append(value)

    # `color_range` is only a real gap if a colorful-type graph (see
    # COLOR_RANGE_GRAPH_TYPES) actually failed to convert — for one that DID
    # convert, build_graph_section_data below wires the real color_range into
    # the new template's display.colors.value, so there's nothing lost.
    if old.get("color_range") and any(
            g.get("type") in COLOR_RANGE_GRAPH_TYPES for g in skipped):
        gaps.append({"kind": "color_range", "detail": old["color_range"]})

    graph_tracking_ids = [str(uuid.uuid4()) for _ in convertible]
    # invert per-graph comp assignment → per-comp graph tracking-id list
    graphs_for_comp = {cid: [tid for (g, info, _), tid
                             in zip(convertible, graph_tracking_ids)
                             if cid in info["assigned"]]
                       for cid in comps_by_id}

    # -- resolve point-drawn routes (null tmc_array) via the old prod API
    resolved_tmcs = {}
    for rc in route_comps:
        rid = str(rc.get("routeId"))
        old_route = old_routes.get(rid)
        if old_route is not None and not old_route.get("tmc_array"):
            s = rc.get("settings") or {}
            years = {str(s.get(k))[:4] for k in ("startDate", "endDate")
                     if s.get(k)}
            comp_years = range(int(min(years)), int(max(years)) + 1) if years else []
            tmcs = resolve_tmc_array(rid, comp_years, gaps)
            resolved_tmcs[rc.get("compId")] = tmcs
            print(f"resolved point-route {rid} ({rc.get('compId')}, "
                  f"years {sorted(years)}) -> {tmcs}")

    # -- route entries for the reports_snap_2 row
    # Merge/dedup pass (converter-route-comp-redesign.md): comps sharing
    # (routeId, calendar startDate, calendar endDate, resolved tmc_array)
    # differ only in the old tool's own peak/weekday/resolution slicing —
    # redundant now that Design Push #2 moved that onto each graph's own
    # _measurePick. One entry per group, graphIds unioned across every
    # comp in the group. comp_group_size feeds the graph-title-suffix fix
    # below (a merged route's own name goes generic; a graph whose title
    # never had {name} needs another way to keep the distinction visible).
    merge_groups = group_route_comps(
        route_comps,
        lambda rc: route_comp_merge_key(rc, old_routes.get(str(rc.get("routeId"))),
                                        resolved_tmcs.get(rc.get("compId"))))
    comp_group_size = {}
    route_entries = []
    for group in merge_groups:
        for rc in group:
            comp_group_size[rc.get("compId")] = len(group)
        rep = group[0]
        union_graph_ids, seen_tids = [], set()
        for rc in group:
            for tid in graphs_for_comp.get(rc.get("compId"), []):
                if tid not in seen_tids:
                    seen_tids.add(tid)
                    union_graph_ids.append(tid)
        entry = build_route_entry(rep, old_routes.get(str(rep.get("routeId"))),
                                  union_graph_ids, old_id, gaps,
                                  tmc_override=resolved_tmcs.get(rep.get("compId")))
        # Every graph fed by a group member other than the representative still
        # has its own _measurePick.routeIds frozen on that member's ORIGINAL
        # compId (set long before this merge pass ran) — useGraphPublish.js's
        # routesByCompId lookup needs every member's id to resolve to this one
        # entry, not just the representative's own route_comp_id.
        entry["route_comp_ids"] = [rc.get("compId") for rc in group]
        if len(group) > 1:
            rep_old_route = old_routes.get(str(rep.get("routeId")))
            entry["name"] = ((rep_old_route or {}).get("name")
                             or rep.get("_raw_name") or entry["name"])
            # weekdays/startTime/endTime used to vary within this group —
            # dropped rather than inherited from whichever comp happens to
            # be the representative, since it's already superseded by each
            # fed graph's own _measurePick and would be misleading here.
            entry.pop("weekdays", None)
            gaps.append({"kind": "route_comps_merged", "detail": {
                "route_id": rep.get("routeId"),
                "merged_comp_ids": [m.get("compId") for m in group],
                "calendar_range": [entry.get("startDate"), entry.get("endDate")]}})
        route_entries.append(entry)

    # -- catalog upserts (with resolved TMCs for point-routes)
    seen_rids = set()
    for rc in route_comps:
        rid = rc.get("routeId")
        if rid and rid not in seen_rids:
            seen_rids.add(rid)
            ensure_route_in_catalog(rid, old_routes.get(str(rid)), dry_run, gaps,
                                    tmc_override=resolved_tmcs.get(rc.get("compId")))

    # A report where EVERY route_comp has no resolvable TMC array has nothing
    # to convert at all — every measure in this whole pipeline is TMC-scoped,
    # and build_route_entry above already excludes each of these routes from
    # every graph's graphIds (see the unfiltered-scan fix). Creating the page
    # anyway would produce a permanently-empty shell (real sections, zero
    # data, forever) — confirmed live on report_1032/report_392, both 100%
    # route_missing_everywhere. Skip page creation entirely and gap-log at
    # the report level instead.
    if route_entries and not any(e["tmc_array"] for e in route_entries):
        gaps.append({"kind": "no_valid_routes",
                     "detail": "every route_comp in this report has no "
                               "resolvable tmc_array (route_missing_everywhere) "
                               "— nothing to convert, page not created"})
        verb = "would skip" if dry_run else "skipped"
        print(f"[{verb}] creating page '{slug}' ('{old['name']}') — no route "
              f"in this report has real TMC data")
        return finish(old_id, old, None, gaps, dry_run)

    if dry_run:
        print(f"[dry-run] would create page '{slug}' ('{old['name']}') with "
              f"{len(convertible)} graph(s) (+RRL), "
              f"{len(route_entries)} route(s); {len(skipped)} graph(s) skipped")
        return finish(old_id, old, None, gaps, dry_run)

    # -- page
    parent_id = ensure_parent_page(dry_run)
    res = dms(["page", "create", "--pattern", PATTERN,
               "--title", title, "--slug", slug],
              data={"index": "0", "parent": str(parent_id),
                    "sidebar": page_template.get("sidebar", "left"),
                    # See convert_template.py's identical line — never copied before this
                    # fix, so every converted page had a permanent blank/white rail-width
                    # gap in view mode.
                    "sidebarHideInView": page_template.get("sidebarHideInView", False),
                    "published": "draft"})
    page_id = res["id"]
    print(f"created page id={page_id} slug={slug}")

    # -- draft sections (every template section flagged templateRole=='framework'
    # — RRL, ReportPageHeader, whatever else joins that list later — cloned first,
    # in template order, then graphs). No Add-a-Route Spreadsheet section is
    # cloned anymore — the template no longer has one to clone from (RRL's own
    # inline "Add a route" search replaces it, see dms-template's
    # add-route-flow-improvements.md task).
    section_datas = [build_cloned_section_data(page_id, tmpl, str(uuid.uuid4()))
                      for tmpl in template_framework_sections(page_template)]
    # Route-Map choropleth baking (M2) needs each graph's assigned comps'
    # TMCs/date ranges — all three pieces already computed above for the
    # reports_snap_2 route entries; bundle rather than widen every other
    # build_graph_section_data call with three more positional params.
    route_map_value_ctx = {"comps_by_id": comps_by_id, "old_routes": old_routes,
                           "resolved_tmcs": resolved_tmcs}
    for (g, info, tmpl), tid, aadt_ov in zip(convertible, graph_tracking_ids,
                                             graph_aadt_overrides):
        # Info Box sections all render an otherwise-identical "TMC/Route Info
        # Box, Speed" title (the old report's own title template — see
        # analyze_graph) with no year/bin in it at all; build_graph_section_data
        # always uses this title verbatim, so a template's own bin-aware title
        # (ensure_pm3_join_template's INFO_BOX_TITLES) never reaches the page.
        # Two sibling Info Box sections on one page can now show DIFFERENT
        # bins (round 21) — append the bin/year here so they're visually
        # distinguishable without reading raw column headers.
        bin_year = info_box_bin_year.get(g.get("id"))
        if bin_year:
            year_, bin_ = bin_year
            info["title"] = f"{info['title']} ({RELIABILITY_BIN_LABELS[bin_]}, {year_})"
        # Route-comp-merge title fix: this graph's title template never had
        # a {name} slot (so it renders with zero per-comp distinction) AND
        # at least one of its assigned comps got merged into a shared route
        # entry (whose own name just went generic) — append the comp
        # name(s) so the peak/date distinction survives somewhere on the
        # page instead of disappearing entirely.
        if (not info.get("had_name_token") and info.get("comp_names")
                and any(comp_group_size.get(c, 1) > 1 for c in info["assigned"])):
            info["title"] = f"{info['title']} — {info['comp_names']}"
        section_datas.append(
            build_graph_section_data(page_id, tmpl, tid, info, gaps, g,
                                     color_range=old.get("color_range"),
                                     aadt_override=aadt_ov,
                                     route_map_value_ctx=route_map_value_ctx,
                                     diff_invert=route_diff_invert.get(
                                         g.get("id"), False),
                                     comps_by_id=comps_by_id))

    draft_ids = []
    for sd in section_datas:
        r = dms(["section", "create", str(page_id), "--pattern", PATTERN], data=sd)
        draft_ids.append(r["id"])
    print(f"created {len(draft_ids)} draft sections: {draft_ids}")

    # -- published copies (separate rows, same trackingIds — mirrors UI publish)
    published_refs = []
    for sd in section_datas:
        r = dms(["raw", "create", "npmrdsv5", COMPONENT_TYPE], data=sd)
        published_refs.append({"id": str(r["id"]),
                               "ref": f"npmrdsv5+{COMPONENT_TYPE}"})
    groups = page_template.get("draft_section_groups") or [
        {"name": "default", "index": 0, "theme": "flush", "position": "content"}]
    dms(["raw", "update", str(page_id)],
        data={"sections": published_refs, "section_groups": groups,
              "draft_section_groups": groups, "published": "", "has_changes": False})
    print(f"published page (published section rows: "
          f"{[r['id'] for r in published_refs]})")

    # -- reports_snap_2 row
    snap = {
        "report_id": str(page_id),
        "routes": json.dumps(route_entries),
        "name": old.get("name") or "",
        "description": old.get("description") or "",
        "_converted_from_old_report_id": old_id,
        "_converted_at": now_iso(),
        "_old_created_by": old.get("created_by"),
        "_old_created_at": old.get("created_at"),
        "_old_updated_at": old.get("updated_at"),
    }
    r = dms(["raw", "create", "npmrdsv5", REPORTS_SNAP_TYPE], data=snap)
    print(f"created reports_snap_2 row id={r['id']} (report_id={page_id}, "
          f"{len(route_entries)} routes)")

    return finish(old_id, old, page_id, gaps, dry_run, slug=slug)


def finish(old_id, old, page_id, gaps, dry_run, slug=None):
    os.makedirs(GAPS_DIR, exist_ok=True)
    report = {"old_report_id": old_id, "old_name": old.get("name"),
              "new_page_id": page_id, "dry_run": dry_run,
              "converted_at": now_iso(), "gaps": gaps}
    path = os.path.join(GAPS_DIR, f"report_{old_id}.json")
    with open(path, "w") as f:
        json.dump(report, f, indent=2)
    print(f"\n--- gap report ({len(gaps)} item(s)) → {path}")
    for g in gaps:
        print(f"  [{g['kind']}] " + json.dumps(
            {k: v for k, v in g.items() if k != 'kind'})[:200])
    if page_id and not dry_run:
        print(f"\nview it: http://npmrds.localhost:5173/{slug or f'report_{old_id}'} "
              f"(page id {page_id})")
    return report


