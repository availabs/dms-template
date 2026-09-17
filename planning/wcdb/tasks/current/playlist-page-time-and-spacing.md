# WCDB public + admin pages — playlist, home stats, station info spacing

**Project:** WCDB · **Topic:** content / themes · **Status:** IN PROGRESS (phase 1 published 2026-09-12; phase 2 in draft) · **Started:** 2026-09-12

## Objective

Fix the public `/playlist` page (app `wcdb`, pattern `wcdb_main`, page id 1958600) so the
time column shows station-local (Eastern) time instead of UTC, and give the spin rows the
breathing room the public design (`pages/spins.html`) has.

## Current State

- The row card (draft section 1969026, published 1967419) formats the timestamp **in SQL**:
  `to_char(received_at, 'HH24:MI') as played_at` and `to_char(received_at, 'Dy DD Mon') as
  played_on`. `to_char` on a `timestamptz` renders in the Postgres session zone, which on the
  hosted server is UTC — so at 4:24 pm EDT the newest spin read `20:10`. Exactly the 4-hour
  offset reported.
- Rows use the `adminRow` card style: `min-h-[52px] py-2`, built for the dense admin spin log.
  Two-line rows (title + meta beside a 44px cover) sit at the minimum with ~4px of air.
- The time and date cells occupy only grid row 1, so they hug the top of each two-line row.
- `rowMeta` was 9px mono — below the design system's 10px floor.

## Changes

1. **Content (draft sections, via the DMS CLI — not published):**
   - Both calculated columns now convert first: `received_at AT TIME ZONE 'America/New_York'`
     (the same zone `data-types/now_playing/showResolver.js` uses for the schedule).
   - Time format `FMHH12:MI am` → `4:10 pm`, matching the site's lowercase-meridiem
     convention (`formatTime`, `nowIndicator`) instead of 24-hour.
   - Time and date cells get `cellRowSpan: 2` so they centre against the two-line track cell;
     the `row2_spacer_spins` static column is gone and `track_meta` drops its `cellSpan: 2`.
   - Tracks template `58px → 64px` for the time column in both the row and header sections
     (`12:10 pm` needs the room); `cellsRowGap: 2` between title and meta.
   - `cardStyle: 'spinRow'` on the row section, `cardStyle: 'spinHeaderRow'` on the header strip.
   - **Removed `cardsPadding: 0` from both sections.** The Card emits that key as inline
     `padding: 0px` on the cells grid — the same element the theme's `subWrapperCompactView`
     classes land on — so `adminRow`'s `px-6 py-2` had never applied here; `min-h-[52px]` was
     the only thing giving the rows any height, and the text sat flush against the card edge.
     With the key gone the theme gutter (`px-6 py-4`, `max-md:px-4`) is what renders.
2. **Theme (`src/themes/wcdb/wcdb_theme.js`):**
   - New `dataCard` style `spinRow` — `adminRow` at the public rhythm (`py-4`, `min-h-[68px]`,
     same `px-6` so the fused `adminHeaderRow` strip still lines up).
   - New `spinHeaderRow` (= `adminHeaderRow` + the mobile rule below).
   - `SPIN_MOBILE_TRACKS`: below `md` both styles re-track to `60px 40px 1fr`, tighten the gap,
     and hide the 4th cell (the PLAYED date) — the design's own move for secondary columns at
     narrow widths. Without it a 390px phone left ~70px for the title and it wrapped per word.
   - `rowMeta` 9px → 10px.

## Files

- `src/themes/wcdb/wcdb_theme.js`
- DMS content: sections 1969026 (rows), 1969025 (header strip) — drafts on page 1958600.

## Testing Checklist

- [x] Draft (`/edit/playlist`) newest row read `4:27 pm` at 16:27 EDT on 2026-09-12 (was `20:27` on the published page at the same moment).
- [ ] Date column agrees with the local date around midnight ET (UTC rollover no longer leaks).
- [x] Header strip TIME / TRACK / PLAYED columns align with the row cells (Playwright screenshot, 1440px).
- [x] Time and date sit vertically centred on the two-line row.
- [x] 390px: three columns, date hidden, title/meta read in full (Playwright, `/edit/playlist`).
- [x] Row gutter really renders: computed `padding-left` 24px desktop / 16px phone (was 0).
- [ ] Admin spin log (`adminRow`) unchanged apart from the 1px `rowMeta` bump.
- [ ] Human publishes the Playlist page (`dms page publish` or the admin UI).

## Phase 2 — show-block navigator (2026-09-12, DRAFT)

**Ask.** Show the current show at the top of the playlist; back/forward buttons to step through
previous shows (forward only when the block is over); when nothing is scheduled, 2-hour
automation blocks; the playlist always within the selected block's time bounds.

**Mechanism (page variables, not a bespoke list).**
- New theme-shipped section `ShowBlockNav` (`src/themes/wcdb/ShowBlockNav.{jsx,config.jsx,theme.js,utils.js}`,
  registered in `wcdb_theme.js` `pageComponents` + `showBlockNav` theme key). dataWrapper-bound to
  the schedule source 10 / view 22 joined to shows (9) and DJs (8) — the same binding as the on-air
  card minus its time filter — with `pageSize: 500` so it sees the whole week.
- It maps an instant into STATION wall-clock week-minutes (`America/New_York`, day 0 = Monday),
  finds the airing containing it, else cuts the gap since the previous show's end into
  `blockMinutes` (120) slices capped at the next show's start; with no schedule the slices align to
  the clock. Block edges are converted back through wall-clock so DST days stay 4–5 pm.
- It PUBLISHES the block as two page variables, `from` / `to` (second-precision ISO UTC), via
  `updatePageStateFilters`. Registered on page 1958600: `filters: [{searchKey:'from'…},{searchKey:'to'…}]`.
  The selected block is "the block containing `from`" (or now when absent) — so the URL is the
  state, prev/next just publish the neighbour block, and a hand-typed `from` snaps to its block once.
- The spins card (draft 1969026) gained two leaves: `received_at gte {from}` and `received_at lt {to}`
  (`usePageFilters: true`); defaults 1970/2100 so an unset variable is a no-op. `data: []` cleared.
- Section order in `draft_sections`: on-air, now-playing, "Spins." heading, "Recent spins" heading,
  **1969275 (ShowBlockNav)**, header strip, rows, footer note, footer.

**Verified live (Playwright, `/edit/playlist`, 2026-09-12 17:0x EDT).**
- Initial load → `?from=2026-09-12T21:00:00Z&to=…T23:00:00Z`, "ON AIR · Automation · 5:00 pm – 7:00 pm",
  1 row (5:01 pm). Prev → DJ Radio Rebel's Show 4–5 pm, 20 rows all 4:01–4:59 pm. Prev → The Other
  Side of Sir Walford 12–4 pm, rows 12:01–3:59 pm. Next → back to 4–5 pm. Next disabled on the live
  block. No console errors.
- Block arithmetic unit-checked in Node (`scratchpad/test-blocks.mjs` of the session): show match,
  automation slicing capped by the next show, Sunday 23:00–01:00 wrap into Monday, empty schedule,
  DST fall-back day.

**Known gaps / follow-ups.**
- The "Recent spins · Newest first" heading above the navigator is author copy and now reads a
  little redundant; left as authored.
- A block with no spins renders an empty list with no message — the Card has no empty-state text.
- Pagination: a 4-hour show can exceed the card's `pageSize: 50`; the pager still works.
- Not published — human publishes the Playlist page.

## Phase 3 — home "Right now" stats card (2026-09-12, DRAFT)

**Ask.** Better padding/layout on the home page's Right now card; commas on numbers over 1k.

**Found.** Stats Card (draft **1969002**, home page 1471789, fused under the "Right now" lexical
eyebrow 1969001). Three fixed `1fr` tracks of 64px display numerals overflowed the half-width column
at tablet sizes and on phones. Figures were unformatted (`2134`, `13786`). The band's inner spacing
came only from the default card style's 8px cell gutter.

**Gotcha learned the hard way.** A section's `padding` (`{top,bottom}` steps 0/2/4/6/8 from
`sectionArray.theme.jsx`; other values resolve to nothing) is the page GUTTER OUTSIDE the section's
box, not padding inside it — setting `top: "4"` opened a 16px seam of page background between the
eyebrow and the figures. Inner spacing for a fused band belongs on the card style (`statStrip`
`pt-4 pb-8 px-4`); the section keeps `top: "0"` to fuse and `bottom: "8"` for the gutter to the
next card (its original value; the original `top: "5"` was an invalid step that happened to mean 0).

**Changes.**
- Columns: `formatFn: 'comma'` on all three (`fnum` → `parseInt().toLocaleString()`; the leading
  space it emits is collapsed by the browser); `cellPaddingBottom: 8` so the band bottoms out at the
  mockup's 40px with `padding.bottom: "8"`.
- Display: `cardStyle: 'statStrip'`, `cellsTracksTemplate: 'repeat(auto-fit, minmax(180px, 1fr))'`
  (figures wrap instead of overflowing), `cellsGridGap 24`, `cellsRowGap 28`, `cellsPadding 0`;
  section padding `top: "0"`, `bottom: "8"`.
- Theme: new `dataCard` style **`statStrip`** — paints `bg-[var(--card-bg)]` (the section's own `bg`
  is a step darker), `px-4 pt-4 pb-8` — the eyebrow's measured 16px inset, the mockup's 28px
  eyebrow→figure gap (with the eyebrow paragraph's mb-3) and 40px floor (with the cells' 8px) —
  and `max-md:grid-cols-2!` for a 2-up phone grid. `statValue`
  gains `max-md:text-[44px]`; `statLabel` gains `mt-2` (the mockup's figure→label gap).

**Verified (Playwright, `/edit/home`).** `2,134 · 49 · 13,786` at 1440 / 1024 / 390. 1440: three
across; 1024: 2 + 1 wrapped; 390: 2-up at 44px. Eyebrow and figures share a left edge (measured,
x=761 both); a pixel trace down the card shows one continuous surface, no seam. Draft only — human
publishes the Home page.

## Phase 4 — the ADMIN playlist (`/admin/playlist`, pattern `station_admin`) (2026-09-12, DRAFT)

**Ask.** Same as the public page: station-local times, the row gutter, and the log confined to
the show / 2-hour automation block with prev/next.

**Access.** `station_admin` is readable only by the `wcdb Admin` group; the CLI's dev account was
added to it by the user on 2026-09-12 (before that `page list --pattern station_admin` returned
nothing at all — no error, just an empty list).

**Two write paths, both done.**
- `scripts/wcdb-admin/seed-wcdb-admin-pages.mjs` (+ `lib.mjs`) — the SOURCE OF TRUTH for a re-seed:
  `PLAYED_AT` converts with `AT TIME ZONE 'America/New_York'` (24-hour kept, per the admin design);
  `listCard` grew `nav` (a section inserted between title and header strip) and `rowGutter` (leave
  `cardsPadding: 0` off the rows AND the header strip — it zeroes the theme's `px-6 py-2`);
  `showBlockNav()` builds the navigator bound to schedule VIEW 22 ⋈ shows ⋈ DJs; `BLOCK_LEAVES` /
  `BLOCK_PAGE_FILTERS` add the `from`/`to` range. Time, art, source and Edit cells `cellRowSpan: 2`,
  spacer column dropped. Title sub-label "Newest first" → "By show".
- `scripts/wcdb-admin/upgrade-playlist-log.mjs` (new, idempotent, `--dry-run`) — applies the same
  to the LIVE drafts without wiping the other pages. Ran 2026-09-12: log card 1965754, header
  1965753, title 1965752, new navigator **1969285** on page **1964337**; `from`/`to` registered
  alongside `queue`. Gotcha: `section update` has no `--pattern` flag (create/delete do).

**Verified (Playwright, `/admin/edit/playlist`).** Initial → automation 5–7 pm, rows 17:01–17:44
(station time; was 21:xx). Prev → DJ Radio Rebel's Show 4–5 pm, 20 rows 16:01–16:59. Row padding
computes to `8px 24px` (was 0). Queue segment control still ANDs with the block. Console shows
pre-existing warnings only (duplicate keys; a `show` prop reaching the DOM from an admin cell type).

**Open.** The navigator is pinned to schedule view 22; the ScheduleGrid's publish repoints
`wcdb_main` sections only, so a schedule publish must bump `PUBLIC_SCHEDULE_VIEW` in the seed and the
view in `upgrade-playlist-log.mjs` (or the grid's publish should learn to cover `station_admin`).
Draft only — human publishes: `dms page publish playlist --pattern station_admin`.

## Phase 5 — admin playlist header/review-bar rework (2026-09-12, DRAFT)

**Ask.** Move the "Detected automatically … / Needs review · All" bar below the list and pad its
buttons (they sat on the card border); move `+ Add a song` to where `Public spin log →` was and
drop that link.

**Done (seed + `upgrade-playlist-log.mjs` steps 6–7, applied to the live drafts).**
- Bands reordered: Header › Log › Review queue › modals. The Header band is the title lexical alone
  (size 12); the action Card 1965749 moved into the Log band beside the title lexical 1965752 (8 + 4),
  taking the card's top-right corner (`border top+right`, `radius tr`, `height: fill`), `cardStyle:
  'plain'` (the default style painted a stray rounded panel behind the button) and `cardsPadding:
  '24px 24px 0 0'` so it sits on the title's line, 24px in from the border. Title lexical rebuilt
  without the `metaLink` item (two-column layout container).
- Review pills (Card 1965751): a static `pill_spacer` column takes the `1fr` track so both pills sit
  together at the right; `cardsPadding: '0 24px'` + `cardStyle: 'plain'`.
- `headerAction()` in the seed gained a `padding` arg and `plain`; `listCard()` gained `action`.

**Verified (Playwright, `/admin/edit/playlist`, 1440).** Title text and button text share a centre
line (y 220 both); title 25px from the left border, button ~25px from the right; pills 8px apart and
25px off the border; no `Public spin log` text on the page. Draft only — human publishes.

## Phase 6 — admin log: navigator + action as the card's top row (2026-09-12, DRAFT)

**Ask.** The "Tonight · By show" row read as redundant beside the navigator; remove it, keep
`+ Add a song` to the right of the navigator, navigator at half width.

**Done (seed `listCard({ title: null, nav, action })` + `upgrade-playlist-log.mjs` step 8).**
- Title lexical 1965752 DELETED (`section delete --page --pattern`).
- Navigator 1969285: size 6, `height: fill`, top-left corner (`border top+left`, `radius tl`,
  section padding top 6 = the card's outer gutter), and a new authorable **`inset`** display key on
  `ShowBlockNav` (inline CSS padding; `'24px 24px 12px 24px'` here) because its theme padding is tuned
  for sitting under a list title and a section's `padding` is the outer gutter.
- Action Card 1965749: size 6, `cardsPadding: '41px 24px 0 0'` so the button centres on the
  navigator's show-name line (measured: title 224–251, button 224–244 before the 3px nudge).

**Verified (Playwright, `/admin/edit/playlist`).** Two 600px halves, `Tonight` absent, button on
the show-name line. Draft only — human publishes.

## Phase 7 — author-set section widths did not take (library bug) (2026-09-12, FIXED)

**Report.** After removing the top padding on the two top sections the user set their widths in
the section menu and nothing changed — both rendered full row.

**Cause (library, `src/dms`).** `sectionMenu.jsx` built the Width / Row span / Border / Padding /
Shadow controls from `getComponentTheme(theme, 'pages.sectionArray')` — the DEFAULT style — while
`sectionArray.jsx` renders with the band's style (`group.theme`). WCDB's `content`/`header`/`admin`
styles replace `sizes` with a 12-column map keyed `"1"…"12"`; the menu offered the library's
fractions (`1/3`, `1/2`, `2/3`, `1`), which matched nothing at render and fell back to `defaultSize`
(`12`). Both sections had been set to `"1/3"`.

**Fix.** `sectionArray.jsx` passes `group` to `SectionEdit`/`SectionView`; `section.jsx` hands
`sectionArrayStyle: group?.theme` to the menu; `sectionMenu.jsx` resolves all seven lookups with it
(and shows the style's `defaultSize`). Tracked in `src/dms/planning/tasks/completed/section-menu-uses-band-style.md`.
Verified live: the admin band's Width menu lists 1…12 with 6 checked (screenshot). The two sections
were reset to `size: "6"` via the CLI; their `padding.top: "0"` (the user's edit) was left as set —
restore `top: "6"` on both for the original 24px gutter above the card.

## Phase 8 — delete a track from the Fix modal; branded, right-aligned form buttons (2026-09-12, DRAFT)

**Ask.** A DJ can delete a track from the edit popup; the buttons in the Add and Fix dialogs are
right-aligned and padded.

**Library (`src/dms`, see `planning/tasks/completed/card-allow-delete-and-form-action-row.md`).**
The dataWrapper (`removeItem`), the client API (`requestType: 'delete'` → `uda.data.delete`) and
the server (`deleteExternalRow`) already deleted rows; the Card had no button. Added
`display.allowDelete` (two-step Delete → Confirm/Keep, no native dialog), `deleteItemLabel`,
`closeModalOnDelete`, a `delete_publish` provider, per-button theme classes (`formSaveButton`,
`formCancelButton`, `formAddButton`, `formDeleteButton`, `formDeleteConfirmButton`), and
`col-span-full` on the two action-row wrappers so `justify-self-end` is the CARD's right edge
(on the 2-column forms it used to be the middle).

**Theme.** wcdb `dataCard` styles[0]: the action rows get `pt-6 pr-2 pb-2`; save/add = the brand's
white pill, cancel = ghost, delete = ghost that turns the station red on the confirm step.

**Content (seed + `upgrade-playlist-log.mjs` step 9).** Fix modal Card 1965759: `allowDelete`,
label "Delete track", `closeModalOnDelete: 'edit_song'`, provider `delete_publish → song_added`
(the log's existing refetch key). **Found along the way:** the Fix card's rows carried NO `id` —
it selected only its six display columns, so `item.id` was undefined (which also means the
live-edit save had nothing to key on). Added `{ name: 'id', show: true, selectOnly: true }`, the
same trick the log card uses for its Edit action.

**The real blocker (found 2026-09-12 evening).** The Delete button still did not render after the
`id` column was added, because the row STILL had no `id`: `getData.js` requests an `id` attribute
for an external source only when the SECTION's `externalSource.isEditable` is true — and its else
branch strips an author-requested `id`. The dataWrapper gates `updateItem` / `addItem` /
`removeItem` on the same flag. The seed's `pg()` binding never set it (the source picker sets it
at bind time; only the hand-rebound schedule Add card had it), so **16 admin write-cards had been
saving nothing**. All seven wcdb-dama sources carry `metadata.isEditable: true` (checked via the
graph). Fixed: `lib.mjs` `pg()` now sets `isEditable: true`; new
`scripts/wcdb-admin/flag-editable-bindings.mjs` (idempotent, `--dry-run`) stamped the 16 live
drafts (events 2, djs 1, dj_profile 4, shows 2, schedule 1, playlist 2, posts 2, administrators 2).
Every admin page now has a draft to publish.

**Not in this phase.** The review-pill counts do not subscribe to `song_added`; a delete updates
the log but not the "All · N" count until reload.

**Verified end to end (Playwright, `/admin/edit/playlist`, 2026-09-13).** Added a throwaway row
("ZZ Test Track (delete me)") through the Add dialog → it appeared in the log inside the live block
→ its row Edit action opened it in the Fix dialog → Delete track → Confirm → the row left the log
without a reload (`delete_publish → song_added`) and was still gone after a reload. No console
errors. Both dialogs' primary buttons now sit at the card's right edge (x 1408 of 1416) with the
dialog gutter; Delete track is a ghost pill that turns the station red on its confirm step.

**Also fixed (library).** The first-paint "Error getting length" on the playlist: blank `gte/lt`
range leaves reached Postgres before the navigator wrote `from`/`to`
(`src/dms/planning/tasks/completed/blank-comparison-leaf-guard.md`).

**Publish list.** Because of the editable-binding stamp, EVERY admin page now has a draft:
playlist, schedule, djs, dj_profile, events, administrators, posts, shows — plus the public
Playlist and Home drafts from earlier phases.

## Phase 9 — Station Info: fused department cards had seams (2026-09-13, DRAFT)

**Ask.** Odd padding gaps between sections meant to be one card; smoother padding overall.

**Cause.** Each department is a fused pair — header lexical (`border top+left+right`, `radius
tl+tr`) over a `tile` Card (`border left+right+bottom`, `radius bl+br`). The header carried
`padding.bottom: "2"`, and a section's `padding` is the page gutter OUTSIDE its box, so every
header opened an 8px strip of page background above its tiles. Card `padding.bottom: "6"` +
header `padding.top: "6"` also put 48px between departments (mockup `mb-3`, 12px).

**Fix (content, page 1506781 drafts, sections 1969044–1969055 + note 1969056).** Header
`padding {top: "4", bottom: "0"}`; tile card `padding {top: "0", bottom: "0"}` with the inner
spacing moved onto the card: `cardsGridPadding: "4px 24px 24px"` (tiles align with the header
text's inset, ~24px; bottom matches the mockup's `p-7` minus the tile grid gap). The note
lexical after the last card gets `padding.top: "4"` so it does not touch the card. Result: one
continuous surface per department, 16px between departments.

**Rule of thumb (this is the third time it bit).** Never give a fused section a bottom/top step
on the shared edge; put inner spacing on the Card (`cardsGridPadding` / `cardsPadding` / the
card style), and use section `padding` only for the gutter between cards.

**Follow-up (same day).** The role tiles' text sat on the tiles' left edge: the six tile cards also
carried `cardsPadding: 0`, which is emitted as inline `padding` on the element the `tile` style pads
(`p-5`). Key removed; tiles now have their 20px inset on all sides.
