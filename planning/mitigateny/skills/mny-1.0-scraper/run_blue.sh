#!/usr/bin/env bash
# Usage: run_blue.sh <Jurisdiction 1> <Jurisdiction 2> ...  (each a fresh browser; resumable)
cd "C:/Users/erick/AppData/Local/Temp/claude/C--Code/f94fbebe-bf63-4773-be75-01f7e0874ab3/scratchpad"
for j in "$@"; do
  slug=$(echo "$j" | sed 's/[^a-zA-Z0-9]\+/_/g; s/^_//; s/_$//')
  if [ -f "blue/blue_${slug}.json" ]; then echo "skip $j"; continue; fi
  echo "=== $j ==="
  node scrape_blue.js blue "$j" || echo "FAILED $j (continuing)"
done
echo "BATCH DONE"
