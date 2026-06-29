# DMS — Product Positioning (v2)

> Consolidates `positioning.md` (v1) + `macwright-essays-notes.md` + the
> OSS-plus-hosted shift. v1 is preserved alongside; this file supersedes
> it for any new work. Where v1 made a recommendation that v2 reverses,
> the v2 version wins.

---

## 0. The pitch (read this first)

### Headline

> **The shape of your data is the shape of your site.**

### Sub-line

> *DMS is one rich representation — typed rows that can be a page, a
> section, a dataset, a query, or a theme — that every part of the
> system composes against. Open-source and self-hostable, or run it as
> a hosted service. Like Excel for the model. Like WordPress for the
> distribution.*

### One paragraph

> Pages, data tables, charts, and maps in DMS aren't four products glued
> together — they're four ways of rendering the same row. That one
> representation is what lets a non-technical author and a platform
> engineer ship in the same tool, against the same data, with no seam
> between content and analytics. Open-source for teams who want to own
> their stack; hosted for teams who just want a site.

That's the elevator. Everything below explains why this is the right
framing, who it speaks to, and what to call it.

---

## 1. The two analogies (this is the new core idea)

The product is hard to compare to anything in its own category, so it
should be compared to two things in *other* categories. The pair, taken
together, is what makes the pitch land.

### Excel — the **technical** analogue (what the product is)

From Tom Macwright's [*One way to represent things*][1]: Excel's power
isn't its formula language. It's that it has only sheets, columns, rows,
and cells. The leverage is in the **datatype**, not the syntax. Every
tool that wants to compose with Excel composes against that one shape.

DMS works the same way. There is exactly one datatype — a row in
`data_items`, typed with the scheme `{parent}|{instance}:{kind}`. Sites,
themes, patterns, pages, sections, datasets, views, columns, filters,
and joins are all that same row, distinguished only by their type
string. Card, Spreadsheet, Graph, Map, and rich text are not five
products; they are five ways of rendering rows. A "join" is two rows
referencing each other. A "theme" is a row whose data is style. A
"page" is a row whose children are sections, which are rows.

That's why a site builder and a data platform and a mapping tool can be
the same product without seams — there is nothing to seam *between*.

The closest intellectual parallel isn't Notion-meets-Tableau. It's
**Excel for the post-web stack**. That framing puts DMS in a tradition
engineers and analysts already respect, and it sidesteps the trap of
comparing on feature lists (which DMS would lose to any dedicated
competitor).

### WordPress — the **distribution** analogue (how you get the product)

DMS ships as open-source software that anyone can run themselves, and
as a hosted service for teams that don't want to run a server. The two
paths are the same product; the rows are interchangeable between them.

That's the WordPress model — `wordpress.org` for technical operators,
`wordpress.com` (and a whole ecosystem of managed hosts) for the long
tail of users who just want a site. WordPress runs about 40% of the
web because of this dual model. The OSS root creates trust,
portability, and a real plugin ecosystem; the hosted layer captures the
people who'd never run a server.

DMS is positioned the same way:

- **OSS-and-self-hostable** for the technical operator who wants
  ownership, no per-seat fees, and the ability to extend the platform.
- **Hosted service** for the operator who wants a polished site and is
  willing to pay for convenience.
- **Migrate either direction** — because the row format is the row
  format, regardless of who's hosting.

That last property is the **commercial form** of the representation
argument. Portability isn't a curiosity in a developer docs page; it's
the migration story between hosting paths, and it's only credible
because there's one clean representation under everything.

### Why the pair works

- **Excel** gives credibility on the technical side: representation
  primacy, composability, ecosystem leverage.
- **WordPress** gives credibility on the commercial side: real OSS,
  real portability, real ecosystem, real hosted-product muscle, real
  enterprise paths.
- Either analogy alone undersells the product. Together they describe a
  thing nothing else in the data / dashboard / CMS space credibly is.

[1]: https://macwright.com/2021/02/23/one-way-to-represent-things

---

## 2. What you actually get (the surfaces)

Once the framing is established, the feature list becomes easy. The
surfaces aren't the product — they're what the one representation can
be rendered as.

| Surface | What it does | Built from |
|---|---|---|
| **Page builder** | WYSIWYG on-canvas authoring of pages composed of section components, draft/publish workflow, hierarchical URL routing, per-page permissions, deep theming. | Section rows, theme rows, pattern rows, page rows. |
| **Data app builder** | Sections bound to data sources (internal datasets, external Postgres, joined sources). Typed, filterable, sortable, aggregable columns. URL-synced filters parameterise pages. | Source rows, view rows, column JSON on section rows, filter trees. |
| **Analytics & dashboards** | Bar / Line / Pie / Scatter / Grid graphs, pivots, computed columns, joins across sources, inline filters, exports. | Same as above; "graph" is a renderer over the same column + row config. |
| **Mapping** | MapLibre GL map sections with symbology, layer styling, filter controls, geo-aware columns, PMTiles, dedicated map editor pattern. | Same; "map" is another renderer with geo metadata on columns. |
| **Rich text + collab** | Lexical editor, Yjs real-time collaboration, Markdown-flavoured authoring. | Lexical JSON stored on a section row. |
| **Local-first sync** | SQLite-in-the-browser via wa-sqlite + IndexedDB, WebSocket delta sync. Opt-in per site. | Same rows; client-side mirror. |
| **SSR** | Same `App.jsx` serves SPA and SSR. | Routing reads the same rows server- or client-side. |
| **Headless CLI** | First-class CLI for content ops, exports, bulk edits, dataset queries. | Talks to the same Falcor graph the UI uses. |
| **Plugin extensibility** | Themes, section component types, column types, datatype plugins — all register against the platform without modifying it. | Constrained extensibility: every extension speaks the row format. |

The same engine drives `wcdb.fm` (radio station), `MitigateNY` (state
hazard planning), `NPMRDS` (federal transportation analytics), and the
AVAIL docs themselves. They differ only in data.

---

## 3. Audiences — three buyers, two front doors

The dual-distribution model implies three distinct buyers. The homepage
should put two of them through clearly marked doors; the third is sales-
qualified.

### Three buyers

| Buyer | Wants | Path |
|---|---|---|
| **Hosted user** (the long tail) | A polished site or dashboard, no servers to maintain, predictable pricing. | Hosted product. Self-serve sign-up, templates, gallery. |
| **Self-host operator** (the technical solo / small team / civic IT) | Data sovereignty, no per-seat fees, full control, the ability to extend. | OSS download, `docker compose up`, "fork wcdb.fm" starter. |
| **Institutional / enterprise** (gov, large org, regulated industry) | Self-host with paid support, on-prem deployment, SSO, custom development. | Sales-led. Hosted-on-our-infra. SLA. |

### Two front doors on the homepage

WordPress.org and WordPress.com having distinct front doors is part of
why the model worked. Both audiences see themselves immediately. DMS
should do the same:

- **Use the hosted version** → SaaS sign-up, pricing, templates
- **Host your own** → GitHub, docs, `docker compose` quick-start

The institutional buyer is reached via the OSS path *plus* a "Talk to
us" / Enterprise page. They start at the OSS door (they need to verify
the code and architecture exist) and convert through sales.

### The dual-author point still holds, and is now sharper

The original positioning doc's strongest single line was:

> *The same product non-technical users author on, technical users
> extend. An analyst building a dashboard and an engineer shipping a
> new column type are working in the same place, in the same
> vocabulary, on the same data.*

Under the OSS-plus-hosted model, that becomes: the **same product**,
the **same row format**, the **same plugin contract**, regardless of
who's hosting. A plugin written against a self-hosted instance runs
against the hosted instance. A site authored on the hosted instance
can be exported and run self-hosted. The vocabulary really is one
vocabulary — not just within a session, but across the entire
deployment topology.

That's the line nothing else in the market can credibly say.

---

## 4. Proof-points

These come straight from existing sites. They're real, they ship, and
each illustrates a different selling point.

| Site | What it proves | Use as |
|---|---|---|
| **wcdb.fm** | College radio station with live schedule joined to DJ profiles, ACRCloud song-tracking, audio archive. Theme is not a "dashboard" theme — it looks like a designed website. | "DMS is not just for data sites — this is a real radio station's home page." |
| **MitigateNY** | NYS hazard mitigation planning: hundreds of pages, datasets per county, structured permissions across stakeholders. | "DMS scales to multi-stakeholder government workflows." |
| **NPMRDS / TransportNY** | Federal-grade transportation analytics: massive datasets, MAP-21 calculation pipelines, custom datatype plugins. | "DMS handles billion-row datasets when you extend it." |
| **AVAIL docs** | The library's own documentation. | "DMS documents itself." |

The four cover the four primary surfaces (content site, multi-page CMS,
analytics-heavy, technical docs) without anyone having to say "four
products in one." The variety speaks.

Under the OSS-plus-hosted shift, each of these also implicitly proves a
**migration story**: the same engine ran these very different sites
because the row representation is the same. That's the portability
promise made concrete.

---

## 5. What not to lead with

Updated and tightened from v1 — most of the old "don't say this" list
still applies; a couple of new traps are added.

- **"No-code platform."** Wrong axis. The axis is *representation-first
  vs. configuration-on-code*. "No-code" puts DMS in the
  configuration-on-code bucket where it loses to Webflow on polish and
  Retool on integrations. Drop the term entirely.
- **"Open-source Notion."** Notion is a personal knowledge tool with a
  database side-car; DMS is a data platform with a page side-car. Also
  signals "small / hobbyist" — undersells the analytics + map surfaces.
- **"Internal tool builder."** Right for Retool, wrong for DMS. Many
  DMS sites are public-facing (wcdb.fm, NPMRDS public dashboards).
- **"Headless CMS."** Misleading — DMS is very much headed; the
  rendering is core. The CLI is *a* feature, not the category.
- **"Data Management System."** Generic — Oracle and SAP claim the
  same name. Drop it for the public product even if the codebase keeps
  the acronym.
- **"Infinitely flexible / extensible."** Macwright is right that this
  is a tell of bad design. Pitch *constrained* extensibility: new
  section types, column types, datatype plugins, all operating on the
  one row representation. The constraint is the feature; flexibility
  without a shared representation is the trap.
- **"Clean start for the web."** Even with OSS, DMS is built on React +
  Postgres + Falcor — exactly the stack Macwright would put in the
  "stumble into React with GraphQL" bucket. The honest framing is
  *representation-primacy applied to a modern stack*, not first-
  principles purism. Don't sound like a manifesto.

---

## 6. Names — alternatives to "DMS"

"DMS" has the same three problems as in v1 (generic, acronymic,
internal-ese). The candidate list is updated below in light of:

- The **representation-primacy** framing (favours names that evoke
  composition / shared form / the one thing everything else builds on).
- The **WordPress lineage** (favours humble, thing-shaped names — not
  platform-shaped names).

### Naming criteria (updated)

The right name should:

1. Evoke either **the shared form** (Excel-style) or **the thing you
   make** (WordPress-style). Either is good; pick one bias.
2. Survive both content-y uses (wcdb.fm) and data-y uses (NPMRDS).
3. Be a real English word, ideally short (≤2 syllables).
4. Have a near-dotcom available.
5. Not collide with a well-known SaaS in an adjacent space.
6. Read well in both halves of the marketing: "Get [X] hosted" and
   "Install [X] yourself."

### Tier 1 — strongest fits

- **Lingua.** From Macwright's "lingua franca" usage for pandas — *the
  shared shape that everything else speaks*. Two syllables, evocative,
  basically unused in the tech-product space. Pairs naturally with both
  audiences ("Lingua hosted" / "Install Lingua"). Worth a serious
  trademark / domain pass — this is the candidate I'd put first now.
- **Plat.** Cartographic / civic term (a "plat" is a map of a parcel
  of land). Short, sharp, uncrowded. Slight risk that users don't know
  the word — but that's also brand differentiation. Still strong, was
  Tier 1 in v1.
- **Tessera.** A tile in a mosaic — composition metaphor lands
  perfectly with the "everything is a section" story. Still Tier 1.

### Tier 1.5 — the WordPress-humble lineage (new in v2)

WordPress's own name is deliberately humble ("Word" + "Press"). It
sounds like a thing you make, not a platform you use. With the
OSS-plus-hosted shape, names in this vein become viable:

- **Folio.** A book or portfolio. Implies authored content, document-
  shaped output. Pairs well with both surfaces.
- **Ledger.** Implies typed rows, accountability, durability. Reads
  more data-app than content, which biases the framing — pick if the
  data-app surface is the primary buyer.
- **Stack.** Composability, layering. *Risk:* Stack Overflow,
  StackBlitz, every "developer stack" tool ever.
- **Slate.** Clean canvas + publishing connotation. Still has multiple
  existing uses; needs a modifier.
- **Paper.** Implies document-output. *Risk:* Dropbox Paper. Probably
  unusable.
- **Plot.** Cartographic + analytical double meaning. Short. *Risk:*
  too narrow (sounds like graphs only) and Observable Plot exists.

### Tier 2 — directionally right, used in v1, still viable

- **Atlas / Atlas Studio / Atlas Works.** Maps + composed-knowledge +
  civic. Crowded as a bare word; the qualified versions still work and
  now have a better intellectual defense (an atlas is one shared
  representation hosting arbitrary content). Safe fallback.
- **Compose / Composer.** Direct hit on the value prop; Docker Compose
  owns the term.
- **Lattice, Loom, Substrate, Manifold, Field, Sheaf, Codex.** All
  evaluated in v1; same caveats apply.

### Recommendation

Two finalists worth a real trademark + domain pass:

1. **Lingua** — the bet on representation primacy + a short, evocative,
   uncrowded word. Strongest with the Excel framing.
2. **Folio** — the bet on the WordPress-humble lineage; sounds like the
   *thing you make*, not the platform. Strongest with the WordPress
   framing.

If neither clears: **Plat** (v1's preferred) or **Atlas Studio** as
safe fallbacks. Keep `@availabs/dms` as the package name and CLI name
regardless — switching the product brand doesn't require renaming the
library.

---

## 7. Open questions

Decisions that shape the launch. Some have new urgency under the
OSS-plus-hosted model.

- **License.** MIT? Apache 2? AGPL? AGPL closes the loophole where a
  competitor takes the OSS and runs it as a hosted service against us
  (the Elastic / MongoDB problem); MIT/Apache maximises adoption.
  This is a *commercial* decision, not just a legal one.
- **Repo split.** Does the OSS repo include the hosted-only billing /
  multi-tenancy bits, or are those a private layer? WordPress.org and
  WordPress.com share a kernel and diverge above it.
- **Hosted pricing model.** Per-site? Per-seat? Per-row? The single
  `data_items` table architecture makes per-app namespacing trivially
  meterable — per-app or per-site likely wins. WordPress.com tiers on
  features + traffic; that's a viable structural model.
- **The on-ramp.** A blank site is a hard place to start. Templates?
  Gallery? "Fork wcdb.fm"? `dms-template` is close to a starter — does
  it need a UI for non-technical users?
- **Plugin marketplace.** WordPress's plugin ecosystem is the flywheel.
  DMS already has the technical infrastructure (theme + component +
  datatype plugins, all speaking the one row format). The question is
  whether to ship a marketplace from day one or grow into it.
- **First paying customer.** Existing sites are proof-points, but a
  named first paying hosted customer + a named first paying OSS-with-
  support customer would let the marketing speak to specific buyers
  instead of categories.
- **The acronym.** Even after rename, the docs and CLI say DMS. Is
  there an in-product "marketing name vs. tool name" split (like
  "Notion" the product vs. "the Notion API"), and how do those play
  together?

---

## 8. The intellectual lineage (for the "Theory" page)

A short page that engineers, analysts, and thoughtful evaluators will
read after the homepage. Not the homepage itself.

The two essays that explain why DMS is shaped the way it is:

- **[*One way to represent things*][1]** — Tom Macwright, 2021. The
  argument that systems get their power from a shared representation,
  not from clever syntax. Excel, pandas, Max/MSP. *"There's so much
  energy put into visual programming or functional programming so
  that we can 'connect things,' but not nearly as much time spent on
  what those things are."*
- **[*A clean start for the web*][2]** — Tom Macwright, 2020. The
  argument that complexity accumulated on top of complexity doesn't
  simplify. Useful as cover for the OSS / portability half of the
  pitch, and for the one borrowable line:
  *"You cannot get a simple system by adding simplicity to a complex
  system."* — Richard O'Keefe, via Macwright.

The DMS theory page would be one paragraph each: Macwright on
representation primacy, then "this is how DMS is built"; Macwright on
the document/application split, then "this is why OSS-plus-hosted
matters." Two paragraphs, two links, no manifesto. The thoughtful 5%
of visitors who land on it will recognise the lineage; nobody else
will be slowed down.

[2]: https://macwright.com/2020/08/22/clean-starts-for-the-web

---

## Appendix — copy lines ready to drop in

Updated for v2.

- *"The shape of your data is the shape of your site."*
- *"One representation. Many renderings. Pages, data tables, charts,
  and maps that all read from the same row."*
- *"Like Excel for the model. Like WordPress for the distribution."*
- *"Built for the team where the analyst and the engineer ship in the
  same tool, against the same data, with the same vocabulary."*
- *"Self-host it. Or let us host it. Either way, the rows are yours."*
- *"For when Notion is too thin, a SaaS dashboard is too rigid, and a
  webapp is too much."*
- *"A radio station, a state government, and a federal traffic
  analytics platform run on the same code. The difference is just
  data."*
- *"Constrained extensibility: new section types, column types, and
  datatype plugins all speak the one row format. The constraint is
  what makes the ecosystem possible."*
- *"You cannot get a simple system by adding simplicity to a complex
  system."* — Richard O'Keefe, via Tom Macwright.

---

## What changed from v1 (changelog)

For anyone reading both side by side:

- **Headline reversed.** v1 led with "Build interactive, data-driven
  sites…" (the "operational atlas" pitch). v2 leads with "The shape of
  your data is the shape of your site" — the representation-primacy
  claim. The v1 headline is now a sub-pitch suitable for the civic /
  government audience but not the master frame.
- **Two analogies added.** v1 implicitly framed DMS by listing four
  product surfaces. v2 frames it by analogy: Excel for the model,
  WordPress for the distribution. The four-surfaces table moves below
  the framing and becomes "what you actually get" rather than the
  pitch.
- **Three audiences instead of two.** v1 had Author / Engineer. v2 has
  Hosted user / Self-host operator / Institutional. Driven by the
  OSS-plus-hosted launch shape.
- **Two front doors on the homepage.** New recommendation: don't try to
  unify the messaging — fork the path clearly, WordPress.org-style.
- **Names refreshed.** v1's Tier 1 (Plat, Tessera, Atlas) preserved but
  reordered. **Lingua** added and pushed to first place (from the
  Macwright pandas-as-lingua-franca usage). A new "WordPress-humble"
  tier added (Folio, Ledger, Slate, Stack) to fit the OSS-plus-hosted
  framing.
- **"No-code" explicitly dropped.** v1 mentioned it as a trap; v2
  drops it from the vocabulary entirely. The axis is
  representation-first vs. configuration-on-code.
- **"Constrained extensibility" replaces "extensibility."** New
  language to avoid the "infinitely flexible" trap Macwright warns
  about.
- **Theory page proposed.** A short, two-paragraph intellectual
  lineage page citing the two Macwright essays. Not the homepage —
  the page the most thoughtful 5% of evaluators will read after.
- **Launch-shape questions added.** License (MIT vs. AGPL), repo
  split, pricing model, plugin marketplace timing — all surfaced as
  open questions newly load-bearing under the OSS-plus-hosted model.
