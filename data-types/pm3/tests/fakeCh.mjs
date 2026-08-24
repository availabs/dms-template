/**
 * A ClickHouse test double that ANSWERS the pushdown aggregates by computing them in JavaScript,
 * using the ORIGINAL pre-pushdown formulas.
 *
 * This is not a convenience shim — it is the equivalence oracle. The P-B change moved three
 * computations (percentile statistics, and the per-bin clamped excessive delay) out of JS and into
 * SQL. Re-deriving them here from the same fixture rows means any test that asserts a real number
 * is comparing the SQL's *contract* against the arithmetic it replaced. If the two ever diverge in
 * meaning, these tests fail rather than the difference showing up in a published table.
 *
 * The live SQL-vs-JS check against real ClickHouse data lives in the scratchpad verification script;
 * this covers the semantics, that one covers the estimator.
 */

// simple-statistics quantile (R type-7), the estimator the JS path used and the one
// `quantilesExactInclusive` implements. Duplicated here on purpose: a test that imports the
// implementation it is checking proves nothing.
const quantile = (arr, p) => {
  if (!arr.length) return NaN;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] * (hi - idx) + sorted[hi] * (idx - lo);
};

const precisionRound = (n, p = 0) => {
  if (n === null) return null;
  if (!Number.isFinite(+n)) return NaN;
  const f = 10 ** p;
  return Math.round(+n * f) / f;
};

// `tt || tt2` — the JS truthiness fallback, so 0 and null both fall through to the secondary stream.
const valueOf = (r, mode = 'fallback') => (mode === 'primary' ? r.tt : (r.tt ? r.tt : r.tt2));

const QUANTILE_LEVELS = [0.15, 0.5, 0.8, 0.95];

const sum = (rows, key) => rows.reduce((a, r) => a + (Number(r[key]) || 0), 0);

function statsRow(rows, mode = 'fallback') {
  // NULL travel times are skipped, matching quantilesExactInclusive. n_bins still counts every row,
  // so the published sample size is the row count either way.
  const vals = rows.map((r) => valueOf(r, mode)).filter((v) => v !== null && v !== undefined);
  return {
    // Mirrors `countIf(<value> IS NOT NULL)`: bins where THIS variant has a usable value, not bins
    // where the feed had rows. A bare row count is the all-vehicle figure for every stream.
    n_bins: vals.length,
    n_epochs: sum(rows, 'n_epochs'),
    n_epochs_density_a: sum(rows, 'n_epochs_density_a'),
    q: QUANTILE_LEVELS.map((lv) => (vals.length ? quantile(vals, lv) : null)),
  };
}

function delayGroupRows(rows, thresholds, mode = 'fallback') {
  const groups = new Map();
  for (const r of rows) {
    const key = `${r.month}|${r.dow}|${r.timeBinNum}`;
    let g = groups.get(key);
    if (!g) {
      g = { month: r.month, dow: r.dow, timeBinNum: r.timeBinNum };
      thresholds.forEach((_, i) => { g[`ed${i}`] = 0; });
      groups.set(key, g);
    }
    thresholds.forEach((e, i) => {
      // calcPhed steps 3+4, verbatim from the pre-pushdown implementation.
      const tt = precisionRound(valueOf(r, mode));
      const xds = precisionRound(tt - e);
      const xdelaySec = Math.min(xds, 60 * 15);
      const ed = Math.max(precisionRound(xdelaySec / 3600, 3), 0);
      g[`ed${i}`] += Number.isFinite(ed) ? ed : 0;
    });
  }
  return [...groups.values()];
}

/**
 * @param rows      fixture bin rows: { tt?, tt2?, month, dow, timeBinNum, n_epochs?, n_epochs_density_a? }
 * @param onQuery   optional observer, called with each SQL string (for query-count assertions)
 * @param rowsFor   optional (sql) => rows, so a test can hand DIFFERENT data to different windows.
 *                  That is how the R2 tests prove the anchored threshold really comes from the
 *                  reference window rather than merely that a window-shaped query was issued.
 */
export function makeFakeCh(defaultRows, { onQuery, rowsFor } = {}) {
  return {
    query: async (req) => {
      const sql = req.query;
      if (onQuery) onQuery(sql);
      const rows = (rowsFor && rowsFor(sql)) || defaultRows;
      // P-C batched shape: one row carrying every bin's statistics under an indexed suffix.
      // The double deliberately does NOT apply the per-bin predicates — it hands the same fixture
      // statistics to every slot. Predicate correctness is a property of the SQL against real data
      // and is verified by the live comparison against the published table, not here; what this
      // double is for is the CONTRACT (shape, key names, and that batching cannot change a value).
      const batched = sql.match(/AS n_bins_\d+_\d+/g);
      if (batched) {
        // Each quantile column names its own value expression, so the fallback variant is
        // identified by what the SQL asks for rather than by an assumed variant order:
        // `if(isNull(tt_ft) ...)` is `tt || tt2`, anything else is the primary stream alone.
        const qCols = [...sql.matchAll(/quantilesExactInclusiveIf\([^)]*\)\((.+?), \(intDiv[\s\S]*?\) AS q_(\d+)_(\d+)/g)];
        const row = {};
        for (const [, valueExpr, i, vi] of qCols) {
          const st = statsRow(rows, /if\(isNull\(/.test(valueExpr) ? 'fallback' : 'primary');
          row[`n_bins_${i}_${vi}`] = st.n_bins;
          row[`n_epochs_${i}_${vi}`] = st.n_epochs;
          row[`n_epochs_density_a_${i}_${vi}`] = st.n_epochs_density_a;
          row[`q_${i}_${vi}`] = st.q;
        }
        return { json: async () => ({ rows: 1, data: [row] }) };
      }
      if (/quantilesExactInclusive/.test(sql)) {
        return { json: async () => ({ rows: 1, data: [statsRow(rows)] }) };
      }
      // P-C batched delay shape: `sumIf(..., <bin predicate>) AS ed_<bin>_<threshold>`. As with the
      // batched statistics, the double ignores the predicates and gives every bin the same fixture
      // total — it is checking the shape and the threshold mapping, not the windowing.
      const batchedDelay = [...sql.matchAll(/sumIf\((.+?), \(intDiv[\s\S]*?\) AS (ed_\d+_\d+_\d+) \/\* threshold_tt=([-\d.eE+]+) \*\//g)];
      if (batchedDelay.length) {
        const uniq = [...new Set(batchedDelay.map((m) => Number(m[3])))];
        const byMode = { primary: delayGroupRows(rows, uniq, 'primary'),
                         fallback: delayGroupRows(rows, uniq, 'fallback') };
        const keys = byMode.primary.map((g) => `${g.month}|${g.dow}|${g.timeBinNum}`);
        const data = keys.map((k, gi) => {
          const o = { month: byMode.primary[gi].month, dow: byMode.primary[gi].dow,
                      timeBinNum: byMode.primary[gi].timeBinNum };
          for (const [, expr, col, thr] of batchedDelay) {
            const mode = /if\(isNull\(/.test(expr) ? 'fallback' : 'primary';
            o[col] = byMode[mode][gi][`ed${uniq.indexOf(Number(thr))}`];
          }
          return o;
        });
        return { json: async () => ({ rows: data.length, data }) };
      }
      const echoed = sql.match(/threshold_tt=([-\d.eE+]+)/g);
      if (echoed) {
        const thresholds = echoed.map((m) => Number(m.split('=')[1]));
        const data = delayGroupRows(rows, thresholds);
        return { json: async () => ({ rows: data.length, data }) };
      }
      return { json: async () => ({ rows: rows.length, data: rows }) };
    },
  };
}

export { quantile, statsRow, delayGroupRows, QUANTILE_LEVELS };
