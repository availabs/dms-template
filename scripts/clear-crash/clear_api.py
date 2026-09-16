#!/usr/bin/env python3
"""Shared helpers for the CLEAR scripts: token handling + ArcGIS REST calls."""

import json
import os
import subprocess
import sys
import time
from pathlib import Path

import requests

HOSTING = "https://clear.dot.ny.gov/hosting/rest/services"
CDV_LAYERS = f"{HOSTING}/CLEAR_CDV_Layers/MapServer"
GENERAL_LAYERS = f"{HOSTING}/CLEAR_General_Layers/MapServer"
CDV_API = "https://clearapi.dot.ny.gov/clearapi/cdvapi/api/"
GLOBAL_API = "https://clearapi.dot.ny.gov/clearapi/globalapi/api/"

CACHE_DIR = Path(os.environ.get("CLEAR_CACHE_DIR", Path.home() / ".cache" / "clear-cdv"))
TOKEN_FILE = CACHE_DIR / "token.json"
HERE = Path(__file__).resolve().parent

UA = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
)


def log(msg):
    print(f"[clear] {msg}", file=sys.stderr, flush=True)


def get_token(auto_login=True, min_remaining_s=600):
    """Return a valid portal token, re-running the browser login if needed."""
    try:
        d = json.loads(TOKEN_FILE.read_text())
        if d["expires_at"] - time.time() > min_remaining_s:
            return d["token"]
        log("cached token has expired")
    except Exception:
        log("no cached token")

    if not auto_login:
        raise SystemExit("no valid token — run: node clear_login.mjs")

    log("running clear_login.mjs")
    env = dict(os.environ)
    env.setdefault("DISPLAY", ":1")
    r = subprocess.run(["node", str(HERE / "clear_login.mjs")], env=env)
    if r.returncode != 0:
        raise SystemExit("login failed — run `node clear_login.mjs` by hand to see why")
    return json.loads(TOKEN_FILE.read_text())["token"]


def session():
    s = requests.Session()
    s.headers.update({"User-Agent": UA, "Referer": "https://clear.dot.ny.gov/clear/cdv/"})
    return s


def arc_get(s, url, token, **params):
    """GET an ArcGIS REST endpoint; raise on the JSON-wrapped errors ArcGIS returns as 200."""
    p = {"f": "json", "token": token}
    p.update(params)
    r = s.get(url, params=p, timeout=180)
    r.raise_for_status()
    d = r.json()
    if isinstance(d, dict) and "error" in d:
        raise RuntimeError(f"{url} -> {d['error']}")
    return d


def arc_post(s, url, token, **params):
    """Same as arc_get but POSTed — required once a where-clause gets long."""
    p = {"f": "json", "token": token}
    p.update(params)
    r = s.post(url, data=p, timeout=300)
    r.raise_for_status()
    d = r.json()
    if isinstance(d, dict) and "error" in d:
        raise RuntimeError(f"{url} -> {d['error']}")
    return d


# --------------------------------------------------------------------------- CDV JWTs
# The CDV API does not accept the portal token directly: the app trades it for two JWTs,
# one for cdvapi and one for globalapi, and sends them as Bearer tokens.


def cdv_jwt(s, portal_token):
    r = s.get(f"{CDV_API}JWT/SetUpJWTSecurity/{portal_token}", timeout=120)
    r.raise_for_status()
    return r.json()["token"]


def global_jwt(s, portal_token):
    r = s.get(
        f"{GLOBAL_API}JWT/CreateJWTToken",
        params={"portalToken": f"'{portal_token}'", "appID": "CDV", "Globalflag": "true"},
        timeout=120,
    )
    r.raise_for_status()
    return r.json()["token"]


def jwt_headers(jwt):
    return {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Authorization": f"Bearer {jwt}",
    }


def api_context(auto_login=True):
    """Return (session, portal_token, cdv_jwt, global_jwt)."""
    token = get_token(auto_login=auto_login)
    s = session()
    return s, token, cdv_jwt(s, token), global_jwt(s, token)
