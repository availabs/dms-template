import json
import os
import uuid

from .config import COMPONENT_TYPE, GAPS_DIR, PATTERN, REPORTS_SNAP_TYPE
from .vocab import BAR_SUMMARY_PM3_BUCKET, COLOR_RANGE_GRAPH_TYPES, DIFFERENCE_GRAPH_TYPES, GRAPH_TEMPLATE_MAP, INFO_BOX_AADT_BUCKET, INFO_BOX_BUCKET, INFO_BOX_DELAY_BUCKET, INFO_BOX_GRAIN, INFO_BOX_LENGTH_BUCKET, INFO_BOX_TRAVELTIME_BUCKETS, PM3_VIEW_BY_YEAR, RELIABILITY_BIN_LABELS, ROUTE_COMPARE_BUCKET
from .expressions import ROUTE_MAP_AVGDELAY_RESOLUTION_SLUG, ROUTE_MAP_AVGDELAY_VALUE_EXPR_BY_RESOLUTION
from .template_specs import MEASURE_EXPR
from .db import dms, fetch_old_template, flatten_route_comps, now_iso
from .dates import resolve_relative_dates
from .transforms import build_slot_entry, generic_comp_label, group_route_comps, merged_group_date_label, route_comp_merge_key, route_settings_gaps
from .graph_templates import ensure_graph_templates, graph_max_year, graph_reliability_bin, load_graph_templates
from .info_box_templates import ensure_bar_graph_summary_pm3_template, ensure_info_box_aadt_template, ensure_info_box_delay_template, ensure_info_box_length_template, ensure_info_box_traveltime_template, ensure_pm3_join_template
from .route_compare_template import ensure_route_compare_template
from .route_map import GEOMETRY_TILE_VIEWS, ensure_route_map_avghoursofdelay_template, ensure_route_map_hoursofdelay_template, ensure_route_map_none_template, ensure_route_map_speed_template, ensure_route_map_traveltime_template
from .section_builders import analyze_graph, build_cloned_section_data, build_graph_section_data, load_page_template, resolve_difference_pair, template_framework_sections
from .pages import compute_report_slug, delete_converted_page, ensure_parent_page, find_page_by_old_template_id

def finish_template(old_id, old, page_id, gaps, dry_run, slug=None):
    """finish()'s twin for template conversions — identical shape, a
    separate gap-report filename prefix (`template_<id>.json`, not
    `report_<id>.json`) so a template and a report sharing the same numeric
    id never collide on one gap-report file."""
    os.makedirs(GAPS_DIR, exist_ok=True)
    report = {"old_template_id": old_id, "old_name": old.get("name"),
              "new_page_id": page_id, "dry_run": dry_run,
              "converted_at": now_iso(), "gaps": gaps}
    path = os.path.join(GAPS_DIR, f"template_{old_id}.json")
    with open(path, "w") as f:
        json.dump(report, f, indent=2)
    print(f"\n--- gap report ({len(gaps)} item(s)) → {path}")
    for g in gaps:
        print(f"  [{g['kind']}] " + json.dumps(
            {k: v for k, v in g.items() if k != 'kind'})[:200])
    if page_id and not dry_run:
        print(f"\nview it: http://npmrds.localhost:5173/{slug or f'template_{old_id}'} "
              f"(page id {page_id})")
    return report


def convert_template(old_id, dry_run=False, replace=False, title_override=None):
    """Ports one admin2.templates row into a Dynamic Report page — the
    "unified mechanism" design (dynamic-reports-and-route-tags.md item 3,
    revised 2026-08-03 per Ryan: treat every candidate as if it has no
    routes, build purely from graph_comps). Reuses convert_report()'s own
    analysis/template-minting/section-building logic (build_graph_section_data
    et al. — confirmed by reading that logic never touches real per-route
    data, only comp SETTINGS (dates/resolution) and the classified graph
    shape) but builds ROUTE SLOTS (build_slot_entry) instead of resolving
    real routes, and marks the page as a Dynamic Report (a `routeSlots`
    page filter) instead of a normal one.

    Deliberately duplicated from convert_report() rather than refactored to
    share code (2026-08-03 decision) — convert_report() is a single,
    tightly-coupled ~550-line function already proven against 36 real
    conversions; forking it mid-body to reuse pieces risked destabilizing
    that function for a one-time port of a curated ~28-candidate set. Some
    drift between the two is an accepted, deliberate cost of that choice.

    Route Map sections ARE converted (2026-08-03, added after the initial
    244-only pass) — but deliberately WITHOUT the per-report choropleth
    color-break bake (`route_map_value_ctx=None` below): that bake
    (bake_route_map_choropleth_paint/bake_route_map_delay_paint) computes
    quantile breaks over the report's actual routes' real values, which
    can't exist for an unfilled slot. Read `ensure_route_map_speed_template`'s
    own docstring: the shared per-year template it mints already carries a
    real, working PLACEHOLDER color range (a generic quantile scale over
    typical speed/delay values) precisely so every real conversion has
    something correct to render before its own per-report bake customizes
    it — skipping the bake for a Dynamic Report isn't a degraded fallback,
    it's the actually-correct behavior: there's no single "this report's
    routes" to bake against when a different real route may fill the slot
    on every view.

    Route Difference Graph / TMC Difference Grid ARE also converted
    (2026-08-03) — `resolve_difference_pair` is called with `old_routes={}`
    instead of a real fetched dict. Read `is_partner()` inside that function:
    its PRIMARY match path is `str(cand.get("routeId")) ==
    str(base.get("routeId"))` — plain string equality on the same field
    `route_slot_group` already keys on, needing no real data at all. The
    real-route-fetch-dependent path is only a narrow fallback (two DIFFERENT
    routeIds that happen to reference the same physical route via duplicated
    rows) — an accepted, documented-in-the-function-itself gap for template
    conversion, not a new one introduced here. A difference pair's two
    resolved comps always share one `route_slot_group` (same routeId, by
    construction of the "before/after one route" pattern) — composes cleanly
    with the slot-grouping mechanism with no special-casing."""
    gaps = []
    old = fetch_old_template(old_id)
    print(f"\n=== old template {old_id}: '{old['name']}' ===")

    existing = find_page_by_old_template_id(old_id)
    if existing:
        if not replace:
            raise RuntimeError(
                f"page for old template {old_id} already exists (id {existing}) "
                f"— pass --replace")
        if dry_run:
            print(f"[dry-run] would delete existing page {existing} first")
        else:
            delete_converted_page(existing)

    # title_override lets a caller (the reports catalog build) mint the page's
    # title/slug from its own curated display name instead of the old system's
    # internal template name — the two intentionally diverge in several cases
    # (e.g. old template 246 "Rochester Inner Loop" is catalog card "Snapshot"),
    # and without this the page's own URL/<h1> would read the wrong name. See
    # planning/transportny/tasks/current/catalog-page-slug-naming-fix.md.
    title = title_override or old["name"] or f"Template {old_id}"
    slug = compute_report_slug(title, exclude_id=existing)

    route_comps = flatten_route_comps(old.get("route_comps"), gaps)
    resolve_relative_dates(route_comps, gaps)
    for rc in route_comps:
        route_settings_gaps(rc.get("settings") or {}, rc.get("name"), gaps)
        # Templates are Dynamic Reports — a viewer fills each route slot
        # with ANY route/dates later, so a slot's own name (and any graph
        # title that substitutes it in) must never bake in a specific old
        # route name or calendar date the way a real --report-id
        # conversion's route_comp_display_name correctly would. See
        # generic_comp_label's own docstring.
        rc["name"] = generic_comp_label(rc, gaps)

    if old.get("station_comps"):
        gaps.append({"kind": "station_comps",
                     "detail": f"{len(old['station_comps'])} station comps not converted"})

    for i, g in enumerate(old.get("graph_comps") or []):
        if g.get("id") is None:
            g["id"] = f"graph-idx-{i}"

    comps_by_id = {rc.get("compId"): rc for rc in route_comps if rc.get("compId")}
    graph_templates = load_graph_templates()
    page_template = load_page_template()
    analyzed = [(g, analyze_graph(g, comps_by_id, gaps))
                for g in old.get("graph_comps") or []]

    # Route Difference Graph / TMC Difference Grid (mirrors convert_report()'s
    # own pre-pass exactly, `old_routes={}` in place of a real fetched dict —
    # see docstring for why the primary same-routeId match path needs none).
    route_diff_invert = {}
    route_diff_gap_logged = set()
    comp_order = [rc.get("compId") for rc in route_comps]
    for g, info in analyzed:
        if info["type"] not in DIFFERENCE_GRAPH_TYPES:
            continue
        gid = g.get("id")
        pair, why = resolve_difference_pair(g.get("state") or {}, route_comps, {})
        if not pair:
            gaps.append({"kind": "route_difference_no_pair", "graph": gid,
                         "detail": why})
            route_diff_gap_logged.add(gid)
            continue
        main_rc, compare_rc = pair
        info["assigned"] = [main_rc["compId"], compare_rc["compId"]]
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
        route_diff_invert[gid] = (comp_order.index(main_rc["compId"])
                                  > comp_order.index(compare_rc["compId"]))

    needed = {GRAPH_TEMPLATE_MAP.get((i["type"], i["measure"], i["resolution"],
                                      i["data_column"]))
              for _, i in analyzed if i["type"] not in INFO_BOX_GRAIN} - {None}
    graph_templates = ensure_graph_templates(needed, graph_templates, dry_run)

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
            graph_templates = ensure_info_box_traveltime_template(grain, graph_templates, dry_run)
            info_box_tmpl_name[gid] = f"{grain}_info_box_traveltime"
            continue
        if measure_col == INFO_BOX_LENGTH_BUCKET:
            graph_templates = ensure_info_box_length_template(grain, graph_templates, dry_run)
            info_box_tmpl_name[gid] = f"{grain}_info_box_length"
            continue
        if measure_col == INFO_BOX_AADT_BUCKET:
            graph_templates = ensure_info_box_aadt_template(grain, graph_templates, dry_run)
            info_box_tmpl_name[gid] = f"{grain}_info_box_aadt"
            continue
        if measure_col == INFO_BOX_DELAY_BUCKET:
            graph_templates = ensure_info_box_delay_template(grain, graph_templates, dry_run)
            info_box_tmpl_name[gid] = f"{grain}_info_box_delay"
            continue
        if measure_col != INFO_BOX_BUCKET:
            continue
        year = graph_max_year(info, comps_by_id)
        bin_ = graph_reliability_bin(info, comps_by_id)
        if year is None:
            gaps.append({"kind": "info_box_year_undetermined", "graph": gid,
                         "detail": "no assigned comp has a startDate/endDate"})
            info_box_gap_logged.add(gid)
        elif year not in PM3_VIEW_BY_YEAR:
            gaps.append({"kind": "info_box_year_outside_pm3_coverage", "graph": gid,
                         "detail": f"max year {year} outside pm3 coverage"})
            info_box_gap_logged.add(gid)
        elif bin_ is None:
            gaps.append({"kind": "info_box_bin_undetermined", "graph": gid,
                         "detail": "assigned comp(s) don't land unambiguously on one bin"})
            info_box_gap_logged.add(gid)
        else:
            graph_templates = ensure_pm3_join_template(grain, year, bin_, graph_templates, dry_run)
            info_box_tmpl_name[gid] = f"{grain}_info_box_reliability_{year}_{bin_}"
            info_box_bin_year[gid] = (year, bin_)

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
                         "detail": "no assigned comp has a startDate/endDate"})
            bar_summary_pm3_gap_logged.add(gid)
        elif year not in PM3_VIEW_BY_YEAR:
            gaps.append({"kind": "bar_summary_freeflow_outside_pm3_coverage", "graph": gid,
                         "detail": f"max year {year} outside pm3 coverage"})
            bar_summary_pm3_gap_logged.add(gid)
        else:
            graph_templates = ensure_bar_graph_summary_pm3_template(year, graph_templates, dry_run)
            bar_summary_pm3_tmpl_name[gid] = f"tmc_freeflow_summary_bar_graph_{year}"

    route_compare_tmpl_name = {}
    route_compare_gap_logged = set()
    for g, info in analyzed:
        if info["type"] != "Route Compare Component":
            continue
        gid = g.get("id")
        if info["measure"] not in MEASURE_EXPR:
            continue
        if (info["measure"], info["data_column"]) != (ROUTE_COMPARE_BUCKET[0], ROUTE_COMPARE_BUCKET[2]):
            continue
        if len(info["assigned"]) < 2:
            gaps.append({"kind": "route_compare_insufficient_comps", "graph": gid,
                         "detail": f"{len(info['assigned'])} assigned comp(s), need >= 2"})
            route_compare_gap_logged.add(gid)
            continue
        graph_templates = ensure_route_compare_template(info["measure"], graph_templates, dry_run)
        route_compare_tmpl_name[gid] = f"route_compare_{info['measure']}"

    # Route Map (mirrors convert_report()'s own loop exactly — year
    # resolution is comp-SETTINGS-driven (graph_max_year), no real route
    # data needed; see docstring for why skipping the per-report bake below
    # is correct, not a shortfall).
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
                         "detail": f"resolution {info['resolution']!r} not built"})
            route_map_gap_logged.add(gid)
            continue
        year = graph_max_year(info, comps_by_id)
        if year is not None:
            year = min(max(year, min(GEOMETRY_TILE_VIEWS)), max(GEOMETRY_TILE_VIEWS))
        if year is None:
            gaps.append({"kind": "route_map_no_year", "graph": gid,
                         "detail": "no parseable comp dates to pick a geometry "
                                   "network year"})
            route_map_gap_logged.add(gid)
            continue
        if info["measure"] == "none":
            graph_templates = ensure_route_map_none_template(year, graph_templates, dry_run)
            route_map_tmpl_name[gid] = f"route_map_none_{year}"
        elif info["measure"] == "speed":
            graph_templates = ensure_route_map_speed_template(year, graph_templates, dry_run)
            route_map_tmpl_name[gid] = f"route_map_speed_{year}"
        elif info["measure"] == "travelTime":
            graph_templates = ensure_route_map_traveltime_template(year, graph_templates, dry_run)
            route_map_tmpl_name[gid] = f"route_map_travelTime_{year}"
        elif info["measure"] == "hoursOfDelay":
            graph_templates = ensure_route_map_hoursofdelay_template(year, graph_templates, dry_run)
            route_map_tmpl_name[gid] = f"route_map_hoursOfDelay_{year}"
        else:
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
        key = (info["type"], info["measure"], info["resolution"], info["data_column"])
        if gid in route_diff_gap_logged:
            skipped.append(g)
            continue
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
            continue
        gaps.append({"kind": "unmapped_graph", "detail": {
            "graph": gid, "graph_type": info["type"],
            "measure": info["measure"], "resolution": info["resolution"],
            "dataColumn": info["data_column"],
            "reason": ("no template mapping" if not tmpl_name
                       else f"template '{tmpl_name}' not found in DB")}})

    # overrides.aadt: a template SLOT comp's override value is illustrative
    # (whatever the last template author typed), not tied to any real route —
    # carrying it through would bake a stale example value into every future
    # viewer's real route. Deliberately not applied at all in this mode.

    if old.get("color_range") and any(
            g.get("type") in COLOR_RANGE_GRAPH_TYPES for g in skipped):
        gaps.append({"kind": "color_range", "detail": old["color_range"]})

    graph_tracking_ids = [str(uuid.uuid4()) for _ in convertible]
    graphs_for_comp = {cid: [tid for (g, info, _), tid
                             in zip(convertible, graph_tracking_ids)
                             if cid in info["assigned"]]
                       for cid in comps_by_id}

    # -- route SLOT entries for the reports_snap_2 row (build_slot_entry, not
    # build_route_entry — no real route resolution at all, see that
    # function's docstring for the route_slot_group grouping mechanism)
    # Merge/dedup pass, mirrors convert_report.py's (converter-route-comp-
    # redesign.md) — no old_route/tmc_override on this path, so the key
    # collapses to (routeId, calendar startDate, calendar endDate).
    merge_groups = group_route_comps(route_comps, route_comp_merge_key)
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
        entry = build_slot_entry(rep, union_graph_ids, old_id)
        # See convert_report.py's identical field — useGraphPublish.js's
        # routesByCompId lookup needs every merged member's ORIGINAL compId to
        # resolve to this one entry, not just the representative's own
        # route_comp_id (which is all build_slot_entry itself sets).
        entry["route_comp_ids"] = [rc.get("compId") for rc in group]
        if len(group) > 1:
            # A merged group's members differ in peak/weekday/resolution —
            # show only the shared date, not any one member's own suffix
            # (which would misrepresent the merged entry as "the AM one").
            entry["name"] = merged_group_date_label(rep.get("settings") or {})
            entry.pop("weekdays", None)
            gaps.append({"kind": "route_comps_merged", "detail": {
                "route_id": rep.get("routeId"),
                "merged_comp_ids": [m.get("compId") for m in group],
                "calendar_range": [entry.get("startDate"), entry.get("endDate")]}})
        route_entries.append(entry)

    if dry_run:
        print(f"[dry-run] would create page '{slug}' ('{old['name']}') with "
              f"{len(convertible)} graph(s) (+RRL), {len(route_entries)} route "
              f"slot(s); {len(skipped)} graph(s) skipped")
        return finish_template(old_id, old, None, gaps, dry_run)

    # -- page
    parent_id = ensure_parent_page(dry_run)
    res = dms(["page", "create", "--pattern", PATTERN,
               "--title", title, "--slug", slug],
              data={"index": "0", "parent": str(parent_id),
                    "sidebar": page_template.get("sidebar", "left"),
                    # Collapses the rail's own 340px space in view mode once RRL renders
                    # nothing (a normal report, or a resolved Dynamic Report) — see
                    # sectionGroup.jsx's `collapseRailIfEmpty`. Never copied from the
                    # template before this fix, so every converted page had a permanent
                    # blank/white rail-width gap in view mode regardless of this flag's
                    # value on the template itself.
                    "sidebarHideInView": page_template.get("sidebarHideInView", False),
                    "published": "draft"})
    page_id = res["id"]
    print(f"created page id={page_id} slug={slug}")

    # -- Dynamic Report page filter (routeSlots) — same shape RRL's own
    # toggleDynamicReport writes (ReportRouteList.jsx), applied at creation
    # instead of via a follow-up UI toggle.
    dms(["raw", "update", str(page_id)],
        data={"filters": [{"id": "dyn-report-routes", "searchKey": "routes",
                           "useSearchParams": True, "values": "",
                           "type": "routeSlots"}]})
    print("set page as Dynamic Report (routeSlots filter)")

    # -- draft sections (every template section flagged templateRole=='framework'
    # — RRL, ReportPageHeader, whatever else joins that list later — cloned first,
    # in template order, then graphs)
    section_datas = [build_cloned_section_data(page_id, tmpl, str(uuid.uuid4()))
                      for tmpl in template_framework_sections(page_template)]
    for (g, info, tmpl), tid in zip(convertible, graph_tracking_ids):
        bin_year = info_box_bin_year.get(g.get("id"))
        if bin_year:
            year_, bin_ = bin_year
            info["title"] = f"{info['title']} ({RELIABILITY_BIN_LABELS[bin_]}, {year_})"
        # Route-comp-merge title fix — see convert_report.py's identical block.
        if (not info.get("had_name_token") and info.get("comp_names")
                and any(comp_group_size.get(c, 1) > 1 for c in info["assigned"])):
            info["title"] = f"{info['title']} — {info['comp_names']}"
        section_datas.append(
            build_graph_section_data(page_id, tmpl, tid, info, gaps, g,
                                     color_range=old.get("color_range"),
                                     aadt_override=None,
                                     # Deliberately None, not a gap: this graph
                                     # type's per-report choropleth bake needs
                                     # real per-route data that doesn't exist
                                     # for an unfilled slot — the shared
                                     # per-year template's own built-in
                                     # placeholder color range is the correct
                                     # render, not a degraded one. See
                                     # convert_template()'s docstring.
                                     route_map_value_ctx=None,
                                     diff_invert=route_diff_invert.get(g.get("id"), False),
                                     comps_by_id=comps_by_id))

    draft_ids = []
    for sd in section_datas:
        r = dms(["section", "create", str(page_id), "--pattern", PATTERN], data=sd)
        draft_ids.append(r["id"])
    print(f"created {len(draft_ids)} draft sections: {draft_ids}")

    published_refs = []
    for sd in section_datas:
        r = dms(["raw", "create", "npmrdsv5", COMPONENT_TYPE], data=sd)
        published_refs.append({"id": str(r["id"]), "ref": f"npmrdsv5+{COMPONENT_TYPE}"})
    groups = page_template.get("draft_section_groups") or [
        {"name": "default", "index": 0, "theme": "flush", "position": "content"}]
    dms(["raw", "update", str(page_id)],
        data={"sections": published_refs, "section_groups": groups,
              "draft_section_groups": groups, "published": "", "has_changes": False})
    print(f"published page (published section rows: {[r['id'] for r in published_refs]})")

    snap = {
        "report_id": str(page_id),
        "routes": json.dumps(route_entries),
        "name": old.get("name") or "",
        "description": old.get("description") or "",
        "_converted_from_old_template_id": old_id,
        "_converted_at": now_iso(),
        "_old_created_by": old.get("created_by"),
        "_old_created_at": old.get("created_at"),
        "_old_updated_at": old.get("updated_at"),
    }
    r = dms(["raw", "create", "npmrdsv5", REPORTS_SNAP_TYPE], data=snap)
    print(f"created reports_snap_2 row id={r['id']} (report_id={page_id}, "
          f"{len(route_entries)} route slots)")

    return finish_template(old_id, old, page_id, gaps, dry_run, slug=slug)


