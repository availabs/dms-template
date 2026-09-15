// Query-identity normalisation for the golden-corpus diff. Lives in its own module so it can be
// exercised directly against real baselines/dumps (`node probe_corpus_keys.mjs --check`) rather
// than only through a 10-minute corpus run.

// The /graph match key.
//
// It used to be the FULL decoded query URL. That embeds the column select list, every series
// label, enumerated date arrays (1,148 distinct YYYY-MM-DD literals in one corpus entry) and the
// view id — so ANY benign authoring or schema change invalidated whole swaths at once and reported
// each as a Major. Two measured examples from 2026-09-14, neither a regression:
//
//   - one column added to the routes-list query (`data->>'counts_label'`) => 1 Major in every
//     one of the 8 entries
//   - a series relabel, "Summer (Avg Day)" -> "Summer"                     => 29 Majors in one entry
//
// So the key now normalises away the parts that identify PRESENTATION, and keeps the parts that
// identify WHICH DATA is being asked for. Date values are deliberately still significant in count
// (a report that switches from 4 years to 1 year genuinely changed and should be flagged once);
// only their literal values are collapsed, so a shifted window does not masquerade as a new query.
export function structuralKey(decoded) {
  // ONLY the column select run is lifted out. Everything else — view id, options, filters,
  // groupBy, series labels and literal date values — is identity and stays in the key.
  //
  // Earlier revisions of this function also normalised away date VALUES and series LABELS. Both
  // were wrong, for the same reason: the noise they were suppressing came from comparing against
  // a 12-day-stale baseline, not from run-to-run variance. Measured 2026-09-14, dates were
  // already identical on both sides (seasonality: 378 dates, 2025-12-19..2026-12-31, both), which
  // is exactly what pinning `&asOf=` on every dynamic entry is for. Normalising them bought
  // nothing and blinded the suite to a date-window regression — the precise failure half these
  // corpus entries exist to cover (relativeDateResolution, dateFormula, derivedFromRoute).
  //
  // A label or date change is now a Major again. That is the correct outcome: confirm it was
  // intended, then re-baseline. Re-baselining is cheap and, since the settle fix, safe.
  //
  // The column subset rule below is kept, because a schema addition (e.g. `counts_label` landing
  // on the routes-list query) genuinely is benign and genuinely does hit every entry at once.
  return decoded.replace(/"[^"]{1,200} as [^"]{1,80}"(?:\s*,\s*"[^"]{1,200} as [^"]{1,80}")*/g, '"<cols>"');
}

// The aliases a query selects, e.g. ["report_id","name",...]. Sorted so request order is irrelevant.
export function columnsOf(decoded) {
  const out = [];
  for (const m of decoded.matchAll(/"[^"]{1,200} as ([^"]{1,80})"/g)) out.push(m[1]);
  return [...new Set(out)].sort();
}

// Match one baseline query against this run's queries.
//
// Two stages, because the two failure modes pull in opposite directions: the key has to be loose
// enough that a schema addition (a column appearing everywhere, e.g. `counts_label`) does not
// invalidate every query, and tight enough that two same-view/same-options queries with different
// column sets stay distinct.
//
//   1. structuralKey must match exactly — same view, same options, same filters/groupBy.
//   2. among those candidates, the column sets must be SUBSET-compatible in one direction. A
//      baseline that asked for 10 columns matches a current asking for those 10 plus one new one;
//      it does not match a disjoint column set.
//
// Returns the best candidate, or null. `used` lets the caller consume matches 1:1 so two baseline
// queries cannot both claim the same current query.
export function matchBaselineQuery(baselineEntry, currentEntries, used = new Set()) {
  // Recomputed, never read from the stored baseline: that way changing the key function
  // does not silently compare an old-format key against a new-format one.
  const bKey = structuralKey(baselineEntry.decodedKey);
  const bCols = baselineEntry.columns ?? columnsOf(baselineEntry.decodedKey);
  let best = null, bestScore = -1;
  for (const c of currentEntries) {
    if (used.has(c)) continue;
    const cKey = structuralKey(c.decodedKey);
    if (cKey !== bKey) continue;
    const cCols = c.columns ?? columnsOf(c.decodedKey);
    if (bCols.length === 0 && cCols.length === 0) { if (bestScore < 0) { best = c; bestScore = 0; } continue; }
    const bSet = new Set(bCols), cSet = new Set(cCols);
    const shared = bCols.filter(x => cSet.has(x)).length;
    const subset = shared === bCols.length || shared === cCols.length;
    if (!subset) continue;
    if (shared > bestScore) { best = c; bestScore = shared; }
  }
  return best;
}

// --- self-check -------------------------------------------------------------------------------
// `node scripts/npmrds-reports/probe_corpus_keys.mjs --check` compares every stored baseline
// against the newest matching probe dump: how many baseline queries match by EXACT key vs by the
// structural matcher, and — the check that actually matters — whether the matcher ever merges two
// genuinely distinct queries. Collisions must be zero, or "series count changed" becomes a
// false-positive generator.
if (process.argv[1] && process.argv[1].endsWith('probe_corpus_keys.mjs') && process.argv.includes('--check')) {
  const { readFileSync, existsSync } = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const REPO = path.resolve(HERE, '..', '..');
  const FIX = path.join(HERE, 'report_probe_fixtures');
  const DUMPS = path.join(REPO, 'scratchpad/npmrds-sub/tmp/probe_corpus');
  const isReport = d => d.includes('"uda"') && (d.includes('"options"') || d.includes('"colorDomain"'));
  const manifest = JSON.parse(readFileSync(path.join(FIX, 'golden-corpus.json'), 'utf8'));
  const slugOf = u => {
    const r = u.startsWith('http') ? new URL(u).pathname : u;
    return 'probe_' + r.replace(/\W+/g, '_').replace(/^_+|_+$/g, '') + '.json';
  };
  let tBase = 0, tExact = 0, tStruct = 0, tAmbig = 0, skipped = 0;
  for (const e of manifest.entries) {
    const bp = path.join(FIX, 'baselines', `${e.key}.json`);
    const dp = path.join(DUMPS, slugOf(e.url));
    if (!existsSync(bp) || !existsSync(dp)) { console.log(`${e.key.padEnd(36)} SKIP (no baseline or no dump)`); skipped++; continue; }
    const bk = (JSON.parse(readFileSync(bp, 'utf8')).graphSummary || []).map(x => ({ decodedKey: x.decodedKey }));
    const ckRaw = (JSON.parse(readFileSync(dp, 'utf8')).graphCaptures || []).filter(c => isReport(c.decoded));
    const ck = ckRaw.map(c => ({ decodedKey: c.decoded }));
    const exact = bk.filter(b => ck.some(c => c.decodedKey === b.decodedKey)).length;
    const used = new Set();
    let matched = 0;
    for (const b of bk) { const m = matchBaselineQuery(b, ck, used); if (m) { used.add(m); matched++; } }
    // ambiguity: a current query that more than one baseline query could have claimed
    let ambig = 0;
    for (const c of ck) {
      const claimants = bk.filter(b => matchBaselineQuery(b, [c], new Set()));
      if (claimants.length > 1) ambig++;
    }
    tBase += bk.length; tExact += exact; tStruct += matched; tAmbig += ambig;
    console.log(`${e.key.padEnd(36)} base=${String(bk.length).padStart(3)}  exact=${String(exact).padStart(3)}  structural=${String(matched).padStart(3)}  ambiguous=${ambig}`);
  }
  console.log(`\nbaseline queries: ${tBase}   (${skipped} entr(y/ies) skipped)`);
  console.log(`  matched by EXACT key      ${tExact} -> ${tBase - tExact} Majors`);
  console.log(`  matched by STRUCTURAL key ${tStruct} -> ${tBase - tStruct} Majors`);
  console.log(`  current queries >1 baseline could claim: ${tAmbig}${tAmbig ? '   <-- investigate' : '  (good)'}`);
}
