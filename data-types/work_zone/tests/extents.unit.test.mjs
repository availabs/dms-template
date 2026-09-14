/**
 * Unit tests for work_zone extents.
 *
 * The behaviour that matters: the anchor (where the work is) and the
 * congestion-derived impact set (where the effect is felt) never get conflated,
 * and a corridor walk can never collide two regions' tmclinears.
 */
import { describe, it, expect } from 'vitest';
import {
  MAX_PLAUSIBLE_IMPACT_TMCS, parseAnchorTmc, parseTmcList, linearKey, buildExtent,
} from '../lib/extents.js';

const meta = (over = {}) => new Map([['104P11905', {
  length: 0.5, aadt: 50000, f_system: 1, tmclinear: 12, road_order: 3,
  direction: 'SOUTHBOUND', road_name: 'I-81', ...over,
}]]);

describe('parseAnchorTmc', () => {
  it('reads the single TMC that tmclist actually holds', () => {
    expect(parseAnchorTmc({ tmclist: '104P11905' })).toBe('104P11905');
    expect(parseAnchorTmc({ tmclist: '104-04122' })).toBe('104-04122');
  });
  it('upper-cases and trims', () => {
    expect(parseAnchorTmc({ tmclist: ' 104p11905 ' })).toBe('104P11905');
  });
  it('returns null when absent', () => {
    expect(parseAnchorTmc({ tmclist: '' })).toBeNull();
    expect(parseAnchorTmc({})).toBeNull();
  });
  it('still takes the first entry if TRANSCOM ever emits a real list', () => {
    expect(parseAnchorTmc({ tmclist: '104P11905,104P11906' })).toBe('104P11905');
    expect(parseTmcList({ tmclist: '104P11905, 104P11906 104P11907' }))
      .toEqual(['104P11905', '104P11906', '104P11907']);
  });
});

describe('linearKey', () => {
  it('scopes tmclinear by the TMC region, which is unique only within one', () => {
    expect(linearKey('104P11905', { tmclinear: 12 })).toBe('104:12');
    expect(linearKey('120P11905', { tmclinear: 12 })).toBe('120:12');
    expect(linearKey('104P11905', { tmclinear: 12 }))
      .not.toBe(linearKey('120P11905', { tmclinear: 12 }));
  });
  it('is null without a linear', () => {
    expect(linearKey('104P11905', {})).toBeNull();
    expect(linearKey('104P11905', null)).toBeNull();
  });
});

describe('buildExtent', () => {
  it('labels the anchor and the impact TMCs distinctly', () => {
    const e = buildExtent({
      anchorTmc: '104P11905', impactTmcs: ['104P11906', '104P11907'], metaByTmc: meta(),
    });
    expect(e.tmcs.filter((t) => t.tmc_role === 'anchor')).toHaveLength(1);
    expect(e.tmcs.filter((t) => t.tmc_role === 'impact')).toHaveLength(2);
    expect(e.extent_source).toBe('anchor+impact');
    expect(e.n_tmcs_anchor).toBe(1);
    expect(e.n_tmcs_impact).toBe(2);
  });

  it('never counts the anchor twice when 2799 also lists it', () => {
    const e = buildExtent({
      anchorTmc: '104P11905', impactTmcs: ['104P11905', '104P11906'], metaByTmc: meta(),
    });
    expect(e.tmcs).toHaveLength(2);
    expect(e.n_tmcs_impact).toBe(1);
  });

  it('measures length on the WORK extent only, not the impact corridor', () => {
    const m = meta();
    m.set('104P11906', { length: 9.9 });
    const e = buildExtent({ anchorTmc: '104P11905', impactTmcs: ['104P11906'], metaByTmc: m });
    expect(e.length_mi).toBe(0.5);
  });

  it('grades confidence on the anchor, since only it locates the work', () => {
    expect(buildExtent({ anchorTmc: '104P11905', metaByTmc: meta() }).extent_confidence).toBe('high');
    expect(buildExtent({ anchorTmc: '999X99999', metaByTmc: meta() }).extent_confidence).toBe('medium');
    expect(buildExtent({ anchorTmc: null, impactTmcs: ['104P11906'], metaByTmc: meta() }).extent_confidence).toBe('low');
    expect(buildExtent({ anchorTmc: null, metaByTmc: meta() }).extent_confidence).toBe('none');
  });

  it('reports the extent source for every combination', () => {
    const m = meta();
    expect(buildExtent({ anchorTmc: 'A', impactTmcs: ['B'], metaByTmc: m }).extent_source).toBe('anchor+impact');
    expect(buildExtent({ anchorTmc: 'A', metaByTmc: m }).extent_source).toBe('anchor');
    expect(buildExtent({ anchorTmc: null, impactTmcs: ['B'], metaByTmc: m }).extent_source).toBe('impact');
    expect(buildExtent({ anchorTmc: null, metaByTmc: m }).extent_source).toBe('none');
  });

  it('prefers the event direction and falls back to the anchor TMC', () => {
    expect(buildExtent({ anchorTmc: '104P11905', metaByTmc: meta(), eventDirection: 'NB' }).direction).toBe('NB');
    expect(buildExtent({ anchorTmc: '104P11905', metaByTmc: meta() }).direction).toBe('SOUTHBOUND');
    expect(buildExtent({ anchorTmc: '999X99999', metaByTmc: meta() }).direction).toBeNull();
  });

  it('flags an implausibly long impact set rather than dropping it', () => {
    const many = Array.from({ length: MAX_PLAUSIBLE_IMPACT_TMCS + 1 }, (_, i) => `T${i}`);
    const e = buildExtent({ anchorTmc: '104P11905', impactTmcs: many, metaByTmc: meta() });
    expect(e.impact_extent_implausible).toBe(true);
    expect(e.n_tmcs_impact).toBe(MAX_PLAUSIBLE_IMPACT_TMCS + 1);
    expect(e.tmcs).toHaveLength(MAX_PLAUSIBLE_IMPACT_TMCS + 2);
  });

  it('marks TMCs with no meta row so a later phase can tell', () => {
    const e = buildExtent({ anchorTmc: '104P11905', impactTmcs: ['999X99999'], metaByTmc: meta() });
    expect(e.tmcs.find((t) => t.tmc === '104P11905').has_meta).toBe(true);
    expect(e.tmcs.find((t) => t.tmc === '999X99999').has_meta).toBe(false);
  });
});
