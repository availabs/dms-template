import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// index.html references %VITE_DMS_TITLE% / %VITE_DMS_FAVICON% for the tab
// title/icon shown before the app's JS has loaded site data and called
// document.title = ... (see PatternTitle.jsx). Vite's built-in %VAR%
// replacement leaves the placeholder text littered in the page — and warns
// on every transform — whenever a deployment hasn't set these two env vars.
// This repo is deployed to many Netlify sites (see package.json's deploy-*
// scripts); not every one of them has VITE_DMS_TITLE/VITE_DMS_FAVICON
// configured. Resolve them ourselves with a generic fallback so a missing
// var degrades to a neutral placeholder instead of leaking `%VITE_DMS_TITLE%`
// to real users. A site can still override by setting the env var normally.
function htmlEnvDefaults(env) {
  const title = env.VITE_DMS_TITLE || 'AVAIL DMS'
  const favicon = env.VITE_DMS_FAVICON || '/favicon.ico'
  return {
    name: 'html-env-defaults',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return html
          .replace(/%VITE_DMS_TITLE%/g, title)
          .replace(/%VITE_DMS_FAVICON%/g, favicon)
      },
    },
  }
}

// Progress reporter — shows module count during long transforms
function buildProgress() {
  let count = 0
  return {
    name: 'build-progress',
    transform() {
      count++
      if (count % 50 === 0) {
        process.stderr.write(`\rtransforming (${count})...`)
      }
    },
    buildEnd() {
      if (count > 0) process.stderr.write(`\rtransforming (${count})... done.\n`)
    },
  }
}

export default defineConfig(({ isSsrBuild, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    server: {
      watch: {
        // Don't watch large non-source trees. inotify watches are per-directory
        // AND shared across all of the user's processes (editor, SSR server, etc.),
        // so descending into these blows past fs.inotify.max_user_watches with
        // ENOSPC. references/ alone is a 15GB / ~5,300-dir map-tile pyramid; none
        // of these are app source, so excluding them only skips needless HMR.
        // (Merged with Vite's built-in ignores: node_modules, .git, dist, cacheDir.)
        ignored: [
          path.resolve(__dirname, 'references/**'),
          path.resolve(__dirname, '.netlify/**'),
          path.resolve(__dirname, 'scratchpad/**'),
          path.resolve(__dirname, 'research/**'),
        ],
      },
    },
    resolve: {
      alias: [
        { find: '~', replacement: path.resolve(__dirname, 'src') },
        { find: "lodash", replacement: 'lodash-es' },
        // avl-falcor's "main" points to CJS dist/index.js — breaks Vite's SSR
        // module runner (exports is not defined). Point at ESM source instead.
        // Client: xhr2 (Node-only dep in the source) is handled by optimizeDeps.
        // MUST be regex (exact match) — string find matches as prefix, which would
        // mangle deep path imports like '@availabs/avl-falcor/src/...'.
        { find: /^@availabs\/avl-falcor$/, replacement: path.resolve(__dirname, 'node_modules/@availabs/avl-falcor/src/index.jsx') },
        // falcor is CJS — Node's cjs-module-lexer can't detect `Model` as a named
        // export (set via `falcor.Model = require(...)` after module.exports).
        // ESM shim re-exports via default import.
        { find: /^falcor$/, replacement: path.resolve(__dirname, 'src/dms/packages/dms/src/render/ssr2/falcor-shim.js') },
        // Force all yjs imports to a single copy — prevents duplicate-import check.
        { find: /^yjs$/, replacement: path.resolve(__dirname, 'node_modules/yjs/dist/yjs.mjs') },
      ]
    },
    // The avl-falcor alias points at ESM source which imports CJS deps directly.
    // Vite's dep scanner misses these because the alias target is a local file.
    // Pre-bundle them so the browser gets ESM wrappers.
    optimizeDeps: {
      // Limit dep scanner to main entry — prevents it from crawling research/
      // (which has its own Vite config with different aliases like @dms/ui/...)
      entries: ['index.html'],
      include: [
        'xhr2',                // Node-only, resolved to browser entry (CJS)
        'falcor/lib/ModelRoot', // CJS deep import from falcorGraph.js
      ],
      exclude: [
        'linkedom', // Node-only SSR dep, not needed in browser
      ],
    },
    build: {
      outDir: 'dist',
      // Client: split vendor/maplibre chunks. SSR: single bundle is fine.
      rollupOptions: isSsrBuild ? {} : {
        output: {
          manualChunks: (id) => {
            if (id.includes('maplibre-gl')) {
              return 'maplibre';
            } else if (id.includes('exceljs') || id.includes('jszip')) {
              // Only reachable via dynamic import() in dataWrapper's triggerDownload —
              // kept out of the 'vendor' bucket so it stays a lazily-loaded chunk
              // instead of being force-merged into the eagerly-loaded vendor bundle.
              return 'excel-export';
            } else if (id.includes('@carbon/icons-react') || id.includes('lucide-react')) {
              // Only reachable via dynamic import() through src/themes' lazy theme
              // loader (mny_admin -> @carbon/icons-react, tessera -> lucide-react) —
              // must not be swept into 'vendor', or every site would still
              // eagerly download both icon libraries regardless of its theme.
              return undefined;
            } else if (id.includes('node_modules')) {
              return 'vendor';
            }
          },
        },
      },
    },
    ssr: {
      // avl-falcor is aliased to its ESM/JSX source — must be non-external so
      // Vite transforms it rather than letting Node load the CJS dist.
      // Everything else stays as Node externals (Node's CJS interop handles them).
      noExternal: [
        '@availabs/avl-falcor',
        'colorbrewer',  // "type":"module" but main is UMD — Vite uses "module" field (ESM)
      ],
    },
    plugins: [
      // SSR: skip React Compiler (memoization is pointless for one-shot renders).
      // Dev: skip React Compiler so referential-identity bugs surface during
      // development instead of being silently masked by auto-memoization.
      react(isSsrBuild || mode !== 'production' ? {} : {
        babel: {
          plugins: ['babel-plugin-react-compiler'],
        },
      }),
      !isSsrBuild && tailwindcss(),
      buildProgress(),
      htmlEnvDefaults(env),
    ].filter(Boolean),
  }
})
