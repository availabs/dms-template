/**
 * The README that ships inside a pm3 download zip (`data-types/pm3/downloadManifest.js`).
 *
 * What these tests are actually defending is the DERIVATION, not the prose. A manifest is easy to
 * write as one long template string and impossible to keep true that way — `PROVENANCE.md` §6 is
 * the proof: it named the E8 anchor window for a day after `lib/eras.js` moved to E6, and nothing
 * caught it because prose has no tests. So every assertion below either:
 *
 *   · reads its expected value OUT of `lib/eras.js` (the anchor era, its dates, the
 *     self-referential years) so that moving the window moves the test with the manifest, and a
 *     hard-coded paragraph would fail; or
 *   · asserts that two different years produce DIFFERENT text — which is the whole claim. A
 *     manifest that read identically for 2017 and 2025 would be decoration on a file whose
 *     caveats genuinely differ.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  MANIFEST_FILE_NAME,
  MEASURED,
  buildDownloadManifest,
  columnFamilies,
  yearsForExport,
  derivedSelfReferentialYears,
} = require('../downloadManifest.js');
const {
  FREEFLOW_REFERENCE_WINDOW, erasForYear, ALL_VEHICLE_ERAS, TRUCK_ERAS,
} = require('../lib/eras.js');

const BASE = {
  sourceName: 'pm3_v6_e6anchor_2017_2025',
  sourceId: 2135,
  viewId: 3740,
  columns: ['tmc', 'county', 'lottr_amp_lottr'],
  where: null,
  geographyFilter: [],
  fileType: 'CSV',
  generatedAt: '2026-08-24T00:00:00.000Z',
};
const forYear = (year, over = {}) => buildDownloadManifest({
  ...BASE, version: String(year), years: [year], ...over,
});
// The manifest is hard-wrapped to 92 columns for a plain-text README, so any assertion about a
// SENTENCE has to be made against the unwrapped text — otherwise the test is really asserting
// where the line breaks fell, and re-wording one clause breaks an unrelated expectation.
const flat = (text) => String(text).replace(/\s+/g, ' ');
const flatFor = (year, over = {}) => flat(forYear(year, over));

describe('yearsForExport — what year(s) is this export about', () => {
  it('a per-year view says so in its version', () => {
    expect(yearsForExport({ version: '2017' })).toEqual([2017]);
    expect(yearsForExport({ version: 2025 })).toEqual([2025]);
  });

  it('the union view falls back to views.metadata.year', () => {
    // `version` is 'all_years' on view 3741, and `metadata.year` is the list its table holds.
    expect(yearsForExport({ version: 'all_years', viewMetadata: { year: [2024, 2025, 2024] } }))
      .toEqual([2024, 2025]);
  });

  it('an undeterminable year is EMPTY, never guessed', () => {
    // Defaulting to "this year" would put a confident, wrong era label on the file.
    expect(yearsForExport({ version: 'all_years' })).toEqual([]);
    expect(yearsForExport({})).toEqual([]);
    expect(yearsForExport({ version: 'v2', viewMetadata: { year: ['nope'] } })).toEqual([]);
  });
});

describe('columnFamilies — every caveat is gated on what was actually exported', () => {
  it('reads the variant from the MIDDLE of the name, where pm3 puts it', () => {
    // `phed_freeflow_anchored` + bin + unit. A test anchored on the end of the string, or one
    // written as /_freeflow(?!_)/, matches none of the real column names.
    const anchored = columnFamilies(['phed_freeflow_anchored_pmp_all_xdelay_phrs']);
    expect(anchored.delay).toBe(true);
    expect(anchored.delayAnchored).toBe(true);
    expect(anchored.delayOwnYear).toBe(false);

    const ownYear = columnFamilies(['phed_freeflow_pmp_all_xdelay_phrs']);
    expect(ownYear.delayOwnYear).toBe(true);
    expect(ownYear.delayAnchored).toBe(false);

    expect(columnFamilies(['ted_freeflow_relative_all_xdelay_phrs']).delayRelative).toBe(true);
  });

  it('separates the families that carry different caveats', () => {
    const f = columnFamilies([
      'tmc', 'lottr_amp_lottr', 'tttr_ovn_tttr', 'speed_pctl_15',
      'coverage_all_vehicles_amp_pct_bins_reporting', 'era_all_vehicles',
      'phed_freeflow_anchored_anchor_fallback', 'lottr_amp_lottr_precision_band',
    ]);
    expect(f.reliability).toBe(true);
    expect(f.truck).toBe(true);
    expect(f.speedPercentile).toBe(true);
    expect(f.coverage).toBe(true);
    expect(f.eraTag).toBe(true);
    expect(f.precision).toBe(true);
    expect(f.anchorFallback).toEqual(['phed_freeflow_anchored_anchor_fallback']);
  });

  it('a metadata-only export triggers no measure caveats', () => {
    const f = columnFamilies(['tmc', 'county', 'wkb_geometry']);
    expect(f.delay).toBe(false);
    expect(f.reliability).toBe(false);
  });
});

describe('the anchor window is READ from lib/eras.js, not restated', () => {
  it('the manifest names whatever window eras.js currently declares', () => {
    const text = forYear(2025);
    expect(text).toContain(FREEFLOW_REFERENCE_WINDOW.era);
    expect(text).toContain(FREEFLOW_REFERENCE_WINDOW.dates[0]);
    expect(text).toContain(FREEFLOW_REFERENCE_WINDOW.dates[1]);
    expect(flat(text)).toContain(flat(FREEFLOW_REFERENCE_WINDOW.note));
  });

  it('the declared selfReferentialYears agree with the window dates', () => {
    // eras.js: "the disjointness test recomputes this from `dates` and fails if the two disagree".
    // This is that test. If it fails, the manifest will print an INTERNAL INCONSISTENCY block
    // rather than quietly asserting one of the two.
    expect([...FREEFLOW_REFERENCE_WINDOW.selfReferentialYears].sort())
      .toEqual(derivedSelfReferentialYears().sort());
  });

  it('a self-referential year is warned about; a disjoint one is told it is disjoint', () => {
    const selfRef = FREEFLOW_REFERENCE_WINDOW.selfReferentialYears[0];
    expect(forYear(selfRef)).toMatch(/PARTIALLY SELF-REFERENTIAL/);
    expect(forYear(selfRef)).toMatch(/LOWER BOUND/);

    const disjoint = [2017, 2018, 2019, 2020, 2021, 2022, 2025]
      .find((y) => !FREEFLOW_REFERENCE_WINDOW.selfReferentialYears.includes(y));
    expect(forYear(disjoint)).not.toMatch(/PARTIALLY SELF-REFERENTIAL/);
    expect(forYear(disjoint)).toMatch(/disjoint from/);
  });

  it('flags a window/declaration mismatch instead of picking a side', () => {
    // Simulated by asking for a year the DECLARED list calls self-referential while the dates do
    // not span it — i.e. exactly the state a careless edit to eras.js would leave behind.
    expect(derivedSelfReferentialYears({ dates: ['2021-01-01', '2021-12-31'], selfReferentialYears: [2023] }))
      .toEqual([2021]);
  });
});

describe('the era section is computed per year, and the years really differ', () => {
  it('names the era erasForYear returns, with its measured coverage', () => {
    for (const year of [2017, 2021, 2025]) {
      const text = forYear(year);
      const { label, eras } = erasForYear(year, 'all_vehicles');
      expect(text).toContain(`all-vehicle era ${label}`);
      for (const e of ALL_VEHICLE_ERAS.filter((x) => eras.includes(x.era))) {
        expect(text).toContain(e.note);
      }
      const truck = erasForYear(year, 'truck');
      expect(text).toContain(`truck era ${truck.label}`);
      expect(text).toContain(TRUCK_ERAS.find((x) => x.era === truck.eras[0]).note);
    }
  });

  it('the four era-crossing years are warned about and the other five are not', () => {
    // 2018 · 2020 · 2023 · 2024 blend all-vehicle eras — a fact of the era table, so it is read
    // out of erasForYear rather than listed here.
    for (const year of [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]) {
      const crosses = erasForYear(year, 'all_vehicles').crossesBoundary
        || erasForYear(year, 'truck').crossesBoundary;
      const text = forYear(year);
      expect(/CROSSES A BOUNDARY/.test(text)).toBe(crosses);
      expect(/blends \d+ coverage regimes/.test(flat(text))).toBe(crosses);
    }
  });

  it('2024 is called out as the three-era year', () => {
    expect(flatFor(2024)).toMatch(/blends 3 coverage regimes/);
  });

  it('2023 crosses a TRUCK boundary — the streams are not on the same calendar', () => {
    expect(erasForYear(2023, 'truck').crossesBoundary).toBe(true);
    expect(forYear(2023)).toMatch(/truck era T2\|T3\s+\*\* CROSSES A BOUNDARY \*\*/);
  });

  it('a 2017 manifest and a 2025 manifest are not the same document', () => {
    // The point of the whole exercise. Same source, same view, same columns, same format.
    const a = forYear(2017);
    const b = forYear(2025);
    expect(a).not.toBe(b);
    // …and they differ on the specific facts, not just on the year printed at the top.
    expect(a).toContain('E1');
    expect(b).toContain('E8');
    expect(a).toMatch(/ELEVATED fallback rate/);
    expect(b).not.toMatch(/ELEVATED fallback rate/);
    expect(a).toMatch(/tmc_meta_geometry/);
    expect(b).not.toMatch(/tmc_meta_geometry/);
  });
});

describe('anchor_fallback — the flag that decides whether a trend is legal', () => {
  it('is always explained, and always as "exclude"', () => {
    expect(flatFor(2025)).toMatch(/anchor_fallback = 1/);
    expect(flatFor(2025)).toMatch(/EXCLUDE THEM FROM ANY TREND/);
  });

  it('names the elevated years with their measured share', () => {
    for (const year of MEASURED.anchorFallback.elevatedYears) {
      const text = forYear(year);
      expect(text).toContain(MEASURED.anchorFallback.elevatedShare);
      expect(text).toMatch(/ELEVATED fallback rate/);
    }
    expect(forYear(2022)).toContain(MEASURED.anchorFallback.typicalShare);
  });

  it('qualifies the measured share if the anchor window ever moves off E6', () => {
    // The 4.6% was measured against E6. If the window moves, the figure is no longer about this
    // export's anchor — so the manifest says so rather than quietly repurposing it.
    const stillE6 = FREEFLOW_REFERENCE_WINDOW.era === MEASURED.anchorFallback.measuredAgainstEra;
    expect(/measured against the E6 window/.test(flatFor(2017))).toBe(!stillE6);
  });

  it('warns when anchored delay is exported WITHOUT the flag that qualifies it', () => {
    const withFlag = forYear(2025, {
      columns: ['tmc', 'phed_freeflow_anchored_pmp_all_xdelay_phrs',
        'phed_freeflow_anchored_anchor_fallback'],
    });
    const without = forYear(2025, {
      columns: ['tmc', 'phed_freeflow_anchored_pmp_all_xdelay_phrs'],
    });
    expect(flat(without)).toMatch(/NO `\*_anchor_fallback` column/);
    expect(flat(withFlag)).not.toMatch(/NO `\*_anchor_fallback` column/);
  });
});

describe('the caveats follow the columns', () => {
  it('delay guidance appears only when a delay column was exported', () => {
    expect(forYear(2025, { columns: ['tmc', 'lottr_amp_lottr'] }))
      .not.toMatch(/THE 20 MPH FLOOR/);
    expect(forYear(2025, { columns: ['tmc', 'phed_freeflow_anchored_pmp_all_xdelay_phrs'] }))
      .toMatch(/THE 20 MPH FLOOR/);
  });

  it('reliability guidance appears only when a reliability column was exported', () => {
    expect(forYear(2025, { columns: ['tmc', 'phed_pmp_all_xdelay_phrs'] }))
      .not.toMatch(/RELIABILITY COLUMNS/);
    expect(forYear(2025, { columns: ['tmc', 'tttr_ovn_tttr'] }))
      .toMatch(/RELIABILITY COLUMNS/);
  });

  it('an own-year delay column is flagged as deprecated in the file that carries it', () => {
    expect(flatFor(2025, { columns: ['phed_freeflow_pmp_all_xdelay_phrs'] }))
      .toMatch(/Do not start new analysis on it/);
    expect(flatFor(2025, { columns: ['phed_freeflow_anchored_pmp_all_xdelay_phrs'] }))
      .not.toMatch(/Do not start new analysis on it/);
  });

  it('says when the era tag is not in the file', () => {
    expect(flatFor(2025, { columns: ['tmc'] })).toMatch(/no `era_\*` column was selected/);
    expect(flatFor(2025, { columns: ['tmc', 'era_all_vehicles'] }))
      .not.toMatch(/no `era_\*` column was selected/);
  });

  it('the AADT revision boundary is named for the years that sit on it', () => {
    // Delay is linear in AADT and the AADT vintage swings -14.9% between 2021 and 2022, so those
    // two years get the warning and 2019 does not.
    expect(flatFor(2022, { columns: ['phed_pmp_all_xdelay_phrs'] }))
      .toMatch(/-14\.9% AADT revision boundary/);
    expect(flatFor(2021, { columns: ['phed_pmp_all_xdelay_phrs'] }))
      .toMatch(/-14\.9% AADT revision boundary/);
    expect(flatFor(2017, { columns: ['phed_pmp_all_xdelay_phrs'] }))
      .not.toMatch(/AADT revision boundary/);
  });
});

describe('the export itself is described, so the file can be identified later', () => {
  it('carries the source, view, year, format, scope and the exact column list', () => {
    const text = forYear(2025, {
      columns: ['tmc', 'county', 'lottr_amp_lottr'],
      where: `"region_code" IN ('8')`,
      geographyFilter: [{ name: 'Region 8', type: 'region_code', value: '8' }],
      fileType: 'GPKG',
    });
    expect(text).toContain('source_id 2135');
    expect(text).toContain('view_id 3740');
    expect(text).toContain('version 2025');
    expect(text).toContain('GPKG');
    expect(text).toContain('Region 8');
    expect(text).toContain(`"region_code" IN ('8')`);
    expect(text).toContain('lottr_amp_lottr');
  });

  it('statewide says statewide rather than leaving the scope blank', () => {
    expect(flatFor(2025)).toMatch(/statewide \(no geography filter\)/);
    expect(flatFor(2025)).toMatch(/none — every row of the view/);
  });

  it('an unknown year says so instead of naming an era it cannot know', () => {
    const text = buildDownloadManifest({ ...BASE, version: 'all_years', years: [] });
    expect(text).toMatch(/NOT DETERMINABLE/);
    expect(text).not.toMatch(/all-vehicle era E/);
    // …and prints the whole era table so the reader can join by the file's own `year` column.
    for (const e of ALL_VEHICLE_ERAS) expect(text).toContain(e.era);
  });

  it('never leaves a federal reader thinking this is the compliant number', () => {
    expect(flatFor(2025)).toMatch(/NOT FOR FEDERAL SUBMITTAL/);
    expect(flatFor(2025)).toMatch(/map21/);
  });

  it('is plain text, non-empty, and named for the zip it lands in', () => {
    expect(MANIFEST_FILE_NAME).toBe('PM3_README.txt');
    const text = forYear(2025);
    expect(text.length).toBeGreaterThan(2000);
    expect(text.endsWith('\n')).toBe(true);
  });
});
