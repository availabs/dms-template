# Notes on the two Macwright essays

Working notes on whether *One way to represent things* (Feb 2021) and *A
clean start for the web* (Aug 2020) sharpen the positioning of DMS. The
short version: **the first essay is a direct hit** — it gives a name to
the property we were already trying to sell, and a built-in analogy that
non-technical audiences understand. The second essay is intellectually
adjacent, useful for credibility and tone, but **not** a frame to lead
with. Details below.

---

## Essay 1 — *One way to represent things*

### What Macwright actually argues

The energy in programming goes into syntax, control flow, and connecting
things — but not nearly enough into *what those things are*. Powerful
systems are powerful because they constrain to one good **representation**
and let an ecosystem of tools compose against it.

His examples are exactly the ones DMS lives between:

- **Excel** is powerful "not because formulas are simple, but because it
  has only sheets, columns, rows, and cells." The leverage is the
  datatype, not the language.
- **Pandas dataframes** are the lingua franca that makes the Python data
  ecosystem possible — seaborn, scikit-learn, statsmodels all compose
  because they speak the same shape.
- **Max/MSP and Pure Data** succeed at visual programming because their
  atoms are homogeneous. Visual programming attempts that allow arbitrary
  objects fail because there's no shared shape to wire together.
- His counter-examples (HTML DOM vs. plain objects, colors as
  arrays-vs-objects-vs-classes) are systems that *didn't* converge on one
  representation and pay for it forever.

His one-line claim: **"There's so much energy put into visual programming
or functional programming so that we can 'connect things,' but not nearly
as much time spent on _what those things are_."**

### Why this is the right frame for DMS

The original positioning doc already made the right observation — "the
page is data, not code" — but framed it as a *novelty*. Macwright lets us
upgrade it from a curiosity to a **category claim**: DMS is what you get
when you take representation primacy seriously and build a website /
data-app / analytics / mapping platform around a single typed
representation.

The mapping is one-to-one:

| Macwright's point | DMS equivalent |
|---|---|
| Excel: sheets / columns / rows / cells | DMS: `data_items` rows typed `{parent}|{instance}:{kind}` |
| Pandas: one dataframe shape, many tools compose | One row shape; Card + Spreadsheet + Graph + Map + Lexical all compose against it |
| Max/MSP: homogeneous atoms enable visual programming | Section components are visual programs over rows; works because every section speaks the same shape |
| HTML DOM / colors: failed convergence → fragmented ecosystems | The "four products glued together" trap most competitors fall into |

The product is closer to **Excel for the post-web stack** than it is to
Notion-meets-Tableau. That framing is sharper, harder to argue with, and
puts us in conversation with a tradition that engineers and analysts
already respect.

### Concrete edits to suggest for the positioning doc

**Headline candidate (new tier 1):**

> **The shape of your data is the shape of your site.**
>
> DMS is one rich representation — typed rows that can be a page, a
> section, a dataset, a query, a theme — that every part of the system
> composes against. Like Excel, the leverage is in the datatype, not
> the language.

**Sub-line candidate:**

> *A canvas where pages, data tables, charts, and maps are just
> configured representations of the same row. Connect them with a
> filter, a join, or a layout — never a script.*

**A new short paragraph in §1 (the novelty section):**

> The closest intellectual parallel is Excel — not in the spreadsheet
> sense, but in the *representation-primacy* sense Tom Macwright
> articulates in [*One way to represent things*][1]. Excel's power
> isn't its formula language; it's that it has only sheets, columns,
> rows, and cells. Every tool that wants to compose with Excel composes
> against that one datatype.
>
> DMS works the same way. It has one datatype: a typed row in
> `data_items`. Sites, themes, patterns, pages, sections, datasets,
> views, columns, filters, and joins are all that same row,
> distinguished only by their type string. Card, Spreadsheet, Graph,
> Map, and rich text are not five products; they are five ways of
> rendering rows. That's why a site builder and a data platform and a
> mapping tool can be the same product without seams.

[1]: https://macwright.com/2021/02/23/one-way-to-represent-things

**Replace a weak elevator-pitch line:**

The current "everything is a section" pitch (variant D in §3) is the
right *editing* claim but the wrong *category* claim. Swap in
representation primacy as the category claim and keep "everything is a
section" as the experiential one underneath it.

### One caveat

Macwright's argument is implicitly *anti-extensibility-as-marketing* —
he's skeptical of systems that brag about being "infinitely flexible"
because flexibility without a shared representation produces ecosystems
that can't compose. **Do not** pitch DMS as "infinitely extensible."
Pitch it as "extensible *because* there's one shape" — extensions
register new section types, new column types, new datatype plugins, but
they all operate on the same row representation. That's the
Macwright-consistent version and it's also the truthful one.

---

## Essay 2 — *A clean start for the web*

### What Macwright actually argues

The web has accumulated decades of layered complexity, the document and
application use cases have been conflated to the detriment of both, and
the right move is a deliberate, *incompatible* fresh start — a Document
Web (Markdown-rendered in a small lightweight browser) and an
Application Web (Wasm + native UI). His three rules: don't subset the
old; don't keep compatibility; deliver clear benefits to creators,
consumers, and technologists.

The line worth remembering: **"You cannot get a simple system by adding
simplicity to a complex system."** (He's quoting Richard O'Keefe.)

Also good: *"It's easier to stumble into building your résumé in React
with GraphQL than it is to type some HTML in Notepad."*

### Why this is *adjacent* to DMS but not the lead frame

The "clean start" essay is a manifesto **against platforms**. DMS *is* a
platform. Leading with this essay's frame puts us in conversation with
Beaker, dat, the IndieWeb — communities that are intellectually
sympathetic but that buy nothing, are tiny, and that treat any platform
(even ones with the right values) as a compromise.

The essay's diagnoses are useful background. They support a stance like:

- The four-tools-glued-together default (Notion + Airtable + Tableau +
  Felt) is the "stumble into React with GraphQL" problem — for
  data-driven sites. DMS lets you not have to.
- The "you cannot simplify a complex system by adding simplicity" line
  is exactly why we don't position DMS as a plugin layer on top of
  Notion, Webflow, or Retool. The simplification has to be the *root*,
  not a wrapper.
- "Standards as liberation" → portability. The fact that a DMS site is
  just rows you can copy is the same value proposition Macwright assigns
  to Markdown, RSS, and dat.

But none of those land as a headline. They're paragraph 4 of an essay,
not the homepage.

### What to actually take from it

A **tone**, not a frame. Macwright writes like someone who's earned the
right to be skeptical — he's not a manifesto-bro, he's just specific.
The DMS site copy should sound like that. Specific examples (wcdb.fm,
MitigateNY) over slogans. Concrete properties ("one row format, four
rendering surfaces") over adjectives ("powerful, flexible, modern").

One sentence worth borrowing, with attribution if it ends up in a deck:

> **"You cannot get a simple system by adding simplicity to a complex
> system."** — Richard O'Keefe, via Tom Macwright

That's the line for the slide where we explain why DMS isn't a Notion
plugin / Webflow integration / Retool template.

---

## Suggested edits, in priority order

1. **Promote representation primacy to the §1 headline** of the
   positioning doc. Use the Excel analogy explicitly. This is the single
   biggest sharpening available from the two essays.

2. **Reframe the §3 pitch options.** The current four pitches all work
   *after* the visitor already believes the product exists; a
   representation-primacy lead does the believing-it-exists step in one
   sentence. Promote it to pitch A; demote the current pitch A
   ("operational atlas") to a secondary tagline for the civic /
   government audience.

3. **Add a "Why this works" / "Theory" section** that cites Macwright
   for the representation-primacy argument. Two paragraphs, link the
   essay. Engineers and analysts who land on it will recognize the
   tradition; nobody else will be slowed down. The site doesn't need to
   be a manifesto, but having one paragraph of theory available is what
   converts the most thoughtful 5% of visitors.

4. **Re-examine the candidate names with the new frame.**
   - **Plat** and **Tessera** both still fit — they're composition /
     representation words.
   - **Atlas** is still crowded but now has a better intellectual
     defense (an atlas is one representation that hosts arbitrary
     content, like a row format).
   - **A new candidate: Lingua.** Macwright's "lingua franca" usage for
     pandas suggests this. *Lingua* — "the shared shape that everything
     else speaks." Two syllables, evocative, basically unused in the
     tech-product space. Worth a trademark/domain pass.

5. **Drop "no-code" / "low-code" from the vocabulary entirely.**
   Macwright's argument makes it clear these are the wrong axis. The
   axis is *representation-first vs. configuration-on-code*. DMS is the
   first; Webflow / Retool / Notion are the second; saying "no-code"
   puts us in the second bucket.

---

## What not to do

- Don't write the homepage in Macwright's voice. He writes for a
  pre-existing audience that respects him. DMS doesn't have that yet;
  the homepage has to do its own credibility work first (with the
  wcdb.fm / MitigateNY proof-points), and only then earn the right to
  philosophize.
- Don't claim "clean start" provenance. DMS is not a clean start — it
  uses React, Postgres, Falcor, all of which Macwright would probably
  put in the "stumble into React with GraphQL" bucket. The honest claim
  is "representation-primacy applied to a modern stack," not "clean
  start from first principles."
- Don't pitch infinite extensibility. Pitch *constrained* extensibility:
  new section types and column types and datatype plugins, all
  operating on the one row representation. The constraint is the
  feature.
