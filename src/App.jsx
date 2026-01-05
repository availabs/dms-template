import { DmsSite, adminConfig,  } from "./dms/src"
import themes from "./themes"


const API_HOST = 'https://graph.availabs.org'
//const WrappedAuth = LayoutWrapper(Auth)
//console.log('what is auth', Auth, WrappedAuth)
const sites = [
  { app: 'avail', type: 'site' },
  { app: 'mitigat-ny-prod', type: 'prod' },
  { app: 'mitigat-ny-prod', type: 'planetary' },
  { app: 'wcdb', type: 'prod'},
  { app: 'asm', type: 'nhomb'}
]


function App() {
  return (
    <DmsSite
      dmsConfig = {
        adminConfig[0]({
          ...sites[1],
          API_HOST,
          AUTH_HOST:API_HOST,
          baseUrl: '/list',
          authPath: '/auth',
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
