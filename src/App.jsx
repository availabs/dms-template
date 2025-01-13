import { DmsSite, adminConfig } from "./dms/src"
import themes from "./themes"

function App() {
  return ( 
      <DmsSite
        dmsConfig = {
          adminConfig({
            app: 'dms-docs',
            type: 'pattern-admin'
          })
        }   
        themes={themes}
      />
  )
}

export default App