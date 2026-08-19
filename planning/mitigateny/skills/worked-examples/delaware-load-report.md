# Delaware plan load — MitigateNY 2.0 pattern 2323808

**Date:** 2026-07-23 · **App:** `mitigat-ny-prod` · **Pattern:** 2323808 (`MitigateNY_Delaware_Draft`,
subdomain `delaware_draft`, instance `mitigateny_county_template_v2_copy`) · **geoid** 36025.
**Source:** the transcribed plan in this folder (`delaware-lhmp-v1.md` + `_raw-scrape/`).
**State:** **62 Annotation slots filled** in `draft_sections` (unpublished), all `status=shmp_sourced_content`.
Method + rules: [`../LOADING_PLANS.md`](../loading-a-plan-into-a-2.0-pattern.md). Pipeline scripts: `context/`.

## What was filled (62 slots)

**The Local Environment (11)**
- People and Communities (2): Local Context (intro — rural county / density / terrain), Local Populations at Highest Risk (social vulnerability).
- Built Environment (6): intro Local Context, infrastructure overview, critical infrastructure, Transportation, Energy, Communications.
- Natural Environment (2): Local Context (intro), water/air features Local Context (waterscape, basins).
- NFIP – Floodplain Management (2): NFIP Participation Summary, Local Context (per-jurisdiction NFIP problem areas).
- High Hazard Dams (1): Local Context (named Class-C/B dams + NYSDEC coordination).

**The Plan (29)**
- About the Process (13): every slot — planning context, planning teams, jurisdictional representation & engagement, stakeholder outreach, public participation, public comment, technical data & resources, adoption, monitoring/evaluating/updating, integration, other related planning processes, continued engagement.
- Capabilities Assessment (4): the four category Local Contexts — Planning & Regulatory, Administrative & Technical, Education & Outreach, Financial.
- Strategies (12): overview, County Goals & Objectives (Goals 1–4), strategy-development process, Problem Area Identification, Prioritization & Cost Evaluation, Funding Sources, Capabilities Highlights, implementation, Displaced Residents, Temporary Housing & Relocation, Evacuation Procedures, Shelters.

**The Risk — cross-cutting (4)**
- The Risk: Risk Analysis Process Summary. Climate Change: Local Context (the county's climate-change narrative + per-hazard climate observations). Natural Hazards: Local Context (hazards-of-concern selection & ranking). Non-natural Hazards: Local Context (2013 non-natural hazards reference).

**Per-hazard pages (18 → 16 filled)**
- **County Assessment** for the 14 hazards of concern / with a real county assessment: Flooding, Wind, Snowstorm, Ice Storm, Extreme Cold (Coldwave), Extreme Heat (Heat Wave), Hail, Lightning, Drought, Wildfire, Landslide, Tornado, Hurricane, Earthquake.
- **Local Hazard Summary** ("not a hazard of concern for Delaware County") for **Avalanche** and **Coastal Hazards**.
- Hazard taxonomy remap applied: Coldwave→Extreme Cold, Heat Wave→Extreme Heat, Snow Storm→Snowstorm. **Tsunami/Seiche and Volcano dropped** (no 2.0 page).

## Choices applied (mirroring the Schenectady transfer)

- Only **county-specific authored prose** transcribed — **verbatim, invent nothing**. Data tables (NFIP,
  inventories, storm events, disaster declarations, capabilities/actions/problem-statement tables) and
  generic FEMA/44-CFR/definitional boilerplate were **not** transcribed (the platform renders them / shared
  cards cover them).
- Slots with no genuine county source were **left empty** (195 of 267 remain empty).
- **Jurisdictional annexes DEFERRED** (2.0 form pages, separate mechanism) — the rich per-jurisdiction
  content (incl. the blue-box narratives in `jurisdictional-annexes/`) is not loaded in this pass.
- Landing-page **Executive Summaries** (The Risk / Local Environment / The Plan) skipped (auth-gated).
- Everything written to **`draft_sections`, unpublished** — nothing published.

## Formatting (see LOADING_PLANS.md for the full rule set)

Rich text built by `context/lexical.mjs` (`mdToRoot`): blank line at the start & end of every box; blank
line between paragraphs and between paragraph/list features (a heading hugs the block after it); bullets and
numbered lists **indented** (`indent:1`); source URLs/"click here" references turned into **links**; defined
terms / program names / lead-in labels **bolded**.

## Backups & rollback

Pre-edit `element-data` for all 62 targets: [`backups/fills_all.PRE.json`](references/mny-transcribe/delaware/backups/fills_all.PRE.json)
(keyed by component id). To roll a component back: `node context/fill_md.mjs` is forward-only — restore by
re-writing the saved `element` via a small script using `context/fq.js`'s `edit(id, {element})`.

## Next steps (owner)

1. **Review the draft** in the `delaware_draft` editor.
2. **Publish per page** when approved (loading did not publish).
3. Consider a later pass for the **jurisdictional annexes** (form pages) and any slots intentionally left empty.

## Reproduce / re-run

`context/` scripts (run from `context/`; the puppeteer scrapers need `puppeteer-core` — run those from a dir
that has it): `enumerate.mjs` → `build_inventory.mjs` → author `edits/fills_{A..D}.json` → `merge_validate.mjs`
→ `backup_targets.mjs` → `fill_md.mjs <spec> [--apply]`. Per-hazard prose came from `scrape_assess.mjs`
(stabilized capture of each hazard's county Local-Impacts section).
