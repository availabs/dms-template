/**
 * The fork guard.
 *
 * pm3 was forked from map21 on 2026-08-14 so the two can diverge: map21 is frozen for
 * calculation (federal submittal, backward compatibility), pm3 is not. That separation is
 * only real if pm3 never reaches back into map21 — a single `require('../map21/…')` would
 * silently re-couple them and a later map21 change would start constraining pm3 again.
 *
 * This test walks every JS file under pm3/ and asserts no shipping file imports from map21.
 * See planning/transportny/tasks/current/pm3-fork-and-measure-implementation.md (Phase 0).
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const PM3_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

function jsFilesUnder(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...jsFilesUnder(full));
    else if (/\.(js|mjs|cjs)$/.test(entry)) out.push(full);
  }
  return out;
}

// Matches any QUOTED module specifier resolving into map21 — '../map21/x', '../../map21/x'.
// Anchored on the string literal rather than the call shape on purpose: the first version of
// this guard keyed on `require(` and missed `const req = createRequire(...); req('../../map21/x')`
// in metrics.unit.test.mjs.
//
// The character class excludes newlines deliberately. `[^'"]` matches newlines, so without the
// \n the pattern bridges an unrelated quote pair on one line to a quote several lines later and
// false-positives on every fork banner in pm3/lib/ (each names its map21 origin in prose, and
// the banners contain quoted words). A module specifier is always on one line.
const MAP21_IMPORT = /['"][^'"\n]*\.\.\/map21\/[^'"\n]*['"]/;

/**
 * Test files may reference map21 deliberately, for *differential* assertions that pin a
 * documented pm3-vs-map21 behavioural difference. Those cannot re-couple the runtime, which
 * is what this guard protects. The allowlist is explicit so a NEW test coupling still fails
 * here and has to be justified.
 */
const TEST_ALLOWLIST = new Set([
  // Pins "map21 renames to FHWA headers, pm3 prefixes with the metric name".
  'tests/column-mapping.unit.test.mjs',
  // This file — its negative-control samples contain literal map21 import strings.
  'tests/no-map21-import.unit.test.mjs',
]);

describe('pm3 is forked from map21 and must stay forked', () => {
  it('no shipping file under pm3/ imports from map21', () => {
    const files = jsFilesUnder(PM3_DIR).filter((f) => !relative(PM3_DIR, f).startsWith('tests/'));
    expect(files.length).toBeGreaterThan(5);

    const offenders = files
      .filter((f) => MAP21_IMPORT.test(readFileSync(f, 'utf8')))
      .map((f) => relative(PM3_DIR, f));

    // If this fails: copy what you need into pm3/lib/ instead of importing map21.
    expect(offenders).toEqual([]);
  });

  it('only allowlisted pm3 tests reference map21', () => {
    const testFiles = jsFilesUnder(join(PM3_DIR, 'tests')).map((f) => relative(PM3_DIR, f));
    const unexpected = testFiles
      .filter((rel) => MAP21_IMPORT.test(readFileSync(join(PM3_DIR, rel), 'utf8')))
      .filter((rel) => !TEST_ALLOWLIST.has(rel));

    // If this fails: either add the file to TEST_ALLOWLIST with a one-line reason (it is a
    // deliberate differential test), or import the helper from pm3/lib/ instead.
    expect(unexpected).toEqual([]);
  });

  it('detects a map21 import in every call shape (negative control)', () => {
    // A guard that silently stops matching is worse than no guard, so prove the regex fires.
    const shouldMatch = [
      "const { x } = require('../map21/constants.js');",
      'const y = require("../../map21/helpers.js");',
      "import { z } from '../map21/calcPhed.js';",
      "await import('../map21/calcTtrMeasure.js');",
      "const req = createRequire(import.meta.url); req('../../map21/calcPhed.js');",
    ];
    for (const s of shouldMatch) expect(MAP21_IMPORT.test(s), s).toBe(true);
  });

  it('does not fire on prose naming map21 (every pm3/lib file has a fork banner)', () => {
    const shouldNotMatch = [
      ' * FORKED FROM map21 on 2026-08-14 — do not resync with ../../map21/calcPhed.js',
      ' * Ported from references/avail-falcor/dama/routes/data_types/map21/helpers.js',
      "console.log('[pm3] ported from map21');",
    ];
    for (const s of shouldNotMatch) expect(MAP21_IMPORT.test(s), s).toBe(false);
  });

  it('pm3/lib/ carries the forked modules', () => {
    const lib = readdirSync(join(PM3_DIR, 'lib'));
    for (const expected of ['constants.js', 'helpers.js', 'calcTtrMeasure.js', 'calcPhed.js']) {
      expect(lib, `pm3/lib/${expected} missing — the fork is incomplete`).toContain(expected);
    }
  });
});
