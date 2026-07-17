#!/usr/bin/env python3
"""preflight.py — one-command health check of the whole old-reports dev stack.
Run at session start or whenever something hangs. Read-only; fails fast.

  python3 scripts/preflight.py

Checks: vite (5173), dms-server (3001 + /graph roundtrip), old/new/dama
Postgres, ClickHouse, stray long-running ClickHouse queries (the
unfiltered-scan hazard), and recent errors in the dms-server log. If all the
mercury/neptune backends fail together, the VPN is the likely culprit (the
dms CLI hangs in that state; these checks error within ~5s instead).
"""
import os
import socket
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dbq

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOG = os.path.join(REPO, "scratchpad/npmrds-sub/dms-server.log")
failures = []
remote_failures = 0


def check(name, fn):
    global remote_failures
    t0 = time.time()
    try:
        detail = fn() or "ok"
        status = "OK  "
    except Exception as e:
        detail = str(e).split("\n")[0][:140]
        status = "FAIL"
        failures.append(name)
        if name.startswith(("pg:", "clickhouse")):
            remote_failures += 1
    print(f"  [{status}] {name:<22} ({time.time() - t0:4.1f}s) {detail}")


def port(host, p):
    def f():
        s = socket.create_connection((host, p), timeout=3)
        s.close()
    return f


def vite():
    port("localhost", 5173)()
    return "listening"


def dms_server():
    g = dbq.graph([["dms", "data", "npmrdsv5+dev2:site", "length"]], timeout=15)
    n = g["jsonGraph"]["dms"]["data"]["npmrdsv5+dev2:site"]["length"]
    return f"/graph roundtrip ok (site length={n})"


def ch_strays():
    rows = dbq.ch(dbq.CH_PROCS_SQL, timeout=15)["data"]
    long_running = [r for r in rows if float(r[1]) > 60]
    if long_running:
        lines = "; ".join(f"{r[0]} {r[1]}s {r[4][:80]}" for r in long_running[:3])
        raise RuntimeError(f"{len(long_running)} query(s) running >60s: {lines}")
    return f"{len(rows)} active queries, none >60s"


def log_errors():
    if not os.path.exists(LOG):
        return "no log file (server started without run_server_logged.sh?)"
    tail = open(LOG, errors="replace").readlines()[-200:]
    errs = [l.strip()[:120] for l in tail if "error" in l.lower()]
    if errs:
        raise RuntimeError(f"{len(errs)} error line(s) in last 200: {errs[-1]}")
    return "no errors in last 200 lines"


print("stack preflight:")
check("vite:5173", vite)
check("dms-server:3001", dms_server)
check("pg:old (mercury:5533)", lambda: dbq.pg("old", "SELECT 1") and "SELECT 1 ok")
check("pg:new (mercury:5435)", lambda: dbq.pg("new", "SELECT 1") and "SELECT 1 ok")
check("pg:dama (neptune:5758)", lambda: dbq.pg("dama", "SELECT 1") and "SELECT 1 ok")
check("clickhouse", lambda: dbq.ch("SELECT 1") and "SELECT 1 ok")
check("clickhouse strays", ch_strays)
check("dms-server log", log_errors)

if remote_failures >= 4:
    print("\nall remote backends unreachable — VPN to mercury/neptune is likely down")
if failures:
    print(f"\nFAILED: {', '.join(failures)}")
    sys.exit(1)
print("\nall checks passed")
