# Schenectady County HMP → MitigateNY 2.0 — Crosswalk & Coverage Report

**Pattern:** 2275239 ("MitigateNY Schenectady Draft") · app `mitigat-ny-prod` · geoid 36093
**Generated:** 2026-07-21 · **Source:** MitigateNY 1.0 capture (`references/schenectady/`)
**State:** all fills written to `draft_sections` (unpublished); filled components carry `status=shmp_sourced_content`.

Confidence key — **High**: verbatim 1:1 block clearly matching the slot's intent. **Medium**: reasonable but the slot intent is broader/different than the source, or content placed in a best-available slot. **Low**: weak/indirect (none used).

---

## Part 1 — MNY 2.0 slots POPULATED (crosswalk)


### The Local Environment

**People and Communities** — `the_local_environment/people_and_communities`

| Slot | Source (MNY 1.0) | Confidence |
|---|---|---|
| Local Context | Home / Plan Overview › Schenectady County Context (Location, History, Industries, Climate) | High |
| Local Populations at Highest Risk | Risk › Vulnerability / Social Vulnerability (incl. survey comments) | High |
| Governance Structure  | Home / Plan Overview › County Context / Governing Body Format | High |

**Built Environment** — `the_local_environment/built_environment`

| Slot | Source (MNY 1.0) | Confidence |
|---|---|---|
| Local Context | Risk › Vulnerability / Built Environment (+ land use, flood risk) | High |
| Local Context | Risk › Vulnerability / Critical Infrastructure | High |

**Natural Environment** — `the_local_environment/natural_environment`

| Slot | Source (MNY 1.0) | Confidence |
|---|---|---|
| Local Context | Risk › Vulnerability / Natural Environment (intro) | High |
| Water Quality | Risk › Vulnerability / Natural Environment (Mohawk R., Normans Kill, Great Flats Aquifer) | High |

**NFIP - Floodplain Management** — `the_local_environment/nfip_floodplain_management`

| Slot | Source (MNY 1.0) | Confidence |
|---|---|---|
| NFIP Participation Summary | Risk › Floodplain Management / NFIP Statistics (snapshot) | High |
| Local Context | Risk › Floodplain Management / NFIP Problem Areas (per-jurisdiction) — _Slot guidance asks about FIRM status; used the per-jurisdiction NFIP policy/claim narrative (best available)._ | Medium |

**High Hazard Dams** — `the_local_environment/high_hazard_dams`

| Slot | Source (MNY 1.0) | Confidence |
|---|---|---|
| Local Context | Risk › Dam Safety / High Hazard Dams (County's Class C & B dams + classification) | High |

### The Plan

**About the Process** — `the_plan/about_the_process`

| Slot | Source (MNY 1.0) | Confidence |
|---|---|---|
| Local Context | Planning Process › Planning Context / Local Orientation | High |
| Organizational Structure - Planning Teams | Planning Process › Pre-Planning / Planning Teams | High |
| Stakeholder Outreach and Engagement | Planning Process › Pre-Planning / Outreach Strategy | High |
| Public Participation | Planning Process › Engagement / Public Participation | High |
| Public Comment | Planning Process › Plan Review and Submittal — _Source titled 'Plan Review & Submittal'; placed in the Public Comment slot (closest intent)._ | Medium |
| Technical Data and Existing Resources | Planning Process › Local Resources (Technical Data + Existing Resources) | High |
| Monitoring, Evaluating, and Updating the Plan | Planning Process › Plan Maintenance / Monitoring & Evaluating + Updating | High |
| Plan for Integration with Other Plans | Planning Process › Plan Maintenance (routine-meeting integration, LEPC, stormwater) | High |
| Continued Public Engagement | Planning Process › Plan Maintenance / Continued Public Engagement | High |

**Capabilities Assessment** — `the_plan/capabilities_assessment`

| Slot | Source (MNY 1.0) | Confidence |
|---|---|---|
| Local Context | Strategies › Capabilities / Capacity to Address Risk (CEMP, LEPC, SIMS, RTIM, MS4) — _Chapter has 4 category-specific Local Context slots (planning/admin/education/financial); the source narrative is not split that way, so the whole capacity narrative was placed in the first slot._ | Medium |

**Strategies** — `the_plan/strategies`

| Slot | Source (MNY 1.0) | Confidence |
|---|---|---|
| Local Context | Strategies › Purpose / Local Orientation (county impact profile) | High |
| County Goals and Objectives | Strategies › Objectives / Goals & Objectives (Goals 1–4) | High |
| Problem Area Identification | Risk › Vulnerability / Problem Areas (methodology + per-jurisdiction risk analysis) | High |
| Prioritization & Cost Evaluation | Strategies › Objectives / Changes in Priorities | High |
| Plan for Displaced Residents | Strategies › Response / Displaced Residents | High |
| Evacuation Procedures | Strategies › Response / Evacuation Procedures | High |
| Shelters | Strategies › Response / Shelters (Mass Care & Sheltering Annex) | High |

### The Risk

**Natural Hazards** — `the_risk/natural_hazards`

| Slot | Source (MNY 1.0) | Confidence |
|---|---|---|
| Local Context | Hazard profiles › All Hazards (hazards of concern by jurisdiction, probability, community input) | High |

**Climate Change** — `the_risk/climate_change`

| Slot | Source (MNY 1.0) | Confidence |
|---|---|---|
| Local Context | Strategies › Capacity to Address Risk / Climate Smart Community — _Repurposed the Climate Smart Community capability narrative as the locally-grounded climate summary._ | Medium |

### Natural Hazards (per-hazard pages)

**Flooding** — `the_risk/natural_hazards/flooding`

| Slot | Source (MNY 1.0) | Confidence |
|---|---|---|
| Featured Event | Flooding › Featured event (Aug 29 2011, Western Gateway Bridge) | High |
| County Assessment | Flooding › Local Impacts | High |
| (untitled) | _(pre-existing fill — not from this task)_ | — |

**Avalanche** — `the_risk/natural_hazards/avalanche`

| Slot | Source (MNY 1.0) | Confidence |
|---|---|---|
| Local Hazard Summary | Avalanche › Local Impacts (not a hazard of concern) | High |

**Coastal Hazards** — `the_risk/natural_hazards/coastal_hazards`

| Slot | Source (MNY 1.0) | Confidence |
|---|---|---|
| Local Hazard Summary | Coastal Hazards › Local Impacts (not a hazard of concern) | High |

**Drought** — `the_risk/natural_hazards/drought`

| Slot | Source (MNY 1.0) | Confidence |
|---|---|---|
| County Assessment | Drought › Local Impacts | High |

**Earthquake** — `the_risk/natural_hazards/earthquake`

| Slot | Source (MNY 1.0) | Confidence |
|---|---|---|
| County Assessment | Earthquake › Local Impacts | High |

**Extreme Cold** — `the_risk/natural_hazards/extreme_cold`

| Slot | Source (MNY 1.0) | Confidence |
|---|---|---|
| County Assessment | Coldwave → Extreme Cold › Local Impacts | High |

**Extreme Heat** — `the_risk/natural_hazards/extreme_heat`

| Slot | Source (MNY 1.0) | Confidence |
|---|---|---|
| County Assessment | Heat Wave → Extreme Heat › Local Impacts (+ NYSDOH HVI) | High |

**Hail** — `the_risk/natural_hazards/hail`

| Slot | Source (MNY 1.0) | Confidence |
|---|---|---|
| County Assessment | Hail › Local Impacts | High |

**Hurricane** — `the_risk/natural_hazards/hurricane`

| Slot | Source (MNY 1.0) | Confidence |
|---|---|---|
| Local Hazard Summary | Hurricane › Local Impacts (not a hazard of concern) | High |

**Ice Storm** — `the_risk/natural_hazards/ice_storm`

| Slot | Source (MNY 1.0) | Confidence |
|---|---|---|
| County Assessment | Ice Storm › Local Impacts | High |

**Landslide** — `the_risk/natural_hazards/landslide`

| Slot | Source (MNY 1.0) | Confidence |
|---|---|---|
| County Assessment | Landslide › Local Impacts | High |

**Lightning** — `the_risk/natural_hazards/lightning`

| Slot | Source (MNY 1.0) | Confidence |
|---|---|---|
| County Assessment | Lightning › Local Impacts | High |

**Snowstorm** — `the_risk/natural_hazards/snowstorm`

| Slot | Source (MNY 1.0) | Confidence |
|---|---|---|
| County Assessment | Snow Storm → Snowstorm › Local Impacts | High |

**Tornado** — `the_risk/natural_hazards/tornado`

| Slot | Source (MNY 1.0) | Confidence |
|---|---|---|
| County Assessment | Tornado › Local Impacts | High |

**Wildfire** — `the_risk/natural_hazards/wildfire`

| Slot | Source (MNY 1.0) | Confidence |
|---|---|---|
| County Assessment | Wildfire › Local Impacts | High |

**Wind** — `the_risk/natural_hazards/wind`

| Slot | Source (MNY 1.0) | Confidence |
|---|---|---|
| County Assessment | Wind › Local Impacts | High |

### Track Progress

---

## Part 2 — MNY 2.0 slots LEFT EMPTY

Left empty because the MNY 1.0 source carries no matching county-specific prose (strict/faithful — invent nothing).

- **People and Communities** (5 empty): Transient and Seasonal Populations at Risk, Population Change, Local Context, Special Districts, Local Context
- **Built Environment** (10 empty): Local Context, Local Context, Local Context, Local Context, Local Context, Local Context, Historic Properties, What's Changed, Codes Enforcement, National Flood Insurance Program (NFIP)
- **Natural Environment** (7 empty): County Open Space Plan, Local Context, Firewise Communities , Local Context, Air Quality, Local Context, Forestry Local Context
- **NFIP - Floodplain Management** (1 empty): Community Rating System
- **About the Process** (4 empty): Other Related Planning Processes, Jurisdictional Representation, Jurisdictional Engagement Process, Local Context
- **Capabilities Assessment** (3 empty): Local Context, Local Context, Local Context
- **Strategies** (5 empty): Local Context, Funding Sources Local context, Capabilities Highlights, Local Context, Temporary Housing and Relocation
- **Natural Hazards** (1 empty): Executive Summary
- **Disasters** (3 empty): Executive Summary, Local Context, Local Context
- **Non-natural Hazards** (1 empty): Local Context
- **Flooding** (9 empty): Local Hazard Summary, Declarations and Their Effects on the County, Jurisdictional Assessment, Built Environment - Local Risk Summary, People and Communities - Local Risk Summary, Natural Environment - Local Risk Summary, Local Capabilities, Local Actions, Featured Strategy
- **Avalanche** (10 empty): Declarations and Their Effects on the County, Featured Event, County Assessment, Jurisdictional Assessment, Built Environment - Local Risk Summary, People and Communities - Local Risk Summary, Natural Environment - Local Risk Summary, Local Capabilities, Local Actions, Featured Strategy
- **Coastal Hazards** (10 empty): Declarations and Their Effects on the County, Featured Event, County Assessment, Jurisdictional Assessment, Built Environment - Local Risk Summary, People and Communities - Local Risk Summary, Natural Environment - Local Risk Summary, Local Capabilities, Local Actions, Featured Strategy
- **Drought** (10 empty): Local Hazard Summary, Declarations and Their Effects on the County, Featured Event, Jurisdictional Assessment, Built Environment - Local Risk Summary, People and Communities - Local Risk Summary, Natural Environment - Local Risk Summary, Local Capabilities, Local Actions, Featured Strategy
- **Earthquake** (10 empty): Local Hazard Summary, Declarations and Their Effects on the County, Featured Event, Jurisdictional Assessment, Built Environment - Local Risk Summary, People and Communities - Local Risk Summary, Natural Environment - Local Risk Summary, Local Capabilities, Local Actions, Featured Strategy
- **Extreme Cold** (9 empty): Local Hazard Summary, Declarations and Their Effects on the County, Featured Event, Jurisdictional Assessment, Built Environment - Local Risk Summary, People and Communities - Local Risk Summary, Natural Environment - Local Risk Summary, Local Capabilities, Featured Strategy
- **Extreme Heat** (10 empty): Local Hazard Summary, Declarations and Their Effects on the County, Featured Event, Jurisdictional Assessment, Built Environment - Local Risk Summary, People and Communities - Local Risk Summary, Natural Environment - Local Risk Summary, Local Capabilities, Local Actions, Featured Strategy
- **Hail** (10 empty): Local Hazard Summary, Declarations and Their Effects on the County, Featured Event, Jurisdictional Assessment, Built Environment - Local Risk Summary, People and Communities - Local Risk Summary, Natural Environment - Local Risk Summary, Local Capabilities, Local Actions, Featured Strategy
- **Hurricane** (10 empty): Declarations and Their Effects on the County, Featured Event, County Assessment, Jurisdictional Assessment, Built Environment - Local Risk Summary, People and Communities - Local Risk Summary, Natural Environment - Local Risk Summary, Local Capabilities, Local Actions, Featured Strategy
- **Ice Storm** (10 empty): Local Hazard Summary, Declarations and Their Effects on the County, Featured Event, Jurisdictional Assessment, Built Environment - Local Risk Summary, People and Communities - Local Risk Summary, Natural Environment - Local Risk Summary, Local Capabilities, Local Actions, Featured Strategy
- **Landslide** (10 empty): Local Hazard Summary, Declarations and Their Effects on the County, Featured Event, Jurisdictional Assessment, Built Environment - Local Risk Summary, People and Communities - Local Risk Summary, Natural Environment - Local Risk Summary, Local Capabilities, Local Actions, Featured Strategy
- **Lightning** (10 empty): Local Hazard Summary, Declarations and Their Effects on the County, Featured Event, Jurisdictional Assessment, Built Environment - Local Risk Summary, People and Communities - Local Risk Summary, Natural Environment - Local Risk Summary, Local Capabilities, Local Actions, Featured Strategy
- **Snowstorm** (9 empty): Declarations and Their Effects on the County, Featured Event, Jurisdictional Assessment, Built Environment - Local Risk Summary, People and Communities - Local Risk Summary, Natural Environment - Local Risk Summary, Local Capabilities, Local Actions, Featured Strategy
- **Tornado** (10 empty): Local Hazard Summary, Declarations and Their Effects on the County, Featured Event, Jurisdictional Assessment, Built Environment - Local Risk Summary, People and Communities - Local Risk Summary, Natural Environment - Local Risk Summary, Local Capabilities, Local Actions, Featured Strategy
- **Wildfire** (10 empty): Local Hazard Summary, Declarations and Their Effects on the County, Featured Event, Jurisdictional Assessment, Built Environment - Local Risk Summary, People and Communities - Local Risk Summary, Natural Environment - Local Risk Summary, Local Capabilities, Local Actions, Featured Strategy
- **Wind** (9 empty): Declarations and Their Effects on the County, Featured Event, Jurisdictional Assessment, Built Environment - Local Risk Summary, People and Communities - Local Risk Summary, Natural Environment - Local Risk Summary, Local Capabilities, Local Actions, Featured Strategy
- **Annual Maintenance** (1 empty): Change Log

---

## Part 3 — MNY 1.0 content NOT carried into 2.0

### A. Data-driven content (intentionally not transcribed — rendered by 2.0 data components auto-filtered to geoid 36093)
- Home/Overview: Hazard Loss, Annual Average Loss by Hazard, Hazard Events counts, NFIP Claims, Critical Assets in Floodplain.
- Capabilities table, Proposed/Additional Actions tables, Problem Statements table, Mitigation & Planning Participants tables, Meetings table, Adoption table, Previous Actions, NFIP Compliance table, Shelter table, Open Space Statistics.
- Per-hazard Built Environment / Critical Facilities / Hazards-of-Concern / Highest-Loss tables, and all interactive maps.

### B. Boilerplate / generic framing (not transcribed — covered by the 2.0 template's shared "LHMP_IA" narrative cards)
- Risk › Purpose / About Risk & Vulnerability; Strategies › About Strategies; Capabilities › Overview (generic definition); Environmental & Historic Preservation (generic FEMA EHP text); Dam Safety generic dam framing; Open Space generic definitions & CRS explanation; About the Plan › Disclaimer.

### C. Empty in the 1.0 source (heading present, no body)
- Planning Process: Federal/State/County Representation, Regional Representation, Jurisdictional Representation, Jurisdictional Engagement.
- About the Plan: Public Participation Survey, Public Comment, Appendices.
- Strategies › Response: Temporary Housing and Relocation (heading only).

### D. No matching 2.0 page (dropped)
- Hazard profiles **Tsunami/Seiche** and **Volcano** — no template hazard page (both "not a hazard of concern").

### E. Candidates left empty that MAY warrant follow-up (source prose exists but wasn't a clean slot fit)
- NFIP page › **Community Rating System** slot — 1.0 has no dedicated CRS narrative (CRS is discussed generically under Open Space).
- Strategies › **Funding Sources**, **Capabilities Highlights**, and the "implementation over last 5 years" Local Context — 1.0 has an Implementation Resources / NFIP Continued Compliance & Repetitive Loss Strategy section (Strategies › Implementation) that was NOT transcribed; could feed these.
- Built Environment sub-topic Local Contexts (water/transportation/energy/communications infrastructure, Historic Properties, Codes Enforcement, What's Changed) — 1.0 has no topic-specific prose.
- People & Communities: Transient/Seasonal Populations, Population Change, Special Districts, Economic/Neighboring Local Contexts — no distinct 1.0 prose.

### F. Deferred scope
- **7 jurisdictional annexes** (Delanson, Duanesburg, Glenville, Niskayuna, Princetown, Rotterdam, Scotia) — 2.0 form pages, separate mechanism.
- **Top-level landing pages** (The Risk / The Local Environment / The Plan) — auth-gated over read access; their Executive-Summary slots could not be filled.

---

## Totals (all 41 content pages)

- MNY 2.0 Annotation slots total: **255**
- Populated by this task: **46** (verbatim from 1.0, `status=shmp_sourced_content`)
- Pre-existing fills (not this task): **3**
- Left empty: **206**
