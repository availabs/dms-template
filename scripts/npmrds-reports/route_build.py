#!/usr/bin/env python3
"""route_build.py — create NPMRDS routes from the CLI instead of the map tool.

The companion to `report_build.mjs`: that script needs `route_id`s and cannot
make them, and until now the only way to make one was the transportNY-only
routecreation map plugin. This closes that hole so a client request can go all
the way to a report without a human on a map.

A route is a GEOMETRY — an ordered TMC chain plus a name. It is deliberately
NOT a time window: the report's route instance owns the dates
(`useGraphPublish.js` builds the query's date/epoch arrays from the route_comp's
own startDate/endDate, and ReportRouteList never reads a route's `metadata`).
So this script writes `metadata: "{}"` and refuses to carry dates.

Two modes:

  find   read-only discovery — given a road (plus optional direction/county/
         endpoints), print the candidate TMCs in true along-road order with a
         contiguity check, and a ready-to-paste `tmcs` array per direction.

  build  validate a route spec against the TMC identification table, then
         create the catalog row(s) via the dms CLI and print a ready-to-paste
         report-spec `routes[]` fragment.

Usage:
  python3 scripts/npmrds-reports/route_build.py find --road 9D --county DUTCHESS
  python3 scripts/npmrds-reports/route_build.py find --road 9D --direction NORTHBOUND \
      --from-intersection 'MAIN ST' --to-intersection 'I-84'
  python3 scripts/npmrds-reports/route_build.py build myroutes.json --dry-run
  python3 scripts/npmrds-reports/route_build.py build myroutes.json

Route spec format (one file can hold several routes, e.g. one per direction):

  {
    "routes": [
      { "name": "NY-9D Northbound (Main St/Beacon to I-84)",
        "description": "optional free text",
        "tmcs": ["120+29712", "120+29713", "120+29714"] }
    ]
  }

`tmcs` order does not have to be correct — the build sorts to true along-road
order (`road_order`) and tells you if your input differed. That is strictly
better than the map tool, which stores click order (the shipped NY-9D route's
array is 29713, 29712, 29714 — geographically out of order).

Validation runs against
`npmrds_raw_tmc_identification.s455_v3464_NPMRDS_TMC_Identification_V5_V6`, in
three tiers. **Why so few hard errors:** deciding whether two road segments
"actually touch" is a problem as old as GIS, and every cheap test for it has
false negatives. A validator that blocks on a heuristic stops real work; one
that reports on a heuristic informs it. So only unambiguous data errors are
fatal, and `--strict` exists for callers who want the gate anyway.

  HARD ERROR (unambiguous)
    - a TMC does not exist in the identification table
    - the route mixes directions (a route is one direction, by definition —
      NB and SB are different physical TMCs that reports compare separately)
    - `tmcs` empty, `name` missing, or a date field present (a route has no dates)

  WARNING (advisory; exit 0, or fatal under --strict)
    - endpoint gap > 150 m between consecutive segments
    - spans multiple road names or multiple `tmclinear` values
    - `road_order` numbering hole
    - a route with this exact name already exists

  `--verify-routing` — EXPERIMENTAL, CURRENTLY DOES NOT WORK. DO NOT TRUST IT.
    Intended as real map-matching via routing2.availabs.org (the contract the
    plugin's `resolveRoute.js` uses). Two independent reasons it is unreliable:
      1. The service appears to IGNORE the `locations` body — two completely
         different waypoint arrays for one NY-9D chain returned a byte-identical
         22-TMC list, for I-84/US-9W in Orange County ~4 km west of the corridor,
         including SOUTHBOUND codes. Verified 2026-07-27.
      2. It is vintage-bound and TMCs CHANGE between vintages. Only 2020-2022
         return TMCs at all, so a chain that a report will query against e.g.
         2025 data would be validated against a different TMC universe than the
         one it runs on. Even a working router is the wrong oracle here.
    Left behind the flag so the next session starts from the symptom.

Two verified reasons the coordinate test can't be a gate:
  - `road_order` holes are not breaks — tmclinear 12003803 NORTHBOUND has no
    road_order 9 at all, yet 120+29711 ends exactly where 120+29712 starts.
  - divided highways and interchanges leave genuine metre-scale gaps between
    segments a driver experiences as continuous.
"""
import argparse
import json
import math
import os
import subprocess
import sys
import urllib.request
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dbq  # noqa: E402  (read-only query runner; see its module docstring)

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))

DMS_ENV = {
    "DMS_HOST": os.environ.get("DMS_HOST", "http://localhost:3001"),
    "DMS_APP": os.environ.get("DMS_APP", "npmrdsv5"),
    "DMS_TYPE": os.environ.get("DMS_TYPE", "dev2"),
}
TOKEN_FILE = os.path.join(REPO, "scratchpad/npmrds-sub/.dms-auth-token")
ROUTES_CATALOG_TYPE = "routes_data|2107427:data"
ROUTES_SOURCE_ID = 2107426
ROUTES_VIEW_ID = 2107427

TMC_TABLE = "npmrds_raw_tmc_identification.s455_v3464_NPMRDS_TMC_Identification_V5_V6"
TMC_COLS = ("tmc", "road", "direction", "county", "state", "intersection",
            "miles", "road_order", "tmclinear",
            "start_latitude", "start_longitude", "end_latitude", "end_longitude")

# Endpoint abutment is a HEURISTIC, never a gate (see the docstring). Stored
# coords are rounded, and divided highways / interchanges legitimately leave real
# gaps between segments that a driver experiences as continuous. 150 m is loose
# enough not to cry wolf on those, tight enough to notice a missing segment.
GAP_WARN_METERS = 150.0

# Routing service (map-matching). Only 2020-2022 actually return TMCs — the DB
# metadata claims 2016-2026, but live testing across 9 years found only this
# window (research/route-creation/findings.md:696-708, :863-868). Empirical from
# one location, so treat it as "known good" rather than "proven exhaustive".
ROUTING_URL = "https://routing2.availabs.org/route"
CONFLATION_VERSION = "v0_6_0"
ROUTING_YEARS = (2020, 2021, 2022)
DEFAULT_ROUTING_YEAR = 2022


def die(msg):
    print(f"error: {msg}", file=sys.stderr)
    sys.exit(1)


def dms(args, data=None):
    """Run a dms CLI command, return parsed JSON stdout. Mirrors the helper in
    convert_old_reports.py (same token file, same env, same error surface)."""
    env = os.environ.copy()
    env.update(DMS_ENV)
    if os.path.exists(TOKEN_FILE):
        env["DMS_AUTH_TOKEN"] = open(TOKEN_FILE).read().strip()
    cmd = ["dms"] + args
    if data is not None:
        cmd += ["--data", json.dumps(data)]
    r = subprocess.run(cmd, env=env, capture_output=True, text=True, timeout=120)
    out = r.stdout.strip()
    # The CLI prints a node MODULE_TYPELESS_PACKAGE_JSON warning to stdout on
    # some versions; keep only the JSON line.
    for line in out.splitlines():
        line = line.strip()
        if line.startswith("{") or line.startswith("["):
            out = line
            break
    if r.returncode or not out:
        raise RuntimeError(f"dms {' '.join(args[:3])} failed: {r.stderr.strip()[:500] or out[:500]}")
    try:
        return json.loads(out)
    except json.JSONDecodeError:
        raise RuntimeError(f"dms {' '.join(args[:3])}: non-JSON output: {out[:500]}")


def plugin_timestamp():
    """Match the routecreation plugin's format exactly, so a CLI-made row is
    indistinguishable from a UI-made one: '2026-07-27 12:34:56.789 -0400'."""
    now = datetime.now().astimezone()
    return now.strftime("%Y-%m-%d %H:%M:%S.") + f"{now.microsecond // 1000:03d} " + now.strftime("%z")


def sql_str(v):
    return "'" + str(v).replace("'", "''") + "'"


def endpoint_gap_meters(a, b):
    """Approximate metres between segment a's end and segment b's start.
    Equirectangular is plenty at these scales and needs no dependencies."""
    lat_mid = math.radians((a["end_latitude"] + b["start_latitude"]) / 2)
    dlat = (b["start_latitude"] - a["end_latitude"]) * 111_320.0
    dlon = (b["start_longitude"] - a["end_longitude"]) * 111_320.0 * math.cos(lat_mid)
    return math.hypot(dlat, dlon)


def verify_routing(name, ordered, rows_by_tmc, year):
    """Map-match the chain's endpoints with the routing service and diff its TMC
    list against ours. Advisory: the router optimises a path and may legitimately
    disagree with a deliberately-chosen chain, so this never fails a build.

    Uses the same contract as the plugin's `resolveRoute.js` — which is the one
    place in the UI allowed to know it, pending the dms-server proxy. When that
    proxy lands, point BOTH at it so the router can be swapped in one place.
    """
    # Pass EVERY segment's start plus the final end, not just the two endpoints.
    # With only 2 waypoints the router optimises its own path and can return a
    # different road entirely — verified 2026-07-27: endpoints-only for a 4-segment
    # NY-9D chain came back with 22 TMCs including SOUTHBOUND codes. A waypoint per
    # segment constrains it to the corridor, which is also how the plugin's marker
    # mode uses this service.
    segs = [rows_by_tmc[t] for t in ordered]
    locations = [{"lat": s["start_latitude"], "lon": s["start_longitude"]} for s in segs]
    locations.append({"lat": segs[-1]["end_latitude"], "lon": segs[-1]["end_longitude"]})
    url = f"{ROUTING_URL}?conflation_map_version={year}_{CONFLATION_VERSION}&return_tmcs=1"
    req = urllib.request.Request(
        url, data=json.dumps({"locations": locations}).encode(),
        headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            data = json.loads(r.read().decode())
    except Exception as e:  # noqa: BLE001 — advisory check, never fatal
        print(f"    routing check: FAILED to reach the router ({e}). Skipped.")
        return
    if data.get("err"):
        print(f"    routing check: router returned an error: {data['err']}")
        return
    ways = data.get("ways") or []
    if not ways:
        print(f"    routing check: router returned no TMCs for year {year}. "
              f"Known-good years are {ROUTING_YEARS}; an empty result is the "
              f"documented symptom of an unsupported vintage, not of a bad chain.")
        return
    ours, theirs = set(ordered), set(ways)
    if ours == theirs:
        print(f"    routing check: EXACT match — router returned the same {len(ways)} TMCs.")
        return
    missing, extra = sorted(theirs - ours), sorted(ours - theirs)
    print(f"    routing check: router path differs ({len(ways)} TMCs vs our {len(ordered)}).")
    if missing:
        print(f"      router included, we did not: {', '.join(missing)}")
    if extra:
        print(f"      we included, router did not: {', '.join(extra)}")
    print("      Not necessarily wrong — the router picks its own optimal path.")


def fetch_tmcs(tmcs):
    """Look up rows for an explicit TMC list. Returns {tmc: row-dict}."""
    if not tmcs:
        return {}
    in_list = ", ".join(sql_str(t) for t in tmcs)
    sql = (f"select {', '.join(TMC_COLS)} from {TMC_TABLE} "
           f"where tmc in ({in_list})")
    res = dbq.ch(sql)
    return {row[0]: dict(zip(TMC_COLS, row)) for row in res.get("data", [])}


# ── find ──────────────────────────────────────────────────────────────────


def cmd_find(args):
    where = [f"road ilike {sql_str('%' + args.road + '%')}"]
    if args.direction:
        where.append(f"direction = {sql_str(args.direction.upper())}")
    if args.county:
        where.append(f"county ilike {sql_str('%' + args.county + '%')}")
    if args.state:
        where.append(f"state = {sql_str(args.state.upper())}")
    sql = (f"select {', '.join(TMC_COLS)} from {TMC_TABLE} "
           f"where {' and '.join(where)} order by direction, road_order")
    res = dbq.ch(sql)
    rows = [dict(zip(TMC_COLS, r)) for r in res.get("data", [])]
    if not rows:
        die(f"no TMCs matched road~'{args.road}'"
            + (f" direction={args.direction}" if args.direction else "")
            + (f" county~'{args.county}'" if args.county else "")
            + ". Widen the filters, or check the road name spelling against the "
              "`road` column (e.g. 'NY-9D', 'I-84').")

    by_dir = {}
    for r in rows:
        by_dir.setdefault(r["direction"], []).append(r)

    for direction, segs in by_dir.items():
        print(f"\n=== {segs[0]['road']} {direction} "
              f"({len(segs)} segments, {sum(s['miles'] for s in segs):.2f} mi) ===")
        print(f"{'tmc':<12} {'ord':>5}  {'miles':>6}  ends at (intersection)")
        prev = None
        for s in segs:
            note = ""
            if prev is not None:
                gap_m = endpoint_gap_meters(prev, s)
                if gap_m > GAP_WARN_METERS:
                    note = f"   <-- gap: {gap_m:,.0f} m from the segment above"
                elif s["road_order"] != prev["road_order"] + 1:
                    note = (f"   (road_order hole {prev['road_order']:.0f}->"
                            f"{s['road_order']:.0f}; still connects)")
            print(f"{s['tmc']:<12} {s['road_order']:>5.0f}  {s['miles']:>6.3f}  {s['intersection']}{note}")
            prev = s

        sel = segs
        if args.from_intersection or args.to_intersection:
            sel = slice_by_intersections(segs, args.from_intersection, args.to_intersection)
            if sel is None:
                print("  (could not slice by the given intersections — listing all)")
                sel = segs
        print(f"\n  tmcs array ({len(sel)} segments, {sum(s['miles'] for s in sel):.2f} mi):")
        print("  " + json.dumps([s["tmc"] for s in sel]))

    print("\nNote: `intersection` names the cross-street at each segment's END in the "
          "direction of travel.\nPick the chain, then put it in a route spec's `tmcs` "
          "and run: route_build.py build <spec.json> --dry-run")
    return 0


def slice_by_intersections(segs, frm, to):
    """Inclusive slice between the segments whose `intersection` matches frm/to."""
    def find_idx(needle):
        if not needle:
            return None
        hits = [i for i, s in enumerate(segs) if needle.upper() in s["intersection"].upper()]
        return hits[0] if hits else -1

    i0 = find_idx(frm)
    i1 = find_idx(to)
    if i0 == -1 or i1 == -1:
        return None
    lo = 0 if i0 is None else i0
    hi = len(segs) - 1 if i1 is None else i1
    if lo > hi:
        lo, hi = hi, lo
    return segs[lo:hi + 1]


# ── build ─────────────────────────────────────────────────────────────────


def validate_route(spec_route, rows_by_tmc):
    """Returns (ordered_tmcs, warnings). Raises SystemExit on a hard error."""
    name = spec_route.get("name")
    tmcs = spec_route.get("tmcs") or []
    warnings = []

    missing = [t for t in tmcs if t not in rows_by_tmc]
    if missing:
        die(f"route {name!r}: these TMCs do not exist in the identification table: "
            f"{', '.join(missing)}. Check for typos, or that they're the right "
            f"direction (codes are directional: 120+29713 vs 120-29713).")

    rows = [rows_by_tmc[t] for t in tmcs]

    # Only genuinely unambiguous problems are hard errors. Everything geometric
    # is advisory — see the "why so few hard errors" note in the module docstring.
    directions = sorted({r["direction"] for r in rows})
    if len(directions) > 1:
        die(f"route {name!r}: mixes directions {directions}. Build one route per "
            f"direction — northbound and southbound are different physical TMCs, "
            f"and reports compare them as separate routes.")

    roads = sorted({r["road"] for r in rows})
    if len(roads) > 1:
        warnings.append(f"spans multiple road names {roads} — fine for a corridor that "
                        f"changes route number, wrong if a TMC slipped in by mistake")
    linears = sorted({r["tmclinear"] for r in rows})
    if len(linears) > 1:
        warnings.append(f"spans multiple tmclinear values {linears} — expected when the "
                        f"corridor crosses a linear boundary, suspicious otherwise")

    ordered = sorted(rows, key=lambda r: r["road_order"])
    if [r["tmc"] for r in ordered] != tmcs:
        warnings.append(
            "input `tmcs` order was not along-road order; reordered to "
            + ", ".join(r["tmc"] for r in ordered))

    # Coordinate continuity is the real contiguity gate, NOT consecutive
    # road_order. Verified 2026-07-27: tmclinear 12003803 NORTHBOUND has no
    # road_order 9 at all, yet 120+29711 ends at exactly where 120+29712 starts
    # — so a Teller Ave -> Main St route is continuous across the numbering
    # hole. Erroring on the gap would reject a perfectly good route.
    for a, b in zip(ordered, ordered[1:]):
        gap_m = endpoint_gap_meters(a, b)
        hole = b["road_order"] != a["road_order"] + 1
        if gap_m > GAP_WARN_METERS:
            warnings.append(
                f"{a['tmc']} -> {b['tmc']}: endpoints are {gap_m:,.0f} m apart. "
                f"Could be a missing intervening segment, or just divided-highway / "
                f"interchange geometry. Check with --verify-routing.")
        elif hole:
            warnings.append(
                f"road_order jumps {a['road_order']:.0f} ({a['tmc']}) -> "
                f"{b['road_order']:.0f} ({b['tmc']}) — a numbering hole only; endpoints "
                f"are {gap_m:,.0f} m apart, so the chain still connects")

    return [r["tmc"] for r in ordered], warnings


def existing_route_names():
    try:
        res = dms(["dataset", "query", str(ROUTES_SOURCE_ID), "--view", str(ROUTES_VIEW_ID),
                   "--limit", "5000"])
    except RuntimeError as e:
        print(f"warning: could not list existing routes for a duplicate-name check ({e})",
              file=sys.stderr)
        return {}
    out = {}
    for it in res.get("items", []):
        nm = (it.get("data") or {}).get("name")
        if nm:
            out.setdefault(nm, []).append(it.get("id"))
    return out


def cmd_build(args):
    with open(args.spec) as f:
        spec = json.load(f)
    routes = spec.get("routes")
    if not routes:
        die(f"{args.spec}: no `routes` array (or it is empty).")
    for i, r in enumerate(routes):
        if not r.get("name"):
            die(f"routes[{i}]: `name` is required — it becomes the series label in "
                f"every report that uses this route, and per-instance rename is "
                f"currently broken (parity gap #7).")
        if not r.get("tmcs"):
            die(f"routes[{i}] ({r['name']!r}): `tmcs` is required and must be non-empty.")
        for banned in ("startDate", "endDate", "dates", "metadata"):
            if banned in r:
                die(f"routes[{i}] ({r['name']!r}): `{banned}` is not a route property. "
                    f"A route is a geometry; the time window belongs to the report's "
                    f"route instance (report spec `routes[].startDate`/`endDate`). "
                    f"Nothing in the report path reads a route's own dates.")

    all_tmcs = sorted({t for r in routes for t in r["tmcs"]})
    rows_by_tmc = fetch_tmcs(all_tmcs)

    validated = []
    for r in routes:
        ordered, warnings = validate_route(r, rows_by_tmc)
        validated.append((r, ordered, warnings))

    if args.verify_routing and args.routing_year not in ROUTING_YEARS:
        die(f"--routing-year {args.routing_year} is outside the known-good window "
            f"{ROUTING_YEARS}. Years outside it return an empty TMC list rather than "
            f"an error, so a bad vintage looks exactly like a bad chain. Use 2022 "
            f"unless you have a reason not to.")

    dupes = existing_route_names() if not args.dry_run else {}
    strict_failures = []

    print(f"{'DRY RUN — ' if args.dry_run else ''}{len(validated)} route(s):\n")
    payloads = []
    for r, ordered, warnings in validated:
        first, last = rows_by_tmc[ordered[0]], rows_by_tmc[ordered[-1]]
        miles = sum(rows_by_tmc[t]["miles"] for t in ordered)
        print(f"  {r['name']}")
        print(f"    {first['road']} {first['direction']}, {first['county']} county, "
              f"{len(ordered)} segments, {miles:.2f} mi")
        print(f"    chain: {' -> '.join(ordered)}")
        print(f"    ends at: {' -> '.join(rows_by_tmc[t]['intersection'] for t in ordered)}")
        for w in warnings:
            print(f"    note: {w}")
        if r["name"] in dupes:
            warnings.append(f"a route named exactly this already exists "
                            f"(id {', '.join(str(i) for i in dupes[r['name']])})")
            print(f"    note: {warnings[-1]} — creating another.")
        if args.verify_routing:
            verify_routing(r["name"], ordered, rows_by_tmc, args.routing_year)
        if warnings and args.strict:
            strict_failures.append((r["name"], warnings))
        payloads.append({
            "name": r["name"],
            # Compact separators so the stored string is byte-identical to what
            # the plugin's JSON.stringify(tmc_array) writes — a CLI row and a UI
            # row should be indistinguishable.
            "tmc_array": json.dumps(ordered, separators=(",", ":")),
            "description": r.get("description", ""),
            "metadata": "{}",
        })
        print()

    if strict_failures:
        print("--strict: refusing to write; advisory warnings present:", file=sys.stderr)
        for nm, ws in strict_failures:
            for w in ws:
                print(f"  {nm}: {w}", file=sys.stderr)
        sys.exit(1)

    if args.dry_run:
        print("payloads that would be created:")
        print(json.dumps(payloads, indent=2))
        sys.stdout.flush()
        print("\n(no writes — drop --dry-run to create these)", file=sys.stderr)
        return 0

    created = []
    for payload, (r, ordered, _) in zip(payloads, validated):
        ts = plugin_timestamp()
        row = dict(payload, created_at=ts, updated_at=ts)
        res = dms(["raw", "create", DMS_ENV["DMS_APP"], ROUTES_CATALOG_TYPE], row)
        rid = res.get("id")
        if not rid:
            die(f"route {r['name']!r}: create returned no id: {res}")
        created.append((rid, r, ordered))
        print(f"created route_id={rid}  {r['name']}")

    print("\nreport-spec `routes[]` fragment (add startDate/endDate/color/graphs per instance):")
    frag = [{
        "id": f"route_{n + 1}",
        "route_id": rid,
        "name": r["name"],
        "startDate": "YYYY-MM-DDTHH:MM",
        "endDate": "YYYY-MM-DDTHH:MM",
        "graphs": [],
    } for n, (rid, r, _) in enumerate(created)]
    print(json.dumps(frag, indent=2))
    print("\nVerify a route reads back through the path report_build.mjs uses:")
    for rid, _, _ in created:
        print(f"  dms dataset query {ROUTES_SOURCE_ID} --view {ROUTES_VIEW_ID} --filter id={rid}")
    return 0


def main():
    p = argparse.ArgumentParser(
        description="Create NPMRDS routes from the CLI (see module docstring).")
    sub = p.add_subparsers(dest="cmd", required=True)

    f = sub.add_parser("find", help="read-only TMC chain discovery")
    f.add_argument("--road", required=True, help="road name substring, e.g. 9D, I-84")
    f.add_argument("--direction", help="NORTHBOUND | SOUTHBOUND | EASTBOUND | WESTBOUND")
    f.add_argument("--county", help="county name substring, e.g. DUTCHESS")
    f.add_argument("--state", help="state code, e.g. NY")
    f.add_argument("--from-intersection", help="slice the chain from the segment ending here")
    f.add_argument("--to-intersection", help="slice the chain to the segment ending here")

    b = sub.add_parser("build", help="validate a route spec and create the route(s)")
    b.add_argument("spec", help="path to a route spec JSON")
    b.add_argument("--dry-run", action="store_true", help="validate and print payloads, no writes")
    b.add_argument("--strict", action="store_true",
                   help="treat advisory warnings (geometry gaps, mixed road/linear) as errors")
    b.add_argument("--verify-routing", action="store_true",
                   help="map-match the chain against the routing service and diff its TMC list")
    b.add_argument("--routing-year", type=int, default=DEFAULT_ROUTING_YEAR,
                   help=f"conflation map vintage for --verify-routing "
                        f"(known-good: {', '.join(str(y) for y in ROUTING_YEARS)})")

    args = p.parse_args()
    return cmd_find(args) if args.cmd == "find" else cmd_build(args)


if __name__ == "__main__":
    sys.exit(main())
