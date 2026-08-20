import React from "react";
import { ThemeContext, getComponentTheme } from "../../../../dms/packages/dms/src/ui/useTheme";
import { macroviewTheme } from "./macroview.theme";

// ── THE DOWNLOAD BUILDER (§ 04's "download builder open" state) ─────────────────
// Replaces the inline-styled 909-line-legacy modal: the old version positioned itself
// with a raw style object (`position:fixed; left:-55vw; width:50vw; height:60vh;
// opacity:.9`) and shipped three column lists. This is the design's builder — scope with
// row counts · format · include geometry · the exact column set you'll get · one submit
// that names the row count and the format.
//
// The escalation logged in the design set stands: the Map section ships no export-builder
// chrome, so this belongs to the plugin. No core change was needed.
//
// HONEST GAPS (backported into the mockup 2026-08-12):
//   · `json` is drawn but disabled — the create-download endpoint takes `fileTypes` and
//     the pipeline emits CSV/GPKG; nothing produces JSON today.
//   · The mockup's third scope ("Region 8, all measures") is a per-geography, all-measure
//     export. The endpoint takes ONE geography filter and an explicit column list, so the
//     two honest scopes are "current filters" and "statewide" — the geography is already
//     part of "current filters".

const META_COLUMNS = [
  "ogc_fid", "tmc", "urban_code", "region_code", "county",
  "ua_name", "mpo_code", "mpo_name", "wkb_geometry", "year",
];

export const DownloadBuilder = ({
  open,
  onClose,
  fileType,
  setFileType,
  scope,
  setScope,
  columns,
  toggleColumn,
  sourceDataColumns,
  measureColumn,
  filteredCount,
  totalCount,
  geography,
  yearLabel,
  fmtCount,
  loading,
  existingUrl,
  onSubmit,
}) => {
  const { UI, theme: themeFromContext = {} } = React.useContext(ThemeContext) || {};
  const { Icon } = UI || {};
  const t = { ...macroviewTheme, ...getComponentTheme(themeFromContext, "macroview") };
  const [picking, setPicking] = React.useState("");

  if (!open) return null;

  const geoLabel = geography?.length
    ? geography.map((g) => g.name).join(", ")
    : "no geography filter";
  const rows = scope === "statewide" ? totalCount : filteredCount;
  const withGeometry = columns.includes("wkb_geometry");
  const addable = (sourceDataColumns || [])
    .filter((c) => (picking === "meta" ? META_COLUMNS.includes(c.name) : !META_COLUMNS.includes(c.name)))
    .filter((c) => !columns.includes(c.name));

  return (
    <>
      <div className={t.builderBackdrop} onClick={onClose} />
      <div className={t.builderWrapper}>
        <div className={t.builder}>
          <div className={t.builderHead}>
            <Icon icon="Download" className={t.builderHeadIcon} />
            <span className={t.builderTitle}>Download measure data</span>
            <button type="button" className={t.builderClose} onClick={onClose}>
              <Icon icon="XMark" className={t.builderCloseIcon} />
            </button>
          </div>
          <div className={t.builderBody}>
            <div className={t.builderCol6}>
              <div className={t.builderLabel}>Scope</div>
              <div className={t.scopeList}>
                <label
                  className={scope === "current" ? t.scopeOptActive : t.scopeOpt}
                  onClick={() => setScope("current")}
                >
                  <span className={scope === "current" ? t.scopeRadioActive : t.scopeRadio}>
                    {scope === "current" ? <span className={t.scopeRadioDot} /> : null}
                  </span>
                  <span className={scope === "current" ? t.scopeLabelActive : t.scopeLabel}>
                    Current filters
                  </span>
                  <span className={scope === "current" ? t.scopeCountActive : t.scopeCount}>
                    {filteredCount != null ? `${fmtCount(filteredCount)} rows` : "—"}
                  </span>
                </label>
                <label
                  className={scope === "statewide" ? t.scopeOptActive : t.scopeOpt}
                  onClick={() => setScope("statewide")}
                >
                  <span className={scope === "statewide" ? t.scopeRadioActive : t.scopeRadio}>
                    {scope === "statewide" ? <span className={t.scopeRadioDot} /> : null}
                  </span>
                  <span className={scope === "statewide" ? t.scopeLabelActive : t.scopeLabel}>
                    Statewide, {yearLabel}
                  </span>
                  <span className={scope === "statewide" ? t.scopeCountActive : t.scopeCount}>
                    {totalCount != null ? `${fmtCount(totalCount)} rows` : "—"}
                  </span>
                </label>
              </div>
              <p className={t.scopeNote}>{geoLabel}</p>
            </div>

            <div className={t.builderCol6Stack}>
              <div>
                <div className={t.builderLabel}>Format</div>
                <div className={t.formatSeg}>
                  <button
                    type="button"
                    className={fileType === "CSV" ? t.formatBtnActive : t.formatBtnFirst}
                    onClick={() => setFileType("CSV")}
                  >
                    csv
                  </button>
                  <button
                    type="button"
                    className={fileType === "GPKG" ? t.formatBtnActive : t.formatBtn}
                    onClick={() => setFileType("GPKG")}
                  >
                    gpkg
                  </button>
                  <button
                    type="button"
                    className={t.formatBtn}
                    disabled
                    title="JSON export is not produced by the download pipeline yet"
                  >
                    json
                  </button>
                </div>
              </div>
              <div>
                <div className={t.builderLabel}>Include</div>
                <button
                  type="button"
                  className={t.includeBtn}
                  onClick={() => toggleColumn("wkb_geometry")}
                >
                  <span className={t.includeLabel}>
                    {withGeometry ? "− geometry" : "+ geometry"}
                  </span>
                  <Icon icon={withGeometry ? "Check" : "Plus"} className={t.includeCaret} />
                </button>
              </div>
            </div>

            <div className={t.builderCol12}>
              <div className={t.builderLabel}>Columns you&apos;ll get</div>
              <div className={t.colChips}>
                {columns.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={c === measureColumn ? t.colChipMeasure : t.colChip}
                    title="remove this column"
                    onClick={() => toggleColumn(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <div className={t.colPicker}>
                <button
                  type="button"
                  className={t.selectBtn}
                  onClick={() => setPicking(picking === "meta" ? "" : "meta")}
                >
                  <span className={t.selectValue}>Add metadata column</span>
                  <Icon icon={picking === "meta" ? "CaretUp" : "CaretDown"} className={t.selectCaret} />
                </button>
                <button
                  type="button"
                  className={t.selectBtn}
                  onClick={() => setPicking(picking === "measure" ? "" : "measure")}
                >
                  <span className={t.selectValue}>Add measure column</span>
                  <Icon
                    icon={picking === "measure" ? "CaretUp" : "CaretDown"}
                    className={t.selectCaret}
                  />
                </button>
              </div>
              {picking ? (
                <div className={t.menu}>
                  <div className={t.searchResults}>
                    {addable.length ? (
                      addable.slice(0, 80).map((c) => (
                        <button
                          key={c.name}
                          type="button"
                          className={t.menuRow}
                          onClick={() => toggleColumn(c.name)}
                        >
                          <span className={t.menuRowLabel}>{c.display_name || c.name}</span>
                        </button>
                      ))
                    ) : (
                      <div className={t.searchEmpty}>nothing left to add</div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <div className={t.builderFoot}>
              <button
                type="button"
                className={t.builderSubmit}
                disabled={loading || !columns.length}
                onClick={onSubmit}
              >
                <span className={t.builderSubmitLabel}>
                  {existingUrl
                    ? `Download ${rows != null ? fmtCount(rows) : ""} rows · ${fileType.toLowerCase()}`
                    : loading
                      ? "Sending request…"
                      : `Build ${rows != null ? fmtCount(rows) : ""} rows · ${fileType.toLowerCase()}`}
                </span>
              </button>
              <p className={t.builderNote}>
                Values are exactly what the map is drawing — same filters, same year, same bins.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
