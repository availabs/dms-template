/**
 * Unit tests for the npmrds metadata enrichment row mapping + lookup data.
 *
 * Ported from the legacy metadata.worker.mjs batch loop: state_code from the
 * reverse fipsCodeToState lookup, county_code/region_code from
 * countyFipsToRegion (NY/CT/NJ coverage only), ua_name from uaCodeToUaName,
 * congestion/directionality from the per-TMC calc, mpo_code deferred (null).
 */
import { describe, it, expect } from 'vitest';
import { enrichTmcIdRow } from '../enrich.js';
import { countyFipsToRegion } from '../lookups/county_fips_to_region.js';
import { uaCodeToUaName } from '../lookups/ua_code_to_ua_name.js';
import { fipsCodeToState } from '../lookups/fips_code_to_state.js';

describe('lookup data (ported verbatim)', () => {
  it('countyFipsToRegion covers only NY (36), CT (09), NJ (34) prefixes', () => {
    const prefixes = new Set(Object.keys(countyFipsToRegion).map((k) => k.slice(0, 2)));
    expect([...prefixes].sort()).toEqual(['09', '34', '36']);
  });
  it('maps Albany county to NYSDOT region 1', () => {
    expect(countyFipsToRegion['36001'].county_name).toBe('ALBANY');
    expect(countyFipsToRegion['36001'].region).toBe(1);
  });
  it('uaCodeToUaName knows the NYC urbanized area (the AVO special-case code)', () => {
    expect(uaCodeToUaName['63217']).toMatch(/New York/);
  });
  it('fipsCodeToState maps 36 → NY', () => {
    expect(fipsCodeToState['36']).toBe('NY');
  });
});

describe('enrichTmcIdRow', () => {
  const directionalityByTmc = {
    '104+04099': { directionality: 'AM_PEAK', congestionLevel: 'MODERATE_CONGESTION' },
  };

  it('enriches an NY row with state/county/region codes and ua_name', () => {
    const out = enrichTmcIdRow(
      { tmc: '104+04099', year: '2023', state_name: 'NY', county_name: 'ALBANY', ua_code: '63217' },
      directionalityByTmc
    );
    expect(out).toEqual({
      tmc: '104+04099',
      year: 2023,
      state_name: 'NY',
      county_name: 'ALBANY',
      ua_code: '63217',
      county_code: '36001',
      state_code: '36',
      region_code: 1,
      congestion_level: 'MODERATE_CONGESTION',
      directionality: 'AM_PEAK',
      ua_name: uaCodeToUaName['63217'],
      mpo_code: null,
    });
  });

  it('out-of-coverage states get null county/region codes (legacy NY/CT/NJ-only gotcha)', () => {
    const out = enrichTmcIdRow(
      { tmc: 'x', year: '2023', state_name: 'CA', county_name: 'LOS ANGELES', ua_code: '51445' },
      {}
    );
    expect(out.state_code).toBe('06');
    expect(out.county_code).toBe(null);
    expect(out.region_code).toBe(null);
    expect(out.congestion_level).toBe(null);
    expect(out.directionality).toBe(null);
  });

  it('unknown state yields undefined state_code (matches legacy find) and null county_code', () => {
    const out = enrichTmcIdRow(
      { tmc: 'x', year: '2023', state_name: 'NOT A STATE', county_name: 'NOWHERE', ua_code: null },
      {}
    );
    expect(out.state_code).toBe(undefined);
    expect(out.county_code).toBe(null);
    expect(out.ua_name).toBe(null);
  });
});
