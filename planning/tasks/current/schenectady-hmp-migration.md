# Schenectady County HMP → MitigateNY 2.0 transcription (pattern 2275239)

## Objective
Transcribe the Schenectady County Hazard Mitigation Plan (captured from MitigateNY 1.0 at
`references/schenectady/`) into the MitigateNY 2.0 county template pattern **2275239**
("MitigateNY Schenectady Draft", app `mitigat-ny-prod`, geoid `36093`). Fill the empty
`Annotation` (Local Context) lexical slots verbatim from the source; leave shared narrative and
data components alone. Write to `draft_sections` only — **do not publish**.

## Environment / access
- Host: `https://dmsserver.availabs.org` (remote DB). Falcor `POST /graph`, form-encoded.
- app=`mitigat-ny-prod`, pattern type `prod|mitigateny_county_template_copy:pattern`.
- **Instance-slug collision:** pattern 2275239 shares instance `mitigateny_county_template_copy`
  with older pattern 2231616. Isolate Schenectady rows by `created_at = 2026-07-21`.
- Working folder (gitignored): `references/mny-transcribe/schenectady/context/`
  - `fq.js` — Falcor query helper (byIds/listIds/graph)
  - `pages_all.json` — all 105 pages, segmented by created date
  - `inventory.json` / `inventory.md` — 255 Annotation slots (252 empty) per page
- CLI fixed: `cd src/dms/packages/dms/cli && npm install` installed commander ^12 (was resolving
  parent pkg's v6, which crashed the CLI). No source edits kept.

## Scope decisions (confirmed with owner 2026-07-21)
- **Sequencing: pilot first.** Fill `About the Process` (2265653) + `Flooding` (2265683) end-to-end,
  verify write access + payload format + render, THEN batch the remaining ~230 slots.
- **Fidelity: verbatim + status.** Transcribe verbatim (invent nothing); carry source placeholders
  ("INCLUDE WEBSITE", "xxx", "Table X") through as-is and keep a punch-list. Set each filled
  component's `status = shmp_sourced_content`.
- **Draft only** — never publish; owner reviews and publishes.
- **Out of scope this task:** 7 jurisdictional annexes (they are *form pages*, 0 Annotation slots —
  separate mechanism, defer like Suffolk Vol II). Top-level landing pages (The Risk / Local
  Environment / The Plan) return null over read access (auth-gated) — cannot fill now; flagged.

## Slot inventory (empty Annotation slots by page)
Chapters: Built Environment 12 · People & Communities 8 · Natural Environment 9 · NFIP 3 ·
High Hazard Dams 1 · About the Process 13 · Capabilities Assessment 4 · Strategies 12 ·
Climate Change 1 · Disasters 3 · Natural Hazards 2 · Non-natural Hazards 1 · Annual Maintenance 1.
Hazards: 17 pages × 11 slots = 187 (Local Hazard Summary, Declarations & Effects, Featured Event,
County Assessment, Jurisdictional Assessment, Built/People/Natural Local Risk Summary, Local
Capabilities, Local Actions, Featured Strategy).

## Source → target mapping (high level)
- `schenectady-lhmp-v1.md` Planning Process (L3489+) → About the Process slots.
- Risk (L5801+) / Strategies (L6575+) → Risk chapter, Strategies, Capabilities Assessment slots.
- Home/Plan Overview + Risk/Vulnerability → Local Environment chapter slots.
- `schenectady-lhmp-v1-hazards.md` 18 profiles → 17 hazard pages (Coldwave→Extreme Cold,
  Heat Wave→Extreme Heat, Snow Storm→Snowstorm; Tsunami/Seiche & Volcano: no template page).

## Write mechanism
Per-slot read-modify-write of the lexical payload:
1. Fetch component `data.element['element-data']` (JSON string) → parse.
2. Replace `text.root.children` with nodes built from source prose; keep `bgColor`, `isCard=Annotation`.
3. `section update <id> --data {element:{'element-type':'lexical','element-data':<json>}, status:'shmp_sourced_content'}`
   (shallow merge preserves title/parent/group/trackingId).

## Progress
- [x] Recon: target confirmed, inventory built, source mapped, CLI fixed
- [x] Backup pilot pages → `backups/page_2265653.PRE.json`, `backups/page_2265683.PRE.json`
- [x] Verify write access (test slot 2267684 + readback — works, no auth token needed)
- [x] Pilot applied → draft_sections, status=`shmp_sourced_content` (11 slots filled; verified)
  - About the Process (2265653): 9 of 13 slots filled — Local Context, Organizational Structure -
    Planning Teams, Stakeholder Outreach & Engagement, Public Participation, Public Comment,
    Technical Data & Existing Resources, Monitoring/Evaluating/Updating, Plan for Integration,
    Continued Public Engagement.
    Left empty (no distinct source prose): Other Related Planning Processes, Jurisdictional
    Representation (source heading empty), Jurisdictional Engagement Process (source heading empty),
    2nd Local Context.
  - Flooding (2265683): 2 of 11 — County Assessment (Local Impacts + Dam Failure subsection),
    Featured Event (Aug 29 2011 Mohawk/Western Gateway Bridge). Other 9 slots have only data tables
    in source → left empty.
- [x] Owner approved batch (strict/faithful) — proceeded
- [x] Batch: 15 remaining hazard pages → County Assessment / Local Hazard Summary
  (`edits/hazards_batch.json`). Tsunami/Seiche & Volcano dropped (no template page).
- [x] Batch: chapter pages part 1 (`edits/chapters1.json`) — People & Communities (Local Context
  profile, Governance Structure, Local Populations at Highest Risk), Built Environment (2 Local
  Context), Natural Environment (Local Context, Water Quality).
- [x] Batch: chapter pages part 2 (`edits/chapters2.json`) — NFIP (Participation Summary, Local
  Context), High Hazard Dams (Local Context), Capabilities Assessment (Capacity to Address Risk),
  Climate Change (Climate Smart Community), Strategies (Local Context, County Goals & Objectives,
  Problem Area Identification, Prioritization, Displaced Residents, Evacuation, Shelters), Natural
  Hazards (All Hazards → Local Context).

## Final state (2026-07-21)
**49 of 255 Annotation slots filled** (46 this task + 3 pre-existing), all draft-only, all filled
components `status=shmp_sourced_content`. 206 slots left empty — faithful: the MNY 1.0 source has no
matching county-specific prose for them (mostly the repetitive per-hazard slots and Local Environment
sub-topic slots). 3 content pages intentionally fully empty: **Disasters** (data-driven),
**Non-natural Hazards** (plan covers only natural hazards), **Annual Maintenance** (change log).
Nothing published. Backups: `backups/page_2265653.PRE.json`, `backups/page_2265683.PRE.json`
(pilot pages); all edits reproducible from `edits/*.json` via `context/fill_slot.mjs`.

## Transfer to pattern 2304223 (2026-07-22) — workaround for the type-collision bug
Owner created a fresh pattern **2304223** with a UNIQUE instance slug `mitigateny_county_template_v1_copy`
(front-end `schenectady_copy.devmny.org`, same prod API `dmsserver.availabs.org`, app `mitigat-ny-prod`).
- **Collision check: clean** — only 1 pattern uses `mitigateny_county_template_v1_copy` (no generic
  duplicate-type conflict; the bug that shared `mitigateny_county_template_copy` with Westchester is avoided).
- **Transferred all 46 narrative components** from 2275239 → 2304223, matched by (page slug, slot title,
  occurrence order). 46/46 matched, 0 unmatched. Grafted each old slot's lexical `text` into the new
  component (preserving the new component's card styling), set `status=shmp_sourced_content`. Draft only.
  Script: `context/transfer.mjs`; map: `context/transfer_plan.md`; backup: `backups/transfer_targets_2304223.PRE.json`.
- **Flags for owner:** pattern 2304223 `name`="MitigateNY_County_Template_V1_copy", `subdomain`=`county_template`,
  and **no geoid filter** — set geoid `36093` so data components (Spreadsheet/Graph/Map/Card) filter to Schenectady.

## Remaining / not done
- Top-level landing pages (The Risk / Local Environment / The Plan) are auth-gated (null over read
  access) — their Annotation slots (Executive Summaries etc.) could not be filled.
- 7 jurisdictional annexes = form pages (deferred; separate mechanism).
- Owner to review draft render on `schenectady-draft` and publish per page when satisfied.

## Punch-list / fidelity notes (pilot)
- **Link-label artifacts omitted** from Outreach Strategy: dangling SPA hyperlink labels with no URL
  in the capture — "Kickoff Presentation", "Mitigation Strategy Presentation", "Action Development -
  Instructions", "Mitigation Action Examples…", and the "Social Media Engagement:"/"Municipal Website
  Engagement:" link lists (L3529–3545). These are navigation anchors, not prose; excluded.
- Mitigation Representatives table, Planning Participants table, Meetings table, Adoption table,
  Existing Resources capabilities table = data components (auto-filtered by geoid) → not transcribed.
- Generic "Flooding Characteristics" block = covered by template shared Overview card → not transcribed.
- No source-embedded "INCLUDE WEBSITE"/"xxx" placeholders encountered in pilot content.

## Mapping density note (for batch decision)
The MNY 1.0 hazard profiles only carry county-specific prose in a "Local Impacts - [Hazard]" block
(+ occasional dated event). So most of the 11 per-hazard Annotation slots (Jurisdictional Assessment,
Built/People/Natural Local Risk Summary, Local Capabilities, Local Actions, Featured Strategy) have
NO source prose and will remain empty across the 17 hazard pages — only County Assessment (and
sometimes Featured Event / Local Hazard Summary) get filled. Chapter pages are richer.
