// RouteComparison — pure helpers (no JSX, no React). Kept in a `.js` sibling so
// the component `.jsx` files stay component-only (Vite Fast-Refresh boundary —
// see dms packages/dms CLAUDE.md "Vite React Fast Refresh").

// parseTmcArray(v) -> string[]
//
// The Routes Data catalog stores each route's ordered TMC list in a `tmc_array`
// field whose ON-THE-WIRE shape is NOT guaranteed — depending on how the row was
// read it can arrive as:
//   • a real JS array            → ["120-05445", "120+05446"]
//   • a JSON-encoded string      → '["120-05445","120+05446"]'
//   • a Postgres array literal    → '{120-05445,120+05446}'  (optionally quoted elems)
//   • a bare comma-separated str → '120-05445,120+05446'
//   • null / undefined / ''      → (no TMCs)
// It must degrade to an empty array rather than throw, because a single malformed
// row must never blank the whole `route_tmcs` publish (which prunes a ~9.8B-row
// ClickHouse scan). TMC codes are identifiers (e.g. `120-05445`, `120+05446`) —
// preserve them verbatim; only trim surrounding whitespace / wrapping quotes.
export function parseTmcArray(v) {
  if (v == null) return [];

  if (Array.isArray(v)) {
    return v.map((x) => String(x).trim()).filter((x) => x.length);
  }

  if (typeof v !== 'string') return [];

  const s = v.trim();
  if (!s) return [];

  // JSON-array form: ["a","b"]
  if (s[0] === '[') {
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) {
        return parsed.map((x) => String(x).trim()).filter((x) => x.length);
      }
    } catch {
      // fall through to the Postgres-literal / CSV handling below
    }
  }

  // Postgres array-literal form: {a,b} (elements may be double-quoted)
  if (s[0] === '{' && s[s.length - 1] === '}') {
    return s
      .slice(1, -1)
      .split(',')
      .map((x) => x.trim().replace(/^"(.*)"$/, '$1').trim())
      .filter((x) => x.length);
  }

  // Bare comma-separated fallback: a,b,c
  return s.split(',').map((x) => x.trim()).filter((x) => x.length);
}

// collectRouteTmcs(routes) -> string[]
//
// Flatten + de-dupe (order-stable) the `tmc_array` of every selected route into
// the single `route_tmcs` list the sibling Spreadsheet consumes. Order-stable so
// the isEqual publish-guard in the component doesn't churn on set re-ordering.
export function collectRouteTmcs(routes) {
  const seen = new Set();
  const out = [];
  (routes || []).forEach((r) => {
    parseTmcArray(r && r.tmc_array).forEach((tmc) => {
      if (!seen.has(tmc)) {
        seen.add(tmc);
        out.push(tmc);
      }
    });
  });
  return out;
}

// Days-of-week vocabulary. `dow` is published as int[] in JS getDay() order
// (0 = Sunday … 6 = Saturday) — the SAME convention ReportRouteList's
// generateDateRange uses (DAY_NAMES indexed by Date.getDay()), so a downstream
// consumer can map these ints to day names with one shared table.
export const DOW_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export const WEEKDAYS = [1, 2, 3, 4, 5];
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

// Human summary for the collapsed "Days" scope button (mockup: "Weekdays Mon–Fri").
export function summarizeDow(dow) {
  const set = Array.isArray(dow) ? [...dow].sort((a, b) => a - b) : [];
  const key = set.join(',');
  if (key === ALL_DAYS.join(',')) return 'All days';
  if (key === WEEKDAYS.join(',')) return 'Weekdays';
  if (key === '0,6') return 'Weekends';
  if (!set.length) return 'No days';
  return 'Custom';
}
