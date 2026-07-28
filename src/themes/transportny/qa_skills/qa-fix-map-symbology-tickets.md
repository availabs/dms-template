# qa-fix-map-symbology-tickets — the map-layer colour/legend fix sub-process

A large share of Freight Atlas client tickets are **map symbology** complaints — a layer's
colour, opacity, legend, or bin labels. This is the repeatable process for them, learned on the
2026-07-16 Freight Atlas pass. Read alongside `qa-fix-ticket.md` (the T4 contract) and the core
skill `src/dms/skills/editing-map-symbologies.md` (the data model). Symbology edits are a **Data**
fix surface, not section-config — they go straight to the Map section's embedded
`element-data.symbologies`, so they're NOT owned by a page build script.

## 0. Which page is the client actually looking at? (do this FIRST)

Freight Atlas has had **two** `freight_atlas` pages and it is the #1 source of wasted work:
- **Sandbox copy** — pattern `2175436` (`freightatlas2_copy`), page **`2189762`** / map section
  **`2189767`**, served at **`freightatlas2.localhost`**. **This is what the gallery deep-links,
  the control-room ticket URLs, and the client see.** As of 2026-07-16 the sitemgmt automation
  tracks THIS (config row `2186151` → `pattern=2175436`, `subdomain=freightatlas2`).
- Production — pattern `1411749` (`freightatlas2`), page `1411761`, served at
  `freightatlas.localhost`. Raw/unstyled; **retired** in favour of the sandbox. Tickets that are
  really about `1411761` get **Closed** (owner call, 2026-07-16).

Confirm the target by matching the client's description to the live paint (below) before editing.
`draft_sections[0].id === sections[0].id` on these pages — the draft row **is** the published row,
so a section edit is live on the view immediately (no publish; no guardrail issue).

## 1. Reproduce + verify (headless, on the view)

The published view honours `?layers=<symbology_ids>` when the section has `shareableState:true`.
```
node scratchpad/npmrdsv5-dev2/fa_qa/shot_layers.mjs <tag> <ids> freightatlas2   # view
```
Screenshot the map + legend and LOOK. The map's own `?layers=` read is view-only, so on pages
where draft≠published you verify on `/edit/<slug>?layers=` instead (needs a fresh storageState).

**Attach the after-screenshot to the ticket** (proof for the reporter) once the fix verifies —
`tools/attach_screenshot.mjs --ticket <row_id> --image <shot.png> --caption "<layer> after fix"`
(see qa-fix-ticket.md step 3). Capture the layer clean (its `?layers=<id>` only) so the shot shows
just the fixed layer.

## 2. Read the current paint before deciding the fix

`fa_qa/dump_fa_symbologies.mjs <pageId>` lists every symbology's id/name/paint/legend. For a
categorical/choropleth, dump the full layer (paint expression + `legend-data` + `interactive-filters`).
Map ticket → symbology by NAME. **Read the client's `description`, not the breadcrumb title** — the
titles are just gallery navigation; the real complaint (and the right fix) is in the body.

## 3. Fix on the section's embedded symbologies (read-modify-write)

Reuse the helpers/tokens in `scratchpad/fa-symbology-restyle/{fa_styles.mjs,restyle_symbologies.mjs}`.
A surgical, whitelisted patch (`fa_qa/fix_symbologies.mjs` is the worked example) beats re-running
the full restyle — the full restyle over-touches and re-introduces regressions. Back up the section
first, dry-run, then `dms raw update <sectionId> --data <file>`.

## 4. Gotchas that generated tickets (all real on 2026-07-16)

- **`recolorCategorical` assigns colours POSITIONALLY** → it gave "Last Mile" the darkest colour
  and "National" a pale one (backwards by importance). Map categories to colours **by key**, not by
  position (ticket #150).
- **A wide casing sub-layer paints a colour absent from the legend.** STRAHNET's `layers[0]` casing
  was purple and wider than the match-coloured main line → "map colours don't match legend". Set the
  casing to width 0 or a neutral shade (#154).
- **`legend-data` is dumb and drifts from paint.** NFHN's legend had two orange rows and mislabeled
  every colour; rebuild `legend-data` FROM the match/step expression (#151, #141, #143).
- **Choropleth bin labels are off-by-one vs the step edges.** `["step", x, c0, b1, c1, …]` colours
  `c0` for `x<b1`; label it `0-b1`, not `b1-b2` (#142). Merge consecutive identical colours into one
  `≥` row (#143).
- **A near-transparent boundary fill "disappears under other layers."** Raise `fill-opacity`
  (~0.2) and make the boundary line solid + ≥2.5px (#137).
- **An always-on default layer looks like "unexplained roads" on every deep-linked figure.** The FCHN
  (`2100222`) was the only `isVisible:true`; a client deep-linking one figure saw it as phantom roads.
  Set default layers `isVisible:false` (+ each sub-layer `layout.visibility:"none"`); the figure whose
  `?layers=` names it re-enables it (#140).
- **Stray sub-layers bundled inside a symbology** (a yellow line + a black `opacity:0` fill inside the
  Dairy Cow choropleth) render junk + junk legend rows. Drop them, keep the data layer (#140/#141).
- **`facility`/point circles at low opacity read as the wrong colour.** Border Crossings were the
  right hex (#1F3F8F) at `circle-opacity:0.35` → "hard to see / wrong colour". Opacity 1 + white
  stroke (#2191410).

## 5. When to park instead of fix

- Palette *preferences* on a functional layer (road functional-class colours) → **Needs decision**
  (colours are load-bearing; #139).
- Missing/miscategorised source rows (an airport absent from the data) → **Needs data** (#148).
- Complaint that doesn't match any live layer (rail "P"/"D" categories that don't exist) →
  **Needs decision**, ask which layer (#149).
- Theme-level behaviour (in-page-nav rail scroll) or core map interaction (can't deselect the active
  layer) → **elevate**; not a symbology/data fix (#129, #2190960).

## 6. Gotcha: reading split-table datasets over the UDA route

Column selects use **single quotes**: `data->>'col' as col`. Double quotes
(`data->>"col"`) are a Postgres *identifier* → `column "col" does not exist`. (Cost ~20 min on
2026-07-16.) Not every internal source is readable the same way; when in doubt reuse
`cr_sync.mjs`'s `readRows`.
