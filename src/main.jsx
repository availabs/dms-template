import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { authProvider } from "@availabs/ams"
import App from './App.jsx'

const {
  AUTH_HOST = 'https://graph.availabs.org',
  PROJECT_NAME = 'test',
  CLIENT_HOST = 'https://netlify.app'
} = {}

const AuthEnabledApp = authProvider(App, { AUTH_HOST, PROJECT_NAME, CLIENT_HOST });

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthEnabledApp />
  </StrictMode>,
)
