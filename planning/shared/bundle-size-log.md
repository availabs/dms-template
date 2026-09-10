# Bundle size log

**Project:** shared

Running record of changes that affect the production client bundle (`npm run build` → `dist/assets/*.js`),
with measured before/after sizes. Append a new entry for every change made specifically to reduce or that
otherwise materially moves bundle size — don't log routine feature work here.

Only `dist/assets/*` (the JS/CSS Rollup output) is tracked. `dist/themes`, `dist/fonts`, `dist/data`, etc.
are static site assets copied verbatim from `public/` — unrelated to code-splitting/dependency work and not
part of this log.

Sizes are raw / gzip, read from the `npm run build` output table. "Eager" chunks (`index`, `vendor`,
`maplibre`) load on every page visit; a chunk is a real win only when it either shrinks an eager chunk or
moves weight out of one into something lazy (dynamic `import()`).

## How to measure

```bash
npm run build   # prints a per-chunk size table at the end
```

Compare the relevant chunk's raw/gzip size before and after your change. A chunk hash changing with an
identical size is noise; a hash changing with the *same* size to the byte usually means the change had zero
effect on that chunk's content (e.g. dead code that Rollup had already tree-shaken out).

## Log

### 2026-09-01 — Legacy Graph + Map Dama dead-code removal

**Change:** Deleted the legacy `ComponentRegistry/graph/` + `ui/components/graph/` module tree (superseded
by `graph_new`/`AvlGraph`, its registry entry had been commented out for a while), deleted the dead
`ComponentRegistry/map_dama/` tree (superseded by `map/`), removed the orphaned `graph_new/components/ScatterPlot.jsx`
(never wired into `GraphTypeOptions`), removed the `@observablehq/plot` dependency and its SSR
`noExternal` special-case, and dropped the dead `AvlGraph: Graph` alias key from `ui/index.js`.

Also fixed 4 dangling imports these deletions left behind that broke the build (`ComponentRegistry/index.jsx`'s
unused `LegacyGraph` import, `ui/defaultTheme.js`'s dead `graph` theme key, `ui/docs.js`'s dead `Graph` doc
entry, and `map/useComparisonSeriesLayers.js`'s live `getColorRange` import repointed from the deleted
`graph/colorRange.js` to the equivalent `graph_new/colorRange.js`) — and added 5 phantom d3 sub-dependencies
(`d3-hierarchy`, `d3-selection`, `d3-transition`, `d3-axis`, `d3-scale-chromatic`) to `package.json` that
`graph_new` had always relied on being hoisted transitively via `@observablehq/plot`.

| Chunk | Before | After | Δ |
|---|---|---|---|
| `vendor` | 2,149.82 kB / 656.88 kB gzip | 2,149.82 kB / 656.88 kB gzip (byte-identical) | **0** |

**Net effect on `dist/`: zero.** By the time `@observablehq/plot` was removed from `package.json`, nothing
in the source tree could reach it any more — Rollup was already tree-shaking it out, confirmed by an
identical output chunk hash before and after the dependency removal. The real elimination happened earlier
(pre-log, not separately measured): `ui/index.js` used to have a *live*, unconditional
`import Graph from "./components/graph"` that pulled the legacy Plot-based graph into every bundle even
though no section type resolved to it any more — cutting that import is what actually mattered; removing
the npm dependency afterward was cleanup of `node_modules`/lockfile size and dead source, not a `dist` win.

**Lesson:** always check *why* something is still resolvable (grep the literal import path) before assuming
deleting the dependency will shrink the bundle — dead code already gets tree-shaken; the size only drops
once the last reachable import to it is cut.

### 2026-09-01 — Lazy-load exceljs/jszip (data export)

**Change:** `dataWrapper/index.jsx`'s `triggerDownload()` (the Excel/CSV export path, only invoked from an
explicit user action — a download button click or a page-param-triggered export) statically imported
`exceljs` and `jszip` at module scope, so both shipped in the eager `vendor` chunk on every page load
regardless of whether the page has any exportable data. Converted both to a `Promise.all([import('exceljs'),
import('jszip')])` inside `triggerDownload`.

That alone wasn't enough — `vite.config.js`'s `manualChunks` forced *every* `node_modules` module into the
single `vendor` bucket regardless of static-vs-dynamic import, which silently defeated the code-split (first
rebuild showed `vendor` essentially unchanged, no new chunk emitted). Fixed by special-casing `exceljs`/`jszip`
into their own `excel-export` manual chunk, ahead of the catch-all `vendor` bucket.

| Chunk | Before | After | Δ |
|---|---|---|---|
| `vendor` (eager) | 2,149.91 kB / 656.64 kB gzip | 1,109.09 kB / 355.67 kB gzip | **−1,040.82 kB / −300.97 kB gzip** |
| `excel-export` (new, lazy) | — | 1,036.10 kB / 300.08 kB gzip | new chunk, loads only on export |
| `index` (eager, app code) | 3,673.89 kB / 1,046.38 kB gzip | 3,685.23 kB / 1,049.73 kB gzip | +11.34 kB / +3.35 kB gzip (wrapper glue) |

**Net effect: ~1 MB raw / ~300 KB gzip removed from every page's eager load**, moved behind a dynamic
import that only fires when a user actually exports data. This is the largest single win so far this
session — an order of magnitude more than the graph/plot cleanup above, because exceljs+jszip were, unlike
Plot, genuinely still reachable (and therefore bundled) on every page.

**Lesson:** `manualChunks` functions that lump all of `node_modules` into one `vendor` bucket silently cancel
out dynamic-import code-splitting. When lazy-loading a heavy dependency, check the chunk output actually
gained a *new* file — if the target chunk's size didn't move, the manualChunks config is probably
re-merging it.

### 2026-09-01 — Investigated maplibre eager-load (held off — real tradeoff, not free)

**Finding:** `maplibre-gl` (1.05 MB / 285 kB gzip) loads on every page because `ComponentRegistry/index.jsx`
statically imports every section type up front, including `Map`, and that registry is reached unconditionally
from the core page-rendering path — no per-section-type code splitting exists. Confirmed `maplibre-gl` itself
loads fine under Node (doesn't touch `window` at import time) and the live map canvas already only
instantiates inside a client-only `useEffect` (`avl-map.jsx`), so SSR never rendered live tiles anyway.

**Why not done:** this app's SSR path (`render/ssr2/handler.jsx`, uses `renderToString`) is real, deliberately
engineered infrastructure (see [[project_bundle_size_reduction]] — flag-gated via `.env`'s `DMS_SSR`, not
dead code). `React.lazy`/`Suspense` (the mechanism already used once in this codebase for `SyncStatus`,
`dmsSiteFactory.jsx:167`, with `fallback={null}`) doesn't wait for the dynamic import during `renderToString`
— it renders the fallback immediately. Unlike `SyncStatus`, Map's `map/index.jsx` renders real synchronous
chrome (legend panel, layer library panel) even without live tiles, so lazy-loading it would drop that
content from server-rendered HTML for any page with a Map section. Real size win, but a genuine SSR-content
tradeoff, not a free cleanup — left for a deliberate decision rather than done opportunistically.

### 2026-09-01 — Removed dead `write-excel-file` dependency

**Change:** `src/dms/packages/dms/package.json` declared `write-excel-file` with zero usages anywhere in the
source tree (confirmed via repo-wide grep for both the import specifier and its `writeXlsxFile` export).
Removed it and ran `npm install`.

**Effect:** `npm install` removed 914 transitive packages. Node_modules/lockfile cleanup only — like the
`@observablehq/plot` removal, dead code was never reachable so `dist` was unaffected either way; `vendor`
moved a few KB (1,109.09 kB → 1,090.51 kB raw) most likely from incidental dependency-hoisting shuffle, not
from this removal directly.

**Lesson (same as the Plot entry):** a huge `node_modules` footprint for a dependency doesn't mean it's
costing you anything in `dist` — check reachability first. The value here is repo hygiene and slightly
faster installs, not bundle size.

### 2026-09-01 — Per-site theme lazy-loading (SPA + SSR)

**Change:** `src/themes/index.js` converted from one eager object statically importing all 10 themes
(catalyst, mny, mny_admin, transportny, transportnyv2, wcdb, avail, tessera, tessera_v6, landbank) to a
memoizing lazy loader (`loadThemes(names)`, dynamic `import()` per theme, deduped/cached). Only the theme
name(s) a site's own pattern rows actually reference (`collectThemeNames`, new export in
`render/spa/utils/index.js`) are resolved — the site's main theme, plus `mny_admin` when the site has an
`auth` pattern (that pattern's `/auth/manage` panel hardcodes it; `patterns/admin/siteConfig.jsx` itself
uses `selectedTheme: "default"`, needing no theme module at all).

Resolution happens *before* the render that needs it, never via `React.lazy`/`Suspense` (ruled out for the
same hydration-mismatch reason as the maplibre investigation — themes can embed real components, e.g.
`catalyst/theme.jsx`'s custom `Logo`). Three call sites needed it: the async `dmsSiteFactory` function
(covers SPA cold-start/full-fetch and SSR, since SSR's `buildRoutes` calls this same function); `DmsSite`'s
synchronous `localStorePatterns`/`defaultData` fast-path (converted to a parallel async effect, since
dynamic `import()` can never be synchronous); and `main.jsx`, which now `await`s the theme(s) via the same
`collectThemeNames` run against `window.__dmsSSRData.defaultData` (already sent today, no new server
payload needed) *before* calling `hydrateRoot` — this is what keeps SSR hydration mismatch-free. One
`vite.config.js` fix was required too — `@carbon/icons-react`/`lucide-react` needed carving out of the
`manualChunks` catch-all `vendor` bucket, same trap hit with exceljs, or the theme *files* would split but
their heavy deps wouldn't. One extra consumer needed a narrow fix: `themeEditor.jsx` (the `/list` pattern
theme picker) legitimately needs the *full* theme registry for its dropdown/live-preview, not a site's
narrow subset — it now lazily fetches the rest via a separate `themesLoader` prop, only when it mounts.

Full design doc (with rejected alternatives and the reasoning for each) is in the session's approved plan;
see `getPatternTheme`/`pattern2routes`/`siteConfig.jsx` files, all left completely unchanged — they still
receive a plain, already-resolved `themes` object exactly as before.

**Correctness hardening (same day, no size change):** an adversarial review of this design surfaced three
real bugs, each reproduced with a Playwright script *before* fixing (localStorage tampering + network-delay
interception to force the exact race/failure conditions), then re-run against the fix to confirm resolution:
1. **Race condition** — `DmsSite`'s cached-data fast path and the full network-fetch path both resolve their
   own theme(s) independently; if an admin changed the site's theme since a visitor's last visit, the two
   paths race on two unrelated dynamic `import()`s with no ordering guarantee, and a slow-to-resolve stale
   (cached) theme could commit *after* the fresh one, permanently overwriting it. Fixed with a
   `routesFinalizedRef` the fast path checks before committing.
2. **Missing `adminThemesLoader` on the fast path** — the admin theme-picker (`themeEditor.jsx`) could
   briefly see only the site's narrow theme subset instead of the full registry, if opened before the full
   fetch replaced the fast path's routes. Fixed by threading it through that call too.
3. **Silent degradation on theme-load failure** — a chunk 404 (stale hash after a redeploy) or network
   failure left the page invisibly unstyled with only a `console.warn`, no recovery. Fixed with a one-shot
   `sessionStorage`-guarded `window.location.reload()` per theme name (falls through to the old `{}`
   fallback if the reload doesn't help, so it can't loop forever).

| Chunk | Before | After | Δ |
|---|---|---|---|
| `index` (main app, eager) | 3,685.23 kB / 1,049.73 kB gzip | 2,447.61 kB / 725.38 kB gzip | **−1,237.62 kB / −324.35 kB gzip** |
| `vendor` (eager) | 1,090.51 kB / ~350 kB gzip | 1,030.96 kB / 335.04 kB gzip | −59.55 kB / ~−15 kB gzip |
| new theme chunks (lazy, one per theme) | — | ~5–280 kB each, only the active site's theme(s) load | e.g. `theme-C2k0026G.js` (176 kB, mny's shared icons+theme code) never loads for landbank/wcdb/tessera |

**Verified, not just measured:** grepped built output for a `@carbon/icons-react`-specific export name
(`SettingsAdjust`) — appears in exactly one chunk, never `vendor`/`index`/`maplibre`/`excel-export`. Ran a
live Playwright check (headless Chrome) against `npm run dev` for the mitigat-ny-prod site: only
`mny/theme.js`, `mny/admin.theme.js`, and their shared `mny/icons.jsx` were fetched — zero requests for
catalyst/tessera/wcdb/landbank/transportny/avail theme files. Console showed zero new warnings/errors on
both first load and reload (the reload exercises the `localStorePatterns` fast path) — confirmed by diffing
against the pre-change code via `git stash` (the one pre-existing warning, "No `HydrateFallback` element
provided", reproduces identically on the original code, so it's unrelated). Separately ran the real SSR
path (`DMS_SSR=1`, `npm run server:dev`) and hit it with a live browser: server-rendered HTML contains full
page content, `window.__dmsSSRData` is populated, and post-hydration console showed **zero** hydration-
mismatch warnings.

**Bonus finding during implementation:** `lucide-react` turned out to be *fully dead* already — its only
import site, `tessera/design_system_v2/theme/icons.js`, is not reachable from either live tessera loader
entry (`tessera-theme.js` and `tessera-theme-v6.js` use hand-drawn SVG icons instead). Confirmed via a
built-output grep for its `lucide-` class-name fingerprint — zero hits anywhere in `dist/`. Candidate for a
`write-excel-file`-style dependency removal (see below) — no `dist` impact either way since Rollup was
already excluding it, but worth pruning from `package.json`.

## Candidates not yet done

- Remove the dead `lucide-react` dependency from `src/dms/packages/dms/package.json` (see finding above) —
  zero `dist` impact, `node_modules`/lockfile cleanup only, same category as the `write-excel-file` removal.
- `dist/index-*.js` is still 2.4 MB raw / 725 kB gzip after the theme-splitting work above — worth a further
  audit of what else in there could be feature-gated behind `import()` (lexical editor, PDF export, map
  symbology editors, etc.) the same way exceljs was.
- `maplibre` (1.05 MB raw / 285 kB gzip, see the investigation above) — still eager on every page; a real
  win but a genuine SSR-content tradeoff, left for a deliberate decision rather than done opportunistically.
