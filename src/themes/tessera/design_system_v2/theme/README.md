# theme/ — The Shipped Code Artifact

This folder is the **production deliverable** for the Tessera theme.

The actual DMS theme lives one level up at:

```
src/themes/tessera/tessera-theme.js
```

That file is the canonical export — wired into the site by `src/themes/index.js` and consumed by every DMS component via `ThemeContext`. The files in this folder mirror or extend it.

## Contents

| File | Role |
|---|---|
| `theme.js` | Re-exports `../../tessera-theme.js` so this folder is portable on its own. If you copy `design_system_v2/` to a new project, swap the import here for the in-folder copy. |
| `tailwind.additions.js` | Suggested additions to the consuming project's `tailwind.config.js` — named brand colors, font-family wiring, optional spacing extensions. Drop-in. |
| `icons.js` | The name → React-component icon map. Currently uses Lucide as the working set per the brief (1.5px stroke, geometric, line-based). Re-map names to a custom drawn set when one ships. |
| `icons/` | SVG sources, by name. Empty in v0.1 — Lucide is loaded from npm. Add custom SVGs here when the brand commissions its own icon set. |

## How the parent theme is structured

See the inline comments at the top of `../../tessera-theme.js` for the full reading order. Quick map:

- **Foundation** — `textSettings`, palette constants, font-family aliases.
- **Composition** — `layout` (3 named styles), `layoutGroup` (4 named styles).
- **Navigation** — `topnav`, `sidenav`, `navigableMenu`, `nestable`, `logo`.
- **Interaction** — `button` (4 named styles), `input`, `multiselect`, `tabs`, `switch`, `field`, `label`.
- **Overlays** — `dialog`, `modal`.
- **Containers / atoms** — `dataCard` (the workhorse), `card`, `pill`, `icon`.
- **Rich content / data** — `lexical`, `graph`, `avlGraph`, `map`, `table`.
- **Pattern-level** — `pages.*`, `datasets.*`, `auth.*`.
- **Extension slots** — `columnTypes`, `pageComponents` (empty in v0.1).

## Conventions used in the theme code

- **Tailwind arbitrary values** (`bg-[#F4F1EA]`) instead of named brand colors. This makes the theme portable without requiring `tailwind.config.js` edits. A future pass should extend Tailwind with `bone`, `slate`, `oxide`, etc. and swap arbitrary values for the names — see `tailwind.additions.js` for the suggested config.
- **Square corners by default.** Tiles have square corners. Only buttons / inputs get `rounded-[2px]`; pills get the full pill.
- **No gradients, no glass, no drop shadows** beyond the single `shadow-[0_1px_2px_rgba(42,47,54,0.04)]` "lifted" treatment. Snap motion (`duration-100`).
- **`styles[0]` is the complete default.** Named variants (e.g. `layout.styles[1]` = `app`, `[2]` = `bare`) are sparse overrides that inherit unspecified keys from `styles[0]`.
- **Class strings are the API.** A site that wants to override a theme key drops in a partial theme; `mergeTheme()` deep-merges `styles[0]` across themes and takes named variants wholesale.

## Wiring into a site

`src/themes/index.js` already imports themes from sibling folders. To activate Tessera:

```js
// src/themes/index.js
import tessera from './tessera/tessera-theme';

export default {
  // … existing themes
  tessera,
};
```

Then a site can use the theme by setting its `theme_id` to point at `tessera`, or by being created with that theme selected at site-creation time.

## Notes for the next design pass

- The brief asks for **Tiempos Headline** (display); v0.1 ships **Newsreader** as a free substitute. When the Tiempos license is acquired, drop the woff2 into `../../Tessera Design System/fonts/` and update `--font-display` in `colors_and_type.css`. Nothing in `tessera-theme.js` needs to change (it references `font-serif` via Tailwind, which the project's Tailwind config maps to the Newsreader stack).
- **Tabular figures.** Numeric contexts in the theme set `tabular-nums` explicitly. If your Tailwind config doesn't have `tabular-nums` as a class, ensure `font-variant-numeric` is set on the relevant elements via `tailwind.additions.js` or the equivalent global CSS.
- **Dark mode** is documented in `colors_and_type.css` but not threaded through the theme — Tessera v0.1 is light-mode first. Adding dark named variants per primitive would be a v0.2 task.
