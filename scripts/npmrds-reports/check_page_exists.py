#!/usr/bin/env python3
"""check_page_exists.py — list real, currently-existing page url_slugs from
the DMS DB, instead of guessing a dev URL and finding out from a blank/
fallback render whether it resolved.

Why this exists: `/edit/<slug>` and `/<slug>` both silently fall through to
an unrelated default page when the slug doesn't match — there's no 404, so a
wrong guess (e.g. stripping a `reports/` prefix that's actually part of the
slug itself, or a page that's since been renamed/deleted) looks like a
loading/blank page rather than an error. This queries dms_npmrdsv5.data_items
directly (read-only, via dbq.pg) and lists what's actually there.

Usage:
  python3 scripts/npmrds-reports/check_page_exists.py                # list all pages (up to --limit)
  python3 scripts/npmrds-reports/check_page_exists.py beacon          # filter by url_slug/title substring
  python3 scripts/npmrds-reports/check_page_exists.py --limit 500

With no filter, or a filter that matches nothing exactly, the search is
substring/ILIKE against both url_slug and title — a bare title fragment or a
guess with the wrong prefix still finds the real row. Prints id, type,
url_slug, title, and published status for every match, sorted by url_slug;
exits 1 if a filter is given and nothing matches.
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dbq

DEV_HOST = "http://www.localhost:5173/npmrds"  # npmrds_sub's subdomain mount was retired 2026-09-02
PAGE_TYPE = "npmrds_sub|page"  # same scope as pick_test_report.py — the mount DEV_HOST assumes.
# This app (npmrdsv5) hosts several OTHER site patterns too (tsmo2, freightatlas2, npmrds_docs,
# ...), each with its own mount — pass --type to look at one of those instead, but the printed
# view/edit URLs will only be correct for pages that actually live under DEV_HOST's mount.
SEP = "\x01"  # psql field separator — types/titles can contain a literal "|", so the default won't do


def _esc(s):
    return s.replace("'", "''")


def find(fragment=None, limit=200, page_type=PAGE_TYPE):
    where = f"type = '{_esc(page_type)}'"
    if fragment:
        s = _esc(fragment.strip().lstrip("/"))
        where += f" AND (data->>'url_slug' ILIKE '%%{s}%%' OR data->>'title' ILIKE '%%{s}%%')"
    sql = (
        "SELECT id, type, data->>'url_slug', data->>'title', data->>'published' "
        f"FROM dms_npmrdsv5.data_items WHERE {where} "
        f"ORDER BY data->>'url_slug' LIMIT {int(limit)}"
    )
    out = dbq.pg("new", sql, flags=("-t", "-A", "-F", SEP))
    if not out:
        return []
    return [line.split(SEP) for line in out.splitlines()]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("fragment", nargs="?", help="substring to match against url_slug or title (omit to list everything)")
    ap.add_argument("--limit", type=int, default=200, help="max rows to return (default 200)")
    ap.add_argument("--type", default=PAGE_TYPE, help=f"page type to search (default {PAGE_TYPE!r}); printed URLs assume DEV_HOST's mount, only correct for the default type")
    args = ap.parse_args()

    rows = find(args.fragment, args.limit, args.type)
    if not rows:
        print(f"NOT FOUND — no page matches '{args.fragment}'", file=sys.stderr)
        sys.exit(1)

    print(f"{len(rows)} page(s):\n")
    for row in rows:
        if len(row) != 5:
            continue
        _id, _type, url_slug, title, published = row
        status = "draft" if published == "draft" else "published"
        print(f"  id={_id}  [{_type}]  {status}  {url_slug}")
        print(f"    title: {title}")
        print(f"    view:  {DEV_HOST}/{url_slug}")
        print(f"    edit:  {DEV_HOST}/edit/{url_slug}")
        print()

    if len(rows) == args.limit:
        print(f"(hit --limit {args.limit} — there may be more; narrow the filter or raise --limit)", file=sys.stderr)


if __name__ == "__main__":
    main()
