# Lingua — Brand Brief (v0.1)

> First-pass branding document for the product currently called DMS, in
> the event the name **Lingua** is chosen. Intended as input to a design
> agent producing a first-pass design system (tokens, components,
> patterns, marketing site mockups).
>
> Pair with `positioning-v2.md` for product context. This document
> covers only what's specific to the *Lingua* identity — what the name
> means, how it should look, how it should sound, and what artifacts a
> v0.1 design system should ship.

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

The brand should feel **articulate, editorial, contemporary, and
inviting**. It is closer to a contemporary art magazine, a translation
imprint, or a public-radio program than to a tech startup. Authority
comes from clarity of voice, not from feature lists or volume.

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

The Lingua-specific angle on the positioning: **lean into voice and
communication.** The product's strongest single line — *the same
product non-technical users author on, technical users extend* —
reads as a language argument. Lingua is the brand that makes the
dual-author claim the headline.

---

## 3. Brand personality

| Trait | Lingua is… | Lingua is not… |
|---|---|---|
| Tone | Articulate, contemporary, slightly literary | Corporate, marketing-y, ironic |
| Pace | Confident, present-tense, generous | Urgent, hype-driven |
| Authority | Earned by clarity | Asserted by jargon |
| Texture | Print-magazine, typographic | Glassy, illustrated, gradient-rich |
| Sense of humor | Wry, well-timed | Memetic, irreverent |
| Politics of design | Pluralist, inclusive, open-standards | Disruptive, growth-hacky |

If Lingua were a magazine, it would be *The Believer* or *The Drift* —
not *Wired*. If it were a publisher, New Directions, Fitzcarraldo,
NYRB Classics. If it were a typeface foundry, Klim, Production Type,
Dinamo. The thread is editorial sophistication, multilingual reach, and
care for the written word.

---

## 4. Visual direction

### 4.1 Mood

- **Typographically led.** The brand is literally about language; the
  design treats type as the primary visual element, not as a wrapper
  around imagery.
- **Editorial.** Layouts borrow from contemporary magazines: confident
  use of white space, strong type hierarchy, occasional asymmetry.
- **Multilingual / multi-voice.** The brand can express the same idea
  in multiple scripts, weights, or registers without losing identity —
  in fact that's part of the identity.
- **Contemporary, not nostalgic.** Lingua is not a "we honour the
  classics" brand. It uses contemporary typography, contemporary
  color, contemporary editorial moves.

### 4.2 Reference points (mood-board cues)

- *The Drift, n+1, The Believer* — contemporary literary magazine
  design.
- Klim Type Foundry's specimen pages — type doing all the work.
- Pentagram's identity for *The Public Theater* (Paula Scher).
- *Granta*'s book covers under Peter Dyer / Suzanne Dean.
- Studio Dumbar's wayfinding work.
- The *Are.na* identity — quiet, editorial, restrained color, type-
  forward.
- *Rest of World* (the publication) — multilingual, editorial,
  contemporary.
- The Serpentine Galleries' identity (Hyperkit / North).
- Production Type's website.

### 4.3 Color palette (starter tokens)

A confident editorial palette. Cream paper, sharp ink, one strong
accent that does most of the work. Restraint comes from how few
colors are present at once, not from how muted each one is.

```
--color-paper          #FBF7F0   /* primary background (warm cream) */
--color-paper-alt      #F2EDE2   /* secondary surface */
--color-paper-lift     #FEFCF7   /* lifted surface, modals */
--color-ink            #0F0F0F   /* primary ink (near-black, warm) */
--color-graphite       #3D3D3D   /* secondary ink */
--color-mute           #8A857C   /* tertiary ink, captions */

--color-signal         #E63946   /* primary accent (vermillion / editorial red) */
--color-voice          #1E3A8A   /* secondary accent (deep navy / ink-blue) */
--color-margin         #E9B44C   /* highlight / annotation (warm mustard) */
--color-rule           #D6CFC2   /* hairline rule, divider */

--color-ink-reverse    #FBF7F0   /* ink on reverse (= paper) */
--color-paper-reverse  #0F0F0F   /* paper on reverse (= ink) */
```

Color usage rules:

- **Paper + ink only by default.** Most surfaces are cream and near-
  black. Color is the exception, not the rule.
- **Pick one accent per surface.** A page that uses Signal (red) does
  not also use Voice (blue). The accent is the page's *voice* — one
  per article.
- **No gradients.** Color is flat. The contrast between paper and ink
  is the brand's primary visual energy.

Avoid: pure white (too clinical for a paper-ink brand), pure black
(too hard against warm cream), tech-startup blue (`#3B82F6`), any
pastel.

Dark mode treatment: invert paper → ink, but keep the cream-toned
ivory as the "ink" color, not pure white. The brand should feel like
*paper at night*, not like a dark-mode dashboard.

### 4.4 Typography

Type is the brand. The system is **one display family doing the
heavy lifting + one sans for UI + one mono for code**.

| Role | Recommended | Fallbacks |
|---|---|---|
| Display & long-form (headlines, body, marketing) | **GT Alpina**, *Reckless*, *ABC Maxi*, *Migra* | A contemporary editorial serif with multiple weights, true italic with distinctive character, and a roman that reads well at both 12px and 96px. The display face is the brand. |
| UI sans (product chrome, dense interaction surfaces) | **ABC Diatype**, *Söhne*, *GT America Mono* | A confident contemporary grotesque. Use one weight (usually Regular) for almost everything; Medium for emphasis. |
| Mono (code, data, tabular) | **Söhne Mono**, *ABC Diatype Mono*, *JetBrains Mono* | Should pair tonally with the sans. Used not only for code but for any tabular numeric surface. |

Typographic moves the brand should make often:

- **Italic display in long-form.** GT Alpina Italic at 24–32px set in
  long blocks is the brand's strongest single move. Use it for the
  Theory page, the about page, and any moment where the brand is
  speaking in its own voice.
- **Weight + size contrast, not color.** Hierarchy is built from
  large/small and bold/regular contrasts, not from accent color.
- **Pull quotes set as display.** Magazine-style pull quotes in
  display italic, two columns wide, are a brand signature.
- **Multilingual treatments.** The brand can render the same idea in
  multiple scripts (Latin / CJK / Arabic / Cyrillic) — this is
  visual proof of the "shared language" claim. Reserve for marketing
  set-pieces; don't burden the product chrome with it.

### 4.5 Logo concept brief

The mark should *be* a piece of typography — a wordmark that reads as
a magazine masthead. Three directions worth real exploration:

1. **The masthead.** "Lingua" set in the display serif at substantial
   weight, with no ornament beyond the type itself. Think
   *Harper's*, *Granta*, *The Drift* mastheads. Highly readable at
   navbar size; iconic when blown up on a hero.
2. **The diacritic.** "Lingua" with a single typographic diacritic
   over the *i* — a macron (Līngua), a grave (Lìngua), a tilde
   (Lĩngua), or an open quote ('Lingua) — signalling language,
   pronunciation, and the act of speaking. The diacritic is the
   visual signature; remove it and the mark loses meaning.
3. **The bilingual lockup.** "Lingua / 言语 / لغة" or similar — the
   wordmark paired with one or two translations rendered in the
   appropriate scripts. The mark IS the multilingual claim.
   Strongest as a marketing-site treatment; the navbar uses the
   Latin word alone.

All three should work in monochrome at 16px. The wordmark must hold
up at favicon-small; the diacritic and bilingual versions are
contextual treatments that ride on top of a recognisable base.

### 4.6 Iconography

- **Linear, letterform-influenced.** Icons should feel drawn by
  someone who designs type — terminals matter, stroke endings
  matter. Pull from Phosphor (light/regular) or build a custom set
  on a 24px grid with 1.5px stroke.
- **Dictionary-mark sensibility.** Icons reference editorial /
  reference-book conventions where possible: a section mark (§) for
  sections, a pilcrow (¶) for paragraphs, an asterism (⁂) for
  separators. The brand can use these typographic marks directly as
  iconography in some surfaces.
- **No filled shapes by default.** Lingua uses line, contrast, and
  type — not weight of fill — to convey meaning.

### 4.7 Imagery & illustration

- **Photography:** Contemporary editorial portraiture, environmental
  shots of practitioners (the analyst at her desk, the engineer at a
  laptop, the civic data person at a public meeting). Warm-toned,
  natural light. No stock-photo gloss. Black-and-white or duotone
  paper-and-ink also works for any non-portrait imagery.
- **Illustration:** Used sparingly. When it appears, it should be
  *typographic* — large characters from the display face, ligatures
  blown up to artwork scale, diacritics as compositions. Not
  characters / blobs / abstract tech-shapes.
- **Data visualisation:** The brand's *primary* illustration. Charts,
  maps, and tables are the brand expression in-product; they must be
  exemplary. Charts use one or two of the accent colors per
  composition, never the whole accent set at once. Tables use
  tabular figures and hairline rules.

### 4.8 Motion

- **Reading-paced.** Animations move at the pace of someone turning a
  page — 200–280ms eases, not 80ms snaps. Lingua is read, not
  flicked through.
- **Type-first transitions.** When something appears, it's because
  type has settled. Headlines fade in 200ms after their letterforms
  resolve; body copy follows.
- **Page turns, not slides.** Transitions between major surfaces use
  a subtle horizontal shift + crossfade reminiscent of turning a
  page, not the SaaS-default left-slide.
- **No looping background animation.** A magazine doesn't twitch.

---

## 5. Voice and tone

### 5.1 Voice principles

- **Articulate, not arch.** The brand uses real words used precisely.
  It does not perform intelligence; it just speaks clearly.
- **Generous and pluralist.** Lingua's whole point is that unlike
  parties can communicate without becoming each other. The voice is
  welcoming to multiple kinds of user without flattening them.
- **Long sentences are allowed.** Most SaaS brands chop everything
  into tweet-sized fragments. Lingua's voice can sustain a
  paragraph — confidently, with rhythm.
- **Quote others.** The brand is comfortable citing other writers,
  designers, engineers. This is part of the editorial register.

### 5.2 Sample copy

**Homepage hero**

> Lingua
>
> A shared language for the parts of your site that used to need
> translators. Pages, data, charts, and maps — one vocabulary.
> Authored by the people who own the work, extended by the people who
> own the code.
>
> Open-source. Hosted available.
>
> [Read the case for it →]   [Start a site →]

**Section title (marketing site, "How it works")**

> One vocabulary. Many speakers.
>
> A page is a sentence. A section is a phrase. A dataset is a
> dictionary. They all share the same grammar — the row — and that
> shared grammar is the only thing that needs to be learned. Once.

**Product chrome (an empty state)**

> No sections yet. Write the first one.

**Error state**

> The view at id 2060672 didn't load. The row may have been removed,
> or your session may have lapsed. Either way: refresh, and try again.

**Voice anti-patterns to avoid**

- ❌ "Unlock your data's potential with Lingua's modern platform!"
- ❌ "Build stunning sites in minutes."
- ❌ "Lingua: where data meets design."
- ✅ "Pages, data, charts, and maps — same vocabulary, different
  voices."

### 5.3 Terminology

The product's internal vocabulary becomes part of the brand:

- **Lingua** — the company, the platform. Always capitalised; the
  word "lingua" lowercase is also fine when used as a noun in a
  technical sentence ("the lingua is the shared row format").
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

## 6. Design system v0.1 — artifacts to produce

What the design Claude should ship as the first pass.

### 6.1 Foundation

- [ ] Color tokens (see §4.3) with light + dark variants. Dark mode
      is paper-at-night, not inverted SaaS UI.
- [ ] Type scale: display (72 / 48 / 36 / 28), heading (24 / 20 /
      18), body (17 / 15), small (13), with line-heights tuned for
      long-form reading (1.5 for body, 1.15 for display). Body sets
      at 17px, not 16 — the brand reads as a publication.
- [ ] Space scale (4px base): 4, 8, 12, 16, 24, 32, 48, 64, 96, 128,
      192. The brand uses generous space — margins matter.
- [ ] Radius scale: 0, 2, 4. Use 0 by default; rounded corners only
      on interactive elements.
- [ ] Elevation: flat by default. One subtle 1px-rule + 4% ink
      shadow for "lifted" surfaces. The lift is barely visible —
      paper layered on paper.
- [ ] Grid: 12-column on desktop, 4-column on mobile, with 32px
      gutters (generous) and a max content width around 1180px. The
      reading column for long-form maxes out at ~680px.

### 6.2 Components

- [ ] Wordmark + logo lockups (horizontal, stacked, mark-only,
      bilingual).
- [ ] Button (primary ink, secondary outline, tertiary text-link,
      danger signal). Square corners, generous padding.
- [ ] Input (single-line, multi-line, select). 1.5px bottom-rule
      only, no full border — a written-on-paper feel.
- [ ] Card / surface (the section container in the product). 1px
      rule frame, paper-lift background, square corners.
- [ ] Table (the data-grid component). Tabular figures, hairline
      rules only between rows (no vertical rules), comfortable row
      heights.
- [ ] Tab / nav (top-nav, side-nav, breadcrumb). Type-led; tabs are
      typeset, not boxed.
- [ ] Modal / drawer.
- [ ] Tooltip / popover.
- [ ] Empty / loading / error states (all three need explicit
      treatments — each one a chance for the voice to speak).
- [ ] Toast / inline alert.
- [ ] Chart components (bar, line, area, scatter, grid). Default
      palette uses Signal and Voice (red and blue) alone for two-
      series charts; Margin (mustard) joins for three; the full
      accent set caps at five.
- [ ] Map style: a Lingua basemap built on a stripped-down OSM tile
      style in the paper-and-ink palette. Type-forward — labels are
      part of the brand; the map is a typeset thing, not a rendered
      thing.
- [ ] Pull-quote / blockquote component for marketing and long-form.
      Display italic, two-column-wide, with a typographic
      ornament (a single asterism or section mark) above.

### 6.3 Patterns

- [ ] Marketing site homepage (hero, two-doors block, surfaces
      table, proof-points carousel, "Theory" link, footer).
- [ ] Marketing site "Hosted vs. self-host" comparison page (the
      WordPress.org-vs-.com fork from `positioning-v2.md` §3).
      Lingua's version should set this up as a pluralist "two ways
      to speak the same language" comparison, not a feature matrix.
- [ ] Marketing site "Theory" page — long-form, single column,
      display italic for the long sentences. This is the page where
      the brand's voice has the most room.
- [ ] Marketing site "Read" page — an editorial section. Lingua's
      brand can sustain occasional essays, interviews with users,
      case studies in feature-magazine format.
- [ ] Product "site overview" dashboard.
- [ ] Product "page editor" canvas chrome.
- [ ] Product "dataset" view (table + filter chrome).
- [ ] Documentation page template — narrow column, generous margins,
      typographic emphasis on code samples (use mono), drop-caps
      optional for chapter openers.
- [ ] Plugin / theme marketplace card.

### 6.4 Logo concept exploration

Three directions per §4.5, each rendered:

- [ ] Full color on paper surface.
- [ ] Monochrome ink on paper.
- [ ] Reversed paper on ink.
- [ ] Favicon (16, 32, 192).
- [ ] Wordmark-only horizontal lockup for the navbar.
- [ ] Multilingual lockup variants (Latin + at least one CJK + one
      RTL script — Arabic or Hebrew).

### 6.5 Templates the design system must support

- A radio station home page (wcdb.fm-shaped) — Lingua-voiced, the
  station's *editorial* personality should come through.
- A civic dashboard (MitigateNY-shaped) — Lingua makes "boring
  government dashboards" feel like a serious publication.
- A heavy analytics page (NPMRDS-shaped) — magazine-of-data
  feeling: charts as illustrations, captions matter, headlines
  matter.
- A documentation site (AVAIL-docs-shaped) — this is the Lingua
  brand's home turf; the docs should feel like a small publisher's
  catalogue.

If a token or component doesn't survive all four templates, it's the
wrong token. The product's strength is that the same engine drives
all four; the design system must inherit that property.

---

## 7. Anti-patterns ("don't")

- ❌ Gradients of any kind. The brand's energy is paper/ink
  contrast, not gradient drama.
- ❌ Glassmorphism, frosted blur, drop-shadowed cards.
- ❌ Tech-startup blue (`#3B82F6` and its neighbours). The accents
  are editorial, not digital.
- ❌ Geometric sans display (Avenir, Futura, Gilroy, Poppins). The
  display face must be a serif with character.
- ❌ Friendly tech illustrations (Memphis-style, blob characters,
  hand-drawn isometric office scenes).
- ❌ Stock photos of teams collaborating.
- ❌ Looping background animation, parallax, scroll-triggered
  drama.
- ❌ All-caps display headlines as the default. Sentence-case
  headlines are the rule; small-caps for labels and section
  designators is allowed.
- ❌ The metaphor as decoration. If you put speech bubbles all over
  the homepage, you've misunderstood the brand. The "shared
  language" claim is expressed by the typography and the editorial
  layout, not by literal language imagery.

---

## 8. A note for the design agent

The temptation in a "language" brand is to over-illustrate the
metaphor — speech bubbles, quotation marks, translation arrows,
multiple alphabets cluttering every page. Don't. The metaphor is
strongest when it appears once, perfectly placed — a single
typographic diacritic in the logo, one multilingual treatment on the
about page, one editorial pull-quote per long-form essay.

The reference is *a quietly confident magazine masthead and three
issues of beautifully typeset feature writing* — not *a wall of
quotations in twelve scripts*. The brand earns its claim to "shared
language" by being clear, well-set, and worth reading — not by
depicting language constantly.

The ratio: ~95% of any given surface is paper, ink, and well-set
type. The remaining ~5% is one well-placed accent color, one
typographic ornament, or one well-placed photograph. That ratio is
the visual signature of the brand.

---

## 9. Open brand questions

- **Display face commitment.** GT Alpina is the strongest single
  candidate but is paid. Reckless (free for non-commercial) or a
  selected Google Fonts serif could substitute for the OSS-distribution
  marketing — the typography license matters when the product is OSS
  and authors may install their own.
- **The Theory page format.** Long-form essay with display italic
  pull-quotes is the brand's strongest single set-piece. Worth a real
  design treatment in the v0.1 mockups even though it isn't a
  product surface.
- **Multilingual product chrome.** The brand makes a multilingual
  claim. Does the product ship i18n from v0.1, or is the multilingual
  treatment reserved for marketing? Likely the latter for v0.1, but
  the brand should leave room.
- **Co-branding with the hosted product.** Lingua Cloud? Lingua
  Hosted? A separate name (the wordpress.com to Lingua's
  wordpress.org)? The brand system should leave room without pre-
  committing.
- **The "Read" section.** If Lingua ships its own magazine /
  occasional-essays surface, that's a brand commitment. Worth doing
  if there's editorial capacity — it's the strongest moat against
  competitors who are just SaaS products.
