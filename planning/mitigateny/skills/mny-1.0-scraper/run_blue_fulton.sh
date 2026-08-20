#!/usr/bin/env bash
# Fulton blue-box driver. Fresh browser per jurisdiction (memory isolation); resumable.
# Usage: MNY_BASE=https://fulton.mitigateny.org bash run_blue_fulton.sh
set -u
SCRAPER_DIR="C:/Code/dms-template/references/mny-transcribe/mny-1.0-scraper"
OUT="C:/Code/dms-template/references/mny-transcribe/fulton/_raw-scrape/blue"
mkdir -p "$OUT"
cd "$SCRAPER_DIR"
export MNY_BASE="${MNY_BASE:-https://fulton.mitigateny.org}"
JURIS=("Bleecker (Town)" "Broadalbin (Town)" "Broadalbin (Village)" "Caroga (Town)" "Ephratah (Town)" "Johnstown (Town)" "Mayfield (Town)" "Mayfield (Village)" "Northampton (Town)" "Northville (Village)" "Oppenheim (Town)" "Perth (Town)" "Stratford (Town)")
for j in "${JURIS[@]}"; do
  slug=$(echo "$j" | sed 's/[^a-zA-Z0-9]\+/_/g; s/^_//; s/_$//')
  if [ -f "$OUT/blue_${slug}.json" ]; then echo "skip $j"; continue; fi
  echo "=== $j ==="
  node scrape_blue.js "$OUT" "$j" || echo "FAILED $j (continuing)"
done
echo "BLUE BATCH DONE"
