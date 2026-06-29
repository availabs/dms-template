/**
 * Unit tests: pm3's permissive checkMeta vs map21's strict production gate.
 *
 * pm3-vs-map21 difference encoded here:
 *   map21 rejects a TMC when any of these fail; pm3 accepts ALL of them and
 *   only skips a TMC when there is no meta row at all (legacy pm3 worker had
 *   every checkMeta rule commented out — by design, pm3 keeps every TMC).
 */
import { describe, it, expect } from 'vitest';
import worker from '../worker.js';

const { checkMeta } = worker;

// map21's checkMeta, copied VERBATIM from data-types/map21/worker.js (which is
// a read-only dependency and does not export it). Used only as the reference
// behavior these fixtures are asserted against.
function map21CheckMeta({ tmcMeta }) {
  if (!tmcMeta) return false;
  const { directionalaadt, nhs, f_system, faciltype, urban_code, nhs_pct, isprimary, congestion_level } = tmcMeta;
  if (!directionalaadt) return false;
  if (parseInt(f_system) < 1 || parseInt(f_system) > 7) return false;
  if (parseInt(faciltype) !== 1 && parseInt(faciltype) !== 2 && parseInt(faciltype) !== 6) return false;
  if (parseInt(nhs) < 1 || parseInt(nhs) > 9) return false;
  if (!urban_code || parseInt(urban_code) <= 0) return false;
  if (parseFloat(nhs_pct) <= 0) return false;
  if (!isprimary || parseInt(isprimary) === 0) return false;
  if (!congestion_level || congestion_level === '') return false;
  return true;
}

const VALID_ROW = {
  tmc: '104+04107',
  directionalaadt: 5000,
  nhs: '1',
  f_system: '1',
  faciltype: '1',
  urban_code: '63217',
  nhs_pct: '100',
  isprimary: '1',
  congestion_level: 'NO2LOW_CONGESTION',
};

// Each fixture is a row map21 REJECTS. pm3 must accept every one of them.
const ROWS_MAP21_REJECTS = {
  'missing directionalaadt':       { ...VALID_ROW, directionalaadt: null },
  'f_system out of 1..7':          { ...VALID_ROW, f_system: '0' },
  'faciltype not in {1,2,6}':      { ...VALID_ROW, faciltype: '4' },
  'nhs out of 1..9':               { ...VALID_ROW, nhs: '0' },
  'null urban_code':               { ...VALID_ROW, urban_code: null },
  'non-positive nhs_pct':          { ...VALID_ROW, nhs_pct: '0' },
  'isprimary = 0':                 { ...VALID_ROW, isprimary: '0' },
  'blank congestion_level':        { ...VALID_ROW, congestion_level: '' },
  'sparse row (only tmc + aadt)':  { tmc: '104+04107', directionalaadt: 100 },
};

describe('pm3 checkMeta (permissive) vs map21 checkMeta (strict)', () => {
  it('both accept a fully-valid row', () => {
    expect(map21CheckMeta({ tmcMeta: VALID_ROW })).toBe(true);
    expect(checkMeta({ tmcMeta: VALID_ROW })).toBe(true);
  });

  it('both reject a missing meta row entirely', () => {
    expect(map21CheckMeta({ tmcMeta: null })).toBe(false);
    expect(checkMeta({ tmcMeta: null })).toBe(false);
    expect(checkMeta({ tmcMeta: undefined })).toBe(false);
  });

  for (const [label, row] of Object.entries(ROWS_MAP21_REJECTS)) {
    it(`accepts a row map21 rejects: ${label}`, () => {
      expect(map21CheckMeta({ tmcMeta: row })).toBe(false); // sanity: map21 really rejects it
      expect(checkMeta({ tmcMeta: row })).toBe(true);       // pm3 keeps it
    });
  }
});
