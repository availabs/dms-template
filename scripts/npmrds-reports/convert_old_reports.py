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

This file is a thin CLI entry point — the implementation (~6000 lines) lives
in convert_old_reports_lib/, split into ~15 single-purpose modules (config,
vocabulary, template specs, DB helpers, section builders, the two conversion
flows, the CLI itself...) so any one change touches a small file instead of
the whole thing. Kept as a standalone module (not folded into the package)
because census_old_reports.py does `from convert_old_reports import (...)` —
the `import *` below re-exports everything that needs, unchanged.
"""

from convert_old_reports_lib import *  # noqa: F401,F403
from convert_old_reports_lib.cli import main

if __name__ == "__main__":
    main()
