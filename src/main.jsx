import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import './index.css'

import App from './App.jsx'
import loadThemes from './themes'
import { collectThemeNames } from './dms/packages/dms/src'

const rootElement = document.getElementById('root')
const ssrData = window.__dmsSSRData

async function boot() {
  if (ssrData) {
    // SSR mode: the server already rendered HTML into #root, using whichever
    // theme(s) ssrData.defaultData's patterns reference. Resolve the exact
    // same theme(s) here, before hydrating, so the client's first render
    // matches the server's — a React.lazy/Suspense-during-render approach
    // would leave `themes` unpopulated at hydration time and mismatch what
    // the server sent. See planning/shared/bundle-size-log.md.
    const resolvedThemes = await loadThemes(collectThemeNames(ssrData.defaultData))
    hydrateRoot(
      rootElement,
      <StrictMode>
        <App
          defaultData={ssrData.defaultData}
          hydrationData={ssrData.hydrationData}
          themes={resolvedThemes}
        />
      </StrictMode>
    )
  } else {
    // SPA mode: no server-rendered content, render from scratch. App.jsx
    // falls back to the lazy `loadThemes` loader when no `themes` prop is
    // passed, resolving only the theme(s) the site actually needs.
    createRoot(rootElement).render(
      <StrictMode>
        <App />
      </StrictMode>
    )
  }
}

boot()
