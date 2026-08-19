#!/usr/bin/env bash
# Robust full scrape for a MNY 1.0 county at scale (many jurisdictions):
#   county block via scrape_all.js (MNY_COUNTY_ONLY, retried), then annexes fresh-browser-per-jurisdiction
#   via scrape_one.js with an Edge kill before each (prevents orphan buildup -> detached-Frame crashes).
# Usage: MNY_BASE=... MNY_CONFIG=<abs config.json> OUT=<abs _raw-scrape dir> bash run_scrape_config.sh
set -u
cd "C:/Code/dms-template/references/mny-transcribe/mny-1.0-scraper"
: "${MNY_CONFIG:?}"; : "${MNY_BASE:?}"; : "${OUT:?}"
export MNY_BASE MNY_CONFIG MNY_WAIT="${MNY_WAIT:-8000}"
mkdir -p "$OUT"
killedge(){ MSYS_NO_PATHCONV=1 taskkill -F -IM msedge.exe >/dev/null 2>&1 || true; sleep 2; }

echo "===== COUNTY BLOCK ====="
for i in 1 2 3 4 5; do
  [ -f "$OUT/county_hazard_Wind.txt" ] && { echo "county block present"; break; }
  killedge; echo "-- county attempt $i --"
  MNY_COUNTY_ONLY=1 node scrape_all.js "$OUT" || echo "county attempt $i errored"
done
[ -f "$OUT/county_hazard_Wind.txt" ] || { echo "FATAL: county block never completed"; exit 1; }

echo "===== ANNEXES (fresh browser each) ====="
mapfile -t JURIS < <(node -e 'require(process.env.MNY_CONFIG).juris.forEach(j=>console.log(j))')
echo "${#JURIS[@]} jurisdictions"
for j in "${JURIS[@]}"; do
  slug=$(echo "$j" | sed 's/[^a-zA-Z0-9]\+/_/g; s/^_//; s/_$//')
  if [ -f "$OUT/annex_${slug}_strategies.txt" ]; then echo "skip $j"; continue; fi
  killedge
  echo "=== $j ==="
  node scrape_one.js "$OUT" "$j" || echo "FAILED $j (continuing)"
done
echo "ALLEGANY SCRAPE DONE"
