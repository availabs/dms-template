import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import './index.css'

import App from './App.jsx'

const rootElement = document.getElementById('root')
const ssrData = window.__dmsSSRData

if (ssrData) {
  // SSR mode: the server already rendered HTML into #root.
  // Hydrate instead of rendering from scratch.
  hydrateRoot(
    rootElement,
    <StrictMode>
      <App
        defaultData={ssrData.defaultData}
        hydrationData={ssrData.hydrationData}
      />
    </StrictMode>
  )
} else {
  // SPA mode: no server-rendered content, render from scratch.
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
}
