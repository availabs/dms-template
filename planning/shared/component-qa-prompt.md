# Page QA prompt — the visitor pass, then binding hygiene & presentational relics

A reusable prompt for QA-ing a DMS pattern: first **what a first-time reader
sees on the rendered pages**, then the stored configuration behind it —
configured data components (`Spreadsheet`, `Card`, `Graph`, `FilterComponent` —
anything consuming `dataWrapper`) audited against the sources they are bound to.

**Scope:** two passes over the same pattern, in this order, and one gate that
governs both.

- **The relevance gate** — three tests every finding must pass before it is
  ranked or written down: name the setting and its correct value, prove nobody
  already owns it, and separate what you observed from what you inferred.
  Measured effect on the calibration run: 539 raised, 71 wanted. Read it first.
- **The visitor pass (Part 0)** — open the pages as a first-time reader and
  report what they would notice. Everything is quoted or measured off the
  *rendered* page. This is the pass a stakeholder asked for when they said "QA
  the site."
- **The config passes (Parts 1 and 2)** — binding hygiene and presentational
  relics, derived from stored configuration across the whole pattern. These
  supply the *cause* and the *blast radius* for what Part 0 found, and they
  find the latent defects a reader can't see yet.

**Run Part 0 first, and let it decide what Parts 1 and 2 are for.** A config
sweep run on its own produces a list nobody asked for, ranked by nothing: it
cannot tell a defect that is on screen right now from one that is invisible,
and it reports both at the same volume. Part 0 supplies the ranking. A run that
skips Part 0 and hands over a config table has answered a different question
from the one that was asked.

Neither pass is sufficient alone, and the failure is symmetric:

| | config says clean | config says broken |
|---|---|---|
| **render is clean** | fine | **false positive** — noise that costs the audit its credibility |
| **render is broken** | **false negative** — the defect ships | fine |

Both off-diagonal cells were populated in the reference run. See
[Part 0 §Why both passes](#why-both-passes-the-symmetric-failure).

**Design principle:** every check below is a *detector*, not a judgment. In the
config passes, Checks A and C are mechanical and should be run as sweeps
producing tables — the tool finds and tabulates, a human decides; Check B is the
only one requiring interpretation, and it is scoped to producing ranked
suspicion, not verdicts.

Part 0 is the deliberate exception. Its output *is* a ranked judgment, because
"what would a reader conclude from this" has no mechanical form and a list of
unranked observations is what this document exists to avoid. Keep the judgment
in the ranking and the framing; keep the evidence quoted and measured, so a
reader who disagrees with your tier can still check your facts.

**Status:** drafted 2026-08-17 (config passes), validated against MitigateNY
(app `mitigat-ny-prod`, pattern 985070). Part 0 added 2026-08-19 after the
county-template run (pattern 1300890) established that a config-only report
answers the wrong question. **The relevance gate added 2026-09-01** after the
draft-sections run on the same pattern returned 539 findings of which the owner
wanted 71 — the first run where the failure was not accuracy but relevance.
Calibration numbers in the appendix. Promote to `src/dms/skills/` after a second
site.

---

## The prompt

> QA the DMS pattern **`<SCOPE>`** at **`<URL>`**. App `<APP>`.
>
> **Start with the visitor pass (Part 0).** Open the site at `<URL>` and walk it
> as someone reaching it for the first time. Report what a reader would notice,
> quoted or measured off the rendered page, ranked by what it makes them
> conclude — not by how hard it is to fix. Then use Parts 1 and 2 over the
> stored configuration to explain each finding's cause and count how far it
> spreads.
>
> Ask for the URL if you weren't given one. Do not substitute a config sweep for
> a site you couldn't load — say you couldn't load it.
>
> **Run the relevance gate before you rank anything.** Drop every finding that no
> named setting can fix, that a live task document already owns, or that you
> inferred from stored config without observing the render. A report that lists
> everything true is not a QA report; it is a diff. See "The relevance gate".
>
> If the scope is a page or a single component, state its editorial intent in
> one sentence (e.g. *"an all-hazards overview; no hazard is privileged or
> excluded"*). Check B needs it; A and C do not.
>
> For the config passes, work from the **stored configuration**, and resolve
> every column against the **live source row** — never against the copy of the
> source embedded in the component. The component's embedded snapshot is frozen
> at bind time and is routinely years stale; trusting it is the single most
> common way this audit returns a false clean.
>
> **Never report a config finding as visitor-visible without opening the page.**
> Rendering overrides stored config in at least three routine ways — CSS
> transforms, runtime page variables, and lookup resolution — so a config-derived
> claim about what a user sees is a hypothesis until the render confirms it.
>
> Run checks A, B, C on any data-bound component; D, H, E and F additionally on
> any `Map` section — **H before F**, since F's findings are usually H's blast
> radius; G as a cheap add-on. Run I, J, K on any page whose look is in scope.
> Report as specified. **Do not modify any DMS row.**
>
> **Run the checks this document specifies, and name the ones you skipped.** A
> sweep that reports whatever the scan made convenient, and never says which
> checks it did not run, reads as complete when it is not. In the calibration
> run only Check A was run of A–M; Check C would have caught a real defect on a
> component the report had already flagged for the wrong reason.
>
> For the Part 2 (presentational) checks, work at **page and section-order
> level**, not per component: the defects live in how sections are sequenced and
> chromed relative to each other. Sweep every page in the pattern — these travel
> with copied templates, so a defect found on one page is usually on all of its
> siblings.
>
> If the scope contains two components of the same type and title — one usually
> a draft beside a published one — diff that pair **before** running any check.
> A corrected copy sitting next to a broken one is a specification of the fix;
> see "First, look for a fixed twin" under Reporting.
>
> Checks A, C, D and E are decided by **distribution across the pattern**, not
> by inspecting one component in isolation. Where a check says "the outlier is
> the finding", sweep first and read the outliers — a single component gives you
> no baseline to judge against.

---

## Setup

```bash
# Token: POST {API_HOST}/login {email, password, project: <APP>} -> user.token
# See src/dms/skills/authenticating-the-dms-cli.md (~6h TTL)

dms raw get <COMPONENT_ID>    # component
dms raw get <SOURCE_ID>       # LIVE source — the reference for A and C
```

For a pattern-wide sweep, enumerate `{app}+{patternInstance}|component`, then
batch-fetch the distinct `sourceInfo.source_id` values.

### Where things live

Component payload is `data.element["element-data"]`, a **JSON string** — parse it.

| Key | What it holds |
|---|---|
| `columns[]` | this component's columns: `name`, `type`, `show`, `display_name`, `customName`, `filters[]` |
| `sourceInfo` | **frozen snapshot** of the source: `columns[]`, `source_id`, `view_id` |
| `dataRequest` | compiled query: `filter`, `exclude`, `groupBy`, `orderBy`, `fn` |
| `display` | `pageSize`, `totalLength` (cached count), `usePagination` |
| `data` | cached page of rows |

Live source columns are at `data.config.attributes` — sometimes a JSON string
nested inside a JSON string; parse until you have an array. Each entry has
`name` (the raw column or full SQL expression), `type`, and `display_name`
(the human title shown in the columns menu).

**Matching columns:** normalize whitespace before comparing
(`String(name).replace(/\s+/g,' ').trim()`). Calculated columns are long SQL
expressions where incidental whitespace differs freely; naive equality fails.
Match on the full normalized name, not the trailing `as <alias>` — aliases are
not unique in practice.

**Three column lists, kept distinct:**

```
live source .config.attributes    ← the truth; resolve against this
        │  (frozen at bind time)
        ▼
element-data.sourceInfo.columns   ← the snapshot the editor UI diffs against
        │  (author-selected subset + overrides)
        ▼
element-data.columns              ← what this component renders
```

---

# The relevance gate

**Run this before you rank anything, and again before you write.** Every finding
must pass three tests. A finding that fails one is not wrong — it is usually
perfectly true — it is *not reportable*, and reporting it costs you the reader's
attention for the ones that are.

This section exists because of a measured failure. In the calibration run the
report raised **539 items** and the owner judged **71 relevant — 13%**, of which
**65 fell in just three of the nine classes**. The rejects were not errors of
fact. They were true observations that should never have been ranked, and the
three classes that survived were separable up front by Test 1 alone. See "The
relevance gate — reference run" in the calibration appendix for the full
scoreboard.

---

## Test 1 — Can you name the setting and its correct value?

The findings that survive owner review nearly all have one shape: **a named
setting has a known correct value, and it is currently absent or wrong.** The
correct value has to come from outside your own judgment:

| Source of the correct value | Example from the calibration run |
|---|---|
| A documented rule | internal DMS source → `Data Fetch Mode = Force` (owner's rule, in the task doc) |
| A published vocabulary | `tags` → a 44 CFR 201.6 element |
| Overwhelming sibling consensus | `authPermissions` → the object 377 of 398 sibling components already carry |

All three of those classes came back **100% relevant**. Every class that could
not name a correct value came back at or near **0%**.

**If you cannot state the correct value inside the finding, you do not have a
finding.** You have an observation. Observations go in an appendix, unranked.

Things that failed this test in the calibration run, and why:

- *"This table stores a row count of zero."* There is no correct value. Zero may
  be right — see the template rule below.
- *"This component's snapshot is a generation behind the source."* A correct
  value exists, but no one has decided the current one is wrong. That is Test 2.
- *"The work record says done and the platform disagrees."* The correct state is
  a **question**, not a value. See Test 3's last rule.

## Test 2 — Is this already someone's scheduled work?

**Read the project's live task documents before you rank, not after.** A class
that a task already owns is not a finding; it is a status line.

This single test accounted for **347 of the 474 rejected rows** — three entire
classes, all covered by one owner note: *"disregard for now, we will review this
in a separate update."* One of them was the report's own Tier 1 finding #3.

How to run it:

1. List the classes you are about to report.
2. Search `planning/**/tasks/current/*.md` (and the project's equivalent) for
   each class by name, by the setting it touches, and by the source it involves.
3. Read the **Scope**, **Open items** and any **PAUSED** section. Task docs
   routinely record that a class is deliberately parked, and say why.
4. Any class a task names as deferred, parked, scheduled, or already applied is
   marked **Deferred — owned by `<task>`** and kept **out of the tiers entirely**.

Reading the task docs is not the same as running this test. In the calibration
run both task documents were read in full, and the deferral still went unnoticed,
because the docs were mined for *scoping rules* and never asked the question
*"does this document already own the thing I am about to report?"* Ask it
explicitly, class by class.

## Test 3 — Did you observe it, or infer it?

Any claim about what a page *shows* — empty, unscoped, unlabelled, broken,
misaligned — is **latent until the render is observed**. Part 0 already says
this. The calibration run said it too, in its own limits section, and then
ranked inferred claims in Tier 1 and Tier 2 anyway. A caveat that does not change
the ranking is doing no work.

Three inferences that were confidently wrong:

| Inferred from config | What was actually true |
|---|---|
| No filter block in `element-data` → "unscoped collection, renders every subject's rows" | Both instances were filtering correctly and showing the intended content |
| Untitled + untagged + small payload → "contentless shell" | 74 of 75 render exactly as designed. Headers, footers, filters and maps have **no title by design** |
| `totalLength: 0` → "table not pulling data" | The jurisdiction genuinely has no rows for that table |

### The template rule

**In a template, empty is the expected state.** A county template exists to be
filled in later by a local author. Blank tables, untitled slots and zero counts
are the medium, not a defect in it. Before reporting emptiness, ask what would
have to be true for it to be *wrong* — usually that the subject demonstrably has
data that is not appearing. If you cannot show that, the finding is that nothing
distinguishes an intentional vacancy from a failure (detector V5), which is one
finding about the design, not N findings about N components.

### A record–platform disagreement is a question, not a finding

When a work record says done and the platform disagrees, the record may be
lagging a deliberate decision. In the calibration run 43 rows were raised as a
Tier 1 "the record disagrees with the platform"; the owner's answer was *"user
excluded tags here because they break the design, but the requirements were met
elsewhere."* Correct observation, wrong frame. Raise it as one question to the
owner, not as N ranked defects.

---

## What to do with what the gate rejects

Do not delete it. Rejected material has two legitimate homes:

- **Deferred (owned)** — one line per class naming the task that owns it, and
  its status there. This is how the next reviewer knows not to re-raise it.
- **Observations** — an unranked appendix, with the reason each is unranked
  ("no correct value can be named", "not observed in the render").

Both belong *after* the tiers, and neither may contribute to the tier counts or
to the headline. If your headline count includes anything the gate rejected, the
headline is wrong.

## The gate in one line

> Report a thing when you can name the setting, name its correct value, show
> nobody already owns it, and — for anything about what a reader sees — say that
> you looked.

---

# Part 0 — The visitor pass

Open the pages. Report what a first-time reader notices, and for each thing,
what is producing it.

This part has a different unit of analysis from the rest of the document. Parts
1 and 2 enumerate *components*; Part 0 enumerates *what a person perceives*, and
one perception routinely spans several components (or none — some of the worst
findings are timing, not config). Do not organise Part 0 by component id.

---

## The ranking: what does this make the reader conclude?

**Only gated findings get ranked.** Anything the relevance gate deferred or
demoted to an observation is not eligible for a tier and does not count toward
the tier totals.

Rank findings by the conclusion they produce, not by severity-in-the-abstract
and not by fix cost. Three tiers, and the boundaries are the point:

| Tier | The reader concludes | Why it ranks here |
|---|---|---|
| **1** | *"This is showing me the wrong information."* | Attacks the product's reason to exist. One instance forces the reader to re-verify everything else on the site, including the parts that are correct. |
| **2** | *"Nobody has finished this."* | Doesn't make them doubt what *is* there, but they can't tell an intentional blank from a broken one. |
| **3** | *"This feels unmaintained."* | Registered without being able to name it. Individually trivial; collectively it is the whole impression of polish. |

The tier boundary between 1 and 3 is where most reports go wrong, in both
directions. A misaligned card border and a table showing another subject's rows
are *not* the same kind of problem and must not be interleaved in one list. But
equally: a Tier 3 finding on the number that the plan is *about* can outrank a
Tier 1 finding in a footer. Rank by consequence-to-this-reader, then sanity-check
the ordering by asking which finding you would want fixed if only one could be.

**State the tier counts up front.** "7 / 5 / 5" tells a stakeholder what kind of
site this is in one line; "17 findings" tells them nothing.

---

## Scoping the walk

1. **Establish the render set before counting anything.** Find which stored
   array the public view actually renders (in this codebase, published
   `sections` — not `draft_sections`, and not rows referenced by neither).
   Report every figure against that set. This routinely changes headline counts
   by an order of magnitude, and every distribution in Parts 1 and 2 is computed
   over the same table.
2. **Walk the templates, not the pages.** Where a pattern is one template
   copied per subject (per hazard, per county, per year), walk two or three
   instances and confirm the finding is the template's, then get the spread from
   config. Walking all 16 buys nothing over walking 3 and counting.
3. **Walk every structurally distinct page once** — each landing page, each form,
   each list, each detail view. Distinctness is by layout and binding shape, not
   by title.
4. **Say how many you walked and which.** A reader of the report must be able to
   tell a finding that was seen from a finding that was counted.

---

## The seven detectors

Each is phrased as what the reader perceives, because that is what makes it a
Part 0 finding rather than a config observation.

### V1 — the page shows the *previous* subject after you navigate

**The highest-value detector in this document, and it is invisible to every
other check here.** It does not appear in stored config, it does not reproduce
on a hard refresh, and it does not appear in a screenshot taken a second late.

Where a section caches the rows it last fetched and paints them while a new
request is in flight, an in-app navigation shows the *previous* subject's data
under the *new* subject's URL and breadcrumb. The reader sees a confident wrong
answer, not a loading state.

**Do:** navigate between two sibling pages **the way a user does — click a real
link** — and sample the DOM every ~200ms across the transition. Record the URL
and a subject-identifying element together at each tick.

```
click        url /…/wind      card WIND · HIGH RISK
t = 1400ms   url /…/drought   card WIND · HIGH RISK   ← address changed, content didn't
t = 1800ms   url /…/drought   card DROUGHT · MODERATE RISK
```

Report the **window of wrongness** (here 400ms) and the **total click-to-correct
time** (1800ms) as separate numbers — they have different owners.

Three traps, all of which produce a false clean:

- **A hard reload will not reproduce it.** There is no stale cache to paint. If
  you only ever load pages by URL, you will never see this class.
- **`pushState` + a synthetic `popstate` may not re-render at all**, leaving the
  previous page's DOM in place — which looks like a catastrophic routing bug and
  is an artifact of how you navigated. Click a real link, or do a full load.
- Sampling once after "it settled" tells you nothing. Sample *across* the
  transition.

### V2 — content that belongs to a different subject

The page is about X and shows something about Y. Two shapes:

- **Unscoped collection.** A table on a per-subject page carries no filter and
  renders every subject's rows. The tell a reader gets is a recognisably foreign
  row — a drought measure on the extreme-cold page. **Find those foreign rows
  and quote them**; "249 rows on a page that should show ~20" is an argument,
  but "Assess Vulnerability to Drought Risk, on the Extreme Cold page" is
  evidence. See Check K2 for the config-side detector and its cached-count trap.
- **Copy naming the wrong subject.** Boilerplate localised in one clause and not
  another. Detect it by extracting the sentence pattern across every instance
  and diffing the subject named in the sentence against the page's own subject.
  This is a *data* fix, not a component fix, and the count is the number of rows
  to edit.

### V3 — machine values and internal vocabulary on screen

Everything here is a thing the reader was never meant to see:

- **Raw identifiers where a name belongs** — a GEOID, FIPS code, or foreign key
  rendered instead of the label. Check M is the config detector; V3 is the
  subset that is *currently on screen*, which is a much smaller and much more
  urgent set.
- **Partial fallthrough** — a column where most values resolve to a label and
  one doesn't, so the odd one out renders raw. **Only the render finds this.**
  The lookup is correct, the component's copy of it is correct, and config
  comparison reports the column clean. Detect it by collecting the *distinct
  rendered values* of a labelled column and testing each against the label
  vocabulary; anything that is neither a key nor a label is falling through.
- **Column titles used as user-facing labels** — a facet labelled with the
  engineering name of the column behind it, or worse, with a note the data
  steward wrote to other data people (`Category-Deprecated`, `(Delete) …`,
  `Hazard Text`). Check the label against its own contents too: a filter labelled
  with an id whose every option is a place name is wrong twice over.
- **Unformatted numbers** — the tell is usually a zero, because whole numbers
  hide the underlying type and `0.0` doesn't. Read a row of sibling values
  across, not one value down.

### V4 — chrome that is inert, or lying

- **Pagers on empty tables.** `Page 1 of 0`, `Rows 1 to 0 of 0`, and an enabled
  **NEXT**. Always report which of the two causes you found, because they have
  opposite fixes and identical appearance: *the subject genuinely has no rows*
  (wants an empty state) versus *the binding is broken* (wants a fix). Where you
  cannot tell from config, say so rather than guessing.
- **Empty facets.** A `select…` with no options.
- **Counts that contradict each other.** Two sections with identical bindings
  reporting different totals. See Check G — but note the visitor-facing
  consequence is stronger than the config one: **once totals are known to be
  stale, no number on the site can be cited**, including the ones that are right.
- **Columns of one repeated value** — technically correct, informationally empty,
  usually the page's own filter restated once per row.

Note that **inert pagination that renders nothing is not a Part 0 finding.** If
`usePagination` is on but the control doesn't draw, the reader never sees it;
it belongs in Part 2 as config cleanup. Check before reporting.

### V5 — emptiness that reads as broken

Headings with nothing under them; the same generic heading repeated down a page;
sections that occupy vertical space and say nothing.

**This is the detector most likely to be wrong in an unhelpful direction, so get
the framing right.** In a template, empty slots are usually *correct* — they are
waiting for a local author. The finding is not "these are empty." The finding is
that **nothing on screen distinguishes an intentional vacancy from a failure**,
and the reader has to guess. Say that explicitly, or the report reads as though
it doesn't understand what a template is.

Report: count per page, the repeated-title clusters, and whether any authoring
affordance exists (a prompt, an "awaiting input" state, help text) and whether
it is *visible in the slot* or hidden behind an icon. A guidance note that is
itself blank is worth calling out separately.

### V6 — composition, measured

The "these don't line up" family. Measure; do not eyeball, and do not report
these from config alone.

- **Compound-card seams.** Read the *rendered geometry*: for each member of a
  fused run, the bounding box of the bordered box (not the section wrapper) and
  the computed border colour and radius per side. The gap between consecutive
  boxes is the finding, stated in pixels. A run whose last member has a
  transparent bottom border and square bottom corners is open. Check I explains
  the mechanism — outer padding, missing closer, legacy presets.
- **Side-by-side misalignment.** Adjacent cards whose first content starts at
  different heights. Report the offset in pixels and the paddings producing it.
  Hand-tuned values (`1px`, `50px`, `100px`) are the signature of alignment by
  eye at one viewport width.
- **Alignment inconsistency within a group.** Check J. Report the pattern-wide
  distribution alongside, and be explicit that choosing the minority value is a
  design decision rather than a defect — the finding is the inconsistency.

**Find the exception and lead with it.** Where a defect is on N instances of a
template and absent on one, that one instance is the specification of the fix.
It is worth more than the count.

### V7 — the same thing, presented differently in two places

Two copies of one table with different column headings; two sections with the
same title and different contents; a measure named one way on a summary page and
another on a detail page.

The consequence is not cosmetic where the label carries meaning: a reader
comparing a roll-up against a detail page cannot tell whether *Total Damage* and
*Total Damage (with population)* are the same measure, and for a damage figure
in a published plan that is a substantive question.

---

## Method

**Prefer the DOM to a screenshot.** Computed styles and bounding boxes are more
precise than pixels for every V6 finding, and text extraction is more reliable
than reading a rendering. Screenshots are for communicating a finding you have
already established, not for finding it. **If screenshots are unavailable, that
does not block this pass** — say so in the limits and carry on.

Techniques worth knowing, all of which paid for themselves in the reference run:

- **Crawl in a same-origin iframe.** Point an iframe at each path in turn and
  read `contentDocument`. The parent context survives, so one script can sweep
  many pages instead of paying two tool round-trips per page. Watch for two
  gotchas: the parent must be on the same origin (a `data:` URL parent breaks
  relative srcs), and give the app real time to settle — an under-waited iframe
  reports an empty page, not an error.
- **Confirm your viewport actually applied.** Read `innerWidth` back before
  trusting a responsive result. A resize that silently didn't take produces a
  confident wrong conclusion about mobile.
- **Bisect the DOM to find a layout culprit.** For overflow or a min-content
  constraint, hide each child in turn and re-measure; recurse into whichever one
  removes the symptom. This finds the single element responsible in a handful of
  steps, where reading CSS can take an hour and still miss it.
- **Sample across transitions, not after them** (V1).
- **Prove a negative before reporting it.** "Every map renders" is worth stating
  only if you checked — count canvases, probe the tile routes, and say how many.

---

## Why both passes: the symmetric failure

Record what the render **disproved**, not just what it found. This section is
load-bearing: it is what stops the next reviewer re-raising a finding you
already killed, and it is the honest counterweight to a long list.

In the reference run the render disproved three config findings and found one
that config reported clean:

| | Config said | Render said |
|---|---|---|
| A title typo (`Modeled RIsk`) on 16 sections | user-visible defect | **invisible** — the heading is `text-transform: uppercase` |
| A stale filter on a section (`hazards: ["Flooding"]` on the Wind page) | serious mis-binding | **correct output** — the page variable overrides it at runtime |
| A drifted `meta_lookup` on 68 components | metadata out of date | **false positive** — all 19 entries identical; only the serialisation differed |
| A hazard label column | clean | **`"Ice storm"` rendering raw** among correctly-cased labels — a value that is neither key nor label |

Three of the four are cases where **config over-reports**, and the fourth is
where it **under-reports**. That distribution is why Part 0 leads.

The general rules behind those rows, worth checking every time:

- **A CSS transform can hide a content defect** (`text-transform`,
  `first-letter`, truncation). Check the computed style before calling stored
  text a user-visible defect.
- **Runtime state overrides stored state.** Page variables, URL params and
  user selections all resolve after the stored config. A stale stored predicate
  is a latent risk, not a live defect.
- **A strict equality on a serialised value is not a semantic comparison.**
  Normalise before flagging — and report what share of your flags are
  semantically null (`null` vs `[]` vs `""` vs whitespace). A detector that is
  mostly noise trains people to ignore it, which is how the real drifts survive.
- **A correct lookup does not mean correct output.** The data still has to
  contain keys the lookup knows.

---

## Part 0 output

One row per finding, tier-ordered:

| # | Tier | What you see | Where | Why | How far |
|---|---|---|---|---|---|

`What you see` must be **quoted or measured**, not paraphrased — the literal
on-screen string, or the number in pixels or milliseconds. `Why` is one sentence
of mechanism. `How far` separates *seen* from *counted* and names the unit
(pages, components, dataset rows).

Close Part 0 with:

- **the tier counts** (e.g. 7 / 5 / 5);
- **the checked-and-clean table** — everything you verified was fine, and every
  config finding the render disproved;
- **fix units, not findings.** Group the findings by what has to change — one
  platform behaviour, one template binding, N dataset rows, one control. A list
  of 17 findings invites 17 tickets; a list of 9 fix units is a plan. Say which
  units the reader would notice within thirty seconds of arriving.
- **limits**: pages walked vs pages counted, viewport(s) tested, whether
  screenshots were possible, tenant/subject audited, and what is explicitly not
  covered (accessibility, print, authenticated views, performance).

---

# Part 1 — Data binding

> Part 1 and Part 2 are the **cause-and-spread** passes. Lead with the Part 0
> finding they explain wherever one exists, and report the rest as latent —
> real, but not yet visible to anyone.

## Check A — metadata out-of-date flag

**Detect and tabulate. Do not classify severity and do not recommend fixes.**

The admin columns menu shows an amber "Metadata out of date" badge per column.
It is computed in
[`ColumnManager.jsx:346`](../../src/dms/packages/dms/src/patterns/page/components/sections/ColumnManager.jsx):
for each source column having a same-named state column, the badge appears if
any of these nine attributes differ:

```js
['type', 'required', 'display', 'defaultFn', 'dataType',
 'trueValue', 'options', 'mapped_options', 'meta_lookup']
```

**Do:** reproduce that comparison across the scope and output a table of every
component and column carrying the flag, with the drifted attribute names and
both values. One row per flagged column.

| Component | Title | Page / location | Source | Column | Drifted attrs | Stored → Live |
|---|---|---|---|---|---|---|

Run it twice and report both, because they answer different questions:

- **`element-data.columns[]` vs live source** — the columns actually rendered.
  This is what the badge in the UI reflects.
- **`element-data.sourceInfo.columns[]` vs live source** — the snapshot the UI
  *diffs against*. When this is stale the UI can under-report drift, so a
  component with no visible badges is not necessarily clean. Report the
  snapshot's column count vs the live count, columns present in one and not the
  other, and the total attribute-drift count.

Roll up at the end: components flagged / components scanned, and a
flagged-column frequency count by column name (a column flagged on many
components is a source-level change that never propagated).

**Explicitly out of scope for this check:** deciding whether a drift matters,
or whether to refresh. Note only that the admin's "Refresh Meta" action
overwrites author overrides on those same nine keys, so refreshing is not
unconditionally safe — that decision belongs to whoever reads the table.

---

## Check B — filters that don't fit their context

**Defect class:** a filter that made sense somewhere else. This is the dominant
failure mode of the copy-a-configured-component workflow: the filter travels
with the component and outlives the reason for it.

The goal is to surface **filters suspect of being relics** and rank them by
suspicion. Read both representations — the editor keeps them in sync, but a
stale row can disagree:

- `element-data.columns[i].filters[]` — `{ type: 'internal' | 'external',
  operation: 'filter' | 'exclude' | 'like', values: [...] }`
- `element-data.dataRequest.filter` / `.exclude` — compiled, keyed by full
  column name.

`type: 'internal'` filters render **only in edit mode**
([`RenderFilters.jsx:269`](../../src/dms/packages/dms/src/patterns/page/components/sections/components/dataWrapper/components/filters/RenderFilters.jsx)) —
they constrain what the public sees with no UI affordance and no way for a
visitor to notice or undo them. Every internal filter is an unstated editorial
assertion, so internal filters carry a higher burden of justification than
external ones by default.

### Relic heuristics

Ranked roughly by how reliably each has indicated a relic. Apply all; a filter
tripping several is high suspicion.

1. **Hard-coded literal row values.** The filter enumerates individual record
   labels (specific record names, place names, years) rather than constraining a
   category, type, or status column. Legitimate scoping is nearly always
   expressed against a classifying column; a list of individual rows is almost
   always someone patching a specific page's output by hand.
2. **Contradicts the page's stated intent.** An exclusion that removes a subset
   the page exists to present. Requires the one-sentence intent; this is the
   only heuristic that does.
3. **Propagated with informative exceptions.** The identical filter appears on
   many components bound to the same source — *and* the components lacking it
   share a property that explains why. The exceptions identify where the filter
   was authored and therefore where it legitimately belongs; everywhere else is
   copy residue. Report the exception set explicitly; it is the diagnosis, not
   a footnote.
4. **Dead column reference.** The filter's column no longer exists in the live
   source (renamed or dropped). The editor marks these with a red `stale` badge
   ([`ComplexFilters.jsx:261`](../../src/dms/packages/dms/src/patterns/page/components/sections/ComplexFilters.jsx)).
   Always a defect; only the cleanup priority is in question.
5. **Dead literal values.** The filter's values match nothing in the current
   data. Query the source and report the row count each value actually matches.
   Zero-match values mean the filter is either obsolete or was always wrong.
6. **Redundant against a sibling filter.** Another filter already constrains the
   result set such that this one removes nothing. Harmless today, but it is the
   fingerprint of a copy and it will be copied forward again.
7. **Variant drift.** Near-identical filters on sibling components that
   disagree in their value lists. Indicates independent hand-edits; there is no
   single correct value to restore, so these need an author decision rather
   than a mechanical fix. Flag as such.
8. **Empty stubs.** `values: []` or an empty `dataRequest.exclude` entry —
   inert, but records that a filter was once configured and then emptied.

### Output

One row per filter, across the scope:

| Component | Page / location | Column | Type | Op | Values | Heuristics tripped | Suspicion | Rows removed |
|---|---|---|---|---|---|---|---|---|

Suspicion: `high` / `medium` / `low`. State rows-removed as a number wherever
it can be computed — a filter that removes zero rows and one that removes half
the table warrant very different attention.

### B2 — filters that resolve to an empty set

**Defect class:** the section renders nothing because its filter matches zero
rows. The most severe outcome of Check B, and the easiest to detect — but the
*diagnosis* takes a specific procedure, because "no data" says nothing about
which predicate is responsible.

**Detection is a one-liner:** `display.totalLength === 0` (or an empty `data`)
on a section that is supposed to show something. Then compare against siblings
on the same source — a handful of empties among hundreds of working components
is unambiguous, and the working ones are also your reference data.

### Diagnosis

1. **Flatten the filter tree** (`dataRequest.filterGroups`, plus `filter` /
   `exclude` / `like`) into individual predicates.
2. **Narrow one term at a time** against the source and record the running row
   count. The term that drops it to zero is the culprit. Report the ladder, not
   just the conclusion — it shows which predicates are fine and bounds the fix.
3. **Build the value vocabulary from working siblings.** You often cannot query
   the dataset directly (split-table row fetches are not always reachable over
   the standard path). You don't need to: collect the filter values used by
   every component on the same source **that returns rows**, per column. That is
   an observed-good vocabulary, and it is usually enough to identify the failing
   value on its own.
4. **Classify the failing predicate** against that vocabulary — the three cases
   have different fixes and different owners:

| What you find | Cause | Fix |
|---|---|---|
| A near-identical value differing only by **whitespace, case, or punctuation** | The stored data carries characters the author can't see | Fix the source data, or make the filter tolerant. **Not** a filter-value edit |
| A **semantically similar** value | The content was renamed and the filter wasn't updated | Retarget the filter |
| **Nothing close** | The content doesn't exist for this tenant/page | Author the row, or remove the component |

5. **Always `JSON.stringify` the raw values when comparing.** This is the whole
   ballgame for case 1: a leading newline, a trailing space, a non-breaking
   space or a smart quote is invisible in every UI that renders or trims text.
   The author sees the same string in the data and in the filter and has no way
   to tell why it doesn't match. A similarity score over normalized strings
   surfaces these instantly — a ~97% match that isn't 100% is almost always
   invisible characters.
6. Check the column still exists too (Check B heuristic 4) — a filter on a
   dropped or renamed **column** produces the same empty result as a filter on a
   missing **value**, and they are fixed differently.

Note in passing any predicate that matches **the same literal on two different
columns** — it is redundant, and it doubles the chance that a rename breaks the
section.

### Output

| Component | Page | Source | Predicate ladder (rows after each term) | Failing term | Nearest known value | Case | Fix owner |
|---|---|---|---|---|---|---|---|

Group by failing value: these cluster, because one renamed or malformed source
row strands every component that targets it.

---

## Check C — deprecation-marked columns

**Rule: no component should be bound to a column whose title carries a
deprecation indicator. Any that is, flag for update.**

This is the most generalizable of the three checks because it needs no schema
knowledge and no page context — data stewards mark superseded columns in the
column title, and that marker is machine-readable.

**The mechanism that makes this non-obvious:** the marker lives on the **live
source's** `display_name`. The component stores its own copy of `display_name`,
captured at bind time, which still holds the *pre-deprecation* title. A
component bound to a column titled `"Category-Deprecated"` in the source will
show `"Category"` in its own config and in the rendered header. **Detection
must resolve every column against the live source row.** Scanning component
config alone misses nearly all of these.

**Do:**

1. For every column in `element-data.columns[]`, resolve the matching live
   source column by normalized name.
2. Test the live `display_name` against the marker patterns below.
3. Flag every match. No exceptions — a deprecation marker is the steward's
   explicit instruction, and the audit's job is to surface it, not to weigh it.

### Marker patterns

**Strong** — treat as confirmed, no human check needed:

```
deprecat        (matches "Deprecated", "-deprecated", " - deprecated", "(deprecated)", "Deprecate")
do not use / don't use
obsolete
retired
superseded
(delete)
```

**Soft** — flag separately as needing confirmation; these produce false
positives on legitimate column names:

```
\btest\b   \btmp\b   \bscratch\b   \blegacy\b   \bold\b   _v1\b
```

Markers are written inconsistently by hand — expect `-Deprecated`,
`-deprecated`, ` - deprecated`, `(deprecated)` on the same source. Match
case-insensitively on the substring, never on an exact format.

### Output

| Component | Title | Page / location | Section type | Source | Column | Live title | Stored title | Visible? | In a filter? | Marker tier |
|---|---|---|---|---|---|---|---|---|---|---|

Then roll up **by column**, sorted by usage count — this is the actionable view,
because one deprecated column typically has many consumers and they should be
migrated together:

```
<source> :: <column> ("<live title>")
  used by N components | rendered visible: N | used in a filter: N
  | stored title still shows the old name: N
  component ids: …
```

`Visible?` (`show === true`) and `In a filter?` are worth separating: a
deprecated column that is hidden and unfiltered is dead config to clean up,
while one that is rendered or drives a facet is actively serving wrong values
to users.

**Also report, as source-side findings** — these cause the recurrence and
cannot be fixed component-side:

- **Duplicate aliases** — two source columns emitting the same `as <alias>`,
  especially if their titles disagree (one marked deprecated, one not). Makes
  alias-based resolution ambiguous for every consumer.
- **Unmarked scratch columns** still in `config.attributes`. They leak into
  every component's column picker.
- **Deprecated columns with zero consumers** — safe to remove from the source.

### C2 — variant divergence in shared assets

The same "which generation am I on?" defect applies to any **shared, versioned
asset a component references by id** — symbologies, saved filter sets, templates
— not just columns. The detector is the name, exactly as above.

**Do:** collect every referenced asset's name across the pattern, strip
qualifier suffixes (`v2`, `v3`, `(LHMP)`, `(copy)`, `(2)`, trailing years), and
group. **Any base name resolving to more than one asset id is a family.** For
each family, report the ids, the full names, and the consumer count of each.

Two cautions, both learned the hard way:

- **A version suffix does not tell you which member is current.** A `v2`
  variant can be the abandoned experiment and the unsuffixed one the
  maintained original. Determine currency from consumer behavior and from
  which member a known-good component uses — never from the name alone.
- Same for consumer counts: during an in-flight migration the majority sits on
  the old member. Counts corroborate; they don't decide.

### Coverage caveat

Report how many bound sources actually resolved to a parseable
`config.attributes`. Not every `sourceInfo.source_id` points at a DMS source
row with that shape (DaMa-backed and joined sources differ). Components on
unresolved sources are **unaudited, not clean** — list them.

---

## Check D — layers and views that render nothing

**Defect class:** the component is bound to the right data and still draws
nothing, because rendering depends on a chain of independently-stored settings
that can each drift out from under a correct binding.

Applies to `Map` sections most sharply, but the reasoning generalizes to any
component whose output depends on an asset fetched by URL.

**The signature to recognize:** *only the context layer draws.* A map that shows
county boundaries and nothing else has already proven that the container, the
basemap, the symbology wrapper and the render loop all work — so the thematic
layer's failure is isolated, and it is almost never the paint expression.
Suspect the transport first.

Rendering requires four things to agree, each stored separately:

1. **Transport** — `layer.sources[0].source`: either `tiles: ["…/{z}/{x}/{y}…"]`
   (a live tile route) or `url: "<protocol>://…"` (a pre-baked artifact), plus
   an optional `protocol` field.
2. **Renderer support for that transport** — a non-HTTP protocol only works if
   the renderer registers a handler for it.
3. **`source-layer`** on every sublayer, matching the layer name the transport
   actually emits.
4. **Paint columns present in the tile** — the runtime rebuilds `?cols=` from
   `data-column`, so every property a paint expression reads via `["get", …]`
   must be named there
   ([`SymbologyViewLayer.jsx:1592`](../../src/dms/packages/dms/src/patterns/page/components/sections/components/ComponentRegistry/map/SymbologyViewLayer.jsx)).

### Detection — all mechanical, no rendering required

1. **Tabulate transport kind across every layer in the pattern.** Group by
   `tiles` / `url`-with-protocol / neither. **The outlier is the finding.** A
   transport used by a handful of layers out of hundreds is a stale artifact
   from an older build convention, not a design decision. This single
   distribution is the highest-yield check in this section.
2. **Tabulate `source-layer` against the dominant convention** (here
   `view_{view_id}`). Same logic: outliers are findings. A mismatched
   `source-layer` renders nothing and emits no error.
3. **Probe the live tile route for the layer's `view_id`** —
   `…/tiles/{view_id}/{z}/{x}/{y}/t.pbf`, then again with
   `?cols=<data-column>`. Record status, byte size, and whether the paint
   column's name appears in the response. **This is the decisive split:** a 200
   with bytes and the column present means the data is fine and the defect is
   purely in the binding. A 204 means the view has no geometry and the problem
   is upstream. Never report "the map is broken" without this probe — the two
   cases have completely different owners.
4. **Confirm the renderer actually *registers* a handler for any non-HTTP
   protocol** the layer declares. Two distinct things must be true, and the
   second is the one that fails: a handler must **exist**, and it must be
   **wired at the call site**. Find the registration (`addProtocol`) *and*
   follow it to where it is passed to the map — a vendored handler whose import
   and wiring are commented out is exactly as dead as no handler at all, and a
   codebase search alone will tell you it's supported.
   Probing the artifact URL is *not* sufficient evidence either: an artifact can
   return 200/206 and still be unreadable because nothing is registered to read
   it. Also check the URL *form* the handler expects — some protocols require
   the full inner scheme (`pmtiles://https://host/…`), and a URL missing it
   fails even under a correctly registered handler.
5. **Cross-check paint against `data-column`** — collect every `["get", prop]`
   in each sublayer's paint and confirm each is in the comma-joined
   `data-column`. Missing ones fall out of the rebuilt `?cols=` and the feature
   draws in the fallback color.
6. **Verify every requested column actually exists on the view.** The tile
   route answers `?cols=<name>` for an unknown column with **204 and a zero-byte
   body — the entire tile, not just that column**. So one stale name anywhere in
   the rebuilt `?cols=` (a `data-column`, or any dynamic-filter column that
   currently has values) blanks the whole layer, silently and completely. This
   is a high-frequency cause of "the layer just stopped drawing after someone
   renamed a field."

### The 204 schema probe

That same behavior is the cheapest way to enumerate a view's real schema, and
it needs no metadata endpoint or database access — useful because the DaMa
metadata routes are not reliably reachable:

> Request one candidate column at a time. **200 = the column exists; 204 with 0
> bytes = it does not.** Never batch candidates: a single unknown name 204s the
> whole request and tells you nothing about the others.

Use it to confirm a filter column before calling a binding correct, and to
compare two candidate sources — **disjoint schemas prove they are different
datasets rather than two versions of one.**

### Output

| Component | Page | Layer | View | Transport | Live route probe | `source-layer` | Convention OK | Paint cols in `data-column` | Verdict |
|---|---|---|---|---|---|---|---|---|---|

Verdict: `renders` / `no data upstream` / `binding defect — data available`.
Call out any layer that is the sole site-wide user of a transport or naming
convention; that is a migration that was never finished.

---

## Check E — page-variable wiring completeness

**Defect class:** an interactive component that looks configured but doesn't
react, because its binding to the page's variables is half-written. The keys are
individually optional, so a partial binding saves cleanly and fails silently.

**Do not check against the documented spec.** Check against the **most complete
instance of the same component type in the same pattern** — that is the
platform's real convention, and it gives any fix a concrete template.

### Procedure

1. Enumerate every component of the type in the pattern and extract its binding
   config.
2. Rank by number of binding keys populated. The maximal instance is the
   reference; record its id.
3. Score every component against the reference and bucket into **fully wired /
   partially wired / unwired**.
4. Report the tier distribution. A large partial tier is a platform-level
   finding, not a per-component one.

### For `Map` sections, the binding keys are

| Key | Where | Effect when missing |
|---|---|---|
| `dynamic-filters[].column_name` | layer | no binding at all |
| `.searchParamKey` | layer | **binds to a page variable named after the tile column instead** — usually a variable that doesn't exist, so the filter never receives a value |
| `.values` / `.defaultValue` | layer | no fallback when the page var is empty |
| `.dataType: "numeric"` | layer | numeric tile properties don't coerce and never match |
| `.zoomToFilterBounds` | layer | no server-side zoom-to-selection; the component falls back to the viewport-dependent `zoomToFitBounds` path (see F3) |
| `usePageFilters: true` | layer | authored and scripted layers disagree in the Map settings UI |
| `symbology.activeLayer` | symbology | zoom-to-filter is **active-layer scoped** — it reads only the active layer's `dynamic-filters`, so pointing it at the wrong layer disables zoom silently |
| `zoomToFitBounds` | component | map doesn't refit |

Two mechanisms worth stating explicitly in any report, because they explain most
partials:

- The binding key is **`searchParamKey || column_name`**. Omitting
  `searchParamKey` is not "use the default" — it silently rebinds the filter to
  a page variable named after the tile column. This is the single most common
  way a map appears wired and isn't.
- The Map **ignores `type: 'action'` page params** by design
  ([`map/index.jsx`](../../src/dms/packages/dms/src/patterns/page/components/sections/components/ComponentRegistry/map/index.jsx)),
  so a binding to a value published by another section's `_functions` can never
  fire. Bind to a URL/page-filter variable instead.

### Output

| Component | Page | Layers | Binding column | `searchParamKey` | `dataType` | `usePageFilters` | Active layer bound? | `zoomToFilterBounds` | `zoomToFitBounds` | Tier |
|---|---|---|---|---|---|---|---|---|---|---|

Close with the reference component id and the tier counts.

---

## Check F — wired to the wrong layer, or to the wrong key

**Defect class:** the component is fully configured and passes Checks D and E —
tiles load, bindings exist — and still misbehaves, because the wiring points at
the wrong *member*. Nothing is missing, so nothing looks wrong in the editor.

Two independent detectors. Both are pure structure comparisons and both are
decided by distribution across the pattern.

> **Run Check H first.** Both detectors below fire reliably on layers bound to
> an ungoverned source, because a one-off upload brings its own key vocabulary
> and gets designated as the active layer while someone is wiring it up. If an
> F1 or F2 finding lands on a layer that Check H flagged, **report it as blast
> radius of that binding, not as an independent defect** — otherwise the fix
> gets applied to the symptom and the source stays wrong.

### F1 — the designated layer is a context layer, not the thematic one

Multi-layer components nominate one layer as the one that drives behavior
(`symbology.activeLayer`). In this codebase that nomination controls **two**
things, and both silently follow it to the wrong place:

- **Page-filter sync** reads only the designated layer's `dynamic-filters`
  ([`map/index.jsx:707`](../../src/dms/packages/dms/src/patterns/page/components/sections/components/ComponentRegistry/map/index.jsx)).
- **Zoom-to-filter-bounds** resolves its view from the designated layer and
  queries `ST_Extent` on *that* view
  ([`map/index.jsx:726`](../../src/dms/packages/dms/src/patterns/page/components/sections/components/ComponentRegistry/map/index.jsx)).
  The fallback to other layers only considers layers with
  `zoomToFilterBounds: true`, so where that flag is unused the designated layer
  is the *only* source of bounds — and a filter matching nothing yields no zoom
  at all, not a default zoom.

**Do:** for every symbology, identify the **thematic** layer — the one carrying
`data-column` (equivalently: the layer the legend describes and the component is
named after) — and check whether it is the designated layer. Boundary/context
layers are typically `layer-type: "simple"` with no `data-column`; a `simple`
layer as the designation is the signature.

Report as a table and, critically, as a **rate**: the norm establishes that the
exceptions are errors rather than intent.

| Component | Page | Symbology | Designated layer | Its type | Thematic layer | Designated == thematic? |
|---|---|---|---|---|---|---|

Flag as a stronger finding any case where **the same symbology is designated
differently across components** — that is drift, not a deliberate choice.

### F2 — one page variable, several key vocabularies

A single page variable can legitimately drive several layers. It is **not**
legitimate for those layers to identify the same real-world entity through
different tile columns, because each column is a separate vocabulary that must
match the page value byte-for-byte. One of them is usually wrong, and the wrong
one fails silently — a client-side `["in", …]` that matches nothing renders an
empty layer, not an error.

**Do:** for each symbology, collect the set of
`dynamic-filters[].column_name` across all layers, grouped by the page variable
(`searchParamKey || column_name`) they bind to. **More than one column name
serving one page variable is the finding.**

| Component | Symbology | Page variable | Columns claiming it | Layers | Verdict |
|---|---|---|---|---|---|

Rank by how divergent the vocabularies are. Columns from a governed source
(a standard FIPS/GEOID column) versus columns from a locally uploaded dataset
are the highest-risk pairing — the latter often carry **truncated shapefile
field names** (10 characters, e.g. `county_fip`, `census_geo`, `county_nam`),
which is itself a reliable tell that the layer came from an ad-hoc upload rather
than the governed pipeline. Note also when the two columns bind to *different*
page variables (e.g. `geoid` and `geoid_juris`), since that requires the page to
actually publish both.

### F3 — bound at the wrong granularity

**Defect class:** the binding is present, valid, and points at a real column —
but at a **coarser geography (or time, or category) than the behavior it
drives**. Nothing errors. The behavior simply resolves to the wrong level, and
the setting that appears responsible is working correctly.

The reported symptom is usually *"zoom-to-fit is on but it doesn't zoom to the
X"*. The instinct is to check the zoom setting. **Check the filter granularity
first** — a viewport fit is only as precise as the set of features it is fitting
to, so a layer filtered to a county will fit to the county no matter what the
zoom flag says.

**Do:**

1. Establish the **intended** granularity from the component's own naming — the
   symbology name, the layer name, the section title. A layer called
   "Jurisdiction Boundary" declares its intent.
2. Read the **actual** granularity off each `dynamic-filters[]` entry: the tile
   column *and* the page variable it binds to. A jurisdiction-named layer keyed
   on a county column, bound to a county page variable, operates at county
   level.
3. Check whether the page even **publishes** the finer variable
   (`page.filters[].searchKey`). If it doesn't, no amount of layer rewiring will
   help — the fix spans the page and the component, and reporting only the
   component half produces a fix that can't work.
4. Look for the **correct binding elsewhere in the pattern**. If some layers
   already bind at the finer level, that is the template; report it as the
   target and count how many use each.
5. Check the **seed values** on the filter (`values`, `defaultValue`). These are
   overridden at runtime when the page variable resolves, but they are what
   renders when it doesn't — and they are frequently left over from whichever
   tenant the template was copied from. Report type inconsistency too: numeric
   `[36105]` and string `["36105"]` for the same key coerce differently, since
   coercion is inferred from the first value's shape.

### Know which zoom mechanism you are auditing

Two settings with near-identical names and materially different behavior:

| Setting | Where | How it resolves |
|---|---|---|
| `zoomToFitBounds` | **component** level; propagated to every layer | On map `idle`, `queryRenderedFeatures` for that layer's sub-layers → bbox of the features **currently rendered in the viewport**. Viewport-dependent; cannot frame anything off-screen; result varies with where the map already is. |
| `zoomToFilterBounds` | **per dynamic-filter** | A server-side `ST_Extent` of the *filtered* set, resolved via the active layer (see F1). Independent of the viewport. |

Report which one the component actually uses, and the pattern-wide split. A
corpus that sets the component flag everywhere and the per-filter flag nowhere is
relying entirely on the viewport-dependent path — which is worth stating as a
platform finding, because it explains a whole class of "the zoom is
inconsistent" reports that look like per-page bugs.

---

## Check H — is every layer bound to a *governed* source?

**Defect class:** a layer bound to an ad-hoc, hand-uploaded dataset instead of
the governed source that the rest of the platform uses. This is the **root
cause** that most often manifests as the symptoms in Checks E and F — a
one-off upload brings its own column vocabulary, its own key semantics and its
own idea of what a "jurisdiction" is, and every downstream wiring problem
follows from that one binding.

**Run this check before F, and treat an F finding on the same layer as a
symptom of it.**

### Detection — the source-object id carries provenance

Each layer's `sources[0].id` is minted at bind time in the form:

```
{pgEnv}_{datasetName}_{epochMs}_{layerId}
    e.g.  hazmit_dama_NRI Tracts Geospatial_1727442020144_hcqeans
```

The `{datasetName}` slot is the tell. A governed binding embeds a real dataset
name. An ad-hoc one embeds a placeholder.

**Do:**

1. Parse every layer's `sources[0].id` into its four parts.
2. Flag layers whose `{datasetName}` is a **placeholder** — `comp`, `tmp`,
   `temp`, `test`, `new`, `untitled`, `copy`, an empty string, or a bare
   `s{source_id}_v{view_id}` fallback (that fallback means no name was
   available at bind time).
3. Tabulate `{datasetName}` across the whole pattern. As everywhere in this
   document, **the outlier is the finding** — a placeholder-named source among
   hundreds of properly named ones is not a naming style, it is an upload that
   bypassed the catalog.
4. Read the **`{epochMs}` timestamp**. Ad-hoc sources are usually much newer
   than the governed ones around them; a binding minted months after every
   sibling is a strong corroborating signal.
5. For each flagged source, look for the **governed alternative**: other
   sources in the same pattern serving the same real-world entity. Report them
   as candidate replacements with their ids, names, and mint dates.
6. Probe the flagged view's schema (see Check D's 204 technique) and compare
   its columns to the governed alternative's. **Disjoint schemas confirm they
   are different datasets, not versions of one** — which means switching
   sources also requires rewriting every filter column that referenced it.

### Output

| Component | Symbology | Layer | source/view | `{datasetName}` | Minted | Governed? | Columns | Candidate replacement |
|---|---|---|---|---|---|---|---|---|

Follow every flagged layer downstream and say so explicitly: is it the
designated layer (F1)? does it introduce a second key vocabulary (F2)? is it
present only in one variant of a shared symbology (C2)? Those are the blast
radius of this one binding, and reporting them as separate findings invites
three separate partial fixes.

---

## Check G — cached and dangling state

Cheap add-ons, each of which has broken a live page.

- `sourceInfo.view_id` vs the source's `data.views[]` — pinned to a superseded
  view? A pin can be deliberate; flag *inconsistency* between components on the
  same page rather than pinning itself.
- `display.totalLength` — cached row count, wrong whenever filters changed
  without a refetch. Recompute; report the delta.
- `element-data.data` — cached rows inconsistent with the current `dataRequest`
  means the page renders pre-change values before the fetch resolves.
- `display.pageSize` missing while `usePagination` is on → renders blank.
- Columns in `element-data.columns[]` with **no** live source match at all (not
  drift — absent). These render empty.
- External filters whose column is null for every row remaining after internal
  filters → a dead facet control.
- Persisted editor state in saved config (`isEdit: true` on a published
  component). Harmless individually, useful as a tell that the row was saved
  from an editing session rather than a deliberate publish.

---

# Part 2 — Presentational relics

Visual defects that a reader registers as "this platform is unpolished" without
being able to name why: a card whose border doesn't close, labels that disagree
across one row, a pager on a thing that has one row.

Three properties make these worth auditing from **stored config** rather than by
eye:

- **They are mechanically detectable.** Every one below is a structure
  comparison. You do not need to render the page, which matters because
  rendering needs a live browser and these defects are subtle on screen.
- **They are systemic by construction.** Page templates get copied per subject
  (per hazard, per county, per year), so a seam authored once reappears on every
  copy. Finding one and fixing it in place is nearly always the wrong scope.
- **They hide in aggregates.** A single unterminated border run is invisible;
  "openers outnumber closers by 47 pattern-wide" is unmissable.

Report presentational findings **per template, not per page** — one row per
distinct defect with the list of pages carrying it.

---

## Check I — compound-card seams

**Defect class:** several sections are given partial borders so they read as one
box, and the box doesn't actually close. Users describe this as *"the borders
don't touch"* or *"it looks like separate boxes."*

The platform builds one visual card out of **multiple sections**, each drawing
part of the frame. Three independent things break that composition; check all
three, since a run can have more than one.

### I1 — the run never closes

A fused run must open and close. In this codebase
([`sectionArray.theme.jsx`](../../src/dms/packages/dms/src/patterns/page/components/sections/sectionArray.theme.jsx)):

| Preset | Renders | Role |
|---|---|---|
| `openBottom` | all sides, bottom transparent, `rounded-t-lg` | **opens** a vertical run |
| `borderX` | all sides, top+bottom transparent, no radius | **continues** a run |
| `openTop` | all sides, top transparent, `rounded-b-lg` | **closes** a vertical run |
| `openRight` / `openLeft` | right / left transparent, radius on the other side | open / close a **horizontal** run |
| `full` | all sides, `rounded-lg` | a standalone card |

**Do:** walk each page's section order, group consecutive sections carrying a
non-`none` border into runs, and flag any run whose last member is not the
matching closer. A run ending on `borderX` has **no bottom edge and square
bottom corners** — the box is literally open.

Then run the aggregate, which needs no per-page walk and catches the same thing
in one line: **count openers against closers across the pattern.**
`openBottom` vs `openTop`, `openRight` vs `openLeft`. A well-formed corpus
balances; the surplus is your count of broken runs.

### I2 — padding on run members pushes the borders apart

**Section `padding` is the OUTER gutter.** The border, radius and background are
drawn on an inner box *inside* that padding. So any padding on a run member
inserts space between the bordered boxes — which is precisely why the borders
don't touch. This is the opposite of the intuitive reading and is the single
most common cause.

**Do:** collect the `padding` of every member of a run. **They must agree, and
the shared edges must be zero.** A run where one member has no padding and the
next has `p-4` cannot fuse. Inner breathing room is the *component's* job
(`display.cellsPadding` on a Card), not the section's.

### I3 — legacy string presets can't fuse perfectly

Every legacy preset emits `border` on **all four sides** and makes the open side
`transparent` — the 1px is still *reserved*. Two stacked members therefore leave
a **2px break in the side rules** at every junction even when I1 and I2 are
clean. The modern per-side shape (`border: {top,right,bottom,left}` composing
from `borderSides`, plus `radius: {tl,tr,bl,br}`) emits classes only for toggled
sides and has no such gap.

**Do:** report the split between `typeof border === 'string'` (legacy) and the
object shape. A pattern still entirely on string presets cannot produce a truly
seamless compound card, and that is a migration finding, not a per-section one.

### Output

| Page(s) | Section ids in run | Presets | Closed? | Paddings | Border shape | Defects |
|---|---|---|---|---|---|---|

Collapse identical runs across pages into one row — that is the template.

---

## Check J — treatment inconsistency inside a visual group

**Defect class:** sibling components that read as one unit disagree on a
presentational setting — alignment, font scale, number format, padding. No
single component looks wrong; the row looks wrong.

**Do not assert a house style.** Assert **uniformity within a group**, then
report the pattern-wide distribution and let the author choose the target.

**Do:**

1. Define groups structurally — members of a fused border run (Check I),
   sections sharing a level and size in one band, cells within a Card.
2. For each presentational key, collect distinct values across the group's
   **shown** cells. `justify` / alignment is the highest-yield key; also worth
   checking `valueFontStyle`, `formatFn`, and `cellSpan`.
3. **More than one distinct value in a group is the finding.** Treat unset and
   empty-string as distinct third states — an empty-string `justify` is a
   half-made edit, not a default, and should be reported separately.
4. Report the pattern-wide distribution of each key so the fix has a target.
   Say plainly which value is dominant, and note when the requester's preference
   differs from it — adopting the minority value is a legitimate design
   decision, but it means changing the convention, not fixing a deviation.

### Output

| Group (page + section ids) | Key | Distinct values in group | Pattern-wide distribution | Dominant |
|---|---|---|---|---|

---

## Check K — pagination on something that shouldn't paginate

**Defect class:** pager chrome under a component that is presentationally a
single statement — one callout, one stat, one narrative with a "Learn more"
link.

There are **two causes that look identical on screen and have opposite fixes.**
Always say which one you found.

### K1 — the pager can only ever show one page

`usePagination: true` with `totalLength <= pageSize`. The control renders, does
nothing, and adds visual weight to a card that has a single row.

**Fix is presentational:** turn `usePagination` off.

### K2 — the section is bound to an unfiltered collection

`usePagination: true` with `totalLength > pageSize` on a component whose layout
is singular (one narrative cell, one link cell, a stat). Here the pager is
*honest* — the section really did fetch N rows. **The defect is the binding, not
the pager**, and switching pagination off would hide a data bug behind a
truncated display.

Signals that separate K2 from a legitimately paginated table:

- **`display.usePageFilters: false`** while the page publishes filters
  (`page.filters[].searchKey`). The section has opted out of the page's scoping.
- **Empty `dataRequest.filter` / `.exclude` and no column filter leaves**, on a
  source that clearly holds many subjects' records (one row per page/section/
  hazard).
- **A sibling of the same shape on another page** bound to the same source and
  view. If they differ only in row count, neither is scoped and the low count is
  luck or a stale cache.

⚠ **`totalLength` is a cached count** (Check G). Two sections on the same source
and view with no filters *cannot* legitimately return different counts — if they
appear to, one number is stale. Verify against the source before concluding
anything from it.

### Output

| Component | Page | Type | `totalLength` | `pageSize` | `usePageFilters` | Filters? | Case | Fix target |
|---|---|---|---|---|---|---|---|---|

Report K1 as an aggregate rate (it is usually pervasive) and K2 individually
(each is a real data-scoping bug).

---

## Check L — colors pinned to a surface that can change

**Defect class:** a child element carries an explicit opaque color that assumes
what it is sitting on. Users describe it as *"the button has a white background
that breaks up the beige"* — a patch of the wrong surface inside an otherwise
uniform block.

### Why this one hides

**On a white section, an explicit white and "inherit" are pixel-identical.** The
author cannot see the difference at the moment they choose, and the config looks
deliberate afterwards. The defect only becomes visible later, when the section
gets a tint, or when the component is copied onto a band that already has one.

So the finding is **not** "this color is wrong." It is: **an opaque literal color
on a child is a latent defect whenever the correct intent was `inherit`** —
whether or not it currently shows.

### Detection

1. Build container→child color pairs. Container: section `bg` or
   `display.bgColor`. Children: per-cell `bgColor` / `cellBgColor`, plus any
   text, border or icon color keys.
2. Normalize before comparing — `#FFF` vs `#ffffff` vs `white` vs
   `rgb(255,255,255)` are one value; `transparent` and `rgba(0,0,0,0)` are the
   inherit sentinel.
3. Classify every pair:
   - **Visible mismatch** — child opaque, differs from container. This is what
     the user reported.
   - **Latent match** — child opaque, *equals* the container. Renders correctly
     today and breaks the moment the container is re-tinted or the component
     moves. Report these; they are the larger number and the future tickets.
   - **Correct** — child is transparent/unset.
4. Count **distinct literal colors** across the pattern. A small set (a handful)
   means a real palette is being typed in by hand — the values are right and the
   mechanism is wrong. A large set means genuine color sprawl. The two need
   different fixes.
5. Group by cell role. If nearly every hit is the same kind of element (link
   cells, stat cells), the defect entered through one authoring path, and that
   path is where it should be fixed.

### Then check whether the author could have done better

**Before writing this up as an authoring error, open the control that sets the
value** and ask three questions:

- Does the picker offer an **inherit / transparent** option at all?
- Is it seeded from **theme tokens**, or from a hardcoded literal list?
- Once set, can the value be **cleared**?

If the answer to any is no, this is a **platform gap, not an author mistake**,
and the finding belongs against the control. That distinction decides the scope
of the fix — enriching one picker versus hand-editing every affected component —
and it is the [author-empowerment principle](../../CLAUDE.md) applied to QA:
when authors keep making the same "mistake," suspect the affordance first.

Compare the suspect control against its siblings in the same codebase. A picker
that takes a `colors` palette from the theme, or that defaults to
`rgba(0,0,0,0)`, is the shape the others should match; one that passes no
palette and defaults to an opaque color is the outlier.

### Output

| Component | Page | Container color | Child | Child color | Class | Cell role |
|---|---|---|---|---|---|---|

Close with: distinct-literal-color count, the dominant cell role, and a verdict
on the control — **offers inherit / theme-seeded / clearable**, yes or no for
each. Recommend the control fix first and the data fix second; a bulk data fix
without the control fix guarantees the defect returns.

---

## Check M — coded identifiers rendering instead of names

**Defect class:** a column holds a machine identifier — a GEOID, a FIPS code, a
foreign key — and the component renders the code, or an outdated label, instead
of the human name. Users report it as *"it's showing the geoid instead of the
jurisdiction."*

This is **the user-visible face of Check A**. `meta_lookup`, `options` and
`mapped_options` are three of the nine attributes Check A diffs, but Check A
deliberately doesn't rank severity. This check pulls out the subset that a site
visitor can see and gives it its own triage, because the prior is much stronger:
an identifier column whose lookup is missing or stale is *always* a defect, and
it usually has a one-action fix.

### Three variants, in descending order of how obvious they are

1. **Missing lookup — renders the raw code.** The live source defines a
   `meta_lookup` / `mapped_options`; the component's stored column has none.
   Loud and obviously broken.
2. **Partial fallthrough — a mixed column.** A lookup exists, but individual
   keys aren't present in the meta view, so those rows fall through to the raw
   value while their neighbours resolve. A column showing *some* names and *some*
   codes is the clearest visual tell of this whole class, and it also fires when
   variant 3 changes which keys resolve.
3. **Stale lookup — renders an outdated label.** A lookup exists but its
   `valueAttribute` / `labelColumn` no longer matches the source's. **This is the
   dangerous one**: nothing looks broken, the label is simply the wrong one, and
   it is typically far more common than variant 1. Only a printed diff reveals
   it.

### Detection

1. For every **shown** column, resolve the live source column by normalized name
   and compare `meta_lookup` and `mapped_options`.
   - live defines one, stored has none → **variant 1**
   - both present but unequal → **variant 3**; print both `valueAttribute` /
     `labelColumn` values side by side, or the finding is unreadable
2. Repeat for **hidden** columns and report separately as **latent** — they
   surface the moment an author toggles `show`. Same latency logic as Check L.
3. **Source-free heuristic**, for when the live source can't be resolved: a shown
   column whose name matches `/geoid|fips|_id$|^id$|_code$/i`, or whose `type` is
   `select`, carrying no lookup at all, will render a raw code. Flag it even
   without a reference.
4. Where neither the component nor the source defines a lookup, the label
   genuinely doesn't exist yet — that is a **source-side** finding (add the
   lookup), not a component fix.
5. Roll up **by (source, column)**. These cluster hard: one source-side label
   change strands every consumer at once, and the group is the fix unit.

### Output

| Component | Page | Source | Column | Shown? | Variant | Stored label formula | Live label formula |
|---|---|---|---|---|---|---|---|

### Fix note

Variants 1 and 3 are exactly what the admin's **Refresh Meta** action resolves,
which makes them unusually cheap to fix in bulk. Carry Check A's caveat through:
refresh overwrites author overrides on all nine synced attributes, so name the
columns to refresh rather than recommending a blanket sweep.

---

## Reporting

Structure the report as: **Part 0 verdict + tier counts → Part 0 findings,
tier-ordered → Checked-and-clean → fix units → Part 0 limits** — then, as the
supporting evidence: **Check A table → Check B table → Check C table +
by-column rollup → Check D table → Check E table + tier counts → Check F tables
→ Check G notes → Checks I, J, K, L, M tables (per template, not per page)
→ Source-side recommendations → Control/affordance recommendations → Coverage.**

**Lead with what a person sees.** The config tables are the appendix to the
walkthrough, not the other way round. If the audience for the report is a
stakeholder rather than the platform team, the Part 1/Part 2 tables may belong
in a separate document entirely — but the fix units in Part 0 must still name
the cause, or the report is a list of complaints.

**Close every report with two sections the gate produces:** *Deferred — owned
elsewhere* (one line per class, naming the task that owns it) and *Observations*
(unranked, each with the reason it is unranked). Then state **which checks you
ran and which you skipped**, by letter. A reader cannot tell a clean result from
an unrun one, and a sweep that never says what it skipped will be read as
complete.

**Report the accepted count, not the raised count.** The headline is the number
of findings that passed the gate. If a work list carries the rejects too, say so
in a separate figure — "65 findings; 474 further rows deferred or observational"
— never a single number that blends them.

### Deliverable format

Where the project has an established report format, **use it** rather than
inventing one. In this repo that is `src/themes/<brand>/design/reports/*.html`:
a standalone brand-skinned HTML analysis output. Match the existing files'
structure (head/config block, hero, stat strip, content card, footer, nav
widget) and register the new report wherever the folder's README says to — for
`mny/design/` that is a line in `ds-nav.js` **and** an entry in `README.md`.
Read one neighbouring report before writing; the conventions are not guessable.

Two mechanical checks before handing it over, both of which caught real defects
in the reference run: **tag balance and attribute quoting** (one existing report
in that folder has an unbalanced `</div>` that closes `<body>` early), and
**horizontal overflow at 375 / 768 / 1440** — a report about layout defects that
overflows on a phone will be read exactly as carefully as it deserves.

**First, look for a fixed twin.** Before auditing anything, group the page's
components by `(element-type, title)` and flag any group larger than one —
typically one published component and one `is_draft` beside it. That is the
"fixed it by adding a corrected copy next to the broken one" pattern, and it
changes the whole approach: production still renders the broken one, editors
can't tell which is live, and **the corrected copy is the best available
specification of the fix**. Diff the pair first and lead the report with it —
every difference is either the fix or noise, and sorting those two is far
cheaper than deriving the defect from scratch. Then generalize each real
difference through the checks below to find the other components carrying it.

For any individual **Part 0** finding:

```
[TIER n] short title
  what you see : <the literal on-screen string, or the measurement — quoted, never paraphrased>
  where        : <page url / element, and whether it reproduces on load or only on in-app nav>
  why          : <one sentence of mechanism>
  how far      : <N pages seen + M counted from config; name the unit>
```

For any individual **Part 1 / Part 2** finding needing narrative:

```
[CLASS] short title                                    confidence: high|medium|low
  where     : component <id> → element-data.<json.path>
  observed  : <value>
  expected  : <value, grounded in — live source / sibling column / page intent>
  impact    : <what a site visitor sees or doesn't see — or "latent: not currently rendered">
  systemic  : <N of M components; the exceptions are …>
  fix (not applied) : <one line>
```

The `impact` line is where a config finding earns or loses its place in the
report. If you cannot say what a person sees, write **latent** — and do not
promote it into Part 0.

Part 0 classes: `STALE_PAINT_ON_NAV`, `FOREIGN_SUBJECT_CONTENT`,
`WRONG_SUBJECT_COPY`, `RAW_CODE_ON_SCREEN`, `PARTIAL_LABEL_FALLTHROUGH`,
`INTERNAL_LABEL_EXPOSED`, `UNFORMATTED_NUMBER`, `LYING_PAGER`,
`UNTRUSTWORTHY_COUNT`, `NO_EMPTY_STATE`, `MEASURED_SEAM`,
`MEASURED_MISALIGNMENT`, `CROSS_PAGE_INCONSISTENCY`.

Part 1 / Part 2 classes: `META_DRIFT`, `SNAPSHOT_STALE`, `RELIC_FILTER`, `DEAD_FILTER`,
`DEPRECATED_COLUMN`, `ASSET_VARIANT_DIVERGENCE`, `SOURCE_HYGIENE`,
`STALE_TRANSPORT`, `SOURCE_LAYER_MISMATCH`, `UNGOVERNED_SOURCE`,
`MISSING_TILE_COLUMN`, `UNWIRED_PAGE_VARIABLE`, `WRONG_DESIGNATED_LAYER`,
`MIXED_KEY_VOCABULARY`, `SUPERSEDING_DUPLICATE`, `CACHED_STATE`, `DEAD_FACET`,
`OPEN_CARD_SEAM`, `LEGACY_BORDER_PRESET`, `INCONSISTENT_TREATMENT`,
`INERT_PAGINATION`, `UNSCOPED_COLLECTION`, `SURFACE_PINNED_COLOR`,
`MISSING_AUTHORING_AFFORDANCE`, `RAW_CODE_RENDERED`, `STALE_LABEL_LOOKUP`,
`WRONG_GRANULARITY_BINDING`, `PAGE_VARIABLE_NOT_PUBLISHED`, `STALE_SEED_VALUE`,
`EMPTY_RESULT_FILTER`, `INVISIBLE_CHARACTER_MISMATCH`.

Always end with **Source-side recommendations**. Several classes here are only
permanently fixable at the source — retiring superseded columns, deleting
scratch columns, resolving duplicate aliases. Component-level fixes alone
guarantee recurrence.

Always separate **isolated** from **systemic**. A finding on one component is a
bug; the same finding on thirty is a process problem, and the remediation and
the audience differ.

**Collapse co-located findings into their root cause.** When several findings on
one component all touch the same layer, source, or column, they are almost
never independent — they are one wrong binding and its blast radius. Before
reporting, group findings by the object they touch; if a group has a plausible
root (Check H's ungoverned source is the usual one), report the root as the
finding and the rest as consequences beneath it. A list of three peer findings
invites three partial fixes and leaves the cause in place.

---

## Calibration appendix — reference run

MitigateNY, app `mitigat-ny-prod`, pattern 985070, 6,831 components (936 with a
bound source, 26 distinct sources, 7 resolving to a parseable
`config.attributes` — so **19 sources went unaudited**, exactly the caveat
Check C requires reporting).

Triggering report: component **1167446** ("Measures Inventory", page 1009858
`plan_to_act/develop_strategies`, source `Mitigation_Measures` 1068274, view
1155800), reported as three bugs on one component. Intent: all-hazards overview.

**Check A** flagged two rendered columns on 1167446 — `description`
(`type` stored `text`, live `lexical`) and `coastal` (`text` vs `checkbox`).
The `sourceInfo` snapshot was far staler than the badges implied: 46 columns vs
the source's 53, still listing `flood` (renamed `flooding`), missing nine
columns, disagreeing on `type` for 35 — demonstrating why the snapshot must be
diffed separately.

**Check B** on 1167446 found an internal `exclude` on
`program_action_measure_name` listing four individual measure names —
heuristic 1 (hard-coded row literals) and heuristic 2 (contradicts an
all-hazards page). Heuristic 3 supplied the diagnosis: 29 of 32 components on
this source carry the identical exclusion, and the two that don't are precisely
those whose hazard filter is `["drought"]` — so the exclusion was authored to
keep drought rows off non-drought pages and copied everywhere, including the
overview. Two further components carried a *different* four-item list
(heuristic 7, variant drift → author decision). Two more excluded on `flood`,
a column that no longer exists (heuristic 4).

**Check C** found the deprecation marker in the live title: the component's
category facet resolves to a source column titled **`"Category-Deprecated"`**,
while its own stored `display_name` reads `"Category"` — the stale-title
mechanism, in one case. Site-wide the mechanical detector returned **183
deprecated-column usages across 113 components on 4 sources**, none of which
would have been found by reading component config alone:

```
R_and_V_Matrix      :: hazards_string  ("Hazards-Deprecated")     61 components (28 visible, 30 filtered)
Mitigation_Measures :: mm_category     ("Category-Deprecated")    32 components (32 visible, 10 filtered)
Mitigation_Measures :: hazards         ("Hazards-deprecated")     28 components ( 0 visible,  0 filtered)
Mitigation_Measures :: mm_type         ("Type - deprecated")      28 components (28 visible, 28 filtered)
Actions_Revised     :: num_proposed    ("# Proposed - deprecated") 10 components
Actions_Revised     :: num_not_started ("# Not Started - deprecated (dep)") 10 components
Actions_Revised     :: hazards_json    ("Hazards - (no flood, deprecated)") 5 components
… plus (Delete)/tmp-marked columns on Capabilities_Catalogue and Actions_Revised
```

In every group but one, the stored title showed no marker on *all* consumers —
confirming live-source resolution is mandatory, not an optimization. The
`hazards`/`num_proposed`/`num_not_started` rows are hidden and unfiltered
(dead config to clean up); `mm_type` is rendered *and* driving a facet on all 28
(actively serving superseded values). Source-side: `Mitigation_Measures`
defines `mm_category_json` **twice** under one alias with contradictory titles
(`"Category"` and `"Category-Deprecated"`) and carries a `test cat` scratch
column.

**What the sweep changed.** Three bugs on one component were, at the data
level, one duplication process reproducing three defect classes across 32
components — with the deprecated-column class reaching 113 components
site-wide. Fixing 1167446 alone leaves every other carrier and the source-side
ambiguity that produced them.

### Map checks (D, E) — reference run

Second triggering report: component **1216015** (page 1009948), a map that
should show FEMA floodplain zones but renders only county boundaries, and that
lacks the county-zoom filter other platform maps have. Sweep scope: 184 `Map`
components, 342 layers.

**Check D.** The signature held — the context layer drew, the thematic layer
didn't. The transport distribution settled it immediately:

```
tiles   340 layers      ← live dama tile route, source-layer view_{view_id}
pmtiles   2 layers      ← BOTH are "NYS Floodplains Merged - Flood Zones"
                          on components 1216015 and 1607599 (a duplicate pair)
```

Those same two layers are also the **only** two of 342 whose `source-layer`
(`s379_v841`) departs from the `view_{view_id}` convention — two independent
outlier tests landing on the same two layers. The live tile route for the
layer's view is healthy: `tiles/841/8/74/94/t.pbf` → **200, 875 KB**, and
`?cols=fld_zone` returns the paint column, so the floodplain data is fine and
available. Verdict: `binding defect — data available`.

The protocol check (step 4) supplied the mechanism, and it took two passes —
which is why the check is worded the way it is. The `pmtiles://` artifact
**exists**: it answers a range request with `206`. A pmtiles handler **also
exists** — vendored at
[`map/pmtiles/index.ts`](../../src/dms/packages/dms/src/patterns/page/components/sections/components/ComponentRegistry/map/pmtiles/index.ts),
exporting `PMTilesProtocol`, which calls `maplibre.addProtocol("pmtiles", …)`.
Either fact alone reads as "supported, look elsewhere."

The defect is at the **call site**: in
[`map/index.jsx`](../../src/dms/packages/dms/src/patterns/page/components/sections/components/ComponentRegistry/map/index.jsx)
both the import (line 5) and the wiring (`//protocols: [PMTilesProtocol],`,
line 1340) are **commented out**. Nothing registers the scheme, so MapLibre
cannot resolve `pmtiles://`, the source never loads, and nothing draws —
silently. Two secondary confirmations: the layer's URL is
`pmtiles://graph.availabs.org/…`, missing the inner `https://` the handler's own
README documents; and the runtime `?cols=` rebuild is applied to `source.url`
too, appending a query string to a `pmtiles://` URL, which is meaningless for
that transport.

**Check E.** Binding-key completeness across the 342 layers:

```
layers with a dynamic-filter        255 / 342   — all on column `stcofips`
  … with searchParamKey: "geoid"      3         ← fully wired
  … with searchParamKey absent      252         ← partially wired
layers with no dynamic-filter        87
map components with none at all      29 / 184   ← includes 1216015 + twin 1607599
```

The reference instance is **1395341**: `{values: [], dataType: "numeric",
column_name: "stcofips", display_name: "State-County FIPS Code", searchParamKey:
"geoid"}` on the active layer, plus `usePageFilters: true` and component-level
`zoomToFitBounds: true`. The 252 partials carry only
`{column_name, display_name}` — no `searchParamKey`, so each binds to a page
variable literally named `stcofips` rather than to `geoid`. That is the
`searchParamKey || column_name` mechanism producing a whole tier of maps that
look wired and aren't. 1216015 is below even that: no `dynamic-filters` on
either layer, `usePageFilters` unset, `zoomToFitBounds: false`.

One platform-level finding fell out that no single-component review would
surface: **`zoomToFilterBounds` is true on 0 of 255** dynamic filters. The
documented zoom-to-selection mechanism is unused pattern-wide, so "zoom to the
county" is not currently implemented by any map here — worth confirming with an
author before treating it as a per-component regression.

**What the sweep changed.** Two reported symptoms on one map resolved to: a
two-layer unfinished migration to a transport the renderer cannot read (with the
data itself healthy), and a three-tier wiring inconsistency spanning every map on
the pattern. Both are invisible from a single component; both are unmistakable
from the distribution.

### Check H — reference run (the wrong-source case, and how it hid)

Third triggering report, and the cleanest example of the fixed-twin shortcut:
page `the_risk/natural_hazards` on tenant `suffolk_draft` (pattern
`mitigateny_county_template_suffolk_copy`) carries **two** "County Level EAL Map"
components — **2249527** (published, known issues) and **2389090** (draft, the
fix). Diffing the pair took minutes and yielded three real differences plus two
red herrings. Sweep scope for generalization: 358 map components across both
MitigateNY patterns, 348 (component Ã— symbology) records.

**Red herrings, worth naming so a reviewer doesn't chase them.** The fixed twin
populates `tabs[0].rows` with a symbology reference and sets
`display.layerPanel: "none"`; the broken one leaves `rows` empty. Neither
matters: `EMPTY_TABS` is the code default
([`map/index.jsx:61,366`](../../src/dms/packages/dms/src/patterns/page/components/sections/components/ComponentRegistry/map/index.jsx)),
the panel only renders when `layerPanel === 'library'`, and the distribution
confirms it — 336 of 348 records have empty `rows`. A difference present in a
known-good component is not automatically the fix.

**F1 — designated layer.** The broken component designates
`activeLayer: "Jurisdiction Boundary"` (`layer-type: simple`, no `data-column`);
the fixed twin designates the thematic layer (`data-column: eal_valt`). Across
the 342 records that have a thematic layer, **316 designate it and 26 do not** —
a 92% norm that makes the 26 errors rather than intent. Consequence is doubled
because both mechanisms follow the designation: page-filter sync reads only that
layer's `dynamic-filters`, and the zoom-bounds probe resolves `ST_Extent` from
that layer's view (2296, the jurisdictions upload) instead of the data view
(1410). The fallback can't rescue it — it only considers layers with
`zoomToFilterBounds: true`, and that flag is set on **zero** layers here. The
strongest form of the finding also appeared: symbology **2142106 is designated
differently across its own consumers** — `"Jurisdiction Boundary"` on 2249527
and 2323790, `"County Boundary"` on 2252947 — which is drift by definition.

**F2 — mixed key vocabulary.** The broken component's layers bind the single
page variable `geoid` through **two different columns**: `stcofips` (the
governed NRI views 1410/1416) and `county_fip` (view 2296, a locally uploaded
jurisdictions shapefile). The fixed twin uses `stcofips` alone. **32 of 348
records** show mixed vocabularies, and the worst are worse than this one:
`["stcofips","census_geo"]` split across two *different* page variables
(`geoid` and `geoid_juris`, 7 components), `["county_fip","stcnty","stcofips"]`
(2), `["state_id","stcofips"]` (5). The truncated-field tell held exactly as
described — view 2296's columns are `county_fip`, `county_nam`, `census_geo`,
`cis_comm_1`, all clipped to 10 characters, marking an ad-hoc upload rather than
the governed pipeline. Tile probes confirmed both vocabularies are individually
valid (view 2296 carries `county_fip = "36103"` for Suffolk), which is the point:
mixed keys fail by *divergence*, not by being individually broken, so probing one
column proves nothing.

**C2 — symbology variant divergence.** The broken component renders symbology
**2142106** "FEMA NRI … Total EAL **v2 (LHMP)**"; the fix renders **2142005**
"FEMA NRI … Total EAL" — identical paint and breaks, one fewer layer. Stripping
qualifier suffixes across the pattern surfaced **7 families**, all the same
shape: `Census Tract NRI Total EAL by Hazard` vs `… (LHMP)`, likewise
Building/Population/Crop EAL, `Fusion Events by Primary Hazard` vs `… (LHMP)`,
and `Jurisdictions (LHMP)` vs `Jurisdictions v2 (LHMP)`. **This run is the
counterexample that earns C2's first caution:** the `v2` member is the broken
one and the unsuffixed original is the fix. Had currency been inferred from the
name, the audit would have recommended migrating *toward* the defect.

### B2 — reference run (a section filtering itself to nothing)

Reported: component **2249633** on `the_local_environment/people_and_communities`
filters down to no data; suspected a renamed source value.

`display.totalLength: 0`, `data: []`. Its filter is an AND of four equality
predicates on `top_nav_section`, `page`, `section`, `component_name`.

The sibling comparison made it immediate: **1,811 components bind `LHMP_IA`,
and exactly 11 return zero rows.** Building the value vocabulary from the 1,800
working ones showed all 11 fail on the same two terms — `section` and
`component_name` — while `top_nav_section` and `page` are fine. The 11 split
into two clusters with **different root causes**, which is the point of the
classification step:

**Cluster 1 — invisible characters (9 components, "Infrastructure", page
2249302).** Similarity scoring against known values returned a **97% match that
wasn't 100%**: the filter wants `"Infrastructure"`, and the real value is
`"\nInfrastructure"` — a leading newline. Confirmed decisively by working
siblings: components 2249502 (`"\nInfrastructure"`), 2249486
(`"\nWater Infrastructure"`), 2249628 (`"\nEnergy"`) and 2249627
(`"\nCommunications"`) all filter on the newline-prefixed form and all return
`totalLength: 1`. So the source data carries the newline and the failing
components carry the trimmed string.

This is **not** the reported cause, and it cannot be fixed by editing the filter
value in the UI — the author would be typing a string that looks identical to
the one already there. The fix belongs to the source data (trim it) or to the
matching behavior.

**Cluster 2 — content that doesn't exist (2 components, "Neighboring
Communities", page 2249281 — 2249633 and its twin 2251753).** The best match in
a 46-value pool was `"Climate Smart Communities"` at 46%. Nothing close exists,
in filter text or in cached rows. This one *is* the reported cause-shape: the
row was never authored for this tenant, or was removed.

Two lessons the check now encodes. **`JSON.stringify` every value you compare** —
had these been printed as plain text, `Infrastructure` and `\nInfrastructure`
would have looked like the same string and the cluster would have been
misfiled under "renamed content." And **the working-siblings vocabulary
substitutes for querying the dataset** — direct split-table row fetches returned
nothing over the standard falcor path, so the 1,800 working filters were the
only available ground truth, and they were sufficient.

---

### F3 — reference run (zoom-to-fit that lands on the wrong geography)

Reported: map **2249454** on `the_local_environment/people_and_communities` has
zoom-to-fit enabled and should zoom into a jurisdiction, but doesn't.

The zoom setting is **not** broken. `zoomToFitBounds: true` is set on the
component and is correctly propagated to every layer
([`map/index.jsx:1211`](../../src/dms/packages/dms/src/patterns/page/components/sections/components/ComponentRegistry/map/index.jsx)),
and `SymbologyViewLayer.jsx:577` duly fits to the bbox of the rendered features.
It is doing exactly what it says — the features it is given are the wrong ones.

Two stacked defects produce that:

- **The layer is bound at county granularity.** The "Jurisdiction Boundary"
  layer (view 2296) filters `county_fip → geoid`. So it renders *every*
  jurisdiction in the county, and the fit resolves to the county extent.
  Pattern-wide, **18 jurisdiction-named layers across 7 symbologies** bind
  `county_fip → geoid`, while **7 layers (symbology 2142101) bind
  `census_geo → geoid_juris`** — the correct jurisdiction-level pattern already
  exists and is the minority.
- **The page doesn't publish the finer variable.** Page 2249281 declares
  `filters: [{searchKey: "geoid"}]` and nothing else. There is no `geoid_juris`
  on this page to bind to, so rewiring the layer alone cannot fix it — compare
  page 2249300, which publishes `geoid`, `hazard` *and* `geoid_juris`. Reporting
  only the component half would have produced a fix that couldn't work.

The platform-level finding, which no single page would surface: across **468 map
dynamic-filters, `zoomToFilterBounds` is true on 0**, while **109 components set
`zoomToFitBounds: true`**. Every map here relies on the viewport-dependent
client-side fit and none uses the server-side `ST_Extent` path — which is why
"zoom to fit" behaves inconsistently across pages and reads as a per-page bug
each time.

Incidental, and a good `STALE_SEED_VALUE` example: the dominant filter seed in
this pattern is `[36105]` (146×, numeric) and `["36105"]` (39×, string) —
**Sullivan County**, on a *Suffolk* tenant — against just 6 instances of
`["36103"]` (Suffolk). Seeds are overridden when the page variable resolves, so
these are latent; they surface whenever it doesn't. The numeric/string split on
one key is its own hazard, since coercion is inferred from the first value's
shape.

---

**H — the root cause, and why the first pass missed it.** The three findings
above are **not three defects**. They are one wrong source binding and its blast
radius, and reporting them as peers was an error this section exists to prevent.

The broken component's extra layer binds source **1612 / view 2296**. Its
source-object id is `hazmit_dama_comp_1767815938875_xhzxhpy` — the
`{datasetName}` slot reads **`comp`**. Across **712 layers** in both patterns,
those 25 layers are the **only** ones whose source object carries no dataset
name; every other binding embeds a real one (`NRI Tracts Geospatial`,
`NRI Counties Geospatial`, `nys_counties`, `avail_merged_floodplains_2025`,
`cities_towns`, `SVI2022_NEWYORK_tract`, `NYS_DEC_Dams`, …). It is also the
newest binding in the corpus — minted **2026-01-07**, against 2023–2025 for
nearly everything around it. An ad-hoc upload that never went through the
catalog, in other words.

Two properly-named jurisdiction sources already exist as candidate
replacements: `cities_towns` (src 1559 / view 2074, minted 2025-11-04) and
`cl_2024_v01_openfemagdba…` (src 1579 / view 2219, minted 2025-11-21).
The 204 schema probe shows all three are **schema-disjoint** — 2296 exposes
`county_fip, census_geo, cis_comm_1, county_nam` (10-char truncated shapefile
fields), 2219 exposes `geoid`, 2074 exposes `name`, with no column in common —
so they are different datasets, not versions of one, and switching sources
forces every filter column that referenced 2296 to be rewritten too.

Everything else in this section follows from that one binding:

- **F1** — the ungoverned layer is the one designated `activeLayer`, so it
  captured page-filter sync and zoom-bounds resolution.
- **F2** — it could only introduce `county_fip` as a second vocabulary because
  its schema shares no column with the governed views.
- **C2** — the `v2 (LHMP)` symbology variant exists *because* it is the variant
  carrying this layer; the unsuffixed original doesn't have it, which is why
  dropping back to 2142005 fixed the map.

### Checks I, J, K — reference run (presentational relics)

Fourth triggering report: three visual complaints on
`the_risk/natural_hazards/extreme_cold` (page 2249263, pattern
`mitigateny_county_template_suffolk_copy`) — a card group "bordered to look like
a single box" whose borders don't touch, labels that should be aligned
consistently, and a "Learn more" section that is inexplicably paginated. Sweep
scope: 56 pages, 1,880 sections, 6,651 components.

**I — the seam.** The group is sections 2250443 → 2250520 → 2250510 → 2250530,
with presets `openBottom → borderX → borderX → borderX`. All three failure modes
are present at once:

- **I1**: the run ends on `borderX`, so there is no closing `openTop` — the box
  has no bottom edge and square bottom corners. The aggregate confirms it
  pattern-wide: **`openBottom` 257 vs `openTop` 210**, a surplus of 47 openers;
  `openRight` 76 vs `openLeft` 70.
- **I2**: the opener carries no padding while all three continuation members
  carry `p-4` — 16px of outer gutter inserted between boxes that are supposed to
  share an edge.
- **I3**: **2,331 sections use legacy string presets and 0 use the per-side
  object shape**, so nothing in this pattern can fuse without the 2px
  transparent-border break. The compound-card migration never reached it.

Run-level totals: **88 fused runs, 18 unterminated, 17 with mixed padding, 16
with mixed justify.** And the finding is a template, not a page — the identical
4-section run with the identical defects appears on **avalanche, snowstorm,
wildfire, flooding, extreme_heat, wind, coastal_hazards, hurricane, extreme_cold,
landslide, tornado, ice_storm** and more. One authoring mistake, thirteen pages.

**J — alignment.** Inside that one run, `Hazard of Concern` uses
`justify: "left"`, `Modeled RIsk` leaves it unset, and `Historical Risk` uses
`justify: "center"` — three treatments in one visual row. Pattern-wide the
distribution is **left 687, center 77, right 2, empty-string 5**, with 9 Cards
mixing values internally and 12 carrying an empty-string `justify`.

Note what the distribution says versus what was asked: **`left` is the
established convention here at 87%.** The request was to center the labels,
which is a decision to *change the convention*, not to fix a deviation. The
defensible finding is the three-way inconsistency inside the group; the
center-vs-left choice belongs to the author, and the report should say so rather
than quietly adopting the minority value. (Incidental, worth passing along: the
`Modeled RIsk` title carries a typo.)

**K — the paginated "Learn more".** Section 2250502 is a Card with one lexical
narrative cell and one `isLink` cell labelled "Learn More", showing
`usePagination: true`, `pageSize: 5`, `totalLength: 16` — four pages of pager
under what is visually one callout. This is **K2, not K1**: it binds source
`LHMP_IA` (1441680 / view 1441681) with an **empty `dataRequest.filter`, zero
column filter leaves, and `usePageFilters: false`**, while the page publishes
`geoid`, `hazard` and `geoid_juris`. It is rendering every subject's narrative
row, not this hazard's. Turning pagination off would have hidden that.

The near-identical sibling 2250547 ("Overview") binds the **same source and the
same view**, equally unfiltered, yet reports `totalLength: 1` — which is exactly
the cached-count trap: two unfiltered sections on one view cannot honestly
disagree, so one number is stale and neither count can be trusted on its own.

K1 is separately pervasive and worth reporting as a rate, not a list:
**3,015 of 3,356 paginated sections (90%) can only ever render one page, and
2,804 of those hold a single row.**

**L — the white button on the beige band.** Component 2249429 on
`the_risk/climate_change` is a Card with `display.bgColor: "#FCF6EC"` (beige) and
a "Explore More" link cell carrying `bgColor: "#FFFFFF"`. Sweep results:

```
sections carrying any explicit color            1,409
cell color differing from its section color       286
  … white cell on a TINTED section                222
  … of those, the white cell is a LINK cell       222   (100%)
distinct literal colors in the whole pattern        3   #f3f8f9 ×1717, #ffffff ×697, #fcf6ec ×152
section background values                             #f3f8f9 ×1021, #ffffff ×215, #fcf6ec ×72
```

Every single mismatch is a link/button cell — one authoring path, 222 times.
Both tints are affected (`#fcf6ec` beige, `#f3f8f9` pale blue), so the report's
"beige" instance is one of two manifestations. And with only **3 distinct
literals** in 6,654 components, this is not color sprawl: the palette is
correct and is being typed in by hand.

**The control is the cause.** In
[`Card.config.jsx:316`](../../src/dms/packages/dms/src/patterns/page/components/sections/components/ComponentRegistry/Card.config.jsx)
the cell background control is `<ColorControls … key={'cellBgColor'} />` with
**no `colors` prop**, so it falls back to
[`ColorControls.jsx`](../../src/dms/packages/dms/src/patterns/page/components/sections/components/ComponentRegistry/sharedControls/ColorControls.jsx)'s
`defaultColorOptions = ["#FFFFFF", "#F3F8F9", "#FCF6EC"]` — three opaque
choices, **no transparent/inherit option, no way to clear**, and the component
even defaults `value='#FFFFFF'`. An author styling a cell literally cannot
express "inherit the section."

Its siblings do it correctly, which is what makes this an outlier rather than a
convention: `sectionMenu.jsx:1432` seeds the picker from the theme
(`sectionArray.borderColors`), `richtext/config.js` passes its own palette and
defaults to `rgba(0,0,0,0)`, and `component-overview.md` documents the intended
shape as `['#FFFFFF', '#F3F8F9', '#FCF6EC', 'rgba(0,0,0,0)']` — transparent
included.

So the correct primary finding is `MISSING_AUTHORING_AFFORDANCE` against one
control, with 222 `SURFACE_PINNED_COLOR` instances as its consequence. Bulk-
editing the 222 without adding the inherit option would leave every future card
to reintroduce it.

**M — geoids where names belong.** Component 2381040
(`the_plan/about_the_process`, source `Capabilities_Catalogue`) was reported as
showing a geoid instead of a jurisdiction name, fixable by Refresh Meta. Both
mechanisms are present in it, which makes it a good calibration case:

- **Variant 1** — its `geoid_county` column has **no** `meta_lookup`, while the
  live source defines one (`view 1108098`, `geoid` → `county`). A `select`
  column with no lookup renders the stored value, i.e. the raw code. It is
  currently `show: false`, so this instance is **latent**, not visible.
- **Variant 3** — both shown `geoid_juris` columns *do* carry a lookup, but a
  stale one:

```
stored  valueAttribute: "municipality_name"                            → "Bethel"
live    valueAttribute: "(data->>'municipality_name') || ' (' ||
                         (data->>'municipality_type') || ')' as dhses_name"  → "Bethel (Town)"
```

Sweep across both patterns (4,355 components with a bound source; **12 of 40**
live source configs resolved, one batch 500'd):

```
variant 1  shown column, live defines a lookup, component has none      0 columns
variant 3  shown column, lookup present but differs from live         164 columns / 161 components
             Capabilities_Catalogue :: geoid_juris   84
             Hazards_of_Concern     :: geoid_juris   65      ← same municipality_name → dhses_name drift
             Hazards_of_Concern     :: hazard        14      ← inline value map drifted
             Actions_Revised        :: geoid_juris    1
no lookup anywhere (source-side gap)                                   10 columns
unaudited (source config unresolved)                                  389 code-ish shown columns
```

Two calibration lessons. First, **the silent variant dominates** — 164 stale
against 0 missing on shown columns. A check that only looked for raw codes would
have reported this pattern clean while 149 components rendered "Bethel" where
the source now specifies "Bethel (Town)". Second, **it clusters by source
column**: one label-formula change at `geoid_juris` stranded every consumer
across two sources at once, so the fix unit is the (source, column) group, not
the component.

Honest limit on this run: I confirmed the drift and its scale from stored
config, but did not visually confirm which variant produced the reported
symptom. A raw geoid on a *shown* column would most likely be variant 2 —
individual keys falling through the stale lookup — which only a live render or a
row-level check of the meta view against the data's distinct keys would settle.
And with 28 of 40 source configs unresolved, 389 code-ish shown columns remain
**unaudited, not clean**.

**What Part 2 changed.** Three complaints phrased as one page's polish problems
resolved into: one template defect replicated across thirteen hazard pages, one
group-level inconsistency against an 87% convention, and one data-scoping bug
wearing a pager. Only the middle one is actually a styling decision.

A fourth, reported separately, resolved into a **missing option in one authoring
control** — the most useful shape a presentational finding can take, because it
is fixed once rather than 222 times. When a visual relic appears on hundreds of
components with no exceptions, stop looking for the authoring mistake and go
read the control.

---

**The lesson, and why Check H now runs before F.** The first pass reported
F1, F2 and C2 as three independent classes. Each was individually correct and
each would have produced a partial fix that left source 1612 in place — the map
would keep "working" until the next author reused the same symbology. The
detector that finds the root is cheaper than all three: **parse the
source-object id and look at the `{datasetName}` slot.** One string comparison
over 712 layers isolates it.

---

### Part 0 — reference run (and why this part exists)

MitigateNY county template, pattern **1300890** (`county_template.devmny.org`,
tenant Sullivan 36105), 2026-08-19. 55 pages, 15,681 component rows — of which
**1,861 are the published set that actually renders** and 11,962 are referenced
by no page at all. **20 pages walked**, 17 findings, tiers **7 / 5 / 5**.

**This part was written because the first attempt at this audit was the wrong
deliverable.** The request was to QA the pages; the first pass ran Checks A–M
over stored config and returned a 1,200-row table of metadata drift. It was
accurate and it answered a question nobody had asked. Every heading in Part 0 is
a generalisation of something that only appeared once the pages were opened.

**What only the render found:**

- **V1** — clicking Drought from Wind left `WIND · HIGH RISK` on screen for
  ~400ms after the URL changed (1,800ms click-to-correct). Invisible in config,
  absent on hard reload, and initially misdiagnosed twice: once as a wrong
  binding (the stored filter *is* wrong, and is overridden at runtime), once as
  a catastrophic routing failure (which was an artifact of navigating by
  `pushState` instead of clicking).
- **V3 partial fallthrough** — `"Ice storm"` rendering among eight correctly-cased
  labels. The source's 19-entry map is correct, the component's copy is
  *identical to it*, and Check A flags the column only because the serialisation
  differs. Config reported it clean; the value simply isn't a key.
- **V2 foreign rows** — "Measures Inventory" carries 249 unfiltered rows on 13
  hazard pages. The config detector (K2) found the unscoped binding, but the
  *finding* is "Arson Prevention and Assess Vulnerability to Drought Risk, on
  the Extreme Cold page."

**What the render disproved** — three of four cross-checks went this way, which
is the whole argument for the ordering:

```
Modeled RIsk typo, 16 sections   → invisible; heading is text-transform: uppercase
hazards:["Flooding"] on Wind     → correct output; page variable overrides at runtime
meta_lookup drift, 68 components → false positive; 19/19 entries identical
```

Check A's own precision, measured: **650 of 1,217 flags (53%) were
`options: null → []`** — one column on 325 published sections, semantically
identical either way. A badge that is more than half noise is a badge authors
stop reading, which is how the 131 genuinely stale label lookups survived.

**V5 needed its framing corrected mid-run.** 14 empty headings on
`about_the_process`, 12 on `strategies`, 8 identical "Local Context" headings on
`built_environment` — all *correct* for a template awaiting local input. Written
up as "empty sections" it reads as not understanding the product. The defensible
finding is that nothing distinguishes an intentional vacancy from a failure, and
that where authoring guidance exists it hides behind an info icon (and on two
sections is itself blank).

**V6 measured rather than eyeballed.** The four-part risk card: inner box edges
at y = 942–1060, 1092–1214, 1246–1430, 1462–1849 — **32px at every junction**,
final box `border-bottom: rgba(0,0,0,0)` with `border-radius: 0`. Section padding
is the *outer* gutter, so `p-4` on each member pushes the boxes apart; and the
run goes `openBottom → borderX → borderX → borderX` with no closer. **15 of 16
hazard pages. `flooding` is the one that closes** — that single page is the fix
spec, and it was worth more than the count.

**What Part 0 changed.** The same underlying data produced two reports. One was
a config table headed "1,217 flagged columns." The other opened with *"click
Drought and the page still says Wind."* Only the second is actionable by anyone
who doesn't already know the schema, and the fix list collapsed from 17 findings
to **9 fix units**, of which the top four — one platform behaviour, one template
binding, twelve dataset rows, two column definitions — cover everything a reader
notices in their first thirty seconds.

### The relevance gate — reference run

MitigateNY county template, draft sections, 26 pages. The report raised **539
rows across 9 classes**; the owner marked each row relevant or irrelevant. The
result is the sharpest calibration data in this document, because the verdict
splits almost perfectly along class lines rather than row by row.

| Class | Relevant | Owner's reason for the rejects |
|---|---|---|
| No Data Fetch Mode | **34 / 34** | — |
| No requirement tag | **10 / 10** | — |
| SHMP not permission locked | **21 / 21** | — |
| Stores zero rows | 5 / 58 | *"Table configured correctly. The jurisdiction does not have any Completed Actions in the database, so it presents as a blank table."* |
| Untitled contentless shell | 1 / 75 | *"Header, footer, filter, map components … showing up as headerless and contentless is a false signal. They are all showing up as expected."* |
| Tag record disagrees with platform | 0 / 43 | *"User excluded tags here because they break the design, but the requirements were met elsewhere."* |
| Source snapshot out of date | 0 / 104 | *"Disregard for now, we will review this in a separate update."* |
| Unscoped collection | 0 / 2 | *"Component is filtering correctly and displaying the anticipated content correctly."* |
| Bound to an unresolvable source | 0 / 192 | same deferral note as snapshots |

**71 of 539 — 13%.** Three classes at 100%, four at 0%, two at noise level.

What separates them is Test 1 exactly. The three classes that survived are the
three where the finding could name the setting *and* its correct value from an
external authority — a rule in a task doc, a published vocabulary, and the value
377 of 398 siblings already carried. Every class that could only say "this looks
wrong to me" was rejected.

Three further lessons the run paid for:

- **The deferral test is worth more than every other filter combined.** 347 of
  the 474 rejects were three classes carrying one owner note. Both task
  documents had been read in full; they were mined for scoping rules and never
  asked whether they already *owned* a class about to be reported.
- **A caveat that doesn't change the ranking is doing no work.** The report
  stated in its own limits that `totalLength` is a cached count and that no
  render was observed — then ranked 58 zero-row components in Tier 2 and two
  inferred "unscoped collections" in Tier 3. All but five were rejected on
  exactly the grounds the caveat had already named.
- **The owner's most useful note was about a check that was never run.** On the
  one component where the config detector fired for the wrong reason, the note
  read: *"the QA sweep should have picked up the 'deprecated' label on a column
  being used"* — Check C, in this document, unrun. Of checks A–M the run
  executed only A, and never said so.
