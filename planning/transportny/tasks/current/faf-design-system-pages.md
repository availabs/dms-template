# Freight Analysis Framework — design-system page family (dms_design_system_v2)

**Project:** TransportNY · **Topic:** themes · **Status:** DONE · **Started:** 2026-09-10 · **Completed:** 2026-09-10

## Current state — 2026-09-10

**All ten pages built, registered and verified.** `pages/faf-*.html`, one `ds-nav.js` section, a
dated README section. Every figure is computed from the local FAF files; nothing was fetched.

Verified: HTML well-formed on all ten (tag-balance parser); every internal href resolves; all ten
registered in `ds-nav.js`; every `<!-- icon: … -->` name exists in `theme/icons.js`; headless
Chromium render at **400 / 1280 / 1600 px** — 30 checks, zero console errors, zero horizontal
scroll; every published table sums to its own total (`validate.py`).

### Three findings worth keeping

1. **The gateway trap caught this build.** A first pass published the raw `dms_dest`/`dms_orig`
   field totals (615,374 / 540,998 kt) under *true-endpoint* headings. For an export `dms_dest` is
   the US **exit** region, so that total silently included 56,523 kt of other states' exports
   leaving through New York. The sum-check found it: the correct receipts/shipments figures are
   **558,851 / 493,730 kt**, and `receipts + shipments − within-domestic + gateway` reproduces the
   involved total exactly. The wrong rows are published on the page *labelled as the mistake*, so
   the next reader meets the trap with the answer beside it. **Re-derivable check:** every
   published table must sum to its own stated total, and `receipts + shipments − within-domestic +
   gateway` must equal the NY-involved total — both held to under 0.001% on the shipped figures.
2. **A 400-px layout defect inherited from the NPMRDS header shape**, which `npmrds-tmc.html`
   still has: `min-w-[360px]` on the header text column against a band that leaves 320 px (8 px
   overflow), plus `shrink-0` on the action stack, which refuses to compress despite `flex-wrap`
   (up to 64 px more). Fixed here as `min-w-0 sm:min-w-[360px]` and `sm:shrink-0`. Left alone in
   `npmrds-tmc.html` — another category's page — and recorded in the README instead.
3. **The Tailwind CDN and Google Fonts are blocked by this container's egress allowlist**, so every
   page in this design system renders unstyled when opened here — all 53, not just these ten. The
   render check served Tailwind from npm (`@tailwindcss/browser`) and intercepted the CDN request.
   `squid.conf` gained `.tailwindcss.com` and `fonts.googleapis.com` during this session but the
   running proxy still returned `TCP_DENIED/403` after a restart, and **`fonts.gstatic.com` — where
   the font files actually come from — is still not in the ACL**. Fonts are fine offline regardless:
   `_shared.css` `@font-face`s the real files out of `pages/fonts/`.

### Not done

- The generator that emitted these pages lives in the **scratchpad and is deliberately not
  committed**. The HTML is the artifact and the source of truth (the folder's no-toolchain
  contract); a committed generator would silently revert a hand edit on its next run — the same
  trap `qa_skills` records for the builder scripts.
- No live DMS page. These are mockups; `qa-implement-page` consumes them later, and **the mode page
  is blocked on escalation 1 below** until the theme has a palette wide enough for eight modes.

## Objective

A new page family — **`faf-*.html`** — in
`src/themes/transportny/TransportNY Design System/dms_design_system_v2/pages/`, mocking a
**Freight Analysis Framework (FAF)** analysis surface in the TransportNY brand.

Requested in `src/themes/transportny/specifications/krans-prompt.001.md`: a home page, a state page,
and "any other pages at geographic levels or aggregations of categorical data that you think would
be useful for FAF analysis based on the best practices," with context wherever it helps.

This is **not** the same deliverable as
[`freight-faf-claim-compiler.md`](./freight-faf-claim-compiler.md). That task builds a *standalone
static site* at `src/themes/freight-planning-faf/` on a claim-verification pipeline. This one is
mockup pages inside the existing v2 design system, under its contract (plain HTML + Tailwind CDN +
`_shared.css`, no build step, `ds-nav.js` registration).

## Scope

**In scope**
- `pages/faf-*.html` — the page family
- `ds-nav.js` — a new `faf` section so no page arrives as an orphan
- `README.md` — a dated section describing the family, its data basis, and its escalations

**Out of scope**
- Any change to `@availabs/dms` (would escalate to `src/dms/planning/`)
- `theme/theme.js` edits — the two palette gaps this family hits are **named as escalations**, not
  silently added (see below), matching how `npmrds-tmc.html` handled `seqNeutralPalette`
- Live DMS pages. These are mockups; a build task consumes them later via `qa-implement-page`.
- Fetching FAF data. `.gov` is blocked unconditionally in this container; every figure comes from
  the FAF files already in `references/faf/`.

## Data basis — every figure is computed, not invented

The pages carry real numbers, computed locally from files already in the workspace:

| source | what it gives |
|---|---|
| `references/faf/faf5.7.1-data/FAF5.7.1.zip` | the FAF5.7.1 regional OD-commodity-mode database |
| `references/faf/faf5-experimental-county-level/New_York/*.csv` | the experimental county estimates |
| `references/faf/faf5-network/Assignment Flow Tables/` | 2017 truck flows assigned to the FAF5 network |
| `references/faf/faf-documentation/docling/*.md` | FAF5/FAF6 user guides, base-year method, county technical report |

**Unit conventions** (confirmed against the FAF5 User Guide, and the reason a mis-stated figure here
would be off by 1,000×): `tons_*` are **thousands of tons**, `value_*` are **millions of 2017
constant dollars**, `tmiles_*` are **millions of ton-miles**.

## Page set

Geographic ladder (national → state → FAF zone → county) plus the four categorical axes the
database actually carries (commodity · mode · trade type · distance band):

| page | level / axis |
|---|---|
| `faf-home.html` | national front door + doorways |
| `faf-state.html` | New York state profile |
| `faf-zone.html` | one FAF zone (the native FAF geography) |
| `faf-county.html` | experimental county estimates |
| `faf-commodity.html` | SCTG commodity aggregation |
| `faf-mode.html` | mode + ton-miles / haul length |
| `faf-flows.html` | OD trade lanes, trade type, gateways |
| `faf-forecast.html` | base year → 2050 |
| `faf-network.html` | highway assignment / corridors |
| `faf-methodology.html` | method, code tables, caveats, downloads |

## Escalations (named, not silently patched)

1. **`graph.catPalette` holds 5 colours; FAF has 8 domestic modes.** A mode chart cannot bind to it.
   Needs an extended categorical ramp named in `theme/theme.js` before a build task can bind a
   by-mode series.
2. **No neutral sequential ramp.** Same gap `npmrds-tmc.html` already named as
   `graph.seqNeutralPalette`. Every FAF choropleth (county tonnage, zone flows) is a magnitude, so
   `seqSpeedPalette` (a red→green judgement ramp) is wrong for it. These pages draw the same 7-step
   single-hue ramp off `graph.primary` that `npmrds-tmc.html` drew, and point at the same escalation.

## Testing checklist

Verified 2026-09-10:

- [x] Every page opens standalone with no console error (headless Chromium, Tailwind served locally)
- [x] Every page is registered in `ds-nav.js` and reachable in one hop from the family landing
- [x] Every cross-link inside the family resolves to a file that exists — 0 broken
- [x] Every text class resolves to a `textSettings` token (SKILL_FEEDBACK §16) — asserted by a
      check that fails on any `text-[Npx]` outside the ladder
- [x] Product bands use `mr-auto`, never `mx-auto` (SKILL_FEEDBACK §10) — asserted
- [x] Every `<!-- icon: … -->` name exists in `theme/icons.js` — 23 used, 0 unregistered
- [x] Every published figure traces to a computed table, with units stated
- [x] Rendered at **400 / 1280 / 1600 px**; no horizontal scroll at any width
- [x] Every table sums to its own published total; the true-endpoint identity holds exactly

Not verified:

- [ ] Appearance with the real Tailwind CDN — blocked by the egress allowlist (see finding 3)
- [ ] Anything on a live DMS site — these are mockups

## Reproducing the figures

Everything is one filter and a group-by. Filter `FAF5.7.1.csv` to rows where `dms_orig` **or**
`dms_dest` is in {361, 362, 363, 364, 369}. Read the zone and commodity codes **as strings** —
they are zero-padded, and `011` read as an integer joins to the wrong zone. Direction is derived:
both endpoints NY is *within*, destination only is *inbound*, origin only is *outbound*.

For anything labelled receipts, shipments or "New York's own" trade, sort the rows into the seven
disjoint classes in `faf-state.html` § 03 first — the raw `dms_orig`/`dms_dest` fields are entry
and exit points on international rows, not endpoints.
