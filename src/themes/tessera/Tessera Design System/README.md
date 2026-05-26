# Tessera — Design System (v0.1)

> First-pass design system for **Tessera**, a data-driven sites platform.
> Built from the brand brief `Tessera — Brand Brief (v0.1)`. No codebase,
> Figma, or decks were attached at the time of this build — only the
> written brief. Everything here is a faithful translation of that brief
> into tokens, components, and patterns.

## What Tessera is

Tessera is the proposed name for a product previously called *DMS*. A
**tessera** is a single tile in a Roman or Byzantine mosaic — the
smallest unit of a deliberately composed surface. The product applies
this idea to data-driven sites: one typed row format that can be a
page, a section, a dataset, a query, or a theme. The same primitive
drives content sites, dashboards, data apps, and maps.

Two distribution modes:

- **Open-source, self-host** (the WordPress.org analogue).
- **Hosted** service (the WordPress.com analogue).

Target audiences span the long-tail hosted user, the technical solo /
small-team self-host operator, and the institutional buyer (gov,
civic IT, large org).

The brand register is **architectural, considered, durable, quiet** —
closer to an architecture firm, civic press, or typeface foundry
than a tech startup.

## Sources

Only one source was provided for this build:

- **`Tessera — Brand Brief (v0.1)`** — pasted into chat. Sections
  reference: §1 brand essence, §3 personality, §4 visual direction,
  §5 voice and tone, §6 artifacts to ship, §7 anti-patterns.

The brief itself references a companion document, **`positioning-v2.md`**,
which was *not* attached. If you have it, drop it into the project
and ping me to fold its product detail in.

No code repo, Figma file, or screenshots were attached. If you have
any of those — even sketches — they will materially improve this
system. Sample products mentioned in the brief and worth designing
against:

- **wcdb.fm** — a radio station home page (referenced as a template
  shape).
- **MitigateNY** — a civic dashboard shape.
- **NPMRDS** — a heavy analytics page shape.
- **AVAIL-docs** — a documentation site shape.

These have *not* been visually researched here; the patterns in this
system are designed to support that family of templates per the brief,
but live screenshots would refine them.

## Index

Root files:

- `README.md` — you are here.
- `colors_and_type.css` — design tokens (colors, type, spacing,
  radii, elevation, grid) plus semantic CSS variables and `.h1` /
  `.body` / `.mono` etc. utility classes.
- `SKILL.md` — agent-skill entrypoint for re-using this system in
  another project or in Claude Code.

Folders:

- `fonts/` — webfonts (IBM Plex Sans, IBM Plex Mono, Newsreader).
- `assets/` — logos, marks, favicons, pattern derivations.
- `preview/` — small HTML cards that populate the Design System tab.
- `ui_kits/marketing/` — marketing site UI kit (homepage, theory page,
  hosted-vs-self-host comparison).
- `ui_kits/product/` — product UI kit (site overview, page editor,
  dataset view).
- `ui_kits/docs/` — documentation site UI kit.

## Font substitutions — please review

The brief specifies **Tiempos Headline** (display) and notes **GT
Alpina** for marginal/specimen surfaces. Both are licensed faces from
Klim Type Foundry that we can't ship without a license. For v0.1 the
system uses the closest free substitutes on Google Fonts:

| Role | Brief calls for | This system ships | Why |
|---|---|---|---|
| Display serif | Tiempos Headline / GT Sectra / Recoleta | **Newsreader** | Open apertures, mild calligraphic stress, decent roman/italic contrast, free on Google Fonts. Quietly archaic — the right register. |
| Body & UI | IBM Plex Sans / Söhne / Inter | **IBM Plex Sans** | Free, exact match for first choice. |
| Mono | IBM Plex Mono / JetBrains Mono | **IBM Plex Mono** | Free, exact match for first choice. |
| Specimen / long-form | GT Alpina / Tiempos Text Italic | **Newsreader Italic** | Reuses the display family; one fewer dependency. |

**Action requested:** if Tiempos Headline or GT Sectra licenses exist
or are planned, drop the woff2 files in `fonts/` and update
`colors_and_type.css` — swap `--font-display` to point at the new
family. Everything downstream will pick it up.

---

The remainder of this README sits below as sections you can read in
order: **Content fundamentals**, **Visual foundations**, **Iconography**.

## Content fundamentals

Voice is the single highest-leverage axis of this brand. Get this
wrong and no amount of mineral palette saves it.

**Pronouns and address.** Address the reader as *you* sparingly and
only when giving direct instruction ("Place the data. Set the layout.
Publish."). Otherwise the brand speaks in the third person about the
work — "A page is a row. A chart is a row." — not about the reader's
feelings.

**Tone.** Considered, precise, slightly archaic vocabulary,
contemporary cadence. The words *compose, set, place, arrange,
durable, considered* are in vocabulary. *Leverage, unlock, empower,
revolutionary, seamless, beautiful, powerful* are not.

**Casing.** Sentence case throughout. Title Case is reserved for the
wordmark and for proper nouns. Section designators ("DATASETS",
"PATTERNS") are set in small caps with generous tracking — *not*
ALL-CAPS shouting, but proper small caps.

**Punctuation.** No exclamation marks. Em-dashes used freely for
parenthetical asides — they fit the print-rooted register. Oxford
commas. Curly quotes ("" '') everywhere, including in code samples
where quotes are decorative (real code uses straight quotes).

**Length.** Short sentences. Two short sentences beat one comma-spliced
long one. A homepage hero is two to three short paragraphs at most.

**Emoji.** None. Not in product chrome, not in marketing, not in
documentation. The brief is unambiguous: the brand "is not a
tech-startup brand." Emoji read as tech-startup brand.

**Metaphors.** Earn them. When the tile/mosaic metaphor appears, pay
it off with a concrete property of the product. Don't sprinkle.

**Specific over evocative.**

> ✅ "A typed row in `data_items`."
> ❌ "A flexible content building block."

**Sample copy from the brief — keep this register exactly:**

> ✅ "The shape of your data is the shape of your site."
> ✅ "One representation. Many renderings."
> ✅ "Place the data. Set the layout. Publish."
> ✅ "No sections yet. Add one to begin composing this page."
> ✅ "The view at id 2060672 could not be loaded. The row may have
>     been deleted, or your token may have expired."

**Anti-patterns to refuse on sight:**

> ❌ "Unleash the power of your data with Tessera's revolutionary platform!"
> ❌ "Build beautiful sites in seconds, no code required."
> ❌ "Tessera empowers teams to ship faster than ever."
> ❌ "Trusted by the world's leading…"

**Terminology** (these are part of the brand):

- *tessera* — lowercase in technical writing, the unit ("a tessera is
  a single typed row"). *Tessera* (uppercase) for the company,
  platform, or product.
- *compose, place, set, arrange* — the verbs of authoring.
- *mosaic* — sparingly, only for the whole composed surface. Never a
  synonym for "site."
- *pattern* — the technical term (a pattern is a kind of site
  section). Keep as-is; it aligns with the metaphor.
- *grout* — internal vocabulary for layout/theme tokens (margins,
  dividers, spacing). Do **not** expose to customers.

## Visual foundations

**The 85/15 rule.** ~85% surface (bone, limestone, parchment), ~15%
considered ornament (ink + accent). This ratio is the visual
signature. Cosmati floor, not mosaic backsplash. Mostly stone; the
inlaid pattern is the punctuation.

**Colors.** Mineral palette. Three roles:

- **Surface** — bone (`#F4F1EA`) is default; limestone for cards;
  parchment for lifted surfaces (modals, the highest sheet).
- **Ink** — slate, graphite, fog. Slate is body ink; graphite for
  captions; fog for disabled / tertiary.
- **Accent** — oxide (terracotta), tile (deep red), verdigris
  (oxidized copper), ochre (warning). Used at ≤15% of any surface.
  Never decoration; only emphasis.

No pure white. No pure black. No saturated tech-blue. No neon. No
gradients of any kind. Dark mode is allowed but optional and should
feel like *photographs of stone at night* — keep the accent palette
unchanged; invert surface and ink roles.

**Type.** Two families, four roles. Newsreader (display, substitute
for Tiempos Headline — flag this), IBM Plex Sans (UI and body), IBM
Plex Mono (data, code, tabular). Tabular figures *everywhere*
numbers appear — KPIs, tables, charts, inline counts. This is the
single biggest tell of "data-serious" type in a UI.

Scale (px, locked to 4px baseline): display 48 / 36 / 28, heading 24
/ 20 / 18, body 16 / 14, small 12. Line-heights tight at display
(1.05–1.1), comfortable at body (1.5), tabular at mono (1.4). Small
caps with +60–80‰ tracking for section designators.

**Spacing.** 4px base; the scale is 4 / 8 / 12 / 16 / 24 / 32 / 48 /
64 / 96 / 128. Use larger values than feel natural — the brand is
generous with negative space. If a layout feels tight, double the
margins before reaching for a smaller font size.

**Backgrounds.** No imagery as background. No full-bleed photography
behind text. No repeating patterns or textures behind UI. The
background is bone (or parchment in product chrome), full stop.
Cosmati-derived patterns are allowed *as ornament* in marketing
margins, end caps, and footers — never as a backdrop for content.

**Borders & dividers.** 1px, `--color-grout-light` (`#D9D2C2`) for
hairlines; `--color-slate` for emphasis frames. No double borders.
No dashed/dotted unless meaningfully indicating temporary or
placeholder state.

**Corner radii.** **0 by default.** Tiles have square corners. This
is non-negotiable for surfaces, cards, tables, sections, charts.
Rounded corners only on interactive elements that need affordance —
buttons get 2px, inputs get 2px, pills get the full pill (50%).
Modals: square.

**Elevation.** Flat by default. One "lifted" treatment: 1px
`--color-grout-light` border + a 2% slate shadow at most (`0 1px 2px
rgba(42, 47, 54, 0.04)`). No glass, no frosted blur, no large soft
shadows. No multi-layer shadow stacks.

**Transparency & blur.** Effectively none. The product chrome is
opaque; modals dim the page with a 40% slate scrim (no blur).
Tooltips are solid slate-on-parchment.

**Cards.** A card is a section container: 1px grout-light border,
parchment background, square corners, no shadow at rest. Inner
padding scales 16 / 24 / 32 with the card's size.

**Hover states.** Subtle. Ink elements darken by ~8%; surface
elements warm by ~4% (toward limestone). Links pick up a 1px
underline in the same color. No color hue shifts. No bouncing. No
scale.

**Press states.** A 1px inset, no scale change. For buttons, the
fill steps one notch darker; the position does not move.

**Focus states.** A 2px solid slate ring with 2px offset. Visible
and unapologetic. No glow.

**Motion.** Snap, don't ease. 80–120ms cubic-bezier(0.2, 0, 0.1, 1)
for tile placement; 160–200ms for larger transitions. No 400ms
crossfades. No parallax. No looping background animation. Reveals
are 4px baseline-shift + opacity 0→1, with a 0.98→1 scale at most.

**Imagery.** Architectural detail, archival, monochrome or duotone
in the bone/slate range. Weathered stone, paper, oxidized metal. No
stock photos of people. No glossy product shots. If imagery appears,
it is intentional and quiet.

**Data viz.** This *is* the brand's primary illustration. Tabular
figures. Hairline grout-light gridlines. At most five series colors,
drawn from the accent set (oxide, verdigris, slate, ochre, tile).
Never rainbow palettes. Axis labels in mono, small caps for
legends.

**Layout grid.** 12-column desktop, 4-column mobile, 24px gutters,
~1280px max content width. Marketing pages may go to a single
generous column for long-form ("Theory") set in display serif at
around 540–620px measure.

**Fixed UI elements.** Top nav is the only fixed surface. No sticky
sidebars, no floating action buttons, no in-page chat widgets.

## Iconography

The brief is precise here. See `assets/icons/` for the working set.

**Approach.** Geometric, line-based, **1.5–2px stroke**, no filled
shapes, slight slab/serif terminals where natural. Icons should
feel **drafted, not drawn** — a draughtsman's hand, not an
illustrator's. 24px grid. 2px corner radius. Optical alignment over
mathematical centring.

**Source set.** The brief permits Phosphor (regular weight), Lucide,
or a custom set. **This system ships with Lucide** as the working
icon library — close to Phosphor in feel, freely available on CDN,
1.5px stroke at the right size, and wide coverage. The substitution
is flagged so it can be swapped for Phosphor or a custom set
without churn.

Loaded from CDN:

```html
<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js"></script>
```

Or inline via `<i data-lucide="archive"></i>` + `lucide.createIcons()`.

**Map & data icons.** Use cartographic legend conventions (a hatched
square for "area," a single dot for "point," a directed line for
"flow") rather than generic chart pictograms. A small custom map
glyph set lives in `assets/icons/map/` — extend it as new map types
ship.

**Emoji.** None. Not in product, not in marketing, not in
documentation. The brand is unambiguous.

**Unicode marks.** Spare and considered. Em-dashes (—), thin spaces
( ), middle dots (·), arrows (→ ←) used in nav and inline. Avoid
decorative unicode (★, ✓ in green, ⚡).

**Logos.** See `assets/logos/`. Three directions explored per the
brief — wordmark + accent tile, composed monogram, and pattern +
wordmark. Each rendered in full color, monochrome slate-on-bone, and
reversed bone-on-slate. Favicons (16, 32, 192) under
`assets/logos/favicon/`.
