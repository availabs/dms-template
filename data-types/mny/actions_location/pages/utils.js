import React from "react"

import { get } from "lodash-es"

export const SourceAttributes = [
  "source_id",
  "name",
  "display_name",
  "type",
  "update_interval",
  "category",
  "categories",
  "description",
  "statistics",
  "metadata",
]

export const ViewAttributes = [
  "view_id",
  "source_id",
  "data_type",
  "interval_version",
  "geography_version",
  "version",
  "source_url",
  "publisher",
  "table_schema",
  "table_name",
  "data_table",
  "download_url",
  "tiles_url",
  "start_date",
  "end_date",
  "last_updated",
  "statistics",
  "metadata",
  "user_id",
  "etl_context_id",
  "view_dependencies",
  "_created_timestamp",
  "_modified_timestamp",
]

const ActionsSource = {
  source_id: 1029065,
  view_id: 1074456
}

export const useGetActionsSource = ({ falcor, falcorCache, dmsEnvs, startLoading, stopLoading }) => {
  React.useEffect(() => {
    startLoading();
    falcor.get([
      "uda", dmsEnvs, "sources", "byId", ActionsSource.source_id, ["name", "source_id"]
    ]).then(() => stopLoading());
  }, [falcor, dmsEnvs, startLoading, stopLoading]);

  return React.useMemo(() => {
    return dmsEnvs.map(env =>
      get(falcorCache, ["uda", env, "sources", "byId", ActionsSource.source_id])
    ).filter(Boolean).pop();
  }, [falcorCache, dmsEnvs]);
}

export const useGetActionsView = ({ falcor, falcorCache, dmsEnvs, startLoading, stopLoading }) => {
  React.useEffect(() => {
    startLoading();
    falcor.get([
      "uda", dmsEnvs, "views", "byId", ActionsSource.view_id, ["view_id", "name"]
    ]).then(() => stopLoading());
  }, [falcor, dmsEnvs, startLoading, stopLoading]);

  return React.useMemo(() => {
    return dmsEnvs.map(env =>
      get(falcorCache, ["uda", env, "views", "byId", ActionsSource.view_id])
    ).filter(Boolean).pop();
  }, [falcorCache, dmsEnvs]);
}

export const useGetActions = args => {
  const actionsSource = useGetActionsSource(args);
  const actionsView = useGetActionsView(args);

  return React.useMemo(() => {
    return { actionsSource, actionsView };
  }, [actionsSource, actionsView]);
}

export const getAttributes = (data) => {
  return Object.entries(data || {})
    .reduce((out, attr) => {
      const [k, v] = attr
      typeof v.value !== 'undefined' ? 
        out[k] = v.value : 
        out[k] = v
      return out;
    },{})
}

export const useFetchSources = ({ falcor, falcorCache, pgEnv, startLoading, stopLoading }) => {

  React.useEffect(() => {
    startLoading();
    falcor.get(["uda", pgEnv, "sources", "length"])
      .then(() => stopLoading());
  }, [falcor, pgEnv, startLoading, stopLoading]);

  const length = React.useMemo(() => {
    return get(falcorCache, ["uda", pgEnv, "sources", "length"], 0);
  }, [falcorCache, pgEnv]);

  React.useEffect(() => {
    if (length) {
      startLoading();
      falcor.get([
        "uda", pgEnv, "sources", "byIndex",
        { from: 0, to: length - 1 },
        SourceAttributes
      ]).then(() => stopLoading());
    }
  }, [falcor, length, pgEnv, startLoading, stopLoading]);
}

export const useGetSources = ({ falcorCache, pgEnv, categories = [], columns = [] }) => {
  return React.useMemo(() => {
    return Object.values(get(falcorCache, ["uda", pgEnv, "sources", "byIndex"], {}))
      .map(v => getAttributes(get(falcorCache, v.value, {})))
      .filter(src => {
        if (Array.isArray(categories)) {
          return categories.reduce((a, c) => {
            return a && src?.categories?.reduce((aa, cc) => {
              return cc.reduce((aaa, ccc) => aaa || (ccc === c), aa);
            }, false);
          }, true);
        }
        else if (categories.or) {
          return categories.or.reduce((a, c) => {
            return a || src?.categories?.reduce((aa, cc) => {
              return cc.reduce((aaa, ccc) => aaa || (ccc === c), aa);
            }, false);
          }, !Boolean(categories.or.length));
        }
      })
      .filter(d => {
        const mdColumns = get(d, ["metadata", "columns"], get(d, "metadata", []));
        if (Array.isArray(mdColumns)) {
          const mdColumnsMap = mdColumns.reduce((a, c) => {
            a.add(c.name);
            return a;
          }, new Set());
          return columns.reduce((a, c) => {
            return a && mdColumnsMap.has(c);
          }, true);
        }
        return false;
      }).sort((a, b) => a.name.localeCompare(b.name));
  }, [falcorCache, pgEnv, categories, columns]);
}

export const useFetchSourceViews = ({ falcor, falcorCache, pgEnv, source_id, startLoading, stopLoading }) => {
  React.useEffect(() => {
    if (!source_id) return;
    startLoading();
    falcor.get(["uda", pgEnv, "sources", "byId", source_id, "views", "length"])
      .then(() => stopLoading());
  }, [falcor, pgEnv, source_id, startLoading, stopLoading]);

  const length = React.useMemo(() => {
    if (!source_id) return 0;
    return get(falcorCache, ["uda", pgEnv, "sources", "byId", source_id, "views", "length"], 0);
  }, [falcorCache, pgEnv, source_id]);

  React.useEffect(() => {
    if (length) {
      startLoading();
      falcor.get([
        "uda", pgEnv, "sources", "byId", source_id, "views", "byIndex",
        { from: 0, to: length - 1 },
        ViewAttributes
      ]).then(() => stopLoading());
    }
  }, [falcor, length, pgEnv, source_id, startLoading, stopLoading]);
}

export const useGetViews = ({ falcorCache, pgEnv, source_id }) => {
  return React.useMemo(() => {
    return Object.values(get(falcorCache, ["uda", pgEnv, "sources", "byId", source_id, "views", "byIndex"], {}))
      .map(v => getAttributes(get(falcorCache, v.value, {})))
      .sort((a, b) => String(a.version || a.view_id).localeCompare(String(b.version || b.view_id)));
  }, [falcorCache, source_id, pgEnv]);
}