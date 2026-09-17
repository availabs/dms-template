import { describe, it, expect } from 'vitest';
import { routeDisplayLabel, resolvedRouteLabel } from './relativeDateResolution';

// `routeDisplayLabel` is the shared rule for "what do we CALL this route in author-facing chrome"
// — read by RRL's collapsed row title (RouteRow.jsx) and the graph-header Quick Controls Routes
// pill/picker (QuickControls/index.jsx). The two disagreeing is the exact bug this choke point
// exists to prevent.
describe('routeDisplayLabel', () => {
  it('substitutes %n/%y once a slot has resolved against a real catalog route', () => {
    const resolved = {
      name: '%n (%y)',
      catalogRouteName: 'I-90 EB',
      startDate: '2024-01-01',
      endDate: '2024-12-31',
    };
    expect(routeDisplayLabel(resolved)).toBe('I-90 EB (2024)');
  });

  it('spans years when the resolved window crosses a calendar boundary', () => {
    const resolved = {
      name: '%n %y',
      catalogRouteName: 'Route 9D NB',
      startDate: '2024-12-19',
      endDate: '2026-03-19',
    };
    expect(routeDisplayLabel(resolved)).toBe('Route 9D NB 2024–2026');
  });

  it('leaves an UNRESOLVED slot showing its literal template, not a half-substituted name', () => {
    // No catalogRouteName == no `?routes=` supplied yet. `resolvedRouteLabel` alone would fill %y
    // from the dates while %n stayed empty (" (2024)"), which reads as a bug rather than a
    // placeholder — that's the whole reason this wrapper exists.
    const unresolved = { name: '%n (%y)', startDate: '2024-01-01', endDate: '2024-12-31' };
    expect(resolvedRouteLabel(unresolved)).toBe(' (2024)');
    expect(routeDisplayLabel(unresolved)).toBe('%n (%y)');
  });

  it('is a no-op for a static report route (no tokens, no catalogRouteName)', () => {
    expect(routeDisplayLabel({ name: 'I-87 Northway SB' })).toBe('I-87 Northway SB');
  });

  it('passes an untemplated name through even on a resolved slot', () => {
    expect(routeDisplayLabel({ name: 'Current Year', catalogRouteName: 'I-90 EB' })).toBe('Current Year');
  });

  it('tolerates a missing route', () => {
    expect(routeDisplayLabel(undefined)).toBeUndefined();
  });
});
