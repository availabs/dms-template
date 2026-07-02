# Tessera v3 — theme artifacts

The pieces the theme translation (`src/dms/skills/translating-design-system-to-dms-theme.md`)
consumes when producing the runnable `theme.js` overlay. The design pages
in `../design-system/` and `../pages/` are the visual contract; these files
are the machine-readable fragments.

| File | Role |
|---|---|
| `icons.js` | Icon registry, **source of truth** — name → React SVG component, ~48 drawn glyphs. The live `src/themes/tessera/icons.jsx` is generated from it by `scratchpad/scripts/icons-sync.mjs` (do not run until the v3 translation lands; the live file currently serves v2's Lucide registry). |
| `index.css.additions` | Pointer shim to `../_shared.css`, the canonical CSS. When translating, mirror `_shared.css` verbatim into the production CSS additions, minus the `dms-annotated` documentation overlay. |
| `tailwind.additions.js` | The `theme.extend` block (brand colors, families, the lift shadow, content/measure widths). Same block every mockup carries inline. |

## Translation notes

- **textSettings**: the 16 `.t-*` classes in `_shared.css` map 1:1 to
  `textSettings.styles[0]` keys (`displayHero` … `metaXS`). Modifier axes
  (color, tabular-nums, italic, uppercase) are call-site classes.
- **Canonical component recipes** (buttons, inputs, pills, table, dataCard,
  overlays, navs) are on `../design-system/components.html`; the wrapper
  class strings for Layout/LayoutGroup variants are in the reference table
  on `../design-system/layouts.html`; the sectionArray spec (12-col,
  gap-0, padding steps, inner-box chrome, `layouts.centered:
  'max-w-[1280px] mr-auto'`) is on `../design-system/grid.html`.
- **`slate` replaces Tailwind's slate scale** — brand pages never use
  numbered palette steps.
- The v2 runtime theme (`../../tessera-theme.js`) remains the live theme
  until the v3 translation replaces it.
