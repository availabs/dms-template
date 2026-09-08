#!/usr/bin/env python3
"""
Convert old NPMRDS reports (npmrds_production admin2.reports) into new DMS
report pages (npmrdsv5+npmrds_sub), preserving as much old data as possible.

See src/dms/planning/tasks/current/old-reports-conversion.md for the full
design, data-shape mapping, and known gaps.

Reads:
  - OLD system: direct Postgres (admin2.reports / admin2.routes) — the old
    falcor API is not needed; creds come from avail-falcor's db config.
  - NEW system: shape checks read Postgres directly (read-only); ALL writes go
    through the DMS CLI (`dms raw create`, `dms section create`, ...) so
    dmsDataEditor semantics (split-table routing, id allocation) are preserved.

Per converted report this creates:
  - one npmrds_sub|page (child of the "Converted Reports" parent page),
    published (draft + published section copies sharing trackingIds, like the UI)
  - one ReportRouteList section + one AVL Graph section per convertible old
    graph_comp + one "Add a Route" Spreadsheet section (all cloned from the
    Report Page template row, graphs from npmrds_sub|avl_graph_template rows)
  - one reports_snap_2 row (report_id = new page id) holding the converted
    routes; unconvertible old settings are preserved verbatim on each route
    entry under _old_settings (the :data row is schema-free)
  - missing routes are upserted into the Routes Data catalog
  - a gap report (stdout + scratchpad/npmrds-sub/old-reports/gaps/)

Usage:
  python3 scripts/npmrds-reports/convert_old_reports.py --report-id 1070 [--dry-run]
"""

import argparse
import calendar
import json
import os
import re
import subprocess
import sys
import uuid
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

# One level deeper than the original single-file script (this module lives in
# convert_old_reports_lib/, a subdirectory of scripts/npmrds-reports/) — hence
# the extra os.path.dirname() on each of these versus that script's own.
REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import dbq  # noqa: E402 — sibling scripts/npmrds-reports/ module, read-only CH/PG query runner

# Shared vocabulary artifact (report-graph-vocabulary-picker.md, Workstream 1):
# the generative core of TEMPLATE_SPECS below (measure expressions, join defs,
# resolution/axis expressions, comparison-mode color rule) lives in this JSON
# so this script and the NPMRDS "Measure" picker consume the exact same formulas
# instead of two hand-synced copies. See the sibling README.md next to the JSON
# for the full field reference and the regeneration/verification procedure.
#
# It lives beside its JS consumer, inside the theme folder, because that folder is
# the unit synced into transportNY — a path outside it cannot be resolved
# downstream (see planning/skills/sync-transportnyv2-theme). Moved there
# 2026-07-29 from data-types/npmrds_graph_vocabulary/.
VOCAB_PATH = os.path.join(
    REPO, "src/themes/transportny/components/MeasurePicker/vocabulary.json"
)
with open(VOCAB_PATH) as _f:
    GRAPH_VOCAB = json.load(_f)

# Round 80 (2026-08-27, old-reports-conversion.md): the same shared static
# color-breaks table composeMapConfig.js/composeMeasureConfig.js read (see
# that file's own `_provenance` for the full "why static, why shared"
# rationale) — same cross-language-single-source-of-truth pattern as
# GRAPH_VOCAB above, so route_map.py's Route Map choropleth breaks can never
# independently drift from what the live-authoring Map/GridGraph/BarGraph
# actually render.
COLOR_BREAKS_PATH = os.path.join(
    REPO, "src/themes/transportny/components/MeasurePicker/colorBreaks.json"
)
with open(COLOR_BREAKS_PATH) as _f:
    COLOR_BREAKS = json.load(_f)["measures"]

# Semi-reverted 2026-09-02 (Ryan): mirrors composeMapConfig.js's
# `APPLY_STATIC_BREAKS_TO_MAP` (see that file's header comment) — Ryan walked back round 80's
# fixed choropleth breaks for maps too, same "own dynamic scale per report" call as the chart
# revert, kept just as easy to flip back. False = route_map.py mints `bin-method: "quantile"`
# (pre-round-80: the live Map runtime recomputes breaks from real data on every render;
# COLOR_BREAKS' `breaks`/`maxValue` for a measure go unused, only `colors` still comes from here).
# True = round 80's `bin-method: "custom"` (fixed breaks baked at conversion time). Flip alongside
# composeMapConfig.js's flag, not independently — a report converted with one setting and
# re-authored live under the other gets a mismatched map.
APPLY_STATIC_BREAKS_TO_MAP = False

# ── New-system constants (npmrdsv5/dev2 dev site) ──────────────────────────
# npmrdsv5's app/pattern name and the reports_snap_2 catalog's source/view ids
# are the single source of truth in hooks/reports_snap_ids.json — also read by
# report_build.mjs, prune_report_snap_orphans.mjs, and dms-server's
# npmrds_report_page_delete_hook.js. Do not hardcode a second copy here.
with open(os.path.join(REPO, "hooks/reports_snap_ids.json")) as _f:
    _REPORTS_SNAP_IDS = json.load(_f)

DMS_ENV = {
    "DMS_HOST": os.environ.get("DMS_HOST", "http://localhost:3001"),
    "DMS_APP": _REPORTS_SNAP_IDS["app"],
    "DMS_TYPE": "dev2",
}
TOKEN_FILE = os.path.join(REPO, "scratchpad/npmrds-sub/.dms-auth-token")
PATTERN = _REPORTS_SNAP_IDS["pattern"]
PAGE_TYPE = f"{PATTERN}|page"
COMPONENT_TYPE = f"{PATTERN}|component"
GRAPH_TEMPLATE_TYPE = f"{PATTERN}|avl_graph_template"
PAGE_TEMPLATE_ID = 2187021          # "Report Page" page template row
REPORTS_SNAP_SOURCE_ID = _REPORTS_SNAP_IDS["reports_snap_source_id"]
REPORTS_SNAP_VIEW_ID = _REPORTS_SNAP_IDS["reports_snap_view_id"]
REPORTS_SNAP_TYPE = f"reports_snap_2|{REPORTS_SNAP_VIEW_ID}:data"
ROUTES_CATALOG_TYPE = "routes_data|2107427:data"
# Direct-read split tables (read-only checks; writes go through the CLI)
REPORTS_SNAP_TABLE = (
    f"dms_{DMS_ENV['DMS_APP']}.data_items__s{REPORTS_SNAP_SOURCE_ID}"
    f"_v{REPORTS_SNAP_VIEW_ID}_reports_snap_2"
)
ROUTES_CATALOG_TABLE = "dms_npmrdsv5.data_items__s2107426_v2107427_routes_data"
CONVERTED_PARENT_SLUG = "reports"
CONVERTED_PARENT_TITLE = "Converted Reports"

NEW_DB_CONFIG = os.path.join(
    REPO, "src/dms/packages/dms-server/src/db/configs/dms-mercury-3.config.json")
OLD_DB_CONFIG = "/home/ryan/code/avail-falcor/db_service/npmrds.config.json"
# Same Postgres host:port as NEW_DB_CONFIG, different `database` (avail_auth vs dms3) — see
# fetch_auth_agency_tags() in db.py.
AUTH_DB_CONFIG = os.path.join(
    REPO, "src/dms/packages/dms-server/src/db/configs/availauth.config.json")

GAPS_DIR = os.path.join(REPO, "scratchpad/npmrds-sub/old-reports/gaps")

