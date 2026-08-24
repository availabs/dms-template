# pm3 — data provenance and known limits

What a consumer of a pm3 source needs to know about the data underneath it. Every claim here is
measured; the analysis is in `dms-template/references/npmrds pm3/npmrds_analysis/` and each item names
the report it comes from.

**Written for R11.** The campaign found two filtering-like operations that pm3 does not document and
one convention that looks non-standard until explained. A "no filtering applied" note — which is what
we would have said before this — is not accurate.

---

## 1. The feed is already filtered before we see it

**Zero of 1,695,358,623 CY2025 records fall below 2 mph.** Real jams go slower than that, so something
upstream clamps or suppresses the slowest readings. **The maximum implied speed in the same year is
101.7 mph**, with only 99 records above 100 and a 7,700× cliff at that boundary — the same signature at
the other end.

So the choice was never between filtered and unfiltered data. It is between filtering we can document
and filtering we cannot inspect. We cannot quantify what the upstream clamp removed, and it is not
auditable from our side. *(H7, RQ15. Open question for RITIS/INRIX — RQ11.)*

**Consequence:** an "impossibility screen" was specified for pm3 (R12) and then **dropped**, because
there is no impossible-value population left to remove. What looks like impossible values is a
short-segment resolution artifact — see §4.

## 2. The 15-minute mean is the largest outlier suppressor in the pipeline, and nobody chose it

Measures are computed from 15-minute bin means, not raw 5-minute epochs. Averaging is a smoother: a
screen applied to epochs reaches **5.3× further** than the same numeric bound applied to bin means
(1.72% of epochs vs 0.33% of bins), so the binning step hides roughly four fifths of the extreme tail
from anything downstream. It also destroys the evidence for held-feed detection outright — a run of
identical values inside a bin becomes one number.

This is not imputation under `23 CFR 490.509(b)`: nothing is replaced and nothing is dropped by us. It
is a smoothing choice with quantified consequences that was inherited rather than decided. *(H8.)*

## 3. Our free-flow reference already matches the FHWA/ODOT convention

`calcFreeflowBaseThresholdSpeed` takes the **15th percentile of travel time**. Because speed is
monotone-decreasing in travel time, that *is* the **85th percentile of speed** — the standard
convention. It looks non-standard in the code until the monotonicity is pointed out, so auditors
should be told directly. The only genuine divergence is harmonic-vs-arithmetic averaging inside the
bin, which is negligible on a single segment over 15 minutes. *(H5.)*

**What was wrong was the window, not the percentile.** Taken over the publish year, the p15 tracks the
median at `r = +0.998` — it is a lagged measurement of prevailing traffic, so the yardstick slows down
as the network does. R2 publishes an anchored variant alongside; see §6.

## 4. Sub-second travel times are correct, not corrupt

8,292,469 CY2025 records (0.489%) have a travel time under one second. They occur **only** on segments
shorter than 0.05 miles: 4.95M on segments under 0.01 mi (53 feet) at a median implied speed of
**38.5 mph**. Travel time is recorded to 0.01 s, so a 53-foot segment at 38.5 mph legitimately takes
0.94 s.

Filtering them would empty one segment entirely, leave 136 segments with under 10% of their data, and
move 28% of affected segments' references by more than 5% — to change the per-TMC reference by
**+0.009%**. *(RQ15.)*

**A pooled figure here is misleading and we published one internally:** measured on a
*network-pooled* p15 the same removal looks like **+2.75%**, because pooling a 53-foot segment with a
2-mile segment mixes lengths. Per-TMC — the way the runner actually computes it — it is +0.009%. Any
percentile pooled across segments of different lengths carries this artifact.

## 5. Coverage is not stationary, and the two streams are not on the same calendar

Across all 14.47 billion records (2017-01 → 2026-08), daytime epoch coverage moves in **nine abrupt,
month-aligned eras** rather than on a trend — and steps *down* as often as up, from 28.0% to 67.0%.

**The truck stream has its own era history, on different dates.** All-vehicle coverage steps at
2024-08 and 2026-02; truck coverage steps at 2021-01 and 2023-06. At the 2023-06 boundary the two moved
in **opposite directions** (all-vehicle 43.5% → 36.3% while truck rose 13.4% → 18.3%).

Published as `era_all_vehicles`, `era_truck` and a `_crosses_boundary` flag for each. *(H14, atlas.)*

### The comparability rule (R9)

**Do not compare a pm3 measure across an era boundary without a coverage control.** A coverage change
of the size actually observed moves LOTTR ~3% and the *flagged* population ~23% relative, so an
un-annotated multi-year trend is partly feed history.

Practically:

- Check `era_all_vehicles_crosses_boundary` (or `era_truck_crosses_boundary` for truck measures)
  before differencing two years.
- **2024 spans three all-vehicle eras** (E6, E7, E8) — it contains both the Aug-2024 coverage spike and
  the Dec-2024 fall — so an annual 2024 figure blends three regimes and is the least comparable year in
  the archive.
- **2025 sits cleanly inside E8**, which is why the CY2025 measure analysis is era-clean.
- 2024 crosses no *truck* boundary while crossing two all-vehicle ones. Use the tag that matches the
  measure's stream.

## 6. Delay figures depend on which yardstick was used

PHED/TED are published in two variants during the R2 transition:

| variant | threshold from | read this when |
|---|---|---|
| `*_freeflow` | p15 of the **publish year** | comparing to previously published figures |
| `*_freeflow_anchored` | p15 of a **fixed single-era window** — see below | comparing years to each other |

**The window is `FREEFLOW_REFERENCE_WINDOW` in `lib/eras.js`, and that constant is the only source of
truth for it.** It has moved twice on evidence (E8 → E5 on 2026-08-21 when E8 turned out to contain all
of CY2025 and was therefore a no-op; E5 → **E6, 2023-06 → 2024-07** on 2026-08-23 when the publish
scope grew to the full 2017–2025 archive). This section named E8 until 2026-08-24 — a reminder that a
window restated in prose goes stale while the code moves. `eras.js` carries the full argument for the
current choice, and the download manifest that ships inside every pm3 export reads it from there.

The anchored variant yields **+6.69%** more network delay on identical CY2025 data, with 36.3% of
segments up more than 5% against 9.6% down — an asymmetry that identifies it as bias rather than noise.
⚠ **That figure is H5's, and H5 explicitly OMITTED the 20 mph floor.** Recomputed as actually
published — floor included — the same reference change is worth **+1.18%** for E6 (+1.72% for E5,
+1.30% for H5's own CY2023 window); RQ18 explains the gap, since 55.4% of delay is floored under both
references and cannot respond to a reference change at all. The larger effect should reappear in the
unfloored `*_freeflow_relative` series. Both numbers are right; they are answers about different
formulas, and §10's "for scale" comparison against the floor uses the unfloored one.

**Any year-over-year statement computed from the own-year variant understates delay growth by roughly
a third of the reported figure.** *(H5.)*

**Two publish years carry a partially self-referential anchored figure** — `selfReferentialYears` in
`lib/eras.js`, currently 2023 and 2024, the years the E6 window overlaps. Their threshold is computed
partly from their own traffic, so their anchored delay growth is damped; read it as a lower bound.
Segments with no data inside the window fall back to their own year and are flagged
`*_anchor_fallback = 1` — **exclude those rows from any trend.** The fallback rate is 4.6% of the 2017
and 2018 networks and under 0.3% of every other year.

## 7. Precision is published; it is a flag, never a gate

`*_precision_band` is the expected standard deviation of the ratio at that row's sample size, from
measured down-sampling curves. `*_min_n_bar` is the sample needed for ±0.05 precision on 90% of
segments. **Nothing is suppressed for being imprecise** — only 0.16% of directional VMT sits below
LOTTR's bar, so gating would buy almost nothing while removing short segments for the wrong reason.

**TTTR cannot meet the absolute bar on any segment, ever:** it needs 57,832 overnight bins where a year
contains 14,600. That is not a data problem to fix but a property of reading a 95th percentile — the
cost is the *quantile*, not the truck stream, which at matched sample size is the easier of the two.
`tttr_p80` reaches the same bar at 195 bins, **297× cheaper**, and is published alongside for that
reason. *(H1b, R1.)*

The bar is published rather than a boolean below/above flag because pm3's row writer drops falsy
values, which would make a `false` indistinguishable from a missing one. Compare `n_bins` to
`min_n_bar` yourself.

## 8. What is NOT screened, and why

| not done | why |
|---|---|
| Absolute speed bounds (<5 mph, >75 mph) | On a one-sided delay clamp the fast screens are mathematically inert, and `<5 mph` removes **23.16% of the state's real congestion** — 3 mph in a jam is the measurement. *(H7.)* |
| Impossibility screen | No population left to remove; see §1. *(RQ15.)* |
| Completeness normalisation of PHED | Elasticity is 0.34–0.50, not 1.0, so dividing by completeness over-corrects ~2.5×. *(H3.)* |
| Density weighting | No better than a plain count for the all-vehicle stream. Retained for truck only. *(H6, H9.)* |
| Per-TMC quality grade | No persistently-bad-segment population exists. *(H11.)* |
| Step-change screen | Every variant fires *below* its own permutation null. *(H13.)* |

**Relative epoch screening is planned** (R5) and is not yet applied: it removes epochs extreme for
their own segment and isolated in both space and time — 0.084% of records for −2.87% network PHED, with
LOTTR unmoved and 13.2× the leverage of a matched placebo.

---

## 9. Which delay measure should I use? (read this before picking one)

pm3 publishes several delay variants so that different questions can be answered honestly. That is not
an invitation to choose freely — **most of the combinations are wrong for most purposes.** Pick from this
table and nothing else.

| your question | use | why |
|---|---|---|
| **Default for pm3 analysis** — how much delay, and is it getting worse? | `phed_freeflow_anchored`, `ted_freeflow_anchored` | Fixed single-era reference, so year-over-year change is real rather than partly the yardstick moving (§6). Keeps the 20 mph floor, so it stays comparable to the federal figure and retains the absolute-slowness signal. |
| **Comparing delay ACROSS functional classes** (where is congestion worst?) | `*_freeflow_relative` | **Required.** With the floor in place an arterial figure is ~90% floored and a freeway's ~3%, so a floored cross-class comparison compares the floor, not congestion. See §10. |
| **Federal HPMS submittal** | the **map21** data-type, not pm3 | map21 is frozen and is the compliant path. pm3 is forked and deliberately differs. |
| **Comparing to previously published pm3 figures** | `phed_freeflow`, `ted_freeflow` | Own-year reference. **Transitional only** — see the deprecation note below. |
| **Delay against the posted speed limit** | `phed`, `ted` | The federal formula (`max(0.6 × posted, 20)`). Note this measures degradation from a *policy* number, not from what the road can achieve, so on facilities that cannot reach their posted limit it reports delay during normal operation. |

**Deprecated in guidance, retained in code: `phed_freeflow` / `ted_freeflow` (own-year reference).**
Its reference tracks prevailing traffic at `r = +0.998`, so it structurally cannot measure multi-year
deterioration — it is the defect R2 exists to fix. It is published only so consumers can bridge to the
anchored series during the transition, and should be retired once they have. **Do not start new analysis
on it.**

**There is no single variant that is right for everything**, and pretending otherwise would be the real
error. The two axes are independent: *which reference* (own-year vs fixed era) governs whether change
over time is measurable, and *whether the floor applies* governs whether classes are comparable to each
other. The default above is the right answer to the common question; the others are the right answers to
specific ones.

## 10. The 20 mph floor decides most of the delay you are looking at

The threshold is `max(0.6 × base, 20)`. Measured on CY2025:

- **62.7% of all measured delay is computed against a threshold pinned at 20 mph** (37.4% of segments).
- On **principal arterials** — which alone carry **542M of 816M person-hours, two thirds of the state
  total** — it is **89.7%**.
- Removing the floor moves network delay **−41.4%**, and **−59.9% on principal arterials**, while moving
  Interstates only **−1.3%**. For scale, changing the *reference* (§6) is worth +6.69%. **The floor is
  the larger lever by roughly an order of magnitude, and it applies almost entirely off the freeways.**
- Mean unfloored `0.6 × base` is 17.5 mph on minor arterials, 15.4 on major collectors, 11.8 on local
  roads. The floor *raises* those to 20, so on low-speed facilities it **counts normal operation as
  excessive delay** rather than merely clipping the signal.

**Consequence for reporting: never compare delay across functional classes without saying which side is
floored.** An arterial-versus-freeway delay comparison in the floored variants is not a congestion
comparison. Use `*_freeflow_relative` for that, and read §9 first.

**Why the floor was kept anyway.** It is not a mistake. Without it, a street whose achievable free-flow
is 13 mph gets a 7.8 mph threshold, and crawling at 9 mph all day — severe congestion by any human
standard — registers zero delay. A floor has a real purpose; a *single global* floor applied to a network
spanning 65 mph Interstates and 18 mph local streets is what creates the distortion.

**Why the floor is NOT set per functional class.** It was considered and rejected on the data: the
within-class spread exceeds the between-class spread. Principal arterials run from a 7.8 mph unfloored
threshold at p05 to 33.0 at p90 — a 4× range containing both 55 mph suburban arterials and 13 mph city
avenues. A per-class constant would be nearly as blunt as the global one. **Class is the wrong grouping
variable; the segment's own achievable speed is the right one, and `0.6 × base` already is that** — which
is why the fix is to publish the unfloored variant rather than to tune seven constants.


## 11. Data coverage is its own measure, and two percentages are published

Completeness is a property of a **(stream, time bin)** pair, not of a performance measure, so it is
published under its own `coverage_*` prefix rather than duplicated onto every measure that reads the same
data. `coverage_all_vehicles_amp_*` is LOTTR's AM-peak sample; `coverage_freight_trucks_ovn_*` is the
overnight truck sample that **both** TTTR and `tttr_p80` rest on; `coverage_*_all_*` is what TED reads.
The delay family previously had no completeness column at all.

Two percentages, same 0–100 scale, answering different questions:

| column | meaning |
|---|---|
| `pct_bins_reporting` | how much of a bin-based measure's **own input** arrived. Percentiles are taken over 15-minute bin means, so this is the sample size the estimate rests on. |
| `pct_epochs_reporting` | how much of the **raw 5-minute feed** arrived. Always lower, because a bin counts as present when any one of its three epochs did. |

Both are published because they answer different questions and because their **ratio recovers probe
depth**: `pct_epochs / pct_bins × 3` = mean epochs per bin, the term H1b showed the sparsity bias actually
tracks. Publishing only the bin figure would let a consumer reason about sparsity with the **sign
inverted** — removing bins deflates LOTTR, while thinning the probes behind each surviving bin inflates
it, and the second effect dominates real sparsity.

Denominators are derived per bin from its own hours × day-of-week mask, not shared: an AM peak can hold
4,176 bins in 2025 where an overnight bin can hold 14,600.

### ⚠ `pmp` means two different windows across measures

`PMP` is 16:00–19:59 and `ALT_PMP` is 15:00–18:59. LOTTR and TTTR use PMP; PHED uses ALT_PMP — **and
publishes it as `pmp`**. So `lottr_pmp_*` and `phed_pmp_*` are different hour ranges under the same bin
label, distinguished only by the measure prefix. **Do not join a LOTTR PM-peak figure to a PHED PM-peak
figure and assume the same window.**

This predates the fork and is not corrected here, because renaming a published column is breaking. The
`coverage` metric does not inherit the ambiguity: it publishes `pmp` and `alt_pmp` separately, so the
denominator for either is unambiguous.
