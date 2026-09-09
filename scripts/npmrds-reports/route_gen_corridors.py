#!/usr/bin/env python3
"""route_gen_corridors.py — generate a route_build.py spec for auto-generated
TMC-linear corridor routes, for a given year.

Reimplements the old tool's corridor generator
(avail-falcor `tasks/folders/create_and_load_corridors.py`) against a
year-matched current source instead of the old tool's frozen `tmc_metadata_2022`
snapshot. Same grouping key, same road_order sort — see
`planning/transportny/tasks/current/dynamic-reports-and-route-tags.md` (Route Tags section)
for the full trace of how this was derived and sanity-checked against the old
DB's real 2022 output.

This script only PRINTS a route_build.py-compatible spec (or writes it to a
file with --out) — it makes no writes itself. Feed the result to
`route_build.py build <spec.json> --tmc-year <year> --dry-run` to validate,
then drop --dry-run to actually create the routes.

Usage:
  python3 scripts/npmrds-reports/route_gen_corridors.py 2024 --out spec_2024.json
  python3 scripts/npmrds-reports/route_gen_corridors.py 2024 --regions 1,11
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dbq  # noqa: E402

SOURCE_TABLE = "npmrds_meta.s582_v983_NPMRDS_V6_tmc_meta"
ALL_REGIONS = [str(i) for i in range(1, 12)]

# Exact copy of NY_COUNTIES from
# src/themes/transportny/components/RouteTagBrowserModal/tagCategories.js —
# the UI's tag-folder browser does a case-sensitive `array_contains` (no
# LOWER()/ILIKE anywhere in the path, confirmed 2026-08-03), so a route's
# `county:` tag must match this casing byte-for-byte or it's invisible to
# every county folder. Source data's `county_name` column is inconsistent
# case/punctuation (e.g. "ALBANY", "ST LAWRENCE") — normalize both sides to
# compare, then emit the canonical value from this exact list.
NY_COUNTIES = [
    'Albany', 'Allegany', 'Bronx', 'Broome', 'Cattaraugus', 'Cayuga', 'Chautauqua', 'Chemung',
    'Chenango', 'Clinton', 'Columbia', 'Cortland', 'Delaware', 'Dutchess', 'Erie', 'Essex',
    'Franklin', 'Fulton', 'Genesee', 'Greene', 'Hamilton', 'Herkimer', 'Jefferson', 'Kings',
    'Lewis', 'Livingston', 'Madison', 'Monroe', 'Montgomery', 'Nassau', 'New York', 'Niagara',
    'Oneida', 'Onondaga', 'Ontario', 'Orange', 'Orleans', 'Oswego', 'Otsego', 'Putnam',
    'Queens', 'Rensselaer', 'Richmond', 'Rockland', 'St. Lawrence', 'Saratoga', 'Schenectady',
    'Schoharie', 'Schuyler', 'Seneca', 'Steuben', 'Suffolk', 'Sullivan', 'Tioga', 'Tompkins',
    'Ulster', 'Warren', 'Washington', 'Wayne', 'Westchester', 'Wyoming', 'Yates',
]


def _normalize_county(s):
    return s.upper().replace(".", "").replace(",", "").strip()


_COUNTY_LOOKUP = {_normalize_county(c): c for c in NY_COUNTIES}

# Route *names* used to carry the raw 2-digit-state + 3-digit-county FIPS code
# (e.g. "36047") plus a "(2024)" TMC-shapefile-year suffix. Ryan, 2026-09-08:
# drop both from the display name — every route here is a NYS road, so the
# state digits are dead weight, and the year was cluttering names more than it
# was helping. County was dropped too (not abbreviated — tried a 3-letter
# abbreviation first, Ryan called it ugly and pointed out the `county:` tag
# already carries that information for anyone who needs to filter/search by
# it, so the name doesn't have to).
#
# Compass words shorten to a single character in the name. A handful of source
# rows (Thruway ramp/exit segments) carry a descriptive `direction` value
# instead of one of these four words (e.g. "I-87/NEW YORK STATE THRUWAY SB") —
# `.get(direction, direction)` below leaves those untouched rather than
# mangling them.
DIRECTION_CHAR = {"NORTHBOUND": "N", "SOUTHBOUND": "S", "EASTBOUND": "E", "WESTBOUND": "W"}


def canonical_county_tag(county_name):
    """Return 'county:{ExactUiCasing}', or None if county_name doesn't map
    cleanly onto NY_COUNTIES (blank source data, out-of-state county, etc.) —
    better to omit the tag than write one the UI folder can never match."""
    if not county_name:
        return None
    canon = _COUNTY_LOOKUP.get(_normalize_county(county_name))
    return f"county:{canon}" if canon else None


def gen_year(year, regions):
    routes = []
    per_region_counts = {}
    for region in regions:
        sql = f"""
            SELECT DISTINCT tmclinear, road, county_code, county_name, direction, road_order, tmc
            FROM {SOURCE_TABLE}
            WHERE year = {int(year)} AND region_code = '{region}'
              AND tmclinear != 0 AND road != ''
        """
        res = dbq.ch(sql)
        grouped = {}
        for tmclinear, road, county_code, county_name, direction, road_order, tmc in res.get("data", []):
            key = (tmclinear, road, county_code, county_name, direction)
            grouped.setdefault(key, []).append((road_order, tmc))

        # A (road, county, direction) triple can have more than one distinct
        # tmclinear group — e.g. an avenue interrupted by a park, or split by
        # a road-class change. Each is a real, separately-geometried route
        # (the grouping key above already keeps them apart) but until
        # 2026-08-25 the *name* dropped tmclinear, so any such county silently
        # produced 2+ rows with byte-identical names — confirmed live: all 731
        # duplicate-name groups audited that day had 0 identical-geometry
        # matches, i.e. every one was this bug, not a real duplicate route.
        #
        # Deliberately kept scoped to county here even though county no longer
        # appears in the *name* (2026-09-08) — tmclinear is NOT globally
        # unique across counties: a single continuous corridor commonly spans
        # several counties under the very same tmclinear id (confirmed live,
        # e.g. I-278 EASTBOUND tmclinear 127 = Richmond+Kings+New York+Bronx,
        # 624 (tmclinear,road,direction) triples do this statewide for 2024).
        # Keying on bare (road, direction) would "disambiguate" those with
        # `#{tmclinear}` — but since they all share the same tmclinear, every
        # one would get the *same* suffix, producing several identically-named
        # rows that look disambiguated but aren't. Scoping to county avoids
        # that: within one county, two rows sharing (road, direction) really
        # do have different tmclinear values (the park/road-class-change
        # case), so the suffix there is genuinely unique. Cross-county
        # same-road-same-direction rows are left as plain duplicate names —
        # accepted (Ryan, 2026-09-08): there's no uniqueness constraint on
        # `name` in the DB, a duplicate is a UX/search concern only, and the
        # `county:` tag already lets a user tell those apart.
        name_counts = {}
        for (tmclinear, road, county_code, county_name, direction) in grouped:
            name_counts[(road, county_code, direction)] = name_counts.get(
                (road, county_code, direction), 0) + 1

        per_region_counts[region] = len(grouped)
        for (tmclinear, road, county_code, county_name, direction), members in grouped.items():
            ordered = [tmc for _, tmc in sorted(members, key=lambda m: m[0])]
            # Tags: only the categories confirmed in the 2026-07-31 taxonomy
            # work that actually apply to an auto-generated corridor route.
            # No year tag (Ryan, 2026-08-03: years aren't a static/bounded
            # list, unlike county/region/auto_generated).
            tags = ["auto_generated", f"region:{region}"]
            county_tag = canonical_county_tag(county_name)
            if county_tag:
                tags.append(county_tag)
            dir_display = DIRECTION_CHAR.get(direction, direction)
            name = f"{road} {dir_display}"
            if name_counts[(road, county_code, direction)] > 1:
                # Disambiguate with the tmclinear id itself — unique within
                # this (road, county, direction) group by construction, and
                # traceable straight back to the source data if someone asks
                # "what is this." (NOT unique across counties — see above.)
                name = f"{road} {dir_display} #{tmclinear}"
            routes.append({
                # Name carries no state/county FIPS digits (every route here
                # is a NYS road, and the `county:` tag above already carries
                # county for anyone filtering/searching by it), no
                # TMC-shapefile year, and a 1-character direction — Ryan's
                # call, 2026-09-08, reversing the 2026-08-03 decision to keep
                # year in the name. Known, accepted tradeoff: a future year's
                # regeneration of the same real-world corridor can now
                # produce an identical name to this one (year is still in
                # `description` below, just not in the display name) — that's
                # a problem for whenever a re-run actually happens, not
                # solved here.
                "name": name,
                "description": f"Auto-generated route from TMC Linear: {tmclinear} ({year})",
                "tmcs": ordered,
                "tags": tags,
            })
    return routes, per_region_counts


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("year", type=int)
    p.add_argument("--regions", default=",".join(ALL_REGIONS),
                   help="comma-separated NYSDOT region codes 1-11 (default: all)")
    p.add_argument("--out", help="write spec JSON here instead of stdout")
    args = p.parse_args()

    regions = [r.strip() for r in args.regions.split(",") if r.strip()]
    routes, per_region_counts = gen_year(args.year, regions)

    print(f"year {args.year}: {len(routes)} corridor routes across {len(regions)} region(s)",
          file=sys.stderr)
    for r in regions:
        print(f"  region {r:>2}: {per_region_counts.get(r, 0)}", file=sys.stderr)

    spec = {"routes": routes}
    out = json.dumps(spec, indent=2)
    if args.out:
        with open(args.out, "w") as f:
            f.write(out)
        print(f"\nwrote {args.out}", file=sys.stderr)
    else:
        print(out)


if __name__ == "__main__":
    main()
