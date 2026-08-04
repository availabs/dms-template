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

# ── New-system constants (npmrdsv5/dev2 dev site) ──────────────────────────
DMS_ENV = {
    "DMS_HOST": os.environ.get("DMS_HOST", "http://localhost:3001"),
    "DMS_APP": "npmrdsv5",
    "DMS_TYPE": "dev2",
}
TOKEN_FILE = os.path.join(REPO, "scratchpad/npmrds-sub/.dms-auth-token")
PATTERN = "npmrds_sub"
PAGE_TYPE = "npmrds_sub|page"
COMPONENT_TYPE = "npmrds_sub|component"
GRAPH_TEMPLATE_TYPE = "npmrds_sub|avl_graph_template"
PAGE_TEMPLATE_ID = 2187021          # "Report Page" page template row
REPORTS_SNAP_TYPE = "reports_snap_2|2177440:data"
ROUTES_CATALOG_TYPE = "routes_data|2107427:data"
# Direct-read split tables (read-only checks; writes go through the CLI)
REPORTS_SNAP_TABLE = "dms_npmrdsv5.data_items__s2177438_v2177440_reports_snap_2"
ROUTES_CATALOG_TABLE = "dms_npmrdsv5.data_items__s2107426_v2107427_routes_data"
CONVERTED_PARENT_SLUG = "converted_reports"
CONVERTED_PARENT_TITLE = "Converted Reports"

NEW_DB_CONFIG = os.path.join(
    REPO, "src/dms/packages/dms-server/src/db/configs/dms-mercury-3.config.json")
OLD_DB_CONFIG = "/home/ryan/code/avail-falcor/db_service/npmrds.config.json"

GAPS_DIR = os.path.join(REPO, "scratchpad/npmrds-sub/old-reports/gaps")

