# WCDB · DMS Design System

**v0.3 · 2026-08-10** · A DMS-format implementation of the WCDB 90.9 FM
brand. Translates the Hanssen-inspired high-fidelity prototypes in
`../design_handoff_wcdb_design_system/` into the deliverable shape
mandated by the up-to-date DMS authoring skills, while **deferring
to `src/themes/wcdb/wcdb_theme.js`** for layout, sectionGroups, and
every primitive that has already been hand-tuned in the live theme.

> Reading order before changes:
>
> 1. [`src/dms/skills/designing-a-dms-design-system.md`](../../../../dms/skills/designing-a-dms-design-system.md) — the structural grammar this folder honours.
> 2. [`src/dms/skills/translating-design-system-to-dms-theme.md`](../../../../dms/skills/translating-design-system-to-dms-theme.md) — the per-primitive key checklist the live `wcdb_theme.js` already fills in.
> 3. [`src/dms/skills/card-layout.md`](../../../../dms/skills/card-layout.md) — what every Card cell-/cards-grid knob does.
> 4. [`src/themes/CLAUDE.md`](../../../CLAUDE.md) — "configure the Card, don't write a new component."
> 5. [`src/themes/wcdb/wcdb_theme.js`](../../wcdb_theme.js) — **the source of truth for layout, layoutGroup, sections, and primitive theming**. When in doubt, read theme.js.

This folder honours the contract those skills describe — including
the rule that every mockup page is **plain HTML + Tailwind CDN +
`_shared.css`** (no JSX, no React, no build step).

---

## Navigation — how to add a page (read this first)

Per skill §7.0, a reviewer opening any single file must reach the pages
beside it in one click and anything else in two. Two mechanisms carry
that, and **only one of them is per-page**:

1. **The TopNav** (§7.0.1) — real Layout chrome, so it differs by section.
   On `design-system/` pages it *is* the design-system nav: logo, a
   `Design System` label, working links to all five pages with the
   current one in the brand accent, and an `NN / 05` counter at the far
   right. On `pages/` it is **the real WCDB station nav as production
   builds it** — see "The TopNav is a notch" below.
2. **`ds-nav.js`** (§7.0.2) — ONE shared file at this folder's root,
   included by every page as its last line before `</body>`. It is
   section-contextual: the current section expands (numbered, current
   page in the on-air accent on an accent tint), and a `jump to section`
   group links to every other section's landing page. **Never paste
   widget markup into a page.**

> **Deliberate deviation from §7.0.3 (v0.3).** The skill also asks for a
> footer link block at the bottom of every page. WCDB does not ship one.
> The reason §7.0.3 gives for wanting a bottom mechanism is that TopNav
> links scroll out of view on long pages — but `ds-nav.js` is fixed to
> the viewport and reachable at any scroll position, so that need is
> already met. Meanwhile production `wcdb.fm` has no footer at all, and
> the block made `pages/` read less like the product surfaces they are
> supposed to document. Removed everywhere; don't add it back without
> reading this note.

**The sections** (the table lives at the top of `ds-nav.js`):

| Section | Folder | Landing | Pages |
|---|---|---|---|
| Design System | `design-system/` | `theme.html` | 5 |
| Station Site | `pages/` | `home.html` | 11 |
| Station Admin | `pages/admin/` | `playlist.html` | 7 |

A section is a product area, not a folder. If later work adds a distinct
area — an author/admin flow, or a linked multi-page workflow — give it
its own section rather than growing `Station Site` past ~10 entries.

**Adding a page is three edits:** one line in the section's `pages` array
in `ds-nav.js`, and two script tags on the new page —

```html
<script src="../mockup.js"></script>   <!-- theme toggle + photo rotation -->
<script src="../ds-nav.js"></script>   <!-- must be last -->
```

Then re-run the checks:

```bash
node scripts/verify-nav.mjs        # every href resolves; exactly one active link per page
node scripts/icons-audit.mjs       # every <svg> is a named registry icon or decorative
node scripts/sync-rail.mjs --check # the live rail matches home.html on every page
```

`sync-rail.mjs` without `--check` writes the fix.

Both exit non-zero on failure. `verify-nav.mjs` runs the real `ds-nav.js`
under a stubbed `location`/`document` for every page — it catches the two
failures that actually happen and that eyeballing never does: a page
missing from `SECTIONS`, and a wrong relative depth in a nested folder.

The widget is documentation scaffolding. It never appears on a live DMS
site, its styling is inline in `ds-nav.js` (so it renders regardless of
stylesheet load order), and **none of it belongs in `wcdb_theme.js`**.

---

## The two shared runtime files

Both are **dev scaffolding**: one file each, linked by every page, never pasted
into one. Neither belongs in `wcdb_theme.js`.

| File | What it does |
|---|---|
| `ds-nav.js` | The floating, section-contextual nav widget (§7.0.2). |
| `mockup.js` | Makes two real theme behaviours demonstrable in static HTML. |

`mockup.js` covers:

- **Theme mode.** Mirrors `src/themes/wcdb/ThemeModeToggle.jsx` exactly — same
  `wcdb-mode` localStorage key, same `data-mode` attribute on `<html>`, same
  `wcdb:mode-change` event, same glyph rule (the icon shows the mode you are
  **in**, so Moon while dark). Tag any toggle button `data-mockup-theme-toggle`
  and it is wired. The stored mode is applied the instant the file executes, so
  navigating between pages in light mode doesn't flash dark. **If
  `ThemeModeToggle.jsx` changes, change this with it.**
- **On-air photo rotation.** Any `<img data-mockup-photo>` gets a random photo
  from the `PHOTOS` array on each load, resolved relative to the element's own
  `src` so it works from any folder depth. Rotating is the point: it stops the
  panel being tuned to one lucky crop. Add a photo with one line in that array
  — see `assets/photos/README.md` for provenance and the selection rule.

---

## The TopNav is a notch, not a bar

This is the detail every previous pass got wrong, so it gets its own section.
Compare `references/wcdb/screenshots/production-home-1440.png` before changing
any of it.

`layoutContainer1` is `fixed top-0 z-50` **with no width**, so the whole nav
shrink-wraps to its content. The page background is carried by each *menu*
container — `leftMenuContainer`, `centerMenuContainer`, `rightMenuContainer` —
and **never by the header itself**. That is the entire trick: the bar stops
where its content stops, and the hero panel sits beside it and cuts up
underneath. The right menu closes the shape with `lg:rounded-br-[28px]`.

Two 20×20 inverse-corner widgets mask the joins. Neither menu container is
`relative`, so both position against the fixed container:

| Widget | Position | Masks |
|---|---|---|
| `NavLeftStyleWidget` | `absolute left-[7px] top-[56px]` | the join just below the bar, at the panel's left edge |
| `NavRightStyleWidget` | `absolute -right-[20px] top-[8px]` | the join just past the bar's right end |

The anatomy is documented on `design-system/components.html`; `layouts.html`
draws the nav short in its layout diagram for the same reason.

**Other things production settles:**

- The logo is the boxed wordmark SVG at `h-12` (wrapper `pt-1 pl-4`), **never
  set as type**. The live theme serves `/themes/wcdb/logo_white.svg`; these
  mockups carry a copy at `assets/logo_white.svg` so the folder stays
  self-contained. `.wcdb-logo-img` inverts it in light mode.
- The nav items are `Schedule · Events · Station Info · DJs · Airwaves`, all five
  resolving to real mockups (`airwaves.html` was the last one added, 2026-08-17).
- The right cluster is the signed-out `UserMenu` glyph **then** the mode
  toggle. `wcdb_theme.js` lists the toggle first in its default `rightMenu`
  array; the live site overrides that order, and production is what these
  mockups mirror.
- The toggle renders **Moon** while `data-mode="dark"` (the default) and Sun in
  light mode — see `ThemeModeToggle.jsx`.

---

## The live rail — every main page carries it

The sticky `header` LayoutGroup is not a home-page hero. **It is a standing rail
that all eight main pages carry**, so "what is on air / what is playing" follows
the reader around the site rather than living on one page. Only `login.html` is
without it: an auth surface is a single attentional task, and the theme ships no
editorial split for it.

That makes the cutaway grid the site's default page shape, not a special case:

```
childWrapper   flex-1 flex flex-col md:grid md:grid-cols-2
  ├── LayoutGroup "header"   ← the live rail, md:sticky md:top-0 md:h-screen
  └── LayoutGroup "content"  ← the page's own feed
```

**`home.html` is the canonical copy of the rail.** Static HTML has no include
mechanism, so the other seven pages hold a generated duplicate — edit the rail in
`home.html` and re-run `scripts/sync-rail.mjs`, never hand-edit a copy. Each copy carries a
comment saying so. (In a live DMS site this is a section in the `header` group of
a page template; the duplication is a limitation of the mockup format, not of the
platform.)

### Half-width columns break viewport breakpoints

The single biggest consequence: **the content group is half the viewport**, so a
Tailwind viewport breakpoint describes twice the space the content actually has.
`xl:` fires at a 1280px *viewport*, where the column is only ~640px — so a table
that "becomes readable at `xl:`" is still cramped. Double the threshold and use
an arbitrary variant instead:

| Page | What it does |
|---|---|
| `spins.html` | Album and Show columns drop out below `min-[1800px]`, leaving TIME · ARTIST · TRACK · PLAYS — the spine of a play log. |
| `schedule.html` | The seven day cards wrap 2 → 4 (`min-[1100px]`) → 7 (`min-[1750px]`) rather than shrinking the display type past legibility. |

If a container-query build ever lands, these become `@container` rules and the
doubling goes away. Until then, when you size something in the content column,
check it at the width the *column* has, not the width the window has.

### The page bottom is a single line

The rail's card sits 8px off the bottom of its group (the group's own `p-2`).
**The footer card has to land on that same line**, or the page ends with the
right column stopping short of the left — which reads as a mistake rather than a
margin. Everything between the footer and that edge is therefore zero: the
content group's inner container keeps its top and side padding but drops the
bottom (`px-4 pt-4`, not `p-4`), and the footer section carries no `pb`.
Measured on all eight pages; the delta is 0.

---

## The left panel holds two components, not one

`pages/home.html`'s `header` LayoutGroup answers two different questions, and
the design has to keep them apart:

1. **On air** — *what show is on right now?* A show photograph, full bleed,
   scrimmed, with the show's identity set **on** the image rather than in a box
   beneath it. The hierarchy is deliberate: **show title** (display italic, the
   largest thing on the page's left half), then **DJ** (display italic 24px — a
   name gets the display voice, not a mono caption), then the **slot**
   (mono 13px, near-white, beside the on-air pill: after "is it live?",
   "when is this on?" is the next question this panel answers), and only then
   the genre, which is the quietest line. The genre rides a notch chip in the
   bottom-left corner, coloured from the band below so it reads as that surface
   pushing up into the photo.
2. **Now playing** — *what song is playing, and how do I hear it?* Its own
   surface tone (`--bg-2`), a **label row** (the accent "Now playing" chip, the
   start time, the listener count, and the link to the full playlist), then a
   **104px cover-art slot**, the track set close to a headline, the artist under
   it, the release line, and the round `stream_player` button.

   Two deliberate absences. There is **no "Listen live · 90.9 FM" caption** — the
   play button says that, and the rail is on every page, so the station does not
   need re-announcing at this size. And there is **no progress bar or duration**:
   the stream reports a title, not a length, so a progress bar would be inventing
   a number and the "5:18" that used to sit there was fiction.

Before v0.3 these ran together as undifferentiated rows over a gradient, which
made them hard to tell apart and spent the whole panel on decoration. The theme
gives this LayoutGroup a single rounded card
(`layoutGroup.styles[1].wrapper2`), so the separation is done with surface tone,
not a second card. The composition is documented on `patterns.html` §C.

**Photography.** `assets/photos/` holds five real photographs from the station's
own picture library at `wcdbfm.com`, and `mockup.js` rotates the hero among them
on every load — see that folder's README for provenance and the selection rule.
The Hanssen material this brand derives from is photography-led; a gradient hero
was the biggest single departure from it.

**The on-air block is mode-independent.** The scrim and every value set over it
are fixed dark in both modes, because it is a photograph and a photograph does
not become light when the page does. Using `--ink-1` there would render the show
title black-on-black in light mode. The `listen live` band below it *is*
mode-aware, and the notch chip takes that band's colour — so in light mode the
panel reads as a dark photo sitting on a light instrument, which is correct.

**Cover art is still a placeholder.** The 92px slot is sized for the playlist
dataset's album thumbnails. That dataset is not in the `wcdb`/`prod` DMS env
(`dms dataset list` returns only WCDB Schedule, WCDB DJs, WCDB Schedule times),
so the real source needs locating before the slot can be wired.

---

## What the home page does and does not show

The right column is a **feed of what's next**, not an archive:

- The masthead is the station's *name* — "WCDB Albany 90.9FM" in giant display
  italic, nothing else. An editorial headline there competed with both the show
  title on the left and the schedule below it.
- The schedule card is the next few hours — three rows, and out. Every row
  carries its department as a leading icon so the grid is scannable by kind; the
  live row takes an accent tint *and* a 2px left rule, because colour alone
  doesn't survive a squint. The **department chips live on `schedule.html`**,
  not here: on a three-row card they could only be a legend, but on the schedule
  page they are the second filter axis beside the day picker (`patterns.html`
  §F and §G).
- **There is no recent-plays list.** The now-playing block in the left panel
  links to `spins.html` instead — one live claim, one link to the history. A
  recent-plays list in the right column duplicated the player and competed with
  the schedule for the same attention.

---

## `station-info.html` — transcribed, not invented

The page is a redesign of the legacy site's
`http://wcdbfm.com/ContactInfo.aspx`, and **all of its content is transcribed
from there** (captured 2026-08-11): the request line, the mailing address, the
three "other information" links, and the full executive board for the
1 May 2026 – 1 May 2027 term — six departments, twenty-five roles.

Three decisions worth knowing about:

- **Email addresses are readable here, and are plain text — not `mailto:`
  links.** The legacy page prints them obfuscated
  (`generalmanager[at]wcdbfm[dot]com`) as an anti-spam measure. Readable is the
  right design intent, but **the live build must keep an obfuscation strategy of
  its own**; do not turn these into bare `mailto:` hrefs without one.
- **Roles the source lists without a name read "Not listed", not "Vacant".**
  News, Sports and Co-Engineer have no person printed on the legacy page; News
  and Sports still list working department addresses, so "vacant" would assert
  something the source does not say.
- **The department glyphs pay for themselves here.** Each music role carries the
  same icon the schedule uses for that department (§G), so Hip-Hop/R&B, Alt
  Rock, Metal, Jazz, Electronic and World are recognisable across both pages.

---

## Airwaves — the blog, and its two admin pages (added 2026-08-17)

The blog has a **name**. It is called **Airwaves**, and it is called that
everywhere — public masthead, top nav, admin sidenav, admin page title. A blog
with a name is a publication; "Blog" is a nav label. `pages/blog.html` is the
older unnamed version and is kept only as the before-picture.

Three pages:

| Page | What it is |
|---|---|
| `pages/airwaves.html` | the public feed |
| `pages/post.html` | one article |
| `pages/admin/airwaves.html` | blog management — every post, its state, its image |
| `pages/admin/post-editor.html` | one post |

### Every post has a featured image, and that is the point

This is the change the design is built around. The old blog page was a list of
titles with generated gradient artwork; a station blog that publishes studio
photography deserves better, and the image is what makes the page worth
visiting rather than skimming.

It follows through everywhere: the public grid crops it 3:2 (16:9 for the
double-width lead), the admin list shows it as the **first column** — so a post
missing one is the thing an editor spots first, and the empty slot says
`NO IMAGE` — and the editor puts it above the title with a chip stating the crop
the grid will apply.

### A post with no image is allowed, and has to look deliberate

Two of the six cards in the mockup have no image, on purpose — that is the state
being designed, not an oversight. An imageless post falls back to the **generated
gradient the blog used before featured images existed** (`.wcdb-art--ember` /
`--cool` / `--mono` / `--violet` in `_shared.css`), with the post's **category
set over it** — a bare gradient reads as a loading state, a labelled one reads as
a choice.

The variant must be derived from the post's own values (hash the slug, or map the
category) so a given post always gets the same one. A gradient that changes on
reload is a bug.

In the live build that is either the image column's `defaultImage`, or the
`art_block` item on the primitive-gap ledger if the gradient is wanted per-row.

### The rail carries the main article, the filters, and the stream

The rail holds three blocks on this page, top to bottom:

1. **`card:featured-post`** — the main article, in the slot every other page
   gives to `card:on-air`.
2. **`card:category-filter`** — filter by category.
3. **`LISTEN LIVE`** — unchanged, on every page.

**Why the filters are here and not above the feed.** The rail is the page's
standing furniture — it is what does not change as you read — and a filter is
exactly that: navigation, not content. Moving it out of the content column also
lets the feed start at the very top of the page instead of being pushed down by
a control strip.

**TWO axes, one card** — the same argument `card:schedule-filters` makes on the
schedule page: keeping them together is what makes them read as filters on one
list rather than two unrelated nav strips. Here the axes are **what** (category)
and **when** (period).

| Axis | Values |
|---|---|
| Category | Everything · **Album reviews** · Dispatches · Interviews · Liner notes · Studio diary |
| When | Anytime · This month · This year · 2025 · Earlier |

**The time axis is deliberately coarse.** A blog that posts a few times a month
does not need a date picker, and an empty result is a worse outcome than a
slightly wide one. `This month` / `This year` are relative and need no
maintenance; the explicit years are generated from what exists, so the list
never offers an empty one.

**The result count is part of the control.** With two axes it is the only way a
reader can tell what their combination did — `11 of 49` is the difference
between a filter that worked and a feed that looks broken. It carries the reset.

**Every category has a glyph**, in the same disc the schedule rows use (26px
here, 34px there). Not decoration: it gives the eye a fixed left edge to scan
down instead of six ragged mono labels, and it is the mark the category can be
recognised by elsewhere. **All six are existing registry icons** — this adds
nothing to the icon set:

| Category | Icon | Why |
|---|---|---|
| Everything | `Grip` | the whole grid |
| Album reviews | `Star` | a review has a rating |
| Dispatches | `Broadcast` | a dispatch is a transmission |
| Interviews | `Microphone` | — |
| Liner notes | `Note` | — |
| Studio diary | `Calendar` | a diary is dated |

Both axes are `filter_pill` cells over one page variable each, exactly as the
schedule's day filter and the admin state bars are, so two axes cost the theme
nothing new.

**There is only ONE featured treatment on the page.** The feed below is a
uniform 2-up grid with no double-width lead: two "this is the important one"
treatments on a single page cancel each other out. The rail is the lead; the
grid is the feed. That also removes the per-card column span from what this page
needs, so the ledger's `cardSpan` item no longer blocks the blog.

### The featured post takes the rail

On every other public page the rail opens with `card:on-air` — *what show is on
right now*. On Airwaves, **`card:featured-post` takes that slot instead**.

The reasoning is that the rail is the page's one full-height object, and
whatever occupies it is the claim the page makes. On the blog that claim is
"read this", not "listen to this" — and a reader who arrived for Airwaves has
been told what is on air by every other page they passed through.

**`LISTEN LIVE` is kept below it.** The stream is the station's permanent offer
and belongs on every page.

The featured block is *structurally identical* to `card:on-air`: full-bleed
image, gradient scrim, identity set over the lower third, notch chip in the
corner. That is deliberate — the live build can reuse the same composition
(image cell + gradient cell + text cells riding up on negative margins) with
the post's fields swapped for the show's, so this costs the theme nothing new.

### `post.html` — one article

Four pages now, not three. The single-post page puts **the photograph in the
left rail and the article in the right column**, which is the same cutaway every
other page uses — so it needs no new layout, only a different tenant for the
rail.

**The rail is the picture, and nothing else.** It is `md:sticky md:h-screen`
like every rail, and that is the point: the image stays with you for the length
of the article instead of being a banner you scroll past in two seconds.

**No text over it, and therefore no scrim.** Every other rail panel sets a title
on its image because that panel *is* the headline; here the article carries its
own `<h1>` in the column beside it, and repeating it over the photo would be
saying the same thing twice at two different sizes. The only addition is the
**photo credit** in the notch chip — a station that shoots its own sessions has
photographers.

The column beside it, in order:

| Section | Note |
|---|---|
| `lexical:breadcrumb` | back to Airwaves, and the category |
| `lexical:post-head` | kicker, headline, standfirst, byline row |
| `lexical:post-body` | the article — **one** lexical section |
| `card:post-footer` | what it is filed under, and how to hear it |
| `card:related` | two more in the same category |

Three decisions worth keeping:

- **The measure is `max-w-[68ch]`, not the column width.** The content column is
  wide enough to run prose edge to edge and it should not — a 110-character line
  is measurably harder to read. The column stays wide; the paragraph does not
  fill it. The pull quote is set *outside* the measure so it interrupts
  deliberately.
- **The byline is a row, not a stack** — avatar, name linking to the writer's DJ
  profile, then the two facts a reader uses to decide whether to start now: when
  it went out and how long it takes. Read time is derived.
- **`card:post-footer` ends with the thing the article is about.** Most posts
  here concern something that airs, so the page hands the reader to the show
  rather than leaving them to search the schedule. That row is what makes this a
  *station* blog rather than a blog.

### The editor splits the post from what is about the post

Left column: the post as a reader meets it — image, title, slug, excerpt, body.
Right column: everything *about* it — status, publish date, Featured, category,
author. Mixing the two is what makes most CMS editors feel like a form rather
than a piece of writing.

Two details worth keeping:

- **Save draft and Update post are separate buttons.** Saving and going public
  are different decisions, and collapsing them is how a half-written post ends
  up on the site.
- **`Featured` says what it does.** It is the highest-consequence switch on the
  page — it decides what fills the rail on the public blog — so the copy under
  it states that rather than leaving an editor to find out by publishing. The
  design deliberately does **not** enforce a single featured post: the rail
  takes the newest one, so featuring a second is how an editor queues the next.

Read time (`9 min read`) is **derived from the body**, never typed.

### Not designed here

- **A newsletter.** There was a signup in the footer through v0.3 — two of
  them, in fact: the generic one and a `Weekly digest` variant on
  `schedule.html`. **Both removed 2026-08-21**; the station is not launching one,
  and a form with nowhere to post is worse than no form because it collects an
  address and drops it. See "The footer" below for what the column carries now.
  If a newsletter does launch, that is where it goes back — and it needs a
  destination decided first.
- **Per-post social/OG images.** The featured image is assumed to serve.
- **Comments.** Out of scope; the station has never had them.

## `schedule.html` — no "next week" section

`card:next-week` ("Looking ahead / Next week's highlights / Full week →") was
drawn through v0.3 and **removed 2026-08-21**. The page's job is the week that is
on; a second, softer list of the week after competed with the day filter directly
above it and answered a question nobody asked on the way to finding tonight's
show. The filter card plus one steerable list is the whole page.

## The footer

An **inverted card** (`.wcdb-card-inv`) — it flips the mode, a light block on the
dark site, so the foot of the page reads as a separate object rather than more
page. Three tiers: a left column carrying the station's own voice, two link
columns to its right, then a hairline and a colophon split to the two edges.

**The left column is the station's particulars, not a newsletter pitch.** It held
a mailing-list signup through v0.3; that was removed 2026-08-21 (see "Not
designed"). Deleting it outright would have left the link lists floating in a
1.4fr column, and the eyebrow, headline and paragraph were *all* the newsletter
copy — so the column now carries what a station footer should: who is
broadcasting, from where, and the number to call.

    ON AIR SINCE 1977
    WCDB Albany 90.9FM
    Student-run radio from SUNY Albany, broadcasting from
    Campus Center 316, 1400 Washington Avenue, Albany NY 12222.
    REQUEST LINE (518) 442-4242      STATION INFO →

The masthead is the station's full name, with `90.9FM` capitalised to match the
home hero — the established treatment everywhere else in this folder. **No
tagline**: one was tried here and removed, because the eyebrow already dates the
station and the paragraph already says what it is, so a slogan between them was
a third voice saying nothing new.

Every value is one `station-info.html` already prints — nothing here is
invented, and there is one place to correct it if the station moves.

> **Not to be confused with `Subscribe` on `show.html`.** That button follows a
> *show*; it is not a mailing list and was deliberately left alone.

## The admin section

`pages/admin/` — five pages. **`playlist.html` is the landing page**, because
it is the only one with a daily job: **`playlist.html`** (spin log + fix/add),
**`schedule.html`** (week editor + versions), **`djs.html`** (roster + add
modal), **`dj-profile.html`** (the editor), **`events.html`** (calendar).

### Layout `app` — a SideNav, not the notch

Admin is the brand's **second Layout style** (skill §3.3: `app` = "authoring /
admin / dashboard surfaces, SideNav visible, narrower content gutters, denser").
The public cutaway is `default`; this is `app`, and the difference is real chrome,
not a restyle:

- a persistent **48-wide (192px)** rail (`layoutContainer1: lg:pl-48`,
  `layoutContainer2: fixed inset-y-0 left-0 w-48`), collapsing to a bar below `lg`.
  **Narrowed from 64 (256px) on 2026-08-14**: a rail item is a short label and a
  17px glyph, so a quarter of that width was never doing work, and on an admin
  page the content column is what needs it. The foot block scaled with it
  (size-8 avatar, `px-3 py-3`, `gap-2`) and the logo dropped to `h-9`.
- the content hugs the rail — **`mr-auto`, never `mx-auto`** (skill §7.3.1);
  `mx-auto` centres between the rail and the right edge and drifts away from it
- **no live rail.** That is public-site chrome; an editing surface is a working
  context, not a listening one. `sync-rail.mjs` skips the folder deliberately.

> **Use the keys `SideNav.jsx` actually reads.** `translating-design-system-to-dms-theme.md`
> §3.1 documents exactly this trap: plausible-looking invented keys (`wrapper`,
> `inner`, `menu`) silently no-op. The real set is in
> `ui/components/SideNav.theme.jsx` — `layoutContainer1/2`, `sidenavWrapper`,
> `logoWrapper`, `itemsWrapper`, `menuItemWrapper`, `navitemSide` /
> `navitemSideActive`, `menuIconSide` / `menuIconSideActive`, `sectionHeading`,
> `sectionDivider`, `bottomMenuWrapper`, and the `topnav*` keys used only by the
> mobile collapse. The mockup is built on those names so the translation is a
> transcription rather than a redesign.

### The admin page header

One component, identical on all three pages:

```
breadcrumb            Admin › DJs › DJ Halftone      ← at the very top, 24px in
title row             DJ Halftone  ·  metadata  ·  status        [actions →]
working content       starts at ~115px
```

**Breadcrumbs go above the title, not under it**, and carry the whole trail —
they are how you leave the page, so they belong where the eye starts. The title
gets one line at `clamp(30px,3.2vw,42px)` with its metadata set inline beside it,
and the primary action sits on the same row.

A functional page does not get a hero band. The public pages open on a masthead
because arriving *is* the experience; an admin page is a place you are already
working, so the top of the viewport is working space. This header costs ~115px
before real content, against ~183px for the display-scale version it replaced,
and it is the same 24 / 55 / 115 on every page rather than three variations.

### Decisions the live data forced

These are not preferences. Each one is what the 891 DJ rows and 769 schedule
rows actually say (verified 2026-08-13 via the DMS CLI):

- **The roster opens on Current, never on All.** 891 DJs exist; **84 are
  current**. A list that opens on 40 years of alumni answers a question nobody
  asked. The counts are printed on the control so the default argues for itself.
- **DJ status is an explicit toggle, not derived from the end date.** It looks
  derivable and it isn't: **535 of the 807 alumni have no end date at all**, so a
  blank end date cannot mean "still on air" — it usually means nobody wrote it
  down. Dates are history; the toggle is the fact the site reads. (An earlier
  draft of this design derived status from the date and was wrong.)
- **The add-DJ modal asks for six fields.** The legacy form asked for ~40 and got
  **20 columns with fewer than five non-empty values** — MySpace, MSN, Yahoo,
  favourite magazines, favourite places to hang out. Asking for everything up
  front is how that happens. Everything else is filled in after saving.
- **The schedule shows the whole broadcast day, so an open hour is a thing you
  can see.** Seven days × 24 hours, every cell drawn. Only **106 of 769** shows
  have a start time, and you cannot fill a gap you cannot see — an "unplaced"
  queue described the gap, a grid *shows* it. One hour is the minimum slot, which
  is why the grid's unit is an hour.
- **Point and click, never drag.** A placed block opens the edit modal; an empty
  hour opens the add modal already knowing its day and hour. Drag-and-drop is a
  large amount of interaction surface to build, test and make accessible, and it
  buys nothing a click doesn't.
- **Bad rows are tinted in place, never hidden.** A show with no DJ stays visible
  where it sits. An editor that filters its problems out of sight is how 663
  shows ended up with no time.
- **One control per decision.** The version *dropdown* is the only way to change
  which version you are editing. An always-visible list of every version beside
  it was a second control for the same choice — on a sticky bar, following you
  down the page.

### The playlist is a review queue, not a form

The stream is monitored by **ACRCloud Custom Stream Monitoring**, which POSTs a
detection per track to a webhook — the receiver and the normaliser live in
`research/now-playing/` and settle the row shape:

```
matched   timestamp_utc · title · artist · album · album_cover · score
          isrc · upc · spotify/youtube/deezer ids · genres · label · release_date
no-match  timestamp_utc · played_duration · status_code
```

Two fields drive the whole page. **`score`** is the match confidence, so
"incorrectly added" is detectable rather than a matter of opinion — under 80 the
row is tinted and flagged. **`no-match`** events are the gaps, so "missed" is a
row that already exists rather than an absence someone has to notice.

So a DJ is **not** here to type a playlist. They are here for the exceptions,
and the page leads with `Needs review · 2` beside `All · 412`. Both failure
states are drawn **in place** in the log — a gap reads *"Nothing identified · 8
min · talk, a live set, or a track the matcher missed"* with an **Add** button; a
low-confidence match keeps its percentage next to it with an **Edit**. A row
carries its provenance as a badge: a score (auto), `By DJ` (added by hand, and
never overwritten by the matcher), or `Corrected` (edited, original detection
kept underneath).

The cover slot on the public rail can be filled from this feed's `album_cover`
— but note **ACRCloud does not return cover art**. The `now_playing` data type
fills it by looking the track up on iTunes (`data-types/now_playing/cover-enrichment.js`),
so covers are best-effort and a row can legitimately have none.

### The schedule is two datasets, not one

A row in the legacy schedule **is a show**; the time columns are optional
attributes on it, which is why 663 of 769 rows have no time. The target shape
splits them:

- **`shows`** — `show_id · name · dj_id · department · description · icon`
- **`schedule`** — `show_id · day · start · end`, and **this is what a version
  versions**

That copies **106 rows per version instead of 769**, keeps show records shared
(fix a show name once, not once per version), collapses 15 duplicate rows that
only existed because a show airing twice needed two full copies of itself, and
removes `end_day` — an overnight is just `end <= start`.

The UI follows the split. Clicking an open hour opens a **picker** over the 663
existing shows rather than a blank form; "New show instead" is the second door.
The edit modal labels its two halves **This airing** (`schedule`) and **The
show** (`shows`, *shared by N airings*) and says that editing the lower half
changes the show everywhere it airs. And the destructive action is two actions:
**Unschedule** clears the airing and returns the show to the picker, **Delete
show** removes the record.

### Versions, and the pointer

A version is a **DMS view** on the source (`wcdb_schedule|v1:view`, `|v2:view` —
they already exist). "Duplicate" and "New blank" both create a view.

Making one live needs an indirection, because a section binds to data through
`externalSource: { source_id, view_id }` — the *page* names the view
(`patterns/page/components/sections/components/dataWrapper/schema.js`). Two
options were on the table; **the design assumes a single pointer** —
one `live_schedule_view_id` setting the public pages resolve — rather than a
`live` flag on each view. A flag has to be cleared everywhere else on every
publish, so two views can both claim to be live if a write fails; a pointer has
exactly one source of truth and publishing is one write. **Confirm this against
the runtime before building it.**

The publish dialog states the current live version, the incoming one, **and its
row count** — because the failure it prevents is real and present: `wcdb_schedule`
**v2 is an empty view**, and anything resolving "the latest version" would put an
empty schedule on the public site.

---

## Icons — the registry of record

Per skill §1 and `managing-design-system-icons.md`, the icon set is a
first-class deliverable: every `<svg>` in every page carries either
`<!-- icon: Name -->` or `<!-- decorative -->`, and every name resolves
to a real registry entry. An unregistered name renders *nothing* once
these mockups become live DMS pages, so this is not cosmetic.

**The registry of record is the `#icons` catalogue grid on
`design-system/theme.html`** — 49 tiles, each tagged and labelled.
There is no separate `theme/icons.js` here yet; `scripts/icons-audit.mjs`
parses the catalogue as the registry and enforces:

- no untagged `<svg>` anywhere,
- no `icon: Name` that the catalogue lacks,
- no two catalogue names sharing one glyph,
- and **no name used with different geometry than its catalogue tile** —
  a registry has one `Play`, not three near-duplicates. (v0.2 folded 33
  drifted variants back onto their canonical glyph.)

Ten of the 49 are the **department glyphs** — Hip-Hop, R&B, World, Rock, Metal,
Jazz, Electronic, News, Sports, Special — which carry the schedule's icon
column. They are deliberately concrete objects (a mic, a pick, a bolt, faders)
rather than abstract marks: at 14–16px a concrete silhouette survives where an
abstract one turns to mush. `World` reuses the existing `Globe` rather than
adding a near-duplicate. See `patterns.html` §F and §G.

Generating the live theme registry (`icons.jsx`) from this catalogue,
and porting the shared brand-keyed `icons-sync.mjs`, belong to the
theme-side follow-up task — see "Known gaps" below.

---

## The split between handoff and theme.js

WCDB is a special case among the brands shipping a DMS design system
because it has **two converging sources of truth** for the visual
contract:

1. **The handoff** (`../design_handoff_wcdb_design_system/`) — a
   React-via-Babel-in-the-browser prototype that captures the brand's
   aesthetic intent: tokens, the cutaway split, the bare-vs-carded
   right-column rhythm, the inverted footer card, the italic-serif
   editorial voice. This was the original brief.
2. **`src/themes/wcdb/wcdb_theme.js`** — the live runtime theme. While
   the handoff was being translated into runnable code, parts of the
   design system were improved and re-shaped against the actual DMS
   primitives. The Layout, LayoutGroup, and section primitive choices
   in `theme.js` therefore **supersede** the handoff for those
   layers.

**When the two disagree:** follow `theme.js`. The handoff documents
intent at design time; the theme is the working contract. This
README's job is to surface those differences so a future pass
doesn't get confused.

### What this folder defers to from `theme.js`

| Layer | Source | Why |
|---|---|---|
| `layout.styles[0]` (the *only* shipped layout) | `theme.js` | The cutaway split lives in `childWrapper: "flex-1 flex flex-col md:grid md:grid-cols-2"`. The handoff achieved the same shape with hand-rolled `.wc-split` CSS; the theme uses pure Tailwind grid. The theme version is what authors get. |
| `layoutGroup.styles[0]` (`content`) and `layoutGroup.styles[1]` (`header`) | `theme.js` | The cutaway is **two LayoutGroup variants on the same page**, not a single split layout. The left column ("header") is a sticky cutaway panel; the right column ("content") is the scrolling feed. Both wrapper-class stacks come straight from `theme.js`. |
| `pages.section.heights` and `editMinHeight` | `wcdb_section.theme.js` | Named height presets (`auto`, `fill`, `hero`, `tall`, `medium`, `small`) selectable per-section. `fill` is the sentinel that triggers flex sizing on the header column. |
| `topnav.styles[0]` (`wcdb`) | `theme.js` | The mobile + multi-level + animated-underline behaviour is fully themed; the design system documents the rendered states, not new ones. |
| `textSettings` (the Hanssen italic-display ladder) | `theme.js` | Already pinned to Instrument Serif italic from `text-xl` up; mono uppercase eyebrows on `h5`/`h6`. |
| `dataCard.imgFill` | `theme.js` | The new image-cell knob — `imageSize: 'imgFill'` makes images responsive to their cell's `cellWidth` instead of capping at `max-w-N`. The design system documents this as a Card knob; the runtime ships it. |
| `theme.columnTypes.portrait_banner` / `stream_player` / `now_indicator` | `theme.js` + `columnTypes/*.config.js` | Theme-registered WCDB column types. Each is a *small* visual element (banner, play button, on-air pill) the section author parks on the Card grid. The design system shows them alongside data cells, not as composite "section components". |
| `pages.section.heights = { auto, fill, hero, tall, medium, small }` | `wcdb_section.theme.js` | The Layout > Height control on each section uses these named presets. `fill` is the sentinel for flex-fill behaviour in the cutaway header column. |

### What this folder transcribes from the handoff

| Concern | Where in the handoff | Where here |
|---|---|---|
| Color tokens (dark + light) | `styles/tokens.css` | `_shared.css` + `design-system/theme.html` |
| Type ladder, `Instrument Serif` italic discipline | `styles/tokens.css` + page-level uses | `design-system/theme.html` Type section |
| The cutaway split's *intent* (image cuts up under the nav, sticky-left, scrolling-right) | `README.md` "Critical implementation details" + `styles/components.css` `.wc-split` | `design-system/layouts.html` + `design-system/grid.html` (advanced layout grid) |
| The bare-vs-carded right-column rhythm | `README.md` "Bare-vs-carded mix" | `design-system/patterns.html` |
| The inverted footer card | `styles/components.css` `.wc-card-inv` | `design-system/components.html` (Card variants) + `_shared.css` `.wcdb-card-inv` |
| Per-page composition (home / listen / schedule / show / djs / spins / blog / events) | `*.html` mockups in the handoff | `pages/*.html` here, **shaped as real DMS pages** |

---

## Layout

```
dms_design_system/
├── README.md              ← you are here
├── _shared.css            ← mirror of src/themes/wcdb/tokens.css + brand surfaces + meta-nav
├── design-system/         ← FIVE pages documenting the brand
│   ├── theme.html             · color, type ladder, icons, spacing, radii — the foundational tokens
│   ├── layouts.html           · the Layout + the two LayoutGroup variants (content + header cutaway)
│   ├── grid.html              · the sectionArray column grid + the higher-level cutaway split
│   ├── components.html        · every UI primitive WCDB styles, including theme.columnTypes.*
│   └── patterns.html          · multi-primitive compositions + the bare-vs-carded rhythm
└── pages/                 ← every page from the handoff, translated to DMS shape
    ├── home.html              · canonical layout — Listen Live + scrolling feed
    ├── listen.html            · big-play single-column "where to listen" page
    ├── schedule.html          · weekly schedule grid
    ├── show.html              · show detail (hero + about + episode list)
    ├── djs.html               · DJ directory grid (search + segmented filter)
    ├── spins.html             · recent spins full table (search + time filter + Export CSV)
    ├── blog.html              · editorial blog index (featured + grid)
    ├── events.html            · events list with giant italic day numbers
    └── login.html             · auth (the only `layoutGroup: auth` page)
```

Every HTML file is **plain HTML5 + Tailwind via CDN + `_shared.css`**.
No JSX. No React. No build step. Open any file directly in a browser
(`python -m http.server` from the project root) and edit it in a text
editor — there is no toolchain.

Class strings on each primitive are hard-coded from
`src/themes/wcdb/wcdb_theme.js`. If you change a value in the live
theme, mirror the change in any mockup HTML that demos the affected
primitive. The trade-off is intentional — see
[`designing-a-dms-design-system.md` §8](../../../../dms/skills/designing-a-dms-design-system.md#8-implementation-rules-for-mockup-pages).

Each page is shaped as a real DMS page (`Layout > LayoutGroup >
Section > Component`) — wrappers carry `data-dms-layout`,
`data-dms-group`, and `data-dms-section` attributes so a reviewer
can see the structure. The five `design-system/` pages ship with
`dms-annotated` on `<body>` so structural badges
(`LAYOUT · GROUP · SECTION`) appear overlaid; `pages/` examples
leave it off so they read like real product surfaces.

---

## Brand intent

WCDB 90.9 FM is the student-run college radio station at SUNY
Albany. The brand is **Hanssen-inspired** (the Pawel Gola Framer
template): minimal, near-monochrome, editorial. The visual signature:

- **Italic display serif** (Instrument Serif italic) for every
  headline from `text-xl` upward. Carries the editorial / college
  arts-and-letters weight. **Non-negotiable** — don't substitute
  another italic serif without testing.
- **Mono uppercase tracked** (Geist Mono) for eyebrows, labels,
  table headers, on-air pills, chrome. The second-most-distinctive
  voice — appears above every section head, above every table.
- **Sans body** (Geist) for paragraphs, captions, form fields,
  metadata. Quiet, modern, the default voice for everything that
  isn't headline or chrome.
- **Near-monochrome.** White on near-black in dark mode; black on
  off-white in light mode. The accent is the same monochrome ink
  used for primary text — there is no brand colour beyond grey-scale.
- **One red, used once.** `--on-air: #ff3b2f` appears **only** on
  live-broadcast indicators. Never for errors, links, or other UI
  states.
- **The cutaway split.** The home and listen pages put the now-playing
  panel in a sticky left column with the nav floating over its top
  edge, and a scrolling editorial feed on the right. This is the
  brand's single most distinctive layout move — it's why `theme.js`
  ships a Layout that *only* renders cutaway pages and a special
  `header` LayoutGroup for the sticky panel.
- **Bare-vs-carded right column.** The right-hand scrolling feed
  alternates between bare sections (on the page bg, the typography
  carries them) and carded sections (functional content benefits
  from a panel). Most "design system" themes put everything in
  cards; WCDB breathes.
- **Inverted footer.** The footer is a card with flipped colours
  (white card in dark mode; dark card in light mode). The classic
  Hanssen move — the design system's only chromatic break.

## Theme-chosen scope

WCDB is an editorial / radio-station theme. Its example pages
exercise:

- The cutaway-layout home page (`home.html`).
- Long-form catalogue moments (`show.html`, `blog.html`).
- Calendar / schedule moments (`schedule.html`, `events.html`).
- A directory grid (`djs.html`).
- A dense tabular page (`spins.html`).
- A single-column hero page (`listen.html`).
- An auth form (`login.html`).

The brand does **not** ship example pages for analytics dashboards,
GIS workbenches, or dense filterable tables of compliance KPIs. The
platform supports them; this *theme* doesn't need to prove it. (For
those archetypes, see TransportNY's `dms_design_system_v2` and
Tessera's `design_system_v2`.)

**Deliberate exclusions from the §2 pattern-level list.**
`pages.complexFilters` (the admin filter-tree editor) and
`pages.sectionGroupsPane` (the admin group-layout editor) are **not**
mocked here. WCDB ships no admin surface, and a brand treatment invented
for one would be guesswork the translation skill shouldn't inherit. The
authoring chrome WCDB *does* show — the section toolbar and the pattern
editor — is on `patterns.html`. `pages.attribution` is mocked there too
(§05b); it appears on public data sections, so it isn't optional.

---

## Mapping to the spec

| Spec section                  | This folder                                                                 |
|------------------------------|-----------------------------------------------------------------------------|
| §7 deliverable structure      | `_shared.css` + `design-system/` (5 pages) + `pages/` (9 examples) ✓        |
| §7.2 design-system/theme      | `design-system/theme.html` — color, type (14 tokens), icons, spacing, radii ✓ |
| §7.3 design-system/layouts    | `design-system/layouts.html` — hierarchy diagram + the single shipped Layout + both `content` + `header` LayoutGroup variants + wrapper-class reference table + section-width section ✓ |
| §7.4 design-system/grid       | `design-system/grid.html` — `gridSize`, `defaultSize`, the `sizes` vocabulary, **plus** the higher-level cutaway split since WCDB's `childWrapper` is `md:grid md:grid-cols-2` ✓ |
| §7.5 design-system/components | `design-system/components.html` — every primitive in `src/dms/packages/dms/src/ui/components/` plus WCDB's three theme-registered column types ✓ |
| §7.6 design-system/patterns   | `design-system/patterns.html` — empty/loading/error states, data section with filters, card grid, form, auth, section toolbar + WCDB-specific bare-vs-carded rhythm pattern ✓ |
| §7.7 pages/ (theme's choice)  | Every public-facing handoff page translated to DMS shape ✓                  |
| §1 five-layer hierarchy       | Every mockup uses `<Layout>` → `<LayoutGroup>` → `<Section>` → primitive   |
| §7.0 navigation               | TopNav per section + one shared `ds-nav.js` (sectioned), verified by `scripts/verify-nav.mjs`. Footer block deliberately omitted — see the Navigation section ✓ |
| §1 icons                      | Every `<svg>` tagged; 49-icon catalogue on `theme.html` is the registry; enforced by `scripts/icons-audit.mjs` ✓ |
| §10 done criteria             | Every primitive used in `pages/` is documented in `components.html`; every Section sits on the grid `grid.html` documents; TopNav shows 2-level menu with active state; the cutaway pattern is preserved on `home.html`/`listen.html` ✓ |

---

## Known gaps in v0.3 / open questions

- **`wcdb_theme.js` has no `sectionArray` key at all.** `grid.html`
  documents `gridSize: 12`, `defaultSize: "12"`, the `sizes` vocabulary
  and `layouts.centered: max-w-[1280px] mr-auto`, but the runtime theme
  does not implement them — authors currently get the DMS 6-column
  default. Closing that gap is theme-side work, not design work.
- **The now-playing cover-art slot has no data source.** See "The left panel
  holds two components" above — the playlist dataset with album thumbnails is
  not in the `wcdb`/`prod` DMS env, so the 92px slot ships a gradient
  placeholder.
- ~~**`dataCard` is still on the v1 (legacy) Card layout model.**~~
  **Closed 2026-08-15.** WCDB's `dataCard.styles[0]` is now
  `layoutModel: 'v2'` with `cellGutter: 8` and an `itemEditOutline`, so the
  spacing these mockups draw *does* reproduce at runtime: card rows are
  content-sized and packed to the top (the inter-card gap is exactly
  `cardsGridGap`, with no distributed slack), cells carry no always-on
  transparent border, and the ambient cell gutter is one number emitted
  inline — which means a section's `cellsPadding`/`cellPadding`, including an
  explicit `0`, always beats the theme. The admin list styles (`adminRow`,
  `adminHeaderRow`) set `cellGutter: 0` of their own, because a row's gutter
  belongs to the row. See
  `project-planning/wcdb/tasks/current/modernize-wcdb-datacard-to-v2.md`.
- **The live icon registry does not exist yet.** The catalogue here is
  the source; `icons.jsx` still has to be generated from it (and the
  shared `icons-sync.mjs` ported into `dms-template/scripts/`, which
  currently holds only `npmrds-reports/`).
- The four page designs the roadmap calls for (home, schedule, playlist,
  station about) are a separate task and should be authored against this
  version's navigation and icon rules rather than retrofitted.

- The handoff included scripted interactions (mode toggle, density
  toggle, animated underlines, on-air dot, equalizer). Static HTML
  mockups can show the animations (CSS keyframes) but not the
  toggles. Live state lives in `wcdb_theme.js` widgets
  (`ThemeModeToggle`, `NavLeftStyleWidget`, `NavRightStyleWidget`)
  — those are documented but not interactive here.
- The hero "imagery" is CSS gradients + scan-line textures + giant
  italic glyphs (`.wcdb-art`, `.wcdb-initials`). Real photography
  should replace these placeholders in production.
- The on-air audio player UI is mocked — wiring it to the actual
  WCDB stream URL is out of scope for the theme.
- `theme.columnTypes` ships three column types
  (`portrait_banner`, `stream_player`, `now_indicator`) — all are
  documented on `components.html`. If more are added later, mirror
  them there.

---

## Sources

- `../design_handoff_wcdb_design_system/` — the React-via-Babel
  prototypes this folder transcribes content from.
- [`../../wcdb_theme.js`](../../wcdb_theme.js) — the live runtime
  theme, **the layout/sectionGroup/primitive contract** this folder
  defers to.
- [`../../tokens.css`](../../tokens.css) — the canonical CSS-variable
  token file `wcdb_theme.js` consumes; `_shared.css` mirrors it.
- [`../../wcdb_section.theme.js`](../../wcdb_section.theme.js) — the
  section-height preset map.
- [`../../columnTypes/`](../../columnTypes/) — the three
  theme-registered column types and their config + theme files.
- `src/dms/skills/designing-a-dms-design-system.md` — the design
  contract this folder honours.
