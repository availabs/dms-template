/**
 * The README that travels INSIDE a pm3 download zip.
 *
 * A pm3 CSV is 330 columns of ratios and person-hours with no way to say that 2024 blends three
 * coverage regimes, that two of the nine years measure themselves, or that 62.7% of the delay in
 * the file is computed against a floor rather than against traffic. The dataset knows all of it —
 * `lib/eras.js` carries the era tables and the anchor window, `PROVENANCE.md` carries the measured
 * consequences — and a download is exactly the moment that knowledge gets detached from the data.
 *
 * TWO RULES THIS FILE FOLLOWS.
 *
 *   1. **Anything the code knows is COMPUTED, never restated.** The anchor window, its dates, which
 *      years are self-referential, which eras a year touches and whether it crosses a boundary all
 *      come out of `lib/eras.js` at build time. Move the window in `eras.js` and every manifest
 *      moves with it. A paragraph that said "E6, 2023-06 → 2024-07" in a string literal would go
 *      stale the same way `PROVENANCE.md` §6 did — it named the E8 window for a full day after
 *      `eras.js` abandoned it, and was only found (and fixed) while writing this file.
 *
 *   2. **The measured numbers are declared ONCE, in `MEASURED` below, each carrying its source and
 *      the conditions it was measured under.** They cannot be derived — they came from runs over
 *      1.7 billion rows — but they can at least be auditable, keyed to the years they apply to, and
 *      guarded: a figure measured against the E6 anchor is qualified automatically if the anchor
 *      ever moves, rather than silently becoming a lie about a different window.
 *
 * The result is that a 2017 manifest and a 2025 manifest say different things, because 2017 and
 * 2025 ARE different: different era, different meta family, a 15x difference in how many segments
 * fell back to their own year for a reference. A manifest that read identically for both would be
 * decoration.
 */

const {
  ALL_VEHICLE_ERAS,
  TRUCK_ERAS,
  erasForYear,
  FREEFLOW_REFERENCE_WINDOW,
} = require('./lib/eras.js');

/** The name the manifest lands under at the root of the zip. */
const MANIFEST_FILE_NAME = 'PM3_README.txt';

/**
 * Measured figures. Not derivable — each is the output of an analysis run — so each is declared
 * with the report it came from and, where it matters, the years or the anchor window it was
 * measured against. Nothing below this object restates a number.
 */
const MEASURED = {
  // lib/calcPhed.js: "against E6 that is 4.6% of the 2017 and 2018 networks (TMCs gone before
  // mid-2023) and under 0.3% of every other year".
  anchorFallback: {
    measuredAgainstEra: 'E6',
    elevatedYears: [2017, 2018],
    elevatedShare: '4.6%',
    typicalShare: 'under 0.3%',
    reason: 'segments retired before the reference window opened have no anchored percentile',
  },
  // macroview-pm3-v6-rebind.md, nine-year fixed-panel check: the threshold is stable to three
  // decimals across all nine years while the AADT it multiplies is not.
  aadtVintage: {
    thresholdStability: '27.759 mph in every one of the nine years',
    swings: [
      { from: 2021, to: 2022, change: '-14.9%' },
      { from: 2019, to: 2020, change: '+2.3%' },
    ],
    note: 'delay is LINEAR in directional AADT, so a raw multi-year delay chart partly plots the '
      + "AADT dataset's revision history rather than traffic",
  },
  // PROVENANCE.md §10, measured on CY2025.
  floor: {
    formula: 'max(0.6 x base free-flow, 20 mph)',
    shareOfDelayFloored: '62.7% of all measured delay (37.4% of segments)',
    principalArterials: '89.7%',
    removingIt: 'network delay -41.4%, principal arterials -59.9%, Interstates only -1.3%',
  },
  // PROVENANCE.md §5 / §7, H1/H14/H1b.
  coverage: {
    lottrSensitivity: 'a coverage change of the size actually observed moves LOTTR ~3% and the '
      + 'flagged population ~23% relative',
    oppositeDirections: 'thin data INFLATES reliability ratios and DEFLATES delay, so the two '
      + 'measure families disagree under a coverage change rather than both drifting one way',
    tttrBar: 'TTTR needs 57,832 overnight bins for +/-0.05 precision and a year contains 14,600, '
      + 'so it cannot meet the absolute bar on any segment, ever; tttr_p80 reaches the same bar '
      + 'at 195 bins',
  },
  // macroview-pm3-v6-rebind.md caveat 6.
  meta2017: {
    years: [2017],
    family: 'tmc_meta_geometry',
    otherYearsFamily: 'shapefile_enhanced',
    disagreement: 'The two families disagree materially on f_system, so per-functional-class 2017 '
      + 'figures are not strictly comparable to 2018-2025',
    coverage: '2017 publishes 32,915 of 36,166 feed TMCs (3,251 skipped for "no meta row") — the '
      + 'only year that loses any',
  },
};

const WIDTH = 92;

/**
 * Which measure families does this column set actually contain? Every caveat below is gated on it.
 *
 * The variant lives in the MIDDLE of a pm3 column name, not at the end — `phed_freeflow_anchored`
 * plus a bin plus a unit gives `phed_freeflow_anchored_pmp_all_xdelay_phrs` — so each test anchors
 * on `(_|$)` rather than on the end of the string. A "own-year" test written as `_freeflow(?!_)`
 * matches nothing at all, since every real own-year column has a bin after the variant.
 */
function columnFamilies(columns) {
  const cols = Array.isArray(columns) ? columns : [];
  const has = (pred) => cols.some(pred);
  const isDelay = (c) => /^(phed|ted)(_|$)/.test(c);
  return {
    delay: has(isDelay),
    delayAnchored: has((c) => isDelay(c) && /_freeflow_anchored(_|$)/.test(c)),
    delayOwnYear: has((c) => isDelay(c) && /_freeflow(_|$)/.test(c)
      && !/_freeflow_(anchored|relative)(_|$)/.test(c)),
    delayRelative: has((c) => isDelay(c) && /_freeflow_relative(_|$)/.test(c)),
    truck: has((c) => /(^tttr|_truck)/.test(c)),
    reliability: has((c) => /^(lottr|tttr)/.test(c)),
    speedPercentile: has((c) => /^speed_pctl/.test(c)),
    coverage: has((c) => /^coverage_/.test(c)),
    eraTag: has((c) => /^era_/.test(c)),
    anchorFallback: cols.filter((c) => /_anchor_fallback$/.test(c)),
    precision: has((c) => /(_precision_band|_min_n_bar|_n_bins)$/.test(c)),
  };
}

/**
 * The calendar years this export covers.
 *
 * A pm3 view's `version` IS the 4-digit year (one view per year, worker.js § 2). The union view
 * publishes `all_years` instead, and `views.metadata.year` is the list its table actually holds —
 * so read the version first and fall back to the metadata rather than guessing. An empty result is
 * reported as unknown in the manifest, never silently treated as "the current year".
 */
function yearsForExport({ version, viewMetadata } = {}) {
  if (/^\d{4}$/.test(String(version))) return [Number(version)];
  const declared = viewMetadata && viewMetadata.year;
  if (Array.isArray(declared)) {
    const years = declared
      .map((y) => Number(y))
      .filter((y) => Number.isInteger(y) && y >= 1900 && y <= 2999);
    if (years.length) return [...new Set(years)].sort((a, b) => a - b);
  }
  return [];
}

/**
 * Is `year` inside the anchor window, i.e. is its reference computed partly from its own traffic?
 *
 * Derived from `FREEFLOW_REFERENCE_WINDOW.dates` rather than read off `selfReferentialYears`, so
 * the two can be compared. eras.js declares the list deliberately ("moving the window is a
 * deliberate act") and the derivation is the check on it; when they disagree the manifest says so
 * instead of picking one, because either could be the stale half.
 */
function derivedSelfReferentialYears(window = FREEFLOW_REFERENCE_WINDOW) {
  const [start, end] = window.dates;
  const first = Number(String(start).slice(0, 4));
  const last = Number(String(end).slice(0, 4));
  const out = [];
  for (let y = first; y <= last; y += 1) out.push(y);
  return out;
}

function eraRows(table, labels) {
  return table.filter((e) => labels.includes(e.era));
}

const rule = (ch = '-') => ch.repeat(WIDTH);

/** Wrap prose to WIDTH, honouring an indent. */
function wrap(text, indent = '') {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = indent;
  for (const w of words) {
    if (line.length > indent.length && line.length + 1 + w.length > WIDTH) {
      lines.push(line);
      line = indent + w;
    } else {
      line = line.length > indent.length ? `${line} ${w}` : indent + w;
    }
  }
  if (line.trim()) lines.push(line);
  return lines;
}

const bullet = (text) => wrap(text, '    ').map((l, i) => (i === 0 ? `  - ${l.slice(4)}` : l));

function heading(n, title) {
  return ['', `${n}. ${title.toUpperCase()}`, rule()];
}

/**
 * The manifest.
 *
 * @param {object} p
 * @param {string} p.sourceName
 * @param {number} p.sourceId
 * @param {number} p.viewId
 * @param {string} p.version           the view's version — the 4-digit year for a per-year view
 * @param {number[]} p.years           from `yearsForExport`
 * @param {string[]} p.columns         exactly what was exported
 * @param {string|null} p.where        the SQL subset, or null for statewide
 * @param {Array} p.geographyFilter    the macroview's chips, for a readable scope line
 * @param {string} p.fileType
 * @param {string} [p.generatedAt]     ISO timestamp; injectable so the output is testable
 * @returns {string}
 */
function buildDownloadManifest({
  sourceName, sourceId, viewId, version, years = [], columns = [],
  where = null, geographyFilter = [], fileType, generatedAt,
} = {}) {
  const fam = columnFamilies(columns);
  const win = FREEFLOW_REFERENCE_WINDOW;
  const derivedSelfRef = derivedSelfReferentialYears(win);
  const declaredSelfRef = Array.isArray(win.selfReferentialYears) ? win.selfReferentialYears : [];
  const selfRefDisagree =
    JSON.stringify([...derivedSelfRef].sort()) !== JSON.stringify([...declaredSelfRef].sort());
  const selfRefYears = declaredSelfRef;

  const out = [];
  const push = (...xs) => { for (const x of xs) out.push(...(Array.isArray(x) ? x : [x])); };

  // ── header ───────────────────────────────────────────────────────────────────────────────
  push(
    rule('='),
    'PM3 PERFORMANCE MEASURES — WHAT IS IN THIS DOWNLOAD, AND WHAT IT CANNOT BE USED FOR',
    rule('='),
    '',
  );
  push(wrap(
    'Generated ' + (generatedAt || new Date().toISOString()) + ' by the NPMRDS macroview download '
    + 'builder. Every caveat below is specific to the year(s) in this file — a different year '
    + 'exports a different README. The fuller documentation, with the analysis each figure came '
    + 'from, is data-types/pm3/PROVENANCE.md.'
  ));

  // ── 1. the export ────────────────────────────────────────────────────────────────────────
  push(heading(1, 'This export'));
  const geoLabel = Array.isArray(geographyFilter) && geographyFilter.length
    ? geographyFilter.map((g) => g && (g.name || `${g.type}=${g.value}`)).filter(Boolean).join(', ')
    : 'statewide (no geography filter)';
  push(
    `  source      ${sourceName || '(unnamed)'}  ·  source_id ${sourceId}`,
    `  view        view_id ${viewId}  ·  version ${version == null ? '(none)' : version}`,
    `  year(s)     ${years.length ? years.join(', ') : 'NOT DETERMINABLE from this view — see §2'}`,
    `  format      ${fileType || '(unspecified)'}`,
    `  scope       ${geoLabel}`,
    `  row filter  ${where || 'none — every row of the view'}`,
    `  columns     ${columns.length}`,
  );
  push(wrap(columns.join(', '), '              '));

  // ── 2. coverage eras ─────────────────────────────────────────────────────────────────────
  push(heading(2, 'Coverage era — read this before comparing to any other year'));
  push(wrap(
    'The NPMRDS feed is not one dataset. Daytime epoch coverage moves in abrupt, month-aligned '
    + 'steps rather than on a trend, and steps DOWN as often as up. Quantified: '
    + MEASURED.coverage.lottrSensitivity
    + ', so an un-annotated multi-year trend is partly feed history rather than traffic.'
  ));
  push('');

  if (!years.length) {
    push(wrap(
      'This export\'s year could not be determined from the view, so no era can be named for it. '
      + 'If the file carries a `year` column, join each row to the era table below by its own year '
      + 'before differencing anything.'
    ));
    push('', '  all-vehicle eras:');
    for (const e of ALL_VEHICLE_ERAS) {
      push(`    ${e.era}  ${e.start} .. ${e.end || 'current'}  ${Number(e.daytimeCoverage).toFixed(1).padStart(5)}% daytime  ${e.note}`);
    }
    push('', '  truck eras (DIFFERENT dates — the two streams are not on the same calendar):');
    for (const e of TRUCK_ERAS) {
      push(`    ${e.era}  ${e.start} .. ${e.end || 'current'}  ${Number(e.daytimeCoverage).toFixed(1).padStart(5)}% daytime  ${e.note}`);
    }
  } else {
    for (const year of years) {
      const all = erasForYear(year, 'all_vehicles');
      const truck = erasForYear(year, 'truck');
      push(`  ${year} — all-vehicle era ${all.label || '(none)'}${all.crossesBoundary ? '  ** CROSSES A BOUNDARY **' : ''}`);
      for (const e of eraRows(ALL_VEHICLE_ERAS, all.eras)) {
        push(`      ${e.era}  ${e.start} .. ${e.end || 'current'}  ${Number(e.daytimeCoverage).toFixed(1).padStart(5)}% daytime  ${e.note}`);
      }
      push(`  ${year} — truck era ${truck.label || '(none)'}${truck.crossesBoundary ? '  ** CROSSES A BOUNDARY **' : ''}`);
      for (const e of eraRows(TRUCK_ERAS, truck.eras)) {
        push(`      ${e.era}  ${e.start} .. ${e.end || 'current'}  ${Number(e.daytimeCoverage).toFixed(1).padStart(5)}% daytime  ${e.note}`);
      }

      if (all.crossesBoundary || truck.crossesBoundary) {
        push('');
        push(wrap(
          `WARNING: ${year} blends ${Math.max(all.eras.length, truck.eras.length)} coverage regimes. `
          + 'An annual figure for it is a mixture, not a measurement of one feed state. Do not '
          + 'difference it against another year without a coverage control.'
        , '    '));
      }
      push('');
    }
    push(wrap(
      'Which stream\'s tag applies depends on the measure, not on the row: all-vehicle for LOTTR, '
      + 'PHED and TED; truck for TTTR and the *_truck delay variants. At the 2023-06 boundary the '
      + 'two moved in OPPOSITE directions, so one tag cannot describe both.'
    ));
    if (!fam.eraTag) {
      push('');
      push(wrap(
        'NOTE: no `era_*` column was selected, so the era tag and its `_crosses_boundary` flag are '
        + 'NOT in this file. Add era_all_vehicles / era_all_vehicles_crosses_boundary (or the '
        + '_truck pair) to a future export if you need them per row.'
      ));
    }
  }

  // ── 3. the anchored free-flow reference ──────────────────────────────────────────────────
  push(heading(3, 'The free-flow reference window'));
  push(
    `  anchor era   ${win.era}`,
    `  window       ${win.dates[0]} .. ${win.dates[1]} (inclusive)`,
  );
  // wrap() repeats its indent on every line, so the label goes on the first line only.
  const noteLines = wrap(win.note, '               ');
  push(`  note${noteLines[0].slice(6)}`, ...noteLines.slice(1));
  push('');
  push(wrap(
    'PHED/TED\'s free-flow threshold is the 15th percentile of travel time. Taken over the publish '
    + 'year it tracks the median at r = +0.998 — it is a lagged measurement of prevailing traffic, '
    + 'so the yardstick slows down as the network does and the measure structurally cannot see '
    + 'multi-year deterioration. The `*_freeflow_anchored` columns take it from the fixed window '
    + 'above instead.'
  ));

  const selfRef = years.filter((y) => selfRefYears.includes(y));
  if (selfRef.length) {
    push('');
    push(wrap(
      `** ${selfRef.join(' and ')} ${selfRef.length > 1 ? 'ARE' : 'IS'} PARTIALLY SELF-REFERENTIAL. ** `
      + `The window overlaps ${selfRef.length > 1 ? 'these years' : 'this year'}, so its threshold is `
      + 'computed partly from its own traffic and its anchored delay growth is DAMPED relative to '
      + 'neighbouring years. Read the anchored delta for it as a LOWER BOUND, and expect a trend '
      + 'through it to read as "growth paused then resumed" when the cause is the ruler, not the road.'
    ));
  } else if (years.length) {
    push('');
    push(wrap(
      `The window is disjoint from ${years.join(', ')}, so the anchored figures here are measured `
      + 'against a reference computed entirely from other years — which is the point of anchoring. '
      + `(${selfRefYears.join(' and ')} are the exception in this archive; they overlap the window.)`
    ));
  }

  if (selfRefDisagree) {
    push('');
    push(wrap(
      `** INTERNAL INCONSISTENCY: lib/eras.js declares selfReferentialYears [${declaredSelfRef.join(', ')}] `
      + `while its own window dates (${win.dates.join(' .. ')}) span [${derivedSelfRef.join(', ')}]. `
      + 'One of the two is stale. Treat the self-referential warning above as unreliable until it '
      + 'is reconciled. **'
    ));
  }

  // anchor_fallback — year-specific, and gated on whether the flag is even in the file
  const fb = MEASURED.anchorFallback;
  const elevated = years.filter((y) => fb.elevatedYears.includes(y));
  const qualified = win.era !== fb.measuredAgainstEra;
  push('');
  push(wrap(
    'A segment with no data inside the window has no anchored percentile and falls back to its own '
    + 'year, flagged as `anchor_fallback = 1`. Those rows are exactly the ones whose yardstick '
    + 'moves with their traffic: EXCLUDE THEM FROM ANY TREND. They are flagged rather than '
    + 'suppressed, per PROVENANCE §7.'
  ));
  if (elevated.length) {
    push('');
    push(wrap(
      `** ${elevated.join(' and ')} carr${elevated.length > 1 ? 'y' : 'ies'} an ELEVATED fallback rate: `
      + `${fb.elevatedShare} of the network, against ${fb.typicalShare} for every other year `
      + `(${fb.reason}). **`
      + (qualified
        ? ` That share was measured against the ${fb.measuredAgainstEra} window and this export's `
          + `anchor is ${win.era}, so treat the figure as indicative rather than current.`
        : '')
    ));
  } else if (years.length) {
    push('');
    push(wrap(
      `Fallback is ${fb.typicalShare} of the network for ${years.join(', ')}; it reaches `
      + `${fb.elevatedShare} only in ${fb.elevatedYears.join(' and ')}`
      + (qualified
        ? `, as measured against the ${fb.measuredAgainstEra} window (this export anchors on ${win.era}).`
        : '.')
    ));
  }
  if (fam.delayAnchored && !fam.anchorFallback.length) {
    push('');
    push(wrap(
      'NOTE: this export contains anchored delay columns but NO `*_anchor_fallback` column, so the '
      + 'rows that need excluding cannot be identified from this file. Add the matching '
      + '`<measure>_anchor_fallback` column before using these values in a trend.'
    ));
  }

  // ── 4. delay ─────────────────────────────────────────────────────────────────────────────
  if (fam.delay) {
    push(heading(4, 'Delay columns in this export'));
    push('  which variant answers which question:');
    push(
      '    phed_freeflow_anchored / ted_freeflow_anchored   default; fixed reference, floor kept',
      '    *_freeflow_relative                             REQUIRED for cross-functional-class',
      '    phed / ted                                      federal formula, vs the POSTED limit',
      '    phed_freeflow / ted_freeflow                    own-year reference — DEPRECATED',
    );
    push('');
    push(wrap(
      'The two axes are independent: which reference governs whether change over time is '
      + 'measurable, and whether the 20 mph floor applies governs whether functional classes are '
      + 'comparable to each other. There is no single variant that is right for everything.'
    ));
    if (fam.delayOwnYear) {
      push('');
      push(wrap(
        '** This export contains own-year `*_freeflow` delay. It is retained only to bridge to '
        + 'previously published figures and cannot measure multi-year deterioration. Do not start '
        + 'new analysis on it. **'
      ));
    }
    push('');
    push(`  THE 20 MPH FLOOR — threshold is ${MEASURED.floor.formula}`);
    push(bullet(`${MEASURED.floor.shareOfDelayFloored} is computed against the floor, not against traffic.`));
    push(bullet(`On principal arterials — two thirds of the state's person-hours — it is ${MEASURED.floor.principalArterials}.`));
    push(bullet(`Removing it moves ${MEASURED.floor.removingIt}.`));
    push(bullet('So NEVER compare delay across functional classes in a floored variant; use '
      + '*_freeflow_relative for that.'));
    if (!fam.delayRelative) {
      push(bullet('No *_freeflow_relative column is in this export, so a cross-class comparison is '
        + 'not possible from this file.'));
    }
    push('');
    push('  AADT');
    push(bullet(MEASURED.aadtVintage.note + '.'));
    push(bullet(`On a nine-year fixed panel the threshold is stable (${MEASURED.aadtVintage.thresholdStability}) `
      + 'while total directional AADT is not: '
      + MEASURED.aadtVintage.swings.map((s) => `${s.change} ${s.from}->${s.to}`).join(', ') + '.'));
    push(bullet('Normalise by AADT, or pin one vintage, before plotting delay over time.'));
    const aadtYear = MEASURED.aadtVintage.swings.find((s) => years.includes(s.from) || years.includes(s.to));
    if (aadtYear) {
      push('');
      push(wrap(
        `** ${years.filter((y) => y === aadtYear.from || y === aadtYear.to).join(', ')} sits on a `
        + `${aadtYear.change} AADT revision boundary (${aadtYear.from} -> ${aadtYear.to}). Delay in `
        + 'this file is linear in that AADT, so differencing across that boundary measures the AADT '
        + 'dataset as much as the traffic. **'
      ));
    }
  }

  // ── 5. reliability ───────────────────────────────────────────────────────────────────────
  if (fam.reliability) {
    const n = fam.delay ? 5 : 4;
    push(heading(n, 'Reliability columns in this export'));
    push(bullet(MEASURED.coverage.tttrBar + '.'));
    push(bullet('Nothing is suppressed for being imprecise. `*_precision_band` is the expected '
      + 'standard deviation at that row\'s sample size and `*_min_n_bar` the sample needed for '
      + '+/-0.05; compare `n_bins` to `min_n_bar` yourself.'));
    if (!fam.precision) {
      push(bullet('None of the precision columns (_precision_band / _min_n_bar / _n_bins) are in '
        + 'this export, so a reader of this file cannot tell a well-sampled ratio from a thin one.'));
    }
    push(bullet('WATCH THE BIN LABELS: `pmp` means 16:00-19:59 for LOTTR/TTTR and 15:00-18:59 for '
      + 'PHED (published as `pmp` anyway). Do not join lottr_pmp_* to phed_pmp_* and assume the '
      + 'same window.'));
  }

  // ── 6. year-specific structural notes ────────────────────────────────────────────────────
  const meta2017 = years.filter((y) => MEASURED.meta2017.years.includes(y));
  if (meta2017.length) {
    const n = 4 + (fam.delay ? 1 : 0) + (fam.reliability ? 1 : 0);
    push(heading(n, `${meta2017.join(', ')} — a different TMC metadata family`));
    push(wrap(
      `${meta2017.join(', ')} is the only year whose meta layer is the `
      + `\`${MEASURED.meta2017.family}\` family rather than \`${MEASURED.meta2017.otherYearsFamily}\`. `
      + MEASURED.meta2017.disagreement + '.'
    ));
    push('');
    push(bullet(MEASURED.meta2017.coverage + '.'));
    push(bullet('The TMC attributes in this file (county, region_code, mpo_name, urban_code, '
      + 'f_system, miles, directionalaadt) come from that layer, so they are the part that differs '
      + '— the measures themselves are computed the same way as every other year.'));
  }

  // ── comparing years, and what this file is not for ───────────────────────────────────────
  push(heading(meta2017.length ? 7 : 6, 'If you are going to compare years'));
  push(bullet('Check the era tag on BOTH years and the stream that matches your measure. Four of '
    + 'the nine published years blend all-vehicle eras.'));
  push(bullet('Exclude `anchor_fallback = 1` rows.'));
  push(bullet(`Treat ${selfRefYears.join(' and ')} as lower bounds — the anchor window overlaps them.`));
  push(bullet('Normalise delay by AADT or pin one AADT vintage.'));
  push(bullet('Coverage biases the two measure families in OPPOSITE directions — '
    + MEASURED.coverage.oppositeDirections + '. So agreement between a reliability result and a '
    + 'delay result does NOT corroborate a multi-year trend the way it does within one year.'));
  push('');
  push(wrap(
    'NOT FOR FEDERAL SUBMITTAL. pm3 is a fork and deliberately differs from the compliant '
    + 'calculation; the `map21` data-type is the HPMS path.'
  ));
  push('');
  push(rule('='));

  return out.join('\n') + '\n';
}

module.exports = {
  MANIFEST_FILE_NAME,
  MEASURED,
  buildDownloadManifest,
  columnFamilies,
  yearsForExport,
  derivedSelfReferentialYears,
};
