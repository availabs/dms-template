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


