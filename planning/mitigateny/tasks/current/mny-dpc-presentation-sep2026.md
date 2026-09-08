# MitigateNY DPC Presentation, September 2026 (county-facing)

**Project:** MitigateNY · **Topic:** content · **Status:** **ARTWORK UNCROPPED 2026-09-08** —
19 slides; the seven dark slides now carry whole illustrations; two brief items still blocked on
credentials · **Started:** 2026-09-04

## Objective

Build a county-facing introduction to MitigateNY for the Disaster Preparedness Commission
Conference, implementing `MitigateNY_DPC_County_Presentation_Memo_v3.docx` (Corrina Kruger, DHSES)
as the controlling brief while staying true to the `mny` design language.

## Deliverable

`references/mny-presentation/MitigateNY DPC Presentation September 2026.pptx` — 19 slides, 16:9,
36.9 MB, speaker notes throughout. The working folder is **git-ignored**; the build is reproducible
from `references/mny-presentation/build/`:

| File | What |
|---|---|
| `build_dpc2.py` | the deck |
| `dpc2_lib.py` | slide grammar (chrome, self-sizing cards/grids/list panels, shotcards, dividers) |
| `fit.py` | text measurement against the real font files; the overflow guard |
| `prep_art.py` | **superseded** — cut the isometric artwork out of page captures into square tiles |
| `render.ps1` | renders every slide to PNG for review |
| `shoot2160.cjs` + `targets_dpc.json`, `targets_sullivan.json` | screenshot capture |
| `README_DPC.md` | deck map, grammar, artwork and screenshot curation record |
| `assets/shots2160/` | 42 captures at 1920 × 2160 · `assets/art_full/` 7 trimmed illustrations |
| `build_dpc.py`, `dpc_lib.py` | **superseded** first build, kept for reference; writes to its own filename |

`lib.py` (palette, type, primitives, topoline grounds) is reused unchanged from the leadership
deck, so both decks share one brand implementation.

## The core reframe

The leadership briefing showed DHSES leadership what New York had built. This deck turns that
outward: the State built it for counties. Four sections, carried in a persistent rail:
**01 Why it exists · 02 The platform · 03 Actions · 04 What happens next.** Actions is the centre
of gravity (slides 10 to 16).

## The distillation pass (second build)

The first build followed the brief literally: six regions a slide, up to 150 words, a card for
every point. Reviewed at full size it was too dense to present from, and card copy ran past the
bottom of its boxes on most slides. Rebuilt as `build_dpc2.py`:

| | v1 | v2 |
|---|---|---|
| Slides | 23 | 19, of which 7 carry almost no reading |
| Regions per content slide | up to 6 | 4 |
| Words on a content slide | 114 to 153 | 53 to 103, chrome included |
| Text running past its card | on most slides | structurally impossible |

The deck is now an outline with room in it: it states the point and shows the screen, and the
argument is Corrina's to make out loud. Everything cut moved into speaker notes rather than being
lost. Cut wholesale: the shared-architecture three-column diagram, the six-step county workflow,
the risk-to-strategy-to-action chain, the requirements-built-in comparison, the municipal-value
slide, the single-source-of-truth loop, and the longer-term-role slide.

## No type outside a box, enforced by the build

The overflow defects in v1 were a symptom of hand-guessed box heights. `fit.py` now measures every
string against the real font file (Segoe UI; Bahnschrift with its `SemiBold Condensed` variation)
before it is placed — wrapping at the box width, counting lines, multiplying by the font's own line
height. Panels take their height *from* that measurement. `fit.assert_fit` records anything given
less room than it needs and the build **refuses to save** if the list is non-empty, naming the box
and the shortfall. An overflow can no longer reach the file, and editing copy is safe.

Card copy, screenshot captions and takeaways all sit inside a filled panel; only the eyebrow,
title and deck line sit on the slide ground.

## Artwork: breadth of the site, not four identical screenshots

v1 leant on page captures that all looked alike — same left nav, same isometric hero band. The
seven dark slides — title, four section slides, the demo slide and the closing slide — carry the
site's own isometric illustrations instead.

## Whole illustrations on the dark slides (2026-09-08)

The distilled build got those illustrations by cutting them out of the page captures
(`prep_art.py` → `assets/art_tiles/`) and then fitting each square tile into the tall right-hand
panel with `mode='cover'`. Cover crops, so every one lost its sides and read as a zoomed detail
rather than a place: half a mountain on the title slide, a church with its clock tower cut off, a
market stall sliced down the middle.

The dark slides now place the source illustration **whole**, straight from
`references/mny-presentation/MNY Planning Images/` (already reachable as `lib.ART`):

- `dpc2_lib.full_art` trims a source PNG to its alpha bounding box and caches it in
  `assets/art_full/`. The sources are 2600 x 2200 canvases with the artwork in the middle of a
  wide transparent margin, so fitting one untrimmed would size the margin, not the artwork, and
  land the picture small and off centre.
- `dpc2_lib.hero_art` fits it inside `HERO` — the zone right of the accent rule, `6.02" x 6.77"`
  at `x = SW - 6.02`, `y = 0.28` — with `mode='contain'`. Nothing is cropped. Most of the set is
  roughly square once trimmed, so it fills the full width of the zone and stands 5.3" to 6.8"
  tall; the one portrait piece (the tornado) fills the height and centres.
- The seven mappings: `mny-climate-change_02` (title), `mny-tornado_02` (01),
  `mny-local-planning_04` (02), `mny-whats-at-risk_02` (03), `mny-capabilities_01` (04),
  `mny-built-environment_01` (demo), `mny-people_03` (closing). Where the folder held two
  versions of one scene, the higher-resolution one is used — the same artwork at 2600 x 2200
  rather than 1024 x 1024.

`prep_art.py` and `assets/art_tiles/` are kept for reference; nothing in the build reads them now.
All 19 slides re-rendered and reviewed at full size.

Screen captures are now chosen for **visual difference** rather than page relevance: public home
page, hazard risk profile prose, a floodplain map, a county risk profile over an aerial photo, two
county home pages with their own seals and photography, the Actions database table, one action
record, the county dashboard and workspace, and the statewide choropleth.

## Screenshots at 1920 × 2160

`shoot2160.cjs` captures at viewport 1920 × 2160 at device scale 1, so each PNG shows one 1080
viewport plus the next 1080 below the fold. `shot(..., band=(f0, f1))` places an explicit vertical
slice, which is how the data slides skip a page's hero image and show the content underneath.

**Rejected:** all five Planning Guide captures and `delaware_draft` (sign-in wall); most Sullivan
county-template interior pages (empty placeholder boxes); Westchester 2026 interior pages (base-plan
prose not loaded yet, see [`westchester-2026-baseplan-crosswalk.md`](./westchester-2026-baseplan-crosswalk.md)).

## Two brief items not delivered

- [ ] **Planning Guide screenshots.** Behind a sign-in wall; needs prod credentials. Only the
      page bodies are missing: the illustrations those pages carry come from the source folder
      and are on the deck already.
- [ ] **The "roughly 60% pre-addressed" figure.** Permitted "only if current and defensible"; not
      verifiable against the current template at build time, so omitted.

## Brief compliance checks run

- **Prioritization QA.** Slide 14 presents the two lenses side by side; its takeaway reads "County
  priority is a companion lens, not a correction of the municipal one." No slide shows a combined
  score or a single ranking.
- **Voice QA.** Zero em dashes and zero en dashes, verified against the saved file. None of the
  proscribed jargon.
- **Design QA.** All 19 slides rendered to PNG and reviewed at full size. Layout defects found and
  fixed in this pass: the rail running under the divider artwork, the page number colliding with
  the rail, a squashed full-width county capture, six one-line cards floating in a half-empty band,
  and three stacks running past their content band.

## Next steps

- [ ] DHSES review of copy and slide order.
- [ ] Supply the closing element for slide 19 (deliberately left as a placeholder, per the brief).
- [ ] If credentials can be provided, capture the Planning Guide.
- [ ] Confirm or drop the pre-addressed-requirements figure.
- [ ] Optional: install Oswald and Source Sans 3 and switch `DISPLAY`/`BODY` in `lib.py` for exact
      brand type. The deck ships Bahnschrift SemiBold Condensed and Segoe UI so it renders
      correctly on any Windows machine with no font install. `fit.py` already maps both faces to
      their font files; a swap needs the new paths added to `fit.FACES`.
