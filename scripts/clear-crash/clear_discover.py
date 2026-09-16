#!/usr/bin/env python3
"""Dump the CLEAR map-service metadata (layers, fields, query caps) to disk.

    python3 clear_discover.py [--out meta/]

Writes one JSON per layer plus a `summary.txt` listing every layer, its geometry type,
maxRecordCount, pagination support, and field list — the input for building the
download's where-clauses and outFields.
"""

import argparse
import json
from pathlib import Path

from clear_api import CDV_LAYERS, GENERAL_LAYERS, arc_get, get_token, log, session


def dump_service(s, token, url, name, out):
    svc = arc_get(s, url, token)
    (out / f"{name}.service.json").write_text(json.dumps(svc, indent=1))
    lines = [f"=== {name}  {url}", f"    {svc.get('description','')[:200]}"]

    layers = svc.get("layers", []) + svc.get("tables", [])
    for lyr in layers:
        lid = lyr["id"]
        try:
            d = arc_get(s, f"{url}/{lid}", token)
        except Exception as e:
            lines.append(f"  [{lid}] {lyr.get('name')} -- ERROR {e}")
            continue
        (out / f"{name}.{lid}.json").write_text(json.dumps(d, indent=1))
        adv = d.get("advancedQueryCapabilities", {}) or {}
        lines.append(
            f"  [{lid}] {d.get('name')}  type={d.get('type')} "
            f"geom={d.get('geometryType')} max={d.get('maxRecordCount')} "
            f"pagination={adv.get('supportsPagination')} "
            f"stats={adv.get('supportsStatistics')} oid={d.get('objectIdField')} "
            f"fields={len(d.get('fields') or [])}"
        )
        for f in d.get("fields") or []:
            lines.append(
                f"        {f['name']:<32} {f['type'].replace('esriFieldType',''):<12} "
                f"{f.get('alias','')}"
            )
    return "\n".join(lines)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(Path(__file__).resolve().parent / "meta"))
    a = ap.parse_args()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)

    token = get_token()
    s = session()
    report = []
    for url, name in ((CDV_LAYERS, "CLEAR_CDV_Layers"), (GENERAL_LAYERS, "CLEAR_General_Layers")):
        try:
            report.append(dump_service(s, token, url, name, out))
        except Exception as e:
            report.append(f"=== {name} -- ERROR {e}")
    text = "\n".join(report)
    (out / "summary.txt").write_text(text)
    log(f"wrote {out}/summary.txt")
    print(text)


if __name__ == "__main__":
    main()
