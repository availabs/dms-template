// Lazily-loaded theme registry. Each entry is a dynamic import() — Rollup
// code-splits each theme (and its theme-specific heavy deps, e.g.
// mny_admin's @carbon/icons-react, tessera's lucide-react) into its own
// chunk, fetched only when that theme name is actually needed. See
// planning/shared/bundle-size-log.md for why this exists.
const loaders = {
  catalyst:      () => import('./catalyst/theme'),
  transportny:   () => import('./transportny/theme'),
  transportnyv2: () => import('./transportny/themev2'),
  mnyv1:         () => import('./mny/theme'),
  mny_admin:     () => import('./mny/admin.theme'),
  wcdb:          () => import('./wcdb/wcdb_theme'),
  avail:         () => import('./avail/theme'),
  tessera:       () => import('./tessera/tessera-theme'),
  tessera_v6:    () => import('./tessera/tessera-theme-v6'),
  landbank:      () => import('./landbank/theme'),
}

const resolved = {}   // name -> theme object, memoized for this page session
const inflight = {}   // name -> Promise, dedupes concurrent loads of the same name

// Most theme-load failures in production are a stale asset reference: this
// tab's already-loaded index.html points at a chunk hash a newer deploy no
// longer serves. A silent {} fallback would leave the page invisibly
// unstyled with no way to recover short of the user manually refreshing.
// Reload once per theme name per tab session to pick up the new deployment;
// the sessionStorage guard stops a genuinely-broken/offline load (where a
// reload won't help) from looping forever — the second failure for the same
// name just falls through to the {} fallback as before.
function tryRecoverFromLoadFailure(name) {
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') return false
  const key = `dms-theme-reload-${name}`
  if (sessionStorage.getItem(key)) return false
  try {
    sessionStorage.setItem(key, '1')
  } catch {
    return false // storage unavailable/full — fall through to the {} fallback
  }
  window.location.reload()
  return true
}

async function loadOne(name) {
  if (!loaders[name]) return null   // unknown / DB-authored name — caller's dbThemes merge handles it
  if (resolved[name]) return resolved[name]
  if (!inflight[name]) {
    inflight[name] = loaders[name]()
      .then(mod => { resolved[name] = mod.default; return resolved[name] })
      .catch(err => {
        delete inflight[name]
        console.error(`[themes] failed to load "${name}":`, err)
        if (tryRecoverFromLoadFailure(name)) return new Promise(() => {}) // reloading — never resolve, let navigation take over
        return {}
      })
  }
  return inflight[name]
}

async function loadThemes(names) {
  const uniq = [...new Set((names || []).filter(Boolean))]
  const entries = await Promise.all(uniq.map(async n => [n, await loadOne(n)]))
  return Object.fromEntries(entries.filter(([, v]) => v))
}

// Self-describing: the one consumer that needs "every theme" (the admin
// pattern-theme-picker) reads this instead of hardcoding the theme name list.
loadThemes.ALL_NAMES = Object.keys(loaders)

export default loadThemes
