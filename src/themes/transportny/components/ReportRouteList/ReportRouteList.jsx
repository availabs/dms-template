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
  const lenRes = await falcor.get(["uda", srcEnv, "sources", "byId", sourceId, "views", "length"]);
  const len = get(lenRes, ["json", "uda", srcEnv, "sources", "byId", sourceId, "views", "length"]);
  if (!len) return [];
  const byIndexRes = await falcor.get(["uda", srcEnv, "sources", "byId", sourceId, "views", "byIndex", { from: 0, to: len - 1 }, viewAttributes]);
  return Array.from({ length: len }, (_, i) => i).map((i) =>  ({
    view_id: get(byIndexRes, ["json", "uda", srcEnv, "sources", "byId", sourceId, "views", "byIndex", i, "view_id"]),
    name: get(byIndexRes, ["json", "uda", srcEnv, "sources", "byId", sourceId, "views", "byIndex", i, "name"]),
  }));
};

function transformReportRoutes(routes) {
  //const routes = report.data?.routes || [];
  if(!routes || routes.length < 1){
    return;
  }
  // Helper function to handle YYYY-MM-DD or YYYY-MM-DDTHH:mm strings safely
  function parseYMD(dateStr) {
    if (dateStr.includes('T')) {
        return new Date(dateStr);
    }
    const [year, month, day] = dateStr.split('-');
    // Month is 0-indexed in JS Dates (0 = January)
    return new Date(year, month - 1, day);
  }

  // Helper function to generate an array of 'YYYY-MM-DD' dates
  function generateDateRange(startStr, endStr) {
    const startDate = parseYMD(startStr);
    const endDate = parseYMD(endStr);
    const dates = [];

    // Loop day-by-day from start to end
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      dates.push(`${year}-${month}-${day}`);
    }
    return dates;
  }

  function timeToEpoch(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 12 + Math.floor(minutes / 5);
  }

  function generateEpochRange(startStr, endStr) {
    const startTime = startStr.includes('T') ? startStr.split('T')[1] : startStr;
    const endTime = endStr.includes('T') ? endStr.split('T')[1] : endStr;

    const startEpoch = timeToEpoch(startTime);
    const endEpoch = timeToEpoch(endTime);

    const epochs = [];
    for (let e = startEpoch; e <= endEpoch; e++) {
      epochs.push(e);
    }
    return epochs;
  }

  return routes.map(route => {
    let parsedTmcArray = [];
    try {
      parsedTmcArray = JSON.parse(route.tmc_array);
    } catch (e) {
      console.error(`Failed to parse tmc_array for route ${route.route_id}:`, e);
    }

    // Generates the range based on your MM-DD-YYYY inputs
    const dateArray = route.startDate && route.endDate ? generateDateRange(route.startDate, route.endDate) : [];
    const epochArray = (route.startDate && route.endDate && route.startDate.includes('T') && route.endDate.includes('T')) ? generateEpochRange(route.startDate, route.endDate) : [];

    const groups = [
      {
        op: "filter",
        col: "tmc",
        value: parsedTmcArray
      },
      {
        op: "filter",
        col: "date",
        value: dateArray
      }
    ];

    if (epochArray.length > 0) {
      groups.push({
        op: "filter",
        col: "epoch",
        value: epochArray
      });
    }

    return {
      label: route.name,
      filters: {
        op: "AND",
        groups: groups
      }
    };
  });
}

function roundToFiveMinutes(dateStr) {
  if (!dateStr || !dateStr.includes('T')) return dateStr;

  const [datePart, timePart] = dateStr.split('T');
  if (!timePart) return dateStr;

  const [hours, minutes] = timePart.split(':').map(Number);
  const roundedMinutes = Math.round(minutes / 5) * 5;

  let finalHours = hours;
  let finalMinutes = roundedMinutes;
  if (finalMinutes >= 60) {
    finalMinutes = 0;
    finalHours = (hours + 1) % 24;
  }

  return `${datePart}T${String(finalHours).padStart(2, '0')}:${String(finalMinutes).padStart(2, '0')}`;
}

export default function ReportRouteList(props) {
  const { isEdit, updateItem } = props;
  const { falcor, datasources } = useContext(CMSContext) || {};
  const { state, setState, state:{join} } = useContext(ComponentContext) || {};
  const { apiLoad, apiUpdate, pageState, setPageState, format, clearActionParam, setActionParam,item, setItem } = useContext(PageContext) || {};
  const { UI, theme: themeFromContext = {} } = useContext(ThemeContext) || {};
  const { Button, Select, Input, Icon } = UI || {};
  const t = { ...reportRouteListTheme, ...getComponentTheme(themeFromContext, 'reportRouteList') };
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [sources, setSources] = useState([]);
  const [views, setViews] = useState([]);
  const [pendingRoute, setPendingRoute] = useState(null);
  const [expandedRoutes, setExpandedRoutes] = useState({});
  const [editingRouteNameIndex, setEditingRouteNameIndex] = useState(null);
  const [editNameValue, setEditNameValue] = useState('');
  const [editingRouteDatesIndex, setEditingRouteDatesIndex] = useState(null);
  const [editStartDateValue, setEditStartDateValue] = useState('');
  const [editEndDateValue, setEditEndDateValue] = useState('');
  const [graphTemplates, setGraphTemplates] = useState([]);
  const [selectedGraphTemplateId, setSelectedGraphTemplateId] = useState('');
  const routeSourceInfo = join?.sources?.table1?.sourceInfo;

  const loadTemplates = useCallback(async () => {
    if (!apiLoad) return;
    
    // Mimicking TemplateManager pattern
    try {
      const rows = await apiLoad({
        format: { 
          app: "npmrdsv5", 
          type: "npmrds_sub|avl_graph_template", 
          attributes: ["id", "updated_at", "app", "type", "data"] 
        },
        children: [{ type: () => {}, action: "list", path: "/" }],
      });
      const list = (rows || []).filter(r => r && r.id);
      setGraphTemplates(list);
    } catch (e) {
      console.error('<ReportRouteList:loadTemplates>', e);
    }
  }, [apiLoad]);

  useEffect(() => { 
    loadTemplates(); 
  }, [loadTemplates]);

  const getDateValue = (val) => (val || '').split('T')[0];
  const getTimeValue = (val) => (val || '').split('T')[1] || '';
  const onDateChange = (e, currentValue, setter) => {
    const time = currentValue.split('T')[1] || '';
    setter(time ? `${e.target.value}T${time}` : e.target.value);
  };
  const onTimeChange = (e, currentValue, setter) => {
    const date = currentValue.split('T')[0] || '';
    setter(e.target.value ? `${date}T${e.target.value}` : date);
  };

  const toggleRoute = (index) => {
    setExpandedRoutes(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const currentReport = state?.data?.[0];
  const routes = currentReport?.routes || [];
  const addRouteId = pageState?.filters?.find(f => f.searchKey === 'add_route_id' && f.type === 'action')?.values?.[0];

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
  },[addRouteId]);

  const addRoute = async () => {
    if (!updateItem || !currentReport?.id || !pendingRoute || saving) return;
    setSaving(true);
    setError('');
    try {
      // Find max ID
      let maxId = -1;
      routes.forEach(r => {
        if (r.route_comp_id && r.route_comp_id.startsWith('comp-')) {
          const id = parseInt(r.route_comp_id.replace('comp-', ''), 10);
          if (!isNaN(id) && id > maxId) {
            maxId = id;
          }
        }
      });
      
      const newRoute = {
        ...pendingRoute,
        route_comp_id: `comp-${maxId + 1}`
      };

      const updatedRoutes = [...routes, newRoute];
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

  const removeGraph = async (indexToRemove) => {
    if (!updateItem || !currentReport?.id || saving) return;
    setSaving(true);
    setError('');
    try {
      const updatedGraphComps = (currentReport.graph_comps || []).filter((_, i) => i !== indexToRemove);
      await updateItem(updatedGraphComps, { name: 'graph_comps' }, currentReport);
    } catch (e) {
      console.error('<ReportRouteList:removeGraph>', e);
      setError('Could not remove graph.');
    } finally {
      setSaving(false);
    }
  };

  const reorderRoutes = async (index, direction) => {
    if (!updateItem || !currentReport?.id || saving) return;
    
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= routes.length) return;

    setSaving(true);
    setError('');
    try {
      const updatedRoutes = [...routes];
      const temp = updatedRoutes[index];
      updatedRoutes[index] = updatedRoutes[newIndex];
      updatedRoutes[newIndex] = temp;
      
      await updateItem(updatedRoutes, { name: 'routes' }, currentReport);
    } catch (e) {
      console.error('<ReportRouteList:reorder>', e);
      setError('Could not reorder route.');
    } finally {
      setSaving(false);
    }
  };

  const updateRoute = async ({index, updates}) => {
    if (!updateItem || !currentReport?.id || saving || !updates) return;
    setSaving(true);
    setError('');
    try {
      const newRoutes = cloneDeep(routes)
      Object.entries(updates).forEach(([field, value]) => {
          let finalValue = value;
          if ((field === 'startDate' || field === 'endDate') && typeof finalValue === 'string' && finalValue.includes('T')) {
            finalValue = roundToFiveMinutes(finalValue);
          }
          newRoutes[index][field] = finalValue;
      });
      await updateItem(newRoutes, { name: 'routes' }, currentReport);
    } catch (e) {
      console.error('<ReportRouteList:update>', e);
      setError('Could not update route.');
    } finally {
      setSaving(false);
    }
  };

  //TODO -- add setActionParam to config for reportRouteList
  //that will get rid of hardcoded `routes`
  useEffect(() => {
    const routeFilter = transformReportRoutes(routes);
    if (!setActionParam) return;
    if (routeFilter !== undefined) setActionParam('routes', routeFilter);
  }, [routes])

  // Sync graph_comps to page item
  useEffect(() => {
    console.log("before conditional graph comp effect", {currentReport, setItem})
    if (!currentReport?.graph_comps || !setItem) return;

    setItem(draft => {
        // Ensure `draft` has `sections` and `draft_sections` arrays.
        if (!draft.sections) draft.sections = [];
        if (!draft.draft_sections) draft.draft_sections = [];

        // Remove existing 'reports' components
        draft.sections = draft.sections.filter(c => c.createdBy !== 'reports');
        draft.draft_sections = draft.draft_sections.filter(c => c.createdBy !== 'reports');
        
        // Add components from graph_comps
        const injected = currentReport.graph_comps || [];
        
        draft.sections.push(...injected);
        draft.draft_sections.push(...injected);
    });
  }, [currentReport?.graph_comps, setItem]);

  const addGraph = async () => {
    const templateRow = graphTemplates.find(gt => gt.id === selectedGraphTemplateId);
    if (!templateRow) return;

    // Ensure templateRow.data is parsed
    const tpl = { ...templateRow, ...(typeof templateRow.data === 'string' ? JSON.parse(templateRow.data) : templateRow.data) };

    const parsedState = tpl.stateJson ? JSON.parse(tpl.stateJson) : {};
    const layout = tpl.includesLayout && tpl.layoutJson ? JSON.parse(tpl.layoutJson) : {};
    const elementType = tpl.elementType || 'Graph';

    const id = crypto.randomUUID();
    const trackingId = crypto.randomUUID();

    const newComponent = {
      ...layout,
      id,
      trackingId,
      createdBy: 'reports',
      element: {
        'element-type': elementType,
        'element-data': JSON.stringify(parsedState),
      },
    };

    if (updateItem && currentReport) {
      const updatedGraphComps = [...(currentReport.graph_comps || []), newComponent];
      await updateItem(updatedGraphComps, { name: 'graph_comps' }, currentReport);
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
          const isExpanded = expandedRoutes[i];
          return (
            <div key={`${r.id}-${i}`} className={t.row}>
              <div className={t.rowContainer}>
                <div className={t.rowHeader}>
                  <div className={t.iconContainer}>
                    <Icon icon={'Drag'} />
                    <Button disabled={editingRouteNameIndex === i} themeOptions={{ size: "xs" }} onClick={() => toggleRoute(i)}>
                      {isExpanded ? '-' : '+'}
                    </Button>
                    {editingRouteNameIndex === i ? (
                        <div className={t.editContainer}>
                          <div className={t.editInputWrapper}>
                            <Input value={editNameValue} onChange={(e) => setEditNameValue(e.target.value)} />
                          </div>
                          <Button themeOptions={{ size: "xs" }} title="save" onClick={() => {
                              updateRoute({index: i, updates: {name: editNameValue}});
                              setEditingRouteNameIndex(null);
                          }}>
                            <Icon icon={"FloppyDisk"} />
                          </Button>
                          <Button themeOptions={{ size: "xs", color: "danger" }} title="cancel" onClick={() => setEditingRouteNameIndex(null)}>
                            <Icon icon={"CancelCircle"}/>
                          </Button>
                        </div>

                    ) : (
                      <div className={t.editContainer}>
                        <div className={t.routeTitle}>{r.name}</div>
                        {isExpanded && (
                            <Button themeOptions={{ size: "xs" }} title="Edit Name" onClick={() => {
                                setEditingRouteNameIndex(i);
                                setEditNameValue(r.name);
                            }}>
                              <Icon icon={'PencilSquare'}/>
                            </Button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className={t.reorderButtons}>
                     <Button themeOptions={{ size: "xs" }} disabled={i === 0 || saving} onClick={() => reorderRoutes(i, 'up')}>
                        <Icon icon={'ChevronUp'} />
                     </Button>
                     <Button themeOptions={{ size: "xs" }} disabled={i === routes.length - 1 || saving} onClick={() => reorderRoutes(i, 'down')}>
                        <Icon icon={'ChevronDown'} />
                     </Button>
                  </div>
                </div>
                {isExpanded && (
                    <div className={t.expandedContainer}>
                        {tmcArray.length > 0 && (
                          <div className={t.tmcWrapper}>
                            <div className={t.tmcLabel}>TMCs:</div>
                            <div className={t.tmcList}>
                                {tmcArray.join(", ")}
                            </div>
                          </div>
                        )}
                        <div className={t.dateInputsContainer}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div className={t.dateRangeLabel}>Date Range</div>
                            {editingRouteDatesIndex === i ? (
                                <div className={t.editContainer}>
                                  <Button themeOptions={{ size: "xs" }} title="save" onClick={() => {
                                      updateRoute({index: i, updates: {startDate: editStartDateValue, endDate: editEndDateValue}});
                                      setEditingRouteDatesIndex(null);
                                  }}>
                                    <Icon icon={"FloppyDisk"} />
                                  </Button>
                                  <Button themeOptions={{ size: "xs", color: "danger" }} title="cancel" onClick={() => setEditingRouteDatesIndex(null)}>
                                    <Icon icon={"CancelCircle"}/>
                                  </Button>
                                </div>
                            ) : (
                                <Button themeOptions={{ size: "xs" }} title="Edit Dates" onClick={() => {
                                    setEditingRouteDatesIndex(i);
                                    setEditStartDateValue(r.startDate);
                                    setEditEndDateValue(r.endDate);
                                }}>
                                  <Icon icon={'PencilSquare'}/>
                                </Button>
                            )}
                          </div>
                          <div className={t.dateInputWrapper}>
                            <label className={t.dateLabel}>Start Date:</label>
                            <div className={t.dateInputFlex}>
                                <Input type="date" value={getDateValue(editingRouteDatesIndex === i ? editStartDateValue : r.startDate)} disabled={editingRouteDatesIndex !== i} onChange={(e) => onDateChange(e, editingRouteDatesIndex === i ? editStartDateValue : r.startDate || '', setEditStartDateValue)} />
                                <Input type="time" value={getTimeValue(editingRouteDatesIndex === i ? editStartDateValue : r.startDate)} disabled={editingRouteDatesIndex !== i} onChange={(e) => onTimeChange(e, editingRouteDatesIndex === i ? editStartDateValue : r.startDate || '', setEditStartDateValue)} />
                            </div>
                          </div>
                          <div className={t.dateInputWrapper}>
                            <label className={t.dateLabel}>End Date:</label>
                            <div className={t.dateInputFlex}>
                                <Input type="date" value={getDateValue(editingRouteDatesIndex === i ? editEndDateValue : r.endDate)} disabled={editingRouteDatesIndex !== i} onChange={(e) => onDateChange(e, editingRouteDatesIndex === i ? editEndDateValue : r.endDate || '', setEditEndDateValue)} />
                                <Input type="time" value={getTimeValue(editingRouteDatesIndex === i ? editEndDateValue : r.endDate)} disabled={editingRouteDatesIndex !== i} onChange={(e) => onTimeChange(e, editingRouteDatesIndex === i ? editEndDateValue : r.endDate || '', setEditEndDateValue)} />
                            </div>
                          </div>
                        </div>
                        <div className={t.removeButtonWrapper}>
                            <Button themeOptions={{ size: "xs", color: "danger" }} disabled={saving} onClick={() => removeRoute(i)}>
                              Remove
                            </Button>
                        </div>
                    </div>
                )}
              </div>
            </div>
          );
        })}
        {!loading && routes.length === 0 ? <div className={t.empty}>No routes added.</div> : null}
      </div>
      <div style={{ marginTop: '1rem', padding: '1rem', border: '1px solid #ccc' }}>
        <label>Select Graph Template</label>
        <Select
          aria-label="Select Graph Template"
          value={graphTemplates.find(gt => gt.id === selectedGraphTemplateId)?.name}
          onChange={(e) => setSelectedGraphTemplateId(e.props.value)}
          options={graphTemplates.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name || g.id}
            </option>
          ))}
        />
          <Button
            themeOptions={{ size: "sm" }}
            style={{ marginTop: '0.5rem' }}
            onClick={addGraph}
          >
          Add Graph
          </Button>
      </div>
      {currentReport?.graph_comps && currentReport.graph_comps.length > 0 && (
          <div className={t.wrapper} style={{ marginTop: '1rem' }}>
              <div className={t.title}>Added Graphs</div>
              <div className={t.list}>
              {currentReport.graph_comps.map((g, i) => (
                  <div key={i} className={t.row}>
                      <span>{g.element?.['element-type'] || 'Graph'}</span>
                      <Button themeOptions={{ size: "xs", color: "danger" }} disabled={saving} onClick={() => removeGraph(i)}>
                        Remove
                      </Button>
                  </div>
              ))}
              </div>
          </div>
      )}


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
