import React, { useCallback, useContext, useEffect, useState } from 'react';
import { get, cloneDeep } from 'lodash-es';
import { ComponentContext, PageContext, CMSContext } from "../../../../dms/packages/dms/src/patterns/page/context";
import { ThemeContext, getComponentTheme } from '../../../../dms/packages/dms/src/ui/useTheme'
import { reportRouteListTheme } from './ReportRouteList.theme';
import { buildUdaConfig } from '../../../../dms/packages/dms/src/patterns/page/components/sections/components/dataWrapper/buildUdaConfig';
import { nameToSlug } from '../../../../dms/packages/dms/src/utils/type-utils';

// Helper functions based on useDataSource.js
const getSources = async (falcor, envs) => {
  const sources = await Promise.all(
    Object.keys(envs).map(async (e) => {
      const lenRes = await falcor.get(["uda", e, "sources", "length"]);
      const len = get(lenRes, ["json", "uda", e, "sources", "length"]);
      if (!len) return [];
      const r = await falcor.get(["uda", e, "sources", "byIndex", { from: 0, to: len - 1 }, envs[e].srcAttributes]);
      return Array.from({ length: len }, (_, i) => i).map((i) => {
        const metadata = get(r, ["json", "uda", e, "sources", "byIndex", i, "metadata"]);
        return {
          source_id: get(r, ["json", "uda", e, "sources", "byIndex", i, "$__path", 4]),
          name: get(r, ["json", "uda", e, "sources", "byIndex", i, "name"]),
          srcEnv: e,
          columns: metadata?.columns || [],
        };
      });
    })
  );
  return sources.flat();
};

const getViews = async (falcor, sourceId, srcEnv, viewAttributes) => {
  console.log({viewAttributes})
  const lenRes = await falcor.get(["uda", srcEnv, "sources", "byId", sourceId, "views", "length"]);
  const len = get(lenRes, ["json", "uda", srcEnv, "sources", "byId", sourceId, "views", "length"]);
  if (!len) return [];
  const byIndexRes = await falcor.get(["uda", srcEnv, "sources", "byId", sourceId, "views", "byIndex", { from: 0, to: len - 1 }, viewAttributes]);
  console.log({byIndexRes})
  return Array.from({ length: len }, (_, i) => i).map((i) =>  ({
    view_id: get(byIndexRes, ["json", "uda", srcEnv, "sources", "byId", sourceId, "views", "byIndex", i, "view_id"]),
    name: get(byIndexRes, ["json", "uda", srcEnv, "sources", "byId", sourceId, "views", "byIndex", i, "name"]),
  }));
};

export default function ReportRouteList(props) {
  const { isEdit, updateItem } = props;
  const { falcor, datasources } = useContext(CMSContext) || {};
  const { state, setState, state:{join} } = useContext(ComponentContext) || {};
  const { apiLoad, apiUpdate, pageState, format, clearActionParam } = useContext(PageContext) || {};
  const { UI, theme: themeFromContext = {} } = useContext(ThemeContext) || {};
  const { Button, Select, Input } = UI || {};
  const t = { ...reportRouteListTheme, ...getComponentTheme(themeFromContext, 'reportRouteList') };
  console.log({t})
  const pContext = useContext(PageContext);
  const cmContext = useContext(CMSContext)
    const conContext = useContext(ComponentContext)
    console.log({pContext, cmContext, conContext})
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [sources, setSources] = useState([]);
  const [views, setViews] = useState([]);
  const [pendingRoute, setPendingRoute] = useState(null);
  const routeSourceInfo = join?.sources?.table1?.sourceInfo;

  const currentReport = state?.data?.[0];
  const routes = currentReport?.routes || [];
  const addRouteId = pageState?.filters?.find(f => f.searchKey === 'add_route_id' && f.type === 'action')?.values?.[0];

  console.log({themeFromContext})
  useEffect(() => {
    if (!falcor || !datasources?.length) return;
    const envs = datasources.reduce((acc, ds) => {
      acc[ds.env] = { srcAttributes: ds.srcAttributes, viewAttributes: ds.viewAttributes };
      return acc;
    }, {});

    getSources(falcor, envs).then(setSources);
  }, [falcor, datasources]);

  useEffect(() => {
    if (!falcor || !routeSourceInfo) return;
    const srcEnv = routeSourceInfo?.srcEnv;
    if (!srcEnv) return;
    const viewAttrs = datasources.find(ds => ds.env === srcEnv)?.viewAttributes || ['view_id', 'name'];

    getViews(falcor, routeSourceInfo, srcEnv, [...viewAttrs, "view_id"]).then((v) => {
      console.log("v length::", v.length)
      if(v.length === 1) {
        setState(draft =>{
          draft.routesViewId = v[0]?.view_id;
        })
      }
      setViews(v)
    });
  }, [falcor, routeSourceInfo, sources, datasources]);

  const getTmcArray = (tmcArray) => {
    if (!tmcArray) return [];
    if (Array.isArray(tmcArray)) return tmcArray;
    try {
      return JSON.parse(tmcArray);
    } catch (e) {
      console.error('Failed to parse tmc_array', e);
      return [];
    }
  };

  const fetchDynamicRoute = async () => {
    if (!addRouteId || !apiLoad || !routeSourceInfo) return;
    setLoading(true);
    
    const externalSource = {
      ...routeSourceInfo,
    };
    
    const udaConfig = buildUdaConfig({
      externalSource,
      columns: externalSource.columns.map(c => ({...c, show: true})),
      filters: { op: "AND", groups: [{ col: "data->>'route_id'", op: "filter", value: addRouteId.value }] }
    });
    
    const config = {
      format: { ...externalSource, app: "npmrdsv5", type: "routes_data" },
      children: [{ action: "uda", path: "/", filter: { options: JSON.stringify(udaConfig.options) }, params: {} }]
    };
    
    try {
      const data = await apiLoad(config, "/");
      if (data && data[0]) setPendingRoute(data[0].data.value);
    } catch (e) {
      console.error('<ReportRouteList:fetchDynamic>', e);
      setError('Could not fetch route details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if(addRouteId) {
      fetchDynamicRoute();
    }
  },[addRouteId])

  const addRoute = async () => {
    if (!updateItem || !currentReport?.id || !pendingRoute || saving) return;
    setSaving(true);
    setError('');
    try {
      const updatedRoutes = [...routes, pendingRoute];
      await updateItem(updatedRoutes, { name: 'routes' }, currentReport);

      setPendingRoute(null);
      clearActionParam('add_route_id');
    } catch (e) {
      console.error('<ReportRouteList:add>', e);
      setError('Could not add route.');
    } finally {
      setSaving(false);
    }
  };

  const removeRoute = async (indexToRemove) => {
    if (!updateItem || !currentReport?.id || saving) return;
    setSaving(true);
    setError('');
    try {
      const updatedRoutes = routes.filter((_, i) => i !== indexToRemove);
      await updateItem(updatedRoutes, { name: 'routes' }, currentReport);
    } catch (e) {
      console.error('<ReportRouteList:remove>', e);
      setError('Could not remove route.');
    } finally {
      setSaving(false);
    }
  };

  const updateRoute = async ({index, field, value}) => {
    if (!updateItem || !currentReport?.id || saving || !field || !value) return;
    setSaving(true);
    setError('');
    try {
      const newRoutes = cloneDeep(routes)
      newRoutes[index][field] = value;
      await updateItem(newRoutes, { name: 'routes' }, currentReport);
    } catch (e) {
      console.error('<ReportRouteList:update>', e);
      setError('Could not update route.');
    } finally {
      setSaving(false);
    }
  };


  const cancelAdd = () => {
    setPendingRoute(null);
    clearActionParam('add_route_id');
  };
  return (
    <div className={t.wrapper}>
      <div className={t.title}>{currentReport?.name}</div>
      <div className={t.title}>Routes</div>
      {loading ? <div className={t.loading}>Loading…</div> : null}
      <div className={t.list}>
        {routes.map((r, i) => {
          const tmcArray = getTmcArray(r.tmc_array);
          return (
            <div key={`${r.id}-${i}`} className={t.row}>
              <div className='flex flex-col w-full'>
                <div className='flex   items-center justify-between w-full'>
                  <div>{r.name}</div>

                  <Button themeOptions={{ size: "xs" }} disabled={saving} onClick={() => removeRoute(i)}>
                    Remove
                  </Button>
                </div>
                {tmcArray.length > 0 && <div className='text-xs text-gray-500 mt-1'>{tmcArray.join(", ")}</div>}
                <div>
                  <div>
                    Start Date:<Input value={r.startDate} onChange={(e) => updateRoute({index: i, field: 'startDate', value: e.target.value})} />
                  </div>
                  <div>
                    End Date:<Input value={r.endDate} onChange={(e) => updateRoute({index: i, field: 'endDate', value: e.target.value})}/>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {!loading && routes.length === 0 ? <div className={t.empty}>No routes added.</div> : null}
      </div>

      {pendingRoute && (
        <div className={t.addForm}>
          <div>Add “{pendingRoute.name}”?</div>
          <Button disabled={saving} onClick={addRoute}>
            {saving ? "Adding…" : "Confirm"}
          </Button>
          <Button disabled={saving} onClick={cancelAdd}>
            Cancel
          </Button>
        </div>
      )}
      {error ? <div className={t.error}>{error}</div> : null}
    </div>
  );
}
