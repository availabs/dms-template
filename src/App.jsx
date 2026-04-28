import { DmsSite, adminConfig } from "./dms/packages/dms/src";
import themes from "./themes";
import damaDataTypes from "./data-types.js";

const DEFAULT_API_HOST = "https://dmsserver.availabs.org";

// A localhost VITE_API_HOST baked into a production build would break the
// deployed site (browsers can't reach the dev machine). Fall back to the
// default host if the build is prod and the env var points at localhost.
const isLocalhost = (url) =>
  /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/i.test(url || "");

const envApiHost = import.meta.env.VITE_API_HOST;
const API_HOST =
  import.meta.env.PROD && isLocalhost(envApiHost)
    ? DEFAULT_API_HOST
    : envApiHost || DEFAULT_API_HOST;
const DAMA_HOST = import.meta.env.VITE_DAMA_HOST || API_HOST;
const DMS_APP = import.meta.env.VITE_DMS_APP || "wcdb";
const DMS_TYPE = import.meta.env.VITE_DMS_TYPE || "prod";
const BASE_URL = import.meta.env.VITE_DMS_BASE_URL || "/list";
const AUTH_PATH = import.meta.env.VITE_DMS_AUTH_PATH || "/auth";
const PG_ENVS = (import.meta.env.VITE_DMS_PG_ENVS || "")
  .split(",")
  .filter(Boolean);

function App({ defaultData, hydrationData } = {}) {
  //console.log('pgEnvs', PG_ENVS)
  return (
    <DmsSite
      dmsConfig={adminConfig[0]({
        app: DMS_APP,
        type: DMS_TYPE,
        baseUrl: BASE_URL,
        authPath: AUTH_PATH,
      })}
      defaultData={defaultData}
      hydrationData={hydrationData}
      pgEnvs={PG_ENVS}
      adminPath={BASE_URL}
      API_HOST={API_HOST}
      AUTH_HOST={API_HOST}
      DAMA_HOST={DAMA_HOST}
      themes={themes}
      damaDataTypes={damaDataTypes}
    />
  );
}

export default App;
