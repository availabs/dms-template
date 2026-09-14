/**
 * Unit tests for work_zone significance.
 *
 * Phase 1a made this rule the definition, so its edges matter: the Interstate
 * test must not inherit f_system's false positives, TMA membership must prefer
 * the urbanized area over the county, and the lane-count gap must stay visible
 * rather than silently shrinking the significant population.
 */
import { describe, it, expect } from 'vitest';
import {
  NY_TMA_UA_CODES, DEFAULT_MIN_CONSECUTIVE_DAYS,
  isInterstateFacility, tmaForUaCode, tmaForCounty, resolveTma, assessSignificance,
} from '../lib/tma.js';

describe('isInterstateFacility', () => {
  it('accepts the interstate forms TRANSCOM uses', () => {
    for (const f of ['I-81', 'I 495', 'I-90 - NYS Thruway', 'I-87 Northway', 'i-278']) {
      expect(isInterstateFacility(f)).toBe(true);
    }
  });
  it('rejects the city streets that f_system=1 wrongly includes', () => {
    for (const f of ['43RD ST', '6TH AVE', '111TH AVE', 'NY 27', 'US 9', '', null]) {
      expect(isInterstateFacility(f)).toBe(false);
    }
  });
  it('does not match an I that is part of a word', () => {
    expect(isInterstateFacility('IROQUOIS 81')).toBe(false);
  });
});

describe('TMA membership', () => {
  it('knows exactly the six NY TMAs', () => {
    expect(Object.keys(NY_TMA_UA_CODES)).toHaveLength(6);
    expect(tmaForUaCode(63217)).toMatch(/New York/);
    expect(tmaForUaCode(11350)).toBe('Buffalo, NY');
    expect(tmaForUaCode(970)).toMatch(/Albany/);
    expect(tmaForUaCode(75664)).toBe('Rochester, NY');
    expect(tmaForUaCode(86302)).toBe('Syracuse, NY');
    expect(tmaForUaCode(71803)).toMatch(/Poughkeepsie/);
  });
  it('excludes NY urbanized areas below the 200k threshold', () => {
    expect(tmaForUaCode(89785)).toBeNull();   // Utica
    expect(tmaForUaCode(7732)).toBeNull();    // Binghamton
    expect(tmaForUaCode(45262)).toBeNull();   // Kingston
  });
  it('accepts a numeric string as well as a number', () => {
    expect(tmaForUaCode('11350')).toBe('Buffalo, NY');
  });

  it('prefers the urbanized area, and treats a non-TMA ua_code as a decided no', () => {
    expect(resolveTma({ uaCode: 86302, county: 'ERIE' }))
      .toEqual({ in_tma: true, tma_name: 'Syracuse, NY', tma_basis: 'ua_code' });
    // Utica UA in a county that is not in the approximate list either
    expect(resolveTma({ uaCode: 89785, county: 'ONEIDA' }))
      .toEqual({ in_tma: false, tma_name: null, tma_basis: 'ua_code' });
    // a real ua_code that is not a TMA must NOT fall through to the county guess
    expect(resolveTma({ uaCode: 89785, county: 'ERIE' }).in_tma).toBe(false);
  });

  it('falls back to the county only when there is no urbanized area', () => {
    expect(resolveTma({ uaCode: 0, county: 'ONONDAGA' }))
      .toEqual({ in_tma: true, tma_name: 'Syracuse, NY', tma_basis: 'county_approx' });
    expect(resolveTma({ county: 'ERIE' }).tma_basis).toBe('county_approx');
    expect(resolveTma({ county: 'STEUBEN' }).in_tma).toBe(false);
    expect(resolveTma({}).tma_basis).toBe('none');
  });

  it('matches county names case- and space-insensitively', () => {
    expect(tmaForCounty(' new york ')).toMatch(/New York/);
    expect(tmaForCounty('Westchester')).toMatch(/New York/);
  });
});

describe('assessSignificance', () => {
  const wz = (over = {}) => ({
    facility: 'I-81', ua_code: 86302, county_name: 'ONONDAGA',
    consecutive_closure_days: 3, consecutive_active_days: 5, f_system: 1, ...over,
  });

  it('applies the rule as written: interstate AND tma AND >= 3 consecutive closure days', () => {
    expect(DEFAULT_MIN_CONSECUTIVE_DAYS).toBe(3);
    expect(assessSignificance(wz()).is_significant_candidate).toBe(true);
    expect(assessSignificance(wz({ consecutive_closure_days: 2 })).is_significant_candidate).toBe(false);
    expect(assessSignificance(wz({ facility: 'NY 27' })).is_significant_candidate).toBe(false);
    expect(assessSignificance(wz({ ua_code: 89785, county_name: 'ONEIDA' })).is_significant_candidate).toBe(false);
  });

  it('honours a caller-supplied duration threshold', () => {
    expect(assessSignificance(wz({ consecutive_closure_days: 4 }), { minConsecutiveDays: 5 })
      .is_significant_candidate).toBe(false);
  });

  it('keeps the lane-count gap visible via the any-activity variant', () => {
    // A zone active 5 consecutive days but with no reported lane counts fails
    // the rule as written, and the variant shows what the gap is hiding.
    const noCounts = assessSignificance(wz({ consecutive_closure_days: 0, consecutive_active_days: 5 }));
    expect(noCounts.is_significant_candidate).toBe(false);
    expect(noCounts.is_significant_candidate_any_activity).toBe(true);
  });

  it('records both interstate signals and flags disagreement', () => {
    const cityStreet = assessSignificance(wz({ facility: '43RD ST', f_system: 1 }));
    expect(cityStreet.is_interstate).toBe(false);
    expect(cityStreet.f_system_says_interstate).toBe(true);
    expect(cityStreet.interstate_signals_disagree).toBe(true);
    expect(cityStreet.is_significant_candidate).toBe(false);

    const agreeing = assessSignificance(wz());
    expect(agreeing.interstate_signals_disagree).toBe(false);
  });

  it('states the rule it applied, for the published metadata', () => {
    expect(assessSignificance(wz()).significance_rule)
      .toBe('interstate AND tma AND consecutive_closure_days >= 3');
    expect(assessSignificance(wz(), { minConsecutiveDays: 5 }).significance_rule)
      .toBe('interstate AND tma AND consecutive_closure_days >= 5');
  });
});
