import re

from .config import COMPONENT_TYPE, CONVERTED_PARENT_SLUG, CONVERTED_PARENT_TITLE, PAGE_TYPE, PATTERN, REPORTS_SNAP_TABLE, REPORTS_SNAP_TYPE, ROUTES_CATALOG_TABLE, ROUTES_CATALOG_TYPE
from .db import dms, psql_new
from .transforms import js

# ── New-side operations (all writes via CLI) ────────────────────────────────

def find_page_by_slug(slug, exclude_id=None):
    cond = f"AND id != {int(exclude_id)}" if exclude_id else ""
    out = psql_new(
        "SELECT id FROM dms_npmrdsv5.data_items "
        f"WHERE type = '{PAGE_TYPE}' AND data->>'url_slug' = '{slug}' {cond} LIMIT 1")
    return int(out) if out else None


def to_snake_case(s):
    """Port of the DMS page editor's own toSnakeCase()
    (patterns/page/pages/_utils/index.js) -- same regex, same behavior."""
    if not s:
        return s
    parts = re.findall(
        r'[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+', s)
    return "_".join(p.lower() for p in parts)


def compute_report_slug(title, index="0", exclude_id=None):
    """Mirrors the page editor's getUrlSlug() (same file) so a converted
    page's slug is born equal to what the admin UI would independently
    compute from parent+title -- the scheme 34/37 already-converted pages
    live on today, not the report_<old_id> scheme this function used to
    return. That scheme was never stable: the editor's updateTitle()
    recomputes url_slug from the title on every save (intentional platform
    behavior, see find_page_by_old_report_id's docstring), so a page minted
    as report_<old_id> silently flipped to converted_reports/<title> the
    first time anyone opened/saved it -- and flipped BACK to report_<old_id>
    on every --replace reconversion, breaking whatever URL was live in the
    meantime. Minting the same slug the UI converges to means reconversion
    no longer changes the URL at all. exclude_id lets a --replace call skip
    the page about to be deleted so it never collides with itself."""
    base = f"{CONVERTED_PARENT_SLUG}/{to_snake_case(title)}"
    if find_page_by_slug(base, exclude_id=exclude_id) is None:
        return base
    return f"{base}_{index}"


def find_page_by_old_report_id(old_id):
    """Reliable "has old report <old_id> already been converted" check.
    NOT slug-based on purpose: url_slug is title-derived and the DMS page
    editor recomputes it (getUrlSlug in patterns/page/pages/_utils/index.js)
    on every title save, by design (URLs are meant to track the title) —
    so a converted page's slug can drift away from whatever `report_<old_id>`
    the converter set at creation with zero warning. Matching on that stale
    slug pattern left `--replace` unable to find (and thus delete) the old
    page before creating a new one — confirmed live: old reports 1033/1056
    each ended up with 2 duplicate pages before this fix. `_converted_from_
    old_report_id` (set on the reports_snap_2 row at creation, see `snap`
    below) never changes, so it's the durable link back to the old id."""
    out = psql_new(
        f"SELECT data->>'report_id' FROM {REPORTS_SNAP_TABLE} "
        f"WHERE data->>'_converted_from_old_report_id' = '{old_id}' LIMIT 1")
    return int(out) if out else None


def find_page_by_old_template_id(old_id):
    """find_page_by_old_report_id's twin for admin2.templates conversions — a
    separate marker key (`_converted_from_old_template_id`) so a template and
    a report can never collide on the same old id, and so template-converted
    pages aren't accidentally picked up by the report-side idempotency check
    or vice versa."""
    out = psql_new(
        f"SELECT data->>'report_id' FROM {REPORTS_SNAP_TABLE} "
        f"WHERE data->>'_converted_from_old_template_id' = '{old_id}' LIMIT 1")
    return int(out) if out else None


def delete_converted_page(page_id):
    """Delete a previously converted page + its section rows + its snap rows.
    All deletes go through the CLI (requires the auth token)."""
    page = dms(["raw", "get", str(page_id)])
    d = page["data"]
    if d is None:
        print(f"page {page_id} not found (already deleted?) — skipping")
        return
    section_ids = {s["id"] for s in (d.get("draft_sections") or [])}
    section_ids |= {s["id"] for s in (d.get("sections") or [])}
    for sid in sorted(section_ids, key=int):
        dms(["raw", "delete", "npmrdsv5", COMPONENT_TYPE, str(sid)])
    snap_ids = psql_new(
        f"SELECT id FROM {REPORTS_SNAP_TABLE} "
        f"WHERE data->>'report_id' = '{int(page_id)}'").split()
    for sid in snap_ids:
        dms(["raw", "delete", "npmrdsv5", REPORTS_SNAP_TYPE, str(sid)])
    dms(["raw", "delete", "npmrdsv5", PAGE_TYPE, str(page_id)])
    print(f"replaced: deleted page {page_id}, {len(section_ids)} section row(s), "
          f"{len(snap_ids)} snap row(s)")


def ensure_parent_page(dry_run):
    pid = find_page_by_slug(CONVERTED_PARENT_SLUG)
    if pid:
        return pid
    if dry_run:
        print(f"[dry-run] would create parent page '{CONVERTED_PARENT_TITLE}'")
        return -1
    res = dms(["page", "create", "--pattern", PATTERN,
               "--title", CONVERTED_PARENT_TITLE,
               "--slug", CONVERTED_PARENT_SLUG],
              data={"index": "99", "sidebar": "left", "published": ""})
    pid = res["id"]
    print(f"created parent page '{CONVERTED_PARENT_TITLE}' id={pid}")
    return pid


def ensure_route_in_catalog(route_id, old_route, dry_run, gaps, tmc_override=None):
    out = psql_new(
        f"SELECT 1 FROM {ROUTES_CATALOG_TABLE} "
        f"WHERE data->>'route_id' = '{int(route_id)}' LIMIT 1")
    if out:
        return "present"
    if old_route is None:
        gaps.append({"kind": "route_missing_everywhere", "route_id": route_id,
                     "detail": "not in old admin2.routes nor the new catalog"})
        return "missing"
    row = {
        "name": old_route.get("name") or "",
        "description": old_route.get("description") or "",
        "route_id": str(old_route["id"]),
        "tmc_array": js(tmc_override or old_route.get("tmc_array") or []),
        "points": js(old_route.get("points")),
        "metadata": js(old_route.get("metadata")),
        "conflation_array": js(old_route.get("conflation_array")),
        "conflation_version": old_route.get("conflation_version") or "none",
        "created_at": old_route.get("created_at") or "",
        "created_by": str(old_route.get("created_by") or ""),
        "updated_at": old_route.get("updated_at") or "",
        "isValid": True,
    }
    if dry_run:
        print(f"[dry-run] would insert route {route_id} "
              f"('{row['name']}') into Routes Data catalog")
        return "would-insert"
    dms(["raw", "create", "npmrdsv5", ROUTES_CATALOG_TYPE], data=row)
    print(f"inserted route {route_id} ('{row['name']}') into Routes Data catalog")
    return "inserted"


