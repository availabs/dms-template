"""
Convert old NPMRDS reports (npmrds_production admin2.reports) into new DMS
report pages (npmrdsv5+npmrds_sub), preserving as much old data as possible.

See src/dms/planning/tasks/current/old-reports-conversion.md for the full
design, data-shape mapping, and known gaps.

Reads:
  - OLD system: direct Postgres (admin2.reports / admin2.routes) — the old
    falcor API is not needed; creds come from avail-falcor's db config.
  - NEW system: shape checks read Postgres directly (read-only); ALL writes go
    through the DMS CLI (`dms raw create`, `dms section create`, ...) so
    dmsDataEditor semantics (split-table routing, id allocation) are preserved.

Per converted report this creates:
  - one npmrds_sub|page (child of the "Converted Reports" parent page),
    published (draft + published section copies sharing trackingIds, like the UI)
  - one ReportRouteList section + one AVL Graph section per convertible old
    graph_comp + one "Add a Route" Spreadsheet section (all cloned from the
    Report Page template row, graphs from npmrds_sub|avl_graph_template rows)
  - one reports_snap_2 row (report_id = new page id) holding the converted
    routes; unconvertible old settings are preserved verbatim on each route
    entry under _old_settings (the :data row is schema-free)
  - missing routes are upserted into the Routes Data catalog
  - a gap report (stdout + scratchpad/npmrds-sub/old-reports/gaps/)

Usage:
  python3 scripts/npmrds-reports/convert_old_reports.py --report-id 1070 [--dry-run]

(Duplicated from config.py's module docstring — main()'s ArgumentParser
description reads __doc__ directly, so this module needs its own copy,
byte-identical through the first two lines, to produce the same --help text
as before the module split.)
"""

import argparse
import json
import sys

from .vocab import RELIABILITY_BIN_LABELS
from .template_specs import MEASURE_EXPR
from .graph_templates import load_graph_templates
from .route_map import ROUTE_MAP_MEASURES
from .section_builders import INFO_BOX_SPEC_MEASURES, build_route_compare_section_state, build_route_info_box_section_state, build_route_map_section_state
from .convert_report import convert_report
from .convert_template import convert_template

def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    ap.add_argument("--report-id", type=int,
                    help="old admin2.reports id to convert")
    ap.add_argument("--template-id", type=int,
                    help="old admin2.templates id to convert into a Dynamic "
                         "Report page (route-slots, graph_comps-only — see "
                         "convert_template())")
    ap.add_argument("--title",
                    help="--template-id only: override the page's title/slug "
                         "instead of deriving it from the old template's own "
                         "name — use when a catalog's curated display name "
                         "differs from the old system's internal name")
    ap.add_argument("--dry-run", action="store_true",
                    help="report what would happen without writing")
    ap.add_argument("--replace", action="store_true",
                    help="delete a previously converted page for this report first")
    ap.add_argument("--route-map-section", action="store_true",
                    help="build a single Route Map section state and print it as "
                         "JSON on stdout, for report_build.mjs to embed in a "
                         "spec-driven report — does not touch any old "
                         "admin2.reports row. See build_route_map_section_state().")
    ap.add_argument("--measure", choices=ROUTE_MAP_MEASURES,
                    help="--route-map-section: none/speed/travelTime/hoursOfDelay/avgHoursOfDelay")
    ap.add_argument("--year", type=int, help="--route-map-section: network geometry year")
    ap.add_argument("--resolution", choices=["day", "5-minutes"],
                    help="--route-map-section: required only for measure avgHoursOfDelay")
    ap.add_argument("--tmcs", help="--route-map-section: JSON array of TMC strings to bake the choropleth against")
    ap.add_argument("--start-date", help="--route-map-section: YYYY-MM-DD")
    ap.add_argument("--end-date", help="--route-map-section: YYYY-MM-DD")
    ap.add_argument("--color-range", help="--route-map-section: JSON array of hex colors")
    ap.add_argument("--route-info-box-section", action="store_true",
                    help="build a single Route/TMC Info Box section state and print it "
                         "as JSON on stdout, for report_build.mjs to embed in a "
                         "spec-driven report — does not touch any old admin2.reports "
                         "row. See build_route_info_box_section_state().")
    ap.add_argument("--info-box-measure",
                    help="--route-info-box-section: comma-separated, 1 or more of "
                         f"{'/'.join(INFO_BOX_SPEC_MEASURES)} (2+ composes a multi-measure "
                         "box, e.g. 'speed,travelTime' — see "
                         "build_route_info_box_section_state_multi)")
    ap.add_argument("--grain", choices=["route", "tmc"], default="route",
                    help="--route-info-box-section: route (comparisonSeries __series "
                         "discriminator, default) or tmc (single real tmc column)")
    ap.add_argument("--bin", dest="reliability_bin", choices=sorted(RELIABILITY_BIN_LABELS),
                    help="--route-info-box-section: required only for "
                         "--info-box-measure reliability (amp/midd/pmp/we)")
    ap.add_argument("--route-compare-section", action="store_true",
                    help="build a single Route Compare Component section state and print "
                         "it as JSON on stdout, for report_build.mjs to embed in a "
                         "spec-driven report — does not touch any old admin2.reports "
                         "row. See build_route_compare_section_state().")
    ap.add_argument("--compare-measure",
                    help="--route-compare-section: comma-separated, 1 or both of "
                         f"{'/'.join(sorted(MEASURE_EXPR))} (2 composes a multi-measure "
                         "box — see build_route_compare_section_state_multi)")
    args = ap.parse_args()

    if args.route_map_section:
        if not args.measure or not args.year:
            ap.error("--route-map-section needs --measure and --year")
        templates = load_graph_templates()
        element_type, state, gap = build_route_map_section_state(
            args.measure, args.year, templates, args.dry_run,
            resolution=args.resolution,
            tmcs=json.loads(args.tmcs) if args.tmcs else None,
            start_date=args.start_date, end_date=args.end_date,
            color_range=json.loads(args.color_range) if args.color_range else None)
        if gap:
            print(f"[route-map-section] {gap}", file=sys.stderr)
        print(json.dumps({"elementType": element_type, "state": state}))
        return

    if args.route_info_box_section:
        if not args.info_box_measure:
            ap.error("--route-info-box-section needs --info-box-measure")
        info_box_measures = [m.strip() for m in args.info_box_measure.split(",") if m.strip()]
        for m in info_box_measures:
            if m not in INFO_BOX_SPEC_MEASURES:
                ap.error(f"--info-box-measure: unknown measure {m!r} — known: {', '.join(INFO_BOX_SPEC_MEASURES)}")
        if "reliability" in info_box_measures and not (args.year and args.reliability_bin):
            ap.error("--route-info-box-section --info-box-measure reliability needs --year and --bin")
        templates = load_graph_templates()
        try:
            element_type, state = build_route_info_box_section_state(
                info_box_measures, args.grain, templates, args.dry_run,
                year=args.year, bin_=args.reliability_bin)
        except ValueError as e:
            ap.error(str(e))
        print(json.dumps({"elementType": element_type, "state": state}))
        return

    if args.route_compare_section:
        if not args.compare_measure:
            ap.error("--route-compare-section needs --compare-measure")
        compare_measures = [m.strip() for m in args.compare_measure.split(",") if m.strip()]
        for m in compare_measures:
            if m not in MEASURE_EXPR:
                ap.error(f"--compare-measure: unknown measure {m!r} — known: {', '.join(sorted(MEASURE_EXPR))}")
        templates = load_graph_templates()
        try:
            element_type, state = build_route_compare_section_state(
                compare_measures, templates, args.dry_run)
        except ValueError as e:
            ap.error(str(e))
        print(json.dumps({"elementType": element_type, "state": state}))
        return

    if args.title and not args.template_id:
        ap.error("--title is only meaningful with --template-id")

    if args.template_id:
        convert_template(args.template_id, dry_run=args.dry_run, replace=args.replace,
                          title_override=args.title)
        return

    if not args.report_id:
        ap.error("--report-id or --template-id is required unless --route-map-section/"
                 "--route-info-box-section/--route-compare-section is set")
    convert_report(args.report_id, dry_run=args.dry_run, replace=args.replace)


if __name__ == "__main__":
    main()
