# -*- coding: utf-8 -*-
"""Build lexical section payloads for the two npmrds_docs pages.

Node vocabulary is restricted to what is already in use on this pattern and
verified to render: paragraph · heading · text · list/listitem · image ·
horizontalrule · quote. Lexical TableNode IS registered, but no page in this
pattern uses one, so the mockups' tables are rendered as heading + list here
rather than shipping an unverified serialization onto a live page.
"""
import json, uuid, io, os

BASE = 'https://availabs-bucket.files.availabs.org/img/npmrdsv5+dev2/'
B, I, CODE = 1, 2, 16

def T(t, f=0):   return {"detail":0,"format":f,"mode":"normal","style":"","text":t,"type":"text","version":1}
def P(*c):       return {"children":list(c),"direction":"ltr","format":"","indent":0,"type":"paragraph","version":1}
def H(tag,*c):   return {"children":list(c),"direction":"ltr","format":"","indent":0,"type":"heading","tag":tag,"version":1}
def LI(c,v):     return {"children":c,"direction":"ltr","format":"","indent":0,"type":"listitem","value":v,"version":1}
def UL(items):   return {"children":[LI(c,i+1) for i,c in enumerate(items)],"direction":"ltr","format":"",
                         "indent":0,"listType":"bullet","start":1,"tag":"ul","type":"list","version":1}
def HR():        return {"type":"horizontalrule","version":1}
def QUOTE(*c):   return {"children":list(c),"direction":"ltr","format":"","indent":0,"type":"quote","version":1}
def IMG(f,alt):  return {"altText":alt,
                         "caption":{"editorState":{"root":{"children":[],"direction":None,"format":"","indent":0,"type":"root","version":1}}},
                         "height":0,"showCaption":False,"src":BASE+f,"type":"image","version":1,"width":0}
def ROOT(*c):    return {"root":{"children":list(c),"direction":"ltr","format":"","indent":0,"type":"root","version":1}}

def section(title, *children):
    return {"group":"default","level":"1","title":title,
            "trackingId":str(uuid.uuid4()),
            "element":{"element-type":"lexical",
                       "element-data":json.dumps({"bgColor":"#fff","isCard":"","text":ROOT(*children)})}}

# helper: a "label — body" bullet
def bullet(label, body):
    return [T(label, B), T(" — " + body)]

MEASURES = []   # page 281670
GUIDE    = []   # page 280612

# ══════════════ PAGE 281670 · PM3 Measures — Measures & Methodology ══════════════

MEASURES.append(section("Federal PM3, and what this site publishes",
  P(T("Read this first. Two different measure families share the same names, and telling them apart changes what a number means.")),
  P(T("LOTTR, TTTR and PHED are "), T("federally defined", B), T(" measures under MAP-21 (23 CFR 490). New York submits them to FHWA every year. This site also computes an "), T("analytical", B), T(" version of the same measures — same probe feed, same segments, deliberately different choices — so that questions the federal formula cannot answer can still be answered honestly.")),
  QUOTE(P(T("They are separate pipelines that no longer move together. The numbers will not always agree, and that is by design.", B))),
  H("h3", T("The federal submittal")),
  UL([
    bullet("Measures", "LOTTR, TTTR and PHED — and nothing else."),
    bullet("Rules", "fixed by 23 CFR 490. Frozen; it does not change."),
    bullet("Use it for", "anything reported to FHWA."),
    bullet("Where", "the MAP-21 pages."),
  ]),
  H("h3", T("This site's analytical series")),
  UL([
    bullet("Measures", "those three, plus a truck p80 reliability ratio, several delay variants, percentile speed, and data coverage."),
    bullet("Rules", "free to improve on the evidence, and documented when it does."),
    bullet("Use it for", "analysis, prioritisation, corridor and regional work."),
    bullet("Where", "the Macro View and Reports."),
  ]),
  P(T("If you are filling in a federal form, use the MAP-21 pages.", B), T(" The measures described below are the analytical series and are not the compliant figure.")),
))

MEASURES.append(section("The measure catalogue",
  P(T("Seven measures are published today. Each entry answers the same five questions in the same order: what it answers, how it is computed, "), T("the choices made", B), T(", how much to trust it, and where it breaks down. The descriptions are the same text the tool itself shows.")),
  P(IMG("macro-02-measure-menu.avif","The macro view's measure menu, open, listing seven measures grouped as reliability, congestion, speed and data quality.")),
  P(T("The seven published measures as the tool groups them — reliability, congestion, speed, data quality. Macro view, measure menu open, captured 2026-08-27.", I)),
  HR(),

  H("h2", T("LOTTR · Level of Travel Time Reliability")),
  P(T("How much longer a bad trip takes than a typical one. The 80th-percentile travel time divided by the 50th, per segment per peak period.")),
  UL([
    bullet("Periods", "AM peak, midday, PM peak, weekend."),
    bullet("Stream", "all vehicles."),
    bullet("Unreliable when", "LOTTR is 1.50 or above."),
  ]),
  H("h3", T("The choices made")),
  UL([
    [T("The 80/50 percentile pair is the federal definition and is kept unchanged, so the analytical series stays readable next to the submittal.")],
    [T("Nothing is suppressed for thin sample. A segment with few observations still publishes and carries its own precision columns — "), T("flag, never gate", B), T(". Suppression would bias every roll-up toward well-observed urban segments.")],
    [T("Because the 80th percentile ignores the top 0.1% of trips by construction, LOTTR is the most outlier-robust measure published here.")],
  ]),
  H("h3", T("How much to trust it")),
  P(T("A precision band is published on every row. Measured by down-sampling real segments, the spread of the ratio falls from ±0.079 at 25 observations to ±0.007 at 1,000. The bar for ±0.05 precision is 707 bins, and 85.0% of segments clear it.")),
  H("h3", T("Known limits")),
  UL([
    [T("Thin-but-present data pushes LOTTR "), T("up", B), T(": a high percentile of a small sample skews high. A coverage change of the size actually observed moves LOTTR about 3% and the flagged-unreliable population about 23% relative.")],
    [T("Short segments are fragile. 24.3% of segments are under 0.05 mi and are flagged unreliable 7.7 times more often (56.0% against 7.3%). Weight by mileage or VMT before drawing a network conclusion.")],
    [T("Statewide unreliability is 29.1% by segment count, 9.2% by mileage and 17.8% by VMT. Say which one you mean.")],
    [T("Its PM-peak window is 16:00–19:59 — not the same as PHED's. See “Two traps” below.")],
  ]),
  HR(),

  H("h2", T("TTTR · Truck Travel Time Reliability")),
  P(T("The same question for freight, at a stricter percentile. The 95th-percentile truck travel time divided by the 50th, per segment per peak period.")),
  UL([
    bullet("Periods", "AM peak, midday, PM peak, weekend, overnight."),
    bullet("Stream", "freight trucks, with an all-vehicle fallback."),
  ]),
  H("h3", T("The choices made")),
  UL([
    [T("The 95/50 pair is the federal definition, kept unchanged.")],
    [T("Where a bin has no truck data, an all-vehicle travel time is substituted.", B), T(" This is a real choice with a measured cost: about 37% of AM-peak bins carry a substituted value, and removing the substitution moves TTTR by +1.06%. Defensible, but it means TTTR is not a pure truck measure.")],
  ]),
  H("h3", T("How much to trust it")),
  P(T("A per-segment TTTR never meets its own precision bar.", B), T(" ±0.05 precision needs 57,832 overnight bins; an overnight year contains 14,600. The bar is unreachable by construction, and only 1.15% of segments clear it in any period. That is the honest signal, not a typo.")),
  H("h3", T("Known limits")),
  UL([
    [T("Truck coverage is thin and has changed enormously — truck reporting bins run 8.0% to 23.5% across the nine coverage eras. A year-over-year truck comparison is a coverage comparison unless checked.")],
    [T("For per-segment or corridor work, prefer the p80 truck ratio below. Reserve TTTR for comparison against federal figures and for large aggregates.")],
  ]),
  HR(),

  H("h2", T("TTTR₈₀ · truck reliability at the 80th percentile")),
  P(T("The same ratio as TTTR but taken at the 80th percentile instead of the 95th. It reads lower than TTTR by construction; its value is that it needs a far smaller sample for the same confidence, which matters because truck coverage is thin.")),
  H("h3", T("The choices made")),
  UL([
    [T("This is an AVAIL measure, not a federal one.", B), T(" It exists because the federal one is not estimable per segment on this network.")],
    [T("Nothing else changes — same truck stream, same periods, same calculator. Only the percentile moves, so any difference from TTTR is purely the depth of the tail being read.")],
    [T("It is published alongside TTTR rather than replacing it, so the federal figure remains available and the two can be compared directly.")],
  ]),
  H("h3", T("How much to trust it")),
  P(T("It reaches the same ±0.05 precision bar at 195 bins against TTTR's 57,832 — 297 times cheaper. 68.8% of segments clear it, against TTTR's 1.15%.")),
  H("h3", T("Known limits")),
  UL([
    [T("Its values are lower than TTTR by construction", B), T(" and must never be presented as a TTTR figure or compared to a federal threshold.")],
    [T("It reads a shallower tail, so it is less sensitive to rare severe events — which is the point, but it means it is not a substitute when the question really is about worst-case freight delay.")],
  ]),
  HR(),

  H("h2", T("PHED · Peak Hour Excessive Delay")),
  P(T("Peak-hour delay counted per person. Excessive delay is the extra time spent under a speed threshold — 20 mph or 60% of the reference speed, whichever is greater.")),
  UL([
    bullet("Periods", "AM peak, PM peak."),
    bullet("Controls", "unit (person or vehicle hours), per mile."),
    bullet("Volume", "from directional AADT and hourly factors."),
  ]),
  H("h3", T("The choices made")),
  UL([
    [T("The threshold is the federal formula. "), T("Which reference speed it is 60% of is a choice", B), T(", and it changes the number — see “Which delay measure should I use?” below.")],
    [T("Both floored and unfloored variants are published. The floor is retained by default because without it a street whose achievable free-flow is 13 mph gets a 7.8 mph threshold, and crawling at 9 mph all day would register zero delay.")],
    [T("A per-functional-class floor was considered and rejected on the data", B), T(": within-class spread exceeds between-class spread, so a per-class constant is nearly as blunt as the global one.")],
  ]),
  H("h3", T("How much to trust it")),
  P(T("No precision band is published for the delay family, and that is deliberate: the down-sampling experiment that produced the reliability bands was never run for delay, and a band without a measurement behind it would be a guess. No measured curve, no column, no claim.")),
  H("h3", T("Known limits")),
  UL([
    [T("The floor governs most of what you are looking at.", B), T(" 62.7% of all measured delay is computed against a threshold pinned at 20 mph — 89.7% on principal arterials. Removing it moves network delay −41.4% but Interstates only −1.3%.")],
    [T("Never compare delay across functional classes in the floored variants", B), T(" — you would be comparing the floor, not congestion.")],
    [T("61% of network mileage is absent from the delay family entirely.", B), T(" A statewide delay total is a total over the 39% that qualifies.")],
    [T("PHED publishes its PM peak as “pmp” but computes it over 15:00–18:59, unlike LOTTR and TTTR.")],
  ]),
  HR(),

  H("h2", T("TED · Total Excessive Delay")),
  P(T("How many vehicle-hours are lost below the delay threshold speed, across all hours rather than just the peak.")),
  H("h3", T("The choices made")),
  UL([
    [T("TED is the all-hours sibling of PHED and shares its threshold, its reference choice and its floor. Everything in the PHED entry applies here.")],
    [T("It is reported in vehicle-hours by default, since an all-hours figure has no single defensible occupancy assumption.")],
  ]),
  H("h3", T("How much to trust it")),
  P(T("No precision band, for the same reason as PHED. TED is, however, the measure most exposed to outliers of anything published here: grouping segments by their own tail weight moves median TED across a 37-fold range, against LOTTR's near-immunity.")),
  H("h3", T("Known limits")),
  UL([
    [T("Highly sensitive to extreme single-epoch travel times — but a heavy tail is also what congestion genuinely looks like, so this cannot be screened away with a threshold.")],
    [T("It inherits the AADT vintage problem directly, because delay scales linearly in volume. Read “Two traps” below before charting TED over multiple years.")],
  ]),
  HR(),

  H("h2", T("Percentile speed")),
  P(T("What speed a chosen share of trips beat — the floating-car view. The chosen percentile of observed speed over all travel times, at the 5th, 20th, 25th, 50th, 75th, 80th, 85th or 95th percentile.")),
  H("h3", T("The choices made")),
  UL([
    [T("Speed is "), T("derived", B), T(", not measured: the feed carries travel time, and speed is segment length divided by it. Segment length therefore enters every speed figure.")],
    [T("Percentiles are taken over observed travel times with no imputation for missing epochs.")],
  ]),
  H("h3", T("Known limits")),
  UL([
    [T("Bad geometry produces impossible speeds.", B), T(" On very short segments a one-second travel-time error becomes a large speed error — and 0.49% of travel times in the feed are under one second.")],
    [T("The feed contains no records below 2 mph — a vendor floor we cannot inspect. Very low speeds are truncated before we see them.")],
    [T("36.2% of records show trucks moving faster than passenger cars, which is implausible at scale and is a known property of the feed rather than of the road.")],
  ]),
  HR(),

  H("h2", T("Data coverage")),
  P(T("Two percentages on the same 0–100 scale. Bins reporting is how much of a bin-based measure's own input arrived — the sample size its percentiles rest on. Epochs reporting is how much of the raw 5-minute feed arrived, and is lower by construction, since a bin counts as present when any one of its three epochs did.")),
  H("h3", T("The choices made")),
  UL([
    [T("Coverage is published as a measure in its own right, not as a footnote", B), T(", and sits in its own group so it cannot be mistaken for a property of traffic. It describes the input, not the road.")],
    [T("It is published once per stream per bin rather than duplicated onto every measure that reads the same stream.")],
    [T("The bin count is the count of bins where that stream actually had a value — not bins where the feed had any row. Counting feed rows had been inflating the truck figure roughly twofold.")],
  ]),
  H("h3", T("How much to trust it")),
  P(T("This is the measure to read first. Coverage is not stationary — there are nine distinct coverage eras between 2017 and 2026 — and it confounds everything else on the map.")),
))

MEASURES.append(section("Which delay measure should I use?",
  P(T("Several delay variants are published so that different questions can be answered honestly. "), T("That is not an invitation to choose freely — most combinations are wrong for most purposes.", B), T(" Pick from this list and nothing else.")),
  H("h3", T("Default — how much delay, and is it getting worse?")),
  P(T("Use the "), T("anchored free-flow", B), T(" variants. A fixed reference means year-over-year change is real rather than partly the yardstick moving. They keep the floor, so they stay comparable to the federal figure.")),
  H("h3", T("Comparing delay across functional classes")),
  P(T("Use the "), T("relative (unfloored)", B), T(" variants. "), T("This is required, not optional.", B), T(" With the floor in place an arterial figure is about 90% floored and a freeway's about 3%, so a floored cross-class comparison compares the floor, not congestion.")),
  H("h3", T("Delay against the posted speed limit")),
  P(T("Use the "), T("speed-limit threshold", B), T(" variants — the federal formula. Note this measures degradation from a "), T("policy", I), T(" number, so on roads that cannot reach their posted limit it reports delay during normal operation.")),
  H("h3", T("Anything reported to FHWA")),
  P(T("Use the MAP-21 pages, not this tool. That pipeline is frozen and is the compliant path; this one is deliberately different.")),
  H("h3", T("Comparing to previously published figures")),
  P(T("Use the "), T("own-year free-flow", B), T(" variants — "), T("transitional only", B), T(". Their reference tracks prevailing traffic almost perfectly, so they structurally cannot measure multi-year deterioration. Do not start new analysis on them.")),
  HR(),
  QUOTE(P(T("There is no single variant that is right for everything, and pretending otherwise would be the real error. Two axes move independently: which reference is used governs whether change over time is measurable, and whether the floor applies governs whether classes are comparable to each other.", B))),
))

MEASURES.append(section("Coverage is not stationary",
  P(T("The single most common way to misread this data is to treat a change in how much data arrived as a change in traffic.")),
  UL([
    bullet("Nine coverage eras", "distinct feed regimes between 2017 and 2026. Four of the nine published years blend two eras."),
    bullet("All-vehicle bins reporting", "ranges from 36.3% to 51.5% across published years. Not a trend — a property of the feed."),
    bullet("Truck bins reporting", "ranges from 8.0% to 23.5%. Truck coverage roughly tripled over the period, so any truck trend must control for it."),
  ]),
  H("h3", T("The two families move in opposite directions")),
  P(T("Thinning the probes behind a bin "), T("inflates", B), T(" the reliability ratios, while removing reporting bins "), T("deflates", B), T(" the delay measures. Same cause, opposite signs. So if reliability and delay appear to disagree across years, check coverage before concluding anything about the road.")),
  P(T("The rule: ", B), T("compare within a coverage era, or state that you are crossing one. Every published row carries the coverage columns needed to check.")),
  P(T("For scale: 88.1% of records rest on four probes or fewer, and trucks are absent from 59.6% of records outright.")),
))

MEASURES.append(section("Two traps when reading across years and measures",
  P(T("Both of these are known, measured, and easy to walk into.")),
  H("h2", T("Trap 1 · a delay trend is partly an AADT revision history")),
  P(T("Delay scales "), T("linearly", B), T(" in traffic volume, and volume comes from an estimated AADT dataset with its own revision cycle. On a fixed panel of identical segments, total directional AADT falls 14.9% between 2021 and 2022 — and "), T("rose", I), T(" 2.3% in 2020, meaning the series does not register COVID at all. Traffic does not do that; a revision cycle does.")),
  UL([
    bullet("2019", "272.07M directional AADT, +1.5% against 2017."),
    bullet("2020", "274.06M, +2.3% — the year traffic actually collapsed."),
    bullet("2021", "273.94M, +2.2%."),
    bullet("2022", "227.92M, −14.9%. A revision, not a traffic change."),
  ]),
  P(T("What to do: ", B), T("read a multi-year delay series per unit of AADT, or pin a single AADT vintage. Normalised this way the 2021→2022 step falls from −18.5% to −2.2%. Single-year and cross-sectional comparisons are unaffected — within one year there is one vintage. The download package flags this automatically when a requested year range straddles the boundary.")),
  HR(),
  H("h2", T("Trap 2 · “PM peak” means two different windows")),
  P(T("LOTTR and TTTR compute their PM peak over 16:00–19:59. PHED computes its PM peak over 15:00–18:59 — and publishes it under the same “pmp” label.")),
  P(T("Do not join a LOTTR PM-peak figure to a PHED PM-peak figure and assume the same window.", B), T(" The labels match; the hours do not. This predates the current pipeline and is not corrected, because renaming a published column would break every existing consumer. Coverage is exempt — it publishes both windows separately, so its denominators are unambiguous.")),
))

MEASURES.append(section("In development",
  P(T("Three measures are declared but not yet computed. They are deliberately kept "), T("out of the measure menu", B), T(" — you cannot select one and get an empty map — while still being listed in the Macro View's own measure reference, so the gap is visible rather than silent.")),
  UL([
    bullet("Free-flow speed", "how fast the road runs when nothing is in the way; the 85th percentile of off-peak observed speed. Computed internally today as the reference behind the delay family, but not yet published as a measure in its own right."),
    bullet("Emissions", "what the traffic on a segment puts into the air — a speed-binned emission rate applied to vehicle-miles travelled. Blocked on confirming the emission-rate table with NYSDOT. The rate curve is fleet-dependent, so the fleet year it represents will be published alongside every value."),
    bullet("Attributes", "network metadata itself — functional class, AADT, ownership — coloured straight from a field joined off the network table, with no measure controls."),
  ]),
))

MEASURES.append(section("Measures that used to be here",
  P(T("Earlier versions of this documentation listed measures the current tool no longer offers. If you used one of them, here is what happened to it.")),
  UL([
    [T("Planning Time Index (PTI), Buffer Index, Travel Time Index", B), T(" — not currently computed. Percentile speed gives the underlying distribution; reinstating this family is under evaluation.")],
    [T("RIS attributes", B), T(" — AADT variants, posted speed, DDHV, adjusted rated capacity, volume-to-capacity, K and D factors — not currently exposed. The Attributes measure above is the intended home for these.")],
    [T("Percent bins reporting", B), T(" — "), T("restored", B), T(". It is now published as the Data coverage measure, per stream per period.")],
  ]),
))

MEASURES.append(section("Glossary",
  UL([
    bullet("TMC", "Traffic Message Channel — the road segment this data is reported on. New York has roughly 52,000. Median length is about 0.28 mi, and 24.3% are under 0.05 mi."),
    bullet("Epoch", "one 5-minute observation of travel time on one segment. The rawest unit in the feed."),
    bullet("Reporting bin", "a 15-minute window — three epochs — averaged before any percentile is taken. This averaging is the pipeline's largest outlier suppressor, removing roughly 80% of extreme epochs."),
    bullet("Stream", "which vehicles a travel time describes: all vehicles, passenger vehicles, or freight trucks. The streams arrive independently and on different calendars."),
    bullet("Precision band", "the expected spread of a measure at the sample size behind that row, measured by down-sampling real segments rather than assumed from a formula. Advisory — nothing is ever suppressed for being imprecise."),
    bullet("Minimum-n bar", "the observation count a measure needs for ±0.05 precision, published next to the row's own count so you can make the comparison yourself."),
    bullet("Free-flow reference", "the uncongested speed a segment is compared against. Taken as the 15th-percentile travel time, which is equivalent to the conventional 85th percentile of speed."),
    bullet("The floor", "the 20 mph minimum on the excessive-delay threshold. It governs 62.7% of all measured delay and almost none of it on freeways."),
    bullet("Coverage era", "a period over which the feed's completeness is stable. There are nine between 2017 and 2026; comparisons within one are safe, comparisons across one need stating."),
  ]),
))
