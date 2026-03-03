import { DmsSite, adminConfig  } from "./dms/packages/dms/src"
import themes from "./themes"

const API_HOST = import.meta.env.VITE_API_HOST || 'https://graph.availabs.org'
const DMS_APP = import.meta.env.VITE_DMS_APP || 'wcdb'
const DMS_TYPE = import.meta.env.VITE_DMS_TYPE || 'prod'
const BASE_URL = import.meta.env.VITE_DMS_BASE_URL || '/list'
const AUTH_PATH = import.meta.env.VITE_DMS_AUTH_PATH || '/auth'
const PG_ENVS = (import.meta.env.VITE_DMS_PG_ENVS || '').split(',').filter(Boolean)

function App({ defaultData, hydrationData } = {}) {
  return (
    <DmsSite
      dmsConfig={
        adminConfig[0]({
          app: DMS_APP,
          type: DMS_TYPE,
          baseUrl: BASE_URL,
          authPath: AUTH_PATH,
        })
      }
      defaultData={defaultData}
      hydrationData={hydrationData}
      pgEnvs={PG_ENVS}
      adminPath={BASE_URL}
      API_HOST={API_HOST}
      AUTH_HOST={API_HOST}
      themes={themes}
    />
  )
}

export default App
