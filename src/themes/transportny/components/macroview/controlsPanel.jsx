import React from "react";
import { get, set } from "lodash-es";
import { ThemeContext, getComponentTheme } from "../../../../dms/packages/dms/src/ui/useTheme";
import { damaMapTheme } from "../../../../dms/packages/dms/src/patterns/page/components/sections/components/ComponentRegistry/map/map.theme";
import { macroviewTheme } from "./macroview.theme";
import { MEASURE_GROUPS, MEASURES, availableMeasures } from "./measures";
import { GEOM_FAMILIES, singleYearViewsNewestFirst } from "./constants";

// ── PANEL 1 · CONTROLS (top-left) ──────────────────────────────────────────────
// Order is load-bearing (Alex, 2026-07-31): the always-on context first — Geography →
// View → Year — then the MEASURE GROUP, a single tinted block holding the measure select
// AND its dependent controls, so picking a measure and tuning it happen in one place.
// TMC/Conflation is gone (TMC only for now).
//
// This is deliberately NOT the shared ExternalPluginPanel descriptor: that surface
// hard-codes a 340px box with `w-24` grey labels and cannot express the grouping, the
// 320px shell, the white header or the segmented/chip controls the design is built on.
// The plugin's `comp` is real JSX, so the panel lives here and `externalPanel` returns []
// (see externalPanel.jsx).

const ORDERED = (measureFilters) =>
  Object.keys(measureFilters)
    .filter((k) => k !== "measure" && measureFilters[k]?.active)
    .sort((a, b) => (measureFilters[a].order ?? 99) - (measureFilters[b].order ?? 99));

// peak period and traffic type are drawn as chip rows; everything else is a segmented
// control (exactly two options) or a dropdown.
const PILL_CONTROLS = ["peakSelector", "trafficType"];

// The design's control labels (npmrds-macro.html § 02) are shorter and plainer than the
// internal filter `name`s — "Peak period", not "Peak Selector"; "Threshold", not
// "Threshold Speed". The mockup's copy wins; the filter keys stay untouched.
const CONTROL_LABELS = {
  peakSelector: "Peak period",
  trafficType: "Traffic type",
  freeflow: "Threshold",
  vehicleHours: "Unit",
  percentiles: "Percentile",
  fueltype: "Fuel type",
  pollutant: "Pollutant",
  attributes: "Attribute",
};
const labelFor = (key, filter) => CONTROL_LABELS[key] || filter?.name || key;

export const ControlsPanel = ({ pluginDataPath, setState, pluginData, yearLabel }) => {
  const { UI, theme: themeFromContext = {} } = React.useContext(ThemeContext) || {};
  const { Icon } = UI || {};
  const t = { ...macroviewTheme, ...getComponentTheme(themeFromContext, "macroview") };
  const mapT = {
    ...damaMapTheme.layerLibrary,
    ...getComponentTheme(themeFromContext, "damaMap.layerLibrary"),
  };

  const [collapsed, setCollapsed] = React.useState(false);
  const [open, setOpen] = React.useState("");
  const [geoTerm, setGeoTerm] = React.useState("");

  const geography = get(pluginData, ["geography"], []) || [];
  const geomControlOptions = get(pluginData, ["geomControlOptions"], []) || [];
  // Newest year first, matching dataUpdate's default pick — see singleYearViewsNewestFirst.
  const views = singleYearViewsNewestFirst(get(pluginData, ["views"], []) || []);
  const viewId = get(pluginData, ["viewId"], null);
  const measureFilters = get(pluginData, ["measureFilters"], {}) || {};
  const measureKey = get(measureFilters, ["measure", "value"], "lottr");
  const record = MEASURES[measureKey];

  const write = (path, value) => setState((draft) => set(draft, `${pluginDataPath}${path}`, value));
  const setFilter = (key, value) => write(`['measureFilters']['${key}'].value`, value);
  const toggleOpen = (key) => setOpen((cur) => (cur === key ? "" : key));

  const toggleGeography = (option) => {
    const on = geography.some((g) => g.value === option.value && g.type === option.type);
    write(
      `['geography']`,
      on
        ? geography.filter((g) => !(g.value === option.value && g.type === option.type))
        : [...geography, option]
    );
  };

  const geoMatches = geomControlOptions.filter((o) =>
    geoTerm.trim().length ? (o.name || "").toLowerCase().includes(geoTerm.trim().toLowerCase()) : true
  );
  // Grouped by family, smallest family first (GEOM_FAMILIES), and NOT capped: the old
  // `geoMatches.slice(0, 60)` over a counties-first array meant New York's 62+ counties
  // used up every row, so an MPO / urban area / region could not be reached without
  // searching (Alex, 2026-08-17). A cap that can hide a whole family is worse than a
  // scroll, and the list is ~120 rows total. Search filters inside the same grouping,
  // so a term that only matches MPOs shows just the MPO group.
  const geoGroups = GEOM_FAMILIES.map((family) => ({
    ...family,
    options: geoMatches.filter((o) => o.type === family.type),
  })).filter((group) => group.options.length);

  const menuMeasures = availableMeasures();
  const dependent = ORDERED(measureFilters);
  const pills = dependent.filter((k) => PILL_CONTROLS.includes(k));
  const others = dependent.filter((k) => !PILL_CONTROLS.includes(k));

  const renderPills = (key) => {
    const f = measureFilters[key];
    return (
      <div key={key}>
        <div className={t.label}>{labelFor(key, f)}</div>
        <div className={t.pillRow}>
          {(f.domain || []).map((o) => (
            <button
              key={String(o.value)}
              type="button"
              data-mv="control-pill"
              data-mv-control={key}
              data-mv-value={String(o.value)}
              data-mv-on={String(o.value) === String(f.value) ? "1" : "0"}
              className={String(o.value) === String(f.value) ? t.pillActive : t.pill}
              onClick={() => setFilter(key, o.value)}
            >
              {o.name}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderOther = (key) => {
    const f = measureFilters[key];
    // the percentile domain carries a blank first option that composes to a column name
    // no source has — drop it rather than offer a selection that draws nothing.
    const domain = (f.domain || []).filter((o) => o.name !== "" && o.value !== "");
    if (domain.length === 2) {
      return (
        <div key={key}>
          <div className={t.label}>{labelFor(key, f)}</div>
          <div className={t.segment2}>
            {domain.map((o, i) => (
              <button
                key={String(o.value)}
                type="button"
                className={
                  String(o.value) === String(f.value)
                    ? t.segmentBtnActive
                    : i === 0
                      ? t.segmentBtnFirst
                      : t.segmentBtn
                }
                onClick={() => setFilter(key, o.value)}
              >
                {o.name}
              </button>
            ))}
          </div>
        </div>
      );
    }
    const active = domain.find((o) => String(o.value) === String(f.value));
    return (
      <div key={key}>
        <div className={t.label}>{labelFor(key, f)}</div>
        <button type="button" className={t.selectBtn} onClick={() => toggleOpen(key)}>
          <span className={t.selectValue}>{active?.name || "—"}</span>
          <Icon icon={open === key ? "CaretUp" : "CaretDown"} className={t.selectCaret} />
        </button>
        {open === key ? (
          <div className={t.menu}>
            {domain.map((o) => (
              <button
                key={String(o.value)}
                type="button"
                className={String(o.value) === String(f.value) ? t.menuRowActive : t.menuRow}
                onClick={() => {
                  setFilter(key, o.value);
                  setOpen("");
                }}
              >
                <span
                  className={
                    String(o.value) === String(f.value) ? t.menuRowLabelActive : t.menuRowLabel
                  }
                >
                  {o.name}
                </span>
                {String(o.value) === String(f.value) ? (
                  <Icon icon="Check" className={t.menuRowCheck} />
                ) : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className={`${t.posTopLeft} ${mapT.panel}`}>
      <div className={mapT.panelInner}>
        <div className={mapT.header}>
          <span className={mapT.headerTitle}>Macro View</span>
          {yearLabel ? <span className={mapT.headerCount}>{yearLabel}</span> : null}
          <button
            type="button"
            className={mapT.headerCollapseBtn}
            title={collapsed ? "Expand controls" : "Collapse controls"}
            onClick={() => setCollapsed((c) => !c)}
          >
            <Icon icon={collapsed ? "CaretDown" : "CaretUp"} className={mapT.headerCollapseIcon} />
          </button>
        </div>

        {collapsed ? null : (
          <div className={mapT.body}>
            {/* always-on context */}
            <div className={t.ctxBlock}>
              <div>
                <div className={t.label}>Geography</div>
                <div className={t.chipField} onClick={() => toggleOpen("geography")}>
                  {geography.map((g) => (
                    <span
                      key={`${g.type}-${g.value}`}
                      className={t.chip}
                      data-mv="geo-chip"
                      data-mv-type={g.type}
                      data-mv-value={g.value}
                    >
                      {g.name}
                      <span
                        className={t.chipRemove}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleGeography(g);
                        }}
                      >
                        <Icon icon="XMark" className={t.chipRemoveIcon} />
                      </span>
                    </span>
                  ))}
                  <span className={t.chipPlaceholder}>
                    {geography.length ? "add another…" : "add a region, county or MPO…"}
                  </span>
                </div>
                {open === "geography" ? (
                  <div className={t.menu}>
                    <div className={mapT.searchWrapper}>
                      <div className={t.searchField}>
                        <Icon icon="Search" className={t.searchIcon} />
                        <input
                          className={`${mapT.searchInput} ${t.searchInputIndent}`}
                          placeholder="filter geographies…"
                          value={geoTerm}
                          onChange={(e) => setGeoTerm(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className={t.geoResults} data-mv="geo-results">
                      {geoGroups.length ? (
                        geoGroups.map((group) => (
                          <React.Fragment key={group.type}>
                            <div className={t.geoGroupLabel} data-mv="geo-group">
                              <span>{group.label}</span>
                              <span className={t.geoGroupCount}>{group.options.length}</span>
                            </div>
                            {group.options.map((o) => {
                              const on = geography.some(
                                (g) => g.value === o.value && g.type === o.type
                              );
                              return (
                                <button
                                  key={`${o.type}-${o.value}`}
                                  type="button"
                                  data-mv={`geo-row-${o.type}`}
                                  className={on ? t.menuRowActive : t.menuRow}
                                  onClick={() => toggleGeography(o)}
                                >
                                  <span className={on ? t.menuRowLabelActive : t.menuRowLabel}>
                                    {o.name}
                                  </span>
                                  {on ? <Icon icon="Check" className={t.menuRowCheck} /> : null}
                                </button>
                              );
                            })}
                          </React.Fragment>
                        ))
                      ) : (
                        <div className={t.searchEmpty}>no match</div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>

              {/* VIEW MODE · Single year is the resting mode and the only mode that
                  exists today. "Compare years" ships disabled rather than drawn-and-dead
                  (Alex, 2026-08-12) — there is no second-year select at all, so the panel
                  cannot imply a comparison it can't perform. */}
              <div>
                <div className={t.label}>View</div>
                <div className={t.segment2}>
                  <button type="button" className={t.segmentBtnActiveFirst}>
                    Single year
                  </button>
                  <button
                    type="button"
                    className={t.segmentBtnPlanned}
                    disabled
                    title="Compare years is planned — not built yet"
                  >
                    Compare years
                  </button>
                </div>
              </div>

              <div>
                <div className={t.label}>Year</div>
                <button type="button" className={t.selectBtn} onClick={() => toggleOpen("year")}>
                  <span className={t.selectValueNum}>{yearLabel || "—"}</span>
                  <Icon icon={open === "year" ? "CaretUp" : "CaretDown"} className={t.selectCaret} />
                </button>
                {open === "year" ? (
                  <div className={t.menu}>
                    {views.map((v) => (
                      <button
                        key={String(v.value)}
                        type="button"
                        className={String(v.value) === String(viewId) ? t.menuRowActive : t.menuRow}
                        onClick={() => {
                          write(`['viewId']`, v.value);
                          setOpen("");
                        }}
                      >
                        <span
                          className={
                            String(v.value) === String(viewId)
                              ? t.menuRowLabelActive
                              : t.menuRowLabel
                          }
                        >
                          {v.label || v.name}
                        </span>
                        {String(v.value) === String(viewId) ? (
                          <Icon icon="Check" className={t.menuRowCheck} />
                        ) : null}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            {/* ══ MEASURE GROUP ══ grey (not amber): amber competed with blue-600
                selection inside a dense panel. Last block, so `border-t` only. */}
            <div className={t.groupBlock}>
              <div className={t.groupLabel}>Measure</div>
              <button type="button" className={t.measureBtn} onClick={() => toggleOpen("measure")}>
                <span className={t.measureBtnLabel}>{record?.selectLabel || measureKey}</span>
                <Icon
                  icon={open === "measure" ? "CaretUp" : "CaretDown"}
                  className={t.measureBtnCaret}
                />
              </button>
              {open === "measure" ? (
                <div className={t.menu}>
                  {MEASURE_GROUPS.map((g) => {
                    const rows = menuMeasures.filter((m) => m.group === g.key);
                    if (!rows.length) return null;
                    return (
                      <React.Fragment key={g.key}>
                        <div className={t.menuGroupLabel}>{g.label}</div>
                        {rows.map((m) => (
                          <button
                            key={m.key}
                            type="button"
                            className={m.key === measureKey ? t.menuRowActive : t.menuRow}
                            onClick={() => {
                              setFilter("measure", m.key);
                              setOpen("");
                            }}
                          >
                            <span
                              className={
                                m.key === measureKey ? t.menuRowLabelActive : t.menuRowLabel
                              }
                            >
                              {m.menuLabel}
                            </span>
                            <span className={t.menuRowUnit}>{m.menuUnit}</span>
                            {m.key === measureKey ? (
                              <Icon icon="Check" className={t.menuRowCheck} />
                            ) : null}
                          </button>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </div>
              ) : null}

              {/* the measure's OWN controls, inside the same tint */}
              <div className={t.groupDivider}>
                <div className={t.groupHead}>
                  <span className={t.groupHeadLabel}>for {record?.abbr || measureKey}</span>
                  <span className={t.groupHeadRule} />
                  <span className={t.groupHeadCount}>
                    {dependent.length} {dependent.length === 1 ? "control" : "controls"}
                  </span>
                </div>
                <div className={t.subControls}>
                  {others.length ? (
                    <div className={others.length === 1 ? "" : t.grid2}>
                      {others.map(renderOther)}
                    </div>
                  ) : null}
                  {pills.map(renderPills)}
                </div>
                {/* the mockup carries this note on the reliability measures only — they
                    are the pair a reader most expects a truck/all toggle on. */}
                {!measureFilters.trafficType?.active &&
                (measureKey === "lottr" || measureKey === "tttr") ? (
                  <p className={t.groupNote}>
                    No traffic type here — reliability is reported for all vehicles.
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
