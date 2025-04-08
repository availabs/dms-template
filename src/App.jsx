import { DmsSite, adminConfig, registerComponents } from "./dms/src"
import { withAuth, useAuth } from "@availabs/ams"
import Auth from './pages/Auth'
import themes from "./themes"

Auth.forEach(f => {
  f.Component = f.element 
  delete f.element
})

function App() {
  return ( 
      <DmsSite
        dmsConfig = {
          adminConfig({
            // app: 'dms-docs',
            // type: 'pattern-admin'
            app: 'nprdsv5',
            type: 'dev2' 
          })
        }
        authWrapper={withAuth}
        themes={themes}
        pgEnvs={['npmrds2']}
        routes={[...Auth]}
      />
  )
}

export default App