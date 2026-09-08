# How other states measure work-zone safety & mobility

Survey compiled 2026-09-08 from FHWA case studies, state policies/process reviews, SWZDI syntheses and the WZDx
registry. Sources under [`references/`](./references/). "Rule-era" = documents produced after the Nov 2024 rule.

## 1. Summary table

| State | Mobility measure(s) & threshold | Safety measure(s) | Data | Publication / cadence | Notes |
|---|---|---|---|---|---|
| **Ohio** (HOP-19-034) | Permitted Lane Closure System (hourly volume caps 1,000–1,490 vph/lane); **allowable predicted queue 0.75 mi**; **in-zone speed < 35 mph** monitored on key projects | near-real-time WZ crash analysis on ½-mi segments; crashes vs construction budget | INRIX probe (79M rec/day), CCTV, volume counts | TMC queue notices to district WZ traffic managers; central-office speed analyses | The clearest threshold-based policy; exception process for >0.75 mi |
| **Virginia** (HOP-19-051) | Macro: vehicle-hours of delay by source (WZ = 4–8% of statewide delay); Micro: project queue length/duration, travel time | WZ crashes via dashboard | INRIX TMC (macro) and XD/Sub-XD (micro) via RITIS PDA, iPeMS, Tableau | annual + trend; VDOT Dashboard | Found TMC too coarse for project queues |
| **Maryland** (WZPMA 2016; RITIS) | delay, queue length (segment speed-ratio + connected queue), user delay cost, programmatic by corridor/day | nearby incidents from CHART; CCTV | INRIX via RITIS | real-time + historical tool; MD WZDx feed served by RITIS | Built explicitly "to assist compliance with Subpart J" |
| **Iowa** (HOP-21-052; Policy 500.18 rev. 2025-12) | # congestion events, duration, **avg queue length (1.1→0.8 mi)**, **% traffic encountering a queue**, draft **4 min delay/veh** | WZ crashes normalised by WZ-VMT; fatal WZ crashes (7/yr) | InTrans sensors (24 Traffic Critical Projects, 20-s data), INRIX, Field Review Dashboard | nightly tool refresh; daily/weekly reports; TSMO service-layer plan | Policy already revised for the 2024 rule |
| **Illinois** (HOP-23-007) | **queues ≤ 1.5 mi beyond pre-existing**; VMT/VHT/delay/queue duration from PDA | WZ crashes by facility type | RITIS PDA (probe + volumes); GIS portal → dashboards; CWZ 1.0 feed (2025) | review cycle | Recording zone extents better *lengthens* measured impact — expect that |
| **Michigan** (WZSM Manual; GD 10177) | **≤10 minutes delay per project**; corridor coordination | crash review | probe (WSU course); MDOT WZ mobility page | policy standard | Most-cited delay threshold |
| **Montana** (WZSM Guidance) | **significant delay = >15 min**; queue detection where queues expected | crash trends; % fatal WZ crash evaluations completed | project records | review of up to 25 significant projects | Small-state design of a sampled review |
| **North Carolina** (2023 review; WZDx 4.2) | weekly one-page probe snapshots (e.g. 5-mi max queue found); dynamic zipper merge | 5-yr avg **6,732 WZ crashes / 33 fatal**; TMA-crash form; fatal-crash reviews | probe, WZDx | biennial review (pre-2024) | What a modest compliant review looks like |
| **Indiana** (Purdue JTRP) | queue miles/duration, mile-hours < 45 mph, travel times | **hard braking (−0.25 g)**, weekly change; ~147 hard-brakes per crash | CV trajectories (StreetLight/Omnitracs; formerly Wejo) | **weekly** dashboards + after-action reviews | The safety-surrogate reference program |
| **Texas** (HOP-20-029; INRIX) | TT > 1.25× baseline average = underperforming hour; delay, TTI/PTI, RUC | — | NPMRDS (case study); INRIX contract (15 yrs, extended 2025) | project post-hoc | FHWA's NPMRDS worked example |
| **Missouri** | "% of work zones meeting expectations for traffic flow" (inspection rating) | — | inspections | Tracker quarterly | Rating-based, not outcome-based |
| **Wisconsin / Washington** | MAPSS; Gray Notebook (paused, relaunch 2026) | — | — | quarterly | Public accountability reports |
| **Connecticut** (2024 Smart WZ Guide) | objectives to gather crash, speed, throughput data in smart work zones | — | smart WZ devices | — | Neighbour on TRANSCOM |
| **New Jersey** | TRANSCOM/OpenReach + probe for TIM; NJIT-published WZDx feed | — | TRANSCOM | — | Same data ecosystem as NY |
| **Colorado / Massachusetts** | — | — | first **CWZ 1.0** feeds (2025) | — | Feed-standard leaders |
| **New York (today)** | none quantified in HDM Ch. 16; TSMO work-zones dashboard (draft, AVAIL) computes WZ delay from TRANSCOM×NPMRDS | AWZSE biennial report: WZ crashes 2021–25, intrusions 1999–2025, speed/violations; WZTC QA ratings | CLEAR/ALIS; TRANSCOM; NPMRDS; AWZSE cameras | biennial (statute); QA annual | Has the data, lacks the declared measures |

## 2. Patterns worth copying

1. **Two tiers, one data spine.** VDOT, Maryland and Illinois all run a *programmatic* tier (statewide/district/
   corridor delay and queue statistics from TMC-level probe data) and a *project* tier (selected significant
   projects, finer data or devices). Programmatic reporting never needs better than TMC/NPMRDS resolution.
2. **Declare a threshold and count exceedances.** Ohio (35 mph / 0.75 mi), Illinois (1.5 mi), Michigan (10 min),
   Montana (15 min), Iowa (4 min/veh), TxDOT case (1.25×). The rule's own examples are exceedance shares
   ("percent of projects…", "percent of time…"), so the measure is *how often we were over the line*, not the mean.
3. **Baseline = same TMCs, same hours, before the zone.** Everyone compares against pre-construction (1–2 years);
   nobody compares against the posted limit alone (NCHRP 482's caution).
4. **Exposure comes from the agency's own records**, not the public feed: Iowa (WZ-VMT), Illinois (GIS project
   extents), Ohio (lane-closure permits). Public WZDx feeds are consumed by navigation providers; agencies keep a
   richer internal store.
5. **Crash measures are counts and severities, validated spatially**, with fatal-crash case reviews (NCDOT, Montana).
   Rates use WZ-VMT where available (Iowa).
6. **Cadence is weekly for operations, annual for the rule.** Purdue/INDOT and NCDOT produce weekly snapshots;
   the programmatic review consolidates annual series.
7. **Vendors have productised it.** CATT's RITIS PDA Work Zone Performance Reporting tool (Dec 2025) offers
   target-based flags (e.g. "delay ≤10 min"), baselines, weekly/monthly reports and a work-zone "health score";
   SWZDI's WZPERFOMAT (Aug 2025) does the same in open code from a WZDx feed. Any NYSDOT/AVAIL build should match
   these features rather than reinvent the measure set.

## 3. Where New York stands against peers

| Capability | Peers | NY status |
|---|---|---|
| Declared mobility threshold in policy | OH, MI, MT, IL, IA | **none** (HDM Ch. 16 qualitative) |
| Probe-based WZ delay attribution | VA, MD, IL, OH | **exists** in AVAIL's TRANSCOM×NPMRDS pipeline (excessive_delay `construction` bucket; event×TMC delay) |
| Queue length/duration reporting | OH, IL, IA, MD, IN | **not yet computed** (feasible from NPMRDS contiguous-TMC method) |
| WZ crash series with work-zone flag | all | **exists** (CLEAR internal; open data TCD codes; AWZSE report tables) |
| Crash ↔ zone spatial-temporal join | IA, IL, OH | **not done** (needs CLEAR extract with coordinates or ref-marker geocoding) |
| Exposure (projects, lane closures, WZ-VMT) | IA, IL | **partially derivable** from TRANSCOM lanes/durations + AADT; PIN linkage missing |
| Safety surrogates (hard braking) | IN, + 9 states in Purdue's 2025 program | **none**; speed differentials computable from NPMRDS |
| Public WZDx feed | 42 feeds | **yes, v4.1** — but points-only, no direction/lanes/verified dates |
| Programmatic review completed with data | IA, IL (FHWA case studies) | last reviews were process reviews; 2030 will be the first data-driven one |
