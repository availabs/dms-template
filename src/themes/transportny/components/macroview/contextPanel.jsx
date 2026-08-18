import React from "react";
import { ThemeContext, getComponentTheme } from "../../../../dms/packages/dms/src/ui/useTheme";
import { damaMapTheme } from "../../../../dms/packages/dms/src/patterns/page/components/sections/components/ComponentRegistry/map/map.theme";
import { macroviewTheme } from "./macroview.theme";

// ── PANEL 2 · MEASURE CONTEXT + INSPECT (top-right) ────────────────────────────
// Three blocks:
//   1. what the measure IS — name · definition · unit · reliable-when · equation, all
//      from ONE record in measures.js (the same record renders § 01 below the fold).
//   2. THE SCALE — a HORIZONTAL legend of the drawn bins with the VALUE DISTRIBUTION
//      directly beneath it, sharing one x scale, then median / 80th pctl / % beyond
//      threshold. The design-set escalated the histogram against the Map section; it
//      lands here instead because this plugin already side-queries UDA (stats.js).
//      Rewritten 2026-08-17 (Alex): the legend used to be SEVEN VERTICAL ROWS of
//      `swatch · range · count` sitting BELOW the histogram, so nothing lined up and the
//      counts restated what the bars already show. Now: legend on top, one ramp, no
//      counts, and bin edge i is at exactly i/n of the same width in the legend strip,
//      the tick row and the bars. The bin count, the breaks and the colours all come
//      from ONE place (comp.jsx → `drawn` → `legend`) — never a literal 7 and never a
//      hard-coded ramp — and since 2026-08-18 that place is the AUTHORED break table
//      (breaks.js) rather than a per-view ckmeans query, so "author-set breaks" is
//      literally true and the numbers do not move when the year does. Two consequences
//      visible in this file: the top bin can be open-ended (`b.to == null`), and the
//      histogram's bars count only rows that HAVE a value — the no-data rows the map
//      paints grey are stated, never binned.
//   3. GET TO A SEGMENT — search + the worst-N list, grouped because both end at a
//      segment. Search lives here, not in the controls panel, because it SELECTS; it does
//      not filter what the map draws. Opening the worst-N list ALSO turns on a point
//      overlay on the canvas (comp.jsx → worstPoints.js) drawn from the very rows listed
//      here — same query, same 25 segments, each point coloured by its legend bin.
//      A third row, "TRANSCOM events on these segments · not connected", was removed
//      2026-08-17 — see the note at the end of the block.

export const ContextPanel = ({
  record,
  measureColumn,
  legend,
  breaksCaption,
  binCounts,
  noDataCount,
  stats,
  drawnCount,
  fmt,
  fmtCount,
  searchTerm,
  setSearchTerm,
  searchResults,
  onSelectSegment,
  worst,
  worstOpen,
  setWorstOpen,
  worstLimit,
  selected,
  clearSelected,
  onOpenDownload,
}) => {
  const { UI, theme: themeFromContext = {} } = React.useContext(ThemeContext) || {};
  const { Icon } = UI || {};
  const t = { ...macroviewTheme, ...getComponentTheme(themeFromContext, "macroview") };
  const mapT = {
    ...damaMapTheme.layerLibrary,
    ...getComponentTheme(themeFromContext, "damaMap.layerLibrary"),
  };

  const [collapsed, setCollapsed] = React.useState(false);

  const bins = Array.isArray(binCounts) ? binCounts : [];
  const maxBin = bins.length ? Math.max(...bins) : 0;
  const nBins = legend?.length || 0;
  // WHAT THE BARS ACTUALLY COUNT. The bins hold only rows that HAVE a value for the drawn
  // column; rows where it is NULL are counted separately (`noDataCount`) and painted grey
  // on the map. PHED/TED are computed on urbanized-area segments only — 30,940 of the
  // 52,127 rows on the 2025 view have no PHED at all — so "52,127 segments" over this
  // histogram was a claim about rows, not about values. The caption now names the
  // value-bearing population and, when there is any, the no-data figure.
  const valued = bins.reduce((a, c) => a + c, 0);
  const noData = Number.isFinite(noDataCount) ? noDataCount : 0;
  // the threshold's three renderings — LOTTR's reliability wording unless the measure
  // authored its own (TTTR reports a TARGET, not a pass/fail; see measures.js).
  const thresholdLabel = record?.thresholdLabel || "Reliable when";
  const beyondLabel = record?.beyondLabel || "Unreliable";
  const thresholdNoun = record?.thresholdNoun || "threshold";
  // ONE integer unit per bin keeps every bar edge on a whole viewBox unit, so bin i
  // starts at exactly i/nBins of the rendered width — the same fraction a `flex-1`
  // legend segment lands on. `preserveAspectRatio="none"` on the svg is what makes the
  // two agree: the default "xMidYMid meet" letterboxes the drawing inside the box (it
  // inset the bars ~7px per side, measured, which is why nothing lined up before).
  const VB = Math.max(1, nBins) * 100;
  // Where the reliability threshold falls on that scale. Bins are equal WIDTH but not
  // equal value-range, so the position is interpolated INSIDE the bin that contains the
  // threshold — now that the tick row prints the break values, snapping to the next bin
  // edge (what this did before) would visibly contradict the labels.
  // (`b.to == null` is the open-ended TOP bin of an authored set — a threshold that fell
  // there would have no interpolation span, and none does: every measure's threshold is an
  // interior value, and since 2026-08-18 LOTTR's 1.50 and TTTR's 2.00 are bin EDGES, so
  // the line lands exactly on a colour boundary at i * VB/nBins.)
  const thresholdX = (() => {
    const th = record?.threshold;
    if (th == null || !nBins) return null;
    const i = legend.findIndex((b) => th >= b.from && (b.to == null || th < b.to));
    if (i < 0 || legend[i].to == null) return null;
    const span = b1 => (b1.to - b1.from) || 1;
    return (i + (th - legend[i].from) / span(legend[i])) * (VB / nBins);
  })();

  return (
    <div className={`${t.posTopRight} ${mapT.panel}`}>
      <div className={mapT.panelInner}>
        <div className={mapT.header}>
          <Icon icon="Info" className={t.headIcon} />
          <span className={mapT.headerTitle}>{record?.abbr || "Measure"}</span>
          <button type="button" className={t.headBtn} onClick={onOpenDownload}>
            <Icon icon="Download" className={t.headBtnIcon} />
            Data
          </button>
          <button
            type="button"
            className={mapT.headerCollapseBtn}
            title={collapsed ? "Expand context" : "Collapse context"}
            onClick={() => setCollapsed((c) => !c)}
          >
            <Icon icon={collapsed ? "CaretDown" : "CaretUp"} className={mapT.headerCollapseIcon} />
          </button>
        </div>

        {collapsed ? null : (
          <div className={mapT.body}>
            {/* 1 · what the measure is */}
            <div className={t.block}>
              <div className={t.defTitle}>{record?.name}</div>
              <p className={t.defBody}>{record?.definition}</p>
              <div className={record?.reliableWhen ? t.factGrid : t.factGridSolo}>
                <div className={t.fact}>
                  <div className={t.factLabel}>Unit</div>
                  <div className={t.factValue}>{record?.unit}</div>
                </div>
                {record?.reliableWhen ? (
                  <div className={t.fact}>
                    <div className={t.factLabel}>{thresholdLabel}</div>
                    <div className={t.factValueNum} data-mv="threshold-fact">
                      {record.reliableWhen}
                    </div>
                  </div>
                ) : null}
              </div>
              {record?.equation ? <div className={t.equation}>{record.equation}</div> : null}
            </div>

            {/* 2 · the scale: the legend the map is drawing, then the distribution over
                   those same bins. One block, no inner padding, so all three rows
                   (strip · ticks · bars) measure the same width. */}
            <div className={t.block}>
              {/* The caption states WHERE the numbers came from, and it is no longer a
                  literal: "7 ckmeans bins" was hard-coded here and became wrong the moment
                  the breaks became authored data. comp.jsx passes the regime
                  (breaks.js BREAKS_CAPTION) — `fixed bins` + the set's method for an
                  authored set, `ckmeans bins` + `computed per view` for the fallback. */}
              <div className={t.blockHead}>
                <span className={t.blockHeadLabel}>
                  Legend{nBins ? ` · ${nBins} ${breaksCaption?.bins || "bins"}` : ""}
                </span>
                <span className={t.blockHeadNote}>{breaksCaption?.note || ""}</span>
              </div>
              {nBins ? (
                <div className={t.scale}>
                  <div className={t.legendStrip} data-mv="legend-strip">
                    {legend.map((b, i) => (
                      <span
                        key={i}
                        className={t.legendSeg}
                        data-mv="legend-seg"
                        data-mv-from={b.from}
                        data-mv-to={b.to == null ? "" : b.to}
                        // an authored set's top bin has no upper bound to name
                        title={b.to == null ? `${fmt(b.from)} or more` : `${fmt(b.from)} – ${fmt(b.to)}`}
                        style={{ backgroundColor: b.color }}
                      />
                    ))}
                  </div>
                  {/* Break VALUES, not counts: tick i sits at the right-hand edge of
                      segment i, i.e. on the boundary between bin i and bin i+1, and the
                      first cell also carries the domain floor at the left edge. The last
                      cell is EMPTY for an authored set — the top bin is open-ended, and
                      printing a per-year maximum there would put a moving number back on a
                      scale whose point is that it does not move. */}
                  <div className={t.legendTicks}>
                    {legend.map((b, i) => (
                      <span key={i} className={i === 0 ? t.legendTickFirst : t.legendTick}>
                        {i === 0 ? <span>{fmt(b.from)}</span> : null}
                        <span>{b.to == null ? "" : fmt(b.to)}</span>
                      </span>
                    ))}
                  </div>
                  <div className={t.distHead}>
                    <span className={t.blockHeadLabel}>Value distribution</span>
                    {/* The bars count VALUES, so the caption counts values. It used to
                        quote `filteredCount` — the row count — which on PHED read
                        "52,127 segments" over a histogram of 21,187. */}
                    <span className={t.blockHeadMeta} data-mv="dist-count">
                      {bins.length
                        ? noData > 0
                          ? `${fmtCount(valued)} of ${fmtCount(valued + noData)} segments`
                          : `${fmtCount(valued)} segments`
                        : "—"}
                    </span>
                  </div>
                  {bins.length && maxBin ? (
                    <>
                      <svg
                        viewBox={`0 0 ${VB} 64`}
                        preserveAspectRatio="none"
                        shapeRendering="crispEdges"
                        className={t.histo}
                        data-mv="histogram"
                      >
                        {bins.map((ct, i) => {
                          const w = VB / bins.length;
                          const h = Math.max(1, Math.round((ct / maxBin) * 61));
                          return (
                            <rect
                              key={i}
                              data-mv="histogram-bar"
                              // the per-bin count left the legend in the 2026-08-17 pass
                              // (the bars carry magnitude) — it stays here as data so a
                              // probe can assert the distribution follows the geography
                              // selection without reading bar pixel heights.
                              data-mv-count={ct}
                              x={i * w}
                              y={64 - h}
                              width={w}
                              height={h}
                              fill={legend?.[i]?.color || "#a1a1aa"}
                            />
                          );
                        })}
                        {thresholdX != null ? (
                          // non-scaling-stroke: the viewBox is squeezed horizontally by
                          // preserveAspectRatio="none", so a plain 1-unit stroke would
                          // render sub-pixel.
                          <line
                            data-mv="histogram-threshold"
                            x1={thresholdX}
                            y1="0"
                            x2={thresholdX}
                            y2="64"
                            stroke="#18181b"
                            strokeWidth="1"
                            strokeDasharray="3 2"
                            vectorEffect="non-scaling-stroke"
                          />
                        ) : null}
                      </svg>
                      {thresholdX != null ? (
                        // the NUMBER, not the `reliableWhen` string it used to slice apart:
                        // one source (`record.threshold`) for the marker, the "% beyond"
                        // readout and this caption, so they cannot disagree.
                        <div className={t.histoNote} data-mv="threshold-note">
                          dashed · {fmt(record.threshold)} {thresholdNoun}
                        </div>
                      ) : null}
                      {noData > 0 ? (
                        <div className={t.noDataNote} data-mv="nodata-note">
                          {fmtCount(noData)} no data · not coloured
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <p className={t.pending}>
                      {measureColumn ? "computing the distribution…" : "no measure column"}
                    </p>
                  )}
                </div>
              ) : (
                <p className={t.pending}>no breaks yet for this measure</p>
              )}
              <div className={t.statGrid}>
                <div>
                  <div className={t.statLabel}>Median</div>
                  <div className={t.statValue}>{stats?.p50 != null ? fmt(stats.p50) : "—"}</div>
                </div>
                <div>
                  <div className={t.statLabel}>80th pctl</div>
                  <div className={t.statValue}>{stats?.p80 != null ? fmt(stats.p80) : "—"}</div>
                </div>
                <div>
                  <div className={t.statLabel}>
                    {record?.threshold != null ? beyondLabel : "Reported"}
                  </div>
                  <div
                    className={record?.threshold != null ? t.statValueAlert : t.statValue}
                    data-mv="beyond-pct"
                  >
                    {record?.threshold != null
                      ? stats?.beyondPct != null
                        ? `${stats.beyondPct.toFixed(1)}%`
                        : "—"
                      : stats?.n != null
                        ? fmtCount(stats.n)
                        : "—"}
                  </div>
                </div>
              </div>
            </div>

            {/* 3 · get to a segment */}
            <div className={t.inspectHead}>Get to a segment</div>
            <div className={mapT.searchWrapper}>
              <div className={t.searchField}>
                <Icon icon="Search" className={t.searchIcon} />
                {/* The PM3 source has no road_name column, so this searches TMC and
                    county — the mockup's "road name or exit" needs a network join the
                    source does not carry (backported to the mockup 2026-08-12). */}
                <input
                  className={`${mapT.searchInput} ${t.searchInputIndent}`}
                  placeholder="TMC or county…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            {/* the selection itself — a segment is SELECTED, never filtered. The camera
                can only fly to it if its tile is loaded, so the selection is shown here
                regardless of whether the map could move. */}
            {selected ? (
              <div className={t.selectedRow}>
                <span className={t.selectedLabel}>
                  {selected.tmc} · {selected.county}
                </span>
                <span className={t.selectedValue}>
                  {Number.isFinite(selected.value) ? fmt(selected.value) : ""}
                </span>
                <button
                  type="button"
                  className={t.selectedClear}
                  title="clear selection"
                  onClick={clearSelected}
                >
                  <Icon icon="XMark" className={t.chipRemoveIcon} />
                </button>
              </div>
            ) : null}
            {searchTerm.trim().length >= 3 ? (
              <div className={t.searchResults}>
                {searchResults === null ? (
                  <div className={t.searchEmpty}>searching…</div>
                ) : searchResults.length ? (
                  searchResults.map((r) => (
                    <button
                      key={r.tmc}
                      type="button"
                      className={t.searchResult}
                      onClick={() => onSelectSegment(r)}
                    >
                      <span className={t.searchResultName}>
                        {r.tmc} · {r.county}
                      </span>
                      <span className={t.searchResultMeta}>
                        {Number.isFinite(r.value) ? fmt(r.value) : ""}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className={t.searchEmpty}>no segment matches</div>
                )}
              </div>
            ) : null}
            <div className={t.inspectRows}>
              <button
                type="button"
                className={t.inspectRow}
                // probe hooks, no visual effect — the same convention as the legend/
                // histogram above. They let a check assert "N points on the map = N rows
                // in this list, same TMCs, same values" against the DOM instead of
                // against a second query, which would not even return the same rows
                // (the worst-N ordering has ties).
                data-mv="worst-toggle"
                onClick={() => setWorstOpen(!worstOpen)}
              >
                <Icon icon="SortAsc" className={t.inspectRowIcon} />
                <span className={t.inspectRowLabel}>Worst {worstLimit} segments</span>
                <span className={t.inspectRowMeta}>
                  {worstOpen ? "hide" : "in current filter"}
                </span>
              </button>
              {worstOpen ? (
                <div className={t.inspectList}>
                  {worst === null ? (
                    <div className={t.searchEmpty}>loading…</div>
                  ) : worst.length ? (
                    worst.map((r, i) => (
                      <button
                        key={r.tmc}
                        type="button"
                        className={t.inspectListRow}
                        data-mv="worst-row"
                        data-mv-tmc={r.tmc}
                        data-mv-value={r.value}
                        onClick={() => onSelectSegment(r)}
                      >
                        <span className={t.inspectListRank}>{i + 1}</span>
                        <span className={t.inspectListName}>
                          {r.tmc} · {r.county}
                        </span>
                        <span className={t.inspectListValue}>
                          {Number.isFinite(r.value) ? fmt(r.value) : ""}
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className={t.searchEmpty}>nothing to rank</div>
                  )}
                </div>
              ) : null}
              {/* The "TRANSCOM events on these segments · NOT CONNECTED" row was REMOVED
                  2026-08-17 (Alex: "lets remove the note about transcom incidents"). The
                  capability gap it advertised is unchanged and still on the record —
                  TRANSCOM is not joined to the PM3 source, ticket 2211484 — only the dead
                  chrome went. Do not put the row back without the join behind it. */}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
