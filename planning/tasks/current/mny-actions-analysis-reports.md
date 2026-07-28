# MNY design-system `reports/` folder + Duplicate & Boilerplate action reports

**Status:** DONE (2026-07-16) · **Type:** design-system structure + data-analysis reports
**Scope:** `src/themes/mny/design/` (new `reports/` folder), `references/actions/` (two analysis scripts)

## Goal

Introduce a `reports/` area in the MitigateNY design system for **HTML analysis outputs that are NOT
meant to migrate to DMS** — a place to run an analysis and publish the finding in the mny brand.
Move the existing Actions QA report there, and add two new data-backed reports:

1. **Duplicate Actions** — the same action, in the same place, entered twice. Look at it from
   multiple attributes (esp. county / jurisdiction), explain what process created the duplicates,
   and give a reader confidence that deleting them is the correct path.
2. **Boilerplate Actions** — template text reused across jurisdictions. Show *how* they're
   boilerplate and *where* (counties/jurisdictions), and what to do to shape them into locally
   useful records.

## What was built

### Folder + move
- New `src/themes/mny/design/reports/`.
- `git mv pages/actions-qa.html → reports/actions-qa.html`.
- Repointed **all 14 inbound links** across `pages/*` (`href="actions-qa.html"`) and
  `design-system/*` (`href="../pages/actions-qa.html"`) → `../reports/actions-qa.html`
  (`scratchpad/fix_report_links.mjs`), plus the inline prose link in
  `pages/actions-location-overview.html`. Verified: zero broken `actions-qa` refs remain.
- The floating nav widget now has a **Data Reports** cluster (Actions QA · Duplicate · Boilerplate)
  and a **Mockups** cluster (`../pages/*`); the two new reports were injected into every mockup's
  widget for discoverability.
- README updated to document `reports/` vs `pages/` and the three data-backed reports.

### Analysis (all real data — source 1029065 / view 1074456, 18,378 rows)
- `references/actions/scripts/10_duplicates.mjs` → `data/dup_analysis.json`
- `references/actions/scripts/11_boilerplate.mjs` → `data/boilerplate_analysis.json`
- Definitions: **duplicate** = identical normalized name+description within one *locality*
  (jurisdiction, else county — rows with neither are bucketed "unlocatable", not deleted);
  **boilerplate** = same name+description across *≥2 localities*.

### Reports (mny-branded HTML, numbers baked from the JSON)
- `reports/duplicate-actions.html`
- `reports/boilerplate-actions.html`
Both render clean over `python3 -m http.server` in `design/` — no console errors, no h-overflow,
verified by Playwright full-page screenshot.

## Key findings (baked into the reports)

**Duplicates:** 1,945 groups / **1,960 redundant rows (10.7%)**; dedupe → 16,418. Concentration is
the story — **96% comes from 5 county annexes** (NYC, Chautauqua, Monroe, Broome, Madison; Monroe
~50%, most other counties ~0%). Provenance: pair ids are far apart (median gap 5,962; adjacent 0.5%)
but 40.6% share a creation date → each annex was **imported twice**, not typed twice. Safety: 39%
(767 groups) collapse losslessly (identical / blank-vs-filled); the rest differ only in secondary
fields (timeline, status, hazard tags) → keep-the-richer-copy merge rule; 31 redundant rows are
already `isValid=false`.

**Boilerplate:** 827 templates / **3,467 rows (18.9%)**; 81.1% locally authored. "Public Awareness
Program" alone = **449× across 28 jurisdictions in 30 wordings**. Never site-located (top templates
0%). Reliance is bimodal by county (Ontario 82.8%, Saratoga 63.9%, Greene 66.8% … vs Sullivan /
Onondaga / NYC / Putnam 0%). **The two problems are disjoint** — duplicate-heavy counties are
low-boilerplate and vice-versa. Shaping playbook: consolidate pure programs into a shared entity,
localize the place-specific ones, standardize the name/description drift into a controlled catalog,
flag template-vs-local.

## Follow-on: `reports/location-from-text.html` (2026-07-16)

Question posed: *using the descriptions, can we produce more accurate lat/lon for actions currently
coded to a jurisdiction/county centroid?* Answer: **yes, meaningfully.**

- `references/actions/scripts/12_location_from_text.mjs` → `data/location_recovery.json` — tiers every
  centroid-coded action (17,695: p3 11,920 + p4 5,775) by the strongest location signal in its
  name+description+problem+address+geometry text.
- `references/actions/scripts/13_geocode_validate.mjs` → `data/geocode_validation.json` — live Census
  one-line geocode of a 30-address sample (validates resolvability + accuracy gain).

**Findings:** **4,026 (22.8%) carry a recoverable location.** Tiers (best per action): A explicit
coordinates **16** (parse, ~0 m — pipeline rung 1 never reads these fields), B street address **281**,
C intersection **252** (= 549 high-confidence, ~7× today's 74), D numbered route **657** + named road
**2,820** (medium), E named facility **2,309** (candidate, needs gazetteer), F none **11,360**. If
high+medium land, site-precise points go **74 → ~4,000 (54×)**. Geocode validation: **40% clean
match** on the strict one-line service (a floor; batch geocoder + cleaning recovers more), recovered
points a **median 3.8 km** (max 26.8 km) off the current centroid. Signal is concentrated in
locally-authored actions (25.8% recoverable) vs boilerplate (8.7%) — confirming it targets the actions
worth placing. County-centroid (p4) actions gain the most accuracy per fix. Recommendation: (1) read
coordinates from all text fields, (2) extract+geocode addresses via the existing Census batch rung,
(3) add road/POI resolvers for the long tail, (4) sequence by payoff; ceiling remains capture-at-intake.

Report added to the Data Reports nav cluster across all pages.

## Notes / follow-ups (not done here)
- Only `actions-qa.html` was moved (as asked). `pages/actions-location-overview.html` is also a
  data-backed analysis page and could move to `reports/` too — left in `pages/` for now (it's the
  MapLibre exec-summary surface; a candidate, ask before moving).
- Reports are point-in-time; re-run `10`/`11` (after `01`→`02`) to refresh the numbers if the
  actions source changes.
