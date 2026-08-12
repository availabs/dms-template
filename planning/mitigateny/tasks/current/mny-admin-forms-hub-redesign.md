# MNY Admin Panel — Forms hub redesign (mockup)

**Project:** MitigateNY · **Topic:** themes · **Status:** IN PROGRESS · **Started:** 2026-08-06

## Objective

Redesign the live admin pattern's **Forms hub** (page `1336681`, pattern `566466`, app
`mitigat-ny-prod`, `/admin/forms`) as a single DMS-shaped HTML mockup in the mny design system.

**Scope narrowed by the user mid-session (2026-08-06):** the ask opened as "a redesign of the
admin pattern's Home (566463) *and* Forms (1336681) pages" as a linked series; the user then cut
it to **the Forms page only**. Home stays as-is; `pages/admin-home.html` (July) remains the only
Home-side mockup. The live-Home analysis below is recorded because it was already pulled and is
the context the Forms page sits in — it is **not** a commitment to build a Home redesign.

**Direction framing (user decision, 2026-08-06): direction-neutral.** The page must hold up
whether the admin panel is consolidated in place (Direction A) or slimmed to a DHSES console
(Direction B1) — see [`mny-admin-panel-directions.md`](./mny-admin-panel-directions.md). It
therefore designs *the dataset index itself* and deliberately takes no position on where the
planner forms ultimately live.

Deliverable is a **design mockup only** (plain HTML + Tailwind CDN, per
`src/dms/skills/designing-a-dms-design-system.md`) — not a live DMS build.

## Current state — live pull 2026-08-06

Pulled read-only via a Falcor `POST /graph` script (the CLI still hangs on Windows after the
response resolves — same symptom recorded in `mny-admin-panel-redesign.md`). Auth: dev creds
against `https://dmsserver.availabs.org/login`, `project: mitigat-ny-prod`.

### Pattern shape

| Measure | Value |
|---|---|
| Pages in pattern `566466` | **89** (the July reports said 112 — the tree has since shrunk; use 89) |
| Pages hidden from nav | **66 of 89 (74%)** |
| Pages under the Forms hub | **82**, of which **62 hidden** |
| Sections across the whole pattern | **527** |
| Top-level pages | Forms · Scenario Tools · Plan Manager · Home · PDF Export · Web Analytics · County Template |

### The Forms page as it exists (11 sections)

A title band, one intro paragraph, and **nine 1/3-width lexical cards** — DHSES Forms, Actions,
Capabilities, Hazards of Concern, High Hazard Dams, Participation, Jurisdictions, Capacities,
Roles. Every card is hand-written lexical: dataset name + one sentence off the same template
("X is an internally sourced data product created by DHSES to …") + a row of unlabeled links.

Problems the redesign has to answer:

1. **The descriptions say what a dataset *is*, never what to *do*.** Nine variations on one
   boilerplate sentence.
2. **No state.** Nothing on the hub says whether your county has filled anything in, how much is
   there, or what needs attention.
3. **Each card opens onto a pile of dev-named variants.** Per-dataset page counts under Forms
   (all hidden from nav):

   | Dataset | Pages | Variant slugs today |
   |---|---|---|
   | Actions | 12 | `card` `card_search` `list_search` `view` `edit` `edit_simple` `single_edit` `single_edit_simple` `single_edit_new` `create_full` `create_simple` `create_new` |
   | Capabilities | 10 | `card` `view` `view_simple` `edit` `edit_simple` `single_edit` `single_edit_simple` `single_edit_new` `create_full` `create_simple` |
   | Participation | 4 | `view` `edit` `create` `single_edit` |
   | Roles | 4 | `view` `edit` `create` `single_edit` |
   | Hazards of Concern | 3 | `create` `edit` `single_edit` |
   | Capacities | 3 | `create` `edit` `single_edit` |
   | High Hazard Dams | 1 | `single_edit` |
   | Other Forms | 36 | 11 sub-datasets incl. Policies, Mitigation Measures, Jurisdictions, LHMP Template, County Plan Status |

4. **"DHSES Forms" is a tenth catch-all card** pointing at *Other Forms* — 36 more pages,
   including two near-duplicate monsters: `Jurisdictional Entry Page` (88 sections) and
   `Jurisdictional Entry Page w Modals` (91 sections).
5. **Capacities sits next to Capabilities with no signal that one is being folded into the
   other** — and Capacities has **2 rows**.

### Row counts — measured 2026-08-06

Every figure below is a live `length` read on the bound view. Source/view ids are recorded so
they can be re-measured.

| Dataset | Source | Source id | View id | Rows |
|---|---|---|---|---|
| Hazards of Concern | `Hazards_of_Concern` | 1473470 | 1473471 | **27,567** |
| Actions | `Actions_Revised` | 1029065 | 1074456 | **18,382** |
| High Hazard Dams | `NYS_Dams` | 1459525 | 1459528 | **5,970** |
| Jurisdictions | `Jurisdictions` | 1346449 | 1346450 | **2,345** |
| Capabilities | `Capabilities_Catalogue` | 1068273 | 1172519 | **649** |
| Roles | `Roles` | 1473295 | 1473296 | **358** |
| Mitigation Measures | `Mitigation_Measures` | 1068274 | 1155800 | **249** |
| Participation | `Participation` | 1473468 | 1473469 | **216** |
| Policies | `Policy Database` | 1068983 | 1157190 | **126** |
| Capacities | `Capacities` | 1689772 | 1689773 | **2** |

**Note two figures that disagree with the July/August reports** and should be treated as the
current truth: Capabilities is **649** (reports said 269) and Hazards of Concern is **27,567**
(reports said 119). Both were measured on the view the live form pages actually bind.

**Binding-shape gotcha found during the pull:** most sections carry the source under
`element-data.sourceInfo`, but the Hazards of Concern sections use `element-data.externalSource`
instead. A script that only looks at `sourceInfo` reports HoC as unbound — it isn't.

### Live Home (566463) — recorded, not in scope

29 sections across 5 section groups. The "MitigateNY Dashboard" title band appears **three
times** (sections 2052649, 2052673, and again on Forms as 2050828); there is one section with no
element-data at all; and the Actions / Capabilities / Mitigation Measures / Policies stat Cards
and Graphs are interleaved with lexical link-cards for Roles, Participation and Export-to-PDF in
no discernible order. Kept here as context only — **not** part of this task's deliverable.

## Design decisions

1. **Keep a card index.** The card grid is the right primitive for a dataset hub; the problem is
   the cards' content, not their shape.
2. **One verb set on every card — Browse · Add · Bulk edit.** This is the collapse: three
   task-named actions replace the 12-way `single_edit_simple` / `create_full` / `list_search_old`
   sprawl. A card states how many legacy pages it stands in for, so the cleanup is visible.
3. **Two bands, because the verbs differ.** *Your plan data* (the six datasets a planner fills
   in) and *State catalogs* (reference the plan reads — Jurisdictions, Mitigation Measures,
   Policies, and the dam registry) which are look-up-and-annotate, not fill-in.
4. **State on every card.** Real row count in scope + a fill meter + last-touched.
5. ~~A "needs attention" band carrying the real findings.~~ **Cut 2026-08-06 — see the trim below.**
6. ~~Search box +~~ scope chip. **Search cut 2026-08-06;** the scope chip stays.
7. **Statewide scope by default,** so every headline number on the page is a real measured
   figure rather than an invented county slice.

### Trim — user request, 2026-08-06 (after first review)

Five elements were built, reviewed, and then cut. Recorded here because the reasoning behind
each is worth keeping even though the element isn't on the page:

| Cut | What it carried |
|---|---|
| **Needs-attention band** | The three real findings: Capacities' 2 rows + pending merge into Capabilities; the two live near-identical Jurisdictional Entry pages (88 vs 91 sections); the 62 hidden-but-linkable form variants. Each row had a link to the report that explains it. |
| **"Not shown above" ledger** | Named the 36 pages behind the live hub's *DHSES Forms* card, sorted into deferred / DHSES-internal / superseded-by-the-plan, plus the three report links. |
| **"About the numbers" provenance footer** | The measured-vs-illustrative disclosure and the two superseded report figures. |
| **Completeness-bar pill** | The band-1 caption marking the fill meters as illustrative. |
| **Search box** | Dataset/field search in the page header. |

**Two knock-on decisions made while trimming** (neither was asked for; both flagged):

- **The needs-attention *stat tile* went with its band.** It read "3 — listed below, with the
  fix", which pointed at nothing once the band was removed. The strip is now three tiles
  (`grid-cols-1 sm:grid-cols-3`) rather than four.
- **Nothing on the rendered page now distinguishes measured figures from illustrative ones.**
  Both disclosures (the pill and the provenance footer) were in the cut set. Row counts, page
  counts and source/view ids are real; **completeness bars and last-touched dates are not**. That
  distinction now survives only in the file's header comment and in this task doc — a reviewer
  reading the rendered page alone cannot tell them apart. Worth a decision before this page is
  shown to anyone outside the team.

All cut markup is recoverable from git history (the pre-trim version is the file's first commit).

## Alternative B — the insight view (added 2026-08-06)

User ask: *"make an alternative that provides key insights into each database. Expect this one's
audience to be a county planner. Each dataset only needs one button to navigate to its list view."*

Built as a **sibling, not a replacement** — `admin-forms-insights.html` alongside
`admin-forms.html`. The two are cross-linked in the footer and both sit in the `Admin Panel`
`ds-nav` section.

| | A · `admin-forms.html` | B · `admin-forms-insights.html` |
|---|---|---|
| Audience | audience-neutral | **county planner** |
| Scope | statewide | **Sullivan County (36105)**, 23 jurisdictions |
| Card leads with | dataset name + what it's for | **a finding about this county** |
| Actions per card | 3 (Browse / Add / Bulk edit) | **1 (open the list)** |
| Card order | fill-in band, then catalogs | **urgency** — empty datasets sort above healthy ones |
| Numbers | row counts real; fill bars illustrative | **all real, no illustrative values** |

**Why a county scope.** "County planner" makes statewide totals the wrong denominator — a planner
needs *their* numbers. Sullivan is the specimen county the rest of this design system already
uses (`pages/county-actions/*`), so the findings are real findings.

### County-scoped figures — measured 2026-08-06

Filtered `length` reads on each bound view (the `dms.data.{type}.options.{key}.length` Falcor
path with a `filter` on the geography column):

| Dataset | Filter that works | Rows in Sullivan | Statewide |
|---|---|---|---|
| Hazards of Concern | `geoid_county` = `36105` | **374** | 27,567 |
| High Hazard Dams | `geoid` = `36105` | **306** | 5,970 |
| Roles | `county` = `Sullivan` | **79** | 358 |
| Participation | `county` = `Sullivan` | **29** | 216 |
| Capabilities | `geoid_county` = `36105` | **2** | 649 |
| Actions | `geoid_juris` = `36105` | **61** (county's own only) | 18,382 |

**Geography-column gotcha, worth keeping.** The county key is *not* uniform across these sources:
Hazards of Concern and Capabilities use `geoid_county`, Roles and Participation only match on the
`county` *name*, NYS Dams uses a bare `geoid`, and Actions uses `geoid_juris`. On Actions,
`county_geoid = 36105` returns **1** row and `county = 'Sullivan'` returns **0** — neither is a
usable county filter. The server's `options` path also **does not support a `like` operator**
(every `like` probe returned 0), so there is no prefix match on `geoid_juris` to roll a county up
from its jurisdictions. Any real county-scoped Actions rollup needs an `IN` over the county's 23
jurisdiction geoids, or a groupBy — not a single filter.

Because of that, the Actions card uses the **475 across 23 jurisdictions** figure already
established in this design system (`design/README.md` + `pages/county-actions/`), together with
the two documented findings — county priority unset on all 475, and no action carrying a site
coordinate (472 mapped actions on 26 centroids).

### Revision 2 — quantitative insights (user request, 2026-08-06)

*"All insights should be quantitative. View the columns and data of each dataset to see what
metrics would be of use. Exchange the narrative insights for a one or two sentence description of
each dataset. Remove the status badge. Remove the word 'List' from all buttons."*

Card anatomy is now: **name → 1–2 sentence description → four measured metrics → one button**.
No status badge; the left border still carries urgency and still drives card order. Buttons read
"Open actions", "Open capabilities", etc.

**Measured breakdowns now on the page** (each one a `filter` + `length` query per option value):

| Dataset | Breakdown |
|---|---|
| Actions (county's own 61) | `action_status`: Proposed–Not Started **35** · Completed **18** · In-Progress **1** · Discontinued **1** · no matching status **6** |
| Hazards of Concern (374) | `hazard_of_concern = 'Yes'` → **90** (24% flag rate) |
| Roles (79) | `required_stakeholder = 'Yes'` → **12** |
| High Hazard Dams (306) | `hazard_code`: A **247** · B **33** · C **14** · uncoded **12** |

The Actions split cross-checks against `pages/county-actions/jurisdictions.html`, which documents
the county's own 61 as 35 proposed / 18 done from the same source.

### Revision 3 — the longevity rule (user request, 2026-08-06)

*"I think the crux of my preference is longevity. Some of them would lose value after the initial
setup process for each county. For example # of Jurisdictions with None in Capabilities is a
valueless field once the county fills those in."*

**The rule, now written into the page's header comment so it survives:** every metric must still
be worth reading in **year five** of the plan cycle. Revision 2's metrics were largely
*onboarding* measures — they track one-time setup, go to zero or to a constant when a county
finishes, and are dead weight afterwards.

**Three families survive; everything on the page is now one of them:**

| Family | Why it lasts | On the page |
|---|---|---|
| **Recency** | A catalog verified in 2023 is a different object from one verified last month. Never stops mattering. | Capabilities "verified since 2024" / "never verified"; Participation "meetings this year" |
| **Mix** | The distribution across a status / class / role moves every year as work happens. | Actions progress mix; HoC likelihood profile; Roles composition; dam hazard classes |
| **Rate** | A normalised ratio a big county and a small one can both read. | % complete, concern rate, per-jurisdiction averages |

**Cut in this revision:** share-of-statewide (static trivia), "jurisdictions with none" (the
user's own example), bare statewide totals, "records in county" as a fill count, "0 with county
priority" (a one-time setup gap).

**Two structural knock-ons:** card order changed from *thinnest data first* — itself an
onboarding ordering — to **operational weight** (Actions → HoC → Participation → Roles →
Capabilities → Dams). And the coloured left borders were made uniform: with no status badge and
no urgency ordering left, a coloured border implied a status judgement the metrics no longer make.

### Revision 4 — six targeted metric swaps (user request, 2026-08-06)

| Card | Was | Now | Note |
|---|---|---|---|
| Actions | "underway now" | **"in progress"** | label only; value unchanged (1) |
| Hazards of Concern | 24% concern rate | **12 low likelihood** | completes the likelihood tiers (52 / 26 / 12) |
| Participation | 8 in prior years | **45 hours of meetings** | summed from the `duration` column |
| Roles | 12 required stakeholders | **5 floodplain administrators** | reviewer couldn't tell what `required_stakeholder` meant; a named role is self-evident |
| Capabilities | 128 verified since 2024 · 309 never verified · 20% verified recently | **243 technical assistance · 148 financial support · 136 address flooding** | "verified" wasn't interpretable in this context; replaced with catalog composition. Count (649) kept |
| High Hazard Dams | 15% above low hazard | **247 class A — low hazard** | |

Knock-ons: the Capabilities **currency bar went with its metrics** (the card now has no
proportional bar, like Participation and Roles), and the Roles **description** was reworded — it
still said "…and whether they are a required stakeholder", describing a field no longer shown.

### Revision 5 — chrome trim, reorders, two metric swaps (user request, 2026-08-06)

- **Intro narrative made county-agnostic** — "…stands for Sullivan County today" → "…for your
  county today". The page is a template; only the scope chip should name a county.
- **Removed the "23 jurisdictions · FIPS 36105" line** under the county dropdown.
- **Removed the narrative line under all three bars** (Actions, HoC, Dams). The uppercase label
  above each bar stays; the per-segment values survive as `title` tooltips.
- **Actions reordered** → total · not yet started · in progress · completed.
- **Participation reordered** → logged all-time · this year · per jurisdiction · hours.
- **Roles**: "3.4 per jurisdiction" → **"4 NFIP coordinators"**. Pairs with floodplain
  administrators, so the card now reads as total + role composition on one axis.
- **Capabilities**: "136 address flooding" → **"153 education & outreach"**. The reviewer's
  instinct was right — flooding is a *hazard* sitting alongside two *assistance types*, mixing
  axes. The card is now four consistent slices of one question (what kind of help is available):
  649 catalog · 243 technical assistance · 148 financial · 153 education & outreach.

#### Revision 5b — no figures in prose

Follow-up in the same round: **numbers belong in metric tiles, never in narrative.** Swept every
visible prose block and label:

- Actions description — dropped "475 across the county in all"; the scope note survives as
  "The figures below cover the actions the county itself leads." **Consequence: the countywide
  475 no longer appears anywhere on the page.** It is still in this task file and in the page's
  header comment; raise it if that figure is wanted back, as a tile rather than as prose.
- HoC bar label — "Likelihood profile of the 90 concerns" → "Likelihood profile".
- Intro — "The **six** datasets your plan is built from" → "The datasets…". Also better for
  longevity: a hard-coded count goes stale the moment a dataset is added or retired.

All seven prose blocks and all three bar labels are now number-free; per-segment values remain
available as `title` tooltips on the bars.

#### Scope defect found and fixed while reordering the Actions card

Reordering to `total · not started · in progress · completed` turned the row into four counts,
which **invites addition** — and the four were not one set. The total was **475 countywide**
while the status counts were the **county's own 61** (35 + 1 + 18 = 54, leaving 421 silently
unexplained). With the old "30% completed" tile the mismatch was hidden; as counts it would have
read as a straightforward error.

Fixed by scoping all four tiles to one set: **61 county-led actions** · 35 · 1 · 18. The
countywide 475 moved into the card's description sentence, so the number is not lost, and the
bar heading dropped from "Progress on the county's own 61" to just "Progress" since the tiles now
establish the scope.

Root cause is the constraint recorded above: **the countywide 475 has no measurable status
split** (no `like` operator, no row values, so no IN over the county's jurisdiction geoids). If
that is ever unblocked, this card should show the countywide breakdown and the scope note can go.

### New measurements taken for revision 4

- **`role` is a 52-option select with usable counts** (Sullivan, 79 people; 32 matched an
  option): Mayor/CEO 7 · Elected Official 7 · Highway Superintendent 7 · **Floodplain
  Administrator 5** · NFIP Coordinator 4 · Public Works 2. A good source of self-explanatory,
  durable role metrics.
- **Capability-catalog composition.** The useful Capabilities columns are `checkbox` type with
  **no option list**, so they look uncountable — but the encoding is a **lowercase `'x'`**. Once
  known, they all count (statewide, 649): `administrative_technical` 243 · `education_outreach`
  153 · `financial` 148 · `flooding` 136 · `environmental_protection` 120 · `climate_adaptation`
  104 · `coastal_hazards` 78 · `extreme_heat` 56 · `drought` 32 · `grant` 28 · `discontinued` 27
  · `planning` 20 · `earthquake` 15. **These overlap** (one capability can be several), so they
  must not be stacked into a proportional bar — hence no bar on that card.
- **Participation duration → 45 hours.** `duration` is a NUMBER column and sums can't be read
  back (withheld values, below). Counted per distinct value and multiplied out instead:
  `0.5h × 8 + 1h × 1 + 2h × 20 = 45`, covering all 29 of 29 meetings. **This is a derived
  figure, not a live sum** — re-derive it the same way if the meeting count changes.

### New measurements taken for revision 3

Range operators **do** work on the options path (`gte` / `lt`), which is what unlocked the
recency family. Verified with a discriminating sweep rather than a single query:

| Measure | Result |
|---|---|
| Capabilities `date_verified_or_updated` gte 2000 / 2024 / 2025 | 340 / 128 / 2 of 649 → **309 never verified, 128 since 2024, 212 earlier** |
| Participation `date` gte 2025 / 2026 / 2030 | 29 / 21 / 0 → **21 meetings this year, 8 in prior years** |
| HoC `likelihood` | High **52** · Medium **26** · Low **12** (= exactly the 90 flagged concerns) |
| Roles `hm_representative` | Yes **35** · No **44** |

### ⚠ Recency is not safe on every date column — sanity-sweep first

These are **text** columns compared as **strings**, so a column holding mixed date formats gives
nonsense. Actions `action_status_date` gte `'2030-01-01'` returns **48 of 61** — US-style values
like `"9/15/2024"` sort above `"2030"` because `'9' > '2'`. `action_creation_date` is similarly
suspect (gte 2024 and gte 2026 both return 8).

**Before trusting any date metric, sweep it with gte 2000 and gte 2030**: a well-formed ISO
column returns *everything* then *nothing*. There is deliberately **no recency metric on the
Actions card** for this reason — which is a shame, since "actions with no status update in 12
months" would be the single most durable metric on the page. Normalising `action_status_date` to
ISO would unlock it, and is worth logging as its own data-quality task.

### Two data routes that do NOT work — don't re-try them

Both were attempted while looking for per-column metrics; recording them so the next session
doesn't repeat the dead ends.

1. **Row values are withheld on the dataset routes.** Requesting `['id','data']` — or named
   columns — under `dms.data.{type}.options.{key}.byIndex` returns atoms with **no value**
   (literally `{"$type":"atom"}`) for every dataset in this pattern. `length` works; row contents
   do not. Confirmed against the raw `POST /graph` response, so it isn't a client bug — and note
   the CLI's own `dataset dump` / `dataset query` use this exact path, so they are affected too.
   Consequence: **no client-side profiling.** Every breakdown must be a counted query against a
   value you already know, which is why the option lists in the section column metadata matter.

2. **`groupBy` lengths are not trustworthy as distinct-counts.** A `groupBy` on the Actions
   `jurisdiction` column returned **61** for 61 rows that are all a single jurisdiction; HoC
   `has_actions` returned **374** for 374 rows. Some columns do look correct (`action_status` = 4,
   matching the four counted values) but there is no way to tell which from the outside.
   **Nothing on the page uses a groupBy length** — an earlier draft did, and the numbers were
   wrong.

3. **No `like` operator on the options path** (every probe returned 0), so a county-wide Actions
   rollup can't be done by prefix-matching `geoid_juris`. It needs an `IN` over the county's
   jurisdiction geoids — which needs row values, see (1). Hence the Actions card's countywide
   figures (475 / 23 jurisdictions / 0 prioritized) still come from the established repo values,
   visually separated on the card from the 61 measured here.

### Claims deliberately weakened for accuracy

Two headline findings were inferences on first draft and were rewritten to state only what the
measurements support:

- **Capabilities** — "21 of your 23 jurisdictions have nothing recorded" assumed the 2 rows sit
  in 2 distinct jurisdictions. Changed to "two rows can cover two jurisdictions at most, so **at
  least** 21 of your 23 have nothing", and the tile reads `21+`.
- **Hazards of Concern** — "the full grid is filled" assumed even distribution across
  jurisdictions. Changed to show the arithmetic instead (23 × ~16 ≈ 368 expected, 374 present →
  "essentially complete") and to tell the planner to spot-check that coverage isn't concentrated.

## Live build — page 2369408 "Forms Redesign" (2026-08-06)

User created a blank page in the admin pattern and asked for the insight design to be built there
as a functional page.

**Target:** page `2369408`, app `mitigat-ny-prod`, type `admin|page`, slug `forms_redesign`,
top-level, index 7. Was blank (`sections: []`, `draft_sections: []`, one `default` section group).

**Built: 13 draft sections** — a page header lexical, then per dataset a lexical (title +
description + link button) followed by a `Card` (the metric row). Ids `2369663`–`2369675`.

**DRAFT ONLY.** `draft_sections` written; `sections` / `section_groups` untouched. The page is
not published — that is a human action (`dms page publish`).

Scripts (gitignored scratchpad, re-runnable):
`scratchpad/mitigateny/work/build_forms_redesign.mjs` (idempotent: clears `draft_sections`,
recreates, full-replaces the id list) and `verify_forms_redesign.mjs`.

### ⚠ CORRECTION — the theme DOES support section border/radius/padding

The "forced by the theme" note below is **wrong** and is kept only so the mistake is traceable.
The user reshaped two sections by hand and demonstrated that per-section **object-shaped**
`border` / `radius` / `padding` / `bg` fields all work on this pattern:

```json
{"size":"1/2","border":{"top":true,"left":true,"right":true},
 "radius":{"tl":true,"tr":true},"padding":{"bottom":"0"},"bg":"white"}
```

I had checked `pages.sectionArray.styles[0]` in `src/themes/mny/theme.js`, seen no `border` map,
and concluded the feature was unavailable — but these fields are read by
`sectionArray.jsx` in the **library**, with theme-independent fallbacks. **Absence from the theme
override is not absence of the feature.** Check the component, not just the theme.

They also showed the **modern Card display keys** — `cellsGridSize` / `cellsGridGap` /
`cellsPadding` / `cardsGridSize` / `cardsGridGap` / `cardBorder` / `cellBorder` — where I had
copied the legacy `gridSize` / `gridGap` / `padding` trio off an old live card.

**Reshaped accordingly (2026-08-06):** all six cards are now 2-up fused pairs — header lexical
(`size 1/2`, border top/left/right, radius tl/tr, padding-bottom 0) fused to its metrics Card
(`size 1/2`, border left/right/bottom, radius bl/br, padding-top 0), with `draft_sections`
reordered so each grid row holds two headers then two cards. Per-cell borders and tints were
turned off to match the design's plain tiles. Scripts: `reshape.mjs`, `seam.mjs`, `cells.mjs`,
`cellbg.mjs` in `scratchpad/mitigateny/work/`.

### ⚠ FINDING — the design system and the live theme use two different token vocabularies

Reviewer: *"The implementation style does not look like the tokens noted in the Design theme
page."* Correct, and the cause is bigger than this page.

`design-system/theme.html` + `design/README.md` declare tokens as
**`displayHero/XL/LG/MD/SM/XS`, `metaLG/MD/SM/XS`, `proseLG/prose/proseSM/proseXS`**.
`src/themes/mny/theme.js` implements the **same scale under different names** —
**`textXS…text8XL`** plus `…Reg`/`…SemiBold`/`…Bold` prose variants. Nothing in the live theme
answers to a design-system token name, so an author following the design system's own
documentation cannot pick the right value in the `valueFontStyle` dropdown.

| Design-system name | Live key | Spec |
|---|---|---|
| `displayHero` | `text8XL` | Oswald 96px |
| `displayXL` / `displayLG` / `displayMD` | `text7XL` / `text6XL` / `text5XL` | 72 / 60 / 48px |
| `displaySM` / `displayXS` | `text4XL` / `text3XL` | 36 / 30px |
| `metaLG` / `metaMD` / `metaSM` / `metaXS` | `text2XL` / `textMD` / `textSM` / `textXS` | Oswald 24 / 16 / 14 / 12px uppercase |
| `prose` / `proseSM` / `proseXS` | `textMDReg` / `textSMReg` / `textXSReg` | Proxima 16 / 14 / 12px |

**Fixed on the page (2026-08-06):** metric values were `text5XL` — that is `displayMD`, **48px**,
roughly double the intended size — now `text3XL` (`displayXS`, 30px). Labels had **no**
`headerFontStyle` at all and fell back to component defaults; now `textXSSemiBold`. Card titles
were lexical `h3`, which this theme maps to **16px Oswald, not uppercase** (hence the small
sentence-case "Actions"); now `h2` = 24px Oswald, the declared `metaLG` card-title size.

**Two follow-ups this exposes, both bigger than this page:**

1. **Reconcile the vocabularies.** Either alias the design names onto the live theme's
   `textSettings` (so `displayXS` works in the dropdown) or renumber the design system to the
   t-shirt names. Until then every implementation of an mny design will drift the same way.
2. **The mockup is itself off-token.** `admin-forms-insights.html` uses `text-[26px]` for tile
   numbers, `text-[11px]` for labels and `text-[20px]` for card titles — **none of which are in
   the declared token table** (nearest: 30 / 12 / 24). This is the same earlier-flagged drift
   between the README's token table and the built pages, now biting in implementation: the
   mockup can't be matched exactly because it was drawn off-scale. The live page is now on the
   nearest *declared* tokens rather than the mockup's invented sizes — deliberately.

### Padding, buttons, three-piece card (2026-08-06)

**Padding was a no-op, not a wrong value.** mny's `pages.sectionArray.styles[0]` ships
`sectionPadding: 'p-0'` and **no `paddings` map / no `defaultPaddingStep`**, so the per-side
padding *objects* I set (`{bottom:'0'}`) resolved to empty strings — the page had literally zero
inner padding (measured: every wrapper `padding: 0px`). `resolvePadding()` passes a **string**
through verbatim, which is the working path on an un-migrated theme:

```
header  px-5 pt-4 pb-3   metrics  px-5 pt-3 pb-3   footer  px-5 pt-3 pb-4
```

**Button style names must match a `theme.button.styles[].name` exactly.** I passed
`style: 'default'`, which matches nothing — the first style is literally named
`'default Buttons'` — so every button fell back to `styles[0]`, the white ringed one. The
design's yellow CTA pill is **`primarySmall`** (`bg-[#EAAD43]`, `rounded-full`).

**Cards are now three fused sections** (buttons moved out of the header to the card foot, per
review):

| Piece | border | radius | padding |
|---|---|---|---|
| header (title + description) | top, left, right | tl, tr | `px-5 pt-4 pb-3` |
| metrics Card | **top**, left, right | — | `px-5 pt-3 pb-3` |
| footer (CTA button) | left, right, bottom | bl, br | `px-5 pt-3 pb-4` |

The metrics piece's **top border is the divider** between narrative and numbers — reviewer asked
to keep it, so it is now explicit rather than incidental. Six new footer sections:
`2373829`–`2373834`.

### Capabilities rebuilt — the bound view was reloaded mid-session

View `1172519` went from **649 → 3077 rows** during this session (confirmed by the owner as a
legitimate data update). Two consequences:

- **The category checkboxes are empty in the new load.** `administrative_technical` / `financial`
  / `education_outreach` match no value; the `'x'` encoding now survives only in the **old
  269-row view 1601256**. So the design's "what kind of help is available" breakdown rendered
  0/0/0 and **cannot be reproduced from the current data**.
- **`geoid_county` is now 88% populated**, so this card can finally be **county-scoped like every
  other card** — previously Capabilities had only 2 Sullivan rows and had to sit statewide.

Rebuilt county-scoped with metrics that the current data supports: **320** in your county · **291**
with a lead agency · **192** described (of 3077 statewide). Description updated — it no longer
calls itself a statewide catalog. Script: `cap_fix.mjs`; the populated-column probe that found
this is `cap_pop.mjs` (uses `gte` on a low sentinel as an "is not empty" test, since no such
operator exists).

**Standing risk this exposes:** these cards are bound to a *view id*, and a view's contents can be
replaced under them. Any metric that depends on a value encoding (`= 'x'`, `= 'Yes'`) can silently
go to zero on a data reload. Worth a periodic re-check, or metrics defined on columns less likely
to be re-encoded.

### ⚠ Section `padding` is the OUTER GUTTER, not inner padding

The single most costly misunderstanding in this build. `sectionArray` draws a section's
border / radius / bg on an **inner box placed inside** the section's padding. So padding
**separates** cards; it never pads their contents.

Setting `px-5 pt-4 pb-3` on the header and `pt-3` on the metrics therefore put **24px between the
two boxes' edges** (measured), rendering every card as three floating boxes instead of one. Fixed
by zeroing the **shared** edges — now measured `gap_header_to_metrics: 0`, `gap_metrics_to_footer:
0`, all three x-aligned:

| Piece | padding | border | radius |
|---|---|---|---|
| header | `px-5 pt-5 pb-0` | top, left, right | tl, tr |
| metrics | `px-5 pt-0 pb-0` | **top**, left, right | — |
| footer | `px-5 pt-0 pb-5` | all four | bl, br |

Horizontal `px-5` is kept deliberately — that IS the gutter between the two columns.

**Which section fields actually do anything on this theme** (mny defines none of the chrome maps
itself; `border`/`radius` resolve through library defaults, the rest do not):

| Field | Works? | Note |
|---|---|---|
| `border` object | ✅ | via library `borderSides` |
| `radius` object | ✅ | via library `radiusCorners` |
| `padding` **string** | ✅ | literal Tailwind; the **object** form is a **no-op** (no `paddings` map / `defaultPaddingStep`) |
| `bg` | ⚠️ | only a literal `bg-…` class — `bg:'white'` was a silent no-op (no `backgrounds` map) |
| `size` | ✅ | `'1/2'`, `'2'` |

### ⚠ Open: lexical text sits flush against the card border

`richtext.contentPadding` is **`'p-0'` globally** in `src/themes/mny/theme.js`, so lexical
sections have zero inner padding — measured text inset from the border: **1px**. Inner padding is
the component's job (the Card has `cellsPadding`, now 16), but for lexical the only lever is that
**global** theme value, which affects every mny lexical section on every page.

So the design's `px-5` inner padding **cannot be achieved from page config alone**. Options:
(a) change `richtext.contentPadding` to `p-4`/`p-5` site-wide — likely an improvement everywhere
but a broad change needing a design call; (b) leave text flush. **Not changed unilaterally.**

### Design ⇄ draft comparison (2026-08-10)

Systematic pass comparing `pages/admin-forms-insights.html` against the live draft.

**Closed in this pass**

| Aspect | Fix |
|---|---|
| Card titles sentence-case | Uppercased the heading **text** — the theme's `heading_h2` is Oswald 24px but *not* uppercase, and there's no 20px uppercase heading, so case has to come from the content |
| Column gutter 40px vs design's 16px | `px-5` → `px-2` on all 18 sections; cards gained ~24px width each |
| Labels wrapping to 3 lines | Mostly a narrow-preview artifact — at 1600px they fit on one line. Also cut `cellsPadding` 16 → 6 and `cellsGridGap` 8 → 4, which was stealing cell width |

**Already matching:** 2-up fused card silhouette · divider above the metrics · tinted footer band ·
yellow `primarySmall` CTA · left-aligned metric cells (Card's `justify` already defaults to left) ·
all six metric sets bound to live county-scoped data.

**Characteristic differences that remain, and why each is not page-config**

| Aspect | Design | Draft | Blocker |
|---|---|---|---|
| Inner padding | 20px inside the card | ~1px (lexical), 6px (cells) | `richtext.contentPadding: 'p-0'` is **global** in the theme — section padding is the outer gutter, so there is no page-level lever |
| Card radius / shadow | 12px + `mny-shadow-sm` | 8px, no shadow | radius comes from the library `radiusCorners`; `bg` accepts only `bg-…` classes, so no shadow hook |
| Description size | 14px | 16px | theme ships no `textSettings`, so `styled()` tokens are unavailable to lexical |
| Metric value | 26px | 30px (`displayXS`) | 26px is **not a declared token** — the mockup is off-scale (see the token-vocabulary finding above) |
| Metric label | 11px | 12px (`proseXS`) | no 11px token declared |
| Coloured values (52 red · 26 orange · 12 green) | yes | all ink | **no per-column colour option exists** — `Card.jsx` has no `color`/`valueColor` attr. Needs a small theme column type |
| Proportional bars ×3 | yes | none | no stacked-bar column type; needs a column type or a Graph section |
| Button arrow icon | `→` | text only | lexical `button` node has no icon slot |
| Breadcrumb + county chip | yes | none | the chip is an interactive control, not a section |

**Assessment:** structure, data, and chrome now match. The residual gap is almost entirely
**typographic scale and colour**, and every item traces to one of two root causes already logged —
the design-system/live-theme **token vocabulary split**, and `richtext.contentPadding: 'p-0'`.
Closing them is a theme change, not more page config.

### Still short of the design

| Gap | Fix |
|---|---|
| Card titles render small sentence-case ("Actions"); design is Oswald uppercase 20px | lexical `h3` maps to a heading style that doesn't match — needs a different tag or a styled token |
| Button sits above the metrics; design puts it at the card's foot | a third fused section per card (border left/right/bottom moves to it) — 6 more sections |
| No proportional bars (Actions progress, HoC likelihood, dam classes) | no stacked-bar column type exists; needs a theme column type or a Graph section |
| Metric labels wrap to two lines ("COUNTY-LED / ACTIONS") | shorter labels or a smaller label token |

### Superseded layout note — kept for traceability

The mockup is a **2-up grid of bordered cards**. The admin pattern's theme
(`src/themes/mny/theme.js` → `pages.sectionArray.styles[0]`) ships **no `border`, `radius` or
`padding` maps** — only `container`, `gridSize`, `sectionPadding: 'p-0'`, `layouts` and `sizes`.
So the fused-card chrome pattern (§5.6.10 of `creating-pages-from-a-design-pattern.md`) has
nothing to render with on this theme, and a 2-up layout would have produced unboxed text
floating in two columns.

Built **full-width stacked** instead (`size: "2"`, the theme's 12-col key), which reads correctly
without card chrome and gives the 4-metric row the full width it wants. Adding
`border`/`radius`/`background` maps to the mny `sectionArray` theme is the enrichment that would
let this page match the mockup — worth doing, since every future mny page benefits.

Also note the theme's `sizes` keys are written `"1\4"`, `"1\3"`, `"1\2"`, `"2\3"` — **backslashes,
not forward slashes**, so `\4`/`\3`/`\2` are parsed as octal escapes and those keys are corrupt.
Live sections use `"1/2"`, `"1/3"`, `"2"`, which resolve through the default theme. Fixing those
keys is a small separate bug.

### Metric bindings (all measured filters, verified server-side)

| Card | Source / view | Filter | Metrics |
|---|---|---|---|
| Actions | `Actions_Revised` 1029065 / 1074456 | `geoid_juris = 36105` | count · `action_status` CASE WHEN ×3 |
| Hazards of Concern | `Hazards_of_Concern` 1473470 / 1473471 | `geoid_county = 36105` | `hazard_of_concern='Yes'` · `likelihood LIKE 'High/Medium/Low Likelihood%'` |
| Participation | `Participation` 1473468 / 1473469 | `county = 'Sullivan'` | count · `date >= '2026-01-01'` · `SUM(CAST(duration AS numeric))` |
| Roles | `Roles` 1473295 / 1473296 | `county = 'Sullivan'` | count · `hm_representative='Yes'` · `role='Floodplain Administrator'` · `role='NFIP Coordinator'` |
| Capabilities | `Capabilities_Catalogue` 1068273 / 1172519 | none (statewide catalog) | count · `administrative_technical/financial/education_outreach = 'x'` |
| High Hazard Dams | `NYS_Dams` 1459525 / 1459528 | `geoid = 36105` | count · `hazard_code = C/B/A` |

**Participation ships 3 metrics, not 4.** "Per jurisdiction" (29/23) needs the county's
jurisdiction count, which is not derivable from the Participation source — the 23 comes from the
county, not from meeting rows. Left off rather than faked.

### Live verification + three bugs fixed (2026-08-06, devmny.org)

Checked at `https://devmny.org/admin/edit/forms_redesign` (auth by seeding an API-minted JWT into
`localStorage.userToken` for that origin — never typed into the sign-in form). **First render: the
metric tiles showed labels but no numbers.** Three causes, all documented in
`skills/using-a-datawrapper-card.md`, all now fixed:

1. **Source binding shipped without its `columns` schema** (§1.3) — the renderer can't resolve
   field names, so the card paints blank. I had trimmed `sourceInfo` down to ids. Fixed by pulling
   each dataset's real binding **verbatim** from a working live section (Recipe A) — 134 / 23 / 15
   / 19 / 130 / 43 columns respectively.
2. **Calculated columns not marked** (§1.6) — added `origin: 'calculated-column'`, `normalName`,
   `display: 'calculated'`, and lowercased the alias keyword (` as `, the sniffer's test) .
3. **No `display.fetchMode`** (§3.5) — without it a card renders its saved `data` blob and never
   fetches. Set `fetchMode: 'force'` (running counts, no param to signal change) + `pageSize: 1`
   (aggregate-only card).

**Cause 3 also explains a live-site bug worth reporting separately: the existing `/admin/home`
cards are stale.** They render 16,114 actions and 647 capabilities from a baked `data` blob; the
true current values are **18,382** and **649**. Those cards have no `fetchMode`, so they have been
showing frozen numbers since whenever they were last saved.

Second pass fixed two more:

4. **Hazards of Concern ignored its county filter** — rendered 1030 / 406 / 185 / 228 against a
   county subset of only 374 rows. Confirmed unfiltered by measurement: statewide
   `hazard_of_concern='Yes'` = **1030** and `likelihood High%` = **406**, matching the card
   exactly. It was the only card bound under the **`externalSource`** key; the five `sourceInfo`
   cards all filtered correctly. **Rebound as `sourceInfo` → now 90 / 52 / 26 / 12.**
   (A hypothesis that this was about excluding `Not Reported` values was ruled out by the same
   arithmetic — no metric over 374 rows can be 1030, and the metric already filters `= 'Yes'`.)
5. **Participation "hours of meetings" rendered blank** — the `CAST(NULLIF(…) AS numeric)` form
   produced nothing. Replaced with a regex-guarded case that cannot emit a non-numeric.

### Final rendered values — all six cards confirmed live

| Card | Rendered | Matches mockup? |
|---|---|---|
| Actions | 61 · 35 · 1 · 18 | ✓ |
| Hazards of Concern | 90 · 52 · 26 · 12 | ✓ |
| Participation | 29 · 21 · **49** | ✗ — mockup says **45** hours, see below |
| Roles | 79 · 35 · 5 · 4 | ✓ |
| Capabilities | 649 · 243 · 148 · 153 | ✓ |
| High Hazard Dams | 306 · 14 · 33 · 247 | ✓ |

**⚠ Open discrepancy — meeting hours: live engine says 49, the mockup says 45.** The mockup figure
was *derived*, not summed (`0.5×8 + 1×1 + 2×20 = 45`, from per-value counts covering 29/29 rows —
recorded as a derived figure in revision 4 above). The engine's `sum()` over the real values is the
more trustworthy of the two, and the gap is exactly `8 × 0.5`, i.e. the eight half-hour rows appear
to be summing as 1.0 each. Either the per-value probe mis-attributed those rows or the regex guard
is coercing them. **Resolve before either number is quoted**, and update
`admin-forms-insights.html` (currently 45) once settled.

Repair scripts: `scratchpad/mitigateny/work/fix_forms_redesign_cards.mjs` and `…_cards2.mjs`.

### ⚠ Verification status — superseded by the live check above

- **Verified:** all 13 sections exist and are attached (`draft_sections=13`, `sections=0`); every
  card's **filter resolves to exactly the expected row count** — 61 / 374 / 29 / 79 / 649 / 306,
  matching the figures measured independently for the mockup. So the source bindings and the
  county scoping are correct.
- **NOT verified:** the **rendered output** — i.e. whether each `CASE WHEN … fn:'sum'` column
  actually collapses to the single aggregate row and paints the four numbers. Out-of-band reads
  cannot see aggregate values (the withheld-values limitation recorded above), and the live site
  was not opened this session. The `fn`/column shape was copied verbatim from a **working** live
  card (section `2052669` on page 566463), which is the main reason for confidence — but it is
  copied, not observed.
- **Most likely failure mode if it renders wrong:** the SQL fragments that were *not* copied from
  a working example — the `LIKE 'High Likelihood%'` predicates on Hazards of Concern and the
  `CAST(NULLIF(data->>'duration','') AS numeric)` sum on Participation. If a card renders blank,
  suspect those first.
- **No proportional bars.** The mockup's three bars (Actions progress, HoC likelihood, dam
  hazard class) are not built — there is no stacked-bar column type in the theme, and a Graph
  section would need a different data shape. Metrics only.

## Files

- [x] `src/themes/mny/design/pages/admin-forms-insights.html` — **new (alt B).** County-planner
  insight view; see the comparison above.
- [x] `src/themes/mny/design/pages/admin-forms.html` — **new.** Flat `admin-` prefix to match the
  16 existing `admin-*.html` siblings (rather than a new folder), so relative paths to
  `../theme/`, `../assets/`, `../ds-nav.js` match the neighbours exactly.
- [x] `src/themes/mny/design/ds-nav.js` — new `Admin Panel` section registered so the page is
  reachable from every other mockup.
- [x] `src/themes/mny/design/README.md` — folder-map + section-table entries.
- No existing mockup page is modified.

## Progress

- [x] Live pull of pattern 566466 — page tree, Home + Forms sections, per-dataset row counts
- [x] Task file written with the plan (this file)
- [x] Build `admin-forms.html`
- [x] Register in `ds-nav.js` + README
- [x] Render check
- [x] First review → trim of five elements (see above), re-rendered and re-checked
- [x] Alternative B built (county-planner insight view), county-scoped counts pulled live,
      rendered + link-checked + `ds-nav` verified at 1440px
- [x] Alternative B revision 2 — quantitative insights, descriptions replace narrative, badges
      removed, "list" dropped from buttons; per-value breakdowns measured for Actions / HoC /
      Roles / Dams; re-rendered at 1440px and 900px, links + button text re-verified
- [x] Alternative B revision 3 — longevity rule applied; onboarding metrics replaced with
      recency / mix / rate; card order and border treatment changed accordingly; re-rendered
      and re-verified
- [x] Alternative B revision 4 — six metric swaps applied (see table above); Capabilities
      currency bar removed with its metrics, Roles description reworded; re-rendered and verified
- [x] Alternative B revision 5 — county-agnostic intro, chrome trim, two reorders, Roles and
      Capabilities swaps; Actions scope defect found and fixed (see above); re-rendered
- [x] **Live build** — 13 draft sections created on page 2369408 (draft only, not published);
      filters verified server-side
- [x] **Live-verified** at devmny.org — all six metric rows paint, five match the mockup exactly
- [ ] **Resolve the meeting-hours discrepancy** (live 49 vs mockup 45) and reconcile the mockup
- [ ] **Report separately: `/admin/home` cards are stale** — 16,114 / 647 rendered vs 18,382 / 649
      actual, because those cards carry no `fetchMode` and render a frozen `data` blob
- [ ] Consider whether the county scope should come from a page param rather than the hardcoded
      `36105` / `'Sullivan'` filters, so one page serves every county
- [ ] Consider adding `border` / `radius` / `background` maps to the mny `sectionArray` theme so
      this page can match the mockup's 2-up bordered cards
- [ ] Fix the corrupt backslash `sizes` keys in `src/themes/mny/theme.js` (`"1\2"` → `"1/2"` etc.)
- [ ] Decide whether the measured-vs-illustrative disclosure needs to return on alt A
      (alt B has no illustrative values, so it doesn't need one)
- [ ] Pick a direction: keep both views, or fold one into the other
- [ ] **Follow-up worth its own task:** normalise Actions `action_status_date` to ISO. It is
      currently mixed-format text, which blocks the most durable metric available for the
      Actions card ("no status update in 12 months") — see the sanity-sweep note above.
- [ ] Human review

## Testing checklist

- [x] Renders at 1440px with no horizontal overflow — checked in-browser, full scroll
- [x] Every internal link resolves to a real file in `pages/` or `reports/` — 14 links + 2 assets,
      all verified present on disk
- [x] `ds-nav.js` widget shows the page under its own **Admin Panel** section (3 pages, this one
      active) and jumps to all 7 other sections — verified by re-evaluating the on-disk script
      (the initial `<script>` load is aggressively cached under `file://`; a plain reload is not
      enough to pick up a `ds-nav.js` edit)
- [ ] **Type-token audit — NOT clean, and consistent with the corpus.** The page uses
      `text-[13px]` / `text-[11px]` / `text-[10px]` / `text-[18px]`, which are **not** in the
      README's declared token table. They were used deliberately: every `pages/*.html` sibling
      uses the same four sizes for breadcrumbs, captions, pills and card sub-heads, so matching
      the corpus was preferred over matching the table. The real defect is that the README table
      has drifted from the built pages — worth reconciling across the whole design system in one
      pass rather than making this page the odd one out. Not a blocker for review.
- [ ] Human visual pass
