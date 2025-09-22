import { DmsSite, adminConfig,  } from "./dms/src"
import { withAuth, useAuth } from "@availabs/ams"
import { cloneDeep } from 'lodash-es'
import themes from "./themes"


const API_HOST = 'https://graph.availabs.org'
//const WrappedAuth = LayoutWrapper(Auth)
//console.log('what is auth', Auth, WrappedAuth)

function App() {
  return (
      <DmsSite
        dmsConfig = {
          adminConfig[0]({
            app: 'avail',
            type: 'site',
            API_HOST,
            AUTH_HOST:API_HOST,
            baseUrl: '/list',
            authPath: '/auth',
            // app: 'mitigat-ny-prod',
            // type: 'planetary'
            // app: 'nprdsv5',
            // type: 'dev2'
          })
        }
        adminPath={'/list'}
        API_HOST={API_HOST}
        AUTH_HOST={API_HOST}
        themes={themes}
        pgEnvs={['npmrds2']}

      />
  )
}

export default App
