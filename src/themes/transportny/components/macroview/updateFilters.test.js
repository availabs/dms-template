/**
 * macroview → pm3 column contract.
 *
 * The plugin names its data column by STRING CONSTRUCTION (`getMeasure()`), and reads tiles and the
 * colour domain straight off the relation. So a measure the UI can express but the view lacks does
 * not throw — it renders a blank map, silently. The runner has a registry-wide invariant guarding the
 * other direction (every column a calculator writes is declared); this is the mirror.
 *
 * The authority here is the runner's own declared column list, imported rather than restated: if the
 * UI can build a name pm3 does not publish, that is a bug wherever it is introduced, and it should
 * fail in CI rather than in front of a planner.
 */
import { describe, it, expect } from "vitest";
import { createRequire } from "module";
import { filters, updateSubMeasures, getMeasure } from "./updateFilters";
import { availableMeasures } from "./measures";
import { singleYearViewsNewestFirst } from "./constants";

const require = createRequire(import.meta.url);
const worker = require("../../../../../data-types/pm3/worker.js");

const declared = new Set(
  worker.buildPm3SourceColumns(worker.buildMetricConfigs({ chMetaTableName: "x.y" }))
    .map((c) => c.name)
);

// The reference tokens the Threshold Speed control offers, taken from the control itself so the two
// cannot drift. "" is the posted-speed-limit family, whose columns carry no reference suffix.
const REFERENCE_TOKENS = filters.freeflow.domain.map((d) => d.value);

describe("Threshold Speed control", () => {
  it("offers all four references pm3 computes, defaulting to the recommended one", () => {
    expect(REFERENCE_TOKENS).toEqual(
      expect.arrayContaining(["", "freeflow", "freeflow_anchored", "freeflow_relative"])
    );
    // PROVENANCE.md section 9: the fixed reference is the default; the own-year one is deprecated in
    // guidance and must never be what a fresh map lands on.
    expect(filters.freeflow.value).toBe("freeflow_anchored");
  });

  it("gives every option help text — the guidance has to reach the dropdown", () => {
    for (const d of filters.freeflow.domain) {
      expect(d.help, `${d.name} has no help text`).toBeTruthy();
      expect(d.help.length).toBeGreaterThan(40);
    }
  });
});

describe("tttr_p80 and coverage name real columns", () => {
  it("tttr_p80 follows the <metric>_<bin>_<metric> shape pm3 publishes", () => {
    const cols = ["amp", "midd", "pmp", "we", "ovn"].map((p) => `tttr_p80_${p}_tttr_p80`);
    expect(cols.filter((c) => !declared.has(c))).toEqual([]);
  });

  it("coverage names both streams x both bases x every bin the stream HAS", () => {
    // The asymmetry is load-bearing: pm3's COVERAGE_BINS gives the truck stream an overnight bin and
    // the all-vehicle stream none, so a UI offering Overnight for all-vehicles would name a column
    // that does not exist and render a blank map.
    const cols = [];
    for (const [stream, bins] of [
      ["all_vehicles", ["amp", "midd", "pmp", "alt_pmp", "we", "all"]],
      ["freight_trucks", ["amp", "midd", "pmp", "alt_pmp", "we", "ovn", "all"]],
    ]) {
      for (const bin of bins) {
        for (const basis of ["bins", "epochs"]) {
          cols.push(`coverage_${stream}_${bin}_pct_${basis}_reporting`);
        }
      }
    }
    expect(cols.filter((c) => !declared.has(c))).toEqual([]);
    expect(cols.length).toBe(26); // every coverage column pm3 publishes
  });

  it("all_vehicles has NO overnight coverage column — the asymmetry is real, not an oversight", () => {
    expect(declared.has("coverage_freight_trucks_ovn_pct_bins_reporting")).toBe(true);
    expect(declared.has("coverage_all_vehicles_ovn_pct_bins_reporting")).toBe(false);
  });
});

describe("every delay column the UI can construct is published by pm3", () => {
  // Mirrors getMeasure()'s phed/ted branches: measure [_truck] [_reference] [_peak] _unit.
  // ted has a single ALL bin, so it takes no peak segment.
  const constructible = [];
  for (const measure of ["phed", "ted"]) {
    for (const truck of ["", "truck"]) {
      for (const ref of REFERENCE_TOKENS) {
        const peaks = measure === "phed" ? ["", "amp", "pmp"] : [""];
        for (const peak of peaks) {
          for (const unit of ["all_xdelay_phrs", "all_xdelay_vhrs", "xdelay_hrs"]) {
            constructible.push([measure, truck, ref, peak, unit].filter(Boolean).join("_"));
          }
        }
      }
    }
  }

  it("covers the full cross-product with no gaps", () => {
    const missing = [...new Set(constructible)].filter((c) => !declared.has(c));
    expect(missing).toEqual([]);
  });

  it("is a non-trivial set — a broken builder must not pass vacuously", () => {
    // 2 measures x 2 streams x 4 references x (3 peaks | 1) x 3 units
    expect(new Set(constructible).size).toBe(96);
  });
});

describe("the Year control offers single-year views only, newest first", () => {
  // Source 2135 carries nine per-year views plus a union view whose version is "all_years",
  // published for cross-year SQL analysis. The macroview is built for one view per year and
  // deliberately does not support multi-year views, so the union must not appear in a year picker.
  const VIEWS = [
    { version: "2017", value: 3732 },
    { version: "all_years", value: 3741 },
    { version: "2025", value: 3740 },
    { version: "2021", value: 3736 },
  ];

  it("drops non-year versions rather than sorting them last", () => {
    expect(singleYearViewsNewestFirst(VIEWS).map((v) => v.version)).toEqual(["2025", "2021", "2017"]);
  });

  it("defaults to the most recent year", () => {
    expect(singleYearViewsNewestFirst(VIEWS)[0].version).toBe("2025");
  });

  it("would have defaulted to all_years under a plain string sort — the trap this avoids", () => {
    // "all_years" > "2025" lexically, so a naive descending sort puts the union first and it
    // silently becomes the default year.
    const naive = [...VIEWS].sort((a, b) => String(b.version).localeCompare(String(a.version)));
    expect(naive[0].version).toBe("all_years");
    expect(singleYearViewsNewestFirst(VIEWS)[0].version).not.toBe("all_years");
  });

  it("reads version, label or name, and survives empty input", () => {
    expect(singleYearViewsNewestFirst([{ label: "2019" }, { name: "2024" }]).map((v) => v.label ?? v.name))
      .toEqual(["2024", "2019"]);
    expect(singleYearViewsNewestFirst([])).toEqual([]);
    expect(singleYearViewsNewestFirst(null)).toEqual([]);
    // A source with only multi-year views yields nothing — dataUpdate guards on that rather than
    // reaching for [0].value inside a setState draft.
    expect(singleYearViewsNewestFirst([{ version: "all_years" }])).toEqual([]);
  });
});

describe("persisted filter state from older saved sections", () => {
  // Regression tests for a live crash. `updateSubMeasures` and `getMeasure` are both called with
  // `pluginData.measureFilters` — state saved into a map section, possibly months ago — not with the
  // `filters` export. Neither had a test that passed anything other than the current shape, so
  // adding a filter key and changing another's type broke a rendered map, not the suite.
  const legacy = (overrides = {}) => {
    const f = JSON.parse(JSON.stringify(filters));
    delete f.coverageBasis;          // added after those sections were saved
    f.freeflow = { ...f.freeflow, value: false, domain: [ // the old boolean control
      { name: "Freeflow", value: true }, { name: "Speed Limit", value: false }] };
    return { ...f, ...overrides };
  };

  it("does not throw when a filter key postdates the saved section", () => {
    // The actual reported error: TypeError: Cannot set properties of undefined (setting 'active')
    expect(() => updateSubMeasures(legacy())).not.toThrow();
    expect(() => getMeasure(legacy())).not.toThrow();
  });

  it("backfills the missing key rather than leaving it undefined", () => {
    expect(updateSubMeasures(legacy()).coverageBasis).toBeTruthy();
  });

  it("resets the threshold to the default token when the measure changes", () => {
    // Pre-existing behaviour, not new: updateSubMeasures always reset this control (it used to reset
    // to boolean `false`). What changed is the reset VALUE — it must be the default token, because
    // resetting to "" would silently land every delay map on the posted-speed-limit family.
    const on = legacy({ freeflow: { ...filters.freeflow, value: true } });
    expect(updateSubMeasures(on).freeflow.value).toBe("freeflow_anchored");
  });

  it("getMeasure migrates a saved boolean to the OWN-YEAR token, not the recommended one", () => {
    // getMeasure runs on every render, BEFORE updateSubMeasures has reset anything, so this is where
    // a persisted boolean is actually dangerous. Faithfulness beats recommendation: `true` meant
    // "Freeflow" when saved, which is `*_freeflow_*`. Upgrading it to the anchored reference would
    // change the author's numbers — and source 1410's views have no anchored columns at all.
    const col = getMeasure(legacy({
      freeflow: { ...filters.freeflow, value: true },
      measure: { ...filters.measure, value: "ted" },
      vehicleHours: { ...filters.vehicleHours, value: "all_xdelay_phrs", active: true },
    }));
    expect(col).toBe("ted_freeflow_all_xdelay_phrs");
  });

  it("a saved boolean never reaches the column builder as a token", () => {
    // The silent version of the bug: `true` would have produced `phed_true_all_xdelay_phrs`.
    const f = legacy({
      freeflow: { ...filters.freeflow, value: true },
      measure: { ...filters.measure, value: "phed" },
    });
    const col = getMeasure(f);
    expect(col).not.toMatch(/_true_|_false_/);
    expect(col.startsWith("phed")).toBe(true);
  });

  it("refreshes the stale two-option Freeflow domain to the four references", () => {
    expect(legacy().freeflow.domain).toHaveLength(2);
    expect(updateSubMeasures(legacy()).freeflow.domain.map((d) => d.value))
      .toEqual(expect.arrayContaining(["", "freeflow", "freeflow_anchored", "freeflow_relative"]));
  });
});

describe("every available measure's DEFAULT column actually exists", () => {
  // The test that was missing. The suite already checked that the delay cross-product's column NAMES
  // exist, but never ran the CONTROL FLOW that picks a peak — so `tttr_p80` shipped with a case in
  // getMeasure and no case in the peak-domain switch. peakSelector.domain stayed empty, the fallback
  // reset the value to NO_PEAK_KEY, getMeasure omitted the bin segment, and the map asked for
  // `tttr_p80_tttr_p80`. Every tttr_p80 column is peak-scoped, so that column does not exist: a blank
  // map for every year, no error anywhere.
  //
  // This walks each measure the way the UI does — set the measure, let updateSubMeasures establish
  // the controls, then ask getMeasure for the column — and requires the answer to be a real column.
  const AVAILABLE = availableMeasures().map((m) => m.key);

  it("covers every measure offered in the select", () => {
    expect(AVAILABLE).toEqual(
      expect.arrayContaining(["lottr", "tttr", "tttr_p80", "ted", "phed", "speed", "coverage"])
    );
  });

  for (const key of ["lottr", "tttr", "tttr_p80", "ted", "phed", "speed", "coverage"]) {
    it(`${key}: the default column is published by pm3`, () => {
      const seeded = JSON.parse(JSON.stringify(filters));
      seeded.measure.value = key;
      const settled = updateSubMeasures(seeded);
      const col = getMeasure(settled);
      expect(col, `${key} produced an empty column name`).toBeTruthy();
      expect(declared.has(col), `${key} builds "${col}", which pm3 does not publish`).toBe(true);
    });
  }

  it("and the peak selector is populated wherever the columns are peak-scoped", () => {
    // The structural version of the same bug: a measure whose columns carry a bin segment must offer
    // a bin to choose, or the default lands on a name that was never published.
    for (const key of ["lottr", "tttr", "tttr_p80", "coverage"]) {
      const seeded = JSON.parse(JSON.stringify(filters));
      seeded.measure.value = key;
      const settled = updateSubMeasures(seeded);
      expect(settled.peakSelector.domain.length, `${key} has an empty peak domain`).toBeGreaterThan(0);
      expect(settled.peakSelector.domain.some((d) => d.value === settled.peakSelector.value),
        `${key}'s peak value is not in its own domain`).toBe(true);
    }
  });
});
