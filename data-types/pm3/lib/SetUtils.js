/**
 * FORKED FROM map21 on 2026-08-14 — see
 * planning/transportny/tasks/current/pm3-fork-and-measure-implementation.md (Phase 0).
 *
 * pm3 and map21 are deliberately allowed to diverge from here: map21 is frozen for
 * calculation (federal submittal, backward compatibility), pm3 is not. Do NOT
 * "resync" this file with ../../map21/SetUtils.js — divergence is the point.
 * pm3/tests/no-map21-import.unit.test.mjs enforces that pm3 never imports map21 again.
 */
const { intersection, union, uniq, difference } = require('lodash');

// https://stackoverflow.com/a/43053803
const cartesianProductHelper = (a, b) =>
  [].concat(...a.map(d => b.map(e => [].concat(d, e))));

const cartesianProduct = (...arrs) => {
  const d = arrs.filter(arr => Array.isArray(arr) && arr.length);

  if (!d.length) {
    return [];
  }

  const [a, b, ...c] = d;

  return Array.isArray(b)
    ? cartesianProduct(cartesianProductHelper(uniq(a), uniq(b)), ...c)
    : uniq(a);
};

module.exports = {
  cartesianProduct,
  intersection,
  difference,
  union,
  uniq
};
