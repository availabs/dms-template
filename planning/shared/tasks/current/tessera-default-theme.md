# Make tessera_v6 the site-wide default theme

**Project:** Shared

## Objective

Any pattern that never had a theme explicitly picked — across **every** project in this repo, not
just tessera — should render using `tessera_v6` instead of the DMS library's bare built-in
`defaultTheme.js`. Projects that already set an explicit `theme.selectedTheme` (transportny,
mitigateny, landbank, wcdb, mny, avail…) are completely unaffected; this only changes what
"nothing was chosen" resolves to.

This includes the **admin pattern**, which every project's site gets for free and which hardcodes
`selectedTheme: "default"` (`src/dms/packages/dms/src/patterns/admin/siteConfig.jsx`) — so every
project's admin panel will start rendering in tessera_v6, uniformly. **This is intentional, per the
user**, not a side effect to work around: "i do want that admin panels look the same for all
projects. if they want a different look, they'll update their theme and i'll update the code so it
looks for it. that's a later thing though." Per-project admin re-skinning is explicitly out of scope
here — a future task, not this one.

## Decision record (resolved with the user before implementing)

- **Admin pattern's hardcoded `selectedTheme: "default"`**: left as-is, not special-cased away.
  Confirmed desired — it's exactly the mechanism that makes every project's admin look the same.
- **Custom tessera components (`EditorMockup`, `LandingHero`) not registering under other themes**:
  confirmed acceptable. "if a theme doesn't register a component, a user won't be able to add it to
  the page. that's fine." (Verified separately: same component-registry/lookup mechanism as `Card` —
  an unresolved `element-type` renders a visible `"Component {type} Not Registered"` placeholder in
  view mode, not a crash; edit mode falls back to plain rich text. See the companion library task,
  below, for the full trace — no code change was needed there, this was purely a verification pass.)
- **Page/section content itself already goes through the normal DMS page/pattern/section system**
  (confirmed by re-reading `planning/tessera/tasks/current/tessera-v6-landing-pages.md`: all 3 tessera
  pages were built via `dms page create` / `dms section create --data`, no hardcoded React pages).
  So "other themes can override how any page looks" already holds structurally for the content model
  (Card cells, text, layout) — the 2 bespoke illustration components are the one place tessera pages
  carry theme-specific chrome, which is expected (they render the tessera product itself).

## Root cause + the actual fix

Full trace and the library-side fix live in the submodule task:
[`src/dms/planning/tasks/current/collect-theme-names-default-sentinel.md`](../../../src/dms/planning/tasks/current/collect-theme-names-default-sentinel.md)
— summary: `collectThemeNames()` never requested the `'default'` name from the lazy theme loader, so
even a `loaders.default` entry would never be invoked. Fixed there (one line, `src/dms` submodule).

**This task's own (dms-template-side) change**, once that fix landed:

- `src/themes/index.js` — added a `default` entry to the `loaders` map, pointing at the same module
  `tessera_v6` already uses:
  ```js
  const loaders = {
    default:       () => import('./tessera/tessera-theme-v6'),
    catalyst:      () => import('./catalyst/theme'),
    ...
  }
  ```
  `tessera_v6` stays as its own explicit key too (tessera's own patterns still select it by name — see
  `planning/tessera/tasks/current/tessera-v6-landing-pages.md`'s Fidelity Pass 2+). Both loader entries
  resolve the identical dynamic-import specifier, so no duplicate chunk.

## Known, accepted side effect — not fixed here

`themeEditor.jsx` (the admin pattern-theme picker) lists every name in `loadThemes.ALL_NAMES` (i.e.
`Object.keys(loaders)`) as a selectable option (`patterns/admin/pages/patternEditor/default/themeEditor.jsx:212-214`).
Adding a `default` key means the picker now shows **both** `"default"` and `"tessera_v6"` as separate
options that render identically. Cosmetically redundant, not broken — an author picking either gets
the same result. Not fixed in this pass; flag if it becomes an actual complaint.

## Files changed

- `src/dms/packages/dms/src/render/spa/utils/index.js` — `collectThemeNames()` (submodule; see linked task).
- `src/themes/index.js` — new `default` loader entry (this repo).

## Testing checklist

- [ ] `npm run dev`, load a site/pattern that has never had `theme.selectedTheme` set (or hits it via
      a fresh/no-access stub) — confirm it renders tessera_v6-styled, not the bare library default.
- [ ] Load the **admin** panel for an existing non-tessera project (e.g. mitigateny or transportny
      locally) — confirm it now renders tessera_v6-styled, and that the project's own **content**
      pages (which have an explicit `selectedTheme`) are unaffected.
- [ ] Load tessera's own site — confirm no regression (tessera's patterns already explicitly select
      `tessera_v6`, so this is a no-op path for them, but worth a quick check).
- [ ] Confirm SSR path too, not just client SPA cold-load (see the library task's trace of all 3
      `pattern2routes` call sites — SSR uses the identical `resolveThemes`/`collectThemeNames` chain).
- [ ] Note (don't necessarily fix) the theme-picker dropdown redundancy above if it's noticed live.
