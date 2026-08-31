import json
import subprocess

from .config import REPO

BRIDGE_SCRIPT = f"{REPO}/scripts/npmrds-reports/compose_bridge.mjs"


def call_compose_bridge(requests):
    """Batch-compose AVL Graph section state via `compose_bridge.mjs` — the
    REAL `applyMeasurePick`/`composeMeasureConfig.js` the live in-app Measure
    Picker (and `report_build.mjs`'s Dynamic Report generator) already use,
    not a Python reimplementation. See `graph_templates.py`'s
    `ensure_bridge_graph_templates` for why this exists: the Python converter
    used to hand-build this same shape independently, which is exactly how
    bugs like the 2026-08-26 GridGraph y-axis "NaN" and confetti color scale
    kept landing in JS first and never reaching here.

    `requests`: a list of {key, graphType, measureKey, resolutionKey,
    comparisonModeKey?, anchorInvert?, seriesCount?} dicts — `key` must be
    unique per call, used to match responses back to requests.

    Returns {key: composedState} for every request that composed
    successfully; a request whose measureKey/resolutionKey is unknown to
    `vocabulary.json` is OMITTED from the result (not included as `None`) —
    callers should treat a missing key as "nothing to apply," the same
    "compose nothing" contract `composeMeasureConfig` itself uses.

    One subprocess call per invocation, covering the WHOLE batch — the Vite
    SSR-load cost (~1-3s) is paid once per Python-process run, not once per
    template or per report. Callers should batch everything they need in one
    call rather than calling this repeatedly."""
    if not requests:
        return {}
    proc = subprocess.run(
        ["node", BRIDGE_SCRIPT],
        input=json.dumps(requests), capture_output=True, text=True, timeout=120)
    if proc.returncode:
        raise RuntimeError(
            f"compose_bridge.mjs failed (exit {proc.returncode}):\n{proc.stderr[-4000:]}")
    try:
        raw = json.loads(proc.stdout)
    except json.JSONDecodeError as e:
        raise RuntimeError(
            f"compose_bridge.mjs produced non-JSON stdout: {e}\n"
            f"stdout: {proc.stdout[-2000:]}\nstderr: {proc.stderr[-2000:]}")
    return {k: v for k, v in raw.items() if v is not None}
