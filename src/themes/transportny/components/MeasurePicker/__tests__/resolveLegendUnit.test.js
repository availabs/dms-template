/**
 * `resolveLegendUnit` — the default text for a graph legend's title slot.
 *
 * This is the transportny half of the legend-unit work: the library asks an optional
 * theme-supplied resolver rather than reading `display._measurePick` itself, so npmrds
 * vocabulary never enters `@availabs/dms`. Everything npmrds-specific is tested here, on this
 * side of that boundary.
 *
 * Run: npx vitest run src/themes/transportny/components/MeasurePicker/__tests__/resolveLegendUnit.test.js
 */

import { describe, it, expect } from "vitest";

import { resolveLegendUnit } from "../resolveLegendUnit.js";
import vocab from "../vocabulary.json";

const pick = (measure, extra = {}) => ({ _measurePick: { measure }, ...extra });

describe("resolveLegendUnit", () => {

  it("returns nothing when the section isn't measure-bound", () => {
    // Every non-npmrds graph, and any npmrds section predating the picker. Returning a string
    // here would print a stray caption on graphs that never asked for one.
    expect(resolveLegendUnit(undefined)).toBeUndefined();
    expect(resolveLegendUnit({})).toBeUndefined();
    expect(resolveLegendUnit({ _measurePick: {} })).toBeUndefined();
  });

  it("returns nothing for a measure the vocabulary doesn't know", () => {
    expect(resolveLegendUnit(pick("notAMeasure"))).toBeUndefined();
  });

  it("gives every measure in the vocabulary a unit", () => {
    // Guards the real failure mode: someone adds a measure and the legend silently loses its
    // caption for that one chart type only.
    for (const key of Object.keys(vocab.measures)) {
      expect(resolveLegendUnit(pick(key)), `measure "${ key }" has no unit`).toBeTruthy();
    }
  });

  it("maps the measures whose units are load-bearing", () => {
    expect(resolveLegendUnit(pick("speed"))).toBe("mph");
    expect(resolveLegendUnit(pick("speedTruck"))).toBe("mph");
    expect(resolveLegendUnit(pick("hoursOfDelay"))).toBe("hours");
    expect(resolveLegendUnit(pick("avgHoursOfDelay"))).toBe("hours");
    expect(resolveLegendUnit(pick("length"))).toBe("mi");
    expect(resolveLegendUnit(pick("co2Emissions_truck"))).toBe("tonnes");
  });

  describe("the value format overrides the measure's nominal unit", () => {
    it("says mm:ss for a duration_mmss column, not min", () => {
      // travelTime is stored in decimal MINUTES but rendered "22:45" by durationMinutesFormat.
      // Captioning that column "min" would misdescribe what the reader is looking at.
      expect(resolveLegendUnit(pick("travelTime"))).toBe("min");
      expect(resolveLegendUnit(pick("travelTime", { tooltip: { valueFormat: "duration_mmss" } })))
        .toBe("mm:ss");
    });

    it("says nothing at all for self-describing formats", () => {
      // A clock time or a weekday needs no unit line; one would be noise costing a row of height.
      expect(resolveLegendUnit(pick("speed", { tooltip: { valueFormat: "epoch_time" } })))
        .toBeUndefined();
      expect(resolveLegendUnit(pick("speed", { tooltip: { valueFormat: "day_of_week" } })))
        .toBeUndefined();
    });

    it("falls through to the measure's unit for any other format", () => {
      expect(resolveLegendUnit(pick("speed", { tooltip: { valueFormat: "float1" } }))).toBe("mph");
      expect(resolveLegendUnit(pick("speed", { tooltip: {} }))).toBe("mph");
    });
  });
});
