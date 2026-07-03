# v6 theme artifacts — translation notes

Inputs for `src/dms/skills/translating-design-system-to-dms-theme.md`.
Nothing in this folder runs yet; the live tessera theme still serves v2.

- **`icons.js`** — the icon registry, SOURCE OF TRUTH (~55 glyphs, 24px
  grid, 1.5px stroke, round caps). Design pages reference these names via
  `<!-- icon: Name -->`. Audit with
  `node scratchpad/scripts/icons-audit.mjs --brand tessera-v6`.
  Do **not** run `icons-sync.mjs` for v6 until the v6 `theme.js` lands.
- **`tailwind.additions.js`** — the `theme.extend` block. All colors are
  `var(--t-*)` custom properties, which is what makes light/dark one set
  of class strings. Slash-opacity utilities don't work on var() colors —
  the `*Soft` tokens exist for translucent fills.
- **`index.css.additions`** — pointer shim to `../_shared.css` (the
  canonical stylesheet: palette + dark override, grain + rationed graph textures,
  15 `.t-*` type tokens, `.t6-*` utilities). Inline it at translation
  time.

## Dark mode contract

`[data-theme="dark"]` on `<html>` swaps every custom property; markup
never changes. The mockups persist the choice in
`localStorage["t6-theme"]` via a tiny head script (see any page) and a
TopNav sun/moon toggle. A live DMS translation should map this to the
theme's dark-mode mechanism rather than copying the script verbatim.

## textSettings mapping

The 15 `.t-*` classes map 1:1 onto `textSettings.styles[0]` keys:
displayHero/XL/LG/MD/SM · proseLG/prose/proseSM/proseXS ·
metaLG/MD/SM/XS · noteLG/noteMD. `note*` (Caveat) is the handwritten
margin voice — authors may use it in Cards, but never for UI chrome.
