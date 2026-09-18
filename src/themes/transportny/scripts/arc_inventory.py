#!/usr/bin/env python3
"""Inventory the NPMRDS Routes/Reports arc's planning + task docs.

Re-derives every status line from the task files themselves so the listing can't
drift the way a hand-written snapshot would. Submodule membership in the arc is an
explicit allowlist (most of src/dms/planning is unrelated platform work); anything
new that looks arc-shaped but isn't classified is reported under UNCLASSIFIED so
the allowlist gets noticed when it goes stale.

Usage:
    python3 src/themes/transportny/scripts/arc_inventory.py            # grouped listing
    python3 src/themes/transportny/scripts/arc_inventory.py --open     # open items only
    python3 src/themes/transportny/scripts/arc_inventory.py --dupes    # todo.md duplicate targets
"""
import re
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]

# Everything under these dirs is arc work by construction.
ROOT_DIRS = [
    "planning/transportny/tasks/current",
    "planning/transportny/tasks/completed",
]
# Shared-project tasks that are arc-driven (theme tokens the report pages consume).
SHARED_ALLOW = {"theme-legend-token-consolidation.md"}

# src/dms is the whole DMS library; only these tasks belong to this arc.
SUBMODULE_ALLOW = {
    "current/old-reports-conversion.md",
    "current/old-reports-conversion-archive.md",
    "current/avlgraph-legend-and-padding-theming.md",
    "current/routecreation-marker-placement-autorouting.md",
    "current/reportroutelist-graphids-wiped-on-refresh.md",
    "current/reportroutelist-page-templates.md",
    "current/dynamic-report-nongraph-section-binding.md",
    "current/route-build-duplicate-falcor-instances.md",
    "current/comparison-series-explicit-color.md",
    "current/comparison-series-query-fanout.md",
    "current/comparisonseries-stable-series-key.md",
    "current/length-query-calculated-groupby-alias.md",
    "current/migrate-legacy-graph-to-graph-new.md",
    "current/epoch-time-format-bucket-width.md",
    "current/gridgraph-overlays-and-list-publish.md",
    "current/section-header-tokens-and-legend-corners.md",
    "current/clickhouse-unfiltered-probe-hazard.md",
    "current/page-delete-lifecycle-hook.md",
    "current/delete-cascade-source-view-orphans.md",
    "current/tooltip-swatch-muting-obscures-series-color.md",
    "current/duration-value-format-mm-ss.md",
    "completed/report-graph-vocabulary-picker.md",
    "completed/comparison-series-difference-mode.md",
    "completed/graph-title-inline-with-legend.md",
    "completed/graph-legend-top-bottom-position-scoping.md",
    "completed/blank-comparison-leaf-guard.md",
    "completed/linegraph-day-resolution-invisible-line.md",
}
ARC_HINT = re.compile(
    r"npmrds|converted_report|route creation|routecreation|report page|rrl\b|"
    r"reportroutelist|comparison.?series|gridgraph|old.?report",
    re.I,
)

RESEARCH = "research/npmrds-reports"
RESEARCH_EXTRA = [
    "research/route-creation/findings.md",
    "research/report-page-redesign/findings.md",
    "research/npmrds-category-design/critique-round-1.md",
    "research/routing/ROUTING_TASKS.md",
    "research/routing/ROUTING_API_TASKS.md",
    "research/routing/ROUTING_LOG.md",
]

DONE = re.compile(r"\b(DONE|CLOSED|COMPLETE|COMPLETED|SHIPPED|IMPLEMENTED|FIXED|BUILT)\b")
NOT_STARTED = re.compile(r"NOT STARTED|not started|SCOPING ONLY|SCOPED ONLY")


def status_of(path: Path) -> str:
    """First status-ish line in the file's header block, flattened to one line."""
    try:
        head = path.read_text(errors="replace").split("\n")[:40]
    except OSError:
        return "?"
    blob = " ".join(head)
    m = re.search(r"\*\*Status[:,][^\n]*", blob)
    if m:
        txt = m.group(0)
    else:
        m = re.search(r"(?im)^#+\s*(?:Current )?status\b[:\s]*(.*)$", "\n".join(head))
        txt = m.group(1) if m else ""
    txt = re.sub(r"\*\*|\[|\]|`", "", txt).strip()
    txt = re.sub(r"\s+", " ", txt)
    return txt[:150] if txt else "(no status header)"


def bucket(status: str, in_completed: bool, name: str = "") -> str:
    if name.endswith("-archive.md"):
        return "ARCHIVE"
    if in_completed:
        return "DONE"
    if NOT_STARTED.search(status):
        return "NOT STARTED"
    if DONE.search(status):
        return "MOSTLY DONE"
    return "IN PROGRESS"


def collect():
    rows = []
    for d in ROOT_DIRS:
        for p in sorted((ROOT / d).glob("*.md")):
            rows.append((d, p))
    for name in sorted(SHARED_ALLOW):
        p = ROOT / "planning/shared/tasks/current" / name
        if p.exists():
            rows.append(("planning/shared/tasks/current", p))
    for rel in sorted(SUBMODULE_ALLOW):
        p = ROOT / "src/dms/planning/tasks" / rel
        if p.exists():
            rows.append(("src/dms/planning/tasks/" + rel.split("/")[0], p))
    return rows


def unclassified():
    """Arc-looking submodule tasks not in the allowlist — catches allowlist staleness."""
    out = []
    for sub in ("current", "completed"):
        for p in sorted((ROOT / "src/dms/planning/tasks" / sub).glob("*.md")):
            rel = f"{sub}/{p.name}"
            if rel in SUBMODULE_ALLOW:
                continue
            try:
                hits = len(ARC_HINT.findall(p.read_text(errors="replace")))
            except OSError:
                continue
            if hits >= 6:
                out.append((hits, rel))
    return sorted(out, reverse=True)


def main():
    args = set(sys.argv[1:])
    rows = collect()

    if "--dupes" in args:
        todo = (ROOT / "planning/todo.md").read_text(errors="replace")
        seen = {}
        for line in todo.splitlines():
            m = re.match(r"- \[( |x)\] \[(.+?)\]\((\./[^)]+)\)", line)
            if m:
                seen.setdefault(m.group(3), []).append((m.group(1), m.group(2)))
        print("todo.md entries pointing at the same task file more than once:\n")
        for target, entries in seen.items():
            if len(entries) > 1:
                print(f"  {target}")
                for state, title in entries:
                    print(f"      [{state}] {title}")
        return

    groups = {"IN PROGRESS": [], "MOSTLY DONE": [], "NOT STARTED": [], "DONE": [], "ARCHIVE": []}
    for d, p in rows:
        st = status_of(p)
        groups[bucket(st, "completed" in d, p.name)].append((d, p, st))

    order = ["IN PROGRESS", "MOSTLY DONE", "NOT STARTED"]
    if "--open" not in args:
        order += ["DONE", "ARCHIVE"]

    total = sum(len(v) for v in groups.values())
    print(f"NPMRDS Routes/Reports arc — {total} task docs  (generated {date.today()})\n")
    for g in order:
        items = sorted(groups[g], key=lambda r: r[1].name)
        print(f"{'=' * 78}\n{g}  ({len(items)})\n{'=' * 78}")
        for d, p, st in items:
            kb = p.stat().st_size // 1024
            where = "dms" if "src/dms" in d else ("shared" if "shared" in d else "tny")
            print(f"  [{where}] {p.name}  ({kb}K)")
            print(f"      {st}")
        print()

    un = unclassified()
    if un:
        print(f"{'=' * 78}\nUNCLASSIFIED — arc-shaped submodule tasks not in the allowlist "
              f"({len(un)})\n{'=' * 78}")
        for hits, rel in un:
            print(f"  {hits:>3} hits  {rel}")
        print("\n  Add real arc members to SUBMODULE_ALLOW in this script, or ignore as platform work.")

    print(f"\nResearch docs: {RESEARCH}/ (7 files) + "
          f"{len(RESEARCH_EXTRA)} siblings — see RESEARCH_EXTRA in this script.")


if __name__ == "__main__":
    main()
