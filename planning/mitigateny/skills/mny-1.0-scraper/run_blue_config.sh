#!/usr/bin/env bash
# Config-driven blue-box driver. Reads juris[] from MNY_CONFIG, one fresh browser each, resumable.
# Usage: MNY_BASE=https://<county>.mitigateny.org MNY_CONFIG=<county>-config.json OUT=<dir> bash run_blue_config.sh
# OUT defaults to <dir of MNY_CONFIG>/_raw-scrape/blue  (override with OUT=...)
set -u
SCRAPER_DIR="C:/Code/dms-template/references/mny-transcribe/mny-1.0-scraper"
cd "$SCRAPER_DIR"
: "${MNY_CONFIG:?set MNY_CONFIG to the county config json}"
: "${MNY_BASE:?set MNY_BASE to https://<county>.mitigateny.org}"
OUT="${OUT:-$(dirname "$MNY_CONFIG")/_raw-scrape/blue}"
mkdir -p "$OUT"
export MNY_BASE MNY_WAIT="${MNY_WAIT:-8000}"
# read the juris list from the config (one per line) via node
mapfile -t JURIS < <(node -e 'const c=require(process.env.MNY_CONFIG);c.juris.forEach(j=>console.log(j))')
echo "== ${#JURIS[@]} jurisdictions -> $OUT =="
for j in "${JURIS[@]}"; do
  slug=$(echo "$j" | sed 's/[^a-zA-Z0-9]\+/_/g; s/^_//; s/_$//')
  if [ -f "$OUT/blue_${slug}.json" ]; then echo "skip $j"; continue; fi
  echo "=== $j ==="
  node scrape_blue.js "$OUT" "$j" || echo "FAILED $j (continuing)"
done
echo "BLUE BATCH DONE"
