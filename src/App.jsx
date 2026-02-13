import { DmsSite, adminConfig  } from "./dms/packages/dms/src"
import themes from "./themes"


const API_HOST = [
  'https://graph.availabs.org',
  'http://localhost:3001'
]

 // const WrappedAuth = LayoutWrapper(Auth)
 // console.log('what is auth', Auth, WrappedAuth)
const sites = [
  { app: 'avail', type: 'site' }, //[0]
  { app: 'mitigat-ny-prod', type: 'prod' }, // [1]
  { app: 'mitigat-ny-prod', type: 'planetary' }, // [2]
  { app: 'wcdb', type: 'prod'}, // [3]
  { app: 'asm', type: 'nhomb'}, // [4]
  { app: 'npmrdsv5', type: 'dev2' }, // [5]
  { app: 'avail-sqlite4', type: 'site' }, // [6]
]

function App() {
  return (
    <DmsSite
      dmsConfig = {
        adminConfig[0]({
          ...sites[6],
          baseUrl: '/list',
          authPath: '/auth',
        })
      }
      //pgEnvs={['hazmit_dama']}
      adminPath={'/list'}
      API_HOST={API_HOST[0]}
      AUTH_HOST={API_HOST[0]}
      themes={themes}
    />
  )
}

export default App
