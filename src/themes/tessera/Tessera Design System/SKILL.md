---
name: tessera-design
description: Use this skill to generate well-branded interfaces and assets for Tessera, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

# Tessera design

Tessera is a data-driven sites platform. The brand is architectural,
considered, durable, and quiet — closer to an architecture firm,
civic press, or typeface foundry than a tech startup.

Read `README.md` first; it contains the company context, content
fundamentals, visual foundations, and iconography. The key rules:

1. **The 85/15 ratio.** Most of any composition is surface (bone,
   limestone, parchment). About 15% is considered ornament (ink and
   accent). The brand reference is a Cosmati floor — mostly stone;
   the inlaid pattern is the punctuation. If a design wants to be
   ornate, you've misunderstood.

2. **Square corners by default.** Tiles do not round. Buttons get 2px;
   inputs get 2px; pills get the full radius. Cards and surfaces are
   square. Modals are square.

3. **Two type families, four roles.** Display: Newsreader
   (substitute for Tiempos Headline — flag this to the user).
   UI/body: IBM Plex Sans. Mono: IBM Plex Mono. Specimen: Newsreader
   Italic. **Tabular figures everywhere numbers appear** (KPIs,
   tables, charts, inline counts).

4. **Mineral palette.** Bone, limestone, parchment, slate, graphite,
   fog. Accents — oxide, tile, verdigris, ochre — are emphasis only,
   never decoration. Never more than 15% of any surface.

5. **No gradients. No glassmorphism. No drop-shadows beyond `0 1px 2px
   rgba(slate, 0.04)`.** No tech-blue. No emoji. No friendly
   tech-illustrations. No people-photography.

6. **Voice.** Considered, precise, slightly archaic. "Compose, place,
   set, arrange" are in vocabulary. "Leverage, unlock, empower" are
   not. No exclamation marks. Specific over evocative. Sentence
   case. See `README.md` § Content fundamentals for sample copy.

## File layout

- `README.md` — context, content fundamentals, visual foundations,
  iconography. Start here.
- `colors_and_type.css` — full token set (colors, type, spacing,
  radii, elevation), `@font-face` declarations, and ready-made
  semantic classes (`.h1`–`.h6`, `.body`, `.mono`, `.btn`,
  `.input`, `.card`, `.tessera` table).
- `fonts/` — Newsreader (display, variable), IBM Plex Sans, IBM Plex
  Mono webfonts. Include via `colors_and_type.css`.
- `assets/logos/` — three logo directions (wordmark, monogram,
  mark) in color, mono, and reversed; favicon.
- `assets/patterns/` — Cosmati ornament. Use sparingly in end caps
  and footers, *never* as content backdrop.
- `ui_kits/marketing/` — homepage, theory page, hosted-vs-self-host
  comparison. JSX components for hero, header, two-doors, surfaces
  grid, proof points, theory link, footer.
- `ui_kits/product/` — site overview, page editor, dataset view.
  JSX components for the product chrome, site sidebar, KPI strip,
  patterns list, toolbar, modal.
- `ui_kits/docs/` — reference page template with sidebar TOC and
  right-rail "On this page."
- `preview/` — small HTML preview cards used by the Design System
  tab. Not for direct reuse.

## When working with this skill

- If the user asks for an **artifact** (slides, mocks, throwaway
  prototype), copy `colors_and_type.css`, the fonts you need, and
  any relevant logos / patterns into the new file's vicinity, and
  build a static HTML file. Reuse the JSX components in
  `ui_kits/` as references — match their styling exactly.

- If the user asks for **production code**, lift the tokens, classes,
  and components verbatim. The CSS variables in `colors_and_type.css`
  are the source of truth.

- If the user invokes this skill **with no other guidance**, ask what
  they want to build, ask a few focused questions about surface
  (marketing / product / docs / something else), audience, and any
  product copy you need. Then build, in this brand's voice.

- **Iconography.** Lucide is wired up via CDN as the default icon
  set (`<i data-lucide="…"></i>` + `lucide.createIcons()`). Stroke
  weight 1.5, 24px grid. Substitute for Phosphor per brief; flag
  this if a custom set is requested.

- **Fonts.** Newsreader is the *substitute* for Tiempos Headline.
  If the user provides a real Tiempos / GT Sectra license, drop
  the woff2 in `fonts/` and update the `--font-display` stack in
  `colors_and_type.css`.

## Things the brand refuses

- Gradients of any kind
- Glassmorphism, frosted blur, drop-shadowed cards floating in space
- Tech-startup blue (#3B82F6 and neighbours)
- Geometric sans-serifs (Avenir, Futura, Gilroy, Poppins)
- Friendly tech illustrations (blobs, hand-drawn icons, Memphis)
- Stock photos of people in offices
- Parallax, sticky reveals, scroll-triggered animation
- "Powered by" badges and trust-seal collages
- The mosaic metaphor as decoration — never a literal mosaic image
- Emoji
- Exclamation marks

## Voice check

Before you ship a string of marketing copy, ask:

- Is this **specific** (a row, a tessera, a query) or **evocative**
  (a flexible building block, a powerful platform)?
- Does it use **archaic, considered vocabulary** (compose, place,
  set, arrange, durable) or **growth-deck vocabulary** (leverage,
  unlock, empower)?
- Could you read this in ten years and still be proud of it?

If any answer is wrong, rewrite.
