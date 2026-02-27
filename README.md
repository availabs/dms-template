# DMS Site

React application built on the [AVAIL DMS](src/dms/) library. Provides dynamic page routing, content management, dataset management, and admin patterns via a Falcor JSON Graph API.

## Quick Start

```bash
npm install
cp .env.example .env     # then edit .env to configure your site
npm run dev               # SPA dev server on http://localhost:5173
```

## Configuration

All configuration lives in a single **`.env`** file at the project root. Edit it to switch sites, API hosts, database backends, or enable SSR — no source code changes needed.

```bash
cp .env.example .env
```

### Site identity

These control which DMS site loads. Both the client and server read them.

```env
VITE_DMS_APP=avail               # Application name
VITE_DMS_TYPE=site                # Site type
VITE_DMS_BASE_URL=/list           # Admin base URL
VITE_DMS_AUTH_PATH=/auth          # Auth route path
VITE_DMS_PG_ENVS=npmrds2         # Comma-separated PG environments
```

To switch sites, change `VITE_DMS_APP` and `VITE_DMS_TYPE` and restart the dev server. Some common configurations:

| Site | `VITE_DMS_APP` | `VITE_DMS_TYPE` |
|------|----------------|-----------------|
| AVAIL docs | `avail` | `site` |
| MitigateNY | `mitigat-ny-prod` | `prod` |
| WCDB | `wcdb` | `prod` |
| ASM NHOMB | `asm` | `nhomb` |
| NPMRDS v5 | `npmrdsv5` | `dev2` |

### API host

```env
VITE_API_HOST=https://graph.availabs.org    # Remote Falcor API
# VITE_API_HOST=http://localhost:4444       # Local dms-server
```

When developing with a local dms-server, point `VITE_API_HOST` at it. The SPA dev server (Vite) and the API server run on different ports.

### Server settings

These are server-only — never included in client bundles.

```env
PORT=3001                         # dms-server port
DMS_DB_ENV=dms-sqlite             # Database config (from dms-server/src/db/configs/)
DMS_AUTH_DB_ENV=dms-sqlite        # Auth database config
DMS_LOG_REQUESTS=0                # Falcor request logging (1/0)
JWT_SECRET=                       # JWT signing secret (set for production)
# DMS_SPLIT_MODE=legacy           # Split table mode: 'legacy' or 'per-app'
```

### How `.env` loading works

- **Vite** reads `.env` from the project root automatically. Variables prefixed with `VITE_` are available in client code as `import.meta.env.VITE_*`. Non-prefixed variables are ignored (never leak to the browser).
- **dms-server** loads the root `.env` first, then its own `src/dms/packages/dms-server/.env` second. The server `.env` is optional and overrides root values — use it for database configs that differ between machines.

## Running the Project

### SPA only (client development)

The simplest setup — just the Vite dev server. Data comes from a remote API.

```bash
# 1. Configure
cp .env.example .env
# Edit .env: set VITE_DMS_APP, VITE_DMS_TYPE, VITE_API_HOST

# 2. Run
npm run dev
```

Open http://localhost:5173. Vite provides hot module replacement — edits to React components update instantly.

### SPA + local API server

Run dms-server locally for full-stack development (content editing, dataset uploads, auth).

```bash
# Terminal 1 — API server
npm run server:dev                # dms-server on http://localhost:3001

# Terminal 2 — Client
npm run dev                       # Vite on http://localhost:5173
```

Make sure `.env` points the client at the local server:

```env
VITE_API_HOST=http://localhost:3001
```

The server reads `DMS_DB_ENV` to pick its database. Available configs are JSON files in `src/dms/packages/dms-server/src/db/configs/`:
- `dms-sqlite` — local SQLite file (default, zero setup)
- Any custom config you create (PostgreSQL, remote databases, etc.)

### SSR (server-side rendering)

SSR renders pages to HTML on the server so users see content immediately. It runs inside dms-server alongside the Falcor API.

SSR is **additive** — the same `index.html`, `main.jsx`, and `App.jsx` serve both SPA and SSR. When `DMS_SSR` is not set, dms-server is a plain API server. When set, it also serves the rendered site.

#### SSR development

Add `DMS_SSR=1` to your `.env`:

```env
DMS_SSR=1
VITE_DMS_APP=avail
VITE_DMS_TYPE=site
VITE_API_HOST=http://localhost:3001
```

Then start the server:

```bash
npm run server:dev
```

That's it. Vite runs in middleware mode inside Express — you get HMR for both client and server code. Open http://localhost:3001 and view source to see server-rendered HTML.

There is no separate Vite dev server in SSR mode. The Express server handles everything: API requests go to `/graph`, all other requests get SSR-rendered HTML.

#### SSR production

Build both client and server bundles, then start the server:

```bash
# Build
npm run build:ssr          # creates dist/client/ and dist/server/

# Run
NODE_ENV=production npm run server
```

In production mode, dms-server serves the pre-built static assets from `dist/client/` and uses the compiled server bundle from `dist/server/`. Vite is not involved at runtime.

### Production SPA build (static deploy)

For deploying to Netlify, S3, or any static host — no server needed.

```bash
npm run build              # Build to dist/
npm run preview            # Preview locally before deploying
npm run deploy             # Deploy to Netlify (primary site)
```

The `VITE_*` values from `.env` are baked into the bundle at build time. The built `dist/` folder is pure static HTML + JS + CSS.

## Build Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Vite dev server (SPA mode) |
| `npm run build` | Production SPA build to `dist/` |
| `npm run build:client` | Client bundle to `dist/client/` |
| `npm run build:server` | Server bundle to `dist/server/` |
| `npm run build:ssr` | Both client + server builds |
| `npm run preview` | Preview SPA production build locally |
| `npm run server` | Start dms-server |
| `npm run server:dev` | Start dms-server with auto-restart (nodemon) |

## Project Structure

```
.env.example               Configuration template
.env                       Local config (gitignored)
index.html                 HTML shell (serves both SPA and SSR)
src/
  App.jsx                  Root component — reads config from import.meta.env
  main.jsx                 Client entry — SPA (createRoot) or SSR (hydrateRoot)
  entry-ssr.jsx            Server entry — wires themes + adminConfig into SSR handler
  themes/                  Theme definitions (catalyst, mny, transportny, wcdb, avail)
  dms/                     Git submodule — @availabs/dms library
    packages/
      dms/src/
        render/
          spa/             SPA rendering (dmsSiteFactory, DmsSite component)
          ssr2/            SSR rendering (handler, Express adapter)
        patterns/          Pattern types (admin, auth, page, forms, datasets)
        api/               Data loading/editing (dmsDataLoader, dmsDataEditor)
        ui/                Shared UI components
      dms-server/          Express server — Falcor API + optional SSR
        .env               Optional server-specific overrides
        src/db/configs/    Database configuration files
```
