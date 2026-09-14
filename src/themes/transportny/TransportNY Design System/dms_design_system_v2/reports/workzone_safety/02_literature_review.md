# Literature review — work-zone safety & mobility performance measurement

Scope: FHWA guidance and case studies, NCHRP/TRB, the SWZDI pooled fund, and the connected-vehicle research line.
Every item is saved under [`references/`](./references/) with a companion note; see
[`references/_INDEX.md`](./references/_INDEX.md). Peer-state programs are in `03_state_practice.md`.

## 1. The FHWA measurement canon (2011–2021)

The federal literature is a coherent series written by the same FHWA office (HOTO) and mostly the same
contractors (Battelle, TTI, SAIC), and the 2024 rule's example measures are lifted from it.

| Doc | Contribution | Take for NY |
|---|---|---|
| **HOP-11-033 Primer (2011)** | The exposure / safety / mobility taxonomy; measure tables (queue length & duration, % time queue > threshold, delay/veh, % time at free-flow, crashes by severity, crash rate per MVMT, % motorists over the limit, VMT through zone, lane-mile-hours closed, % work hours with a lane closed). Exposure is the denominator. | Our measure list should be drawn from these tables so FHWA recognises them. |
| **HOP-13-011 Data Needs (2013)** | Three data needs: *performance* (how much), *exposure* (who/what), **indicator/stratification data (when/where the zone was active)**. Safety split into crashes / **operational surrogates** / worker accidents. NYSDOT (C. Riedel) sat on the panel. | Names our real problem: work-zone *indicator* data quality (TRANSCOM), not speed data. |
| **HOP-13-043 Probe Data (2013)** | Probe data suits delay, speed, travel time, reliability, % time at free-flow; **queue length is an estimate** improving with penetration/granularity; **volumes cannot come from probes**. Maryland WZPMA case (segment-speed-ratio queue + "connected queue"). | Green light for probe-based mobility; exposure needs AADT (HPMS/NPMRDS meta). |
| **HOP-15-013 Process Reviews (2015)** | How to use data and measures inside the review. | Structure of the 2030 report. |
| **HOP-18-083 WZDI (2018)** | Work Zone Activity Data dictionary — the when/where/how attributes a work-zone record should carry. | Fidelity yardstick for TRANSCOM/WZDx. |
| **HOP-19-034 Ohio (2019)** | Policy-driven thresholds: permitted lane-closure volumes; **0.75-mile allowable queue**; **35 mph in-zone speed threshold** monitored with INRIX. | Concrete thresholds NYSDOT can adopt. |
| **HOP-19-051 Virginia (2019)** | Two tiers: macro delay attribution (work zones = 4–8% of VA delay vs 10% national) and micro project queues; **TMC segments too coarse for project-level queues (avg 1.16 mi, up to 18 mi rural)** → XD/Sub-XD. | Design the program as programmatic-tier (TMC is fine) + project-tier (accept TMC limits or buy XD for a few projects). |
| **HOP-20-028 NPMRDS fact sheet (2020)** | FHWA explicitly promotes **NPMRDS for work-zone mobility measurement**; minimum inputs = agency work-zone activity data + NPMRDS speeds. | The federal endorsement of NYSDOT's proposed approach. |
| **HOP-20-029 TxDOT GO I-10 (2021)** | **Ten-step repeatable process**; 2-yr baseline; **threshold = 1.25 × average travel time** ("underperforming hour"), delay = observed − threshold; TTI/PTI; road-user cost; lessons (align TMCs to zone limits, 5-min data for queue build/discharge, control for incidents/weather). | Our computation recipe. |
| **HOP-21-052 Iowa / HOP-23-007 Illinois (2021–22)** | Completed **data-driven reviews**: Iowa — congestion events, avg queue 1.1→0.8 mi, % traffic encountering a queue, 4-min delay/veh threshold, WZ crashes per WZ-VMT; Illinois — **queues ≤1.5 mi beyond pre-existing**, RITIS PDA mobility analysis, GIS pipeline for exposure. | What FHWA accepted from peers = what it will accept from NYSDOT. |
| **HOP-24-083 New York AWZSE (2024)** | FHWA's own case study of NYSDOT/NYSTA's speed-camera program, noting the statutory crash-with/without-camera reporting. | NYSDOT already runs a WZ crash + speed reporting pipeline. |
| **Final Rule Q&A (Apr 2026)** | Minimum one safety + one mobility measure; review covers the 5 calendar years before the report year. | Compliance floor. |

**Synthesis.** FHWA's position for a decade has been: (1) exposure/safety/mobility measures; (2) probe speeds
are adequate for programmatic mobility reporting and delay; (3) the binding constraint is knowing when/where the
work zone actually was. Nothing in the canon requires real-time or sensor data.

## 2. NCHRP / TRB

There is **no NCHRP product written against the 2024 rule's measurement requirement**. The relevant NCHRP body is
older or adjacent:

| Item | Year | Relevance |
|---|---|---|
| **NCHRP 20-68A Scan 08-04** — Best Practices in Work Zone Assessment, Data Collection, and Performance Evaluation | c. 2010 | The domestic scan of state practice (NC, MI, MD, NH, Caltrans); the origin of most later FHWA case-study agencies. |
| **NCHRP Synthesis 482** — Work Zone Speed Management (Chitturi) | 2015 | Technical cautions on observing/comparing work-zone speeds (the posted-limit confound; upstream vs in-zone; before vs during). Essential for a "speed change" measure. |
| **NCHRP RRD 192 / new project 03-150** — work-zone speed-limit procedure | 2024→ | Mean speeds ~5 mph lower in zones without a posted reduction; >10 mph reductions discouraged — context for speed thresholds. |
| **NCHRP RR 869 / Project 17-61** — Safety effects of work-zone characteristics (CMFs) | 2018 | Expected crash effects by configuration; underpins a "% projects exceeding a pre-established crash rate" measure. |
| **NCHRP Synthesis 587** — Smart work zone technologies | 2022 | Queue-warning/speed-feedback systems as *data producers*. |
| **NCHRP RR 1003 / WOD 322** — Work-zone intrusion mitigation | 2022 | Worker-safety side (intrusions), the measure NYSDOT already reports (322 intrusions in 2024). |
| **NCHRP 08-36(131)** — data integration for planning | c. 2017 | Probe + event + crash fusion matrix; background. |
| **NCHRP 08-119** — TIM data products / NOCoE work-zone data portal | 2023 | Data-sharing and quality guidance that the WZDx ecosystem sits in. |
| **FY2024 projects 17-124, 17-128** — effectiveness of speed reduction; adverse driving behaviours in work zones | active | Watch for method outputs on speed measures. |

Also TRB papers using **NYSDOT data**: Bryden & Andrew 01-2223 (NYSDOT WZTC quality-assurance program — the
"field observations" leg) and Bryden 07-0957 (NY work-zone crashes involving TCDs/work vehicles); NYSDOT research
**C-01-61** (UTRC 2005, frequency of work-zone accidents on NY construction projects). These prove NYSDOT has
historically held project-linked work-zone crash records.

## 3. The SWZDI pooled fund (Iowa State InTrans, TPF-5(081)/5(438))

- **Synthesis of Work-Zone Performance Measures (2013)** — the best cross-state tables of mobility (Table 3-1) and
  safety (Table 4-1) measures with thresholds: INDOT/ODOT queue definitions, Caltrans delay thresholds, MoDOT "%
  of work zones meeting expectations", ODOT crashes vs construction budget; **NYSDOT and Oregon rely on quality
  ratings**; public reporting via VDOT Dashboard, MoDOT Tracker, WisDOT MAPSS, WSDOT Gray Notebook.
- **WZPERFOMAT — Analytical Tool for Work Zone Performance (Aug 2025)** — the first tool built explicitly to the
  2024 rule: **WZDx-format work-zone locations (required) + crash + INRIX/HERE probe + CV data → % time speed below
  threshold, mean/95th-pct queue length, % time queue present, speed reductions, delay, hard braking**, with a map
  dashboard. NPMRDS omitted only for access reasons; the HERE workflow is described as adaptable.
- **Probe vs CV data for queue warning (ROSAP 80871)** — segment speed data: complete but laggy with false/missed
  calls; CV data: better latency, thin overnight. Probe TMC speeds are fine for **reporting**, weak for **alerts**.
- **UW-Madison / Wayne State FHWA-grant training modules** — work-zone event data recordkeeping; auditing work-zone
  mobility with probe data (MDOT 10-min standard).

The 2025 tool is important evidence: **the emerging standard architecture is exactly "work-zone feed × probe
speeds × crash records"**, which is the stack AVAIL already operates (TRANSCOM × NPMRDS × …).

## 4. Connected-vehicle / safety-surrogate research (Purdue–INDOT line)

- **Continued Deployment of Indiana Work Zone Analytics (JTRP 2025)** — weekly statewide dashboards from CV
  trajectories: speed heatmaps, **hard braking at −0.25 g**, weekly change in hard braking, **mile-hours below
  45 mph**, queue forecasting; **~147 hard-braking events per crash** in/around construction (Desai et al. 2021);
  CV penetration ≈5% of cars; vendor churn after **Wejo's 2023 exit** (now StreetLight trajectories + Omnitracs
  trucks).
- **Sakhare et al., Future Transportation 6(1):12 (Jan 2026)** — the only peer-reviewed paper written *to* the 2024
  rule: maps CV measures onto the rule's speed, travel time, queue length/duration, hard braking and speed
  differential; I-24 Illinois demo; **101 work zones in 9 states in 2025**.
- **Bullock, Crawfordsville Safety Summit (Sep 2025)** — weekly measures (crashes, queue miles/duration, travel
  times, hard braking) + after-action reviews; "motorists follow Google/Apple/Waze more than our signs".
- **Rolling slowdowns (JTRP)** — a strategy evaluation using the same surrogates.

Cautions from this line: CV data is **purchased** (INRIX, StreetLight, Arity, HERE, TomTom after Wejo/Otonomo
exits), penetration is low overnight, and vendor braking thresholds are opaque. The preamble's "available data"
ruling means NYSDOT can defer CV acquisition; **speed differentials from NPMRDS already satisfy the surrogate
clause on paper**.

## 5. Crash-data methods

- **MMUCC 5th ed.** work-zone crash definition is incorporated by the rule; New York's MV-104A carries it as
  *Traffic Control* codes **12 Construction Work Area / 13 Maintenance Work Area / 14 Utility Work Area**.
- **USU spatial-misclassification study** — >1 in 3 coded work-zone crashes were misclassified against actual zone
  location/time → **validate the flag with a spatial-temporal join to zone extents**, and expect the coded series
  to undercount queue-related crashes upstream of the first sign.
- **NCDOT 2023 review** — practical triage: with limited staff, NCDOT reviews every **fatal** WZ crash and samples
  the rest (5-yr avg 6,732 WZ crashes / 33 fatal per year).
- **Ohio real-time WZ crash analysis** — half-mile segments, before/after frequency comparison.

## 6. Work-zone data standards

- **WZDx (USDOT JPO, v4.x)** — GeoJSON road events with verified/unverified dates, `vehicle_impact`, optional
  per-lane status, `types_of_work`, reduced speed limit. **42 registered feeds; NY = TRANSCOM via 511NY, v4.1.**
- **CWZ — Connected Work Zones (ITE, 2025)** — the standardised successor built from WZDx 4.1 (CTI family);
  Colorado first, then Massachusetts and Illinois.
- **WZAD dictionary (WZDI)** — the attribute checklist behind both.

## 7. What the literature does *not* settle

1. **Threshold values** are agency choices (35 mph, 0.75 mi, 1.5 mi, 10 min, 15 min, 1.25×TT, 4 min/veh all appear).
   FHWA deliberately leaves them to the State — the policy must simply state them.
2. **Queue length from TMC-resolution probes** is approximate; every source says so. Acceptable for programmatic
   reporting; use finer data or field devices for project-level enforcement of a queue target.
3. **Exposure denominators** (VMT through zones, lane-mile-hours) depend on activity-data fidelity; no source
   shows a public WZDx feed rich enough on its own — agencies use their internal ATMS/permit records.
4. **Worker injuries** — everyone finds the denominator (hours worked) unobtainable; FHWA dropped the rate. Count
   intrusions and worker injuries (NYSDOT already does) and stop there.
