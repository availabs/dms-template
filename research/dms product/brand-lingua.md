# Lingua — Brand Brief (v0.2)

> Second-pass branding document for the product currently called DMS, in
> the event the name **Lingua** is chosen. Intended as input to a design
> agent producing the design system (tokens, components, patterns,
> marketing site mockups).
>
> Pair with `positioning-v2.md` for product context. This document
> covers only what's specific to the *Lingua* identity — what the name
> means, how it should look, how it should sound, and what artifacts a
> v0.2 design system should ship.
>
> **What changed from v0.1.** v0.1 framed Lingua as a literary
> magazine — warm cream paper, italic Fraunces, drop-caps, square
> corners, anti-tech-startup, generous editorial space. That direction
> made Lingua read as a *publication* rather than a *platform*, and
> the resulting design system landed too close visually to Tessera (which
> is also an editorial-serif paper-feeling brand). v0.2 reframes Lingua
> as a **modern technical product** taking cues from
> [hex.tech](https://hex.tech), [zed.dev](https://zed.dev), and
> [warpstream.com](https://www.warpstream.com): sans-led, blue-accented,
> rounded-corner, dark-code-surfaced, with architecture diagrams and
> live activity as canonical brand devices. The lingua-franca essence
> survives, but it's expressed through the *clarity of a well-designed
> developer tool*, not through the *texture of a literary journal*.
>
> Editorial moments still exist (the Theory essay page, the occasional
> pull quote) but they're *accents inside a sans-serif brand*, not the
> default voice.

---

## 1. Brand essence

A **lingua franca** is a shared language that lets unlike communities
communicate without anyone having to give up their own tongue. Italian
in Mediterranean ports. Latin in medieval Europe. English in
international aviation. Pandas in Python data science. SQL in the
analytics stack. The pattern is the same: a shared form that lets the
unlike compose.

Lingua the product is the same idea applied to data-driven sites. The
row format is the lingua franca that lets pages talk to charts, charts
talk to maps, maps talk to datasets, and plugins talk to themes — none
of them giving up what they are, all of them sharing one vocabulary.

The brand should feel **precise, modern, technically confident, and
welcoming to both authors and engineers**. It is closer to a modern
developer-tool company (Hex, Zed, Linear, Vercel, Warpstream) than to a
literary magazine. Authority comes from clarity of demonstration —
visible code, visible data, visible architecture — not from typographic
restraint.

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
  Notion," "infinitely flexible." These are not Lingua.

The Lingua-specific angle: **lean into the dual-author claim and prove
it visually.** Lingua is one of very few products where a non-technical
author and a technical operator look at the same surface and both see
themselves. Mockups should make that legible — a marketing page,
beside a code sample, beside a data-table panel, beside an
architecture diagram — *all in the same brand*. The visual proof of
"one vocabulary" is showing the unlike rendered in the same voice.

---

## 3. Brand personality

| Trait | Lingua is… | Lingua is not… |
|---|---|---|
| Tone | Precise, modern, confident | Corporate-bureaucratic, ironic, cute |
| Pace | Deliberate, present-tense, demonstrative | Urgent, hype-driven |
| Authority | Earned by showing | Asserted by adjective |
| Texture | Crisp, gridded, clean — light surfaces with deliberate dark moments | Cream paper, glassy, illustrated |
| Sense of humor | Wry, in the copy of empty states and error pages | Memetic, irreverent |
| Politics of design | Pluralist, open-source-minded, dev-friendly | Disruptive, growth-hacky, exclusionary |

If Lingua were a peer company, it would be **Hex** (technical product
that takes design seriously), **Zed** (developer tool with bold,
contemporary aesthetics), **Linear** (precise, opinionated, dark when
needed), **Vercel** (clean grid + strong type + dark code surfaces),
**Warpstream** (technical confidence + architecture diagrams), or
**Resend** (developer product with editorial calm). The thread is
*modern developer-product aesthetics applied to a dual-audience tool*.

It is **not** a literary magazine, a print publisher, a typography
specimen, or a content-art project. Those references belonged to a
different brand pass and have been retired.

---

## 4. Visual direction

### 4.1 Mood

- **Sans-serif led.** A single confident grotesque does 95% of the
  visual work. The brand voice is communicated through type weight,
  size, and rhythm — not through serif-vs-sans contrast.
- **Light surfaces, dark moments.** The default surface is a clean,
  cool off-white or pure white. **Code blocks, terminals, and certain
  hero moments** sit on a deep slate surface and provide the brand's
  dramatic contrast. The shift between light and dark surfaces is a
  *brand signature*.
- **Crisp grid.** Generous but deliberate. Densely-packed information
  blocks (code samples, KPI strips, data tables) sit inside spacious
  frames. The mix of density and air is the brand's compositional
  fingerprint.
- **Demonstrative.** Every marketing surface shows the product *doing
  something*: a code snippet, a live editor mock, an architecture
  diagram, a data table with real rows, a terminal command. Lingua
  proves its claims by showing.
- **One strong accent.** A single confident accent color (an electric
  ultramarine — "Lingua blue") carries the brand. A small set of
  supporting accents covers status (warn / success / highlight) but
  the brand reads as essentially blue.

### 4.2 Reference points (mood-board cues)

- [**Hex.tech**](https://hex.tech) — modern analytics product;
  generous white surfaces, navy ink, bright accent on CTAs, live
  product screenshots throughout. The benchmark for "technical-but-
  warm."
- [**Zed.dev**](https://zed.dev) — code editor; bold sans-serif
  display type, prominent live activity feed (GitHub commits), large
  hero claims, customer logos with credibility names (Dan Abramov,
  José Valim). The benchmark for "developer credibility through
  showing the work."
- [**Warpstream.com**](https://www.warpstream.com) — infrastructure
  product; large hero claims ("10x cheaper than Kafka"), side-by-side
  architecture diagrams, customer logos with brand colors preserved,
  terminal/CLI visuals. The benchmark for "technical comparison done
  cleanly."
- **Linear** — opinionated developer product; dark sections + light
  sections; precise spacing; the brand of *taste applied to a
  developer tool*.
- **Vercel** — sharp grotesque type; high-contrast hero; dark code
  blocks against light surfaces; minimal decorative debt.
- **Resend** — developer email product; calm grid; clean type; the
  "Stripe-but-quieter" feel.

What is **not** on the mood board (changes from v0.1):

- ~~The Drift, n+1, The Believer~~ — magazine references are
  retired.
- ~~Klim, Production Type, GT Alpina specimens~~ — type-foundry
  worship is retired.
- ~~Pentagram for The Public Theater (Paula Scher)~~ — masthead
  typographic posture is retired.
- ~~Granta, Fitzcarraldo, NYRB Classics~~ — literary-publisher
  references are retired.
- ~~Are.na's identity~~ — too quiet for the new direction.

### 4.3 Color palette (starter tokens)

A modern technical palette. Clean cool whites and grays as the floor;
one strong blue as the brand accent; deep slate for code surfaces; a
small set of supporting accents for status.

```
/* Surface — light mode default */
--color-surface          #FFFFFF   /* primary background (pure white) */
--color-surface-soft     #F7F7F8   /* subtle alternate surface */
--color-surface-sunken   #F1F1F3   /* sunken — cards on a background */
--color-border           #E4E4E7   /* default border / hairline */
--color-border-strong    #D4D4D8   /* heavier rule (table headers, etc.) */

/* Ink */
--color-ink              #18181B   /* primary ink — near-black, warm-cool neutral (zinc-900) */
--color-ink-soft         #3F3F46   /* secondary ink (zinc-700) */
--color-mute             #71717A   /* tertiary ink, captions (zinc-500) */
--color-mute-soft        #A1A1AA   /* placeholders, disabled (zinc-400) */

/* Brand accent — Lingua blue */
--color-accent           #3B5BFF   /* electric ultramarine — the brand */
--color-accent-hover     #2F4AE0   /* hover state */
--color-accent-soft      #EEF1FF   /* accent tint for backgrounds, highlights */
--color-accent-ink       #FFFFFF   /* text on accent surfaces */

/* Status accents — used sparingly */
--color-signal           #FF5630   /* vermillion — warnings, important, danger */
--color-margin           #FFC83D   /* citrus — highlights, "new", margin annotations */
--color-success          #14B881   /* emerald — complete, success, "on" states */

/* Code surface (dark, always — even in light mode) */
--color-code-bg          #0E0F12   /* deep slate code/terminal background */
--color-code-bg-soft     #1A1B1F   /* secondary code surface */
--color-code-fg          #E6E7EA   /* code text */
--color-code-mute        #6C7079   /* code comments */
--color-code-accent      #79B8FF   /* code accent (function names, keywords) */
--color-code-string      #B5F4A5   /* code strings */
--color-code-keyword     #FFA8B4   /* code keywords */

/* Dark mode (full theme — v0.3 deliverable) */
--color-surface-dark         #0A0A0B
--color-surface-soft-dark    #131316
--color-ink-dark             #F4F4F5
--color-accent-dark          #6B85FF
```

**Color rules:**

- **The accent is one color.** Lingua blue (`#3B5BFF`) is the brand. A
  page that emphasizes blue does not also emphasize signal or margin.
  The status accents (signal/margin/success) are functional, not
  decorative.
- **The dark code surface is the brand's primary contrast move.** Code
  blocks, terminals, and the occasional hero band sit on
  `--color-code-bg`. The light-to-dark shift between sections is the
  brand's compositional energy.
- **Subtle gradients are allowed** — but only as a slow shift between
  two neighboring brand colors (e.g. `--color-accent` to
  `--color-accent-hover`) or as a subtle radial behind a hero. Never
  rainbow, never frosted glass.
- **Customer logos render in their native colors** (per the Warpstream
  convention) — desaturating them flatters the brand at the cost of
  the partner.

**Avoid:**

- Warm cream paper, warm beige neutrals, anything that reads as
  "publication paper." (This was v0.1's primary palette; it's retired.)
- Pure black (`#000000`) — use `#0E0F12` for the deep slate / code
  surface, which has slight warmth and reads as ink, not void.
- Pastel "tech-startup blue" (`#3B82F6` light, `#60A5FA` Tailwind sky)
  — Lingua's accent is *electric ultramarine*, more saturated and
  more confident.
- Any gradient that crosses three or more hues.

**Dark mode treatment:** A full dark mode is a v0.3 deliverable. The
tokens above include `*-dark` reservations. Dark mode is *not*
"inverted paper" — it's the same crisp technical aesthetic with deep
slate surfaces and the accent shifting to a slightly more luminous
blue.

### 4.4 Typography

Type is **sans-serif by default**. One grotesque does almost
everything. A monospace family carries code, labels, and metadata. An
editorial serif is *available* for the one or two long-form moments
where the brand wants to demonstrate that it can host editorial
content (the Theory page, occasional pull quotes) — but it is not the
brand's voice.

| Role | Recommended | Fallback / substitute | Notes |
|---|---|---|---|
| **Display & body** (95% of all surfaces) | **Inter Tight** | *Geist Sans*, *General Sans*, *Söhne*, *ABC Diatype* | A confident contemporary grotesque with display weights. Inter Tight is free, on Google Fonts, and has a tightened tracking that reads as deliberate at hero scale. |
| **Monospace** (code, terminals, KPI numerics, mono labels) | **JetBrains Mono** | *Geist Mono*, *Berkeley Mono*, *Söhne Mono* | Should pair tonally with the primary sans. Used for code, terminal output, KPI values where tabular figures matter, eyebrow labels in small caps tracking. |
| **Editorial accent** (Theory page, rare pull quotes) | **Fraunces Italic** | *Reckless Italic*, *GT Alpina Italic* | Used sparingly and intentionally. The italic display moment appears at most once or twice per page, on at most two pages in the system. The brand is *not* italic-led. |

**Type scale (more contemporary, more confident at scale than v0.1):**

```
display: 96 / 72 / 56 / 40 / 32     (hero / xl / lg / md / sm)
heading: 24 / 20 / 18                (h2, h3, h4 inside content)
body:    16 / 14                     (prose, prose-sm)
small:   13 / 11                     (caption, meta)
mono:    14 / 12 / 11                (code, code-sm, meta)
```

Body sets at **16px** (back to the contemporary developer-product
standard, not the v0.1 17px publication setting). Line-heights:
1.5 for body, 1.1 for display, 1.55 for mono code blocks.

**Typographic moves the brand should make often:**

- **Tight tracking on display weights.** Inter Tight at 96px with
  -0.04em tracking is the brand's hero default. The compression
  signals deliberateness.
- **Mono labels for everything machine-readable.** Timestamps, IDs,
  row counts, status badges, breadcrumbs — all in JetBrains Mono with
  a slight uppercase + tracking treatment for the smallest sizes.
- **Code blocks as design elements.** A syntax-highlighted code
  sample on `--color-code-bg`, with a small window-chrome header
  (filename + copy button), is a recurring brand-signature element.
  At least one code block per marketing page.
- **Numeric confidence.** KPI values, hero claims with numbers
  ("10× cheaper", "60s to first page"), and data-table cells all use
  the mono family with tabular figures so digits line up perfectly.

**Typographic moves the brand should make rarely:**

- Italic display. Reserve for the Theory page, the occasional pull
  quote inside long-form prose. Not a default voice.
- Drop caps. Allowed once, on the Theory page opener. Not on
  documentation, not on marketing, not on product chrome.
- Multilingual treatments. The brand can do this once, in the logo
  lockup or once on a marketing about-page, as visual proof of the
  "shared language" claim. It is not a recurring decoration.

### 4.5 Logo concept brief

The mark is a **wordmark in the brand sans, with the diacritic-over-i
as the only ornament**. The diacritic is the signature; everything
else is plain wordmark.

Three directions worth real exploration:

1. **The diacritic mark.** "Lingua" set in Inter Tight at substantial
   weight, with a single typographic mark over the *i* — a macron
   (Līngua), a tilde (Lĩngua), or a dot (Linġua). The mark is
   `--color-accent` (Lingua blue); everything else is ink. The mark
   is small, precise, and removable for the wordmark-only treatment.
2. **The wordmark only.** Same letterforms, no diacritic. For
   contexts where the diacritic doesn't render (favicon at 16px,
   small inline references).
3. **The bracket lockup.** "[lingua]" with the brand wordmark inside
   square brackets, in mono. A developer-product nod: brackets evoke
   code, the mono family reinforces the technical voice. Used in
   developer-facing surfaces (docs, CLI, README badges).

All three should work in monochrome at 16px. The wordmark must hold
up at favicon-small; the diacritic and bracket variants are
contextual treatments that ride on top of a recognisable base.

**Drop from v0.1:** the "magazine masthead" framing, the bilingual
"Lingua / 言语 / لغة" lockup as a default treatment. The bilingual
version still exists for one marketing page but is no longer the
brand's primary identity.

### 4.6 Iconography

- **Geometric, line-based, 1.5px stroke, no fills by default.**
  Use **Lucide** or **Phosphor** (regular weight) as the working set,
  or build a custom set on a 24px grid.
- **Icons are functional, not decorative.** Every icon in the
  product is paired with a label or stands in for a known action; the
  brand doesn't use icons as illustrations.
- **Filled icons allowed for status indicators only** — a filled dot
  for "live" or "on-air", a filled check for "complete". The rest
  are line.
- **Code-related icons matter.** Terminal, brackets, git branch, file
  tree, code-block, copy, run, format — these should look at home in
  the icon set, because the brand uses them often.

### 4.7 Imagery & illustration

- **Product screenshots are the primary imagery.** Marketing pages
  show the product doing something — the editor canvas, the data
  view, the page output, a code sample — with realistic data, in
  full color. Lingua proves its claims by showing them rendered.
- **Architecture diagrams as visual content.** Boxy, rounded-corner
  diagrams (8px corner radius matching the brand) with connecting
  lines, color-coded by role (accent for "Lingua", muted gray for
  "your stack"). The Warpstream convention.
- **Customer logos rendered in their native colors.** Don't desaturate
  partner brands; the variety reinforces "pluralism."
- **Live activity feeds** (à la Zed) — a small list of recent
  commits/publishes/edits with mono timestamps. Useful on the
  homepage and the product overview.
- **Terminal / CLI visuals** — styled terminal panes with prompt + a
  command being typed + output. Use the dark code surface treatment.
- **No abstract tech illustration.** No isometric office scenes, no
  geometric blobs, no "people connecting nodes," no Memphis-style
  patterns.
- **No stock photography.** Editorial portraits allowed (Theory page
  byline, occasional author photo) but rare.
- **Data visualization is the brand's signature illustration.**
  Charts use the brand accent + at most two status accents per
  composition; never the full palette. Tabular figures, hairline
  rules, no gradients on bars.

### 4.8 Motion

- **Snappy, not stately.** 120–240ms eases, cubic-bezier(0.2, 0,
  0.1, 1). Lingua feels *responsive*, not *contemplative*.
- **Hover states matter.** Every interactive element has a visible
  hover (border color shift, background tint, accent appears).
- **Subtle reveal on scroll** — fade + 8px translate on hero
  elements when they enter viewport. Not parallax, not scroll-
  jacked.
- **No looping background animation.** Live activity feeds and
  terminal demos may animate (typing effect, new row appearing) but
  background decoration does not.

---

## 5. Voice and tone

### 5.1 Voice principles

- **Precise and concrete.** The brand uses specific words and
  specific numbers. "10× faster" not "blazingly fast". "60s to
  first page" not "set up in minutes". When the claim is real, the
  number is too.
- **Demonstrative.** Show the code, show the data, show the
  architecture. Lingua's voice often says "Here's what that looks
  like:" and then shows it.
- **Welcoming to both audiences.** Sentences should make sense to a
  marketing-site author and to an engineer reading the same page. A
  single line that lands for both is worth more than two parallel
  lines.
- **Wry, not arch.** Empty-state copy, error-state copy, footer
  copy — all chances for the brand to be quietly funny without
  being memetic.
- **Long sentences allowed when they're earning it.** The Theory
  page is allowed paragraphs; the homepage is allowed paragraphs;
  the empty state gets a sentence. Match the length to the surface.

### 5.2 Sample copy

**Homepage hero**

> Lingua
>
> One row format. Pages, data, charts, and maps speak it.
> Authored by the people who own the work, extended by the people
> who own the code.
>
> Open-source. Hosted available.
>
> [Start a site →]   [Read the case for it]

**Homepage section title ("How it works")**

> One vocabulary. Many speakers.
>
> A page is a row. A section is a row. A dataset is a row. The same
> typed shape drives every surface in the product — and because the
> shape is shared, the parts compose without translation.
>
> ```js
> // every row, everywhere, has the same shape:
> { app, type, data, attributes, parent, children }
> ```

**Marketing claim band (Warpstream-style)**

> **10× the editor.** **0× the lock-in.**
>
> Open-source core. Self-host on your own metal, or run it hosted in
> a click. Move between them with one `lingua export` command.

**Product chrome (an empty state)**

> No sections yet.
>
> Speak the first one →

**Error state**

> The view at id 2060672 didn't load.
>
> Status: 504 · 2.4s · v1.3.0
>
> The row may have been removed, or your session may have lapsed.
> Either way: refresh, then retry.
>
> [Refresh] [Open in console]

**Code-block caption**

> *Every row has the same shape; the shape is the only thing you
> need to learn.*

**Voice anti-patterns to avoid**

- ❌ "Unlock your data's potential with Lingua's modern platform!"
- ❌ "Build stunning sites in minutes."
- ❌ "Lingua: where data meets design."
- ❌ "Beautifully crafted." "Carefully designed." "Thoughtfully built."
- ✅ "One row format. Pages, data, charts, and maps speak it."
- ✅ "Open-source core. Hosted in a click. Move between them with one
  command."

### 5.3 Terminology

The product's internal vocabulary becomes part of the brand:

- **Lingua** — the company, the platform. Always capitalised in
  prose. Use the bracketed `[lingua]` mono form for code, CLI
  examples, and README badges.
- **Speak, write, set, say, render** — the verbs of authoring. The
  metaphor is communication, not construction.
- **Vocabulary, grammar, dialect, idiom** — used for technical
  concepts where the language metaphor lands naturally (e.g., "every
  plugin speaks the same grammar"). Use sparingly; the metaphor is
  most powerful when it earns its keep.
- **Voice** — used to describe a site's distinct character (its
  theme, its tone). "Each Lingua site has its own voice."
- **Lingua franca** — the brand's deep-cut explanation, used in the
  Theory page and the about page. Not the homepage.

---

## 6. Design system v0.2 — artifacts to produce

What the design Claude should ship.

### 6.1 Foundation

- [ ] Color tokens (see §4.3) with light mode as primary, dark mode
      tokens reserved for v0.3. Lingua blue (`#3B5BFF`) is the brand
      accent; status accents (signal/margin/success) are functional
      only.
- [ ] Type scale: display (96 / 72 / 56 / 40 / 32), heading (24 / 20
      / 18), body (16 / 14), small (13 / 11), mono (14 / 12 / 11).
      Body sets at 16px. Line-heights 1.1 display, 1.5 body, 1.55
      mono.
- [ ] Space scale (4px base): 4, 8, 12, 16, 20, 24, 32, 40, 56, 80,
      120, 160. More granular than v0.1; the product surfaces need
      finer spacing options.
- [ ] Radius scale: 4, 6, 8, 12, 999. **No square corners as default.**
      Cards 8px, buttons 6px, inputs 6px, pills full. Tiles can be
      8–12px.
- [ ] Elevation: a small set — `--shadow-sm` (1px hairline), 
      `--shadow-md` (4px soft, for raised cards), `--shadow-lg`
      (12px soft, for modals). Subtle shadows are now ALLOWED;
      v0.1's anti-shadow rule is retired.
- [ ] Grid: 12-column on desktop, 4-column on mobile, with 24px
      gutters and a max content width of 1280px. Reading column for
      long-form maxes out at ~720px.

### 6.2 Components

- [ ] Wordmark + logo lockups (horizontal with diacritic, wordmark-
      only, mono-bracket, favicon).
- [ ] Button (primary blue, secondary outline, tertiary text-link,
      danger signal, ghost). 6px corner radius. Generous padding.
      Hover, focus, active, disabled states for each.
- [ ] Input (single-line, multi-line, select). 6px radius, 1px
      border, subtle background on focus. Mono input for code/CLI
      contexts.
- [ ] Card / surface — 8px radius, 1px border, `--shadow-sm` by
      default, `--shadow-md` for raised/hover.
- [ ] Table — clean, dense, tabular figures, hairline rules between
      rows, no vertical rules, sortable headers with caret. Subtle
      hover row highlight.
- [ ] Tab / nav (top-nav, side-nav, breadcrumb). Top-nav is
      horizontal with accent-color underline on the active tab.
- [ ] Modal / drawer. 12px corner radius, `--shadow-lg` elevation.
- [ ] Tooltip / popover.
- [ ] Empty / loading / error states (each surface gets a treatment
      — loading uses skeleton bars, error uses a contained card with
      diagnostic mono small text).
- [ ] Toast / inline alert.
- [ ] Chart components (bar, line, area, scatter, grid). Default
      palette: Lingua blue + ink + (one status accent if needed).
      Three-series charts add a second accent. The full status set
      caps at four.
- [ ] Map style — light-mode basemap on `--color-surface-soft`,
      hairline coastline rules, labels in Inter Tight, markers in
      brand colors. Not photo-real.
- [ ] **Code block** — a brand-signature primitive. Dark surface
      (`--color-code-bg`), syntax-highlighted, optional window
      chrome (filename + copy button + language indicator). Mono
      family throughout. This is a *required* component.
- [ ] **Terminal pane** — dark surface, prompt + command + output,
      blinking cursor allowed. Used on marketing and docs surfaces.
- [ ] **Architecture diagram** — boxy rounded-corner diagrams
      (8px), brand-color-coded by role, with connecting lines.
      Required for the comparison page and the homepage.
- [ ] **Live activity feed** — a vertical list of recent events
      (commits, publishes, edits) with mono timestamps, optional
      avatars, optional accent dots. Used on homepage and product
      overview.
- [ ] **KPI strip** — a row of large numeric values in the mono
      family with tabular figures, each with a small label and an
      optional delta indicator.
- [ ] **Customer logo strip** — a horizontal row of partner logos in
      their native colors (don't desaturate). Used on marketing.

### 6.3 Patterns

- [ ] Marketing site **homepage** — hero (sans-serif claim + product
      mock + CTAs), code-block band ("the row format, in one
      glance"), three-pillar feature grid, architecture diagram
      band, live activity / customer logos, two-doors hosted/self-
      host fork, footer.
- [ ] Marketing site **hosted vs. self-host comparison page** — the
      pluralist "two ways to speak the same language" comparison.
      Side-by-side architecture diagrams (Warpstream-style) + a
      capability matrix + a pluralism band + an FAQ.
- [ ] Marketing site **Theory page** — long-form essay. *This is the
      one page where the editorial serif (Fraunces Italic) is
      allowed and welcomed.* Single column, drop-cap, pull quotes —
      Lingua's editorial moment, deliberately distinct from the rest
      of the brand.
- [ ] Marketing site **Read page** (deferred to v0.3) — editorial
      essays / case studies; the brand's slow-burn moat. Worth doing
      if there's editorial capacity.
- [ ] Product **site overview** dashboard — admin "all sites / this
      site overview" with KPI strip, patterns table, live activity.
- [ ] Product **page editor** canvas chrome — section list (left) +
      live preview (middle) + edit inspector (right). The densest
      surface; demonstrates the toolbar / drag-handle / section-
      type designator pattern.
- [ ] Product **dataset view** — filterable table + tabs (data /
      map / chart / schema) + downstream-pattern panel.
- [ ] Documentation page template — narrow column (720px max) +
      sidebar + on-this-page rail. Prominent code blocks. Optional
      drop-cap on chapter openers (the one remaining v0.1 holdover,
      because docs have chapter openers).
- [ ] Plugin / theme marketplace card (deferred to v0.3).

### 6.4 Logo concept exploration

Per §4.5, three directions:

- [ ] Full color on light surface (ink wordmark + Lingua-blue
      diacritic).
- [ ] Reversed on dark surface (light ink wordmark + Lingua-blue
      diacritic — high contrast).
- [ ] Favicon (16, 32, 192) — wordmark-only or diacritic-only.
- [ ] Wordmark-only horizontal lockup for the navbar.
- [ ] Bracket-mono lockup for developer-facing surfaces
      (`[lingua]`).
- [ ] Bilingual lockup — reserved for one marketing surface; no
      longer a default treatment.

### 6.5 Templates the design system must support

- A radio station home page (wcdb.fm-shaped) — Lingua's voice
  applied to an editorial-personality use case.
- A civic dashboard (MitigateNY-shaped) — Lingua applied to data-
  heavy government surfaces. Should feel like a serious technical
  product, not a county PowerPoint.
- A heavy analytics page (NPMRDS-shaped) — modern dashboard density;
  charts as primary content, captions matter, headlines matter.
- A documentation site (AVAIL-docs-shaped) — Lingua's home turf;
  the docs should feel like Vercel's docs, not WordPress's docs.

If a token or component doesn't survive all four templates, it's the
wrong token. The product's strength is that the same engine drives
all four; the design system must inherit that property.

---

## 7. Anti-patterns ("don't")

- ❌ **Warm cream paper, beige neutrals, parchment surfaces.** The
  v0.1 mistake. Lingua's surfaces are cool whites and grays.
- ❌ **Square corners as default.** v0.1 ruled out rounded; v0.2
  embraces them (6px on interactive, 8px on cards, 12px on modals).
- ❌ **Italic Fraunces as the brand voice.** Reserved for the Theory
  page only.
- ❌ **Drop caps as a default chapter convention.** Allowed once on
  Theory; not on docs, not on marketing, not on product chrome.
- ❌ **"Editorial magazine" framing in marketing copy.** The brand is
  a developer-adjacent product; marketing copy talks about the
  product, not about typography.
- ❌ **Gradients across three or more hues.** A single-hue gradient
  (accent → accent-hover) is fine. A rainbow is not.
- ❌ **Glassmorphism, frosted blur.** No.
- ❌ **Tech-startup pastel blue** (`#3B82F6`, `#60A5FA`). Lingua's
  accent is more saturated and more confident.
- ❌ **Friendly tech illustrations** (Memphis blobs, isometric
  offices, hand-drawn nodes).
- ❌ **Stock photos of teams collaborating.**
- ❌ **Looping background animation, parallax, scroll-jacked
  drama.** Activity feeds and terminal demos may animate; backgrounds
  don't.
- ❌ **All-caps display headlines** as default. Sentence-case is the
  rule; small-caps for labels and section designators is allowed.
- ❌ **The metaphor as decoration.** Don't litter pages with speech
  bubbles, quote marks, translation arrows. The "shared language"
  claim is expressed by the typography, the code-block evidence, and
  the dual-audience pages — not by literal language imagery.

---

## 8. A note for the design agent

The temptation in a "language" brand is to over-illustrate the
metaphor — speech bubbles, quotation marks, translation arrows,
multiple alphabets cluttering every page. Don't. The metaphor is
strongest when it appears once, perfectly placed — a single
typographic diacritic in the logo, one bilingual treatment on the
about page.

The reference is **a quietly confident developer-product site that
respects its audience's intelligence** — not *a wall of quotations
in twelve scripts*, and not *a literary magazine pretending to be a
software product*. The brand earns its claim to "shared language" by
being clear, well-engineered, and worth using — not by depicting
language constantly.

The ratio: ~80% of any given surface is light surface, ink type, and
well-engineered components. ~15% is dark code/terminal surface that
provides the brand's contrast move. ~5% is one well-placed accent
color or status indicator. That ratio is the visual signature of the
brand.

---

## 9. Open brand questions

- **Display face commitment.** Inter Tight is the strongest free
  candidate (Google Fonts, display weights, contemporary feel). When
  budget allows, Söhne or GT America are obvious upgrades; the swap
  is a one-line `@font-face` change.
- **The Theory page format.** The brand's one editorial moment. Worth
  a real design treatment in v0.2 mockups — long-form essay with
  display italic pull-quotes, the brand's exception that proves its
  rule.
- **Dark mode parity.** Deferred to v0.3, but tokens are reserved.
  Dark mode is *not* "inverted paper" — it's the same crisp
  technical aesthetic with deep slate surfaces, accent shifted to a
  more luminous blue, code blocks remaining on the same dark
  surface (so dark mode reads as "code surface everywhere").
- **Co-branding with the hosted product.** Lingua Cloud? Lingua
  Hosted? A separate name (the wordpress.com to Lingua's
  wordpress.org)? The brand system should leave room without pre-
  committing.
- **The "Read" section.** If Lingua ships its own magazine /
  occasional-essays surface, that's a brand commitment. Deferred to
  v0.3.
- **CLI as a brand surface.** `lingua` should be a real CLI; its
  output (colored, formatted, helpful) is a real brand surface and
  deserves design attention in v0.3. v0.2 ships terminal-pane
  *visuals* as part of the marketing surface but doesn't design the
  actual CLI output yet.
