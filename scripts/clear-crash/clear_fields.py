#!/usr/bin/env python3
"""Extract the CDV result-field catalogue straight out of the app's JS bundle.

The "all fields" list the UI offers is a static table inside the Angular lazy chunk
(`w = {basic: {...resultFields:[{id,name,code,queryLevel}...]}, ...}`).  The download
script needs the numeric ids (the API takes `resultFields` as a comma-separated id
string), so rather than hard-coding them — they change when CLEAR redeploys — we scrape
them from whatever bundle is live.

    python3 clear_fields.py            # refresh fields.json from the live app
    python3 clear_fields.py --list     # print the catalogue
"""

import argparse
import json
import re
from pathlib import Path

import requests

from clear_api import UA, log

APP = "https://clear.dot.ny.gov/clear/cdv/"
HERE = Path(__file__).resolve().parent
FIELDS_FILE = HERE / "fields.json"

LEVELS = {0: "Crash", 1: "Vehicle", 2: "Person"}


def fetch_bundles(s):
    """Return the text of every JS bundle the app loads, including the lazy chunks."""
    html = s.get(APP + "query", timeout=60).text
    names = re.findall(r'src="((?:runtime|main|scripts|polyfills)[^"]+\.js)"', html)
    texts = {}
    for n in names:
        texts[n] = s.get(APP + n, timeout=120).text
    # webpack runtime maps lazy chunk id -> content hash
    for rt in [t for n, t in texts.items() if n.startswith("runtime")]:
        m = re.search(r'\+\s*"\."\s*\+\s*(\{[^}]*\})\[e\]', rt) or re.search(
            r'"\."\+(\{[^}]*\})\[e\]\+"\.js"', rt
        )
        if not m:
            continue
        for cid, h in re.findall(r'(\d+)\s*:\s*"([0-9a-f]{16,})"', m.group(1)):
            name = f"{cid}.{h}.js"
            try:
                texts[name] = s.get(APP + name, timeout=120).text
            except Exception as e:
                log(f"chunk {name}: {e}")
    return texts


FIELD_RE = re.compile(
    r"\{id:(\d+),name:\"((?:[^\"\\]|\\.)*)\",code:\"([A-Za-z0-9_]+)\""
    r"(?:(?!\{id:).)*?queryLevel:(\d)",
    re.S,
)
GROUP_RE = re.compile(r"([A-Za-z_][A-Za-z0-9_]*):\{name:\"([^\"]+)\",isSelectedAll:")


def parse_catalogue(js):
    """Pull the {group -> [fields]} table out of one bundle."""
    start = js.find("resultFields:[")
    if start < 0:
        return None
    # the whole table lives in one object literal; walk back to its opening brace
    open_idx = js.rfind("={", 0, start)
    if open_idx < 0:
        return None
    i = open_idx + 1
    depth, end = 0, None
    for j in range(i, min(len(js), i + 400000)):
        c = js[j]
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                end = j + 1
                break
    blob = js[i:end or len(js)]

    groups = []
    marks = [(m.start(), m.group(1), m.group(2)) for m in GROUP_RE.finditer(blob)]
    for n, (pos, key, label) in enumerate(marks):
        chunk = blob[pos: marks[n + 1][0] if n + 1 < len(marks) else len(blob)]
        fields = [
            {"id": int(i_), "name": name.replace('\\"', '"'), "code": code,
             "queryLevel": int(lvl)}
            for i_, name, code, lvl in FIELD_RE.findall(chunk)
        ]
        if fields:
            groups.append({"key": key, "name": label, "fields": fields})
    return groups or None


def load():
    if not FIELDS_FILE.exists():
        raise SystemExit(f"{FIELDS_FILE} missing — run: python3 clear_fields.py")
    return json.loads(FIELDS_FILE.read_text())


def ids_for_level(cat, level):
    """Field ids valid at a query level (a Crash query cannot ask for Person columns)."""
    out = []
    for g in cat["groups"]:
        for f in g["fields"]:
            if f["queryLevel"] <= level:
                out.append(f["id"])
    return sorted(set(out))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--list", action="store_true")
    a = ap.parse_args()

    if a.list and FIELDS_FILE.exists():
        cat = load()
    else:
        s = requests.Session()
        s.headers.update({"User-Agent": UA})
        log("fetching app bundles")
        texts = fetch_bundles(s)
        cat = None
        for name, js in texts.items():
            g = parse_catalogue(js)
            if g:
                log(f"field catalogue found in {name}")
                cat = {"source": name, "groups": g}
                break
        if not cat:
            raise SystemExit("could not find the result-field catalogue in the bundles")
        FIELDS_FILE.write_text(json.dumps(cat, indent=1))
        log(f"wrote {FIELDS_FILE}")

    total = 0
    for g in cat["groups"]:
        print(f"\n## {g['name']}  ({g['key']})")
        for f in g["fields"]:
            print(f"  {f['id']:>4}  {LEVELS[f['queryLevel']]:<7} {f['code']:<34} {f['name']}")
            total += 1
    print(f"\n{total} fields in {len(cat['groups'])} groups")
    for lvl, nm in LEVELS.items():
        print(f"  {nm} query -> {len(ids_for_level(cat, lvl))} available fields")


if __name__ == "__main__":
    main()
