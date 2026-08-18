# MNY Admin Panel — Home redesign (design page)

**Project:** MitigateNY · **Topic:** themes · **Status:** DONE pending human review · **Started:** 2026-08-10

## Objective

A ground-up design page for the admin pattern's **Home** (live page `566463`, pattern `566466`,
app `mitigat-ny-prod`), in the mny design system.

**Explicit instruction:** the current Home was *not* to be referenced — the owner's position is
that it "is not at all representative of what the home page should be." Recorded for context only:
it is 29 sections carrying the same "MitigateNY Dashboard" title band three times, one section
with no element-data, and per-dataset stat Cards/Graphs interleaved with lexical link-cards in no
order. None of it informed this design.

Deliverable: **design mockup only** (plain HTML + Tailwind CDN per
`src/dms/skills/designing-a-dms-design-system.md`). Not a live build.

## The thesis — what a Home should do

Three jobs, in order:

1. **Orient** — whose plan is this, how big is it, what shape is it in.
2. **Alert** — what needs a human decision now, with the fix one click away.
3. **Route** — send the planner to the surface that does the work.

**It must not duplicate those surfaces.** The six dataset metrics live on Plan Data
(`admin-forms-insights.html`); Home carries a compact index that *links* there rather than
restating the numbers. This is the specific failure of the current Home — it restates dataset
stats that belong elsewhere, so it has no job of its own.

## Revision 2 (2026-08-10) — the templateability rule

Review: *"Needs a Decision is reactive narrative to the data … this should be mostly static and
templateable across all plans."*

This is now the **governing constraint** for the page, and it deleted a whole band. The first pass
opened with three hand-written findings ("No action is prioritized", "About one meeting per
jurisdiction") — each true of Sullivan *today*, meaningless for a county with different data, and
each needing an author to rewrite it as the data moved. **A Home that must be re-authored per
county isn't a Home, it's a report.**

**The rule now: every band is identical for every county plan. Only values and the county name
vary — never the copy, never which cards appear.**

| Feedback | Change |
|---|---|
| "Needs a Decision" is reactive | **Replaced** with **"How your plan comes together"** — the four elements every LHMP must contain under **44 CFR 201.6** (planning process · risk assessment · capability assessment · mitigation strategy). Fixed by regulation → identical for all counties forever. Each names the datasets that feed it, which is what gives Home a job of its own rather than restating Plan Data. |
| Your Plan Data should be totals only | Status chips ("0 ranked", "Complete", "Thin", "Of 3,077 statewide") **removed** — they were the same reactive-judgement problem in miniature. Each row is now name + one total. Units kept ("475 actions", not bare "475") so no row repeats the Fallsburg "30 what?" problem. |
| Plan Status isn't finalised | Link **removed** from the Go To band **and from the TopNav**. Three destinations remain (Plan Data · Actions workspace · Export), stretched with `flex-1` so the column ends **flush** with Your Plan Data — verified at delta **0px**. |
| Jurisdictions section unclear | **Removed.** The bare "30" never said 30 *what*, and a per-jurisdiction action breakdown is reactive data that belongs on the actions workspace. The header still carries "23 participating jurisdictions". |
| Top section needs rework | Absorbed into the above: the old "plan at a glance" four totals **also went**, because once Your Plan Data is pure totals they were duplicative. |

**Implementation note:** the flush-column effect is `flex-1` on the destination cards inside a
`flex flex-col` section, *not* a `calc()` with a hardcoded heading height — the first attempt used
`height: calc(100% - 33px - 1rem)`, which is brittle and violates the skill's no-inline-style rule.
The page now has **zero** inline-styled elements outside the nav widget.

## Revision 3 (2026-08-10) — dark header, county Card, richer narrative

| Feedback | Change |
|---|---|
| "How Your Plan Comes Together is now excellent" | Unchanged. |
| Remove the redundant "See all six" link | Removed — every row in the table already links to Plan Data. |
| Header section group should use the **blue (dark)** style | Header LayoutGroup renamed `header_dark` and now uses `.mny-page-bg-dark` (topo line-art under a steel-blue wash) with white/`mny-200` type and amber accents. |
| County name should be a **Card** bound to **DHSES_County_Database**, filtered by geoid search param to one row | Marked up as a Card section against source **953754 / view 1108098** (62 rows — one per NY county). Verified: `geoid = "36105"` returns **exactly 1 row**. The `county` cell renders the name. |
| More narrative on what the panel is for and how to use it | Two-paragraph lede (what the admin side *is*, and that edits flow to the published plan) plus a static **"Working here"** 3-step panel — identical for every county, so it holds the templateability rule. |

### Revision 4 (2026-08-10) — streamlined to two bands

| Feedback | Change |
|---|---|
| "Undo the blue background for now — I'll take care of that in the platform" | Header band reverted to unboxed on the topo canvas. `.mny-page-bg-dark` rule dropped from the local style block; only the two `mny-shadow-*` rules remain (still needed, see the stylesheet finding below). |
| "The narrative looks good" | Kept, plus the how-to steps folded into it as a third paragraph so nothing was lost when the steps panel was repurposed. |
| Keep the Working Here **format**, but put the **4 elements** in it | The numbered panel stays (amber numerals, bold lead-in, 14px body) and now carries the four 44 CFR elements, each with the datasets that feed it as a `metaXS` line. Retitled "How your plan comes together". |
| Remove the "Change county" button | Removed. |

**Net effect: three bands → two.** The standalone four-card element band is gone; the page is now
just the header (identity + narrative + elements panel) and the content band (Your Plan Data +
Go To). Also removed the redundant `pt-8` offsets that had separated the deleted band.

### Revision 5 (2026-08-10) — full-bleed dark header band

The dark treatment came back, this time **edge to edge** behind both the narrative and the
elements panel, with both on dark formatting.

**The structural point worth remembering:** a full-bleed band is the Layout spec's
**wrapper1 / wrapper2 split** —

| Wrapper | Job |
|---|---|
| wrapper1 | full viewport width; carries `.mny-page-bg-dark` so the surface runs edge to edge |
| wrapper2 | `max-w-[1440px] mx-auto` + gutters, so content still lines up with every other band |

**Consequence: the Layout element cannot carry `max-w`.** It previously did
(`max-w-[1440px] mx-auto pt-[128px]`), which makes a full-bleed band impossible — nothing inside
can exceed the cap. The cap moved *down* onto each band's wrapper2, and the nav offset
(`pt-[136px]`) moved onto the header band itself. Verified at 1685px: band `x:0`,
`width:1685` (full bleed) while both wrapper2s measure exactly **1440**.

**Alignment fix found by measuring, not by eye:** the header text initially started **24px left**
of the section headings below it, because the content band's white card adds `px-6` that the
header had no equivalent for. Added `px-6` to the header's grid wrapper — h1 and the "Your plan
data" heading now share x = 219, and the elements panel's right edge matches the Go To cards'.

Dark formatting: eyebrow `mny-y700`; county name white with the amber underline; FIPS + body
`mny-200`; lede white; elements panel `bg-white/10` + `border-white/20`, heading white, numerals
amber, lead-ins white, body and dataset meta `mny-200` (not `mny-400` — at ~2.6:1 on the steel
blue that was below any usable contrast).

### The county Card — what it shows, and what it deliberately doesn't

`DHSES_County_Database` also carries **plan_status · plan_approval_date · expiration_date ·
primary_point_of_contact · lhmp_link · county_seal_url · photo / photo_credit ·
risk_assessment_period · recommended_start_date · estimated_strategy_workshop_date** — all
excellent header material, and all listed in the page comment as ready-to-add cells.

They are **not rendered**, because Sullivan's values could not be measured: row values are withheld
from out-of-band reads, and the only cached row on the live County-Plan-Status pages belongs to
**Cayuga County** (`plan_status: "Update in Progress"`, approval 10/5/2021, expiry 10/4/2026,
contact `hsherman@cayugacounty.us`). That gave the field *shape* but not Sullivan's data. Adding
those cells is a one-line change once the values are confirmed.

### ⚠ FINDING — `index.css.additions` does not apply under `file://`

The dark band first rendered as pale grey. Cause, verified in the DOM: the linked
`../theme/index.css.additions` is fetched but parsed with **`cssRules.length === 0`**, and
`.mny-page-bg-dark` computed to `background-image: none`. The `.additions` extension isn't served
as `text/css`, so the browser loads the sheet and discards it.

**This affects every page in `design/pages/` and `design/design-system/`, not just this one** —
`.mny-page-bg*`, `.mny-shadow-sm/md` and the `.font-display`/`.font-proxima` rules have never
applied from disk. The corpus has been masking it: fonts come from each page's inline
`tailwind.config`, and the topo canvas is set as an **inline style on `<body>`** on every page
rather than via the class — which is precisely the workaround for this bug, apparently applied
without the cause being written down.

The skill states *"The Play CDN doesn't care about the `.additions` extension; it's plain CSS"* —
that is true when served over HTTP, and false for `file://`. Options: rename to `_shared.css`
(a real `.css` extension), ship the one-line `@import` shim the skill already suggests, or state
that mockups must be viewed over `python3 -m http.server`. **Worth fixing at the design-system
level.** This page carries a small local `<style>` block with the three rules it needs, with the
reason documented inline.

## Live build — page 2379993 "Home Redesign" (2026-08-10)

**13 draft sections, ids 2379994–2380006.** Draft only; `sections` / `section_groups` untouched.
Scripts: `scratchpad/mitigateny/work/build_home_redesign.mjs` + `fix_home_redesign.mjs`.

**Two section groups** (the page shipped with a single `default` group):

| Group | Theme | Holds |
|---|---|---|
| Header | `clearCentered` | eyebrow · county Card · narrative (2/3) · elements panel (1/3) |
| Plan data & destinations | `content` | two headings · six dataset Cards (2/3) · destinations (1/3, `rowspan: 6`) |

**Verified live:** county Card resolves to **Sullivan County** from `DHSES_County_Database`, and all
six rows carry live counts — Actions **61** · HoC **374** · Capabilities **320** · Participation
**29** · Roles **79** · High Hazard Dams **306**.

### Three theme facilities this build depended on

1. **`rowspan` works here.** mny defines no `rowspans` map, but the library default
   (`sectionArray.theme.jsx`) supplies `md:row-span-N`, and mny doesn't override it — so
   `rowspan: '6'` on the destinations section makes it span all six dataset rows. That is what
   preserves the side-by-side Plan Data / Go To layout; without it the two columns cannot be
   expressed on a flat wrapping grid.
2. **Lexical style is selected by `element-data.isCard`** — `richtext/index.jsx` passes it through
   as `styleName`. So `isCard: 'Dark'` selects mny's white-on-dark lexical style.
3. **A Card cell can be a plain (non-calculated) column** — the county name is just
   `{name:'county', hideHeader:true, valueFontStyle:'text4XL'}` with a `geoid` filter, no `fn`.

### ⚠ `admin.theme.js` REPLACES `layoutGroup` — `darkSection` does not exist there

First pass set the header group to `theme: 'darkSection'`, the full-bleed dark style **in
`mny/theme.js`**. It rendered as a plain white card, and the eyebrow, narrative and the entire
contents of the elements panel were **invisible**.

Cause: `admin.theme.js` does `{...mny, ...theme}` and its own `theme` object **replaces**
`layoutGroup` wholesale. Its styles are `default · flush · content · lightCentered ·
clearCentered · full_width` — **no `darkSection`**. An unmatched name falls back to `styles[0]`
(a white card), and the lexicals' `isCard:'Dark'` then painted white text on white.

**The general trap: a spread-merge theme silently loses sibling styles.** Checking
`mny/theme.js` is not enough for a page in the admin pattern — check the pattern's own theme.

Resolved by using **`clearCentered`** (unboxed, capped, no card chrome — closest to the mockup's
canvas band) and clearing `isCard`. **Adding a `darkSection` style to `admin.theme.js` is the
change that would enable the dark band here** — which is the platform-side work the reviewer said
they would handle.

### Reconciliation pass — live vs mockup (2026-08-10)

The dark band arrived platform-side (a theme edit stored on the **pattern** — the group is still
`clearCentered`, so `admin.theme.js` doesn't show it). That inverted the earlier problem: I had
cleared `isCard` when the band rendered light, so the eyebrow, the narrative and the **entire
contents of the elements panel** were dark-on-dark and invisible.

| Difference | Fix |
|---|---|
| Header text invisible on the now-dark band | `isCard: 'Dark'` restored on the three header lexicals |
| Headings rendered sentence-case ("Your plan data") | Uppercased the **text**. This theme's `heading_h2`/`h3` are Oswald but **not** uppercase and there's no uppercase heading tag — same fix as the mockup's card titles |
| Eyebrow sentence-case | → "MITIGATENY · PLAN ADMINISTRATION" |
| Elements panel ran each element's datasets inline after an em-dash | Split into two paragraphs per element, dataset line in caps |
| Go To was one plain lexical | Split into **three bordered, tinted cards** (`2380889`–`2380891`), each `size 1/3` + **`rowspan: 2`**, interleaved so they stack down the right column beside the six dataset rows. Old single section `2380001` orphaned by dropping it from `draft_sections` (`section delete` 500s server-side) |

Interleave that produces the two-column pairing:

```
row1  YOUR PLAN DATA        | GO TO
row2  Actions               | Plan data        (rows 2-3)
row3  Hazards of Concern
row4  Capabilities          | Actions workspace (rows 4-5)
row5  Participation
row6  Roles                 | Export the plan  (rows 6-7)
row7  High Hazard Dams
```

### ⚠ The one difference that CANNOT be fixed from page config

**The county-name Card renders dark-on-dark.** Everything else on the dark band is now white; the
Card is not, and no page-level setting can change it:

- `mny` hardcodes the colour on the card itself — `value: "w-full text-[#2D3E4C]"`,
  `header: "… text-[#37576B]"`;
- `dataCard.styles` holds a **single unnamed style**, so there is no dark variant to select;
- `theme[attr.valueFontStyle]` is a **strict key lookup**, so raw classes can't be smuggled through
  `valueFontStyle`;
- and the `bg`-string trick that solved inner padding does **not** work here — a colour declared on
  an element always beats one inherited from an ancestor, `!important` included.

**Fix belongs in the theme:** either add a dark `dataCard` style (mirroring the lexical `Dark`
style, which is what makes the rest of the band work), or drop the hardcoded colour from
`dataCard.value` so it inherits. Interim option if it needs to read before then: give section
`2379995` a light `bg` so the dark text sits on a light chip — readable, but a deviation from the
design, so not applied unilaterally.

### Known gaps vs the mockup

| Gap | Why |
|---|---|
| **Actions shows 61, not 475** | 61 is county-*led* (`geoid_juris = 36105`). The countywide 475 still has no usable filter — `county='Sullivan'` → 0, `county_geoid=36105` → 1, and there is no `like` operator. Needs an `IN` over the county's 23 jurisdiction geoids, or a `county_geoid` backfill. **The row label reads "Actions" but the number is county-led only** — the single most important thing to fix or relabel before this is shown. |
| ~~Go To items render as plain text~~ | **Fixed** — three bordered cards at `rowspan: 2` |
| ~~No dark header band~~ | **Done platform-side** by the reviewer |
| **County name is dark-on-dark** | Theme change required — see above. The only remaining visual defect. |
| Narrative type scale is flat | The design steps FIPS 14px / lede 20px / body 16px. Lexical paragraphs are one size and this theme ships no `textSettings`, so `styled()` tokens aren't available to vary it. |

## Revision 6 (2026-08-14) — redrawn inside the admin shell

Review: *"The live page uses the admin theme, which makes the design file challenging to implement …
the section groups split the screen in half and from a design perspective it looks bad."*

Both halves of that are the same defect, and **this mockup caused it**: revisions 1–5 drew a 1440px
full-bleed canvas with a floating TopNav. The admin pattern has neither. Everything below was
measured off the live draft at a 1600px viewport (logged in, 2026-08-14).

### ⚠ THE NUMBER NO EARLIER REVISION KNEW: the section canvas is 908px

`mny/theme.js` → `sectionArray.styles[0].layouts.centered` is
**`max-w-[1020px] mx-auto px-0 lg:px-[56px]`**. Every section group on every admin page is capped at
1020px and centered, minus 56px gutters → **908px usable, at every viewport width**. Verified: at a
1600px viewport the band is 1267px wide but the grid measures exactly 1020, twice, on both groups.

Column widths on that canvas — these, not the 1440-based ones, are what a design must be drawn to:

| size | span | px |
|---|---|---|
| `1/4` | col-span-3 | 227 |
| `1/3` | col-span-4 | 303 |
| `1/2` | col-span-6 | 454 |
| `2/3` | col-span-8 | 605 |
| `1` | col-span-9 | 681 |
| `2` | col-span-12 | 908 |

### The rest of the shell, also measured

| Thing | Reality |
|---|---|
| **TopNav** | **Does not exist.** `admin.theme.js` → `navOptions.topNav.size: "none"`. The floating nav in revisions 1–5 was fiction. |
| **SideNav** | 302px, always present (`min-w/max-w-[302px]`), sticky white card. Content column starts at x=310. Hides below `lg` (1024px). |
| **Band = white card** | layoutGroup `default` / `content` / `flush` / `full_width` are *all* `shadow-md bg-white rounded-lg`. The band **is** the card — the mockup's own `bg-white rounded-[12px]` wrapper was a card inside a card. |
| Dark band | `darkSection` now exists in `admin.theme.js`; its wrapper1 runs the content-column width (1267 @1600), i.e. edge-to-edge *after* the sidenav. |

### Why it read as "split in half"

Both groups ran `2/3 + 1/3` → 605 + 303, twice, with a hard seam down **x=1095** through the whole
document. Two visible consequences:

- the elements panel was squeezed into a **303 × 519px vertical strip**;
- Go To needed three sections at **`rowspan: 2`**, hand-interleaved between the six dataset rows,
  just to stay beside them — which breaks the moment a seventh dataset is added.

**The fix: no band splits.** Every band spans the full 908px and varies its *rhythm* inside that
width rather than subdividing it. Equal-width card rows read as a grid; unequal 8/4 columns read as
a seam. **`rowspan` is gone from the design entirely**, and with it that fragility.

| Band | layoutGroup | Contents | Rhythm |
|---|---|---|---|
| 1 identity | `darkSection` | eyebrow · county Card · FIPS/jurisdictions · lede | one column (lede at `1`/681px as a reading measure) |
| 2 plan | `content` (white card) | "How your plan comes together" + "Your plan data" | 4 × `1/4` across, then 6 × `1/3` (3-across, 2 rows) |
| 3 destinations | `clearCentered` | "Go to" | 3 × `1/3` across, on the canvas — no fourth white card |

### What was kept

"I do like the Your Plan Data and Go To buttons concept and shape." Both keep their **concept** —
one tile per dataset (name + one total + a unit line), one tinted bordered button per destination
(title + one line + chevron). Only the **arrangement** changed, from a 303px right rail to a
full-width row. 303px is what made them look bad, not the tiles.

### ⚠ The live page's other defect: ink mismatch

The header band is currently **white** but its lexicals carry `isCard: 'Dark'`. Measured:
`getComputedStyle(narrative).color === "rgb(197, 215, 224)"` — #C5D7E0 on #FFF — and the bold
lead-ins ("Planning process.") render **white on white**, i.e. invisible. That is a band-style /
section-style mismatch, not a design choice. Rule now stated per-section in the mockup:
**`Dark` styles only inside the `darkSection` band.**

### ✅ Section chrome is author-expressible — no custom component, no theme edit

The bordered/tinted card around each element and each dataset tile is drawn by the **section itself**
(`sectionArray.jsx` → `sectionChrome`, on an inner box inside the gutter padding). mny declares no
`border`/`backgrounds`/`heights` maps, so these resolve from the library default
(`sectionArray.theme.jsx`):

| Design element | Section config |
|---|---|
| card outline + radius | `border: 'full'` → `border-[#E0EBF0] rounded-lg` |
| tinted fill | `bg: 'bg-[#F3F8F9]'` (a literal `bg-…` is accepted; named keys are `none`/`white`/`tint`) |
| white fill | `bg: 'white'` |
| **equal-height cards in a row** | **`height: 'fill'`** — the grid cell already stretches; `fill` makes the chrome box `h-full` so a 4-up or 3-up row composes flush |
| gutter | `padding` per-side steps (0/2/4/6/8) |

Two deviations to accept rather than fight: section radius is `rounded-lg` (8px), not the 12px drawn;
and the element cards are lexicals, so bottom-aligning their dataset caps line is approximate — the
theme has no per-block flex control inside a lexical.

### Verified on the new mockup

Measured in-browser at 1600 / 1280 / 1000px:

- sidenav 302 @ x=8 · content column 1267 @ x=310 · all three grids **1020 @ x=434, inner 908** —
  identical to the live page's own measurements
- sections land on 908 / 681 / 303 / 227 exactly as the size table predicts
- four element cards all **226px** with meta lines flush; six data tiles all **117px**; three Go To
  buttons all **101px**
- **no horizontal overflow** at any of the three widths; sidenav hides below `lg` as the theme does

### Live rebuild — revision 6 shipped to page 2379993 (2026-08-14)

Script: `scratchpad/mitigateny/work/rebuild_home_redesign_v6.mjs` (+ `fix_home_v6_band1.mjs`).
Backup of the previous state (page + 15 sections) at `backup_2379993_v5.json`.
**19 draft sections, ids 2383872–2383890.** Draft only; `sections` / `section_groups` untouched.

Three groups now, none split:

| Group | Theme | Sections |
|---|---|---|
| Identity | `clearCentered` (see below) | eyebrow · county Card · lede (size `1`) |
| Plan elements & data | `content` | heading · 4 × `1/4` elements · heading · 6 × `1/3` dataset tiles |
| Go to | `clearCentered` | heading · 3 × `1/3` destinations |

Verified in the live DOM: sections land on col-span 12 / 9 / 3 / 4 exactly as designed, element
cards all **245px** and dataset tiles all **114px** (equal height via `height: 'fill'`), and
**`rowspan` count is 0** — the interleaving trick is gone from the page entirely.

All six counts render: Actions 61 · HoC 374 · Capabilities 321 · Participation 29 · Roles 79 ·
Dams 306.

### ⚠ The dark header band did NOT land — and why

Band 1 was written as `theme: 'darkSection'` and rendered as a **white card**, because
`getComponentTheme` silently resolves an unknown style name to `styles[0]`. Cause, confirmed two
ways:

- the **deployed** bundle has no `darkSection` — that style exists only as an **uncommitted working
  change** in `src/themes/mny/admin.theme.js` (likewise the `Dark` `dataCard` style in
  `mny/theme.js`);
- **pattern 566466 stores no `layoutGroup` override** — its theme keys are only
  `button · layout · sidenav · navOptions · selectedTheme`. So an earlier note in this file, that the
  dark band had "arrived platform-side" as a pattern theme edit, is **not true of the current
  pattern data**.

On a white band the `Dark` lexical style is white-on-white, so the header was illegible — the exact
defect this revision set out to fix, reproduced from the other direction. Resolved by switching the
group to **`clearCentered`** (which does exist deployed, and matches band 3) and clearing every
`isCard: 'Dark'` / `display.cardStyle: 'Dark'` marker. The header now reads as dark type on the topo
canvas.

**To get the dark band, one of these has to happen — both are decisions above the page level:**

1. **Deploy** the working-tree theme changes (`darkSection` in `admin.theme.js`, `Dark` dataCard in
   `mny/theme.js`), then flip the group back to `darkSection` and restore the three `Dark` markers;
   or
2. store a **pattern-level `layoutGroup` override** on 566466 — takes effect with no deploy, but
   `admin.theme.js` spread-merges, so the override **must restate all six existing styles**
   (`default · flush · content · lightCentered · clearCentered · full_width`) or every admin page
   loses them. Same trap for `dataCard`, which is worse: `getComponentTheme` only inherits missing
   keys from `styles[0]` *within the same array*, so an override would have to copy mny's entire
   `dataCard` styles[0].

### Reviewer restructure + polish passes (2026-08-14)

The reviewer took the live page over and rearranged it; these notes record what changed and the
non-obvious mechanics behind each fix. Scripts: `polish_home_v6.mjs`, `polish2_home_v6.mjs`,
`fix_tile_units.mjs`. Pre-polish backup: `backup_2379993_prepolish.json`.

**Their changes:** `layout.outerWrapper` is now the dark topo gradient, so the **whole page canvas**
is dark rather than one band. A new "Group 4" (`default`, white card) holds the county Card +
eyebrow. "How your plan comes together" moved into the **Identity** group, which is `clearCentered`
= transparent = sitting on the dark canvas. Two bands are now fullwidth (915px), not 1020-capped.

| Fix | Mechanic worth remembering |
|---|---|
| Header padding 136 → 112px | Section gutters *plus* the Card's own `cellsPadding` — both inflate a band, and only zeroing both helps |
| Eyebrow → county gap 30 → 22px | Only ~8px was padding; the rest is **leading** (14px type in the lexical's `leading-[22.4px]` box, and Oswald cap height inside a 60px line box). Fixed with an inline `line-height` run style — the only per-run control a lexical has |
| Heading dark-on-dark | `isCard: 'Dark'`. A contrast sweep now shows all 19 page-content elements on the dark canvas ≥3:1 |
| Element cards | Went dark (`bg-transparent`), then **reverted to `#F3F8F9` + dark type** at the reviewer's request. Note `bg-transparent` is the safe "no fill" value — `resolveBg` only honours `bg-` strings, and Tailwind only emits classes it can see in scanned source, so `bg-white/10` would likely never be generated |
| Plan Data whitespace | Two causes: an **empty lexical eating 72px** (2385396, orphaned), and tiles stacking name/count/unit down the left of a 305px box. Now `cellsGridSize: 2` with the count in the right column at `cellRowSpan: 2`. **Leave `cellSpan` unset** — Card derives its tracks from the count of columns *without* a span |
| Go To overlapped the card above by 12px | Cause is `clearCentered`'s **`-mt-3`** in `admin.theme.js`. The band theme is shared, so the offset goes on the sections (`p-2 pt-8`) — clearance now 20px |
| Bottom room under the last tile row | `p-2 pb-8` on the last three tiles — real padding rather than restoring the empty spacer section |
| Tile sub-labels stuttered | "CAPABILITIES / capabilities" → units where one exists, scope where not |

**Not done:** a pattern-level `Dark` dataCard style was written and **rejected by the reviewer**, so
the county name Card still cannot go white on a dark band. It currently sits on a white band where
it reads correctly. Script retained at `pattern_dark_datacard.mjs` — note it supplies *only* the new
style, because `isComponentStylesArray` requires a `name` on `styles[0]` and the deployed mny
`dataCard` has none, so the merge falls through to lodash's index-wise array merge and `styles[0]`
is preserved untouched.

### ⚠ THE RECURRING FAILURE: ink style and band style are ONE decision

This has now broken the page three separate times, in both directions, and is worth stating as a
rule. A section's `isCard` (lexical) / `display.cardStyle` (Card) is only correct **relative to the
layoutGroup it currently sits in**. Moving a section between groups, or restyling a group, silently
invalidates every section inside it — and the failure mode is invisible text, not an error.

| When | What happened |
|---|---|
| First live build | Header group set to `darkSection`, which didn't exist deployed → resolved to `styles[0]` (white card) → `Dark` lexicals rendered white-on-white |
| After the canvas went dark | `clearCentered` bands became transparent over a dark canvas → default-ink sections rendered #2D3E4C on dark |
| After the collapse to one group | Everything moved into one `default` (white) group but four sections kept `Dark` → county Card, lede and the "How your plan comes together" heading all painted white on white (1:1) |

**Check on every restructure:** for each group, is the surface light or dark, and does every section
inside it use the matching ink? A contrast sweep in the console is the fastest way to catch it —
it found all four failures in one pass.

### Review + repair pass (`rescue_home_v6.mjs`)

Repaired: county Card `cardStyle` cleared; lede → #2D3E4C / #37576B; "How your plan comes together"
heading → default ink; eyebrow → #37576B (amber measured **1.99:1** on white, too low for 14px —
amber survives only on the large decorative numerals).

Also raised the element-card dataset lines from #6D96AE (**2.96:1** at 12px) to #37576B (5.4:1).
#6D96AE is too light for small text on *any* surface in this theme — it was rejected on the dark
band for the same reason.

Structure: the page is now a single ~940px white card. Rather than force it back into three bands,
added a hairline `border.top` above the two section headings (inner offset carried on the `bg`
string, `bg-transparent pt-6`) so it still reads as identity / elements / data.

**Verified:** 51 text elements swept; all pass WCAG AA except the four amber numerals.

### Open design decision — the amber numerals

30px #EAAD43 on #F3F8F9 measures **1.86:1**, failing even the 3:1 large-text threshold. Not changed
unilaterally because they are ordinal decoration (the card titles carry the meaning) and amber is
the brand's only accent, with no darker token in the palette. Two ways out: add a darker amber token
for use on light surfaces, or set the numerals in ink and keep amber for dark bands only.

### Remaining deltas vs the mockup

| Delta | Cause |
|---|---|
| No dark header band | See above — theme deploy or pattern override needed |
| **Actions reads 61, not 475** | Filter is `geoid_juris = 36105` (county-**led**). No `like` operator; `county='Sullivan'` → 0. Needs an `IN` over the 23 jurisdiction geoids or a `county_geoid` backfill |
| No unit line under each count | A column's `description` renders **inside the header span** (`Card.jsx:569`), i.e. above the value. Rendering below would need a `valueDescription` — a small Card enrichment, not a page fix |
| Element numerals not large/amber | The cards are lexicals; the numeral rides in the h3 text ("1 · PLANNING PROCESS"). No per-block styling inside a lexical |
| Card radius 8px not 12px | Section chrome uses `rounded-lg` |

## Page structure

Superseded by the Revision 6 table above. Historical structure (after revision 2):

| Band | Section | Size | Content | Varies per plan? |
|---|---|---|---|---|
| header (unboxed) | county-identity (**Card**) | 2/3 | Eyebrow · county name from `DHSES_County_Database.county` (displaySM + amber underline) · FIPS + jurisdiction count · three-paragraph narrative | county name + FIPS only |
| header | plan-elements | 1/3 | "How your plan comes together" — the four 44 CFR elements as a numbered panel, each with its feeding datasets | no |
| content | plan-data | 2/3 | Six datasets, name + total only | values only |
| content | destinations | 1/3 | Plan Data · Actions workspace · Export | no |

Nothing on the page needs re-authoring for a different county.

## Data — all measured, none invented

Live pulls 2026-08-06 / 2026-08-10 (view ids in `admin-forms-insights.html`'s header comment):
Actions county-led 61 · HoC 374 assessments / 90 flagged (52 high · 26 med · 12 low) ·
Participation 29 meetings / 21 this year / 49 hours · Roles 79 (35 mitigation reps · 5 floodplain
admins · 4 NFIP coords) · Capabilities 320 of 3,077 statewide · Dams 306 (247 A · 33 B · 14 C).

Established in this design system from the same source: 475 actions across 23 jurisdictions ·
county priority unset on all 475 · no action carries a site coordinate (472 on 26 centroids) ·
per-jurisdiction counts (Fallsburg 30, Rockland 27, Callicoon 25, Bethel 25, Woodridge 23,
Sullivan County 61).

**Deliberately absent: plan adoption / approval / expiry dates.** Never measured, and inventing a
lifecycle status is exactly the decoration this redesign removes. If Home should show plan
lifecycle, those dates need a real source first.

## Token discipline — corrected from the previous pass

Every text size on this page is one **declared** in `design-system/theme.html`:
**36 · 30 · 24 · 20 · 16 · 14 · 12**. Verified by regex sweep over the file.

This is a deliberate correction: `admin-forms-insights.html` shipped `text-[26px]`, `text-[11px]`
and `text-[20px]` for card titles — none of which are declared tokens — which is what made the
live implementation impossible to match exactly. See the token-vocabulary finding in
[`mny-admin-forms-hub-redesign.md`](./mny-admin-forms-hub-redesign.md).

Grid: the documented 12-col sectionArray (`grid-cols-6 md:grid-cols-12`), every section on a
documented size key (2 · 2/3 · 1/3), `p-2` section gutter.

## Files

- [x] `src/themes/mny/design/pages/admin-home-v2.html` — new. Named `-v2` so the 2026-07
  `admin-home.html` is not overwritten.
- [x] `src/themes/mny/design/ds-nav.js` — added to the `Admin Panel` section and made its landing.
- [x] `src/themes/mny/design/README.md` — folder map + section table.

**Note:** the README's folder map had lost the earlier `admin-*` entries (reverted outside this
session); all five admin page entries were re-added, not just this one.

## Verification

- [x] Renders at 1600px, 1280px and 1000px, no horizontal overflow
- [x] All internal links + assets resolve
- [x] Only declared token sizes used (12/14/16/20/24/30/36)
- [x] **Live build** on page 2379993 — 13 draft sections, all data verified rendering
- [x] Add a `darkSection` style to `admin.theme.js` — done (uncommitted working change), together
      with a `Dark` `dataCard` style in `mny/theme.js` so the county Card is legible on it
- [x] **Mockup redrawn inside the real admin shell** (revision 6) — 908px canvas, no TopNav,
      sidenav to scale, no band splits, no `rowspan`
- [x] **Rebuild page 2379993 against revision 6** — done, 19 draft sections (2383872–2383890),
      three groups, no `rowspan`, verified in the live DOM
- [x] **Fix the header ink mismatch** — done; band 1 is `clearCentered` with all `Dark` markers
      cleared, so the header is legible
- [ ] **Decide how the dark header band ships** — deploy the working-tree `darkSection` /
      `Dark` dataCard theme changes, or store a pattern-level `layoutGroup` override on 566466
      (must restate all six existing styles). Then flip band 1 back to `darkSection` + `Dark`
- [ ] **Fix or relabel the Actions tile** — live shows 61 (county-led, `geoid_juris = 36105`), the
      design specifies 475 countywide. Needs an `IN` over the 23 jurisdiction geoids, or a
      `county_geoid` backfill
- [ ] Human visual pass
- [ ] Decide whether Home should carry plan-lifecycle status (needs a real date source first)

## Correction to an earlier note in this file

An earlier revision claimed `src/themes/mny/theme.js` had **corrupt backslash `sizes` keys**
(`"1\2"` instead of `"1/2"`). **That was wrong** — a raw byte check shows `2f` (forward slash) in
every key; the backslashes were an artifact of how the search tool rendered the line. There is no
bug to fix, and `size: '1/2'` / `'2/3'` are correct values to author against.
