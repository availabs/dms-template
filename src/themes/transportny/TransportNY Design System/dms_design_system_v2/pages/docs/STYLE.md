# TransportNY documentation — style guide

**Status:** v1 · 2026-09-04 (Phase 0) · owner: documentation build task
(`planning/transportny/tasks/current/platform-documentation-build.md`).
**Binding on every worker and every page.** §10 *Rulings* is append-only; a ruling outranks the section it amends.
Reference documentation: **Replica** (`documentation.replicahq.com` for datasets and methodology; `help.replicahq.com`
for how-tos and release notes), read 2026-09-04 — what we take from it and what we do differently is in §9.

---

## 1. What these docs are for, and who reads them

Three products on one platform (NPMRDS · TSMO · Freight Atlas), one documentation site at `/docs`, no login.
Readers, from the ticket corpus (research/docs-redesign/tickets-analysis.md §5):

| reader | arrives from | wants |
|---|---|---|
| NYSDOT program staff (central office) | a dashboard number they must defend | what the number means, its basis, whether it matches what they publish elsewhere |
| NYSDOT data / technical staff | a map, a table, a download | exact definitions, provenance to the plan or the federal rule, how to get the data out |
| MPO and county planners (SMTC, GBNRTC, Dutchess…) | a task ("compare regions", "verify which segments") | how to do the task, what the geography and period mean, what to cite |
| operations engineers | an incident or corridor | how to find it and read the page |
| developers / consultants | the API, a bulk download | quick start, reference, examples, what changed |
| administrators (few) | uploading data, building maps | procedures, permissions |

Half of all user feedback is a documentation request in disguise (report §04). The docs exist to answer
**"what does this number mean, on what basis, and how do I do the thing"** before a ticket is filed.

## 2. Voice and grammar

Replica writes methodology in an authoritative, technical register — first-person plural for the organisation
("Replica intentionally only acquires what data is necessary…"), present tense, 18–25-word sentences, terms
defined in one plain sentence before they are used ("Network links are the streets or pathways upon which
vehicles or people can travel."). Its how-tos and release notes switch to second person ("You now have the
choice to either view trip volumes on all network links or…"). We adopt that split and tighten it:

1. **How-to, start-here, screens pages: second person, imperative, present tense.** "Open **Reports**." "You see
   the template shelf." Never "the user should".
2. **Measure, data, concept pages: declarative present.** The subject is the measure or the data, not the reader
   or the team. "LOTTR is the 80th-percentile travel time divided by the 50th." Use **"we"** only where a choice
   was made by the platform team and the reader needs to know it was a choice: "We anchor the free-flow reference
   to a fixed year so that a deterioration shows as a deterioration." Never "AVAIL", never "the developers".
3. **One idea per sentence, ≤ 25 words, verb early.** No semicolon chains; no em dashes; parentheses only for
   abbreviations on first use — "Level of Travel Time Reliability (LOTTR)".
4. **Define before use.** The first sentence that uses a term either defines it in place or links its glossary
   entry. Expand every abbreviation and every formula variable on first use on each page (ticket 2195606).
5. **Headings are sentence case and say what the section answers**, not what it is: "How it is computed", not
   "Computation"; "Before you start", not "Prerequisites". H1 = the page's goal or the thing's name. H2 only for
   the page-type sections in §3; H3 inside them. Every H2/H3 has an `id`.
6. **Front-load.** The first paragraph states the answer or the outcome. Detail follows. A reader who stops after
   the first screen has the essential.
7. **UI labels verbatim and bold** (`<span class="ui">Macro View</span>`), exactly as on screen including
   capitalisation. No directional language ("on the left") — name the control.
8. **Plain words.** "use" not "utilise"; "shows" not "displays"; "because" not "due to the fact that". Technical
   terms stay exact; everything around them is plain (ONS, GOV.UK research: experts prefer it too).
9. **Numbers:** digits always ("5 minutes", "80th percentile"); thousands separators ("52,127 segments"); one
   decimal unless the source has more and the difference matters; units on every number; percent as "%" with a
   space in prose ("29.1 % of segments") and without in tables.
10. **Dates:** ISO in stamps and tables (`2026-08-28`); "August 2026" in prose. Years for data are **calendar
    years** unless stated ("CY 2025"). Never a bare "this year" or "recent".
11. **Tone:** confident, concrete, unhurried. No marketing ("powerful", "seamless", "the world's only…" — Replica
    does this; we do not). No apologies. State a limitation as a fact with its consequence: "Coverage is thin
    overnight, so overnight TTTR is estimable on 1.15 % of segments."

## 3. Page types and their mandatory shape

One page = one type. `data-doc-type` on `<main>` must match. The shell (`_template.html`) is fixed; the H2 set
below is the required section order — omit a section only if the page genuinely has nothing to put in it
(never leave an empty heading).

| type | job | required H2s, in order |
|---|---|---|
| **start** | one guided first success per hub (≈10 min) | What you will do · Before you start · Steps (one task, no options) · What you now have · Where to go next |
| **how-to** | one user goal, imperative title | Before you start (where · prerequisites · permission) · Steps (`ol.steps`, ≤ 12, one action each, `.result` after key steps) · Settings *(table.docs: Control · What it does · Values · Default)* · Limits and gotchas · Troubleshooting (2–3 real failures) · What next (≤ 5 links) |
| **screens** | what each panel of one page shows | What this page answers · Filters *(link to the filters page)* · one H2 per panel/section of the live page in screen order — each: what it shows · basis · how it is computed (2–3 sentences + link to the measure page) · reading notes · Downloads |
| **measure** | canonical definition and method | What it answers · How it is computed · Parameters and edge rules · The choices made, and why · How much to trust it · Worked example · Known limits · Comparability across years and versions · Where this appears · Revision log · Reproducibility · References |
| **data** | the datasheet (Replica dataset anatomy + Datasheets for Datasets) | Overview · Coverage and vintage · Schema *(table.docs: Field · Type · Sample value · Description)* · How it is produced · Uses and limits · Distribution (formats · access · cadence) · Where this appears · Revision log |
| **concept** | an explanation spanning measures/pages | (free H2s, ≤ 6) … ending with Where this matters |
| **recipe** | use case → tools → steps → sample output | The question · What you need · Steps · Reading the result · Variations · Sample output *(figure or table)* |
| **faq** | real questions, users' words | one H2 per question, verbatim from a ticket where possible, with the ticket id in a `<small>`; answer ≤ 120 words + link to the page that should have pre-empted it |
| **hub** | a landing page | What is here (cards) · Start here · Common tasks · Reference |
| **reference** | lookup (tables, decision tables) | free, table-led |
| **log** | dated entries | reverse-chronological H2 per date `YYYY-MM-DD · label`; labels: Platform · Data release · Map/TMC version · Methodology |
| **glossary** | terms | alphabetical `dl.defs`; each `dd` = one-sentence meaning · *Pathway:* product › screen · link to the canonical page |

**Header block (every page):** kicker (hub · type) · H1 · lede (what this page is for; whom it assumes) · stamps:
`type` · `applies to` (product + mount, or "all products", or "methodology vN") · `last reviewed` (ISO date) ·
`owner` (— until given) · optional `upcoming` (describes a release not yet live) · optional `gated` (needs sign-in).

**Measure page anatomy, expanded** (from the plan report §07; 281670's catalogue entries already follow the middle):
- *What it answers* — the `answers` and `definition` strings from `components/macroview/measures.js`, verbatim.
- *How it is computed* — numbered steps; the formula in `.formula` with every variable expanded in `.var`;
  percentile · time bins · stream · aggregation/weighting · rounding.
- *Parameters and edge rules* — thresholds with source; missing data; truck fallback; facility types; minimum-n; the floor.
- *The choices made, and why* — from `data-types/pm3/PROVENANCE.md` and the task record; say what the alternative
  was and what the measurement showed.
- *How much to trust it* — precision band, minimum-n bar, share of the network that clears it; comparison to the
  federal figure and the expected difference.
- *Worked example* — one segment, one period, reproducing a value visible in the tool (or `[VERIFY]`).
- *Where this appears* — `.where` chips: tools, report templates, API fields.
- *Revision log* — dated, one line per change to this page's method or numbers.
- *Reproducibility* — the download or API call that regenerates the figure.

## 4. Tables

- **Schema table** (data pages) — exactly Replica's columns: **Field · Type · Sample value · Description**; one row
  per field; sample values real; enumerations listed in the description ("`mode`: one of PRIVATE_AUTO, …").
- **Settings table** (how-to, screens) — **Control · What it does · Values · Default**; link measure names.
- **Decision table** (which-tool, which-measure) — **If you want to… · Use · Because · Not this**.
- **Coverage table** — **Source · Span · Lag · Cadence · Gaps**.
- Tables live in `.tablewrap` so they scroll on narrow screens; numeric columns use `class="num"`; no merged cells;
  no colour as the only signal; a caption sentence above the table says what it lists.

## 5. Numbers and basis statements

Every figure on every page states its **basis**, either in the sentence or in a `.callout.basis` for the section:
**geography** (statewide · Region 8 · Albany County · NYMTC) · **period** (CY 2025 · AM peak 06–10 · monthly series) ·
**vehicle class** (all vehicles · trucks · passenger) · **system** (Interstate · non-Interstate NHS · full network).
"Statewide" is written, never implied by a blank. Partial years are labelled partial. Every number traces to a
named source in the page's *References* or a footnote; if the writer cannot confirm it, it is written as
`<mark class="verify">[VERIFY: what · where to check]</mark>` and listed in the phase report — never guessed.

## 6. Terminology and naming (house rules from the tickets)

- Product names verbatim: **NPMRDS**, **TSMO**, **Freight Atlas** (never "the Atlas"), **TransportNY**, **Macro View**
  (not Macro Tool / Regional Analysis), **Reports**, **Route Comparison**, **Corridor View**, **Data & Downloads**.
- Data: "NPMRDS data" or "travel time data"; "Data freshness" (not "data currency"); "TRANSCOM events".
- Geography: "Region 8" (NYSDOT region, digit), "Albany County", the MPO's acronym then name on first use.
- Federal vs analytical: **MAP-21 / PM3 (federal)** for the submittal figures; **the analytical series** for the
  platform's own; never call the platform's pm3 numbers "federal".
- Never on a user page: view/source ids, table names, "v2 series", "methodology v2", "ClickHouse", "UDA",
  "falcor", ticket ids in prose (FAQ `<small>` excepted), design-system kickers (`// 01`).
- Formula variables expanded on first use: "TT₈₀ (the 80th-percentile travel time)".
- One term per concept; synonyms are banned once the glossary entry exists. New terms go to `_glossary-queue.md`.

## 7. Links, anchors, figures

- Internal links are relative filenames in this folder (`tsmo--filters.html#year`); every H2/H3 has a stable `id`
  (lower-kebab, from the heading text, never renumbered).
- Link text names the destination ("the LOTTR measure page"), never "here"/"Learn more"/"click".
- Cross-links are **bidirectional**: a tool page that shows a measure links to the measure page; the measure page
  lists that tool under *Where this appears*.
- Figures: `figure.shot` with either a real `<img alt="…">` captured from the live tool (state + date in the
  caption) or a capture spec — `data-capture="<url or UI state>" data-alt="<alt text>"` and a `.ph` placeholder
  naming the state. Screenshots only where they save words; never of text; never mocked. Annotations are CSS
  overlays, never baked in. Convention: `../../assets/screens/README.md`.
- Code and formulas: `pre.code` (dark) for commands/queries/JSON; `.formula` (bone) for equations.

## 8. Accessibility (Section 508 / WCAG 2.1 AA — this is a state DOT site)

Alt text on every image stating what it shows, not that it is a screenshot; heading order without gaps; link
text meaningful out of context; colour never the only signal (tables and callouts carry words); contrast per the
design system's palette; tables have header rows; video, if ever, has corrected captions and a transcript and is
never the only form of the instructions; no PDF-only content.

## 9. What we take from Replica, and what we deliberately do differently

**Take:** the dataset page anatomy (Overview → Sample → Schema → Methodology; our *data* type); the four-column
schema table; one plain defining sentence per term; naming a source with its vintage in the same sentence;
methodology at two depths (summary block up top, extended below — our header block + body); release notes
that announce a **data release** with its coverage and link to the schema/methodology; `updatedAt` on every
page (our stamps); markdown export / `llms.txt` (a Phase 9 pattern feature).
**Do differently:** one measure per page with a fixed anatomy (Replica puts many measures in one long
methodology); second person and imperatives in all task content (Replica's how-tos are video-led); no
marketing register; no first-person "we're thrilled"; ISO dates (Replica: `06.08.26`); public, login-free help
(Replica's how-tos sit behind Intercom); a public change log grouped by label rather than one narrative article.

Exemplars (verbatim, fetched 2026-09-04):
- Definition: "Network links are the streets or pathways upon which vehicles or people can travel."
  (documentation.replicahq.com/docs/network-links)
- Scope statement: "Most residential streets and service lanes are excluded from this dataset." (same)
- Join hint: "This table can be joined to the seasonal trip table using the unique stableEdgeId field." (same)
- Purpose sentence: "This document is written to provide a detailed explanation of the methodology used to
  create Replica's seasonal mobility model (Places)." (…/seasonal-mobility-model-methodology-extended-places)
- Assumption stated plainly: "It is assumed that the same individual uses the same vehicle throughout the day." (same)
- Limitation with mechanism: "Very short activities or local activities that happen within the range of
  localization accuracy can not be reliably detected." (same)
- Validation with a number: "…a stay of over 5 minutes in duration (over 85% detection accuracy)." (same)
- Section hand-off: "This section provides a brief overview of each category of data. How each data source
  integrates into the data processing pipeline is addressed in later sections." (same)
- Caveat on a field: "Note: Vehicle Fuel Type is only modeled for private auto trips." (…/disaggregate-trip-tables)
- Data-release note: "Fall 2025 seasonal data is now live across the United States, covering a typical weekday
  (Thursday) and a typical weekend day (Saturday) from September through November." (help.replicahq.com
  release notes) — the shape our *Data release* entries follow, in our register.
- Schema row: `distance · Integer · 318000 · "The distance (length) of the network link in millimeters."`

## 10. Rulings (append-only · date · phase · ruling)

- 2026-09-04 · P0 · Folder is `pages/docs/`, flat, `hub--slug.html`; underscore files are infrastructure/seeds (owner).
- 2026-09-04 · P0 · Legacy-site documentation is dropped; no `npmrds--legacy` page; the Batch Reports API page
  stays as developer reference until Route Comparison retires it (owner).
- 2026-09-04 · P0 · Phase order: Get started → TSMO + shared measures → Measures & Data → NPMRDS → Freight Atlas →
  Developers/Admin → utilities (owner).
- 2026-09-04 · P0 · Screenshots are a separate pass (Phase 8); writers leave capture specs only.
- 2026-09-04 · P0 · `[VERIFY]` marks must be resolved by the orchestrator before the next phase starts; a page
  is not 'reviewed' while one remains.
- 2026-09-04 · P0 · Second person + imperative in all task content; declarative present on measure/data/concept
  pages; "we" only for a platform choice.
- 2026-09-04 · P0 · ISO dates in stamps and tables; "Month YYYY" in prose; calendar years unless stated.
- 2026-09-04 · P2-prep · **CY 2025 statewide reliability figures.** The values 85.0 % (non-Interstate LOTTR) and 1.42 (TTTR)
  that appear in older mockups/handoff copy were a mixed-vintage snapshot that does not reproduce from any bound view
  (`map21-lottr-page-build.md`, `tsmo-reliability-page-build.md`) — **never cite them.** Two live sources exist and differ
  slightly: the MAP-21 pages compute from source 2001 / view 3394 (79.8 % Interstate · 83.2 % non-Interstate · 1.46 TTTR),
  the TSMO home cites the FHWA HPMS TTM resubmission view 3440 (80.0 · 83.3 · 1.46). Docs pages cite **the value the
  referenced live page shows**, name which it is (computed on the platform vs. the federal submittal), and where the two
  differ say so in one sentence with a link to `measures_and_data--data--pm3_and_map21.html`, which owns the explanation.
  Never write a reliability percentage without its year, system (Interstate / non-Interstate NHS) and target.
- 2026-09-04 · P1 review · **How-to H2 set is a minimum, not a maximum.** A how-to may add one or two page-specific H2s
  between *Steps* and *Limits and gotchas* when the lede promises them (e.g. "What needs an account", "How long a session
  lasts"). *Settings* may be replaced by a page-specific reference table when the page has no settings.
- 2026-09-04 · P1 review · **Table columns follow the subject.** The §4 column sets are the defaults; a table may rename
  columns to fit (navigation elements: Control · What it does · Values · Default was accepted). Keep four columns or fewer.
- 2026-09-04 · P1 review · **FAQ headings are quotes.** A verbatim user question may contain banned words or be a statement;
  keep it verbatim. Cite tickets as `<small>ticket N</small>` and legacy tracker rows as `<small>running fix N</small>`.
- 2026-09-04 · P1 review · Concept pages: "≤ 6 H2s" includes the closing *Where this matters*.
- 2026-09-04 · P1 review · **Event source is TRANSCOM.** The live landing copy says "stitched from 511NY feeds"; the docs
  say TRANSCOM events (the coalition feed, filtered to New York — per the TSMO Data & Methodology page). Landing copy
  divergence logged for the product-integration task, not propagated.
- 2026-09-04 · P1 review · Navigation labels verbatim from the pattern config: **About TSMO**, **Data & Methodology**,
  **MAP-21 PM3**, **Maps Gallery**, **About & The Plan**, **Data & Downloads**.
- 2026-09-04 · P1 review · **Builder attribution:** the landing page's own words, "A program of NYSDOT in partnership with
  AVAIL", may appear once on *What TransportNY is*. Elsewhere STYLE §2.2 stands: no "AVAIL", no "the developers".
- 2026-09-04 · P1 review · **NPMRDS pages are public to read** (pattern-level authLevel unset = public). The screens README
  note that the Macro View "is auth-gated" refers to capturing edit-mode screenshots on a dev server; Phase 8 confirms.
- 2026-09-04 · P1 review · **Resolving `[VERIFY]`:** the orchestrator resolves each mark by (a) a sourced fact, (b) rewording
  so the unverifiable claim is not made, or (c) converting it into an owner question in the task doc — never by deleting
  the mark silently. Marks count toward word caps; trimming for a mark is fine.
- 2026-09-04 · P1 review · **Sign-in facts** (from the auth pattern code, `patterns/auth/pages/authLogin.jsx`): the sign-in
  page is `/auth/login`; fields **Email**, **Password**; **Forgot?** opens `/auth/password/forgot` (the password reset page);
  the button reads **Sign In**; a sign-up route exists but may be disabled per site — docs say "request an account via Help
  and feedback" rather than describing sign-up.
- 2026-09-05 · P2a review · **Per-segment worked examples wait for the screenshot pass.** A measure page's *Worked example*
  carries the measured statewide figures now and a standard `callout.note` ("example pending … Phase 8") in place of a
  per-segment example that needs a live value. Never an invented value; never a bare `[VERIFY]` left for the next phase.
- 2026-09-05 · P2a review · **Live-bound numbers are cited by revision.** Where a dashboard figure is computed live, the docs
  state the measured value "at the <date> data revision" and say the live page recomputes; they do not claim what the
  page shows "today".
- 2026-09-05 · P2a review · TSMO measure pages' methodology stamp reads **"methodology · excessive delay, June 2026
  revision"** (not "series from December 2024", which read as a data start date).
- 2026-09-05 · P2a review · Two coexisting bases (e.g. flat $20 vs class-weighted value of time) are documented as a
  **"Which pages show which basis" table**, one row per live page, quoting the page's own wording. Adopted from the
  cost-of-congestion page as the pattern for any transitional method.
- 2026-09-05 · P2a-ii review · **Concept and reference pages end with a References H2** (same as measure pages), after
  *Where this matters* on concept pages. No "Sources" H3 folded into another section.
- 2026-09-05 · P2a-ii review · **Matrix tables may exceed four columns** when every cell is a word or a number (the hub's
  measure × tool matrix); the four-column ceiling applies to prose tables.
- 2026-09-05 · P2a-ii review · **Word caps by type:** how-to / screens / start ≤ 900; concept / reference / data ≤ 1,500;
  measure ≤ 1,800; FAQ and hubs uncapped. The Phase 1 ≤ 700 cap was phase-specific. Exceed a cap only with a reason in
  the phase report.
- 2026-09-05 · P2a-ii review · Ticket and running-fix ids appear only in References lists and FAQ `<small>` citations.
- 2026-09-05 · P2a-ii review · **Facts sourced from an external public authority** (NYSDOT regional offices, FHWA, Census)
  are cited by the authority's name in References; a repo source is preferred when one exists.
- 2026-09-05 · P2a-ii review · Where sources disagree on a live span or count (TRANSCOM start 2014 vs 2015; excessive-delay
  months loaded; 54,249 vs 52,473 TMCs), the page names the live page that is the authority and the datasheet that owns
  the reconciliation; the Phase 3 datasheets must settle each one from the source metadata.
- 2026-09-05 · P2b review · **FAQ headings that contain a banned internal name** keep the user's words but bracket the
  internal term: "what is [the version label on the delay card]?" — no lint exemption; the ticket id in `<small>` preserves
  the trace.
- 2026-09-05 · P2b review · **Every page type ends with a References H2** when it cites a figure or a live-page fact (how-to,
  screens, start included). Amends §3's H2 sets.
- 2026-09-05 · P2b review · **Live band titles with em dashes** are rendered as our H2 without the dash (colon or two
  sentences); the verbatim title appears in quotation marks in the body if the reader needs to find it on the page.
- 2026-09-05 · P2b review · **Document the live page, not the story or the mockup.** Where the design or a user story
  promised something the live page does not do (speed-vs-free-flow grid, nearby events, active work zones, a compare-dates
  control), the docs say what the page does today and, if useful, that the feature is planned — never describe the mockup.
- 2026-09-05 · P2b review · **Control facts come from the live section config, not the digest text.** Filter labels,
  multi/single-select, URL keys and table link columns are read from the page's section element-data (see
  `research/docs-redesign/site-dump/tsmo/_controls.md` and the `dump_filters2.mjs` recipe); the Phase 2b correction — Region
  is single-select only on Congestion — came from there.
- 2026-09-05 · P2b review · Default filter values are stated only when a source records them (a ticket verification, a
  digest); otherwise the Default cell reads "—", never a guess.
- 2026-09-05 · P3 review · **Log entries with no sourced day** use `YYYY-MM · label` or `YYYY · label` as the H2 (e.g. "2025 map ·
  Map/TMC version" becomes "2025 · Map/TMC version" with the map named in the body). Never invent a day.
- 2026-09-05 · P3 review · **Word caps count prose only.** Schema, index and coverage tables are excluded; the lint's raw count
  may exceed the cap when a page is table-heavy (routes_data, freight_atlas_sources) — note it in the phase report.
- 2026-09-05 · P3 review · **NPMRDS stamps read "applies to · NPMRDS"** without a mount string while NPMRDS stays on its own
  subdomain; the navigating and sign-in pages explain the arrangement.
- 2026-09-05 · P3 review · **TRANSEARCH:** the commodity-flow data is the S&P Global TRANSEARCH **2023 release with a 2021 base
  year**. Write "TRANSEARCH 2021 base year (2023 release)"; never "TRANSEARCH 2023" alone (ticket 2197830).
- 2026-09-05 · P3 review · A ticket cited for a fact must be cited at its **current** status (e.g. 2195719 resolved 2026-07-27:
  downloads generated); the docs say what the record says today, not what the ticket asked for.
- 2026-09-05 · P4a review · **Which build the docs describe:** the `dms-template` code, which is the version being deployed. Where
  the deployed site is known to lag it, the phase report logs the lag for the owner; the page does not carry a mark for it.
- 2026-09-05 · P4a review · **Verbatim UI strings inside `<span class="ui">` keep their punctuation**, em dashes included; §2.3
  governs our prose only.
- 2026-09-05 · P4a review · The `.where` chip row may be used on any page to list the measure pages that apply to an entry.
- 2026-09-05 · P4a review · **Sign-in stamps:** `<span class="gated">requires sign-in</span>` when the page's task needs an account;
  the variant "requires sign-in to edit" when reading is public but editing is not.
- 2026-09-05 · P4a review · **UI states that cannot be observed** (a control's default for another user, what a print preview
  hides, whether cells are coloured) are written as what the page does not promise ("the sign of the change is the reading;
  colour is not") rather than as a claim or a mark; the screenshot pass (Phase 8) is where such states are observed and, if
  needed, the sentence tightened.
- 2026-09-08 · P6a review · **API hosts:** the data API is documented at `https://graph.availabs.org` (the host the site's
  configuration and the 2025 worked example name); sign-in at `https://dmsserver.availabs.org/login`. The sign-in server
  answers the same `uda` paths (a sources length read matched on both hosts, 2026-09-08) — the docs still name one data host.
- 2026-09-08 · P6a review · **Ids inside code.** View ids, source ids and environment names may appear inside code samples and
  request paths on Developers pages where they are part of the API surface; never in running prose (§6 still governs prose).
- 2026-09-08 · P6a review · **Quoted code comments that name a person** lose the name and keep the date: "(stated 2026-08-24)".
- 2026-09-08 · P6a review · **External repositories** (the python client) are cited by address with their README named as the
  reference for what the docs could not read; the docs do not paraphrase an unread README, nor carry a mark for it.
- 2026-09-08 · P6a review · **Prose counts for code-heavy pages** exclude `pre` blocks as well as tables (extends the P3 ruling);
  the examples how-to is 731 prose words against a 1,318 lint count.
- 2026-09-08 · P6b brief · **Admin stamps:** every Admin-hub page carries `<span class="gated">requires an administrator account</span>`
  and names the authority level its task needs in "Before you start" (1 · 2 · 10 per the Managing Data page); the hub carries it too.
- 2026-09-08 · P6b brief · **Which admin UI the docs describe:** the `dms-template` datasets, mapeditor and auth patterns (the build
  being deployed, per the P4a ruling). The 2025 admin pages are salvage for concepts and vocabulary only; where the deployed
  TransportNY admin screens are known to differ, the phase report logs it for the owner and the page describes the pattern.
- 2026-09-08 · P6b review · **Prose counts exclude verbatim UI labels** (`<span class="ui">…</span>`) as well as tables and `pre`; a
  label-dense procedure is not penalised for naming its controls. The 900 how-to cap applies to that count.
- 2026-09-08 · P6b review · **A how-to that documents two screens or two procedures** (users_and_permissions: Users + Groups;
  map21_pm3_sources: map21 + pm3) has a 1,000-word cap on that count. Splitting them would separate what an administrator does in one sitting.
- 2026-09-08 · P6b review · **Data-type keys as UI labels.** Where a select shows the raw key (`gis_dataset`, `csv_dataset`, `map21`, `pm3`),
  the docs print it verbatim inside `<span class="ui">` at the step that chooses it and refer to it as "the type" afterwards; §6 governs prose.
- 2026-09-08 · P6b review · **Navigation labels that come from a site's theme config** (the admin menu) are not documented as a path; the
  page names the control ("open **Map Editor**") and the menu only when the pattern's own config defines it (the auth pattern's **Auth** menu).
- 2026-09-08 · P6b review · **A deployed-parity check resolves a mark:** where a page describes dms-template behaviour and the deployed
  TransportNY copy of the same file is identical on the point, the sentence says so with the check date and no mark remains.
- 2026-09-08 · P7 review · **The bidirectional-link rule binds screens to measures.** A product's how-to, screens, start and FAQ pages
  that name a measure link to its measure page, and the measure page's *Where this appears* chips link back. Recipe, hub and concept
  pages are documentation, not screens: they link out, and no chip points at them.
- 2026-09-08 · P7 review · **A how-to's What next stays at ≤ 5 links.** Where more pages deserve a route back (the Macro View download
  page's seven measures), the links go in the body section that names them (each measure name in the column-scheme text links to its page).
- 2026-09-08 · P7 review · **Chips point at the page that documents the screen**, never the hub: "TSMO home" → `tsmo--start.html`, not
  `tsmo.html` (six chips repointed).
- 2026-09-08 · P7 review · **Glossary `dt`s may carry an API-surface term** ("Falcor", "atom", "uda") — the P6a ruling extends to the glossary,
  because the Developers pages use the term and the glossary is where it is defined. Prose elsewhere still avoids it.
- 2026-09-08 · P7 review · **§2.2 holds on every page including hubs:** "AVAIL" appears only in the one attribution on *What TransportNY
  is*; a hub that names the platform's operators writes "the platform team". A quoted code default that contains the name is left as a
  quotation inside References.
- 2026-09-08 · P7 review · **A display setting is not a rule.** A form's page size ("one row a page") does not become "submit one row at a
  time"; the docs state what a control does, not what a layout value implies.
