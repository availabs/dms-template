import { isEqual } from "lodash-es";
import { filters as PRISTINE_FILTERS, updateSubMeasures } from "./updateFilters";
import { MEASURES } from "./measures";
import {
  URL_KEYS,
  URL_CONTROL_KEYS,
  URL_CONTROL_VALUES,
  URL_GEO_TYPES,
  URL_WORST_ON,
} from "./constants";

// ── macroview · URL STATE ────────────────────────────────────────────────────────
// Pure encode/decode for the share contract. NOTHING here touches React, falcor, the
// map or `useSearchParams` — the page owns the URL and `comp.jsx` moves values across
// that boundary through `pageState.filters` (read) and `updatePageStateFilters` (write).
// Keeping the vocabulary in one pure module is what makes it testable and what stops the
// two directions from drifting: `decodeUrlState` and `encodeUrlState` share every table.
//
// THE CONTRACT (page 2101931 registers each key in `filters`, `useSearchParams: true`):
//
//   measure  lottr · tttr · ted · phed · speed        default lottr        omitted
//   peak     amp · midd · pmp · we · ovn · all        per-measure default  omitted
//   pctl     pctl_5 … pctl_95                         pctl_5               omitted
//   thresh   freeflow · speed_limit                   speed_limit          omitted
//   unit     vehicle_hours · person_hours · hours     person_hours         omitted
//   traffic  all · truck                              all                  omitted
//   year     2025 · 2024 · 2023 · 2022 · 2021         newest view          omitted
//   geo      county:ALBANY|||region:8 (family:value)  nothing selected     omitted
//   worst    on                                       off                  omitted
//
// Two rules run through all of it:
//
//  1. ONLY NON-DEFAULT VALUES ARE WRITTEN. A pristine `/macro` must leave the URL clean
//     — and an empty page-variable value must be `[]`, never `""`: `convertToUrlParams`
//     skips an empty ARRAY but happily emits `key=` for `[""]`, which is the empty-leaf
//     bug class (`reference_dms_page_variable_empty_leaf_bug`).
//  2. UNKNOWN VALUES DEGRADE, THEY DO NOT BREAK. Every decoded value is validated against
//     the live vocabulary it belongs to (the measure select's own list, the control's
//     `domain` AFTER `updateSubMeasures` has decided what applies, the view list, the
//     fetched geography options) and silently dropped when it does not resolve. That is
//     what lets the home page point three un-computed measures at plain `/macro` and lets
//     `?measure=freeflow` (a real measure with no data) land on the default instead of an
//     empty render.
//
// WHAT COUNTS AS "DEFAULT" is not guesswork: `macroview.plugin.jsx`'s `mapRegister` runs
// `updateSubMeasures(filters)` on EVERY mount, so the effective resting state of the
// measure group is exactly the pristine filter set normalized for the measure — whatever
// the saved section happens to hold. `measureDefaults()` below reproduces that, so
// "non-default" means "different from what a fresh mount would show".

// `updateSubMeasures` is a pure function of `measure.value` (it clones its input and then
// sets every active flag and dependent value from the switch), so the per-measure resting
// state can be recomputed rather than remembered.
export const measureDefaults = (measureKey) =>
  updateSubMeasures({
    ...PRISTINE_FILTERS,
    measure: { ...PRISTINE_FILTERS.measure, value: measureKey },
  });

export const DEFAULT_MEASURE_KEY = PRISTINE_FILTERS.measure.value;

// The measure keys the select actually offers = the ones the pm3 source computes. A
// `?measure=` value outside this set is dropped, which covers both a nonsense value and
// a REAL measure the data can't draw (freeflow · emissions · attributes).
const selectableMeasures = () =>
  Object.keys(MEASURES).filter((key) => MEASURES[key].available);

// A control's URL vocabulary, derived from the control's own `domain` so it can never
// drift from what the panel renders. `null` for controls with no value mapping.
const controlValueToUrl = (controlKey, value) => {
  const map = URL_CONTROL_VALUES[controlKey];
  if (map) return map[String(value)] ?? null;
  if (value === null || value === undefined || value === "") return null;
  return String(value);
};

const controlValueFromUrl = (controlKey, control, urlValue) => {
  const map = URL_CONTROL_VALUES[controlKey];
  const domain = control?.domain || [];
  if (map) {
    const hit = Object.keys(map).find((internal) => map[internal] === urlValue);
    if (hit === undefined) return undefined;
    // The domain holds the value in its ORIGINAL type (booleans for `freeflow`), so
    // recover it from the domain rather than handing the panel a string.
    const option = domain.find((o) => String(o.value) === hit);
    return option ? option.value : undefined;
  }
  const option = domain.find((o) => String(o.value) === String(urlValue));
  return option ? option.value : undefined;
};

// ── geography ────────────────────────────────────────────────────────────────────
const GEO_TYPE_FROM_URL = Object.entries(URL_GEO_TYPES).reduce((out, [type, token]) => {
  out[token] = type;
  return out;
}, {});

export const encodeGeography = (geography) =>
  (geography || [])
    .map((g) => {
      const token = URL_GEO_TYPES[g?.type];
      if (!token || g?.value === null || g?.value === undefined || g?.value === "") return null;
      return `${token}:${String(g.value)}`;
    })
    .filter(Boolean);

// Re-derives each chip from the FETCHED option list, so `name` is always the current
// display rule's label and an unknown pair is simply dropped (a stale share link that
// names a county this view doesn't have degrades to "that chip isn't there").
export const decodeGeography = (rawValues, geomControlOptions) => {
  const options = geomControlOptions || [];
  if (!options.length) return [];
  const out = [];
  (rawValues || []).forEach((raw) => {
    String(raw)
      .split("|||")
      .forEach((pair) => {
        const text = String(pair).trim();
        if (!text) return;
        const at = text.indexOf(":");
        if (at < 1) return;
        const type = GEO_TYPE_FROM_URL[text.slice(0, at)];
        const value = text.slice(at + 1);
        if (!type || !value) return;
        const option = options.find(
          (o) => o.type === type && String(o.value) === value
        );
        if (!option) return;
        if (out.some((g) => g.type === option.type && String(g.value) === String(option.value))) return;
        out.push({ name: option.name, label: option.label, value: option.value, type: option.type });
      });
  });
  return out;
};

// ── read: pageState.filters → the state the plugin should be in ──────────────────
const firstValue = (filter) => {
  const values = filter?.values;
  if (Array.isArray(values)) return values.length ? String(values[0]) : "";
  if (values === null || values === undefined) return "";
  return String(values);
};

/**
 * Decode the page's registered variables into a desired plugin state.
 *
 * `views` and `geomControlOptions` are the LIVE vocabularies — both arrive asynchronously,
 * which is why `comp.jsx` gates reconciliation on them being present before it lets the
 * write side run (a write that fired first would erase the very params it hadn't read).
 *
 * Returns `{ measureKey, controls, viewId, geography, worst, present }` where `present` is
 * the set of keys the URL actually carried, so the caller can tell "unset" from "set to
 * the default".
 */
export const decodeUrlState = ({ pageFilters, views, geomControlOptions }) => {
  const byKey = {};
  (pageFilters || []).forEach((f) => {
    if (!f || f.type === "action" || !f.useSearchParams) return;
    byKey[f.searchKey] = f;
  });
  const present = new Set();

  // measure — validated against the SELECTABLE list, not the whole vocabulary
  let measureKey = DEFAULT_MEASURE_KEY;
  const rawMeasure = firstValue(byKey[URL_KEYS.measure]);
  if (rawMeasure && selectableMeasures().includes(rawMeasure)) {
    measureKey = rawMeasure;
    present.add(URL_KEYS.measure);
  }

  // dependent controls — the measure decides which ones apply, so normalize FIRST and
  // then accept only values that are both applicable (`active`) and in the live domain.
  const normalized = measureDefaults(measureKey);
  const controls = {};
  Object.keys(URL_CONTROL_KEYS).forEach((controlKey) => {
    const control = normalized[controlKey];
    if (!control?.active) return;
    const raw = firstValue(byKey[URL_CONTROL_KEYS[controlKey]]);
    if (!raw) return;
    const value = controlValueFromUrl(controlKey, control, raw);
    if (value === undefined) return;
    controls[controlKey] = value;
    present.add(URL_CONTROL_KEYS[controlKey]);
  });

  // year — the HUMAN year, resolved against the views this section offers. viewIds change
  // when the pm3 data is republished, so a shared link must not carry one.
  let viewId = null;
  const rawYear = firstValue(byKey[URL_KEYS.year]);
  if (rawYear) {
    const hit = (views || []).find(
      (v) => String(v.label) === rawYear || String(v.name) === rawYear
    );
    if (hit) {
      viewId = hit.value;
      present.add(URL_KEYS.year);
    }
  }

  const geoFilter = byKey[URL_KEYS.geo];
  const geoRaw = Array.isArray(geoFilter?.values)
    ? geoFilter.values
    : geoFilter?.values
      ? [geoFilter.values]
      : [];
  const geography = decodeGeography(geoRaw, geomControlOptions);
  if (geoRaw.length) present.add(URL_KEYS.geo);

  const rawWorst = firstValue(byKey[URL_KEYS.worst]).toLowerCase();
  const worst = ["on", "1", "true", "yes"].includes(rawWorst);
  if (rawWorst) present.add(URL_KEYS.worst);

  return { measureKey, controls, viewId, geography, worst, present, geoRawCount: geoRaw.length };
};

// ── write: plugin state → the page variables to hold ─────────────────────────────
/**
 * Encode the CURRENT plugin state as page-variable entries. Every contract key is always
 * present in the returned array — with `values: []` when the value is the default — so a
 * cleared control REMOVES its param instead of leaving `key=` behind: `updatePageStateFilters`
 * rebuilds the whole query string from the registry and `convertToUrlParams` skips empty
 * arrays.
 *
 * `defaultViewId` is the newest view (views[0]) rather than a remembered mount value: the
 * plugin's own state is the only viewId it can see, and a remembered one goes stale across
 * a remount — which would silently DROP a shared `year=`. Anchoring to the view list can
 * at worst make a bare page name its own year explicitly; it can never lose one.
 */
export const encodeUrlState = ({ measureFilters, geography, viewId, views, worstOpen }) => {
  const measureKey = measureFilters?.measure?.value ?? DEFAULT_MEASURE_KEY;
  const defaults = measureDefaults(measureKey);
  const entries = [];
  const push = (searchKey, values) => entries.push({ searchKey, values });

  push(URL_KEYS.measure, measureKey && measureKey !== DEFAULT_MEASURE_KEY ? [String(measureKey)] : []);

  Object.keys(URL_CONTROL_KEYS).forEach((controlKey) => {
    const searchKey = URL_CONTROL_KEYS[controlKey];
    const live = measureFilters?.[controlKey];
    const fallback = defaults[controlKey];
    // A control that does not apply to this measure never appears, whatever value is
    // parked on it (`updateSubMeasures` leaves stale values behind on inactive controls).
    if (!live?.active) return push(searchKey, []);
    if (String(live.value) === String(fallback?.value)) return push(searchKey, []);
    const encoded = controlValueToUrl(controlKey, live.value);
    return push(searchKey, encoded ? [encoded] : []);
  });

  const defaultViewId = views?.length ? views[0]?.value : null;
  const yearHit = (views || []).find((v) => String(v.value) === String(viewId));
  const isDefaultYear =
    defaultViewId === null || String(viewId) === String(defaultViewId) || !yearHit;
  push(URL_KEYS.year, isDefaultYear ? [] : [String(yearHit.label || yearHit.name)]);

  push(URL_KEYS.geo, encodeGeography(geography));
  push(URL_KEYS.worst, worstOpen ? [URL_WORST_ON] : []);

  return entries;
};

// The page variables this plugin owns that a given page has actually registered. The
// registry IS the opt-in: drop this plugin on a page with no `filters` and it simply
// stops persisting instead of navigating in a loop against a URL nobody owns.
export const registeredUrlKeys = (pageFilters) => {
  const owned = new Set(Object.values(URL_KEYS));
  return new Set(
    (pageFilters || [])
      .filter((f) => f && f.useSearchParams && owned.has(f.searchKey))
      .map((f) => f.searchKey)
  );
};

// "Never write what the page already holds" — the same idempotency check core's map does
// before calling updatePageStateFilters, so a re-render can't turn into a navigation.
export const pageAlreadyHolds = (entries, pageFilters) =>
  (entries || []).every((entry) => {
    const current = (pageFilters || []).find((f) => f.searchKey === entry.searchKey);
    const currentValues = Array.isArray(current?.values)
      ? current.values
      : current?.values === null || current?.values === undefined || current?.values === ""
        ? []
        : [current.values];
    return isEqual(currentValues.map(String), (entry.values || []).map(String));
  });
