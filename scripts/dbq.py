#!/usr/bin/env python3
"""dbq.py — read-only query runner for every data backend the old-reports
conversion task touches. Works as a CLI and as an importable module, so
bespoke validation scripts stop re-implementing psql()/q()/falcor helpers.

Targets (creds are read at runtime from the known config files and never
appear on the command line):
  old       Postgres npmrds_production @ mercury:5533  (schema admin2 — old reports)
  new       Postgres dms3 @ mercury:5435               (schema dms_npmrdsv5 — new DMS content)
  dama      Postgres npmrds2 @ neptune:5758            (dama/pm3 sources + views)
  ch        ClickHouse HTTP                            (npmrds2.config.json -> "clickhouse")
  graph     local dms-server Falcor GET                (default http://localhost:3001)
  oldgraph  old prod Falcor GET                        (https://graph.availabs.org)
  chprocs   canned check: running ClickHouse queries (no query arg) — run this
            before/after live-loading report pages to catch stray unfiltered
            scans of the NPMRDS fact table (they run for an hour+, silently)

READ-ONLY BY DESIGN: pg targets run with default_transaction_read_only=on,
ClickHouse with readonly=2. There is deliberately no --write flag — writes go
through convert_old_reports.py, the dms CLI, or the user. Connections fail
fast (5s) with a VPN hint instead of hanging when mercury/neptune are
unreachable.

CLI:
  python3 scripts/dbq.py old "SELECT count(*) FROM admin2.reports"
  python3 scripts/dbq.py new "SELECT id, type FROM dms_npmrdsv5.data_items LIMIT 5" --csv
  python3 scripts/dbq.py ch  "SELECT count() FROM npmrds.s583_v982_NPMRDS_V6"
  python3 scripts/dbq.py ch  "DESCRIBE npmrds.s583_v982_NPMRDS_V6" --format PrettyCompact
  python3 scripts/dbq.py old -f peek.sql          # SQL from file
  echo "SELECT 1" | python3 scripts/dbq.py dama -  # SQL from stdin
  python3 scripts/dbq.py graph '[["dms","data","npmrdsv5+dev2:site","length"]]'

Import (from scripts/ or with scripts/ on sys.path):
  import dbq
  dbq.pg("old", sql)            -> unaligned text (psql -t -A), converter-style
  dbq.ch(sql)                   -> parsed dict (JSONCompact: keys meta/data/rows)
  dbq.ch(sql, fmt="Pretty")     -> formatted text
  dbq.graph(paths)              -> parsed jsonGraph dict (local dms-server)
  dbq.old_graph(paths)          -> parsed jsonGraph dict (graph.availabs.org)
"""
import argparse
import json
import os
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PG_CONFIGS = {
    "old": os.environ.get("DBQ_OLD_CONFIG",
        "/home/ryan/code/avail-falcor/db_service/npmrds.config.json"),
    "new": os.environ.get("DBQ_NEW_CONFIG", os.path.join(
        REPO, "src/dms/packages/dms-server/src/db/configs/dms-mercury-3.config.json")),
    "dama": os.environ.get("DBQ_DAMA_CONFIG",
        "/home/ryan/code/avail-falcor/db_service/npmrds2.config.json"),
}
CH_CONFIG = os.environ.get("DBQ_CH_CONFIG", PG_CONFIGS["dama"])
GRAPH_HOST = os.environ.get("DBQ_GRAPH_HOST", "http://localhost:3001")
OLD_GRAPH_HOST = "https://graph.availabs.org"
VPN_HINT = "hint: connection failed fast — is the VPN to mercury/neptune up?"


def pg(target, sql, timeout=60, flags=("-t", "-A")):
    """Run SQL against a Postgres target, read-only. Returns stdout text."""
    c = json.load(open(PG_CONFIGS[target]))
    env = os.environ.copy()
    env["PGPASSWORD"] = c["password"]
    env["PGCONNECT_TIMEOUT"] = "5"
    env["PGOPTIONS"] = (f"-c default_transaction_read_only=on "
                        f"-c statement_timeout={int(timeout * 1000)}")
    r = subprocess.run(
        ["psql", "-X", "-v", "ON_ERROR_STOP=1",
         "-h", c["host"], "-p", str(c["port"]), "-U", c["user"],
         "-d", c["database"], *flags, "-c", sql],
        env=env, capture_output=True, text=True, timeout=timeout + 15)
    if r.returncode:
        err = r.stderr.strip()
        if "timeout expired" in err or "could not connect" in err:
            err += "\n" + VPN_HINT
        raise RuntimeError(f"psql[{target}] failed: {err}\nSQL: {sql[:300]}")
    return r.stdout.rstrip("\n")


def ch(sql, fmt="JSONCompact", timeout=120):
    """Run SQL against ClickHouse over HTTP, readonly=2. Returns parsed JSON
    for JSON* formats, otherwise formatted text."""
    conf = json.load(open(CH_CONFIG))["clickhouse"]
    url = f"http://{conf['host']}:{conf['port']}/?" + urllib.parse.urlencode({
        "database": conf["database"], "default_format": fmt, "readonly": 2})
    req = urllib.request.Request(url, data=sql.encode(), headers={
        "X-ClickHouse-User": conf["user"], "X-ClickHouse-Key": conf["password"]})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            body = r.read().decode()
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"clickhouse HTTP {e.code}: {e.read().decode()[:800]}") from None
    except urllib.error.URLError as e:
        raise RuntimeError(f"clickhouse unreachable: {e.reason}\n{VPN_HINT}") from None
    return json.loads(body) if fmt.startswith("JSON") else body.rstrip("\n")


CH_PROCS_SQL = ("SELECT query_id, round(elapsed, 1) AS elapsed_s, read_rows, "
                "formatReadableSize(memory_usage) AS mem, left(query, 200) AS query "
                "FROM system.processes WHERE query NOT LIKE '%system.processes%' "
                "ORDER BY elapsed DESC")


def ch_procs(fmt="PrettyCompact"):
    """Canned check for stray/long-running ClickHouse queries."""
    return ch(CH_PROCS_SQL, fmt=fmt, timeout=15)


def _falcor_get(host, paths, timeout=90):
    if not isinstance(paths, str):
        paths = json.dumps(paths)
    json.loads(paths)  # validate before sending
    url = f"{host}/graph?paths={urllib.parse.quote(paths)}&method=get"
    with urllib.request.urlopen(url, timeout=timeout) as r:
        return json.loads(r.read())


def graph(paths, host=GRAPH_HOST, timeout=90):
    """Falcor GET against the local dms-server."""
    return _falcor_get(host, paths, timeout)


def old_graph(paths, timeout=90):
    """Falcor GET against the old production API (graph.availabs.org)."""
    return _falcor_get(OLD_GRAPH_HOST, paths, timeout)


def main():
    ap = argparse.ArgumentParser(
        description="Read-only query runner (see module docstring for targets)")
    ap.add_argument("target",
                    choices=["old", "new", "dama", "ch", "graph", "oldgraph", "chprocs"])
    ap.add_argument("query", nargs="?", help="SQL / falcor paths JSON; '-' = stdin")
    ap.add_argument("-f", "--file", help="read query from file")
    ap.add_argument("--csv", action="store_true", help="pg: CSV output")
    ap.add_argument("--raw", action="store_true", help="pg: unaligned -t -A output")
    ap.add_argument("--format", default=None,
                    help="ch: default_format (default JSONCompact; try PrettyCompact)")
    ap.add_argument("--timeout", type=int, default=None, help="seconds")
    ap.add_argument("--host", default=GRAPH_HOST, help="graph: dms-server origin")
    a = ap.parse_args()

    if a.target == "chprocs":
        try:
            print(ch_procs(fmt=a.format or "PrettyCompact") or "(no running queries)")
        except RuntimeError as e:
            print(str(e), file=sys.stderr)
            sys.exit(1)
        return

    if a.file:
        q = open(a.file).read()
    elif a.query == "-" or a.query is None:
        q = sys.stdin.read()
    else:
        q = a.query
    if not q.strip():
        ap.error("empty query")

    try:
        if a.target in PG_CONFIGS:
            flags = ("--csv",) if a.csv else ("-t", "-A") if a.raw else ()
            print(pg(a.target, q, timeout=a.timeout or 60, flags=flags))
        elif a.target == "ch":
            out = ch(q, fmt=a.format or "JSONCompact", timeout=a.timeout or 120)
            print(json.dumps(out, indent=1) if isinstance(out, (dict, list)) else out)
        else:
            host = OLD_GRAPH_HOST if a.target == "oldgraph" else a.host
            print(json.dumps(_falcor_get(host, q, timeout=a.timeout or 90), indent=1))
    except RuntimeError as e:
        print(str(e), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
