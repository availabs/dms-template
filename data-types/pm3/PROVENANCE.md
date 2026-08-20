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
| `*_freeflow_anchored` | p15 of a **fixed single-era window** (E8, 2024-12 → 2026-01) | comparing years to each other |

The anchored variant yields **+6.69%** more network delay on identical CY2025 data, with 36.3% of
segments up more than 5% against 9.6% down — an asymmetry that identifies it as bias rather than noise.

**Any year-over-year statement computed from the own-year variant understates delay growth by roughly
a third of the reported figure.** *(H5.)*

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
