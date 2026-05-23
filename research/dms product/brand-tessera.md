# Tessera — Brand Brief (v0.1)

> First-pass branding document for the product currently called DMS, in
> the event the name **Tessera** is chosen. Intended as input to a
> design agent producing a first-pass design system (tokens, components,
> patterns, marketing site mockups).
>
> Pair with `positioning-v2.md` for product context. This document
> covers only what's specific to the *Tessera* identity — what the name
> means, how it should look, how it should sound, and what artifacts a
> v0.1 design system should ship.

---

## 1. Brand essence

A **tessera** is a single tile in a mosaic — the smallest unit of a
larger, deliberately composed surface. Roman and Byzantine craftsmen
spent careers placing tesserae one at a time into floors and ceilings
that lasted millennia. Each tessera is small and ordinary; the
composition is what's beautiful and durable.

Tessera the product is the same idea applied to data-driven sites.
Every page, every section, every row, every chart is a tessera —
small, typed, ordinary on its own. The site is the mosaic that
emerges when many of them compose against a shared form.

The brand should feel **architectural, considered, durable, and quiet**.
It is not a tech-startup brand. It is closer to a small architecture
firm, a civic press, or a typeface foundry — institutions whose
authority comes from the care of their craft, not the volume of their
voice.

---

## 2. Positioning recap

(Full context in `positioning-v2.md`.)

- **What it is:** one row format that can be a page, a section, a
  dataset, a query, or a theme. The same representation drives content
  sites, dashboards, data apps, and maps.
- **Analogies:** Excel for the model (representation primacy); WordPress
  for the distribution (OSS + hosted).
- **Audiences:** hosted users (the long tail), self-host operators
  (technical solo / small team / civic IT), and institutional buyers
  (gov, large org).
- **Refusing:** "no-code platform," "internal tool builder," "open-source
  Notion," "infinitely flexible." These are not Tessera.

The Tessera-specific angle on the positioning: **lean into the craft
and the durability.** Mosaics outlive the people who placed them.
That's the right register for civic data platforms, state government
sites, archives, public-facing dashboards that need to be readable in
ten years.

---

## 3. Brand personality

| Trait | Tessera is… | Tessera is not… |
|---|---|---|
| Tone | Considered, precise, slightly archaic vocabulary | Punchy, breezy, ironic |
| Pace | Slow, deliberate | Fast, animated |
| Authority | Earned by craft | Asserted by scale |
| Texture | Material, mineral, tactile | Glossy, neon, glassy |
| Sense of humor | Dry, occasional, classical | Memetic, irreverent |
| Politics of design | Civic, public-good, durable | Disruptive, growth-hacky |

If Tessera were a magazine, it would be the *MIT Press journal*, not
*Wired*. If it were a building, the New York Public Library, not the
Apple Store. If it were a typeface foundry, Klim, Commercial Type, or
Grilli Type — not the cool-but-loud ones.

---

## 4. Visual direction

### 4.1 Mood

- **Material and mineral.** Limestone, slate, terracotta, parchment,
  oxidized copper. Surfaces that have weathered well.
- **Architectural.** Grid systems, modular ornament, considered margins,
  generous negative space.
- **Print-rooted.** The design system should reference book design and
  archival print typography more than current SaaS marketing sites.
- **Quiet at rest, satisfying in motion.** Tiles snap into place; rows
  align to a baseline. Nothing whooshes.

### 4.2 Reference points (mood-board cues)

- Cosmati pavements (medieval Italian inlaid stone floors).
- Bauhaus modularity — particularly Herbert Bayer's grid work.
- Edward Tufte's *Envisioning Information* — restraint, density,
  intentional small marks.
- The Whitney Museum's identity (Experimental Jetset, 2013) — the
  responsive W as a tessera-like mark.
- MIT Press book design under Muriel Cooper.
- A Working Library (Mandy Brown's site) — quiet, durable, generous.
- Klim Type Foundry's identity work.
- The Getty Research Institute's publications.

### 4.3 Color palette (starter tokens)

A restrained, mineral palette. Three roles: surface, ink, and accent.
Accents are used sparingly — like grout lines or a tile's single
fired color — never as decoration.

```
--color-bone           #F4F1EA   /* primary background */
--color-limestone      #E8E2D5   /* secondary surface, card backgrounds */
--color-parchment      #FBF9F4   /* lifted surface, modals */
--color-slate          #2A2F36   /* primary ink */
--color-graphite       #4A5160   /* secondary ink, captions */
--color-fog            #A7ADB6   /* tertiary ink, disabled */

--color-oxide          #B5532C   /* primary accent (terracotta) */
--color-tile           #7F1D1D   /* deep tile red, for emphasis */
--color-verdigris      #5D8A85   /* secondary accent (oxidized copper) */
--color-ochre          #B45309   /* warning / highlight */

--color-grout-light    #D9D2C2   /* hairline rule, divider */
--color-grout-dark     #1A1D22   /* contrast frame */
```

Avoid: pure white, pure black, saturated tech-blue, neon anything, any
gradient. The accents should appear at perhaps 10–15% of any given
surface, never more.

Dark mode is acceptable but not required for v0.1 — and if shipped,
should feel like *photographs of stone at night*, not "the same UI
inverted." Use slate and graphite as surface, bone-tinted ivory as ink,
keep the accent palette unchanged.

### 4.4 Typography

Type does most of the work. The system is **two families, four roles**.

| Role | Recommended | Fallbacks |
|---|---|---|
| Display (headlines, marketing) | **Tiempos Headline**, *GT Sectra*, *Recoleta* | A contemporary humanist serif with strong roman/italic contrast and slightly archaic letterforms (open apertures, calligraphic stress). |
| Body & UI | **IBM Plex Sans**, *Söhne*, *Inter* | Humanist sans with neutral but warm character. Avoid geometric sans (Avenir/Futura) — too clean for the brand. |
| Mono (code, data, tabular) | **IBM Plex Mono**, *JetBrains Mono* | Match the sans's x-height; the brand uses mono not just for code but for any tabular or technical surface. |
| Marginal / specimen (rare) | **GT Alpina**, *Tiempos Text Italic* | Long-form essay surfaces, the "Theory" page. |

Type pairings to use across the brand:

- **Serif display + sans body + mono UI.** This is the default
  pairing. Serif headlines on marketing pages, in long-form, and as
  section titles in the product chrome. Sans for all interactive UI.
- **Tabular numerals everywhere.** Numbers in tables, charts, KPIs,
  and inline data should use tabular-figure variants. This is a small
  thing that signals data-seriousness immediately.
- **Generous tracking on small caps** for labels and section
  designators ("DATASETS", "PATTERNS").

### 4.5 Logo concept brief

The mark should *be* a tessera — a small geometric form that reads as
a single placed tile. Three directions worth a real round of
exploration:

1. **Wordmark + accent tile.** "Tessera" set in the display serif,
   with a single rotated square (a "tessera") replacing or accenting
   one letter. Candidates: the R's bowl as a square void, or a tilted
   square serving as the A's crossbar.
2. **Composed monogram.** A small set of tesserae (3–5) arranged to
   suggest the letter T. The composition itself is the mark — readable
   at large sizes as a T, readable at small sizes as a textured
   square.
3. **Pure pattern + wordmark.** A Cosmati-derived geometric pattern (a
   single repeating unit) used as a contextual frame around a plain
   serif wordmark. The pattern is the brand mark; the wordmark is
   set neutrally.

All three should work in monochrome at 16px. The mark must hold up
when *favicon-small*; ornament is for the marketing site, not the
mark itself.

### 4.6 Iconography

- **Geometric, line-based, 1.5–2px stroke.** No filled shapes; the
  design system uses ink, not color, to convey weight.
- Slight slab/serif treatment on terminals to match the display type.
  Icons should feel drafted, not drawn.
- Pull from Phosphor (regular weight), Lucide, or a custom set built
  on a 24px grid with 2px stroke and 2px corner radius.
- Map / data icons should reference cartographic legend conventions —
  not generic "chart" pictograms.

### 4.7 Imagery & illustration

- **Photography:** Architectural detail, archival, monochrome or
  duotone in the bone/slate range. Stone, paper, weathered surfaces.
  No glossy product photography; no stock-photo people in offices.
- **Illustration:** Geometric, pattern-based, almost diagrammatic. If
  the brand ships illustrations, they should look like exploded
  architectural drawings or ISOTYPE pictograms, not friendly tech
  characters.
- **Data visualisation:** *This is the brand's primary illustration.*
  Charts, maps, tables, and section layouts in the product *are* the
  brand expression. They must be exemplary — Tufte-clean, generously
  spaced, restrained color, tabular numerals.

### 4.8 Motion

- **Snap, don't ease.** Tiles align to grid lines on a quick, satisfying
  beat (80–120ms). Avoid drawn-out 400ms eases.
- **Reveal by placement, not fade.** A new section appears as if a
  tile was set down — slight scale-from-0.98, opacity 0→1, baseline
  shift of 4px max.
- **No parallax. No looping background animation.** Motion is reserved
  for direct user actions and meaningful state transitions.

---

## 5. Voice and tone

### 5.1 Voice principles

- **Specific over evocative.** "A typed row in `data_items`" beats "a
  flexible content building block."
- **Slightly archaic vocabulary, contemporary cadence.** Words like
  *compose, set, place, arrange, durable, considered* are in
  vocabulary. *Leverage, unlock, empower* are not.
- **Earn metaphors.** When the brand uses the tile/mosaic metaphor,
  pay it off with a concrete property of the product. Don't sprinkle
  metaphors for flavor.
- **Confidence without volume.** No exclamation marks. No
  superlatives ("the best," "the only," "revolutionary"). The brand
  is right because it's right, not because it shouts.

### 5.2 Sample copy

**Homepage hero**

> Tessera
>
> The shape of your data is the shape of your site. One typed row
> that can be a page, a section, a dataset, a query, or a theme — and
> every part of the system composes against it.
>
> Open-source. Self-host or use the hosted service.
>
> [See it run wcdb.fm →]   [Host your own →]

**Section title (marketing site, "How it works")**

> One representation. Many renderings.
>
> A page is a row. A chart is a row. A map is a row. A join is two
> rows pointing at each other. There is nothing else to learn.

**Product chrome (an empty state)**

> No sections yet. Add one to begin composing this page.

**Error state**

> The view at id 2060672 could not be loaded. The row may have been
> deleted, or your token may have expired.

**Voice anti-patterns to avoid**

- ❌ "Unleash the power of your data with Tessera's revolutionary
  platform!"
- ❌ "Build beautiful sites in seconds, no code required."
- ❌ "Tessera empowers teams to ship faster than ever."
- ✅ "Place the data. Set the layout. Publish."

### 5.3 Terminology

The product's internal vocabulary becomes part of the brand:

- **Tessera** — the company, the platform, and (lowercase, in
  technical writing) the unit: "a tessera is a single typed row."
- **Compose, place, set, arrange** — the verbs of authoring.
- **Mosaic** — used sparingly, only when describing the whole site /
  the composed surface. Not overused as a synonym for "site."
- **Pattern** — keep the existing technical term (DMS patterns =
  site sections of a particular kind); aligns with the brand
  metaphor.
- **Grout** — possible internal name for the layout / theme tokens
  that separate tesserae (margins, dividers, spacing). Reserved for
  internal use, not customer-facing copy.

---

## 6. Design system v0.1 — artifacts to produce

What the design Claude should ship as the first pass.

### 6.1 Foundation

- [ ] Color tokens (see §4.3) with light + (optional) dark variants.
- [ ] Type scale: display (48 / 36 / 28), heading (24 / 20 / 18),
      body (16 / 14), small (12), with corresponding line-heights and
      tracking. Tabular figures variant for all numeric contexts.
- [ ] Space scale (4px base): 4, 8, 12, 16, 24, 32, 48, 64, 96, 128.
- [ ] Radius scale: 0 (default — tiles have square corners!), 2, 4,
      8. Use 0 by default; rounded corners only on interactive
      elements that need affordance.
- [ ] Elevation: flat by default. One subtle 1px-border + 2% slate
      shadow for "lifted" surfaces. No drop shadows beyond this.
- [ ] Grid: 12-column on desktop, 4-column on mobile, with 24px
      gutters and a max content width around 1280px.

### 6.2 Components

- [ ] Wordmark + logo lockups (horizontal, stacked, mark-only).
- [ ] Button (primary slate, secondary outline, tertiary text-only,
      danger oxide). Square corners, 1.5x line-height padding.
- [ ] Input (single-line, multi-line, select). 1px border, no inner
      shadow.
- [ ] Card / surface (the section container in the product). 1px
      grout-light border, parchment background, square corners.
- [ ] Table (the data-grid component). Tabular figures, alternating
      row tints in limestone / bone, hairline grout-light dividers.
- [ ] Tab / nav (top-nav, side-nav, breadcrumb).
- [ ] Modal / drawer.
- [ ] Tooltip / popover.
- [ ] Empty / loading / error states (all three need explicit
      treatments).
- [ ] Toast / inline alert.
- [ ] Chart components (bar, line, area, scatter, grid) with palette
      derived from the accent set — never more than 5 series colors,
      no rainbow palettes by default.
- [ ] Map style: a Tessera basemap built on a stripped-down OSM tile
      style, in the mineral palette. No labels by default; thoughtful
      labels at the right zoom.

### 6.3 Patterns

- [ ] Marketing site homepage (hero, two-doors block, surfaces table,
      proof-points carousel, "Theory" link, footer).
- [ ] Marketing site "Hosted vs. self-host" comparison page (the
      WordPress.org-vs-.com fork from `positioning-v2.md` §3).
- [ ] Marketing site "Theory" page — long-form, single column, GT
      Alpina or similar.
- [ ] Product "site overview" dashboard.
- [ ] Product "page editor" canvas chrome.
- [ ] Product "dataset" view (table + filter chrome).
- [ ] Documentation page template — narrow column, generous margins,
      typographic emphasis on code samples (use mono).
- [ ] Plugin / theme marketplace card.

### 6.4 Logo concept exploration

Three directions per §4.5, each rendered:

- [ ] Full color on bone surface.
- [ ] Monochrome slate on bone.
- [ ] Reversed bone on slate.
- [ ] Favicon (16, 32, 192).
- [ ] Wordmark-only horizontal lockup for the navbar.
- [ ] Pattern derivation (a single repeating Cosmati-style unit) for
      use as background ornament on the marketing site.

### 6.5 Templates the design system must support

- A radio station home page (wcdb.fm-shaped).
- A civic dashboard (MitigateNY-shaped).
- A heavy analytics page (NPMRDS-shaped).
- A documentation site (AVAIL-docs-shaped).

If a token or component doesn't survive all four templates, it's the
wrong token. The product's strength is that the same engine drives all
four; the design system must inherit that property.

---

## 7. Anti-patterns ("don't")

- ❌ Gradients of any kind.
- ❌ Glassmorphism, frosted blur, drop-shadowed cards floating in
  space.
- ❌ Tech-startup blue (#3B82F6 and its neighbours). The accents are
  mineral, not digital.
- ❌ Geometric sans-serifs (Avenir, Futura, Gilroy, Poppins). Too
  clean for the brand.
- ❌ Friendly tech illustrations (Memphis-style, abstract-blob
  characters, hand-drawn icons).
- ❌ Stock photos of teams collaborating around laptops.
- ❌ Animations that announce themselves (parallax, sticky reveals,
  scroll-triggered drama).
- ❌ "Powered by" footer badges and trust-seal collages.
- ❌ The metaphor as decoration. If you put a literal mosaic image
  on the homepage, you've misunderstood the brand. The mosaic is
  expressed by the structure of the design, not by depicting one.

---

## 8. A note for the design agent

The point of this brand is restraint. The natural temptation when
designing a "tile / mosaic" brand is to ornament — to make every
surface tiled, every divider Cosmati, every header a pattern. Don't.

The brand is **a few well-placed tesserae on a generous bone surface**.
The composition is what's beautiful. The ornament is what survives in
the corners and the headers, not what fills the page.

The reference is *Cosmati floor*, not *mosaic backsplash*. The floor
is mostly stone; the inlaid pattern is the punctuation. That ratio —
~85% surface, ~15% considered ornament — is the visual signature of
the brand.

---

## 9. Open brand questions

- **Is the mark a tessera or the wordmark?** Lean wordmark for v0.1
  (mark requires more time to earn); but the design exploration
  should produce both.
- **Italic display style for the marketing site?** Tiempos Headline
  Italic + slightly oversized — a *book*-magazine feeling — could be
  the long-form treatment. Worth testing.
- **Local-language version of the mark?** Tessera reads as English /
  Italian / Latin already; multilingual treatments are likely
  unnecessary. (Lingua is the brand that solves for that, if needed.)
- **Co-branding with the hosted product.** Tessera Cloud? Tessera
  Hosted? A different name (the WordPress.com to Tessera's
  WordPress.org)? The brand system should leave room without
  pre-committing.
