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
| Station Site | `pages/` | `home.html` | 9 |
| Station Admin | `pages/admin/` | `djs.html` | 3 |

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
- The nav items are `Schedule · Events · Station Info · DJs`, all four now
  resolving to real mockups (`station-info.html` was the last one added).
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

## The admin section

`pages/admin/` — three pages behind the same TopNav notch as the public site,
with the admin menu and an `Admin` marker: **`djs.html`** (roster + add modal),
**`dj-profile.html`** (the editor), **`schedule.html`** (week editor + versions).

**Admin pages do not carry the live rail.** The rail is public-site chrome; an
editing surface is a working context, not a listening one. `sync-rail.mjs` skips
the folder deliberately — if an admin page has no rail, that is why.

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
- **The schedule editor leads with what is *not* placed.** Only **106 of 769**
  shows have a start time. The job is not correcting times, it is entering them,
  so unplaced shows are a queue at the top of the page rather than a filter you
  have to go looking for.
- **Bad rows are tinted in place, never hidden.** A clash, a missing time and a
  missing DJ each stay visible where they are. An editor that filters its
  problems out of sight is how 663 shows ended up with no time.

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
`design-system/theme.html`** — 48 tiles, each tagged and labelled.
There is no separate `theme/icons.js` here yet; `scripts/icons-audit.mjs`
parses the catalogue as the registry and enforces:

- no untagged `<svg>` anywhere,
- no `icon: Name` that the catalogue lacks,
- no two catalogue names sharing one glyph,
- and **no name used with different geometry than its catalogue tile** —
  a registry has one `Play`, not three near-duplicates. (v0.2 folded 33
  drifted variants back onto their canonical glyph.)

Ten of the 48 are the **department glyphs** — Hip-Hop, R&B, World, Rock, Metal,
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
| §1 icons                      | Every `<svg>` tagged; 48-icon catalogue on `theme.html` is the registry; enforced by `scripts/icons-audit.mjs` ✓ |
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
- **`dataCard` is still on the v1 (legacy) Card layout model.**
  `card-layout.md` (rewritten 2026-07-29) added an opt-in `v2` model:
  content-sized card rows packed to top so the inter-card gap is exactly
  `cardsGridGap`, no `border border-transparent` on every cell, and one
  explicit `cellGutter` number instead of a padding class baked into
  `headerValueWrapper`. WCDB's `dataCard.styles[0]` has no `layoutModel`
  and *does* bake `p-2` into `headerValueWrapper` — so the exact spacing
  the mockups here draw will not reproduce faithfully at runtime.
  Evaluating v2 for WCDB is theme-side work (landbank's theme.js is the
  worked example).
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
