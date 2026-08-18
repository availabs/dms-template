import {get, set } from "lodash-es";
import { filters, updateSubMeasures, getMeasure } from "./updateFilters"
import { MEASURES } from "./measures";
import {
  PM3_LAYER_KEY,
} from "./constants";

const DataUpdate = (map, state, setState) => {
  //console.log("---data update-----")
  //9/4 9:02am looks like data update does not fire for DMS map
  //console.log("testing old filters and json code")

  //console.log({filters})
  //updateSubMeasures(this.filters.measure.value, this.filters, falcor);

  let pluginDataPath = "";
  let symbologyDataPath = "";
  if (state.symbologies) {
    const symbName = Object.keys(state.symbologies)[0];
    const pathBase = `symbologies['${symbName}']`;
    pluginDataPath = `${pathBase}.symbology.pluginData.macroview`;
    symbologyDataPath = `${pathBase}.symbology.layers`;
  } else {
    pluginDataPath = `symbology.pluginData.macroview`;
    symbologyDataPath = `symbology.layers`;
  }

  //console.log("plugin Data gets updated", { map, state, setState });
  const hover = get(state, `${pluginDataPath}['hover']`, "");
  const pm1 = get(state, `${pluginDataPath}['pm-1']`, null);
  const peak = get(state, `${pluginDataPath}['peak']`, null);
  const viewId = get(state, `${pluginDataPath}['viewId']`, null);
  const allPluginViews = get(state, `${pluginDataPath}['views']`, []);
  const geography = get(state, `${pluginDataPath}['geography']`, null);
  const pm3LayerId = get(
    state,
    `${pluginDataPath}['active-layers'][${PM3_LAYER_KEY}]`,
    null
  );
  const measureFilters = get(
    state,
    `${pluginDataPath}['measureFilters']`,
    filters
  );
  const pm3MapLayers = get(
    state,
    `${symbologyDataPath}['${pm3LayerId}'].layers`,
    null
  );
  const pm3MapSources = get(
    state,
    `${symbologyDataPath}['${pm3LayerId}'].sources`,
    null
  );
  const layerViewId = get(
    state,
    `${symbologyDataPath}['${pm3LayerId}'].view_id`,
    null
  );

  if (pm3LayerId && viewId) {
    //Update map with new viewId
    setState((draft) => {
      //console.log("data update for plugin, draft::", JSON.parse(JSON.stringify(draft)));

      // ── THE PAINT CLOBBER (found and fixed 2026-08-18) ────────────────────
      // This used to be
      //     JSON.parse(JSON.stringify(pm3MapLayers).replaceAll(layerViewId, viewId))
      // written back over the WHOLE `layers` array — and `pm3MapLayers` is read from the
      // `state` PluginLayer captured when it rendered, not from the draft. PluginLayer
      // fires `dataUpdate` from an effect keyed on the plugin's `pluginData` object
      // (PluginLayer.jsx), so it runs on every measure / view / geography write, i.e.
      // exactly when comp.jsx's colour effect has just written a fresh
      // `layers[1].paint['line-color']`. The stale snapshot then put the OLD array back,
      // core's SymbologyViewLayer diffed prev-vs-next paint, saw no change, and never
      // called `setPaintProperty`.
      //
      // MEASURED CONSEQUENCE on the live page (view mode), before the fix: the PM3 line
      // layer's `line-color` was frozen at the expression stored in the section — a
      // `lottr_amp_lottr` step with the 2025 ckmeans edges 1.22 · 1.45 · 1.78 · 2.37 ·
      // 3.4 · 6.75 — for EVERY measure. Sampled every 500ms for 45s with TTTR selected it
      // never changed once, while the tile URL correctly became
      // `cols=tttr_amp_tttr&filter=year=2025`. So selecting anything but LOTTR AM peak
      // painted the whole network `#ccc`: the paint asked for a column the tiles no longer
      // carried, and every feature fell into choroplethPaint's null branch.
      //
      // The repair is to touch ONLY what the view id actually appears in — each layer's
      // `source` and `source-layer` — and to read them off the DRAFT, so this composes
      // with the colour effect instead of racing it. `paint` is never rewritten here.
      const layerBase = `${symbologyDataPath}['${pm3LayerId}']`;
      const draftViewId = get(draft, `${layerBase}['view_id']`, layerViewId);
      const draftLayers = get(draft, `${layerBase}['layers']`, pm3MapLayers) || [];
      const swapViewId = (s) =>
        typeof s === "string" && draftViewId != null
          ? s.replaceAll(String(draftViewId), String(viewId))
          : s;
      draftLayers.forEach((l, i) => {
        // ⚠ deliberately NOT the layer `id`: core keys addLayer/moveLayer/removeLayer and
        // its own paint diffing on it, and the PM3 layer ids carry no view id anyway
        // (`byusgrr`, `byusgrr_case`).
        if (l?.source !== undefined) set(draft, `${layerBase}['layers'][${i}]['source']`, swapViewId(l.source));
        if (l?.["source-layer"] !== undefined) {
          set(draft, `${layerBase}['layers'][${i}]['source-layer']`, swapViewId(l["source-layer"]));
        }
      });

      // ── the year-filter fix (2026-08-12) ──────────────────────────────────
      // The PM3 tile URL carries a converter-authored `&filter=year=YYYY` clause baked
      // into the stored source, and core PRESERVES it on every rebuild by design
      // (getLayerTileUrl's `bakedFilter` — SymbologyViewLayer.jsx). Swapping only the
      // view id therefore left a 2025 view being asked for year=2024 rows: the tile
      // route answered **204 / 0 bytes** and the whole PM3 network silently disappeared
      // from the map. Verified 2026-08-12:
      //   .../tiles/3425/8/72/95/t.pbf?cols=…&filter=year=2024 → 204, 0 bytes
      //   .../tiles/3425/8/72/95/t.pbf?cols=…&filter=year=2025 → 200, 5,258 bytes
      // Each PM3 view holds exactly one year, so the year clause has to move WITH the
      // view. Rewriting (rather than stripping) keeps the converter's scoping intent and
      // stays correct if a view ever carries more than one year. Idempotent, so the
      // no-op re-run after `view_id` is already current cannot undo it.
      const selectedYear = (allPluginViews || []).find(
        (v) => String(v.value) === String(viewId)
      )?.name;
      // `sources` is only ever written here, so a whole-object rewrite is safe — but it is
      // taken off the DRAFT for the same reason as `layers` above: a stale snapshot would
      // undo the year rewrite of a preceding pass.
      const draftSources = get(draft, `${layerBase}['sources']`, pm3MapSources);
      let sourcesJson = JSON.stringify(draftSources).replaceAll(String(draftViewId), String(viewId));
      if (/^\d{4}$/.test(String(selectedYear))) {
        sourcesJson = sourcesJson
          .replace(/year=\d{4}/g, `year=${selectedYear}`)
          .replace(/year%3D\d{4}/g, `year%3D${selectedYear}`);
      }
      const newSources = JSON.parse(sourcesJson);
      const newDataColumn = getMeasure(measureFilters);
      set(
        draft,
        `${symbologyDataPath}['${pm3LayerId}']['sources']`,
        newSources
      );
      set(draft, `${symbologyDataPath}['${pm3LayerId}']['view_id']`, viewId);

      set(draft, `${symbologyDataPath}['${pm3LayerId}']['hover']`, hover);
      set(
        draft,
        `${symbologyDataPath}['${pm3LayerId}']['data-column']`,
        newDataColumn
      ); //must set data column, or else tiles will not have that data

      // ── the hover popup's field set (2026-08-12) ──────────────────────────
      // `hover-columns` was the source's ENTIRE 105-column list, so the popup dumped every
      // pm3 column (lottr for all four peaks, tttr for five, every phed/ted variant …).
      // The design specifies a five-field popup; four of those five exist on this source, so
      // the popup is now road-segment identity + the measure the map is drawing + where it
      // is. Rebuilt on every dataUpdate because the measure column changes with the
      // selection, and a static list would name a column the tiles no longer carry.
      //   Road name, segment length and AADT are deliberately absent: source 1410 has no
      //   such columns (they need a network join — pm3-runner task).
      //   ogc_fid is NOT needed here: the popup keys on the MVT feature id, which
      //   ST_AsMVT fills from ogc_fid, and looks its fields up via `dataById[id]`.
      const measureLabel = [
        MEASURES[measureFilters?.measure?.value]?.abbr || newDataColumn,
        measureFilters?.peakSelector?.active &&
          measureFilters.peakSelector.domain?.find(
            (o) => String(o.value) === String(measureFilters.peakSelector.value)
          )?.name,
      ].filter(Boolean).join(" · ");
      set(draft, `${symbologyDataPath}['${pm3LayerId}']['hover-columns']`, [
        { column_name: "tmc", display_name: "TMC" },
        ...(newDataColumn ? [{ column_name: newDataColumn, display_name: measureLabel }] : []),
        { column_name: "county", display_name: "County" },
        { column_name: "region_code", display_name: "Region" },
      ]);
    });
  } else if (pm3LayerId && !viewId && allPluginViews?.length > 0) {
    console.log("fallback no view selected")
    console.log({pluginDataPath, allPluginViews, pm3LayerId})
    //if no view is selected, but there is at least 1 element in views, select that 1 element
    setState((draft) => {
      set(draft, `${pluginDataPath}['viewId']`, allPluginViews[0].value);
    });
  }
};

export { DataUpdate };
