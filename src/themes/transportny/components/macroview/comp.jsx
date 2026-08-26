import React, { useState, useMemo, useEffect } from "react";
import { get, set, isEqual } from "lodash-es";
import { format as d3format } from "d3-format";
import { filters, updateSubMeasures, getMeasure, updateLegend } from "./updateFilters";
import {
  filterToUda,
  buildLayerUdaFilterOptions,
} from "../../../../dms/packages/dms/src/patterns/mapeditor/MapEditor/stateUtils";
import { MEASURES } from "./measures";
import { ThemeContext } from "../../../../dms/packages/dms/src/ui/useTheme";
import { CMSContext } from "../../../../dms/packages/dms/src";
import { PageContext } from "../../../../dms/packages/dms/src/patterns/page/context";
import { MapEditorContext } from "../../../../dms/packages/dms/src/patterns/mapeditor/context";
import { choroplethPaint } from "../../../../dms/packages/dms/src/patterns/mapeditor/MapEditor/components/LayerEditor/datamaps";
import {
  PM3_LAYER_KEY,
  MPO_LAYER_KEY,
  COUNTY_LAYER_KEY,
  REGION_LAYER_KEY,
  UA_LAYER_KEY,
  WORST_SEGMENT_LIMIT,
  URL_CONTROL_KEYS,
} from "./constants";
import { BREAKS_CAPTION, NUM_BINS, resolveBreakSet } from "./breaks";
import {
  decodeUrlState,
  encodeGeography,
  encodeUrlState,
  measureDefaults,
  pageAlreadyHolds,
  registeredUrlKeys,
} from "./urlState";
import {
  setGeometryBorderFilter,
  buildGeographyDynamicFilters,
  resetGeometryBorderFilter,
  setInitialGeomStyle,
  buildGeomControlOptions,
  getAttributes,
  usePrevious,
} from "./utils";
import { npmrdsPaint } from "./paint";
import { fetchMeasureStats, fetchBinCounts, fetchWorstSegments, fetchSegmentMatches } from "./stats";
import { buildWorstPointFeatures, drawWorstPoints, removeWorstPoints } from "./worstPoints";
import { ControlsPanel } from "./controlsPanel";
import { ContextPanel } from "./contextPanel";
import { MapChrome } from "./mapChrome";
import { DownloadBuilder } from "./downloadBuilder";

// ── macroview · the plugin's rendered surface ───────────────────────────────────
// `comp` is the ONLY part of this plugin that is mounted as real JSX (macroview.plugin
// `comp: Comp`, mounted by PluginLayer inside AvlMap's `absolute inset-0
// pointer-events-none` overlay). It therefore owns both the stateful/effectful work AND,
// since 2026-08-12, every floating panel the design specifies:
//
//   ControlsPanel   top-left      geography → view → year → measure group
//   ContextPanel    top-right     definition · unit · reliable-when · equation ·
//                                 distribution · legend-with-counts · get-to-a-segment
//   MapChrome       bottom band   freshness strip + the collapsed download dock pill
//   DownloadBuilder overlay       the export builder, opened from the pill or "Data"
//
// The panels used to come from `externalPanel`'s descriptor, rendered by core
// ExternalPluginPanel — a fixed 340px box with `w-24` grey labels that cannot express the
// design's 320px shell, white header, grey measure group, segments or chips.
// `externalPanel` now returns [] and the chrome is consumed from the Map component's own
// theme (`damaMap.layerLibrary`) plus `macroview.theme.js`. No core DMS change was needed.
//
// The map still draws ONLY from tiles; everything queried here feeds panels.

const INITIAL_MODAL_STATE = {
  open: false,
  loading: false,
  columns: [],
  uniqueFileNameBase: "",
  fileType: "GPKG",
  downloadContextId: "",
  // The server's refusal, shown in the builder. pm3's create-download route validates the
  // column set, the format and the geography filter and answers 400 with a reason; without
  // somewhere to put it, a rejected request looked exactly like a request that worked.
  error: "",
};

//creates a unique identifier regardless of how many columns the user selects
async function hashString(inputString) {
  // 1. Encode the string to a Uint8Array
  const encoder = new TextEncoder();
  const data = encoder.encode(inputString);

  // 2. Hash the data with SHA-256
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);

  // 3. Convert the ArrayBuffer to a 64-character hexadecimal string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  return hashHex;
}

const fmtCount = d3format(",");

// ⚙ ONE-LINE SWITCH — the scope the choropleth BREAKS are computed over.
//
//   "statewide" (default) — the ramp is computed over the whole year and does NOT move
//       when a geography is selected, so a colour means the same thing before and after
//       you pick a county and two geographies are comparable at a glance. The histogram,
//       the counts and the stats DO follow the selection, drawn against that stable ramp.
//   "selection" — breaks are recomputed inside the selection: maximum contrast within
//       one geography, but the legend re-labels on every chip and colours stop being
//       comparable between selections.
//
// Measured on view 3425 / LOTTR AM peak (2026-08-17) before choosing the default:
//   statewide breaks [1, 1.22, 1.45, 1.78, 2.37, 3.4, 6.75]
//   Albany County   → 613 / 381 / 192 / 77 / 9 / 2 / 0   (its own breaks: 510/373/246/98/36/9/2)
//   Hamilton County → 64 / 8 / 5 / 1 / 0 / 0 / 0         (the flattest county measured)
// Even the flattest case keeps four populated bins, i.e. statewide breaks never
// collapse a selection into "everything is bin 1" — the readability argument for
// re-binning per selection does not hold on this data.
const BREAKS_SCOPE = "statewide";

const Comp = ({ state, setState, map }) => {
  const mctx = React.useContext(MapEditorContext);
  const cctx = React.useContext(CMSContext);
  const ctx = mctx?.falcor ? mctx : cctx;
  let { falcor, falcorCache, pgEnv, baseUrl, user } = ctx;
  // Only CMSContext (published pages) carries fileUploadInfo.DAMA_HOST today -
  // MapEditorContext has no equivalent, so the data-downloader button is a
  // no-op in the authoring context until that's added upstream.
  const DAMA_HOST = cctx?.fileUploadInfo?.DAMA_HOST || cctx?.API_HOST;
  const [polling, setPolling] = React.useState(false);
  const [pollingInterval, setPollingInterval] = React.useState(false);
  const [downloadFileName, setDownloadFileName] = React.useState("");
  const [view, setView] = React.useState({});

  if (!falcorCache) {
    falcorCache = falcor.getCache();
  }
  const [modalState, setModalState] = useState(INITIAL_MODAL_STATE);
  const [scope, setScope] = useState("current");

  // panel data — all of it derived from side-queries, none of it drawn on the map.
  // `drawn` is WHAT IS ON SCREEN: the ramp's domain (`breaks`, [0] = floor), its colours,
  // the number format they are labelled with, and `max` — which is **null for an authored
  // break set**, meaning the top bin is open-ended (breaks.js). `caption` says which
  // regime produced the numbers so the panel cannot claim "ckmeans" over authored breaks.
  const [drawn, setDrawn] = useState({
    breaks: [],
    max: null,
    colors: [],
    count: null,
    format: ",.2~f",
    caption: BREAKS_CAPTION.manual,
  });
  const [stats, setStats] = useState(null);
  const [binCounts, setBinCounts] = useState(null);
  const [filteredCount, setFilteredCount] = useState(null);
  const [totalCount, setTotalCount] = useState(null);
  const [worst, setWorst] = useState(null);
  const [worstOpen, setWorstOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [selected, setSelected] = useState(null);

  let symbologyLayerPath = "";
  let symbPath = "";
  if (state.symbologies) {
    const symbName = Object.keys(state.symbologies)[0];
    const pathBase = `symbologies['${symbName}']`;
    symbologyLayerPath = `${pathBase}.symbology.layers`;

    symbPath = `${pathBase}.symbology`;
  } else {
    symbologyLayerPath = `symbology.layers`;
    symbPath = `symbology`;
  }

  const pluginDataPath = `${symbPath}['pluginData']['macroview']`;

  const {
    viewId, sourceId, geography, measureFilters,
    pm3LayerId, mpoLayerId, countyLayerId, regionLayerId, uaLayerId,
  } = useMemo(() => {
    const pm3LayerId = get(state, `${pluginDataPath}['active-layers'][${PM3_LAYER_KEY}]`, null);

    return {
      viewId: get(state, `${pluginDataPath}['viewId']`, null),
      sourceId: get(state, `${symbologyLayerPath}['${pm3LayerId}']['source_id']`, null),
      geography: get(state, `${pluginDataPath}['geography']`, null),
      measureFilters: get(state, `${pluginDataPath}['measureFilters']`, filters),
      pm3LayerId,
      mpoLayerId: get(state, `${pluginDataPath}['active-layers'][${MPO_LAYER_KEY}]`, null),
      countyLayerId: get(state, `${pluginDataPath}['active-layers'][${COUNTY_LAYER_KEY}]`, null),
      regionLayerId: get(state, `${pluginDataPath}['active-layers'][${REGION_LAYER_KEY}]`, null),
      uaLayerId: get(state, `${pluginDataPath}['active-layers'][${UA_LAYER_KEY}]`, null),
    }
  }, [state])

  // shared by the download builder below and the plugin-control/color-domain
  // effects further down — this is the single "which measure is selected" value.
  const measure = getMeasure(measureFilters);
  const measureKey = get(measureFilters, ["measure", "value"], "lottr");
  const record = MEASURES[measureKey] || null;

  const pluginData = get(state, pluginDataPath, {});
  const views = get(pluginData, ["views"], []) || [];
  const yearLabel = useMemo(() => {
    const hit = views.find((v) => String(v.value) === String(viewId));
    return hit?.label || hit?.name || view?.version || "";
  }, [views, viewId, view]);

  const geomControlOptions = get(pluginData, ["geomControlOptions"], []) || [];

  /**
   * ══ URL STATE ══════════════════════════════════════════════════════════════════
   *
   * Every viewer control on this map — measure, its dependent controls, year, the
   * geography chips, the worst-25 toggle — round-trips through the URL so a view can be
   * shared, bookmarked and deep-linked (the NPMRDS home page's § 01 rows link straight to
   * `/macro?measure=…`).
   *
   * ⚠ THE PLUGIN NEVER TOUCHES `useSearchParams`. Core's Map component carries the same
   * capability and an explicit warning next to it (ComponentRegistry/map/index.jsx):
   * "writing the URL from the map fights the page's URL ownership and, under React
   * Compiler, ping-pongs into a reload loop." THE PAGE OWNS THE URL. State is read from
   * `pageState.filters` and written through `updatePageStateFilters` — the same producer
   * path click-filters and the map's own share-state use.
   *
   * That means the params must be REGISTERED page variables: `updatePageStateFilters`
   * rebuilds the query string from `pageState.filters.filter(f => f.useSearchParams)` and
   * silently drops any key the page does not declare. Page 2101931 declares the nine keys
   * of the contract in its `filters` array; `registeredUrlKeys()` intersects with them, so
   * the registry IS the opt-in and this plugin on a page with no `filters` simply stops
   * persisting instead of navigating against a URL nobody owns.
   *
   * READ BEFORE WRITE, copied from core's discipline for the measured reason stated there:
   * a remount reseeds defaults (here, `macroview.plugin.jsx`'s `mapRegister` re-runs
   * `updateSubMeasures(filters)` on EVERY mount — and PluginLayer's mount effect runs
   * AFTER this component's, so it lands second), and writing before the read has
   * reconciled would push those defaults over the viewer's selection and bounce
   * navigate↔remount. `urlReadReconciled` is STATE, not a ref, so a remount re-defers;
   * `urlWritePrimedRef` holds the page-synced baseline so the first post-read pass primes
   * instead of writing; and `pageAlreadyHolds` never writes what the page already has.
   */
  const pctx = React.useContext(PageContext);
  const pageFilters = pctx?.pageState?.filters;
  const updatePageStateFilters = pctx?.updatePageStateFilters;
  const urlKeys = useMemo(() => registeredUrlKeys(pageFilters), [pageFilters]);
  // No PageContext (the MapEditor) or no registered variables ⇒ no URL persistence.
  const urlEnabled = typeof updatePageStateFilters === "function" && urlKeys.size > 0;

  const urlDesired = useMemo(
    () => decodeUrlState({ pageFilters, views, geomControlOptions }),
    [pageFilters, views, geomControlOptions]
  );

  const [urlReadReconciled, setUrlReadReconciled] = useState(false);
  const urlWritePrimedRef = React.useRef(null);
  // Which URL state we are currently converging ON, and whether we still are. This is what
  // makes the READ *URL-triggered* rather than state-triggered: a viewer's own control
  // change moves the state while `pending` is false, so the reconciler sees it and does
  // nothing. Only a new `urlDesiredKey` — a navigation, including Back/Forward — arms it.
  // Without that distinction the reconciler would fight the writer: the instant a control
  // changed, the URL would still hold the old value and the READ would put it back.
  const urlConvergeRef = React.useRef({ key: null, pending: false });

  const measureValue = get(measureFilters, ["measure", "value"], null);
  const prevMeasureValue = usePrevious(measureValue);
  // The sub-measure normalization effect below runs exactly once per measure change (its
  // dep is `measureValue`), so "the measure did not change this render" is a sound proof
  // that it will NOT fire in this commit — which is when it is safe to write a dependent
  // control value that differs from the measure's default without having it normalized
  // straight back out.
  const measureSettled = prevMeasureValue === measureValue;

  // A `geo=` param can only be honoured once the geography option list has been fetched
  // (a chip's `name` is re-derived from it, never stored), so reconciliation — and with it
  // the write side — waits for the options rather than writing an empty `geo` over the
  // param it was about to read.
  const urlStateReady =
    urlEnabled &&
    Boolean(views?.length) &&
    (!urlDesired.geoRawCount || geomControlOptions.length > 0);

  // Compared as a STRING so the effect below reacts to a change in the URL's MEANING, not
  // to a new object identity from the `pageState.filters` array being rebuilt.
  const urlDesiredKey = JSON.stringify({
    measure: urlDesired.measureKey,
    controls: urlDesired.controls,
    viewId: urlDesired.viewId,
    geo: encodeGeography(urlDesired.geography),
    worst: urlDesired.worst,
  });
  const geographyKey = JSON.stringify(encodeGeography(geography));

  /**
   * READ · converge the plugin's state onto what the URL says.
   *
   * One step per run, then return — the write it just made re-triggers the effect, so the
   * sequence is ordered and each step is idempotent. Order matters: the measure decides
   * which dependent controls exist, and `updateSubMeasures` resets them, so the controls
   * cannot be written until the measure has landed AND settled (see `measureSettled`).
   *
   * It also has to survive `mapRegister` — which re-runs `updateSubMeasures(filters)` on
   * every mount, from PluginLayer's mount effect, i.e. AFTER this component's effects. So
   * step 1 may legitimately have to fire twice: it writes the measure, mapRegister resets
   * it to the pristine default, and the next run writes it again. Converging (rather than
   * applying once) is what makes that harmless.
   *
   * Controls absent from the URL are reset to the measure's default, so the URL is
   * authoritative for the whole measure group — that is what makes Back out of a
   * `?traffic=truck` state actually drop the truck filter instead of leaving it on.
   */
  useEffect(() => {
    if (!urlEnabled) return;
    if (!urlStateReady) return;
    if (urlConvergeRef.current.key !== urlDesiredKey) {
      urlConvergeRef.current = { key: urlDesiredKey, pending: true };
    }
    if (!urlConvergeRef.current.pending) return;

    // 1 · measure. Written as the fully normalized filter set (exactly what the
    //     normalization effect would produce) so the two cannot disagree.
    if (urlDesired.measureKey !== measureValue) {
      const normalized = measureDefaults(urlDesired.measureKey);
      setState((draft) => {
        set(draft, `${pluginDataPath}['measureFilters']`, normalized);
      });
      return;
    }

    // 2 · the measure's dependent controls — only once the measure is settled, otherwise
    //     the normalization pass in this same commit would undo the write.
    if (!measureSettled) return;
    const controlDefaults = measureDefaults(urlDesired.measureKey);
    const wantedControls = {};
    Object.keys(URL_CONTROL_KEYS).forEach((key) => {
      if (!controlDefaults[key]?.active) return;
      wantedControls[key] =
        key in urlDesired.controls ? urlDesired.controls[key] : controlDefaults[key].value;
    });
    const pendingControls = Object.keys(wantedControls).filter(
      (key) => String(get(measureFilters, [key, "value"])) !== String(wantedControls[key])
    );
    if (pendingControls.length) {
      setState((draft) => {
        pendingControls.forEach((key) => {
          set(draft, `${pluginDataPath}['measureFilters']['${key}'].value`, wantedControls[key]);
        });
      });
      return;
    }

    // 3 · year (resolved from the human year against this section's views).
    if (urlDesired.viewId !== null && String(urlDesired.viewId) !== String(viewId)) {
      setState((draft) => {
        set(draft, `${pluginDataPath}['viewId']`, urlDesired.viewId);
      });
      return;
    }

    // 4 · geography chips. Compared on the `family:value` pairs, not by deep object
    //     equality — the label is re-derived and must not decide whether we converged.
    if (JSON.stringify(encodeGeography(urlDesired.geography)) !== geographyKey) {
      setState((draft) => {
        set(draft, `${pluginDataPath}['geography']`, urlDesired.geography);
      });
      return;
    }

    // 5 · the worst-25 list + point overlay.
    if (urlDesired.worst !== worstOpen) {
      setWorstOpen(urlDesired.worst);
      return;
    }

    urlConvergeRef.current.pending = false;
    if (!urlReadReconciled) setUrlReadReconciled(true);
  }, [
    urlEnabled,
    urlStateReady,
    urlDesiredKey,
    urlDesired,
    urlReadReconciled,
    measureValue,
    measureSettled,
    measureFilters,
    viewId,
    geographyKey,
    worstOpen,
  ]);

  // ── WRITE (plugin state → the page's URL) ──────────────────────────────────────
  useEffect(() => {
    if (!urlEnabled) return;
    if (!urlReadReconciled) return;
    // Don't write mid-normalization. On the commit where the measure changes, the
    // dependent controls still hold the PREVIOUS measure's values (the normalization
    // effect below has not run yet), so writing here emitted a transient wrong URL and
    // cost a second navigation to correct it — measured: switching LOTTR → PHED wrote
    // `?measure=phed&peak=amp` and then `?measure=phed` (2 pushes). Waiting one render
    // makes it one push with the right value.
    if (!measureSettled) return;
    const entries = encodeUrlState({
      measureFilters,
      geography,
      viewId,
      views,
      worstOpen,
    }).filter((entry) => urlKeys.has(entry.searchKey));
    if (!entries.length) return;
    const serialized = JSON.stringify(entries);
    // First run after reconciliation: prime the page-synced baseline, no write.
    if (urlWritePrimedRef.current === null) {
      urlWritePrimedRef.current = serialized;
      return;
    }
    if (urlWritePrimedRef.current === serialized) return;
    urlWritePrimedRef.current = serialized;
    // Idempotency vs the PAGE: never write what the page already holds.
    if (pageAlreadyHolds(entries, pageFilters)) return;
    updatePageStateFilters(entries);
  }, [
    urlEnabled,
    urlReadReconciled,
    measureSettled,
    urlKeys,
    measureFilters,
    geography,
    viewId,
    views,
    worstOpen,
    pageFilters,
    updatePageStateFilters,
  ]);

  const setColumns = (columnName) => {
      let newColumns;
      if(Array.isArray(columnName)){
          newColumns = columnName;
      }
      else if(modalState.columns.includes(columnName)){
          newColumns = modalState.columns.filter(colName => colName !== columnName)
      }
      else{
          newColumns = [...modalState.columns];
          newColumns.push(columnName);
      }

      setModalState({...modalState, columns: newColumns})
  }
  const setModalOpen = (newModalOpenVal) => setModalState({...modalState, open: newModalOpenVal});
  const openBuilder = () =>
    setModalState((cur) => ({
      ...cur,
      open: true,
      error: "",
      columns: cur.columns.length ? cur.columns : ["tmc", "county", measure].filter(Boolean),
    }));

  // ALWAYS an object. `metadata.download` is absent until the first download of a view has been
  // built — which is every pm3 view of source 2135 — and the polling effect below indexes this
  // unguarded (`!viewDownloads[downloadFileName]`), so an undefined here threw a TypeError inside
  // the effect on the very first download and took the whole plugin down.
  const viewDownloads = useMemo(() => {
    return get(view, ['metadata',  'download']) || {}
  }, [view]);

  const fileNameBase = useMemo(() => {
    let nameBase = "";
    if(modalState.columns.length > 0) {
      const joinedCols = [...modalState.columns].sort().join("_");
      nameBase = `${view?.version ?? viewId}_${joinedCols}`;
    }

    if (geography && scope === "current") {
      geography.forEach((geoFilt) => {
        nameBase += `_${geoFilt.type}_${geoFilt.value}`;
      });
    }

    nameBase += modalState.fileType;
    return nameBase;
  }, [modalState.columns, modalState.fileType, geography, scope, view, viewId])
  useEffect(() => {
    const getUniqueFileNameBase = async () => {
      const uniqueFileNameBase = await hashString(fileNameBase);
      setModalState((cur) => ({ ...cur, uniqueFileNameBase }));
    }

    getUniqueFileNameBase()
  }, [fileNameBase])

  const downloadAlreadyExists = useMemo(() => {
    return Object.keys(viewDownloads || {}).includes(modalState.uniqueFileNameBase);
  }, [viewDownloads, modalState.uniqueFileNameBase])

  const existingDownloadUrl = useMemo(
    () =>
      downloadAlreadyExists
        ? (viewDownloads[modalState.uniqueFileNameBase] || "").replace("$HOST", `${DAMA_HOST}`)
        : "",
    [downloadAlreadyExists, viewDownloads, modalState.uniqueFileNameBase, DAMA_HOST]
  );

  const createDownload = () => {
      const runCreate = async () => {
      if (downloadAlreadyExists) {
        // the file is already built — just take it
        const link = document.createElement("a");
        link.href = existingDownloadUrl;
        link.setAttribute("download", existingDownloadUrl.split("/").pop());
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }
          try {
            //IF WE HAVE GEOMETRY SELECTED, PASS IT HERE
              const createData = {
                  source_id: sourceId,
                  view_id: viewId,
                  columns: modalState.columns,
                  user_id: user.id,
                  email: user.email,
                  downloadProps:{
                    // "Statewide" is exactly "current filters without the geography" —
                    // the endpoint takes one geography filter, so scope IS that filter.
                    geographyFilter: scope === "statewide" ? [] : geography,
                    measure,
                  },
                  // THE CACHE KEY, and the only client change the server fix needed. The panel
                  // already hashes (version + sorted columns + geography + format) and polls
                  // `metadata.download[<that hash>]`; the old endpoint filed the result under
                  // the fileType instead, so the poll could never resolve. Sending the hash
                  // lets the server file it where the client is already looking.
                  uniqueFileNameBase: modalState.uniqueFileNameBase,
                  fileTypes:[modalState.fileType]
              };

              setModalState({...modalState, loading: true});
              // pm3's OWN route, not `gis-dataset/create-download`. The generic one drops
              // `downloadProps` entirely — every export came back statewide — and knows nothing
              // about pm3's published relation being a VIEW. See data-types/pm3/download.js.
              const res = await fetch(
                `${DAMA_HOST}/dama-admin/${pgEnv}/pm3/create-download`,
                {
                  method: "POST",
                  body: JSON.stringify(createData),
                  headers: {
                    "Content-Type": "application/json",
                  },
                }
              );

              const body = await res.json().catch(() => ({}));
              // A refused request must NOT start the poll: `metadata.download[hash]` will never
              // appear, so the panel would sit on "Sending request…" until the page is reloaded.
              if (!res.ok) {
                throw new Error(body?.error || `create-download failed (${res.status})`);
              }

              setDownloadFileName(modalState.uniqueFileNameBase);
              setModalState(INITIAL_MODAL_STATE);
          } catch (err) {
              console.log(err)
              setModalState({...modalState, loading: false, open: true, error: err?.message || "download request failed"});
          }
      }

      runCreate();
  }

  useEffect(() => {
    falcor.get([
      "uda",
      pgEnv,
      "sources",
      "byId",
      sourceId,
      ["metadata"]
    ]);
  }, [sourceId]);

  const fetchViewPath = [
    "uda",
    pgEnv,
    "views",
    "byId",
    viewId,
    ["metadata", "version"],
  ];

  useEffect(() => {
    falcor.get(fetchViewPath);
  }, [viewId]);

  const sourceDataColumns = useMemo(() => {
    let sourceColumns = get(falcorCache, [
        "uda",
        pgEnv,
        "sources",
        "byId",
        sourceId,
        "metadata",
        "value"
    ],[]);
    sourceColumns = sourceColumns?.columns ? sourceColumns.columns : sourceColumns;
    return Array.isArray(sourceColumns) ? sourceColumns.filter(d => d.name !== "ogc_fid") : []
    // return []
  }, [falcorCache, viewId]);

  /**
   * START PLUGIN-CONTROL SIDE EFFECTS
   *
   * These used to live inside externalPanel.jsx's `ExternalPanel` and
   * internalPanel.jsx's `InternalPanel`, both of which are invoked as plain
   * function calls (not rendered as JSX) from the shared ExternalPluginPanel/
   * InternalPluginPanel components. Calling hooks (useState/useMemo/useEffect)
   * from a function that isn't actually mounted as a component is a Rules-of-
   * Hooks violation — the hook calls get attributed to whichever component IS
   * currently rendering (ExternalPluginPanel/InternalPluginPanel), and any
   * variation in how many times the plugin function gets called between two
   * renders (tab count changing, PluginLibrary not yet populated, etc.)
   * desyncs the hook count and crashes with "Rendered fewer hooks than
   * expected." `Comp` is the one part of this plugin that's actually rendered
   * via JSX (see macroview.plugin.jsx's `comp: Comp`, mounted by PluginLayer),
   * so it's the correct home for anything stateful/effectful.
   */

  // The plugin now renders the legend itself, inside the measure-context panel, with a
  // per-bin row count and the honest "author-set breaks" caption. `default-legend: false`
  // is core's purpose-built plugin override (LegendPanel.jsx filters the whole symbology
  // on it), so the built-in top-right legend panel stands down instead of sitting on top
  // of panel 2.
  const defaultLegend = get(pluginData, ["default-legend"]);
  useEffect(() => {
    if (defaultLegend !== false) {
      setState((draft) => {
        set(draft, `${pluginDataPath}['default-legend']`, false);
      });
    }
  }, [defaultLegend]);

  // Geography dropdown options — fetched once per view, transformed, and
  // written into pluginData so the controls panel can read it back.
  const geomOptions = JSON.stringify({
    groupBy: ["urban_code", "region_code", "mpo_name", "county"],
  });
  const GEOM_COLUMNS = ["urban_code", "region_code", "mpo_name", "county"];

  // The range used to be a hard-coded { from: 0, to: 200 }, and view 3425 has 323
  // distinct (urban_code, region_code, mpo_name, county) combinations — so 122 combo
  // rows were dropped and, with them, whole geographies: CATTARAUGUS county, the
  // Housatonic Valley MPO and urban code 45262 (Kingston, NY) were NOT in the option
  // list at all, searchable or not. The length query costs one round trip and makes the
  // list complete: 72 counties · 21 MPOs · 16 urban areas · 11 regions on this view.
  useEffect(() => {
    if (!viewId) return;
    const fetchGeomOptions = async () => {
      const lengthPath = ["uda", pgEnv, "viewsById", viewId, "options", geomOptions, "length"];
      const lengthRes = await falcor.get(lengthPath);
      const rawLength = get(lengthRes, ["json", ...lengthPath], get(falcor.getCache(), lengthPath));
      const comboRows = Number.isFinite(+rawLength) && +rawLength > 0 ? +rawLength : 201;

      const geomDataPath = ["uda", pgEnv, "viewsById", viewId, "options", geomOptions, "dataByIndex"];
      const res = await falcor.get([
        ...geomDataPath,
        { from: 0, to: comboRows - 1 },
        GEOM_COLUMNS,
      ]);
      // A fully-cached falcor `get` resolves with an empty `json`, and cache leaves are
      // boxed ({$type, value}) — unbox them, otherwise buildGeomControlOptions' own
      // "drop object cells" guard silently throws the whole list away.
      let geomDataRes = get(res, ["json", ...geomDataPath]);
      if (!geomDataRes) {
        const cached = get(falcor.getCache(), geomDataPath, {});
        geomDataRes = Object.entries(cached).reduce((rows, [i, row]) => {
          if (!row || typeof row !== "object") return rows;
          rows[i] = GEOM_COLUMNS.reduce((out, col) => {
            const cell = row[col];
            out[col] = cell && typeof cell === "object" && "$type" in cell ? cell.value : cell;
            return out;
          }, {});
          return rows;
        }, {});
      }
      setState((draft) => {
        set(
          draft,
          `${pluginDataPath}['geomControlOptions']`,
          buildGeomControlOptions(geomDataRes)
        );
      });
    };
    fetchGeomOptions();
  }, [viewId]);

  // Selecting geography filters/highlights the matching border layers.
  useEffect(() => {
    const getFilterBounds = async () => {
      //need array of [{column_name:foo, values:['bar', 'baz']}]
      //geography is currently [{name: foo, value: 'bar', type:'baz'}]

      //loop thru, gather like terms — one shared builder (utils.jsx), because the repair
      //effect below writes the very same array and a second copy would drift silently.
      const geographyFilter = buildGeographyDynamicFilters(geography);
      setState((draft) => {
        set(
          draft,
          `${symbologyLayerPath}['${pm3LayerId}']['dynamic-filters']`,
          geographyFilter
        );

        set(
          draft,
          `${symbologyLayerPath}['${pm3LayerId}']['filterMode']`,
          "any"
        );
      });
    };

    if (geography?.length > 0) {
      //get zoom bounds
      getFilterBounds();
      //filter and display borders for selected geographie

      // //set "mpo" display to enabled
      const selectedMpo = geography.filter((geo) => geo.type === "mpo_name");
      if (selectedMpo.length > 0 && mpoLayerId) {
        //SOURCE 997 view 1992 MPO Boundaries
        setGeometryBorderFilter({
          setState,
          layerId: mpoLayerId,
          geomDataKey: "mpo_name",
          values: selectedMpo.map((mpo) => mpo.value),
          layerBasePath: symbologyLayerPath,
        });
      } else {
        if (mpoLayerId) {
          resetGeometryBorderFilter({
            layerId: mpoLayerId,
            setState,
            layerBasePath: symbologyLayerPath,
          });
        }
      }

      const selectedCounty = geography.filter((geo) => geo.type === "county");
      if (selectedCounty.length > 0 && countyLayerId) {
        //SOURCE 1060 view 2117 NY County Statistics (x1989)
        setGeometryBorderFilter({
          setState,
          layerId: countyLayerId,
          geomDataKey: "ny_counti_4",
          values: selectedCounty.map((county) => {
            const lowCountyString = county.value.toLowerCase();
            return lowCountyString[0].toUpperCase() + lowCountyString.slice(1);
          }),
          layerBasePath: symbologyLayerPath,
        });
      } else {
        if (countyLayerId) {
          resetGeometryBorderFilter({
            layerId: countyLayerId,
            setState,
            layerBasePath: symbologyLayerPath,
          });
        }
      }

      const selectedRegion = geography.filter(
        (geo) => geo.type === "region_code"
      );
      if (selectedRegion.length > 0 && regionLayerId) {
        //SOURCE 1497 view 4135 nysdot_regions
        setGeometryBorderFilter({
          setState,
          layerId: regionLayerId,
          geomDataKey: "region",
          values: selectedRegion.map((regionCode) =>
            regionCode.value
          ),
          layerBasePath: symbologyLayerPath,
        });
      } else {
        if (regionLayerId) {
          resetGeometryBorderFilter({
            layerId: regionLayerId,
            setState,
            layerBasePath: symbologyLayerPath,
          });
        }
      }

      const selectedUa = geography.filter(
        (geo) => geo.type === "urban_code"
      );

      if (selectedUa.length > 0 && uaLayerId) {
        //SOURCE 1493 view 2663 ua_boundaries
        setGeometryBorderFilter({
          setState,
          layerId: uaLayerId,
          geomDataKey: "uace_20",
          values: selectedUa.map((uaCode) =>
            {
              let paddedCode = uaCode.value;
              const codeLength = uaCode.value.length;
              const lengthDiff = 5 - codeLength;
              if(lengthDiff !== 0) {
                for(let i = 0; i < lengthDiff; i++) {
                  paddedCode = "0" + paddedCode
                }
              }
              return paddedCode;
            }
          ),
          layerBasePath: symbologyLayerPath,
        });
      } else {
        if (uaLayerId) {
          resetGeometryBorderFilter({
            layerId: uaLayerId,
            setState,
            layerBasePath: symbologyLayerPath,
          });
        }
      }
    } else {
      //resets dynamic filter if there are no geographies selected
      setState((draft) => {
        const zoomToFilterBounds = get(draft, `${symbPath}.zoomToFilterBounds`);
        if (zoomToFilterBounds?.length > 0) {
          set(draft, `${symbPath}.zoomToFilterBounds`, []);
        }

        // Clearing the chips MUST clear the layer's dynamic filters. This used to be
        // nested inside the zoomToFilterBounds branch, i.e. it only fired if core had
        // already resolved bounds for the selection — otherwise the last selection stayed
        // on the layer. That was invisible while the panels queried statewide; now that
        // they read `dynamic-filters`, a stale array would leave the whole panel — and
        // the download row count — filtered to a geography the viewer had removed.
        if (
          pm3LayerId &&
          get(draft, `${symbologyLayerPath}['${pm3LayerId}']['dynamic-filters']`, []).length
        ) {
          set(draft, `${symbologyLayerPath}['${pm3LayerId}']['dynamic-filters']`, []);
        }

        if (pm3LayerId) {
          set(
            draft,
            `${symbologyLayerPath}['${pm3LayerId}']['filterMode']`,
            null
          );
        }
        if (countyLayerId) {
          resetGeometryBorderFilter({
            layerId: countyLayerId,
            setState,
            layerBasePath: symbologyLayerPath,
          });
        }
        if (mpoLayerId) {
          resetGeometryBorderFilter({
            layerId: mpoLayerId,
            setState,
            layerBasePath: symbologyLayerPath,
          });
        }
        if (regionLayerId) {
          resetGeometryBorderFilter({
            layerId: regionLayerId,
            setState,
            layerBasePath: symbologyLayerPath,
          });
        }
        if (uaLayerId) {
          resetGeometryBorderFilter({
            layerId: uaLayerId,
            setState,
            layerBasePath: symbologyLayerPath,
          });
        }
      });
    }
  }, [geography]);

  // Keep dependent sub-measures (e.g. peak/percentile selectors) normalized
  // whenever the top-level measure selection changes.
  //
  // The dependency is `measureValue` (declared with the URL block above), NOT the old
  // `[isEqual(measureFilters["measure"], prevMeasureFilters)]` boolean. A boolean dep
  // fires on every FLIP, so it ran twice per measure change — once on the render where
  // the measure changed and again on the next one, when the comparison flipped back to
  // true. `updateSubMeasures` is a pure function of `measure.value` that hard-sets every
  // dependent value, so that second run was a second reset with no new information — and
  // it made "has normalization finished?" unanswerable, which is exactly what the URL
  // read has to know before it writes a non-default dependent control. On `[measureValue]`
  // the effect runs once on mount and once per measure change; same fixed point, strictly
  // less work, and `measureSettled` above is now a proof rather than a guess.
  useEffect(() => {
    setState((draft) => {
      set(
        draft,
        `${pluginDataPath}['measureFilters']`,
        updateSubMeasures(measureFilters)
      );
    });
  }, [measureValue]);

  // ── WHAT THE PANELS QUERY ──────────────────────────────────────────────────────
  // Read straight off the PM3 layer — the layer whose tiles are drawn and the one this
  // plugin writes geography into. The previous code went through `extractState`, which
  // resolves `symbology.activeLayer`; on the published page that happens to be the PM3
  // layer, but in the MapEditor it is whatever layer the author last selected, so a
  // border layer's `uace_20` / `ny_counti_4` filter would have been queried against the
  // PM3 view, which has no such column.
  const pm3Layer = useMemo(
    () => get(state, `${symbologyLayerPath}['${pm3LayerId}']`, {}),
    [state, symbologyLayerPath, pm3LayerId]
  );
  const layerFilter = pm3Layer?.filter || {};
  const layerDynamicFilters = pm3Layer?.["dynamic-filters"] || [];
  const layerFilterMode = pm3Layer?.filterMode;

  // THE filter envelope for every panel side-query. Geography chips are written into the
  // layer's `dynamic-filters` (that is what the tiles honour — see the geography effect
  // above), so the old `filterToUda(dataFilter)` — the layer's STATIC filter only — was
  // permanently empty on this layer and every panel number was statewide no matter what
  // was selected (measured 2026-08-17: Albany County selected still read "52,127
  // segments · median 1.24 · 80th 1.46 · 16.2% unreliable · Download 52,127 rows").
  // `buildLayerUdaFilterOptions` is core's own merge of the two, and it is the same rule
  // SymbologyViewLayer applies to the map's client-side filter — filterMode "any" → OR
  // across the selected families, and a column covered by the static filter wins over a
  // dynamic clause on the same column — so the panels cannot drift from the canvas.
  const udaFilter = useMemo(
    () =>
      buildLayerUdaFilterOptions({
        layerFilter,
        dynamicFilters: layerDynamicFilters,
        filterMode: layerFilterMode,
      }) || {},
    [layerFilter, layerDynamicFilters, layerFilterMode]
  );

  // ── THE GEOGRAPHY FILTER HAS TO BE RE-ASSERTED, NOT JUST SET ────────────────────
  // Core's Map component syncs EVERY layer's `dynamic-filters` to the page-variable bus
  // whenever `pageState.filters` changes (index.jsx's `dataPageFilters` effect): for each
  // dynamic-filter it looks up a page variable named after the filter's `searchParamKey ||
  // column_name` and, finding none, resets `filter.values` to the filter's `defaultValue`
  // or `[]`. This plugin's geography filters are keyed on the SOURCE columns (`county`,
  // `mpo_name`, `region_code`, `urban_code`), and the URL contract deliberately does NOT
  // use those names as page variables — a collision would hand our params to that sync —
  // so every one of them resolves to "no page variable" and gets blanked.
  //
  // Without this effect, persisting anything in the URL would silently un-filter the map:
  // pick Albany County, then change the measure, and the tile filter, the panels and the
  // download row count all snap back to statewide while the chip still says Albany. It was
  // latent before URL state existed only because nothing else wrote page filters on this
  // page.
  //
  // The repair is a pure reconciler: desired is a function of `geography`, and it writes
  // only when the layer diverges — so it converges in one pass and cannot ping-pong with
  // core's sync (which does not re-run when only layer state changes).
  const desiredDynamicFilters = useMemo(
    () => buildGeographyDynamicFilters(geography),
    [geography]
  );
  useEffect(() => {
    if (!pm3LayerId) return;
    if (isEqual(layerDynamicFilters, desiredDynamicFilters)) return;
    setState((draft) => {
      set(
        draft,
        `${symbologyLayerPath}['${pm3LayerId}']['dynamic-filters']`,
        desiredDynamicFilters
      );
      set(
        draft,
        `${symbologyLayerPath}['${pm3LayerId}']['filterMode']`,
        desiredDynamicFilters.length ? "any" : null
      );
    });
  }, [pm3LayerId, symbologyLayerPath, desiredDynamicFilters, layerDynamicFilters]);

  // The choropleth BREAKS run on their own envelope — see BREAKS_SCOPE at the top of the
  // file. Statewide: geography is dropped, so only the layer's static filter applies.
  const breaksFilter = useMemo(
    () => (BREAKS_SCOPE === "statewide" ? filterToUda(layerFilter) || {} : udaFilter),
    [layerFilter, udaFilter]
  );
  const breaksFilterKey = JSON.stringify(breaksFilter);

  // ── THE BREAK SET FOR THE SELECTED COLUMN ──────────────────────────────────────
  // AUTHORED DATA FIRST (breaks.js), the per-view `ckmeans` query only as a fallback for
  // a column the table does not cover. That inversion is the 2026-08-18 change: the
  // adaptive ramp was putting an average of 66.1 % of the coloured network into ONE colour
  // (max 89.1 %), hiding the federal 1.50 test inside a bin, and re-labelling the whole
  // legend on every year change (TED's top edge swung 163 % of its 2025 value across
  // 2021-2025). Full evidence and the per-bin shares each set produces:
  // planning/transportny/research/macroview-legend-breaks-analysis.md.
  const breakSet = useMemo(() => resolveBreakSet(measure), [measure]);

  // Apply the ramp (paint + legend-data + the panel's copy of it) whenever the selected
  // measure, filters, view, or PM3 layer change. With an authored set this runs with NO
  // query at all; only the fallback path talks to `colorDomain`.
  useEffect(() => {
    const getColors = async () => {
      const numbins = NUM_BINS;
      const showOther = "#ccc";
      let colorBreaks;
      let method;
      let count = null;

      if (breakSet) {
        method = "manual";
        // `max: null` — an authored set makes no claim about the observed maximum, so the
        // top bin is open-ended (see breaks.js). Nothing here depends on `viewId`, which
        // is the whole point: switching year cannot move an edge.
        colorBreaks = { breaks: breakSet.breaks, max: null };
      } else {
        method = "ckmeans";
        const domainOptions = {
          column: measure,
          numbins,
          method
        };

        // NOT `udaFilter` — the breaks are deliberately computed over `breaksFilter`
        // (BREAKS_SCOPE), so selecting a geography re-counts the panel WITHOUT re-ramping
        // the map underneath it.
        if (breaksFilter) Object.assign(domainOptions, breaksFilter);

        const optsKey = JSON.stringify(domainOptions);
        const res = await falcor.get([
          "uda",
          pgEnv,
          "viewsById",
          +viewId,
          "colorDomain",
          optsKey,
        ]);
        const cdResult = get(res, [
          "json",
          "uda",
          pgEnv,
          "viewsById",
          +viewId,
          "colorDomain",
          optsKey,
        ]);

        colorBreaks = (cdResult && Array.isArray(cdResult.breaks) && cdResult.breaks.length)
          ? { breaks: cdResult.breaks, max: cdResult.max }
          : { breaks: [], max: 0 };
        // the row count BEHIND THE RAMP (statewide under BREAKS_SCOPE "statewide"), kept
        // for the ramp's own provenance — the panels quote `filteredCount` instead.
        count = Number.isFinite(cdResult?.count) ? cdResult.count : null;
      }

      // The number format travels WITH the break set where one is authored: `,.2~s` is
      // right for the delay families' decade edges (100000 → "100k") and wrong for their
      // delay-hours family, where 0.1 formats as "100m" — 100 milli. Measures with no
      // authored set keep updateLegend's per-measure format.
      const { range: paintRange, format: measureFormat } = updateLegend(measureFilters);
      const format = breakSet?.format || measureFormat;
      const painted = choroplethPaint(
        measure,
        // `max` reaches choroplethPaint for ONE purpose: the upper label of the last
        // legend-data row. An authored set has no max, so the top edge stands in and the
        // label is rewritten to "<edge>+" below.
        colorBreaks.max ?? colorBreaks.breaks[colorBreaks.breaks.length - 1],
        paintRange,
        numbins,
        method,
        colorBreaks.breaks,
        showOther,
        "vertical"
      );
      // `choroplethPaint` returns FALSE on an empty domain — only reachable on the ckmeans
      // fallback path, when the route answers with no breaks. Leaving the previous ramp in
      // place keeps a rendered map; destructuring `false` would throw and blank the layer.
      if (!painted) return;
      let { paint, legend } = painted;

      // legend-data row k IS bin k (choroplethPaint pairs break k with colour k), so the
      // label is built from the BREAK NUMBERS rather than by re-parsing the string
      // choroplethPaint composed. That is not tidying: its vertical label pre-formats
      // anything over 1000 through `fnumIndex` ("21.88K"), and the old
      // `d3format(...)(label.split("- ")[1])` would have turned that into `NaN` — which is
      // exactly why PHED/TED had to skip formatting and put raw `21881.37` on screen.
      // Formatting numbers instead covers every measure, and with decade edges the delay
      // families' own `,.2~s` reads as "100k".
      const legendFormat = d3format(format);
      const domain = colorBreaks.breaks;
      legend = legend?.map((legendBreak, i) => ({
        ...legendBreak,
        label:
          i + 1 < domain.length
            ? legendFormat(domain[i + 1])
            // the top bin: `<last edge>+` for an authored (open-ended) set, the observed
            // maximum when ckmeans computed the domain.
            : breakSet
              ? `${legendFormat(domain[domain.length - 1])}+`
              : legendFormat(colorBreaks.max),
      }));

      // Lift what the map is drawing into React state so the context panel can render
      // the very same breaks/colors/count — one source of truth for "what's on screen".
      setDrawn({
        breaks: colorBreaks.breaks,
        max: colorBreaks.max,
        colors: paintRange,
        count,
        format,
        caption: breakSet
          ? { ...BREAKS_CAPTION.manual, note: breakSet.label }
          : BREAKS_CAPTION.ckmeans,
      });

      setState((draft) => {
        set(
          draft,
          `${symbologyLayerPath}['${pm3LayerId}']['layers'][1]['paint']`,
          { ...npmrdsPaint, "line-color": paint }
        ); //Mapbox paint
        set(
          draft,
          `${symbologyLayerPath}['${pm3LayerId}']['legend-data']`,
          legend
        ); //AVAIL-written legend component
        set(
          draft,
          `${symbologyLayerPath}['${pm3LayerId}']['legend-orientation']`,
          "horizontal"
        );
        set(
          draft,
          `${symbologyLayerPath}['${pm3LayerId}']['category-show-other']`,
          "#fff"
        );
        if (mpoLayerId) {
          set(
            draft,
            `${symbologyLayerPath}['${mpoLayerId}']['legend-orientation']`,
            "none"
          );
        }
        if (countyLayerId) {
          set(
            draft,
            `${symbologyLayerPath}['${countyLayerId}']['legend-orientation']`,
            "none"
          );
        }
        if (regionLayerId) {
          set(
            draft,
            `${symbologyLayerPath}['${regionLayerId}']['legend-orientation']`,
            "none"
          );
        }
        if (uaLayerId) {
          set(
            draft,
            `${symbologyLayerPath}['${uaLayerId}']['legend-orientation']`,
            "none"
          );
        }
      });
    };

    if (pm3LayerId && viewId && measure) {
      getColors();
    }
    // `breaksFilterKey` / `viewId` only matter on the ckmeans fallback path — with an
    // authored set the effect re-applies the identical numbers, which is the proof that
    // year and geography cannot move an edge.
  }, [measure, breakSet, breaksFilterKey, viewId, pm3LayerId]);

  // Author-side: warm the falcor cache with the PM3 source's available views
  // and store the resolved list in pluginData so internalPanel's (now-pure)
  // "Views" multiselect can read it back. Only meaningful in the MapEditor
  // (internalPanel is MapEditor-only), harmless to run elsewhere.
  useEffect(() => {
    const getRelatedPm3Views = async (source_id) => {
      const lengthPath = [
        "uda",
        pgEnv,
        "sources",
        "byId",
        source_id,
        "views",
        "length",
      ];
      const resp = await falcor.get(lengthPath);
      const viewsLength = get(resp.json, lengthPath, 0);
      await falcor.get([
        "uda",
        pgEnv,
        "sources",
        "byId",
        source_id,
        "views",
        "byIndex",
        { from: 0, to: viewsLength - 1 }
      ]);

      const availablePm3Views = Object.values(
        get(
          falcor.getCache(),
          ["uda", pgEnv, "sources", "byId", source_id, "views", "byIndex"],
          {}
        )
      ).map((v) =>
        getAttributes(
          get(falcor.getCache(), v.value, {})
        )
      );

      setState((draft) => {
        set(draft, `${pluginDataPath}['_availablePm3Views']`, availablePm3Views);
      });
    };

    if (pm3LayerId) {
      const source_id = get(state, `symbology.layers[${pm3LayerId}].source_id`);

      //demo'd with source 1410 `pm3`
      if (source_id) {
        getRelatedPm3Views(source_id);
      }
    }
  }, [pm3LayerId]);

  //Set initial styles for geometry borders
  //also disables popovers
  useEffect(() => {
    if(pm3LayerId) {
      setState(draft => {
        set(draft, `${symbologyLayerPath}['${pm3LayerId}'].layers[0].paint['line-width']`, 0);
      })
    }
  },[pm3LayerId])

  useEffect(() => {
    if (mpoLayerId) {
      setInitialGeomStyle({
        setState,
        layerId: mpoLayerId,
        layerBasePath: symbologyLayerPath,
      });

      setState(draft => {
        set(draft, `${symbologyLayerPath}['${mpoLayerId}'].hover`, "");
      })
    }
  }, [mpoLayerId]);
  useEffect(() => {
    if (countyLayerId) {
      setInitialGeomStyle({
        setState,
        layerId: countyLayerId,
        layerBasePath: symbologyLayerPath,
      });
      setState(draft => {
        set(draft, `${symbologyLayerPath}['${countyLayerId}'].hover`, "");
      })
    }
  }, [countyLayerId]);
  useEffect(() => {
    if (regionLayerId) {
      setInitialGeomStyle({
        setState,
        layerId: regionLayerId,
        layerBasePath: symbologyLayerPath,
      });
      setState(draft => {
        set(draft, `${symbologyLayerPath}['${regionLayerId}'].hover`, "");
      })
    }
  }, [regionLayerId]);
  useEffect(() => {
    if (uaLayerId) {
      setInitialGeomStyle({
        setState,
        layerId: uaLayerId,
        layerBasePath: symbologyLayerPath,
      });
      setState(draft => {
        set(draft, `${symbologyLayerPath}['${uaLayerId}'].hover`, "");
      })
    }
  }, [uaLayerId]);
  /**
   * END PLUGIN-CONTROL SIDE EFFECTS
   */

  /**
   * START PANEL SIDE-QUERIES (stats.js) — none of these touch what the map draws.
   */
  const breaksKey = JSON.stringify(drawn.breaks);
  const udaFilterKey = JSON.stringify(udaFilter);

  // median · 80th pctl · rows beyond the threshold
  useEffect(() => {
    let cancelled = false;
    setStats(null);
    if (!measure || !viewId) return undefined;
    fetchMeasureStats({
      falcor,
      pgEnv,
      viewId,
      column: measure,
      udaFilter,
      threshold: record?.threshold ?? null,
    })
      .then((res) => { if (!cancelled) setStats(res); })
      .catch(() => { if (!cancelled) setStats(null); });
    return () => { cancelled = true; };
  }, [measure, viewId, udaFilterKey, record?.threshold]);

  // per-bin row counts over the bins the map is drawing, PLUS the no-data count —
  // `{ counts, noData }`. The two are reported separately because the column can be NULL
  // (PHED/TED are computed on urbanized-area segments only, ~59 % of the 2025 network has
  // no value), and those rows are painted grey rather than binned. The panel states the
  // no-data figure; it never adds it to a bin.
  useEffect(() => {
    let cancelled = false;
    setBinCounts(null);
    if (!measure || !viewId || !drawn.breaks?.length) return undefined;
    fetchBinCounts({ falcor, pgEnv, viewId, column: measure, udaFilter, breaks: drawn.breaks })
      .then((res) => { if (!cancelled) setBinCounts(res); })
      .catch(() => { if (!cancelled) setBinCounts(null); });
    return () => { cancelled = true; };
  }, [measure, viewId, udaFilterKey, breaksKey]);

  // ROWS IN THE CURRENT FILTER — the one number three surfaces quote: the distribution's
  // "N segments", the dock pill's "Download N rows" and the builder's "Current filters"
  // scope. It is a `length` over the SAME envelope the panels query and the SAME rows
  // the create-download `-where` clause selects, so what the pill offers is what the file
  // contains. It cannot come from `colorDomain.count` any more: with BREAKS_SCOPE
  // "statewide" that count is deliberately statewide.
  useEffect(() => {
    let cancelled = false;
    setFilteredCount(null);
    if (!viewId) return undefined;
    const optsKey = JSON.stringify(udaFilter || {});
    const path = ["uda", pgEnv, "viewsById", +viewId, "options", optsKey, "length"];
    falcor
      .get(path)
      .then((res) => {
        const n = get(res, ["json", ...path], get(falcor.getCache(), path));
        if (!cancelled) setFilteredCount(Number.isFinite(+n) ? +n : null);
      })
      .catch(() => { if (!cancelled) setFilteredCount(null); });
    return () => { cancelled = true; };
  }, [viewId, pgEnv, udaFilterKey]);

  // the unfiltered row count for the year — the download builder's "statewide" scope
  useEffect(() => {
    let cancelled = false;
    setTotalCount(null);
    if (!viewId) return undefined;
    const optsKey = JSON.stringify({});
    const path = ["uda", pgEnv, "viewsById", +viewId, "options", optsKey, "length"];
    falcor
      .get(path)
      .then((res) => {
        const n = get(res, ["json", ...path], get(falcor.getCache(), path));
        if (!cancelled) setTotalCount(Number.isFinite(+n) ? +n : null);
      })
      .catch(() => { if (!cancelled) setTotalCount(null); });
    return () => { cancelled = true; };
  }, [viewId, pgEnv]);

  // worst-N — only queried once the list is actually opened
  useEffect(() => {
    let cancelled = false;
    if (!worstOpen) return undefined;
    setWorst(null);
    if (!measure || !viewId) return undefined;
    fetchWorstSegments({ falcor, pgEnv, viewId, column: measure, udaFilter, limit: WORST_SEGMENT_LIMIT })
      .then((res) => { if (!cancelled) setWorst(res || []); })
      .catch(() => { if (!cancelled) setWorst([]); });
    return () => { cancelled = true; };
  }, [worstOpen, measure, viewId, udaFilterKey]);

  // segment lookup — debounced, and it SELECTS: it never writes a map filter
  useEffect(() => {
    if (searchTerm.trim().length < 3) {
      setSearchResults(null);
      return undefined;
    }
    let cancelled = false;
    setSearchResults(null);
    const id = setTimeout(() => {
      fetchSegmentMatches({ falcor, pgEnv, viewId, column: measure, udaFilter, term: searchTerm })
        .then((res) => { if (!cancelled) setSearchResults(res || []); })
        .catch(() => { if (!cancelled) setSearchResults([]); });
    }, 350);
    return () => { cancelled = true; clearTimeout(id); };
  }, [searchTerm, measure, viewId, udaFilterKey]);

  // Selecting a segment moves the CAMERA (and records the selection); it must never
  // change what the map draws. Tiles are the only geometry available, so this can only
  // fly to a segment whose tile is already loaded — otherwise the selection is still
  // recorded and the panel says so.
  const selectSegment = (row) => {
    setSelected(row);
    try {
      const layer = get(state, `${symbologyLayerPath}['${pm3LayerId}']`, {});
      const sourceId = get(layer, ["sources", 0, "id"]);
      const sourceLayer = get(layer, ["layers", 0, "source-layer"]);
      if (!map || !sourceId || !sourceLayer) return;
      const feats = map.querySourceFeatures(sourceId, {
        sourceLayer,
        filter: ["==", ["get", "tmc"], row.tmc],
      });
      if (!feats?.length) return;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      feats.forEach((f) => {
        const lines = f.geometry?.type === "MultiLineString"
          ? f.geometry.coordinates
          : [f.geometry?.coordinates || []];
        lines.forEach((line) =>
          (line || []).forEach(([x, y]) => {
            if (!Number.isFinite(x) || !Number.isFinite(y)) return;
            minX = Math.min(minX, x); maxX = Math.max(maxX, x);
            minY = Math.min(minY, y); maxY = Math.max(maxY, y);
          })
        );
      });
      if (Number.isFinite(minX) && Number.isFinite(minY)) {
        map.fitBounds([[minX, minY], [maxX, maxY]], { padding: 120, maxZoom: 14 });
      }
    } catch (err) {
      // a camera move is never worth breaking the panel over
      console.warn("macroview: could not fly to segment", err);
    }
  };
  /**
   * END PANEL SIDE-QUERIES
   */

  /**
   * polling stuff for requested download
   */
  useEffect(() => {
    if ((downloadFileName) && !viewDownloads[downloadFileName]) {
      setPolling(true);
    } else if ((downloadFileName) && viewDownloads[downloadFileName]){
      const downloadFile = (url, filename) => {
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      };
      const splitFilePath = viewDownloads[downloadFileName].split("/");
      const fileName = splitFilePath[splitFilePath.length-1];

      const downloadUrl = viewDownloads[downloadFileName].replace(
        "$HOST",
        `${DAMA_HOST}`
      );

      downloadFile(downloadUrl, fileName);
      setPolling(false);
      setDownloadFileName("")
    } else {
      setPolling(false);
      setDownloadFileName("")
    }
  }, [downloadFileName, viewDownloads]);

  //Gets the view so we can determine if our file is ready for download
  const doPolling = async () => {
    falcor.invalidate(["uda", pgEnv, "viewsById"]);
    falcor.invalidate(fetchViewPath);
    falcor.get(fetchViewPath).then(resp => {
      let out = get(
          resp,
          [
            "json",
            "uda", pgEnv, "views","byId", viewId
          ],
          {}
        );
      setView(out)
    });
  };

  //Gets the view for normal use cases (on load, map view changes, etc.)
  useEffect(() => {
    falcor.get(fetchViewPath).then((resp) => {
      let out = get(
        resp,
        [
          "json",
          "uda",
          pgEnv,
          "views",
          "byId",
          viewId,
        ],
        {}
      );
      setView(out);
    });
  }, [pgEnv, viewId]);


  useEffect(() => {
    // -- start polling
    if (polling && !pollingInterval) {
      let id = setInterval(doPolling, 10000);
      setPollingInterval(id);
    }
    // -- stop polling
    else if (pollingInterval && !polling) {
      clearInterval(pollingInterval);
      // run polling one last time in case it never finished
      doPolling();
      setPolling(false);
      setPollingInterval(null);
    }
  }, [polling, pollingInterval]);
  /**
   * end polling
   */

  const fmt = useMemo(() => d3format(drawn.format || ",.2~f"), [drawn.format]);

  // The bins the map is actually painting: the ramp's domain (breaks[0] IS the floor,
  // not an edge) paired with the same colour ramp the paint expression uses.
  //
  // The LAST bin's `to` is `null` when the domain came from an authored set — the top bin
  // is genuinely open-ended, and a fixed ramp must not quote a per-year maximum
  // (breaks.js). Everything downstream reads `to` defensively: the tick row prints no
  // label for it, the threshold marker only ever falls inside an interior bin, and
  // worstBinIndex has always keyed on `from` alone.
  const legend = useMemo(() => {
    const b = drawn.breaks || [];
    return b.map((lo, i) => ({
      from: lo,
      to: i + 1 < b.length ? b[i + 1] : (Number.isFinite(drawn.max) ? drawn.max : null),
      color: drawn.colors?.[i] || "#a1a1aa",
    }));
  }, [drawn]);

  // ── THE WORST-N POINT OVERLAY ──────────────────────────────────────────────────
  // Tied to the SAME toggle as the list (Alex, 2026-08-17: "when the worst segments are
  // turned on a layer should turn on with points at the center of each segment scaled in
  // size to the value, with the color of the legend for that segment"), and fed by the
  // SAME query — `worst` already carries a centre point per row (stats.js PT_X_ATTR /
  // PT_Y_ATTR), so the points cannot be a different set of segments than the rows.
  //
  // It inherits the geography scope for free: `fetchWorstSegments` runs under `udaFilter`,
  // the merged static + `dynamic-filters` envelope, so selecting a county re-queries and
  // the points move with it — no separate filtering path to keep in sync.
  //
  // `legend` gates it: with no breaks resolved there is no bin colour to give a point, and
  // a point in a made-up colour would contradict the map underneath it.
  const worstFeatures = useMemo(
    () => (worstOpen && legend.length ? buildWorstPointFeatures(worst, legend) : []),
    [worstOpen, worst, legend]
  );

  useEffect(() => {
    if (!map) return undefined;
    if (!worstFeatures.length) {
      removeWorstPoints(map);
      return undefined;
    }
    drawWorstPoints(map, worstFeatures);
    // A basemap change replaces the whole style (MapActions.setMapStyle →
    // maplibreMap.setStyle), taking every custom source and layer with it, and core then
    // re-adds ITS layers on top. Re-drawing on `styledata` both restores the overlay and
    // re-asserts its z-order; drawWorstPoints is idempotent, and `setData: false` keeps
    // the re-assert from re-pushing data on ordinary style churn.
    const redraw = () => drawWorstPoints(map, worstFeatures, { setData: false });
    map.on("styledata", redraw);
    return () => { map.off("styledata", redraw); };
    // NOT removed on cleanup: cleanup also runs on every dependency change, and removing
    // + re-adding would flash the overlay off on each re-query. Teardown is the empty
    // branch above (toggle off) and the plugin's own `cleanup` (unmount).
  }, [map, worstFeatures]);

  // the view's own coverage window — not a hard-coded range
  const dates = get(view, ["metadata", "dates"], null);
  const day = (d) => (typeof d === "string" ? d.slice(0, 10) : "");

  return (
    <>
      <ControlsPanel
        pluginDataPath={pluginDataPath}
        setState={setState}
        pluginData={pluginData}
        yearLabel={yearLabel}
      />
      <ContextPanel
        record={record}
        measureColumn={measure}
        legend={legend}
        breaksCaption={drawn.caption}
        binCounts={binCounts?.counts}
        noDataCount={binCounts?.noData ?? null}
        stats={stats}
        drawnCount={filteredCount}
        fmt={fmt}
        fmtCount={fmtCount}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        searchResults={searchResults}
        onSelectSegment={selectSegment}
        worst={worst}
        worstOpen={worstOpen}
        setWorstOpen={setWorstOpen}
        worstLimit={WORST_SEGMENT_LIMIT}
        selected={selected}
        clearSelected={() => setSelected(null)}
        onOpenDownload={openBuilder}
      />
      <MapChrome
        freshFrom={day(dates?.[0])}
        freshTo={day(dates?.[1])}
        yearLabel={yearLabel}
        rowCount={filteredCount}
        fmtCount={fmtCount}
        onOpenDownload={openBuilder}
        // `polling` is exactly "the server is building the file": set when a download has been
        // requested but `view.metadata.download[hash]` has not appeared yet, cleared the moment it
        // does (and the browser download fires) or if the request never produced a name.
        downloading={polling}
      />
      <DownloadBuilder
        open={modalState.open}
        onClose={() => setModalOpen(false)}
        fileType={modalState.fileType}
        setFileType={(fileType) => setModalState((cur) => ({ ...cur, fileType }))}
        scope={scope}
        setScope={setScope}
        columns={modalState.columns}
        toggleColumn={setColumns}
        sourceDataColumns={sourceDataColumns}
        measureColumn={measure}
        filteredCount={filteredCount}
        totalCount={totalCount}
        geography={geography}
        yearLabel={yearLabel}
        fmtCount={fmtCount}
        loading={modalState.loading}
        existingUrl={existingDownloadUrl}
        error={modalState.error}
        onSubmit={createDownload}
      />
    </>
  );
};

export { Comp };
