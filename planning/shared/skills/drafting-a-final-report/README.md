# Drafting a project final report

A repeatable method for turning a multi-year engagement's scattered record — contracts, meeting
minutes, presentations, and the live platform itself — into a scientific-structure final report
that ships as a **designed HTML document first** and a **Word document second**.

> **Where this lives and why.** `planning/planning-rules.md` says cross-project authoring skills
> belong in `src/dms/skills/`. That directory is the `@availabs/dms` submodule, and this guide is
> about client deliverables rather than library capability — it would force a submodule commit for
> no library benefit. It sits under the `shared` project instead, per the same file's allowance for
> project material that isn't a task. Move it if the convention changes.

## Contents

| File | What it is |
|---|---|
| [`README.md`](./README.md) | This file — the agnostic method. Read it start to finish before drafting. |
| [`nysdot-ppdaf.md`](./nysdot-ppdaf.md) | The NYSDOT PPDAF final report: source inventory, the verified facts, the author's voice profile, design decisions, and what's still open. Read it if you are touching that report, and skim it as a worked example if you are starting another one. |
| [`html2docx.py`](./html2docx.py) | The HTML → Word converter. Structure-aware, not generic: it walks the TransportNY design-system document shell and emits real Word constructs. Copy and adapt the selectors for another design system. |

---

## 0 · Before anything, find the required structure

**Most public-agency contracts specify the final report's organization, and it is binding.** Look
for an attachment titled something like "Requirements for the Final Report" in the task assignment
or scope of work. It will name the sections, the front matter, the formats, and the copy count.

The NYSDOT/FHWA SPR form (Attachment A of a task assignment) requires, in order:

1. Title page — the SPR project ID, the title exactly as in the contract, the words "Final Report",
   the month and year, the PI(s) and their organizations and addresses, and **a colour photograph or
   design on the cover**.
2. Disclaimer (inside cover) — verbatim FHWA text; copy it exactly, do not paraphrase.
3. **Form DOT F 1700.7** — the 22-field Technical Report Documentation Page. Fields 16 (Abstract) and
   17 (Key Words) are the ones you actually write; the rest are administrative.
4. Table of contents.
5. **Executive Summary** — explicitly "a non-technical summary of the research and its findings."
6. **Introduction** — the problem, its background, a concise history of prior research, and what
   agency policies/procedures/practices are currently in place related to the topic.
7. **Research Method** — how the research was conducted.
8. **Findings and Conclusions** — analysis of the data, conclusions from it, and suggestions for
   additional research.
9. **Statement on Implementation** — what would need to occur to introduce the results into
   practice, plus technology-transfer activities.
10. Appendices.

Also check for: a **one-page project summary / research brief** (usually a separate deliverable), a
**final presentation** in PowerPoint, and a **hard-copy count** (NYSDOT: fifteen bound colour
copies). These change what "done" means.

If nothing is specified, the ten-part list above is a good default for any agency research report.
General references worth a look when the contract is silent:
[NCHRP final reports](https://onlinepubs.trb.org/onlinepubs/nchrp/) as exemplars of the form, and
your agency's own recent published reports for house style.

### Where to deviate

Two deviations are usually worth making and easy to defend:

- **Split findings from conclusions.** Attachment A folds them together. If you have eight or nine
  findings, running them into the conclusions buries both. Number the findings as their own section
  and keep conclusions short and numbered.
- **Add a Products section before Findings.** For a platform or tool engagement, the reader most
  wants to know what exists. Putting it before Findings also lets the findings refer to specific
  screens by name.

Say in an HTML comment where you deviated and why, so the reviewer sees it was a decision.

---

## 1 · Build the source corpus before you write a sentence

Every fact in a final report must be traceable. Build the corpus first, in a scratchpad, and keep
the extraction scripts.

### The five source types, in order of value

| Source | What it gives you | How to extract |
|---|---|---|
| **Meeting minutes** | By far the richest. The chronology, the decisions, what broke, who asked for what, the numbers as they were first reported. | `python-docx` with a block iterator that keeps tables and heading levels. Minutes are usually reverse-chronological; index every `Date:` line first so you can navigate. |
| **The contract and its amendments** | Task structure, budgets, dates, named deliverables, PM names, the required report format. | `python-docx`. **Diff the versions** — an extension is usually 95 % identical to the original and the 5 % that changed is the story. |
| **The prior-phase final report** | "Where the project left off" — and the prior report's *unfinished business* list is your findings section's starting point. | `python-docx`. Read the conclusion and any "future research" section first. |
| **The live product** | Current counts, current measures, what actually shipped, and screenshots. | The DMS CLI (`dms pattern list`, `dms page list --pattern <id>`, `dms section dump`) for a DMS site; the running app for screenshots. |
| **Presentations** | Framing language the client already accepted, and diagrams. | `python-pptx`, including `notes_slide`. |

### Extraction recipe (docx, keeps tables)

```python
from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph
from docx.oxml.ns import qn

def iter_block_items(doc):
    for child in doc.element.body.iterchildren():
        if child.tag == qn('w:p'):   yield Paragraph(child, doc)
        elif child.tag == qn('w:tbl'): yield Table(child, doc)

for item in iter_block_items(Document(path)):
    if isinstance(item, Paragraph):
        style = item.style.name if item.style else ''
        prefix = f"\n## [{style}] " if 'Heading' in style or style == 'Title' else ''
        if item.text.strip(): print(prefix + item.text.strip())
    else:
        print("\n[TABLE]")
        for row in item.rows:
            print(" | ".join(c.text.strip().replace('\n', ' / ') for c in row.cells))
        print("[/TABLE]\n")
```

### Reading minutes efficiently

Minutes are repetitive by design — a rolling agenda carries the same item forward for weeks. Don't
skim; read them, but strip the noise first:

```bash
grep -n "^Date:" minutes.txt            # index every meeting, get line numbers
sed -n '<from>,<to>p' minutes.txt \
  | grep -v "^Attendees:" | grep -v "^Topics:" | grep -v "^Fixes Doc:"
```

Read newest-first if you need "where we are" and oldest-first if you need "how it evolved". Budget
roughly one chunk of ~1,000 lines per read. **Repetition across weeks is signal** — an item that
recurs for two months without resolution is either a real blocker or a real finding.

### The live-product pass

For a DMS site, pattern IDs give you the product inventory:

```bash
export DMS_HOST=https://dmsserver.availabs.org DMS_APP=<app> DMS_TYPE=<type>
node src/dms/packages/dms/cli/bin/dms.js pattern list --format summary
node src/dms/packages/dms/cli/bin/dms.js page list --pattern <id> --limit 300 --format summary
node src/dms/packages/dms/cli/bin/dms.js section dump <sectionId>   # lexical → text
```

Gotchas that cost time on the NYSDOT report:
- Auth-restricted patterns return `id: "no-access"` but **their data still comes back** — you can
  read the pattern row, you just can't list its pages.
- `raw list <app> <type>` did not resolve page types; `page list --pattern <id>` did.
- Page `sections` are refs (`{id, ref}`), so `page dump --sections` is not enough — fetch each
  section and parse the lexical `element-data` JSON.

**If the product has a documentation set, read that first.** On the NYSDOT report the platform's own
95-page docs carried every current count, every measure definition and a dated methodology change
log — an hour of reading that replaced days of reconstruction.

---

## 2 · The fact ledger

Keep one scratchpad file of every number you intend to publish, each with its source. Write nothing
into the report that isn't in it. A final report's authority is entirely a function of whether its
numbers survive a reader checking one.

Rules that earn their keep:

- **Every figure names its basis.** Not "310.86M vehicle-hours" but "310.86M vehicle-hours,
  CY 2025, statewide, all vehicles, on the June 2026 revision."
- **Two correct numbers that disagree are a finding, not an error.** Say both and say why they
  differ (e.g. one year's network map vs. a table of every segment ever seen).
- **State the absences.** Measures specified but not built, years not computed, maps not drawn,
  fields not captured. This is the single practice that most raises a technical reader's trust, and
  it costs nothing but nerve.
- **Date everything that moved.** If a number changed mid-project, give the date, the cause, and
  explicitly whether figures before and after are comparable.

---

## 3 · Structure the narrative

The contract gives you the skeleton. The shape below fills it for a build/platform engagement and
maps cleanly onto the required order.

```
Front matter   title · disclaimer · DOT F 1700.7 · contents
Executive Summary
1 Introduction        1.1 the problem   1.2 background / prior phase
                      1.3 what this assignment set out to do (+ task table)
                      1.4 the agency practice this work touches
2 Research Method     architecture · governance cadence · data governance ·
                      provenance discipline · QA and acceptance
3 Products            one subsection per product, then the shared infrastructure,
                      then the recurring (calendar) deliverables
4 Findings            ordered most-consequential first; measurement findings before
                      capability findings; institutional findings last
5 Discussion:         5.1 task-by-task accounting   5.2 adoption and use
  where we are        5.3 what is NOT done (a table)  5.4 any contract-required rec.
6 Where it's headed   drawn from the successor scope; end with YOUR phasing
                      recommendation, marked as a recommendation
7 Conclusions         numbered, one paragraph each, then "additional research"
8 Statement on Implementation
Appendices            A deliverables vs. tasks · B reference tables ·
                      C data sources · D change log · E figures/tables/sources
```

### What makes each section good

- **Executive summary.** It must stand alone and it must survive being lifted out as the one-page
  summary. Give it: a headline that states the result (not the topic); 3–4 paragraphs of narrative;
  an at-a-glance stat block; a "what was built" strip; a "what we found" grid of big-number cards;
  and a two-column "where we are / where we're going". Close with a single-sentence version in a
  tinted card. Write it **last**.
- **Introduction.** The "concise history of research previously completed" is where the prior-phase
  report earns its keep. Restate the one or two prior findings that set the pattern for your own.
- **Research method.** For a platform engagement, the *institutional* method (meeting cadence,
  technical panel, data governance) is as much the method as the technical one, and several findings
  will have come out of it. Say so.
- **Findings.** This is the report. Each finding gets: the number, the evidence, what was done about
  it, and what follows for the agency. Distinguish "we measured this" from "we decided this".
- **What is not done.** A table with three columns — *item*, *state*, *blocked on*. "Blocked on a
  decision" and "blocked on effort" are different and the reader needs to know which.
- **Where it's headed.** Separate what the successor scope *commits to* from what you *recommend*.
  Mark the recommendation as yours. A phasing table with a "because" column is worth more than
  prose.

---

## 4 · Design it as an HTML document

Author the HTML first. It is faster to iterate, it renders in review, and it converts.

### Use the project's design system

For TransportNY: `src/themes/transportny/TransportNY Design System/dms_design_system_v2/`. Inline
the `_shared.css` subset into `<style>` rather than linking it, so the file opens standalone and
survives export. Copy values verbatim and say so in a comment.

Existing reports in `.../dms_design_system_v2/reports/` are the pattern to match:
`npmrds-data-quality-report.html` is the closest model for a document-shell report.

### Document shell, not app shell

A report is a deliverable, not a site page. Drop the sidebar and the app chrome (its nav links would
be dead anyway). Keep: a topographic hero header, kicker rules (`// 01`) above each section heading,
`.tny-card` for every boxed element, `table.tny` for every table, and the display/proxima/mono type
ladder.

### Build for Word from the first line

| Do | Don't |
|---|---|
| Single-column flow; card grids that stack | Multi-column text, absolute positioning |
| Real `<table>`, `<figure>`/`<figcaption>`, `<h2>`/`<h3>` | Divs styled to look like tables or headings |
| `<img>` with relative paths | Base64 data URIs (huge, un-diffable) |
| Numbered figures and tables in the caption text | Relying on CSS counters |
| A `@media print` block: hide chrome, `break-inside: avoid` on cards/tables/figures, `break-after: avoid` on headings, `.page-break` on major sections | Anything that only works on screen |

### Figures

- **Real captures only.** A mock-up of a tool that exists is a fabrication, and a final report is
  exactly the document where that matters.
- **Every caption names the state that produced it** and the capture date, so the figure is both
  reproducible and self-invalidating.
- Check `assets/screens/README.md` in the design system for what already exists before capturing
  anything new — on the NYSDOT report twelve of twelve figures were already on disk.
- Verify every path resolves before you ship:
  ```bash
  grep -o 'src="[^"]*"' report.html | sed 's/src="//;s/"//' | sort -u \
    | while read p; do [ -f "$p" ] && echo "OK   $p" || echo "MISS $p"; done
  ```

### Assemble in parts

A long report will exceed what you want to write in one go, and heredocs choke on the content.
Write numbered part files with the Write tool, concatenate, then delete the parts:

```bash
cat report.html _part02_*.html _part03_*.html ... > _combined.html \
  && mv _combined.html report.html && rm -f _part0*.html
```

Then check tag balance (a Python regex count of open vs. close per tag catches the one unclosed
`</table>` that would otherwise silently eat half the document).

### Render it before you hand it over

`file://` URLs are blocked for browser automation. Serve the design-system folder and navigate:

```bash
python -m http.server 8931 --bind 127.0.0.1     # from dms_design_system_v2/
# then http://127.0.0.1:8931/reports/<file>.html
```

Scroll the whole thing. Headline wraps, card-grid orphans and table overflow only show up rendered.

### Leave a review-notes block

End the draft with a tinted card listing: open questions for the client, what could be added, what
could be cut for the Word version, which figures are missing, and the conversion path. It turns a
review from "what do you think" into a decision list.

---

## 4b · Writing in the author's voice

A final report goes out under a person's name. If they have written others, match them — and ask for
the back catalogue *before* drafting rather than after.

### Build a voice profile first

Extract 4–6 of their prior reports (same recipe as §1), read the **most recent two closely** and skim
the rest for drift, then write the conventions down explicitly before touching the draft. Look for:

| Dimension | What to record |
|---|---|
| **Person** | First person plural, or institutional third person? This is the single biggest lever. |
| **Headings** | Sentence-shaped with terminal periods, or noun phrases? Numbered? |
| **Sentence rhythm** | Short and punchy, or longer and comma-rich? Do they use fragments for emphasis? |
| **Recommendation grammar** | How does a recommendation open? Is it hedged? Does it carry a cost rationale? |
| **Structural habits** | Recurring sections that are not in the contract template — an "About this Document", a "Scope Challenges", a "Strengths / Needs" pair. |
| **Vocabulary tells** | Words they reach for that a model would not: `utilize`, `a variety of`, `it should be noted that`, `the following`, `outlined below`. |
| **Candour** | Do they write plainly about overruns, deferrals and mistakes? Many agency authors do, and it reads as authority. |
| **Tables vs prose** | Some authors carry the argument in tables and use prose to connect them. |

### The transformation, mechanically

Once profiled, the rewrite is largely a set of substitutions. For the NYSDOT report these were:

- **Person.** Every `we / our / us` becomes `AVAIL`, `the research team`, `this report`. Verify with a
  regex at the end; the count should be zero.
- **Headings.** `The delay measures had to be rebuilt` becomes `Revision of the Excessive Delay
  Measures`. Noun phrases, no terminal periods. *Keep the claim* — move it into the first sentence of
  the section, where it reads as a finding rather than as a headline.
- **Recommendations.** `We recommend X` becomes `AVAIL recommends X`, with the reason attached.
- **Aphorisms.** Cut most closing one-liners ("That is the method.", "It costs nothing but nerve.").
  Keep one or two where the point genuinely needs the emphasis.
- **Em-dash asides.** Reduce by roughly two thirds. Model prose over-uses them; most agency authors
  do not.
- **Adopted sections.** Add the structural habits from the profile. The NYSDOT v1 gained an *About
  this Document*, an *Identified Needs and Open Items* table, and a *Scope Challenges* section, all
  lifted from the author's own earlier reports — and all three made the report better, not merely
  more like him.

### What not to change

Structure, findings, figures, tables and every number carry over unchanged. A voice pass is a voice
pass. Diff the two files afterwards and confirm that no figure moved.

### Keep the draft

Write the voiced version as a **separate file** and leave the draft in place. The draft is the record
of what was found; the v1 is the deliverable. State in the v1's header comment which file it derives
from and what changed.

### A note on drift

An author who has been writing for a decade is not a single style. Ask which era to target. The
NYSDOT author's own instruction was that his later writing had been moving toward the model's
register, so the target was a blend: institutional person and noun-phrase headings from him,
analytical density and findings-first ordering from the draft.

---

## 5 · The Word conversion

Do this **after** the HTML is approved, not before.

**Pandoc is the obvious tool and it was not available on this machine**, which turned out to be
fortunate: a structure-aware converter produces a markedly better document than `pandoc -o x.docx`
does, because a report's HTML carries a great deal of design chrome that should not survive the trip.
[`html2docx.py`](./html2docx.py) is that converter and is the recommended starting point.

### What it does

Parses the report with BeautifulSoup and walks the known structure, mapping:

| HTML | Word |
|---|---|
| `<header>` | A hand-built title page: kicker, title, lede, cover image, a borderless three-column prepared-for/by/through table, contract line |
| the disclaimer card | Its own page — Heading 1 plus body |
| the DOT F 1700.7 grid | A real Word table with merged cells, on its own page |
| — | A `TOC \o "1-2" \h \z \u` **field**, so Word builds the contents itself |
| `<h2>` / `<h3>` / `<h4>` | Heading 1 / 2 / 3, with section numbers injected from a section-id map |
| `.prose-tny p` and `li` | `TNYBody` / `TNYBullet`, with HTML indentation whitespace stripped |
| `<strong>`, `<em>`, `.tny-mono` | Bold, italic and Consolas runs — inline formatting is preserved, not flattened |
| `table.tny` plus `<caption>` | Word table, `Table Grid`, brand-colored borders, shaded header and total rows, caption as a styled paragraph above |
| `figure` plus `figcaption` | Centred image at 6.3in plus caption paragraph, `keep_with_next` on the image |
| a grid of `.tny-card` stat cards | A two-column Word table; the big number becomes 20pt bold, so the figures keep their prominence without CSS grid |
| `.tny-card-ink` / `-bone` callouts | Chip becomes a gold small-caps lead-in; body becomes indented `TNYCallout` |
| kickers, rules, layout-only divs | Dropped |

It also defines the paragraph styles (`TNYBody`, `TNYBullet`, `TNYLead`, `TNYCell`,
`TNYTableCaption`, `TNYFigCaption`, `TNYCallout`), restyles Heading 1–3 to the brand, sets Letter
size with 1in margins, and adds a footer carrying the report title and a `PAGE` field.

### Adapting it

Change `SRC` / `OUT`, the colour constants, and the class names in `emit_node()`. The section walker
is driven by `<section id>` values; update `SECTION_NUMBERS` and the page-break list.

### What still needs hand work in Word

1. **Update the TOC field** — select it, right-click, Update entire table. The script inserts a note
   saying so; delete the note before sending.
2. **The cover.** The script produces a clean typographic cover. If the agency wants full-bleed art
   behind the title, do that in Word.
3. **Cross-references.** Figure and table numbers are baked into the caption text rather than being
   Word fields. Fine for a deliverable; wrong if the agency wants live cross-references.
4. **Page breaks.** The script breaks before each top-level section. Check for orphaned headings and
   over-long tables.
5. **The PDF** comes from Word rather than the browser, so that pagination matches the print copies.

### Sanity-check the output

```python
from docx import Document
d = Document(path)
print([p.text for p in d.paragraphs if p.style.name == 'Heading 1'])
print('words:', sum(len(p.text.split()) for p in d.paragraphs)
                + sum(len(c.text.split()) for t in d.tables for r in t.rows for c in r.cells))
print('tables:', len(d.tables), 'images:', len(d.inline_shapes))
```

Confirm that every top-level section is present, that the word count is the right order of magnitude,
and that the image count equals the figure count plus the cover. Non-ASCII rendering as `?` in a
Windows console is a console encoding artefact rather than a document problem — check `repr()` before
chasing it.

## 6 · Checklist

- [ ] Required organization located in the contract and followed (or deviation noted).
- [ ] Every number in the fact ledger with a source; every published figure names its basis.
- [ ] Absences stated: not-built, not-computed, not-captured, not-drawn.
- [ ] Task-by-task accounting, one line per contract task.
- [ ] "What is not done" table with *blocked on* for each row.
- [ ] Successor-scope commitments separated from your own recommendations.
- [ ] Contract-mandated extras: one-page summary, final presentation, hard copies, any required
      technical recommendation (e.g. server/hosting).
- [ ] Executive summary works lifted out on its own.
- [ ] Every figure is a real capture with a state-naming caption and a resolving path.
- [ ] Tag balance verified; page rendered and scrolled end to end.
- [ ] Print stylesheet present; card grids stack; tables are real tables.
- [ ] Review-notes block at the end of the draft.
- [ ] If the author has prior reports: voice profile built, and the voiced version written as a
      separate file with the draft retained.
- [ ] First-person count is zero, if the profile calls for institutional third person.
- [ ] Word document: TOC field present, headings numbered, every figure embedded, tables are real
      tables, and word count and image count verified against the HTML.
