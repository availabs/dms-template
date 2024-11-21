import { DmsSite, adminConfig } from "@availabs/dms"

function App() {
  return ( 
      <DmsSite
        dmsConfig = {
          adminConfig({
            app: 'dms-docs',
            type: 'pattern-admin'
          })
        }   
      />
  )
}

export default App