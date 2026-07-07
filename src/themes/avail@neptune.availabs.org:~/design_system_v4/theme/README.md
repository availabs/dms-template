# theme/ — artifacts for the v4 theme translation

Inputs for `src/dms/skills/translating-design-system-to-dms-theme.md`
when the v4 (console) theme translation happens. Until then the live
site keeps running the v2 runtime theme (`../../tessera-theme.js`).

- **`icons.js`** — the icon registry, SOURCE OF TRUTH (63 glyphs).
  `icons-sync` will generate the live `src/themes/tessera/icons.jsx`
  from it — **do not sync yet**; the live registry still belongs to
  the v2 theme.
- **`index.css.additions`** — pointer shim to `../_shared.css`, which
  holds the canonical CSS (type tokens `.t-*`, surface utilities
  `.tes-*`). The shim exists because mockup pages must link a real
  `.css` file (MIME), while this filename is what the translation
  consumes. **At translation time, inline the full content of
  `../_shared.css` here** — the relative `@import` only resolves
  inside the mockup folder.
- **`tailwind.additions.js`** — the `theme.extend` block (colors,
  fonts, shadows, maxWidths). Must stay byte-identical to the inline
  `tailwind.config` blocks in every page head; grep the pages when
  changing a value.

Translation notes:

- `textSettings.styles[0]` maps 1:1 to the 14 `.t-*` tokens on
  `design-system/theme.html` [02].
- `sectionArray`: gridSize 12 · `gap-0` · sectionPadding `p-3` ·
  `layouts.centered = 'max-w-[1280px] mr-auto'` ·
  `layouts.fullwidth = ''` (grid.html [01]).
- LayoutGroup wrapper strings are tabled verbatim on layouts.html
  [03]; marketing (`default`) bands swap `mr-auto … pl-12 pr-8` for
  `mx-auto … px-6`.
- Fonts load from the Google Fonts CDN (JetBrains Mono, Cinzel); if
  the production theme wants local files, that's a `theme/fonts/`
  concern owned by the translation, not this folder.
- The landing hero needs a registered page-section component; it is
  not expressible as theme config (see ../README.md).
