import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

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

export default defineConfig(({ isSsrBuild }) => ({
  resolve: {
    alias: [
      { find: '~', replacement: path.resolve(__dirname, 'src') },
      { find: "lodash", replacement: 'lodash-es' },
      // avl-falcor's "main" points to CJS dist/index.js — breaks Vite 7's SSR
      // module runner (exports is not defined). Point at ESM source instead.
      // Client: xhr2 (Node-only dep in the source) is handled by optimizeDeps.
      // MUST be regex (exact match) — string find matches as prefix, which would
      // mangle deep path imports like '@availabs/avl-falcor/src/...'.
      { find: /^@availabs\/avl-falcor$/, replacement: path.resolve(__dirname, 'node_modules/@availabs/avl-falcor/src/index.jsx') },
      // falcor is CJS — Node's cjs-module-lexer can't detect `Model` as a named
      // export (set via `falcor.Model = require(...)` after module.exports).
      // ESM shim re-exports via default import.
      { find: /^falcor$/, replacement: path.resolve(__dirname, 'src/dms/packages/dms/src/render/ssr2/falcor-shim.js') },
    ]
  },
  // The avl-falcor alias points at ESM source which imports CJS deps directly.
  // Vite's dep scanner misses these because the alias target is a local file.
  // Pre-bundle them so the browser gets ESM wrappers.
  optimizeDeps: {
    include: [
      'xhr2',                // Node-only, resolved to browser entry (CJS)
      'falcor/lib/ModelRoot', // CJS deep import from falcorGraph.js
      'lodash.throttle',     // CJS package import from falcorGraph.js
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
    // SSR: skip React Compiler (memoization is pointless for one-shot renders)
    // and TailwindCSS (no CSS output needed on the server).
    react(isSsrBuild ? {} : {
      babel: {
        plugins: [
          'babel-plugin-react-compiler',
        ],
      },
    }),
    !isSsrBuild && tailwindcss(),
    buildProgress(),
  ].filter(Boolean),
}))
