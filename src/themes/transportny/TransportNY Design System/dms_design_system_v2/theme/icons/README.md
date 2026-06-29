# icons/ — standalone SVG sources

This directory is the canonical home for the brand's icon set as
plain `.svg` files. As of v0.2 the icons are inline React components
in `../icons.js`; the standalone files are not yet generated.

To produce them, extract each `<path>` from `../icons.js` into its
own `<icon-name>.svg` with the following template:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <!-- … -->
</svg>
```

Filenames are kebab-case of the registry name:

| Registry name | File |
|---|---|
| `Pages` | `pages.svg` |
| `Sections` | `sections.svg` |
| `CaretDown` | `caret-down.svg` |
| `ChevronRight` | `chevron-right.svg` |
| `MapLayers` | `map-layers.svg` |
| … | … |

The standalone files matter when a consumer needs to use an icon
outside React (CMS metadata, email templates, server-side rendering
of PDFs, etc.). They're also the canonical asset to hand to a
designer who wants to tweak the line weight.

The runtime path (theme.js → icons.js → primitive) never reads from
`.svg` files; it always uses the inline React components.
