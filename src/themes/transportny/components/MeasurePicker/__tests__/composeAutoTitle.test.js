/**
 * `composeAutoTitle` / `composeAutoKicker` — the text a report graph card names itself with.
 *
 * As of 2026-09-11 this is the ONLY title a report graph shows: it writes the section's own
 * `title`, drawn in the card's header band, and the graph-native in-card title is gone. Before
 * that it emitted a bare measure label into `display.title` and sat UNDER a hand-written section
 * title — 315 of 383 report sections carried both, one of them the identical string twice. See
 * planning/transportny/tasks/current/report-graph-card-header-and-titles.md.
 *
 * The wording is the feature, so it is asserted literally here rather than by shape.
 *
 * Run: npx vitest run src/themes/transportny/components/MeasurePicker/__tests__/composeAutoTitle.test.js
 */

import { describe, it, expect } from "vitest";

import { composeAutoTitle, composeAutoKicker, isTitleDirty, DEFAULT_PICK } from "../composeMeasureConfig";
import vocab from "../vocabulary.json";

const p = (extra = {}) => ({ ...DEFAULT_PICK, ...extra });
const AM_PEAK = { start: "06:00", end: "10:00" };
// Days are opt-OUT in this model (`isDayOn` is `!== false`), and the keys are the full lowercase
// names — a map of only the days you want ON summarises to nothing at all. See
// ReportRouteList/utils.js's DOW_DEFS.
const WEEKDAYS_ONLY = { saturday: false, sunday: false };
const WEEKENDS_ONLY = { monday: false, tuesday: false, wednesday: false, thursday: false, friday: false };

describe("composeAutoTitle", () => {

  it("names the measure and how it is grouped, in sentence case", () => {
    expect(composeAutoTitle(p({ measure: "speed", resolution: "month" })))
      .toBe("Average speed by month");
    expect(composeAutoTitle(p({ measure: "speed", resolution: "weekday" })))
      .toBe("Average speed by day of week");
    expect(composeAutoTitle(p({ measure: "hoursOfDelay", resolution: "hour" })))
      .toBe("Total hours of delay by hour of day");
    expect(composeAutoTitle(p({ measure: "avgHoursOfDelay", resolution: "5-minutes" })))
      .toBe("Average hours of delay by 5-minute epoch");
  });

  it("says 'total' for a summed measure and 'average' for an averaged one", () => {
    // The label alone ("Hours of Delay" / "CO2 Emissions (tonnes) — Truck") never said which.
    expect(composeAutoTitle(p({ measure: "hoursOfDelay", resolution: "day" }))).toMatch(/^Total /);
    expect(composeAutoTitle(p({ measure: "avgHoursOfDelay", resolution: "day" }))).toMatch(/^Average /);
    expect(composeAutoTitle(p({ measure: "co2Emissions_truck", resolution: "month" }))).toMatch(/^Total /);
    expect(composeAutoTitle(p({ measure: "avgCo2Emissions_truck", resolution: "month" }))).toMatch(/^Average /);
  });

  it("drops the grouping clause for a summary graph (one bar per route)", () => {
    expect(composeAutoTitle(p({ measure: "speed", resolution: "summary" })))
      .toBe("Average speed");
  });

  it("keeps an acronym measure upper-case rather than sentence-casing it into 'Aadt'", () => {
    expect(composeAutoTitle(p({ measure: "aadt", resolution: "summary" }))).toBe("AADT");
  });

  it("says a difference graph is a difference — the only place the card can", () => {
    expect(composeAutoTitle(p({ measure: "speed", resolution: "hour", comparisonMode: "difference" })))
      .toBe("Difference in average speed by hour of day");
  });

  it("appends the time window when the graph is restricted to one", () => {
    const pick = p({
      measure: "speed", resolution: "hour",
      routeIds: ["r1"],
      routeWindows: { r1: [{ ...AM_PEAK, weekdays: WEEKDAYS_ONLY }] },
    });
    expect(composeAutoTitle(pick)).toBe("Average speed by hour of day — AM Peak, Weekdays only");
  });

  it("returns nothing for a measure the vocabulary doesn't know", () => {
    expect(composeAutoTitle(p({ measure: "not_a_measure", resolution: "month" }))).toBe("");
    expect(composeAutoTitle(null)).toBe("");
  });

  it("keeps Table's multi-measure label list instead of forcing one sentence", () => {
    // An Info Box / Route Compare grid shows several measures at once; "average speed by month"
    // would misdescribe it.
    expect(composeAutoTitle(p({
      graphType: "Table", measures: ["speed", "travelTime"], resolution: "summary", routeCompare: true,
    }))).toBe("Route Compare, Speed (mph), Travel Time (min)");
  });

  it("has a titlePhrase for every measure in the vocabulary (no silent blank titles)", () => {
    for (const [key, m] of Object.entries(vocab.measures)) {
      expect(m.titlePhrase, `measure "${ key }" has no titlePhrase`).toBeTruthy();
      expect(composeAutoTitle(p({ measure: key, resolution: "month" }))).not.toBe("");
    }
  });
});

describe("composeAutoKicker", () => {

  it("carries the unit and the window — what the title has no room for", () => {
    expect(composeAutoKicker(p({ measure: "speed", resolution: "month" })))
      .toBe("mph · all day, every day");
    expect(composeAutoKicker(p({ measure: "hoursOfDelay", resolution: "day" })))
      .toBe("hours · all day, every day");
  });

  it("states an unrestricted window explicitly rather than leaving it to be assumed", () => {
    expect(composeAutoKicker(p({ measure: "speed" }))).toContain("all day, every day");
  });

  it("uses the real window when there is one", () => {
    const pick = p({
      measure: "speed", resolution: "hour",
      routeIds: ["r1"],
      routeWindows: { r1: [{ ...AM_PEAK, weekdays: WEEKENDS_ONLY }] },
    });
    expect(composeAutoKicker(pick)).toBe("mph · AM Peak, Weekends only");
  });

  it("de-duplicates units across a Table's measures", () => {
    expect(composeAutoKicker(p({ graphType: "Table", measures: ["speed", "speedTruck"] })))
      .toBe("mph · all day, every day");
  });
});

describe("isTitleDirty — the guard that protects a hand-written title", () => {

  it("treats an empty title as clean, so a brand-new section gets one", () => {
    expect(isTitleDirty({ currentTitle: "", priorPick: p({ measure: "speed" }) })).toBe(false);
  });

  it("treats a title this function would have produced as clean (safe to refresh)", () => {
    const prior = p({ measure: "speed", resolution: "month" });
    expect(isTitleDirty({ currentTitle: composeAutoTitle(prior), priorPick: prior })).toBe(false);
  });

  it("treats every hand-written curated title as dirty — never overwritten", () => {
    // Real titles from the 12 catalog specs. None of them can equal a composed title, so a
    // measure re-pick on a curated report leaves the author's wording alone.
    for (const title of [
      "Route Map, Speed",
      "Daily Average Speed By Month",
      "Route Bar Graph, Speed — Day of Week",
      "Route Compare, Speed / Travel Time — Year over Year",
    ]) {
      expect(isTitleDirty({ currentTitle: title, priorPick: p({ measure: "speed", resolution: "month" }) }),
        `"${ title }" must be treated as hand-written`).toBe(true);
    }
  });
});

describe("multiple time windows — the misleading case", () => {

  // A Bar Graph Summary that plots AM Peak / PM Peak / Off-Peak side by side used to announce
  // itself as "AM Peak": the fragment read only the FIRST assigned route's FIRST window. Ryan,
  // seeing it live on the regenerated snapshot: "otherwise it is misleading".
  const multi = () => p({
    measure: "speed", resolution: "summary",
    routeIds: ["r1", "r2", "r3"],
    routeWindows: {
      r1: [{ start: "06:00", end: "10:00" }],
      r2: [{ start: "15:00", end: "19:00" }],
      r3: [{ start: "10:00", end: "15:00" }],
    },
  });

  it("says so instead of naming one of them", () => {
    expect(composeAutoTitle(multi())).toBe("Average speed — multiple time windows");
    expect(composeAutoKicker(multi())).toBe("mph · multiple time windows");
  });

  // The two axes are independent, and saying WHICH one disagrees is the whole point. snapshot's
  // line graph overlays Current Year (all days) against Trailing 3 Years (weekdays only) — the
  // series share a time-of-day window and differ only on weekends. "multiple time windows" read
  // as simply wrong there (Ryan, 2026-09-11); it has no time-of-day disagreement at all.
  it("names the DAY axis when only the days differ, not the time one", () => {
    const daysOnly = p({
      measure: "speed", resolution: "5-minutes",
      routeIds: ["comp-0", "comp-1"],
      routeWindows: { "comp-0": [{}], "comp-1": [{ weekdays: WEEKDAYS_ONLY }] },
    });
    expect(composeAutoKicker(daysOnly)).toBe("mph · mixed days");
  });

  it("names the TIME axis when only the times differ, not the day one", () => {
    expect(composeAutoKicker(multi())).toBe("mph · multiple time windows");
    expect(composeAutoKicker(multi())).not.toContain("mixed days");
  });

  it("names both when both disagree", () => {
    const both = p({
      measure: "speed", resolution: "summary",
      routeIds: ["r1", "r2"],
      routeWindows: {
        r1: [{ start: "06:00", end: "10:00" }],
        r2: [{ start: "16:00", end: "20:00", weekdays: WEEKENDS_ONLY }],
      },
    });
    expect(composeAutoKicker(both)).toBe("mph · multiple time windows, mixed days");
  });

  it("keeps a shared restriction alongside a disagreement on the other axis", () => {
    const sharedTime = p({
      measure: "speed", resolution: "summary",
      routeIds: ["r1", "r2"],
      routeWindows: {
        r1: [{ ...AM_PEAK }],
        r2: [{ ...AM_PEAK, weekdays: WEEKENDS_ONLY }],
      },
    });
    expect(composeAutoKicker(sharedTime)).toBe("mph · AM Peak, mixed days");
  });

  it("says nothing about DATES — two series over different years is the normal case", () => {
    // Same window on both arms; only the date range differs, which routeWindows doesn't carry.
    const yoy = p({
      measure: "speed", resolution: "month",
      routeIds: ["comp-0", "comp-1"],
      routeWindows: { "comp-0": [{}], "comp-1": [{}] },
    });
    expect(composeAutoKicker(yoy)).toBe("mph · all day, every day");
  });

  it("still names the window when every route genuinely agrees", () => {
    const same = p({
      measure: "speed", resolution: "summary",
      routeIds: ["r1", "r2"],
      routeWindows: { r1: [{ ...AM_PEAK }], r2: [{ ...AM_PEAK }] },
    });
    expect(composeAutoKicker(same)).toBe("mph · AM Peak");
  });

  it("counts an UNRESTRICTED route as a difference, not as agreement", () => {
    // The trap: {} contributes an empty fragment, which a naive de-dupe would drop, leaving
    // "AM Peak" — a claim about bars that are not all AM Peak.
    const mixed = p({
      measure: "speed", resolution: "summary",
      routeIds: ["r1", "r2"],
      routeWindows: { r1: [{ ...AM_PEAK }], r2: [{}] },
    });
    expect(composeAutoKicker(mixed)).toBe("mph · multiple time windows");
  });

  it("reads every VARIANT of one route, not just its first", () => {
    // One route shown twice under different filters is the same problem in miniature.
    const variants = p({
      measure: "speed", resolution: "summary",
      routeIds: ["r1"],
      routeWindows: { r1: [{ ...AM_PEAK }, { start: "15:00", end: "19:00" }] },
    });
    expect(composeAutoKicker(variants)).toBe("mph · multiple time windows");
  });
});
