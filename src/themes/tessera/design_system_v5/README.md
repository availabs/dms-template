# Tessera Design System v5 — "Deco Field Guide"

**Version:** 0.1 · **Date:** 2026-07-02

Tessera recast in the language of art-deco national-park travel posters and
expedition badges. Every card is a screen-printed poster on cream stock with a
2px ink keyline frame; feature icons are thick-outline badges; the theme
gallery is literally a wall of travel posters. Palette, layered-landscape art
direction, and type gestures are drawn **only** from
`dms-template/references/tessera/deco/` (the Landmark-Project-style park
posters and the STEB badge series). The mosaic reference folder is
intentionally out of scope for v5.

## Brand vocabulary

- **Palette** — ink `#20323A`, paper `#FBF4E2`, parchment `#F0E1BE`,
  gold `#C79A3B`, canyon `#D97E45`, ember `#BC5B44`, teal `#33706A`,
  pine `#27443E`, sage `#A9C4A2`. Documented with roles on
  `design-system/theme.html`.
- **Type** — Josefin Sans (display caps, geometric/high-waisted, deco),
  Jost (prose + meta, Futura descendant), Yellowtail (script accent, used at
  most twice per page — the "Landmark Project" script nod). 12 tokens,
  declared in the Type section of `theme.html`; every text spec on every page
  resolves to one of them (modifier axes: color, weight-at-callsite is NOT an
  axis — weight lives in the token).
- **Signature moves** — poster keyline frames (`.tsr-frame`), sunburst rays
  (`.tsr-rays`, hero poster + final CTA band only), diamond-tesserae dividers
  and tone bars (`.tsr-tesserae`), letterpress button press (`.tsr-press`),
  print-lift card hover (`.tsr-lift`).

## Deliverable state (v0.1)

```
design_system_v5/
├── README.md
├── _shared.css                  # font classes + tsr-* surface utilities
├── design-system/
│   └── theme.html               # ✅ color, type, icons, frames, spacing
└── pages/
    └── product-landing.html     # ✅ single-page product landing (the showpiece)
```

Pending for later passes: `layouts.html`, `grid.html`, `components.html`,
`patterns.html`, and the `theme/` translation. The landing page is the
aesthetic contract; the tokens page keeps its type/color honest.

## Structural notes

- **Grid:** 12 columns, `gap-0`, gutters as per-section `p-3`, cap
  `max-w-[1200px]`. Every section on the landing page snaps to this grid.
- **Layout `default` (marketing):** TopNav only, no SideNav. Bands use
  `mx-auto` (centered) — a deliberate deviation from the product-page
  `mr-auto` rule, which exists to hug a SideNav this layout doesn't have.
  A future `app` layout for Tessera product surfaces must use `mr-auto`.
- **Icons:** thick-outline badge style, 2px stroke, named registry documented
  on `theme.html#icons`. Names used so far: TesseraMark, Layers, Bolt,
  Palette, Shield, Archive, Compass, ArrowRight, Check, Menu, Sun, Mountain.
- **What this theme is for:** marketing/long-form pages, poster-art imagery,
  badge iconography. Not yet designed for: dense admin tables, maps
  (best-effort ink/parchment treatments to come in `components.html`).
