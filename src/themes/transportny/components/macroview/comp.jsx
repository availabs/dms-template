import React, {useState, useMemo, useEffect} from "react";
import {get, set, isEqual } from "lodash-es";
import { format as d3format } from "d3-format";
import { filters, updateSubMeasures, getMeasure, updateLegend } from "./updateFilters";
import { extractState, createFalcorFilterOptions, filterToUda } from "../../../../dms/packages/dms/src/patterns/mapeditor/MapEditor/stateUtils"
import { measure_info } from "./measures";
import { ThemeContext } from "../../../../dms/packages/dms/src/ui/useTheme";
import { CMSContext } from "../../../../dms/packages/dms/src";
import { MapEditorContext } from "../../../../dms/packages/dms/src/patterns/mapeditor/context";
import { choroplethPaint } from "../../../../dms/packages/dms/src/patterns/mapeditor/MapEditor/components/LayerEditor/datamaps";
import {
  PM3_LAYER_KEY,
  MPO_LAYER_KEY,
  COUNTY_LAYER_KEY,
  REGION_LAYER_KEY,
  UA_LAYER_KEY,
} from "./constants";
import {
  setGeometryBorderFilter,
  resetGeometryBorderFilter,
  setInitialGeomStyle,
  buildGeomControlOptions,
  getAttributes,
  usePrevious,
} from "./utils";
import { npmrdsPaint } from "./paint";
const INITIAL_MODAL_STATE = {
    open: false,
    loading: false,
    columns: [],
    uniqueFileNameBase: '',
    fileType:"GPKG",
    downloadContextId: ''
}
const metaColumnNames = [
  "ogc_fid",
  "tmc",
  "urban_code",
  "region_code",
  "county",
  "ua_name",
  "mpo_code",
  "mpo_name",
  "wkb_geometry",
  "year",
];
//creates a unique identifier regardless of how many columns the user selects
async function hashString(inputString) {
  // 1. Encode the string to a Uint8Array
  const encoder = new TextEncoder();
  const data = encoder.encode(inputString);

  // 2. Hash the data with SHA-256
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);

  // 3. Convert the ArrayBuffer to a 64-character hexadecimal string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return hashHex;
}

const Comp = ({ state, setState }) => {
  /**
   * START MODAL STUFF
   */
  const { UI } = React.useContext(ThemeContext) || {};
  const mctx = React.useContext(MapEditorContext);
  const cctx = React.useContext(CMSContext);
  const ctx = mctx?.falcor ? mctx : cctx;
  let { falcor, falcorCache, pgEnv, baseUrl, user } = ctx;
  // Only CMSContext (published pages) carries fileUploadInfo.DAMA_HOST today -
  // MapEditorContext has no equivalent, so the data-downloader button is a
  // no-op in the authoring context until that's added upstream.
  const DAMA_HOST = cctx?.fileUploadInfo?.DAMA_HOST || cctx?.API_HOST;
  const [polling, setPolling ] = React.useState(false);
  const [pollingInterval, setPollingInterval] = React.useState(false);
  const [downloadFileName, setDownloadFileName] = React.useState("");
  const [view, setView] = React.useState({});

  if (!falcorCache) {
    falcorCache = falcor.getCache();
  }
  const [modalState, setModalState] = useState(INITIAL_MODAL_STATE);

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

  // shared by the download modal below and the plugin-control/color-domain
  // effects further down — this is the single "which measure is selected" value.
  const measure = getMeasure(measureFilters);

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

  const viewDownloads = useMemo(() => {
    return get(view, ['metadata',  'download'])
  }, [view]);

  const fileNameBase = useMemo(() => {
    let nameBase = "";
    if(modalState.columns.length > 0) {
      const joinedCols = modalState.columns.sort().join("_");
      nameBase = `${view?.version ?? viewId}_${joinedCols}`;
    }

    if (geography) {
      geography.forEach((geoFilt) => {
        nameBase += `_${geoFilt.type}_${geoFilt.value}`;
      });
    }

    nameBase += modalState.fileType;
    return nameBase;
  }, [modalState.columns, geography, view, viewId])
  useEffect(() => {
    const getUniqueFileNameBase = async () => {
      const uniqueFileNameBase = await hashString(fileNameBase);
      setModalState(({...modalState, uniqueFileNameBase}))
    }

    getUniqueFileNameBase()
  }, [fileNameBase])

  const downloadAlreadyExists = useMemo(() => {
    return Object.keys(viewDownloads || {}).includes(modalState.uniqueFileNameBase);
  }, [viewDownloads, modalState.uniqueFileNameBase])

  const createDownload = () => {
      const runCreate = async () => {
      if(!downloadAlreadyExists) {
          try {
            //IF WE HAVE GEOMETRY SELECTED, PASS IT HERE
              const createData = {
                  source_id: sourceId,
                  view_id: viewId,
                  columns: modalState.columns,
                  user_id: user.id,
                  email: user.email,
                  downloadProps:{
                    geographyFilter: geography,
                    measure,
                  },
                  fileTypes:[modalState.fileType]
              };

              setModalState({...modalState, loading: true});
              const res = await fetch(
                `${DAMA_HOST}/dama-admin/${pgEnv}/gis-dataset/create-download`,
                {
                  method: "POST",
                  body: JSON.stringify(createData),
                  headers: {
                    "Content-Type": "application/json",
                  },
                }
              );

              await res.json();

              setDownloadFileName(modalState.uniqueFileNameBase);
              setModalState(INITIAL_MODAL_STATE);
          } catch (err) {
              console.log(err)
              setModalState({...modalState, loading: false, open: true});
          }
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
   * END MODAL STUFF
   */

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
   * so it's the correct home for anything stateful/effectful. The now-pure
   * `externalPanel`/`internalPanel` functions read the results back out of
   * shared state via plain `get()` calls.
   */

  // Geography dropdown options — fetched once per view, transformed, and
  // written into pluginData so the (now-pure) externalPanel can read it back.
  const geomOptions = JSON.stringify({
    groupBy: ["urban_code", "region_code", "mpo_name", "county"],
  });

  const fetchGeomPath = [
    "uda",
    pgEnv,
    "viewsById",
    viewId,
    "options",
    geomOptions,
    "dataByIndex",
    { from: 0, to: 200 },
    ["urban_code", "region_code", "mpo_name", "county"],
  ];

  useEffect(() => {
    if (viewId) {
      falcor.get(fetchGeomPath).then((res) => {
        const geomDataPath = fetchGeomPath.slice(0, -2);
        const geomDataRes = get(res, ["json", ...geomDataPath]);
        setState((draft) => {
          set(
            draft,
            `${pluginDataPath}['geomControlOptions']`,
            buildGeomControlOptions(geomDataRes)
          );
        });
      });
    }
  }, [viewId]);

  // Selecting geography filters/highlights the matching border layers.
  useEffect(() => {
    const getFilterBounds = async () => {
      //need array of [{column_name:foo, values:['bar', 'baz']}]
      //geography is currently [{name: foo, value: 'bar', type:'baz'}]

      //loop thru, gather like terms
      const selectedGeographyByType = geography.reduce((acc, curr) => {
        if (!acc[curr.type]) {
          acc[curr.type] = [];
        }
        acc[curr.type].push(curr.value);
        return acc;
      }, {});
      const geographyFilter = Object.keys(selectedGeographyByType).map(
        (column_name) => {
          return {
            display_name: column_name,
            column_name,
            values: selectedGeographyByType[column_name],
            zoomToFilterBounds: true,
          };
        }
      );
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

          set(
            draft,
            `${symbologyLayerPath}['${pm3LayerId}']['dynamic-filters']`,
            []
          );
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
  const prevMeasureFilters = usePrevious(measureFilters["measure"]);
  useEffect(() => {
    setState((draft) => {
      set(
        draft,
        `${pluginDataPath}['measureFilters']`,
        updateSubMeasures(measureFilters)
      );
    });
  }, [isEqual(measureFilters["measure"], prevMeasureFilters)]);

  const { existingDynamicFilter, filter: dataFilter, filterMode } = useMemo(() => {
    if (mctx) {
      return extractState(state);
    } else {
      const symbName = Object.keys(state.symbologies)[0];
      const symbPathBase = `symbologies['${symbName}']`;
      const symbData = get(state, symbPathBase, {});
      return extractState(symbData);
    }
  }, [state]);

  const falcorDataFilter = useMemo(() => {
    return createFalcorFilterOptions({
      dynamicFilter: existingDynamicFilter,
      filterMode,
      dataFilter,
    });
  }, [existingDynamicFilter, filterMode, dataFilter]);

  // Recompute the choropleth color domain/legend whenever the selected
  // measure, filters, view, or PM3 layer change.
  useEffect(() => {
    const getColors = async () => {
      const numbins = 7,
        method = "ckmeans";
      const domainOptions = {
        column: measure,
        numbins,
        method
      };

      const udaFilter = filterToUda(dataFilter);
      if (udaFilter) Object.assign(domainOptions, udaFilter);

      const showOther = "#ccc";
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

      const colorBreaks = (cdResult && Array.isArray(cdResult.breaks) && cdResult.breaks.length)
        ? { breaks: cdResult.breaks, max: cdResult.max }
        : { breaks: [], max: 0 };

      //format is used to format legend labels
      const { range: paintRange, format } = updateLegend(measureFilters);
      let { paint, legend } = choroplethPaint(
        measure,
        colorBreaks.max,
        paintRange,
        numbins,
        method,
        colorBreaks.breaks,
        showOther,
        "vertical"
      );

      const legendFormat = d3format(format);
      legend = legend?.map((legendBreak) => {
        const shouldFormat =
          !measure.toLowerCase().includes("phed") &&
          !measure.toLowerCase().includes("ted");
        return {
          ...legendBreak,
          label: shouldFormat
            ? legendFormat(legendBreak.label.split("- ")[1])
            : legendBreak.label.split("- ")[1],
        };
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
        //TODO add `no legend` for region, UA layers
      });
    };

    if (pm3LayerId && viewId) {
      getColors();
    }
  }, [measure, falcorDataFilter, viewId, pm3LayerId]);

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

  let measureDefintion = "",
    measureEquation = "";
  if (measure.includes("lottr")) {
    //definition needs period
    const { definition: definitionFunction, equation: equationFunction } =
      measure_info["lottr"];
    const curPeriod = measureFilters["peakSelector"].value;
    measureDefintion = definitionFunction({ period: curPeriod });
    measureEquation = equationFunction();
  } else if (measure.includes("tttr")) {
    const { definition: definitionFunction, equation: equationFunction } =
      measure_info["tttr"];
    //equation needs period
    const curPeriod = measureFilters["peakSelector"].value;
    measureDefintion = definitionFunction();
    measureEquation = equationFunction({ period: curPeriod });
  } else if (measure.includes("phed") || measure.includes("ted")) {
    const { definition: definitionFunction, equation: equationFunction } =
      measure_info["phed"];
    //definition needs freeflow and trafficType
    const curFreeflow = measureFilters["freeflow"].value
      ? "the freeflow speed"
      : "the posted speed limit";
    const curTrafficType = measureFilters["trafficType"].value;
    measureDefintion = definitionFunction({
      freeflow: curFreeflow,
      trafficType: curTrafficType,
    });
    measureEquation = equationFunction();
  } else if (measure.includes("speed")) {
    const { definition: definitionFunction, equation: equationFunction } =
      measure_info["speed"];
    //definition needs period
    // const curPeriod = measureFilters['peakSelector'].value;
    const curPercentile = measureFilters["percentiles"]?.value;
    measureDefintion = definitionFunction({ percentile: curPercentile });
    measureEquation = equationFunction();
  }

  const displayInfo = measureDefintion.length > 0 || measureEquation.length;

  const modalStyle = {
    display: "none",
    position: "fixed",
    top: "0",
    left: "-55vw",
    width:"50vw",
    height:"60vh",
    backgroundColor: "white",
    padding: "20px",
    borderRadius: "5px",
    boxShadow: "0 0 10px rgba(0, 0, 0, 0.3)",
    zIndex: 1001,
    opacity: ".9"
  };

  if(modalState.open) {
    modalStyle.display="block"
  }

  return (
    displayInfo && (
      <div
        className="flex flex-col pointer-events-auto drop-shadow-lg p-4 bg-white/75"
        style={{
          position: "absolute",
          top: "94px",
          // transportNY's original offset (-168px) assumes a narrower map container
          // with room to spill into on the right - dms-template's Map section
          // container is wider, so that value clips the panel off-screen.
          right: "8px",
          color: "black",
          width: "318px",
          maxHeight: "325px",
        }}
      >
        <div className="flex flex-col border-b-2 border-black">
          {measureDefintion.length > 0 && (
            <div className="m-2  pb-2 px-1">
              <div className="font-semibold text-lg">Measure Definition</div>
              <div className="font-semibold text-sm">{measureDefintion}</div>
            </div>
          )}
          {measureEquation.length > 0 && (
            <div className="m-2  pb-2 px-1">
              <div className="font-semibold text-lg">Equation</div>
              <div className="font-semibold text-sm">{measureEquation}</div>
            </div>
          )}
        </div>
        <div>

          <UI.Button
            disabled={(downloadFileName && !viewDownloads[downloadFileName])}
            themeOptions={{ color: "transparent" }}
            onClick={(e) => {
              setModalState({...modalState, open: true, columns:['tmc', measure]})
            }}
            style={{ width: "100%", marginTop: "10px" }}
          >
            {(downloadFileName && !viewDownloads[downloadFileName]) ? ( <span >
                  <i
                    className={"fa-solid fa-spin fa-spinner mr-2"}
                    aria-hidden="true"
                  ></i>
                  Creating Download
                </span>
              ) : "Open Data Downloader"
            }

          </UI.Button>


        </div>
        <CreateDownloadModal
          view={view}
          viewId={viewId}
          geography={geography}
          modalState={modalState}
          modalStyle={modalStyle}
          sourceDataColumns={sourceDataColumns}
          downloadAlreadyExists={downloadAlreadyExists}
          viewDownloads={viewDownloads}
          createDownload={createDownload}
          setModalState={setModalState}
          setColumns={setColumns}
          setModalOpen={setModalOpen}
          DAMA_HOST={DAMA_HOST}
        />
      </div>
    )
  );
};

const CreateDownloadModal = ({
  view,
  viewId,
  geography,
  modalState,
  modalStyle,
  setModalState,
  setColumns,
  setModalOpen,
  sourceDataColumns,
  downloadAlreadyExists,
  createDownload,
  viewDownloads,
  DAMA_HOST,
}) => {
  const { UI } = React.useContext(ThemeContext) || {};
  return (
    <div style={modalStyle}>
      <div className="flex flex-col h-[100%]">
        <div className="flex items-center m-1">
          <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10">
            <i
              className="fad fa-layer-group text-blue-600"
              aria-hidden="true"
            />
          </div>
          <div className="mt-3 text-center sm:ml-2 sm:mt-0 sm:text-left w-full">
            <div className="text-lg align-center font-semibold leading-6 text-gray-900">
              Create Data Download
            </div>
          </div>
        </div>
        <div className="flex gap-4 h-[100%]">
          <div className="flex flex-col gap-4 w-[25%]">
            <div>
              <div className=" border-b-2 text-lg font-bold">Year:</div>
              {view?.version ?? viewId}
            </div>
            {geography && geography.length ? (
              <div className="capitalize">
                <div className=" border-b-2 text-lg font-bold">Geography:</div>
                {geography.map((geo) => geo.name).join(", ")}
              </div>
            ) : (
              <></>
            )}
            <div className="flex flex-col">
              <div className=" border-b-2 text-lg font-bold">File Type:</div>
              <div className="flex">
                <input
                  type="radio"
                  value="CSV"
                  id="CSV"
                  name="CSV"
                  checked={modalState.fileType === "CSV"}
                  onChange={(e) =>
                    setModalState({ ...modalState, fileType: e.target.value })
                  }
                />

                <label htmlFor={"CSV"} className="text-sm text-gray-900 mx-1">
                  CSV
                </label>
                <input
                  type="radio"
                  value="GPKG"
                  id="GPKG"
                  name="GPKG"
                  checked={modalState.fileType === "GPKG"}
                  onChange={(e) =>
                    setModalState({ ...modalState, fileType: e.target.value })
                  }
                />
                <label htmlFor={"GPKG"} className="text-sm text-gray-900 mx-1">
                  GPKG
                </label>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-4 w-[37%]">
            <div className="flex flex-col h-[50%]">
              <div className=" border-b-2 border-black text-xl font-bold">Metadata</div>
              <DownloadColumnList
                columns={modalState.columns.filter((opt) =>
                  metaColumnNames.includes(opt)
                ).map(opt => sourceDataColumns.find(col => col.name === opt))}
                setColumns={setColumns}
              />
            </div>
            <div className="flex flex-col h-[100%]">
              <div className=" border-b-2 border-black text-xl font-bold">
                Performance Measures
              </div>
              <DownloadColumnList
                columns={modalState.columns.filter(
                  (opt) => !metaColumnNames.includes(opt)
                ).map(opt => sourceDataColumns.find(col => col.name === opt))}
                setColumns={setColumns}
                maxHeight="50%"
              />
            </div>
          </div>
          <div className="flex flex-col gap-4 w-[36%]">
            <div className="h-[32.75%]">
              <div className=" border-b-2 text-lg font-bold">Add Metadata</div>
              <UI.Select
                searchable={true}
                placeholder={"Select a metadata..."}
                options={sourceDataColumns
                  .filter((opt) => metaColumnNames.includes(opt.name))
                  .filter((opt) => !modalState.columns.includes(opt.name))
                  .map((opt) => ({ label: opt.display_name || opt.name, value: opt.name }))}
                value={""}
                onChange={(e) => setColumns(e)}
              />
            </div>
            <div>
              <div className=" border-b-2 text-lg font-bold">Add Measures</div>
              <UI.Select
                searchable={true}
                placeholder={"Select a measure..."}
                options={sourceDataColumns
                  .filter((opt) => !metaColumnNames.includes(opt.name))
                  .filter((opt) => !modalState.columns.includes(opt.name))
                  .map((opt) => ({ label: opt.display_name || opt.name, value: opt.name }))}
                value={""}
                onChange={(e) => setColumns(e)}
              />
            </div>
          </div>
        </div>
        <div className="absolute" style={{ bottom: "20px", right: "20px" }}>
          <div className="flex mt-2 text-sm items-center flex-row-reverse">
            One or more columns must be selected
            {modalState.columns.length > 0 ? (
              <i className="fa-solid fa-circle-check mr-2 text-green-700" aria-hidden="true" />
            ) : (
              <i className="fa-solid fa-circle-xmark mr-2 text-red-700" aria-hidden="true" />
            )}
          </div>
          <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              disabled={
                modalState.loading ||
                modalState.columns.length === 0 ||
                modalState.columns.some((colName) => colName.includes(" "))
              }
              className="disabled:bg-slate-300 disabled:cursor-warning inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 sm:ml-3 sm:w-auto"
              onClick={downloadAlreadyExists ? () => {} : createDownload}
            >
              {downloadAlreadyExists ? (
                <a
                  href={viewDownloads[modalState.uniqueFileNameBase].replace(
                    "$HOST",
                    `${DAMA_HOST}`
                  )}
                >
                  Download data
                </a>
              ) : modalState.loading ? (
                "Sending request..."
              ) : (
                "Start download creation"
              )}
            </button>
            <button
              type="button"
              className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const DownloadColumnList = ({ columns, setColumns, maxHeight }) => {
  return (
    <div
      style={{ maxHeight, overflowY: 'auto', minHeight:"20%" }}
      className="w-full"
    >
      {columns.map((col) => {
        return (
          <div
            className="flex justify-between px-1 border-2 border-transparent hover:border-black font-semibold "
            key={`selected_col_${col.name}`}
          >
            <div>{col.display_name || col.name}</div>
            <div
              className="font-bold cursor-pointer"
              onClick={() => setColumns(col.name)}
            >
              X
            </div>
          </div>
        );
      })}
    </div>
  );
};

export { Comp };
