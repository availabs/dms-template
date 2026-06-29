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
