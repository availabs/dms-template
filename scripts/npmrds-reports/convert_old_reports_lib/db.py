import json
import os
import subprocess
from datetime import datetime, timezone

from .config import DMS_ENV, NEW_DB_CONFIG, OLD_DB_CONFIG, TOKEN_FILE

# ── Low-level helpers ────────────────────────────────────────────────────────

def psql(config_path, sql):
    c = json.load(open(config_path))
    env = os.environ.copy()
    env["PGPASSWORD"] = c["password"]
    r = subprocess.run(
        ["psql", "-h", c["host"], "-p", str(c["port"]), "-U", c["user"],
         "-d", c["database"], "-t", "-A", "-c", sql],
        env=env, capture_output=True, text=True, timeout=60)
    if r.returncode:
        raise RuntimeError(f"psql failed: {r.stderr.strip()}\nSQL: {sql[:300]}")
    return r.stdout.strip()


def psql_old(sql):
    return psql(OLD_DB_CONFIG, sql)


def psql_new(sql):
    return psql(NEW_DB_CONFIG, sql)


def dms(args, data=None):
    """Run a dms CLI command, return parsed JSON stdout."""
    env = os.environ.copy()
    env.update(DMS_ENV)
    if os.path.exists(TOKEN_FILE):
        env["DMS_AUTH_TOKEN"] = open(TOKEN_FILE).read().strip()
    cmd = ["dms"] + args
    if data is not None:
        cmd += ["--data", json.dumps(data)]
    r = subprocess.run(cmd, env=env, capture_output=True, text=True, timeout=120)
    out = r.stdout.strip()
    if r.returncode or not out:
        raise RuntimeError(f"dms {' '.join(args[:3])} failed: {r.stderr.strip()[:500] or out[:500]}")
    try:
        return json.loads(out)
    except json.JSONDecodeError:
        raise RuntimeError(f"dms {' '.join(args[:3])}: non-JSON output: {out[:500]}")


def now_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")


def old_falcor_get(paths):
    """GET against the old production falcor API (graph.availabs.org)."""
    import urllib.parse
    import urllib.request
    url = ("https://graph.availabs.org/graph?paths="
           + urllib.parse.quote(json.dumps(paths)) + "&method=get")
    return json.loads(urllib.request.urlopen(url, timeout=90).read())


# ── Old-side loading ─────────────────────────────────────────────────────────

def fetch_old_report(report_id):
    out = psql_old(f"SELECT row_to_json(r) FROM admin2.reports r WHERE id = {int(report_id)}")
    if not out:
        raise RuntimeError(f"Old report {report_id} not found in admin2.reports")
    return json.loads(out)


def fetch_old_template(template_id):
    """Mirrors fetch_old_report but reads admin2.templates — same row shape
    (id/name/route_comps/graph_comps/station_comps/color_range) plus `routes`,
    the template's route-slot COUNT (1-9, distinct from `len(route_comps)`:
    one real conceptual route can back several route_comps, each a different
    date/settings VIEW of it — see dynamic-reports-and-route-tags.md item 3's
    "Old-template porting" section, template 244's 11-comps/1-route case)."""
    out = psql_old(
        "SELECT row_to_json(t) FROM (SELECT id, name, description, routes, "
        "route_comps, graph_comps, station_comps, color_range "
        f"FROM admin2.templates WHERE id = {int(template_id)}) t")
    if not out:
        raise RuntimeError(f"Old template {template_id} not found in admin2.templates")
    return json.loads(out)


def fetch_old_routes(route_ids):
    if not route_ids:
        return {}
    ids = ",".join(str(int(r)) for r in route_ids)
    out = psql_old(f"SELECT json_agg(row_to_json(r)) FROM admin2.routes r WHERE id IN ({ids})")
    rows = json.loads(out) if out and out != "null" else []
    return {str(r["id"]): r for r in rows}


# Round 82 (old-reports-conversion.md, "Round B"): old-folder-name -> agency tag CODE, for the
# 8 real `admin2.folders` type='group' folders that actually have report/template membership
# (verified via a direct count query, not assumed — every other group folder has 0 reports AND
# 0 templates). Codes must match `AGENCY_CODES` in
# src/themes/transportny/components/RouteTagBrowserModal/tagCategories.js (routes and reports
# share one agency vocabulary, Ryan's explicit call) — keep both lists in sync if either changes.
AGENCY_FOLDER_NAME_TO_CODE = {
    "NYSDOT": "NYSDOT",
    "AVAIL": "AVAIL",
    "MHV": "MHV",
    "NYSDOT CONSULTANT": "NYSDOT_CONSULTANT",
    "OCTC": "OCTC",
    "CDTC": "CDTC",
    "NPMRDS New Users": "NPMRDS_NEW_USERS",
    "GBNRTC": "GBNRTC",
}


def fetch_agency_tag(old_id, stuff_type):
    """Looks up which (if any) real agency `group` folder an old report/template belongs to
    (`admin2.stuff_in_folders`), and returns the matching `agency:<code>` tag string — or None
    if it's in no folder, a non-`group` folder (the ~88%-noise personal `user` folders), or a
    `group` folder outside the 8 known real ones (e.g. a NYSDOT sub-agency division, or a test
    folder). `stuff_type` is 'report' (admin2.reports) or 'template' (admin2.templates) — the
    same stuff_in_folders table tracks both, confirmed by a direct DISTINCT stuff_type query."""
    out = psql_old(
        f"SELECT f.name FROM admin2.stuff_in_folders sif "
        f"JOIN admin2.folders f ON f.id = sif.folder_id "
        f"WHERE sif.stuff_type = '{stuff_type}' AND sif.stuff_id = {int(old_id)} "
        f"AND f.type = 'group'")
    code = AGENCY_FOLDER_NAME_TO_CODE.get(out.strip()) if out else None
    return f"agency:{code}" if code else None


def flatten_route_comps(route_comps, gaps):
    """Old route_comps may contain type:'group' entries wrapping nested comps.
    Flatten them (only 13 group comps exist across all old reports); the group
    structure itself is recorded as a gap."""
    flat = []
    for rc in route_comps or []:
        if rc.get("type", "route") == "group":
            gaps.append({"kind": "route_group_flattened",
                         "detail": f"group '{rc.get('name')}' with "
                                   f"{len(rc.get('route_comps') or [])} routes flattened"})
            for inner in rc.get("route_comps") or []:
                flat.append(inner)
        else:
            flat.append(rc)
    return flat


