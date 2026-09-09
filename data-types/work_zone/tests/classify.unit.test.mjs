/**
 * Unit tests for work_zone event classification.
 *
 * The contract that matters: an unrecognised event_type must never be guessed
 * into or out of scope, and the legacy family filter must stay available for
 * reconciliation even though it is not the scope test.
 */
import { describe, it, expect } from 'vitest';
import {
  WORK_ACTIVITY_BY_EVENT_TYPE, DEFAULT_SCOPE_CLASSES, LEGACY_FAMILY_SUB_CATEGORIES,
  isNewYork, matchesLegacyFamily, workActivityClass, classifyEvent, classifyBatch,
} from '../lib/classify.js';

const ny = (over = {}) => ({ state: 'NY', event_type: 'Construction', ...over });

describe('isNewYork', () => {
  it('accepts either state or state_code', () => {
    expect(isNewYork({ state: 'NY' })).toBe(true);
    expect(isNewYork({ state: 'New York' })).toBe(true);
    expect(isNewYork({ state_code: 36 })).toBe(true);
    expect(isNewYork({ state_code: '36' })).toBe(true);
  });
  it('rejects the other TRANSCOM states', () => {
    expect(isNewYork({ state: 'NJ' })).toBe(false);
    expect(isNewYork({ state: 'CT' })).toBe(false);
    expect(isNewYork({ state_code: 34 })).toBe(false);
  });
  it('does not assume NY when neither field is present', () => {
    expect(isNewYork({})).toBe(false);
    expect(isNewYork({ state: '', state_code: '' })).toBe(false);
  });
});

describe('workActivityClass', () => {
  it('classifies the planned-work types as construction', () => {
    for (const t of ['Construction', 'Roadwork', 'Emergency construction']) {
      expect(workActivityClass(t)).toBe('construction');
    }
  });
  it('classifies roadway maintenance work as maintenance', () => {
    for (const t of ['Roving repairs', 'Pothole repairs', 'Road sweeping', 'Overhead Sign Repairs']) {
      expect(workActivityClass(t)).toBe('maintenance');
    }
  });
  it('classifies utility work as utility, including types the legacy filter drops', () => {
    expect(workActivityClass('Utility work')).toBe('utility');
    expect(workActivityClass('Watermain break')).toBe('utility');
    expect(workActivityClass('Gas main break')).toBe('utility');
  });
  it('keeps incident response and winter operations out of the work classes', () => {
    expect(workActivityClass('Police department activity')).toBe('incident_response');
    expect(workActivityClass('Vehicle fire')).toBe('incident_response');
    expect(workActivityClass('Downed tree')).toBe('incident_response');
    expect(workActivityClass('Plowing and salting')).toBe('winter_operations');
    expect(workActivityClass('Drawbridge open')).toBe('operations');
  });
  it('is case-insensitive but never fuzzy', () => {
    expect(workActivityClass('construction')).toBe('construction');
    expect(workActivityClass('CONSTRUCTION')).toBe('construction');
    expect(workActivityClass('Construction Zone')).toBe('unclassified');
  });
  it('returns unclassified for unknown and empty types', () => {
    expect(workActivityClass('Alien Invasion')).toBe('unclassified');
    expect(workActivityClass('')).toBe('unclassified');
    expect(workActivityClass(null)).toBe('unclassified');
  });
  it('covers all 44 observed event types', () => {
    expect(Object.keys(WORK_ACTIVITY_BY_EVENT_TYPE)).toHaveLength(44);
  });
});

describe('classifyEvent', () => {
  it('puts construction, maintenance and utility in scope by default', () => {
    expect(DEFAULT_SCOPE_CLASSES).toEqual(['construction', 'maintenance', 'utility']);
    for (const t of ['Construction', 'Pothole repairs', 'Watermain break']) {
      expect(classifyEvent(ny({ event_type: t })).in_scope).toBe(true);
    }
  });
  it('excludes incident response and winter operations', () => {
    expect(classifyEvent(ny({ event_type: 'Vehicle fire' })).in_scope).toBe(false);
    expect(classifyEvent(ny({ event_type: 'Plowing and salting' })).in_scope).toBe(false);
  });
  it('never puts a non-NY event in scope', () => {
    expect(classifyEvent({ state: 'NJ', event_type: 'Construction' }).in_scope).toBe(false);
  });
  it('honours a caller-supplied scope', () => {
    const opts = { scopeClasses: ['construction'] };
    expect(classifyEvent(ny({ event_type: 'Construction' }), opts).in_scope).toBe(true);
    expect(classifyEvent(ny({ event_type: 'Pothole repairs' }), opts).in_scope).toBe(false);
    const wide = { scopeClasses: ['construction', 'maintenance', 'utility', 'winter_operations'] };
    expect(classifyEvent(ny({ event_type: 'Plowing and salting' }), wide).in_scope).toBe(true);
  });
  it('never puts an unclassified type in scope, whatever the scope list', () => {
    const all = { scopeClasses: ['construction', 'maintenance', 'utility', 'winter_operations', 'operations', 'incident_response'] };
    expect(classifyEvent(ny({ event_type: 'Brand New Type' }), all).in_scope).toBe(false);
  });
  it('flags utility or permit work described inside a construction event', () => {
    expect(classifyEvent(ny({ description: 'GAS MAIN replacement, National Grid' })).is_utility_or_permit).toBe(true);
    expect(classifyEvent(ny({ description: 'PERMIT work at the ramp' })).is_utility_or_permit).toBe(true);
    expect(classifyEvent(ny({ description: 'milling and paving' })).is_utility_or_permit).toBe(false);
    expect(classifyEvent(ny({ event_type: 'Downed pole', description: '' })).is_utility_or_permit).toBe(true);
  });
});

describe('matchesLegacyFamily (reconciliation, not scope)', () => {
  it('matches on sub_category alone, as the TSMO dashboards do', () => {
    expect(LEGACY_FAMILY_SUB_CATEGORIES).toEqual(['Construction', 'Maintenance', 'Emergency Operations']);
    expect(matchesLegacyFamily({ nysdot_sub_category: 'Emergency Operations' })).toBe(true);
    expect(matchesLegacyFamily({ nysdot_sub_category: 'Crash' })).toBe(false);
  });
  it('is independent of scope — an incident-response event can be in the family', () => {
    const c = classifyEvent({ state: 'NY', event_type: 'Police department activity', nysdot_sub_category: 'Emergency Operations' });
    expect(c.is_legacy_family).toBe(true);
    expect(c.in_scope).toBe(false);
  });
});

describe('classifyBatch', () => {
  it('separates the in-scope rows and reports unknown types with counts', () => {
    const rows = [
      ny({ event_type: 'Construction' }),
      ny({ event_type: 'Vehicle fire' }),
      ny({ event_type: 'Mystery Work' }),
      ny({ event_type: 'Mystery Work' }),
      { state: 'NJ', event_type: 'Another Mystery' },
    ];
    const { inScope, unknownEventTypes } = classifyBatch(rows);
    expect(inScope).toHaveLength(1);
    expect(unknownEventTypes).toEqual([{ event_type: 'Mystery Work', count: 2 }]);
  });
});
