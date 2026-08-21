# MitigateNY 1.0 site scraper (reusable)

> **Output goes to the git-ignored working folder.** Every `<outDir>` in this README is a path under
> `references/mny-transcribe/<county>/`, which is not committed — the scraped markdown is source
> material, not a deliverable. `node_modules/` is not committed either; run
> `npm install puppeteer-core` in this directory first.

Tooling + method for scraping a **MitigateNY 1.0** county Hazard Mitigation Plan
(`https://<county>.mitigateny.org`) into structured text, as the raw input for a 1.0 → 2.0
transcription. First used for **Delaware County** (`delaware/`).

> The 1.0 sites are the *old* AVAIL "Mitigation Planner" app (CRA/webpack build, Falcor model on
> `graph.availabs.org`). This is a **different app** from the 2.0 DMS platform (`dmsserver.availabs.org`)
> that the rest of `mny-transcribe/` targets. Don't confuse the two. The `dms` CLI does **not** talk to
> these 1.0 sites.

## TL;DR — run it (the Fulton-era, config-driven workflow)

```bash
# One-time: Node + a Chromium browser (Edge ships on Windows). No Playwright/Chrome needed.
npm install puppeteer-core                       # in THIS dir (package.json here pins type:commonjs)

# 0. Discover the taxonomy (hazards + jurisdiction dropdown) for a new county:
MNY_BASE=https://<county>.mitigateny.org node inspect_taxonomy.js

# 1. Write a <county>-config.json: {"county","base","fips","hazards":[...],"juris":[...],"missing":[...]}
#    (see fulton/fulton-config.json for the template, incl. dropdown-missing jurisdictions).

# 2. Scrape county sections + per-hazard + per-jurisdiction annex views (resumable):
MNY_BASE=https://<county>.mitigateny.org MNY_CONFIG=<county>-config.json \
  node scrape_all.js <outDir>/_raw-scrape

# 3. Scrape the per-jurisdiction "blue box" narratives (fresh browser each; edit the JURIS array
#    in run_blue_fulton.sh or copy it per county):
MNY_BASE=https://<county>.mitigateny.org bash run_blue_fulton.sh   # -> <outDir>/_raw-scrape/blue/

# 4. Assemble markdown. build_fulton.js is config-driven and emits the 3-file split
#    (main / hazards / annexes+index). Copy & adjust per county's output naming:
MNY_CONFIG=<county>-config.json node build_fulton.js <outDir>/_raw-scrape <outDir>
```

> **ESM gotcha (added Fulton run):** the repo root `package.json` has `"type":"module"`, which makes these
> `require()` scripts fail with *"require is not defined in ES module scope."* Fixed permanently by the local
> `package.json` here (`"type":"commonjs"`). Keep it.

> **Config over editing (added Fulton run):** `scrape_all.js` and `build_fulton.js` now read `HAZARDS`/`JURIS`
> (and county/fips/missing) from `MNY_CONFIG=<json>`, so you no longer hand-edit arrays in the scripts.
> `scrape_blue.js` still has the 18-hazard list inline (the taxonomy has been identical across counties so far).

Alternatively (old way) edit the `HAZARDS` and `JURIS` arrays at the top of `scrape_all.js` per county (discover them first —
see "Discover the taxonomy" below). `EDGE` path is set for Windows Edge; change for other OSes.

> **Git Bash gotcha (Windows):** a bare `/` or `/route` argument gets mangled into a `C:\...` path by
> MSYS. Prefix commands with `MSYS_NO_PATHCONV=1` when passing URL paths as argv.

## Why a headless browser (not the API, not WebFetch)

- The site is a **SPA**. `curl` / WebFetch get only the empty `#root` shell (`<title>Mitigation Planner</title>`).
- The backend is a **Falcor** endpoint (`https://graph.availabs.org/`) with a deep, custom data model
  (`plans.county.byId[...]`, hazards, scenarios, sections, hundreds of attribute keys). Reconstructing a
  readable plan from raw Falcor paths is far more work than rendering the pages the app already assembles.
- So: drive the real app in headless **Edge** via `puppeteer-core`, let it hydrate, scrape `document.body.innerText`.

## The three things you must know to drive the app

1. **Bootstrap on `/`, then navigate IN-APP.** Direct loads of sub-routes (e.g. `/planning-process`) throw
   (`Cannot read properties of null`). Load `/`, wait ~8s, then **click the top-nav `<a>`** by text
   (React-Router client nav preserves Falcor state). `/plan/*` and `/pdf` are dead ends (home shell / empty
   skeleton).
2. **Hazard switch = click `<li>` in `ul.main-menu`** (the left nav) by exact hazard text. Each hazard page =
   `"<Hazard> Characteristics"` (county narrative) + `"<County> - Local Impacts - <Hazard>"` (per-jurisdiction table).
3. **Jurisdiction switch = the top-nav `<button>`** whose text matches `\((County|Town|Village)\)`. Click it to
   open the menu, then click the item whose exact text is e.g. `"Walton (Town)"`. **Selection is global and
   persists across page navigations** — that's the "annex": the whole plan re-filtered to one jurisdiction.
4. **Per-hazard "blue box" = the authored jurisdiction narrative.** On the Hazards page, when a *specific*
   jurisdiction (not the county) is selected, each hazard the jurisdiction added local detail to renders a
   light-blue (`background: rgb(240,248,255)`, class `element-box`) box headed **`<Juris> Jurisdictional
   Annex`**, containing prose local impacts (flood histories, etc.). This is the richest per-jurisdiction
   narrative and the prime target for 2.0 annotation slots. Gotchas: (a) the whole page wrapper is *also*
   aliceblue, so filter on the **`<Juris> Jurisdictional Annex` heading**, not just bg color; (b) a heading-
   only node co-exists with the real box — pick the **longest** `div.element-box` match; (c) boxes appear only
   for hazards of local concern (absent otherwise). See `scrape_blue.js`.

Timing: allow **6–8s after every nav/click** for Falcor + charts to hydrate (`MNY_WAIT` env, default 7000ms).
Swallow `pageerror` and dismiss dialogs — the app throws benign errors and localStorage QuotaExceeded on the
big pages; content still renders.

## Site structure (what `scrape_all.js` captures)

Top nav → `Planning Process`, `Hazards`, `Risk`, `Strategies`, `About`. Output files:

| File | Content |
|---|---|
| `landing.txt` | Home dashboard |
| `county_planning_process.txt` | Planning context, teams, engagement, participants, meetings, maintenance |
| `county_risk.txt` | Purpose, vulnerability (social/built/critical/natural), problem statements, dev zones, previous actions, NFIP, dam safety |
| `county_strategies.txt` | Goals & objectives, capabilities (full table, all jurisdictions), integration, actions, **Proposed Actions table**, prioritization, NFIP, response |
| `county_about.txt` | Disclaimer, contacts, appendices list |
| `county_hazards_ALL.txt` | "All Hazards" dashboard + the complete **Local Hazards of Concern** table (every jurisdiction × hazard) |
| `county_hazard_<H>.txt` | Per-hazard county **Characteristics** narrative + that hazard's Local Impacts |
| `annex_<Juris>_hazards.txt` | Hazards page filtered to one jurisdiction (its local impacts) |
| `annex_<Juris>_risk.txt` | Risk page filtered to one jurisdiction |
| `annex_<Juris>_strategies.txt` | Strategies filtered to one jurisdiction (its capabilities, actions, implementation) |

## Discover the taxonomy before editing the arrays

The 18 hazards and the jurisdiction list are county-specific. To enumerate them for a new county, adapt
`inspect2.js` (kept in scratchpad during the Delaware run): bootstrap `/`, click `HAZARDS`, then read
`ul.main-menu li` texts (hazards) and open the county `<button>` and read the menu items matching
`\((Town|Village|County)\)` (jurisdictions).

## Gotchas / data hygiene

- **Every table row renders TWICE** in innerText — de-dupe when transcribing.
- **Unresolved geoids:** some rows show a raw geoid instead of a name (Delaware: `3620346` = **Village of
  Deposit**, which was also *missing from the jurisdiction dropdown* but present in county tables and the
  Planning-Process participant list). Cross-check the participant list; build any dropdown-missing annex from
  the county tables.
- Charts/maps render as axis labels / stray numbers in innerText — ignore; the narrative + tables are the signal.
- **Invent nothing.** Source placeholders ("No data found...", "Loading...", "Table X") get transcribed as
  "no data in source" notes, not filled in.

## Robustness lessons (learned the hard way on Delaware)

- **Edge crashes / "detached Frame" after ~14 jurisdictions in one long-lived browser** = memory buildup
  (falcorCache + charts). Fix: **fresh browser per jurisdiction** — use `scrape_one.js` in a shell loop, not
  the monolithic annex loop. `scrape_all.js` now also relaunches the page on error and **resumes** (skips any
  `annex_<J>_strategies.txt` already on disk; skips the county block if `county_hazard_Wind.txt` exists), so you
  can just re-run it until it finishes. But per-jurisdiction is the reliable path at scale.
- **Bootstrap flakiness:** use `waitUntil: 'domcontentloaded'` + a fixed sleep + a retry loop that confirms the
  nav rendered (`gotoHome()`), **not** `networkidle2` (the SPA polls forever and detaches the frame mid-load).
- **Click→render LAG corrupts sequential captures.** Clicking hazard N right after hazard N-1 swaps the section
  *header* before the *body* re-renders; a fixed 7s wait captured hazard N-1's stale narrative under hazard N's
  header (Delaware's "Flooding" file held Earthquake text). Fix: **stabilization polling** — re-grab every few
  seconds until the target section body is non-empty, unchanged across two grabs, **and different from the
  previous item's body**. See `scrape_hazards.js`.
- **QA every filtered capture.** Confirm each `annex_<J>_hazards.txt` Local-Hazards-of-Concern table contains
  exactly one community name (== the selected jurisdiction). A lagged capture shows the prior jurisdiction or the
  full county.
- **Late-batch blue-box false negatives (Fulton).** In a long `run_blue_*.sh` batch the *first* ~9 jurisdictions
  captured blue boxes fine but the *last* few came back empty — even though fresh-browser-per-jurisdiction rules
  out in-process memory buildup. Culprit: **orphaned `msedge` processes accumulate across launches** (each
  headless launch spawns ~9 helper procs; crashed runs leave them), starving later hydration so `getBlue()`
  returns `''` within the wait window. **Always sanity-check a suspicious all-zero tail by re-running those
  jurisdictions idle** (kill all Edge first: `Get-Process msedge | Stop-Process -Force`, then re-run one at a
  time with a longer `MNY_WAIT`, e.g. 11000). Fulton's Perth/Stratford/Oppenheim/Mayfield-Village were confirmed
  **genuinely** empty this way; don't record a zero until you've re-run it clean.
- **Kill Edge between big runs.** A `detached Frame` FATAL on *bootstrap* (not after 14 jurisdictions) means
  leftover Edge from a prior/parallel run. Kill all `msedge` before starting a fresh batch.

## Per-county structural differences (check these every new county)

The 1.0 sites share a codebase but the **data** each county entered differs. Confirmed on Fulton (2nd county):

- **Where the Local Hazards of Concern (HoC) ratings live varies.** On **Delaware** the per-jurisdiction HoC
  table populated in the *filtered annex view*. On **Fulton** that filtered widget returns **"Search 0
  Records"** (villages roll into towns), and the real per-jurisdiction HoC rows are only in the **county
  "All Hazards" table** (`county_hazards_ALL.txt`), keyed by community in 6-column tab rows. So `build_fulton.js`
  slices HoC from the county table for *every* jurisdiction (`hocFromCounty()`), and pulls **capabilities +
  actions** from the filtered `annex_<J>_strategies.txt` (those *do* filter correctly). **Verify per county**
  which source is populated before trusting either.
- **Trailing-tab strip bug (important).** innerText table rows whose **last column is empty** end in a tab.
  A naive `line.replace(/\s+$/,'')` eats that trailing tab and the row silently loses a column, so
  `tabRows(lines, 6)` matches **zero** HoC rows (empty Location Description is the common case). Fix = read
  table sources with a tab-preserving strip (`/[ \r]+$/`, see `readRaw()` in `build_fulton.js`); keep the
  space-stripping reader only for narrative.
- **Dropdown-missing jurisdictions recur and can be several.** Delaware had one (Village of Deposit). **Fulton
  has three**: the two **cities** (Gloversville, Johnstown — the dropdown had no `(City)` entries at all) and
  the **Village of Dolgeville** (appears only as unresolved geoid **`3620731`**; resolved via Census FIPS place
  36-20731). They participate fully (HoC + capabilities + actions in the county tables) but aren't selectable,
  so no filtered view and **no blue-box narrative**. List them in config `missing:[{display,geoidRe,capsFilter,
  resolvedNote}]`; `build_fulton.js buildMissing()` slices them from the county tables.
- **City token format is quirky:** `Gloversville city ( City)` / `Johnstown city ( City)` — note the **space**
  inside `( City)` and lowercase `city`. Any `isJuris` regex must be `/\(\s*(County|Town|Village|City)\)$/i`.
  There is also a separate `Johnstown (Town)` — don't conflate it with `Johnstown city`.
- **Bleed-through check:** Delaware's Flooding profile still named "Sullivan County" (seeded from Sullivan).
  Fulton's reads "Fulton County" correctly — but always spot-check hazard Characteristics for the wrong county.

### Hamilton (3rd county) — what it added / confirmed

Hamilton (`ham_*.js` here; output `references/mny-transcribe/hamilton/`) is small (10 jurisdictions + county, all selectable) and
introduced a cleaner, **config-driven** variant of the pipeline worth reusing:

- **County taxonomy lives in one file (`ham_config.js`)** — `BASE`, `HAZARDS`, `JURIS`, `EXTRA_HAZARD_PAGES`.
  All scrape/build scripts `require('./ham_config')` so you never edit script internals per county; just
  discover the taxonomy (`inspect_hamilton.js`) and write the config. Prefer this over editing arrays in
  `scrape_all.js`.
- **Concurrency orchestrator (`ham_run_annexes.js`)** replaces the `run_blue.sh` shell loop: spawns
  `ham_scrape_one.js` (annex views) + `ham_scrape_blue.js` (blue boxes) as **fresh-browser child processes**
  with a concurrency cap (used 3) and resume (skips existing outputs). 3 concurrent Edge instances scraped all
  10 jurisdictions with **zero crashes** — the per-jurisdiction fresh-browser rule scales fine in parallel.
- **Trailing-tab strip bug reconfirmed** (see Fulton note above) — `ham_build.js` `readLines()` uses
  `/[ \r]+$/`. Hamilton HoC rows nearly all have an empty Location cell, so with the naive `\s+$` strip
  `hoc` came back **0** for most jurisdictions. This is now the #1 thing to get right in any new build script.
- **Capture authored *county-level* Local Impacts, not just Characteristics.** Hamilton authored real
  per-hazard county prose (Flooding → a six-watershed description + a "Local Flood Impacts" event narrative).
  `ham_build.js buildHazards()` slices `"<H> Characteristics"` → `- Local Impacts -` (Characteristics) and
  then `- Local Impacts -` → first auto-gen marker (`HAZ_END` = `Built Environment Table` / `Critical
  Facilities Table` / `- Local Hazards of Concern Table -` / `Search N Records`) for the authored Local
  Impacts. Delaware/Fulton dropped this because theirs was data-only — **check per county.**
- **"DOWNLOAD CSV" = auto-generated table signal.** `toMarkdown()` now buffers each tab-table and, if any
  cell contains `DOWNLOAD CSV`, collapses the whole table to an omitted-note instead of rendering its mangled
  vertical header (the inventory/critical-facility widgets). Clean, generic, reusable.
- **County-wide master HoC table** (`county_hazards_ALL.txt`, 66 rows for Hamilton) is authored interview
  data — `ham_build.js` emits it as a proper 6-col table in the Hazards Overview (header supplied manually;
  the source renders column names vertically).
- **Three-file output** (`hamilton-lhmp-v1.md` / `-hazards.md` / `-annexes.md` + `jurisdictional-annexes/*.md`)
  vs Delaware's single main file — `ham_build.js` is the template if a county wants hazards/annexes split out.
- **Same 18-hazard taxonomy** as Delaware; **Dam Failure** again on the Risk page + "Other Hazards" (not a
  profiled hazard). "Other Hazards" also held authored **Ice Jams** (Hope) and **Dam Failure** (Inlet) prose.
- **No bleed-through** (Characteristics correctly say "Hamilton County"); **no dropdown-missing jurisdictions**
  (all 10 selectable — Speculator is the only village; NY villages nest in towns).

### Allegany (4th county) — the big, crash-prone one

Allegany (`allegany-config.json`; output `references/mny-transcribe/allegany/`) is **large — County + 40 municipalities** (towns +
villages, no cities), same 18-hazard taxonomy. It used the `scrape_all.js`+`build_fulton.js` lineage, now
fully **config-driven** (`build_fulton.js` reads `slug`/`county`/`fips`/`hazards`/`juris`/`missing`/`hocSource`
from `MNY_CONFIG`, emits `<slug>-lhmp-*`). What it added / confirmed:

- **`hocSource` config key — a THIRD place HoC can live** (`build_fulton.js` now takes
  `hocSource: "county" | "filtered" | "none"`): Delaware = filtered annex view; Fulton = county "All Hazards"
  6-col table; **Allegany = nowhere.** Its county view has no Local-Hazards-of-Concern table (only loss-events),
  and the filtered annex HoC widget returns "Search 0 Records". **Always determine where HoC lives before building.**
- **⚠ Allegany has NO per-jurisdiction hazard content at all — verify blue boxes exist BEFORE scraping them.**
  I initially assumed (from Fulton) that the HoC ratings lived in per-hazard "blue box" prose. **Wrong.** A
  direct probe (`probe_allegany.js`: select a jurisdiction, click Flooding, inspect the DOM) proved: **no
  `element-box`/aliceblue "Jurisdictional Annex" boxes render at all**, and the per-hazard "Local Impacts"
  text is **county-scoped** (identical whichever jurisdiction is selected). So Allegany's hazard analysis is
  county-level only; per-jurisdiction annexes carry **just Capabilities + Actions** (from the filtered
  strategies view). This is the same *model* as Niagara (below). Lesson: **before running a 40×18 blue scrape,
  probe one jurisdiction+hazard** — a ~1hr scrape was avoided once the probe showed 0 boxes. New config flag
  `perJurisHazards: false` makes `build_fulton.js` emit a single county-level "Hazards" note per annex instead
  of empty HoC / Local-Impacts sections.
- **Richer authored *county* narrative than Fulton.** Allegany's hazard Characteristics are detailed and
  county-specific (Flooding cites NOAA/USACE 1996–2022 data, four flood types). Says "Allegany County" — no bleed-through.
- **Detached-Frame crashes are FREQUENT here (~50%+), both on bootstrap AND mid-session.** Three fixes, baked
  into `scrape_one.js` / `scrape_blue.js`:
  1. **Retry the whole flow with a brand-new browser** (not just `page.goto`). Once the main frame detaches the
     page is dead — all in-page `gotoHome` retries fail on the *same* detached frame ID. Body wrapped in
     `attempt()`, retried with a fresh `puppeteer.launch()` each time.
  2. **Fail fast in `gotoHome`** (2 internal retries, not 4) → escalate to relaunch in ~15s not ~50s.
  3. **`localStorage.clear()` after bootstrap and per hazard** — dramatically extended mid-session survival
     (blue probe went from ~2 hazards/session to ~10+). The detach is partly localStorage/chart-cache churn.
  Also **kill orphaned Edge between jurisdictions** (`taskkill //F //IM msedge.exe`) — orphans worsen the rate.
- **Scale = `run_concurrent.js`** (the scalable path for big counties; supersedes the sequential
  `run_scrape_config.sh` at 40 juris). It spawns fresh-browser child processes (`scrape_one.js` for annexes,
  `scrape_blue.js` for blue) with a concurrency cap (`CONC`, used 3) and **resume** (skips jurisdictions whose
  output already exists). No Edge-killing in concurrent mode (would kill siblings); each child self-heals via
  its own browser-relaunch retry. 40 annexes done cleanly at CONC=3. The single-browser annex loop in
  `scrape_all.js` is NOT viable at this scale — use `MNY_COUNTY_ONLY=1` for the county block, then
  `run_concurrent.js annex`.
- **Blue scrape is now per-hazard resumable** (`scrape_blue.js` writes incrementally with a `done` list +
  `complete` flag; `run_concurrent.js` treats a blue JSON as done only when `complete:true`). Essential when
  sessions die mid-hazard-loop — each attempt resumes where the last crashed. (Unused for Allegany in the end,
  but the mechanism is the template for any county that *does* have blue boxes on an unstable site.)
- **Background-task caveat (this environment):** long scrapes were repeatedly killed at a ~10-min cap. All the
  runners are **resumable**, so just relaunch until done; for a short remaining tail, a foreground run finishes it.

### Niagara (4th county) — a genuinely different plan *model* (⚠ don't assume the Delaware/Hamilton shape)

Niagara (`mny_*.js` here + `niagara_config.js`; output `references/mny-transcribe/niagara/`) is a big Western-NY county (28
municipalities incl. **3 cities**, **2 reservations**) whose **2022 plan is narrative-driven** and broke
several assumptions. Confirmed:

- **NO per-hazard "blue boxes" and NO HoC rating table.** Iterating hazards for blue boxes finds nothing (and
  crashes late). The per-jurisdiction narrative is instead:
  - **Hazards annex view** → one *"<Juris> Jurisdictional Annex"* box listing hazards of concern as prose
    ("Hazard 1: Flooding …") — no Prev/Future/Loss ratings.
  - **Risk annex view** → one annex box opening with a **Community Profile** paragraph, followed by a
    jurisdiction-filtered **Problem Statements** table (2 tabs / 3 cols: Juris | Statement | Hazards) — the
    richest local-impacts content. Rest of the box is shared county boilerplate (stop at `VULNERABILITY`).
  - **Strategies annex view** → Capabilities + Proposed/Additional actions (same shape as other counties).
  - **County All-Hazards page** → a *"Hazards of Concern from Qualitative Feedback from Jurisdictional Teams"*
    list (one line per municipality: `"<Type> of <Name>: haz, haz"`). `mny_build.js` parses it (`qualHoc()`)
    and matches it to the dropdown labels via a `name|type` key.
  So: **skip the blue scrape entirely** (`MNY_NO_BLUE=1` on `mny_run_annexes.js`); all per-jurisdiction content
  comes from the three annex views captured by `mny_scrape_one.js`. `mny_build.js` auto-branches: per-hazard
  blue boxes if a `blue_*.json` exists (Hamilton), else Community-Profile + hazards-of-concern + Problem
  Statements (Niagara). **Diagnose the model with one probe jurisdiction before scraping all of them.**
- **Concurrency must drop for heavy counties.** Niagara's city/town pages are large; **concurrency 3 caused
  cascading `detached Frame` renderer crashes**, concurrency **2** was stable, and the last stubborn stragglers
  needed **concurrency 1** with `Get-Process msedge | Stop-Process -Force` between runs. (Free RAM was 10 GB —
  it's per-tab renderer memory, not system RAM.) Start heavy counties at 2.
- **Reproducible page-specific crash:** the **Strategies** view for **Ransomville (Village)** and **Somerset
  (Town)** crashes every attempt (Hazards+Risk load fine). Accept partial capture and note it — don't burn
  hours retrying. `mny_build.js` flags `strategiesMissing` and writes a "recover manually" note in the annex.
- **Resume must check file SIZE, not existence:** a failed jurisdiction selection writes **0-byte** annex files
  but exits 0; existence-only resume then skips them forever. `mny_run_annexes.js` now treats `<500 bytes` as
  not-done (and delete stale empties with `find … -size -500c -delete` before a re-run).
- **City dropdown tokens:** `Lockport city ( City)` (lowercase, space in `( City)`) — the jurisdiction regex
  must be `/\(\s*(County|Town|Village|City)\s*\)/`. `pretty()`/`kebab()` normalize to `Lockport (City)` /
  `lockport-city`. **"County subdivisions not defined (Town)"** is a Census artifact — exclude from `JURIS`.
- **Bleed-through returns:** Niagara's Dam-Safety narrative still says "Sullivan County" (seeded from Sullivan).
  Spot-check.

**Three toolchains now coexist here** (all config-driven, same method): Fulton's `scrape_all.js`+`build_fulton.js`
(JSON config, `MNY_CONFIG=<json>`), Hamilton's `ham_*` (JS-module config), and Niagara's generic `mny_*`
(JS-module config, `MNY_CONFIG=./<county>_config`). **For a new county, start from the `mny_*` set** — it's the
most general (auto-branches plan models, size-aware resume, `MNY_NO_BLUE`). Copy `niagara_config.js` →
`<county>_config.js` and edit `COUNTY/FIPS/SITE/SLUG/BASE/HAZARDS/JURIS/EXTRA_HAZARD_PAGES`.

## Turning the scrape into markdown

`build.js` (kept here) is the deterministic assembler used for Delaware → `references/mny-transcribe/delaware/`. It:
- strips the nav + left-submenu boilerplate (submenu doubles as the header map: ALL-CAPS → `##`, Title → `###`),
- de-dupes the double-rendered rows, collapses long vertical data-table runs into a `_[N data rows omitted]_`
  note (2.0 auto-generates those from datasets), and keeps all authored narrative verbatim,
- extracts the tab-separated tables (Local Hazards of Concern, Proposed Actions, Additional Actions) and the
  vertical Capabilities records into per-jurisdiction annex markdown.
- Special-cases dropdown-missing jurisdictions (Delaware: Village of Deposit / geoid 3620346) by slicing the
  county tables. Run: `node build.js <dataDir> <outDir>`.

It is **county-specific in its constants** (hazard list, jurisdiction list, geoid special-cases, section titles)
but the cleaning/extraction machinery is reusable — copy and adjust the arrays per county.

## Files here

- `scrape_all.js` — comprehensive in-app-navigation scraper (county sections + per-hazard + per-jurisdiction annexes); resumable.
- `scrape_one.js` — **one jurisdiction, fresh browser** (the reliable annex path at scale). Drive it from a shell loop.
- `scrape_hazards.js` — re-scrape the per-hazard county Characteristics with stabilization polling (fixes the lag bug).
- `scrape_blue.js` — per-jurisdiction, all-18-hazards **blue-box** narrative capture → `blue_<slug>.json` (fresh browser each; stabilization + prev-guard against the lag bug). Drive with `run_blue.sh <Juris...>`; run several batches concurrently to parallelize.
- `run_blue.sh` — shell loop over jurisdictions for `scrape_blue.js` (resumable: skips existing `blue_<slug>.json`).
- `crawl.js` — simpler direct-route crawler (only for top-nav routes that survive a direct load; quick spot checks).
- `build.js` — deterministic innerText → structured markdown assembler (main plan + annexes). Reads the `blue_*.json` (env `BLUE_DIR`, default `blue/`) and inserts a **"Local Impacts — Jurisdiction-Specific Narrative"** section per annex.

### Fulton/Allegany (config-driven, plain-JSON) scripts

- `inspect_taxonomy.js` — generic taxonomy discovery (`MNY_BASE=…`); prints nav, hazards, and the jurisdiction dropdown. Run first, write a `<county>-config.json`.
- `build_fulton.js` — generic 3-file assembler. `MNY_CONFIG=<county>.json` with `{slug,county,base,fips,hazards[],juris[],missing[],hocSource,perJurisHazards}`; emits `<slug>-lhmp-v1|hazards|annexes.md` + `jurisdictional-annexes/*.md`. `hocSource: county|filtered|none`; `perJurisHazards:false` for county-level-only plans (Allegany).
- `run_concurrent.js` — **the scale path.** `node run_concurrent.js <annex|blue>` spawns fresh-browser `scrape_one.js`/`scrape_blue.js` children at `CONC` cap, resumable (skips done; blue = `complete:true`). Used for Allegany's 40 juris at CONC=3.
- `run_scrape_config.sh` — sequential orchestrator: county block (`MNY_COUNTY_ONLY=1`) then annexes fresh-browser-each with Edge-kill between. Fine for small counties; use `run_concurrent.js` at scale.
- `run_blue_config.sh` — config-driven blue loop (reads `juris[]` from `MNY_CONFIG`); sequential alt to `run_concurrent.js blue`.
- `probe_allegany.js` — **"does this county have blue boxes / per-jurisdiction hazard content?" probe.** Selects a jurisdiction, clicks a hazard, dumps element-box/aliceblue/Local-Impacts. Copy + run BEFORE any 40×18 blue scrape.

### Hamilton (config-driven) scripts — the recommended template for new counties

- `ham_config.js` — per-county taxonomy (`BASE`, `HAZARDS`, `JURIS`, `EXTRA_HAZARD_PAGES`). Copy + edit this per county; the scripts below read it.
- `inspect_hamilton.js` — taxonomy discovery: bootstraps `/`, clicks HAZARDS, reads `ul.main-menu li` (hazards) + the jurisdiction dropdown. Run first, paste results into `ham_config.js`.
- `ham_scrape_county.js` — county-level scrape (landing, 5 sections, All-Hazards dashboard, 18 per-hazard Characteristics **with stabilization polling**, Other Hazards). One long-lived browser.
- `ham_scrape_one.js` — one jurisdiction's annex views (hazards/risk/strategies), fresh browser.
- `ham_scrape_blue.js` — one jurisdiction's 18-hazard blue-box capture, fresh browser (stabilization + prev-guard).
- `ham_run_annexes.js` — **concurrency orchestrator** over all jurisdictions (annex + blue), fresh-browser child processes, resumable. `node ham_run_annexes.js <outDir> [concurrency]`.
- `ham_build.js` — 3-file deterministic assembler (`v1` / `hazards` / `annexes` + `jurisdictional-annexes/`). Adds the DOWNLOAD-CSV table collapse, the tab-preserving `readLines`, authored county Local Impacts capture, and the county-wide master HoC table. `node ham_build.js <dataDir> <outDir>`.

### Niagara (generic, config-driven `mny_*`) scripts — START HERE for a new county

Fully config-driven via `MNY_CONFIG=./<county>_config` (a JS module exporting
`COUNTY, FIPS, SITE, SLUG, BASE, HAZARDS, JURIS, EXTRA_HAZARD_PAGES`). These supersede the `ham_*` set (same
method, more general): auto-branch between plan models, size-aware resume, `MNY_NO_BLUE`, city-token handling.

- `niagara_config.js` — the config template (copy → `<county>_config.js`, edit).
- `inspect_niagara.js` — taxonomy discovery (hazards + jurisdiction dropdown; handles the `( City)` token).
- `mny_scrape_county.js` — county-level scrape (`MNY_CONFIG=… node mny_scrape_county.js <outDir>`).
- `mny_scrape_one.js` — one jurisdiction's 3 annex views, fresh browser.
- `mny_scrape_blue.js` — per-hazard blue-box capture (Delaware/Hamilton-model plans only; skip for Niagara-model).
- `mny_run_annexes.js` — concurrency orchestrator, **size-aware resume**, `MNY_NO_BLUE=1` to skip blue. `node mny_run_annexes.js <outDir> [concurrency]` — **use concurrency 2 for heavy counties, 1 for stragglers**.
- `mny_build.js` — generic 3-file assembler. Auto-branches: per-hazard blue boxes (if `blue_*.json` present) vs Community-Profile + hazards-of-concern + Problem Statements (Niagara-model). Parses the county qualitative-feedback HoC list; flags `strategiesMissing`. `MNY_CONFIG=… node mny_build.js <dataDir> <outDir>`.

---

## Recovering a MISSED jurisdiction (`scrape_city.js`) — the "( City)" token bug

**Symptom:** a plan participant is absent from the scraped output even though its content
exists on the live 1.0 site. First hit on **Schenectady**: the *City of Schenectady* annex was
never captured, though its content is fully present (select it and browse Risk/Strategies/Hazards).

**Root cause (verified 2026-07-30):** the 1.0 jurisdiction dropdown labels the city
**`Schenectady city ( City)`** — note the irregular space inside `( City)`. The original
Schenectady scrape ran on the *older* toolchain (pre-`mny_*`), whose jurisdiction matcher/list
did not handle that malformed token, so the city was silently skipped. This is the exact
`( City)` token-handling case the Niagara/Allegany `mny_*` toolchain later fixed. **Always diff
the live dropdown against your scraped jurisdiction set before declaring a county done** — open the
selector (a `<button>` that expands a portal list) and read every `(County|City|Town|Village)`
option; cities/villages with unresolved-geoid or malformed tokens are the usual omissions.

**Fix / tool:** `scrape_city.js` scrapes ONE jurisdiction's full annex by its **exact dropdown
text** (token spacing irrelevant) and writes a markdown file matching
`schenectady-lhmp-v1-annex-<slug>.md` (the structure the annex loader parses). Selectors confirmed
by live inspection: the blue box is `div.element-box` whose innerText starts with
`"<exact dropdown text> Jurisdictional Annex"`; its section is the nearest preceding `h1–h6`.

```bash
MNY_BASE=https://schenectady.mitigateny.org \
MNY_JURIS='Schenectady city ( City)' \
MNY_SLUG=schenectady-city MNY_TITLE='City of Schenectady' \
node scrape_city.js
# -> references/mny-transcribe/schenectady/schenectady-alex/annexes/schenectady-lhmp-v1-annex-schenectady-city.md
#    + references/mny-transcribe/schenectady/schenectady-alex/_raw/schenectady-city/capture.json
```

It walks HOME / PLANNING PROCESS / RISK / STRATEGIES (in-app nav, selection preserved) plus each
hazard page, and emits `## <chapter>` / `##### <section>` / `<Juris> Jurisdictional Annex` +
prose. Schenectady City result: Risk 7 boxes, Strategies 3, 4 per-hazard. Feed it straight into the
annex loader (see [`loading-annexes-into-jurisdictions-dataset.md`](../loading-annexes-into-jurisdictions-dataset.md)) by adding the jurisdiction to
that skill's `build_payloads.mjs` JURIS map.
