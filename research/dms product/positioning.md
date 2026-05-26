# DMS — Product Positioning Notes

A working document exploring how to talk about DMS as a product: what it is,
who it's for, how to describe it in one sentence vs. ten, where it sits in the
market, and what to call it.

These notes are written from a read of the code (not marketing copy) — so the
claims here track to actual capabilities in the repo, not aspirations. Where
something is partly built or differs by site, it's flagged.

---

## 1. What DMS actually is

Reading the codebase from the outside, DMS is **four products glued into one
platform by a single data model**:

| Surface | What it does | Comparable to |
|---|---|---|
| **Page builder** | WYSIWYG, on-canvas authoring of pages composed of section components (rich text, cards, headers, filters, layouts). Draft/publish workflow. Hierarchical URL routing. Permissions per page. Themeable to the point of being re-skinnable. | Notion, Webflow, Framer, WordPress + Gutenberg |
| **Data app builder** | Sections can bind to data sources (internal datasets, external Postgres via DAMA, joined sources). Columns are typed, filterable, sortable, aggregable, group-able. Spreadsheet, Card, and Graph sections render the same data in different shapes. Filters can sync to URL params so pages become parameterised. | Airtable, Retool, Tooljet |
| **Analytics & dashboards** | Bar / Line / Pie / Scatter / Grid graphs, pivots, computed columns, formula columns, joins across sources, inline filters, exports. | Tableau, Power BI, Looker Studio |
| **Mapping** | MapLibre GL based map sections with symbology, layer styling, filter controls, geo-aware columns, PMTiles support, a dedicated map editor pattern. | Felt, Mapbox Studio, ArcGIS Online |

Everything above runs in the same React app, configured by the same database
rows, edited from the same canvas, and styled by the same theme system. That
*combination* is the product; no single one of those surfaces is the headline.

### The novelty — "the output is data, not code"

The architectural property worth selling is this: **every artifact a user
creates is a row in a single typed table.** A site, a theme, a pattern, a page,
a section, a dataset definition, a view, a data row — all of them live in
`data_items` distinguished only by their `type` string
(`{parent}|{instance}:{kind}`). See `src/dms/CLAUDE.md`.

The runtime is a thin React app that reads those rows, looks up registered
component types in a plugin registry, and renders. There is no per-site code,
no per-page template file, no per-dashboard JSX. A new section is data; a new
theme is data; a join configuration is data; a filter tree is data; even the
component the section instantiates is named by a string in data.

What this means in practice:

- **A site is portable** — copy the rows, you have copied the site. Backups,
  migrations, environment promotion, and forking become straightforward.
- **Authoring and "developing" sit on the same gradient** — non-technical users
  add a section through the UI; technical users add a new section *type* (a
  plugin) and now everyone can add that section through the UI.
- **The same engine drives wildly different sites** — `wcdb.fm` (a college
  radio station), `MitigateNY` (state hazard-mitigation planning), `NPMRDS`
  (federal transportation analytics), all run the same code, differ only in
  data.
- **A page is a query and a layout in one document** — there is no separate
  "data layer" the page consumes through an API; the section *is* the query
  configuration, and the query configuration *is* part of the page.

This is what's worth naming: most platforms in this space are configuration
applied to code. DMS is closer to spreadsheets in spirit — the user is
producing a document, and the document is the program.

### What's deeper than it looks

- **Datatype plugins.** External devs can drop a folder under `data-types/`,
  add server-side workers + routes and client-side React pages, and extend the
  platform with whole new kinds of data (FHWA MAP-21 metrics, FEMA NFIP claims,
  ACRCloud webhook ingest, custom ETL). See `data-types/CLAUDE.md`.
- **Theme system.** Every UI primitive has a `*.theme.{js,jsx}` sibling with
  named styles and an `activeStyle` selector. A site can be re-skinned without
  forking code — the wcdb, transportny, mitigateny, and avail themes are all
  doing exactly this. See `packages/dms/CLAUDE.md` "Theming" section.
- **Component plugins.** `registerComponents()` lets a downstream site add new
  section types without modifying the library. The registry is module-level
  mutable; the section resolves by string lookup. See
  `patterns/page/component-overview.md`.
- **Local-first sync.** SQLite-in-the-browser via wa-sqlite + IndexedDB,
  WebSocket delta sync, Yjs/Lexical real-time collaborative rich-text editing.
  Opt-in per site via `VITE_DMS_SYNC=1`. See `documentation/sync.md`.
- **Cross-source joins.** Sections can join DMS↔DMS, DAMA↔DAMA, and DMS↔DAMA
  with a single JSON config; the server figures out whether each side is JSONB
  or columnar and emits the right SQL. (Recent work, partly contingent on a
  server redeploy — see `references/wcdb-card-creation.md`.)
- **SSR.** Same `App.jsx` serves SPA and SSR, depending on a flag. Important
  for marketing pages and for SEO on public-facing sites.
- **CLI.** A first-class CLI for headless content operations — dumping pages
  and sections, bulk-editing, exporting datasets. See
  `packages/dms/cli/docs/`.

---

## 2. The positioning problem

The "four products in one" framing is the strength and the trap. **Almost no
user cares about all four.** Listing them gets you a feature comparison the
product loses to dedicated tools every time:

- A user shopping for a page builder compares to Webflow — and Webflow has
  better polish, integrations, and templates.
- A user shopping for data apps compares to Retool — and Retool has better
  forms, more SaaS integrations, and a mature marketplace.
- A user shopping for analytics compares to Tableau / Power BI — and those
  have better visualization breadth and statistics.
- A user shopping for maps compares to Felt — and Felt has better geo-data
  ingest and a smoother map authoring experience.

DMS loses each of those head-to-head fights. **It wins on the gestalt:** what
happens when one product can do all four against the same data, with the same
authoring model, edited on the same canvas, by the same team.

**The positioning has to make the gestalt visible.** The product can't be
"page builder *and* data app *and* analytics *and* maps" — that's an item list.
It needs to be a category-of-one phrase that absorbs all four.

---

## 3. Candidate one-sentence pitches

Ranked by how well they collapse the four surfaces into one idea, with notes
on who they aim at.

### A. The "operational atlas" pitch
> **Build interactive, data-driven sites — pages, dashboards, and maps — that
> all read from the same data and look like one product.**

- Concrete, specific, and names the three deliverables (pages, dashboards,
  maps) as one output.
- Avoids "platform" / "CMS" / "no-code" — all overloaded terms.
- Aims at: orgs that have data and need to publish it (government, civic, ops,
  research) — the established DMS user.

### B. The "data is the document" pitch
> **A canvas where pages, data tables, charts, and maps are all just sections
> on the page — and the page itself is data, not code.**

- Sells the novelty (data-not-code) instead of the features.
- The "canvas" framing nods at Notion-style WYSIWYG flexibility.
- Aims at: technical leaders who'd find that property valuable (extensibility,
  portability, forkability).

### C. The "extensible site, no fork" pitch
> **A site builder for teams who outgrow Notion and Airtable but don't want to
> write a webapp.**

- The "outgrow Notion/Airtable" framing is the clearest way to draw a market
  boundary. People who hit the ceiling of those tools have a real, articulated
  pain.
- Implies dev-friendly extension without saying "developer platform."
- Aims at: scaling teams (50–500 people) with internal data, custom needs,
  and a small dev capacity.

### D. The "everything is a section" pitch
> **A WYSIWYG canvas where text, tables, charts, and maps are interchangeable
> blocks that share data, filters, and styling.**

- Sells the *editing experience*, which is the most viscerally novel part for
  first-time users.
- Aims at: end users / authors. The "feels like Notion, but does Tableau and
  Felt" hook.

### Recommendation

For a public launch page, lead with **A** as the headline and use **B** as the
sub-line:

> **Build interactive, data-driven sites — pages, dashboards, and maps — that
> all read from the same data and look like one product.**
>
> *A canvas where pages, data tables, charts, and maps are all just sections
> on the page — and the page itself is data, not code.*

Pitch A gets the visitor oriented in two seconds; pitch B is the "huh, that's
interesting" follow-up that earns the click.

---

## 4. Audience segmentation — who actually buys this

The product has two distinct audiences with two distinct value propositions.
The site should let each see itself without making the other feel ignored.

### A. The author / domain expert (the "Notion + Felt" user)

A planner, analyst, communications lead, researcher, or program manager who
already publishes things — usually in some combination of Google Docs,
Tableau dashboards, ArcGIS Online maps, and a Squarespace marketing site.
They are tired of running four tools and stitching them together.

**What they need to hear:**
- "Everything in one canvas." (Authoring experience.)
- "No CSV exports between tools." (Single data model.)
- "Looks like a real site, not a tool." (Themeing depth — the wcdb theme is a
  good showcase of how un-tool-like a DMS site can look.)
- "Publish, don't deploy." (Draft/publish, hierarchical URLs.)

### B. The platform owner / lead engineer (the "Retool but mine" user)

A tech lead, founding engineer, or solo platform person at an org that runs
internal tools and customer-facing content. They've been told "build us a
data portal" and they don't want to maintain a Next.js app forever.

**What they need to hear:**
- "Drop-in component plugins, drop-in data sources." (Extensibility.)
- "All artifacts are typed rows in one table." (Data model.)
- "Same code runs every site." (Portability.)
- "CLI for headless ops, SSR for marketing, sync for offline." (Infra
  maturity.)

### Why the dual audience is a feature, not a bug

This is the line nothing else in the market can credibly say:

> **The same product non-technical users author on, technical users extend.**
> An analyst building a dashboard and an engineer shipping a new column type
> are working in the same place, in the same vocabulary, on the same data.

That co-location is what makes "outgrow Notion and Airtable" land — those
tools fork into a developer SaaS the moment you need real customization.

---

## 5. Concrete proof-points to put on the site

These come straight from existing sites. They're real, they ship, and they
each illustrate a different selling point.

| Site | What it proves | Use as |
|---|---|---|
| **wcdb.fm** | A college radio station: live schedule joined to DJ profiles, song-tracking via ACRCloud webhook, full audio archive. Theme is *not* a "dashboard" theme — it looks like a designed website. | "DMS is not just for data sites — this is a real radio station's home page." |
| **MitigateNY** | New York State hazard mitigation planning: hundreds of pages, datasets per county, structured permissions across stakeholders. | "DMS scales to multi-stakeholder government workflows." |
| **NPMRDS / TransportNY** | Federal-grade transportation analytics: massive datasets, MAP-21 calculation pipelines, custom datatype plugins. | "DMS handles billion-row datasets when you extend it." |
| **AVAIL docs** | The library's own documentation. | "DMS documents itself." |

These four sites cover the four product surfaces (content site, multi-page CMS,
analytics-heavy, technical docs) without anyone having to say "four products in
one." The variety speaks.

---

## 6. What *not* to lead with

A few common framings that are tempting but will mislead users:

- **"No-code platform."** DMS *can* be used no-code, but the product is
  specifically positioned against the no-code ceiling. Saying "no-code" puts it
  in the wrong bucket and invites comparisons it loses (Webflow has prettier
  no-code).
- **"Open-source Notion."** Wrong shape — Notion is a personal knowledge tool
  with a database side-car; DMS is a data platform with a page side-car. Also
  signals "small / hobbyist" which undersells the analytics + map surfaces.
- **"Internal tool builder."** Right for Retool, wrong for DMS. Many DMS sites
  are public-facing (wcdb.fm, NPMRDS public dashboards). "Internal tool" frames
  the product as admin-panel-shaped, which it isn't.
- **"Headless CMS."** Misleading — DMS is very much *headed*; the rendering is
  a core part of the product. (It does have a headless CLI, but that's a
  feature, not the category.)
- **"Data Management System."** The literal expansion of DMS. Too generic —
  Oracle and SAP are also "data management systems." Drop it for the public
  product even if the codebase keeps the acronym.

---

## 7. Names — alternatives to "DMS"

"DMS" as a product name has three problems:

1. **Generic.** "Document Management System" / "Data Management System" is
   what every enterprise IT vendor in the world calls a folder of PDFs.
2. **Acronymic.** Users have to learn what the letters mean before they
   remember the brand.
3. **Internal-ese.** It's the name a tool gets when only its authors are
   talking about it. Crossing the chasm to "product" usually means picking a
   word.

### Naming criteria

The right name should:

- Evoke the **canvas / composition** quality (the on-page editing).
- Survive both **content-y** uses (wcdb.fm) and **data-y** uses
  (NPMRDS).
- Hint at **maps** without being a maps-only word.
- Be a real English word, ideally a short one (≤2 syllables).
- Have a clean dotcom or near-dotcom available.
- Not collide with a well-known SaaS in an adjacent space.

### Candidate names

Ranked roughly by fit. None are exhaustive on the trademark / domain search
front — those need a separate pass.

#### Tier 1 — strongest fit

- **Atlas.** Maps + composed-knowledge + civic + reference-work. Hits every
  surface. *Risk:* extremely well-used; Atlassian, MongoDB Atlas, etc. Needs a
  qualifier ("Atlas Studio," "Atlas Works"). The metaphor is right even if the
  word is crowded.
- **Plat.** Cartographic/civic term (a "plat" is a map of a parcel of land).
  Short, sharp, *uncrowded* in tech. Pairs naturally with the existing
  "patterns" + "pages" vocabulary. Slight risk that users don't know the word
  — but that's also brand differentiation.
- **Tessera / Tesselate.** A tessera is a single tile in a mosaic.
  Composition metaphor lands perfectly with the "everything is a section"
  story. *Risk:* unfamiliar; "tesselate" is verb-shaped.
- **Slate.** Clean canvas, blank-slate, also the publishing-industry vibe
  (Slate magazine, Vox Media's Slate platform). Implies authoring. Pairs well
  with the rich-text + WYSIWYG side. *Risk:* multiple existing uses; needs a
  modifier.

#### Tier 2 — good but with caveats

- **Compose / Composer.** Direct hit on the value prop, but Docker Compose
  owns the term in dev tools.
- **Lattice.** Composability, extensibility, structured-but-flexible. *Risk:*
  Lattice (HR software) is well-known.
- **Loom.** Weave-many-threads-into-one is the right metaphor; Loom (video
  messaging) owns the name.
- **Substrate.** The "foundation everything builds on" framing is strong for
  the developer audience but reads as infra-only for end users.
- **Manifold.** Math/topology word that fits "many surfaces, one object" —
  but Manifold (ML platform / Manifold Markets) is already in the dev space.
- **Field.** Data field + canvas field + cartographic field. Evocative,
  short, *very* generic.
- **Sheaf.** Math-y word for "things bundled together"; differentiated, but
  obscure even for the dev audience.
- **Codex.** Book-of-everything connotation; nice fit for the
  data-as-document story. *Risk:* OpenAI Codex, generally overused.

#### Tier 3 — directional but probably not finalists

- **Surface, Pane, Sheet, Page, Frame.** All correct in spirit, all too
  generic to own.
- **Forge, Foundry, Workshop, Studio.** Tool-shop metaphor; works for
  developer audience but understates the authoring side.
- **Cartograph, Mappa, Carta.** Pulls too hard on the maps surface —
  underweights the data and content sides.
- **Yield, Bind, Knit, Weave.** Process-shaped names; weaker than
  thing-shaped names for a product.

### Recommendation

Two finalists worth a full trademark + domain pass:

1. **Plat** — the bet on a short, owned, civic/cartographic word that
   downstream audiences haven't seen a hundred times. Best if the marketing
   leans into the "operational atlas" framing.
2. **Tessera** — the bet on the composition metaphor. Best if the marketing
   leans into the "everything is a section" / canvas framing.

If those don't clear, **Atlas Studio** or **Atlas Works** is a safe fallback —
the word *Atlas* alone is too crowded, but qualified versions are findable
and the metaphor is the closest single-word fit for what the product is.

The current `@availabs/dms` package name and internal CLI should keep `dms`
indefinitely — switching the product brand doesn't require renaming the
library, and there are good reasons not to (URL slugs, code refs, CLI muscle
memory, etc.).

---

## 8. Open questions before a launch

These are things that need a decision (or at least a clearer position) before
the product page is written:

- **Hosted vs. self-hosted?** Is the launch product a hosted SaaS, an OSS
  download, or both? The architecture supports either; the marketing differs
  drastically.
- **Pricing model?** Per-site? Per-seat? Per-row? The "single data_items table
  with type strings" architecture suggests per-app / per-namespace pricing
  could work cleanly.
- **Who's the design partner / first paid customer?** The existing sites are
  proof-points, but a "first paying customer" anchor would let the marketing
  speak to a specific buyer instead of a category.
- **What's the on-ramp?** A blank site is a hard place to start. Are there
  templates, a starter gallery, a "fork wcdb.fm" path? The existing
  `dms-template` is close to a starter — does it need a UI?
- **The plugin story for non-devs.** Datatype plugins and component plugins
  require a developer. Is there a marketplace? A registry? A
  "request-a-plugin" backstop? If the product is sold partly on extensibility,
  there should be a story for getting an extension that you didn't write
  yourself.
- **The acronym.** Even after a rename, the docs and CLI say DMS. Is there an
  in-product "marketing name vs. tool name" split (like "Notion" vs. the
  "Notion API"), and how do those play together?

These are launch-blockers in the sense that the answers shape the homepage,
not in the sense that they have to be solved before the work starts.

---

## Appendix — quick reference for product copy

Useful one-liners pulled from the analysis above, ready to drop into a deck or
page:

- *"Pages, dashboards, and maps — one canvas, one data model, one product."*
- *"Everything you build is data. The page is data. The theme is data. The
  query is data. Copy the rows and you've copied the site."*
- *"WYSIWYG when you want it, headless when you need it, extensible when
  you outgrow it."*
- *"Built for the team where the analyst and the engineer ship in the same
  tool."*
- *"For when Notion is too thin and a webapp is too much."*
- *"A radio station, a state government, and a federal traffic analytics
  platform run on the same code. The difference is just data."*
