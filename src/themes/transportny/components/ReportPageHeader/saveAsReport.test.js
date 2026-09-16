import { describe, it, expect } from 'vitest';
import { nextCopyTitle, tagsForCopy } from './useSaveAsReport';
import {
  routesToSlots, slotsToStaticRoutes, dynamicReportFilters, staticReportFilters,
  freezeSectionDisplayText, catalogFromResolvedRoutes, CATALOG_SNAPSHOT_FIELDS,
} from '../ReportRouteList/reportKindConversion';

// Covers the decisions that are easy to get subtly wrong and invisible in a screenshot:
// the copy's title/slug derivation, the user/agency tag scoping rule, and that a kind
// conversion is round-trippable without accumulating filters.

describe('nextCopyTitle', () => {
  it('appends "Copy" when the name is free', () => {
    expect(nextCopyTitle('I-90 Speed Study', [])).toBe('I-90 Speed Study Copy');
  });

  it('numbers from 2 once "Copy" is taken', () => {
    const siblings = [{ title: 'I-90 Speed Study' }, { title: 'I-90 Speed Study Copy' }];
    expect(nextCopyTitle('I-90 Speed Study', siblings)).toBe('I-90 Speed Study Copy 2');
  });

  it('skips over gaps rather than reusing a taken number', () => {
    const siblings = [
      { title: 'A Copy' }, { title: 'A Copy 2' }, { title: 'A Copy 3' },
    ];
    expect(nextCopyTitle('A', siblings)).toBe('A Copy 4');
  });

  // Copying a copy must not compound into "Foo Copy Copy" — the slug is derived from this
  // string, so the suffix is load-bearing, not cosmetic.
  it('strips an existing Copy suffix instead of compounding', () => {
    expect(nextCopyTitle('Foo Copy', [{ title: 'Foo Copy' }])).toBe('Foo Copy 2');
    expect(nextCopyTitle('Foo Copy 3', [{ title: 'Foo Copy' }])).toBe('Foo Copy 2');
  });

  it('falls back to a real name for an untitled report', () => {
    expect(nextCopyTitle('', [])).toBe('Report Copy');
  });
});

describe('tagsForCopy', () => {
  const user = { id: 42, groups: ['NYSDOT Admin', 'public'] };

  it('replaces the source author’s user tag with the copier’s', () => {
    const out = tagsForCopy(['user:993', 'county:Albany'], user);
    expect(out).toContain('user:42');
    expect(out).not.toContain('user:993');
  });

  it('keeps an agency tag the copier is actually in', () => {
    expect(tagsForCopy(['agency:NYSDOT_ADMIN'], user)).toContain('agency:NYSDOT_ADMIN');
  });

  it('drops an agency tag the copier is NOT in', () => {
    expect(tagsForCopy(['agency:NYMTC'], user)).not.toContain('agency:NYMTC');
  });

  it('keeps content-descriptor tags regardless of membership', () => {
    const out = tagsForCopy(['county:Albany', 'region:8', 'category:events', 'difficulty:beginner'], user);
    ['county:Albany', 'region:8', 'category:events', 'difficulty:beginner'].forEach((t) => expect(out).toContain(t));
  });

  // The two curated "shown to everyone" provenance markers: a personal copy of one of the 12
  // Dynamic Report templates must not advertise itself as one of the originals.
  it('drops the curated-only provenance markers', () => {
    const out = tagsForCopy(['dynamic_report_template', 'auto_generated', 'county:Erie'], user);
    expect(out).not.toContain('dynamic_report_template');
    expect(out).not.toContain('auto_generated');
    expect(out).toContain('county:Erie');
  });

  it('returns no user tag for a logged-out copier', () => {
    expect(tagsForCopy(['county:Albany'], null)).toEqual(['county:Albany']);
  });
});

describe('routesToSlots', () => {
  const staticRoutes = [
    { route_comp_id: 'comp-1', name: 'Ocean Pkwy', id: 555, tmc_array: ['1', '2'], color: '#f00', startDate: '2024-01-01' },
    { route_comp_id: 'comp-2', name: 'Ocean Pkwy 2023', id: 555, tmc_array: ['1', '2'], color: '#0f0', startDate: '2023-01-01' },
  ];

  it('templates every slot name so it re-resolves to whatever route a viewer picks', () => {
    expect(routesToSlots(staticRoutes).map((s) => s.name)).toEqual(['%n (%y)', '%n (%y)']);
  });

  it('strips catalog-snapshot fields a slot re-resolves live', () => {
    const slot = routesToSlots(staticRoutes)[0];
    CATALOG_SNAPSHOT_FIELDS.forEach((f) => expect(slot[f]).toBeUndefined());
  });

  it('keeps identity/authoring fields', () => {
    const slot = routesToSlots(staticRoutes)[0];
    expect(slot.route_comp_id).toBe('comp-1');
    expect(slot.color).toBe('#f00');
  });

  // Two routes that are date VIEWS of one physical route must land in one slot group, so a
  // viewer is asked to pick one route rather than two.
  it('groups routes sharing a real catalog id', () => {
    const slots = routesToSlots(staticRoutes);
    expect(slots[0].route_slot_group).toBeUndefined();   // first member defines the group
    expect(slots[1].route_slot_group).toBe('comp-1');
  });

  it('preserves an existing route_slot_group verbatim instead of re-deriving it', () => {
    const preGrouped = [
      { route_comp_id: 'comp-1', id: 7, route_slot_group: '$0' },
      { route_comp_id: 'comp-2', id: 7, route_slot_group: '$1' },
    ];
    expect(routesToSlots(preGrouped).map((s) => s.route_slot_group)).toEqual(['$0', '$1']);
  });

  it('handles an empty/absent route list', () => {
    expect(routesToSlots([])).toEqual([]);
    expect(routesToSlots(undefined)).toEqual([]);
  });
});

describe('slotsToStaticRoutes', () => {
  it('drops the resolution-only catalogRouteName field', () => {
    const out = slotsToStaticRoutes([{ route_comp_id: 'comp-1', name: 'Literal Name', catalogRouteName: 'I-90' }]);
    expect(out[0]).not.toHaveProperty('catalogRouteName');
  });

  it('freezes a templated name into its resolved literal', () => {
    const out = slotsToStaticRoutes([
      { route_comp_id: 'comp-1', name: '%n (%y)', catalogRouteName: 'I-90 EB', startDate: '2024-01-01', endDate: '2024-12-31' },
    ]);
    expect(out[0].name).not.toContain('%n');
    expect(out[0].name).toContain('I-90 EB');
  });

  it('leaves a literal name untouched', () => {
    expect(slotsToStaticRoutes([{ name: 'Ocean Pkwy' }])[0].name).toBe('Ocean Pkwy');
  });
});

describe('report-kind filters', () => {
  const unrelated = { id: 'page-var-1', searchKey: 'year', type: 'filter' };

  it('adds exactly the two dynamic markers, preserving unrelated page filters', () => {
    const out = dynamicReportFilters([unrelated]);
    expect(out).toContainEqual(unrelated);
    expect(out.filter((f) => f.type === 'routeSlots')).toHaveLength(1);
    expect(out.filter((f) => f.type === 'baseDate')).toHaveLength(1);
  });

  it('does not accumulate duplicates when applied twice', () => {
    const once = dynamicReportFilters([unrelated]);
    const twice = dynamicReportFilters(once);
    expect(twice).toHaveLength(once.length);
  });

  it('round-trips back to the original static filter set', () => {
    expect(staticReportFilters(dynamicReportFilters([unrelated]))).toEqual([unrelated]);
  });

  it('tolerates an absent filter list', () => {
    expect(staticReportFilters(undefined)).toEqual([]);
    expect(dynamicReportFilters(undefined)).toHaveLength(2);
  });
});


// The dynamic→static direction rewrites SECTION content too, not just routes[]: a graph title
// authored as "Hours of Delay - %n" has no live substitution mechanism once the report is static,
// so it must be frozen into its resolved literal at conversion time. Skipping this is a real bug
// that shipped once (2026-09-09, bi_directional: all 14 graph titles went blank after "- ").
describe('freezeSectionDisplayText', () => {
  const catalog = catalogFromResolvedRoutes([
    { route_comp_id: 'comp-0', name: '%n (%y)', catalogRouteName: 'I-90 EB', startDate: '2024-01-01', endDate: '2024-12-31' },
  ]);

  const sectionWithTitle = (title) => ({
    title,
    element: {
      'element-type': 'Graph',
      'element-data': JSON.stringify({ display: { _measurePick: { routeIds: ['comp-0'] } } }),
    },
  });

  it('substitutes %n in a section title', () => {
    const { changed, sections } = freezeSectionDisplayText([sectionWithTitle('Hours of Delay - %n')], catalog);
    expect(changed).toBe(true);
    expect(sections[0].title).not.toContain('%n');
    expect(sections[0].title).toContain('I-90 EB');
  });

  it('leaves a section with no tokens untouched, and reports no change', () => {
    const { changed, sections } = freezeSectionDisplayText([sectionWithTitle('Speed (mph)')], catalog);
    expect(changed).toBe(false);
    expect(sections[0].title).toBe('Speed (mph)');
  });

  // Non-report sections (and anything whose element-data isn't a JSON string) must pass through
  // untouched rather than throw — the array handed in is the WHOLE page's sections.
  it('passes through a section whose element-data is not a JSON string', () => {
    const odd = { title: 'Lexical %n', element: { 'element-type': 'Lexical', 'element-data': { not: 'a string' } } };
    const { sections } = freezeSectionDisplayText([odd], catalog);
    expect(sections[0]).toBe(odd);
  });

  it('survives unparseable element-data without throwing', () => {
    const broken = { title: 'x', element: { 'element-data': '{not json' } };
    expect(() => freezeSectionDisplayText([broken], catalog)).not.toThrow();
  });

  it('handles an empty/absent section list', () => {
    expect(freezeSectionDisplayText([], catalog).sections).toEqual([]);
    expect(freezeSectionDisplayText(undefined, catalog).sections).toEqual([]);
  });
});
