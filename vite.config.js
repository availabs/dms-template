import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The compiled entry stylesheet (all real theme colors/fonts/backgrounds)
// is otherwise injected last in <head> by Vite's html plugin — after the
// module script and modulepreload links — so the browser discovers and
// fetches it last too. On a fresh/SSR load that means real content paints
// unstyled first, then the theme snaps in once this file finally arrives
// (a visible flash). Hoisting just this one <link> to the very top of
// <head> gets it discovered and fetched first, without touching the
// hand-authored font links/style blocks below it (index.html's Google
// Fonts @import and the runtime Tailwind theme-editor block are a
// deliberate different pattern — see ui/useTheme.js — and are untouched).
function hoistEntryCss() {
  const CSS_LINK_RE = /<link[^>]*href="\/assets\/[^"]+\.css"[^>]*>\n?/;
  return {
    name: 'hoist-entry-css',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const match = html.match(CSS_LINK_RE);
        if (!match) return html;
        const tag = match[0].trim();
        return html
          .replace(CSS_LINK_RE, '')
          .replace('<head>', `<head>\n    ${tag}`);
      },
    },
  };
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

export default defineConfig(({ isSsrBuild, mode }) => ({
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
      // @observablehq/plot re-exports the full 'd3' meta-package (which itself
      // re-exports every d3-* submodule). Left external, Rollup/Rolldown's SSR
      // build mis-merges those re-exported symbols into a single bogus
      // `from "d3-array"` import (e.g. curveBasis, actually from d3-shape,
      // ends up attributed to d3-array) — a hard crash on SSR boot. Bundling
      // this whole family instead avoids that external-merge path.
      '@observablehq/plot',
      /^d3(-.*)?$/,
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
    !isSsrBuild && hoistEntryCss(),
    buildProgress(),
  ].filter(Boolean),
}))
