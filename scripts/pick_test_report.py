#!/usr/bin/env python3
"""pick_test_report.py — pick a real, existing converted-report page to use as
a live-verification target, instead of guessing a URL slug.

Why this exists: the old `report_<old_id>` slug scheme is DEPRECATED and
unstable — url_slug is title-derived and gets recomputed by the page editor
on every title save (see `compute_report_slug()` in convert_old_reports.py),
so a `report_<old_id>` URL can silently 404 or — worse — fall through to an
unrelated default/live page that still renders, making a broken test target
look like a working one. The only slugs guaranteed to resolve today live
under `converted_reports/<title_snake_case>` (see PAGE_TYPE/CONVERTED_PARENT_SLUG
in convert_old_reports.py). This script queries the real DMS DB (read-only,
via dbq.pg) and returns slugs that actually exist right now, so there's no
guessing involved.

Any converted_reports page is fine for read-only Playwright verification
(page load + capture, no clicks/writes) — these are real converted report
pages, not a special "scratch" pool. For anything that involves clicking /
editing / saving, still make or use a dedicated scratch page instead (see
[[feedback_use_own_scratch_page_for_ui_testing]]) — this script is for
picking a safe URL to *look at*, not a page to interact with.

Usage:
  python3 scripts/pick_test_report.py                  # one random slug + full URL
  python3 scripts/pick_test_report.py --count 5         # 5 random slugs
  python3 scripts/pick_test_report.py --search "bridge" # random match containing "bridge"
  python3 scripts/pick_test_report.py --list 20         # list 20 (id, slug, title), no randomness
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dbq

PAGE_TYPE = "npmrds_sub|page"
CONVERTED_PARENT_SLUG = "converted_reports"
DEV_HOST = "http://npmrds.localhost:5173"


def _rows(sql):
    out = dbq.pg("new", sql)
    if not out:
        return []
    return [line.split("|") for line in out.splitlines()]


def pick_random(n=1, search=None):
    like = f"{CONVERTED_PARENT_SLUG}/%{search}%" if search else f"{CONVERTED_PARENT_SLUG}/%"
    search_clause = f"AND data->>'title' ILIKE '%{search}%'" if search else ""
    sql = (
        "SELECT id, data->>'url_slug', data->>'title' "
        "FROM dms_npmrdsv5.data_items "
        f"WHERE type = '{PAGE_TYPE}' AND data->>'url_slug' LIKE '{like}' {search_clause} "
        f"ORDER BY random() LIMIT {int(n)}"
    )
    return _rows(sql)


def list_reports(n=20):
    sql = (
        "SELECT id, data->>'url_slug', data->>'title' "
        "FROM dms_npmrdsv5.data_items "
        f"WHERE type = '{PAGE_TYPE}' AND data->>'url_slug' LIKE '{CONVERTED_PARENT_SLUG}/%' "
        f"ORDER BY id LIMIT {int(n)}"
    )
    return _rows(sql)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--count", type=int, default=1, help="how many random slugs to return")
    ap.add_argument("--search", help="only consider titles containing this substring")
    ap.add_argument("--list", type=int, metavar="N", help="list N converted_reports pages by id (no randomness)")
    args = ap.parse_args()

    rows = list_reports(args.list) if args.list else pick_random(args.count, args.search)
    if not rows:
        print("no matching converted_reports pages found", file=sys.stderr)
        sys.exit(1)

    for row in rows:
        if len(row) != 3:
            continue
        _id, slug, title = row
        print(f"{DEV_HOST}/{slug}    [id={_id}] {title}")


if __name__ == "__main__":
    main()
