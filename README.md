# DMS Site

React application built on the [AVAIL DMS](src/dms/) library. Provides dynamic page routing, content management, dataset management, and admin patterns via a Falcor JSON Graph API.

## Quick Start

```bash
npm install
npm run dev          # SPA dev server on http://localhost:5173
```

## SPA Mode (default)

The standard client-side single-page application. All rendering happens in the browser — JS loads, Falcor fetches site data, React Router builds routes, and the page renders.

### Development

```bash
npm run dev          # Vite dev server with HMR
```

### Production Build & Deploy

```bash
npm run build        # Build to dist/
npm run preview      # Preview the production build locally
npm run deploy       # Deploy to Netlify (primary site)
```

No server required — the built `dist/` folder is static HTML + JS + CSS served from any CDN or static host (Netlify, S3, etc.). The Falcor API runs separately.

## SSR Mode

Server-side rendering runs inside [dms-server](src/dms/packages/dms-server/) alongside the Falcor API. Pages render to full HTML on the server so users see content immediately instead of waiting for JS to load and API calls to complete. After the HTML arrives, React hydrates and the app becomes a normal SPA for subsequent navigation.

SSR is **additive** — it does not replace SPA mode. The same `index.html`, `main.jsx`, and `App.jsx` serve both modes. SSR is opt-in via the `DMS_SSR` environment variable.

### Development

Start dms-server with SSR enabled:

```bash
cd src/dms/packages/dms-server
DMS_SSR=1 DMS_APP=avail DMS_TYPE=site npm run dev
```

Vite runs in middleware mode inside the Express server — you get HMR for both client and server code.

### Production Build

Two builds are required — one for the client bundle and one for the server entry:

```bash
npm run build:ssr    # Runs build:client + build:server
```

This produces:
- `dist/client/` — static assets (JS, CSS, images) + `index.html`
- `dist/server/` — server bundle (`entry-ssr.js`)

Then start dms-server in production mode:

```bash
cd src/dms/packages/dms-server
NODE_ENV=production DMS_SSR=1 DMS_APP=avail DMS_TYPE=site npm start
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DMS_SSR` | yes | — | Set to `1` to enable SSR |
| `DMS_APP` | yes | — | Application name (e.g., `avail`, `wcdb`) |
| `DMS_TYPE` | yes | — | Site type (e.g., `site`, `prod`) |
| `DMS_BASE_URL` | no | `/list` | Base URL for admin routes |
| `DMS_AUTH_PATH` | no | `/auth` | Auth route path |
| `DMS_PG_ENVS` | no | — | Comma-separated PostgreSQL environments |
| `PORT` | no | `3001` | Server port |

### How It Works

1. Request hits dms-server Express (after `/graph` Falcor route)
2. SSR middleware converts Express request to a Web `Request`
3. `handler.render(request)` builds routes via `dmsSiteFactory()` (cached after first request), runs React Router loaders via `createStaticHandler`, and renders HTML via `renderToString` + `StaticRouterProvider`
4. Middleware injects the HTML into the `index.html` template (replacing `<!--app-html-->`) and embeds site data as a `<script>` tag (replacing `<!--app-head-->`)
5. Browser receives full HTML, displays content immediately
6. Client JS loads, detects `window.__dmsSSRData`, calls `hydrateRoot` instead of `createRoot` — the page becomes interactive

### Architecture

```
render/ssr2/                          Platform-agnostic SSR core
  handler.jsx                         Web Request -> { html, status, headers }
  index.js                            Exports createSSRHandler
  express/                            Express adapter
    middleware.js                      Express req/res <-> Web Request
    setup.mjs                         mountSSR() — Vite dev/prod setup
    index.js                          Adapter exports

src/entry-ssr.jsx                     Site-specific: wires themes + adminConfig into handler
```

The core handler uses the Web `Request` API and is platform-agnostic. The `express/` subfolder adapts it for Express. Future adapters (Bun, Deno, etc.) would go in sibling folders.

## Build Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Vite dev server (SPA) |
| `npm run build` | Production SPA build |
| `npm run build:client` | Client bundle to `dist/client/` |
| `npm run build:server` | Server bundle to `dist/server/` |
| `npm run build:ssr` | Both client + server builds |
| `npm run preview` | Preview SPA production build |
| `npm run server` | Start dms-server |
| `npm run server:dev` | Start dms-server with nodemon |

## Project Structure

```
src/
  App.jsx              Main entry — configures DmsSite with API hosts, themes, admin config
  main.jsx             Client entry — SPA (createRoot) or SSR hydration (hydrateRoot)
  entry-ssr.jsx        Server entry — wires site config into SSR handler
  themes/              Theme definitions (catalyst, mny, transportny, wcdb, avail)
  dms/                 Git submodule — @availabs/dms library
    packages/
      dms/src/
        render/
          spa/         SPA rendering (dmsSiteFactory, DmsSite component)
          ssr2/        SSR rendering (handler, Express adapter)
        patterns/      Pattern types (admin, auth, page, forms, datasets)
        api/           Data loading/editing (dmsDataLoader, dmsDataEditor)
        ui/            Shared UI components
      dms-server/      Express server with Falcor API + optional SSR
```
