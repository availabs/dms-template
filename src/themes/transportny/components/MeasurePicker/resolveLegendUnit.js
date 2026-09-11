/**
 * `resolveLegendUnit(display)` — the DEFAULT text for a graph legend's title slot.
 *
 * The library renders a legend title but deliberately knows nothing about what any site's
 * numbers mean. `graph_new/index.jsx` calls an OPTIONAL, theme-supplied resolver:
 *
 *     display.legend.title  ??  contextTheme.avlGraph.resolveLegendUnit(display)
 *
 * so an author-set title always wins and every other site is unaffected (no resolver, no title).
 *
 * WHY IT LIVES HERE. The measure a section is bound to is recorded in `display._measurePick`,
 * a field written and read only by the npmrds report tooling. Reading it inside `@availabs/dms`
 * would put site vocabulary in a library every other project shares, so the library instead hands
 * over the whole `display`, and this function — sitting next to `_measurePick`'s own writer
 * (`applyMeasurePickToState`) and beside the vocabulary that defines the units — owns the shape it
 * reads. Nothing about npmrds crosses the boundary.
 *
 * WHY UNITS, NOT PER-TICK SUFFIXES. Appending a unit to every tick is not free: the legend
 * budgets tick-label text against the ramp's width, so " mph" on five ticks needs ~315px of a
 * 250px ramp and silently drops the legend from 5 tick marks to 3 — the unit would be paid for in
 * resolution, and worst exactly where the legend is already tightest. One line above the ramp says
 * it once and costs no tick width. See Legend.jsx's LegendTitle.
 *
 * NO REGENERATION. Existing sections already store `_measurePick.measure`, so every report that
 * has ever been built picks its unit up on next render. That constraint is what ruled out the
 * alternative of minting per-measure format names, which would have required rebuilding all 367
 * sections.
 */
import vocab from './vocabulary.json';

// `travelTime` renders through the `duration_mmss` format, which prints "22:45" — minutes AND
// seconds. Labelling that column "min" would be wrong about what the reader is looking at, so
// the format gets the last word over the measure's nominal unit.
const UNIT_BY_VALUE_FORMAT = {
  duration_mmss: 'mm:ss',
  epoch_time: null,   // a clock time is self-describing; a unit line would be noise
  day_of_week: null,
};

export function resolveLegendUnit(display) {
  const measureKey = display?._measurePick?.measure;
  if (!measureKey) return undefined;

  const valueFormat = display?.tooltip?.valueFormat;
  if (valueFormat && Object.prototype.hasOwnProperty.call(UNIT_BY_VALUE_FORMAT, valueFormat)) {
    return UNIT_BY_VALUE_FORMAT[valueFormat] || undefined;
  }

  return vocab?.measures?.[measureKey]?.units || undefined;
}

export default resolveLegendUnit;
