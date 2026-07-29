import { useState, useEffect, useContext } from "react";
import { get } from "lodash-es";
import { CMSContext } from "../../../../../dms/packages/dms/src";
import { MapEditorContext } from "../../../../../dms/packages/dms/src/patterns/mapeditor/context";

export const useRouteData = (state, pluginDataPath, view_id, tmc_array, pgEnv) => {
  const [tmcData, setTmcData] = useState([]);
  const mctx = useContext(MapEditorContext);
  const cctx = useContext(CMSContext);
  const ctx = mctx?.falcor ? mctx : cctx;
  const { falcor } = ctx;

  const tmcMetaOptions = JSON.stringify({
    filter: { tmc: tmc_array || [] },
  });

  const fetchGeomPath = [
    "uda",
    pgEnv,
    "viewsById",
    view_id,
    "options",
    tmcMetaOptions,
    "dataByIndex",
    { from: 0, to: 200 },
    ["tmc", "miles", "intersection"],
  ];

  useEffect(() => {
    if (view_id && tmc_array && tmc_array.length > 0) {
      falcor.get(fetchGeomPath).then((res) => {
        const geomDataPath = fetchGeomPath.slice(0, -2);
        const geomDataRes = get(res, ["json", ...geomDataPath]);
        const filteredTmcData = Object.values(geomDataRes || {}).filter(
          (tData) => typeof tData?.miles === "number",
        );
        setTmcData(filteredTmcData);
      });
    } else {
      setTmcData([]);
    }
  }, [tmc_array, view_id]);

  return { tmcData };
};
