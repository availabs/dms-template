# Action Prioritize (List) v3 — close the design-fidelity gaps

**Status:** PLAN (awaiting sign-off; no implementation yet)
**Created:** 2026-07-16 · **Type:** content + mny theme + `@availabs/dms` library
**Page:** 2262755 (`…/action_prioritize_v2`, DRAFT) · **Design:** `src/themes/mny/design/pages/actions-prioritize.html`
**Follows:** `mny-action-prioritize-v2-live-build.md` (Phases 1–3 done). Draft-only; never publish.

## Objective

Close the six remaining gaps between the live v2 page and the approved mockup. Each is mapped to the
smallest platform enrichment (per `src/themes/CLAUDE.md`), backward-compatible, and — for every new
activeStyle / columnType / theme key — **registered in the design-system components page**
(`src/themes/mny/design/design-system/components.html`; column types in `column-types.html`).

Decisions taken with the owner:
- County-header source = a **counties reference source** (not Actions_Revised), driven by the `geoid` page var.
- Live-refresh scope on a priority edit = **progress lede + tier bar, the worklist table, AND the stat cells** (all three).
- Stacked bar = a **columnType in a Card** (the existing `stacked_bar` type — the "extend data_bar to a stack" already exists).

---

## The six gaps

### 1. County context header — data-driven
- **Now:** static Lexical text "Sullivan County · FIPS 36105".
- **Design:** header-right pill, map-pin icon + county **name** + **FIPS** (`actions-prioritize.html:95-101`).
- **Approach:** a small **Card bound to the counties reference source**, filtered by the `geoid` page var
  (usePageFilters leaf on the geoid column), rendering `name` + `geoid`. The name isn't in the page var
  (geoid only) so a lookup is required.
- **New functionality:** a small **`county_badge` (location-badge) columnType** for the pin-icon + "{name} County" +
  "FIPS {geoid}" pill chrome (chrome-with-icon = the columnType pattern). Alternative: plain Card cells + a
  static icon cell (no new type) — decide at build. **First step:** confirm the bindable counties source
  (candidate: TIGER counties used by the actions_location worker — `tiger.tl_s1567_v2157`, source 1567 /
  view 2157 in `hazmit_dama`, has `geoid` + `name`); verify it's registered with `metadata.columns` and
  bindable from a DMS Card. If not, find the counties source the app already exposes.
- **Where:** library (tiny columnType, if used) + config (Card + source) + components-page registration.

### 2. Progress lede — the stacked distribution
- **Now:** `stat_value` "0 / 473" (no distribution).
- **Design:** tier-**stacked bar** = the meter IS the distribution (T1·T2·T3·T4·Not-set) + legend + "X to go"
  (`actions-prioritize.html:135-149`).
- **Approach:** wire the **existing `stacked_bar` columnType** (`ui/columnTypes/stacked_bar.jsx`, registered) into
  the lede Card. Feed it **five sibling count calc columns** (`count(*) filter (where … Tier 1 …)` etc., plus
  not-set), `fn:"exempt"`, `selectOnly`, and point `segments:[{col,label,color}]` at them. Keep the
  "259 / 473 · 55%" stat + "X to go" chip. **Comma-free calc expressions** (per `reference_dms_calc_column_no_commas`).
- **New functionality:** none (columnType exists). Add mny `stackedBar` **theme fills** for the tier palette
  (T1 #EAAD43 / T2 #37576B / T3 #6D96AE / T4 #C5D7E0 / not-set white+border). Reads ~100% "Not set" until
  Sullivan prioritizes — honest, animates as data lands.
- **Where:** config + mny theme `stackedBar` fills + components-page registration (fills entry).

### 3. Filter bar — pill-style controls  ⚠ biggest library change
- **Now:** plain labeled inputs (toggle/tokens/clear-all already branded).
- **Design:** each control is a **rounded-full white pill** (label + value + chevron) in a `bg-mny-50` bar; a real
  toggle switch; removable tokens; clear-all; result count; List/Card view switch (`…:198-252`).
- **Blocker:** `mny theme.filters` is a **flat map → global**; can't restyle per-instance today.
- **New functionality (library):** add the **`options.activeStyle` + `styles[]` named-variant mechanism to the
  Filter theme + a per-section style selector in the Filter config** — mirroring the table theme's pattern
  (`table.theme.jsx` `options.activeStyle`/`styles[]`, selector in `spreadsheet/config.jsx`). BC: `styles[0]` =
  today's flat map. Then define a **`pillBar` variant** in mny `theme.filters.styles[]` and select it on 2262759.
- **Where:** library (Filter theme + config) + mny theme variant + **register the `pillBar` activeStyle in
  components.html**. → its own `src/dms/planning/tasks/current/` doc, built via subagent.

### 4. Immediate data reflection (the transportNY solution)
- **Mechanism:** the control-room **`data_refresh`** pattern — a section *subscribes* to a version param
  (`display._functions.subscribers:[{functionId:"data_refresh", paramKey}]`, already in
  `dataWrapper/useDataLoader.js:213`); a *provider* bumps that param on a mutation (`add_publish`/`click_publish`/
  `load_publish` exist; none fire on an in-place edit).
- **New functionality (library):** an **`edit_publish` provider** — a `liveEdit`/`allowEditInView` cell bumps a
  version param on successful persist. Then subscribe the **lede+tier bar (2262775), the table (2262760), and the
  stat cells (2262757)** to that param.
- **Where:** library (dataWrapper edit path + provider) + config (subscribers). → its own `src/dms/planning/` doc,
  subagent. (No design-system entry — behavior, not style.)

### 5. Worklist table — column sizing + open-out columns
- **Now:** auto-distributed widths; open-out detail not wired.
- **Design:** caret 40px · Jurisdiction 190 · Status 150 · Action Name (stretch/fills) · County Priority 280
  (`…:262-273`); each row's caret expands an **inline detail panel** ("the live page's openOut columns", `…:352-411`).
- **Approach:** **config only** — set per-column `size` + order + `stretch` on Action Name; mark the detail fields
  `openOut:true` and set `display.openOutMode:"inline"` (the **`spreadsheet-inline-openout` feature built in Phase 3**
  — just needs wiring + the right detail field set to match the design's expanded panel).
- **New functionality:** none.
- **Where:** config on 2262760.

### 6. Table cells — no vertical borders
- **Now:** `cell: 'relative flex items-center min-h-[35px] border border-slate-50'` → faint four-sided rule reads
  as vertical + horizontal grid lines.
- **Design:** horizontal row rules only; no vertical cell dividers.
- **New functionality:** a **new mny table `styles[]` variant** (e.g. `styles[N]` "clean") overriding `cell` to
  bottom-border-only (`border-b border-mny-100`), selected on 2262760 via the existing table style selector
  (`options.activeStyle`). Mechanism already exists (table theme is `activeStyle`/`styles[]`-shaped).
- **Where:** mny theme table style + per-section selection + **register the activeStyle in components.html**.

---

## Net new functionality (what gets built)

| # | New thing | Kind | Home |
|---|---|---|---|
| 3 | Filter `activeStyle`/`styles[]` mechanism + per-section selector | **library** | `src/dms` task + subagent |
| 4 | `edit_publish` provider (liveEdit persist → version bump) | **library** | `src/dms` task + subagent |
| 1 | `county_badge` columnType (pin + name + FIPS pill) *(if not plain Card cells)* | **library (small)** | `src/dms` task + subagent |
| 2 | mny `stackedBar` tier-fill palette | theme | mny theme |
| 3 | mny `theme.filters.styles.pillBar` variant | theme | mny theme |
| 6 | mny table `styles[]` "clean" (no vertical borders) variant | theme | mny theme |

Config-only wiring (no new code): #2 stacked_bar into the lede; #5 column sizing + inline open-out; #4 subscribe
the three sections to `edit_publish`.

**Design-system discipline (owner's note):** every new activeStyle / columnType / theme key above is registered
in `src/themes/mny/design/design-system/components.html` (and `column-types.html` for `county_badge`) as part of
the feature — not after.

## Build sequence (phased; BC throughout; verify on the :5199 local dev server, never publish)

1. **Phase A — theme + config quick wins (no library):** #6 borderless table style, #5 column sizing + inline
   open-out wiring, #2 stacked_bar lede + mny `stackedBar` fills. Highest visual payoff, lowest risk.
2. **Phase B — county badge (#1):** confirm counties source → (small columnType or Card cells) → bind by `geoid`.
3. **Phase C — filter pill styles (#3):** library mechanism (subagent) → mny `pillBar` variant → wire 2262759.
4. **Phase D — live refresh (#4):** `edit_publish` provider (subagent) → subscribe lede + table + stats.
5. **Register** each new activeStyle/columnType/theme key in the design-system components page as it lands.

Each library feature (#3, #4, #1-if-columnType) gets its own `src/dms/planning/tasks/current/` doc and is built by
a dedicated subagent (per the Phase-3 precedent), BC/additive, then wired + verified by the orchestrator.

## Acceptance
- [ ] Header county pill is data-driven from the `geoid` var (change geoid → header follows).
- [ ] Lede shows the tier-stacked bar (via `stacked_bar`) with a legend + "to go".
- [ ] Filter controls render as the design's pills/toggle/tokens; **no other site's filters change** (styles[0] intact).
- [ ] Assigning a `county_priority` refetches the lede + tier bar, the table, and the stat cells with no reload.
- [ ] Table columns match the design's order/widths; caret expands the inline open-out detail.
- [ ] No vertical cell borders on this table; other tables unaffected.
- [ ] Every new activeStyle/columnType/theme key registered in `design-system/components.html` (+ column-types.html).
- [ ] BC spot-check: one other Card/Filter/Table page unchanged. Page 2262755 stays DRAFT.

## Log
- 2026-07-16: plan written from a gap assessment against the mockup; owner approved the list.
- 2026-07-16: **Phase A DONE + verified on :5199** (theme/config, no library work): #6 borderless
  table (`mny-clean` style, `display.tableStyle:2`), #5 column sizing (open-out already wired), #2
  tier stacked_bar in the lede (existing columnType + mny `stackedBar` palette). New styles registered
  in `design-system/components.html`. Page 2262755 still DRAFT. See implementation-plan doc for the
  A3 aggregation gotchas. Remaining: Phase B (#1 county badge), C (#3 filter pills), D (#4 live refresh).
- 2026-07-16: **Lede style convergence** (owner: "get the card closer to the design"). Merged the 3
  boxes into ONE amber panel: `display.cellBorder:false` + `cardsBgColor:#FCF6EC` + `cardBorder:true`
  + `cardsPadding:16` + `cellsGridSize:1`; continuous left accent via per-cell `cellBorderColor:#EAAD43`
  on the stacked cells; la_prioritized "259/473" + la_to_go "214 to go" (both `stat_value` so `unit`
  renders) + the tier bar. **Card-config limits found (owner chose to flex the design):** (a) a
  calculated/aggregate **% column breaks the Card query** (blanks the card) — no computed "% complete";
  (b) cells are **rectangles, no rounded pill** — dropped the "TO GO" CTA pill; (c) **no card-level
  border-color/left-accent knob** — approximated per-cell; (d) `unit` renders on `stat_value` not
  `calculated`. Updated `pages/actions-prioritize.html` lede to match (dropped % + rounded pill).
  Design ↔ page now agree. (If pixel-parity wanted later: a %-capable stat + a rounded pill columnType
  + a card `accentColor` knob — small library adds.)
- 2026-07-16: **Lede final layout + proper border.** Owner: the per-cell `cellBorderColor` accent
  "looks terrible" (segmented) — the border must be on the card/section, and asked to extend section
  border controls with width + theme color. (a) Restructured the lede: "County Priority Assigned"
  (eyebrow static cell) + "471 to go" (right-justified `stat_value`) on ONE row, "2/473" big below,
  tier bar below — one amber panel; synced the design mockup to the same layout. (b) **New library
  feature** (subagent): `src/dms/.../section-border-width-color.md` — section border now takes per-side
  **width + a theme color** (inline style; Tailwind can't JIT arbitrary values); Border control in the
  section menu gains a width stepper + theme-color swatches. (c) Wired section 2262775
  `border:{left:true,width:4,color:'#EAAD43'}` + dropped the Card's gray `cardBorder` → one clean
  continuous amber left accent (no per-cell stitching). Verified on :5199.
- 2026-07-16: **Lede finalized + page aligned to design.** (a) Tightened the design mockup (lede
  `p-3`/`gap-2`/30px stat/no bar top-margin; stat cards `p-3`) then **removed the "to go" cell**
  entirely — lede is now eyebrow label → `259/473` stat → tier bar (row ~119px, was ~185). (b) Aligned
  the PAGE: removed la_to_go, `cellsGridSize:1`, `cardsPadding:12`, `cellsGridGap:6`; stat strip 2262757
  numbers → `text2XL`, labels → `textXSReg`, `cellsPadding:12`. (c) **Registered-token fix** (owner:
  "make sure text styles are registered") — swapped ad-hoc `metaSM`/`metaLG`/`text5XL`(48px) for the
  real mny dataCard tokens: lede label `textXSReg` (12px), lede stat `text3XL` (30px), stat-card
  numbers `text2XL` (24px). (d) **Accent radius fix** — set the lede section `data.radius:{tl,tr,bl,br}`
  so the amber left border rounds with the panel (was square). Design ↔ page ↔ theme tokens all agree.
