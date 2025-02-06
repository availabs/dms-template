import { DmsSite, adminConfig, registerComponents } from "./dms/src"
import themes from "./themes"


function App() {
  return ( 
      <DmsSite
        dmsConfig = {
          adminConfig({
            app: 'asm',
            type: 'nhomb'
          })
        }   
        themes={themes}
      />
  )
}

export default App