# Loading a transcribed plan into a MitigateNY 2.0 pattern

Reference for **loading a county HMP's narrative into a MitigateNY 2.0 county pattern** (app
`mitigat-ny-prod`). Established on **Schenectady** (pattern 2275239 → 2304223, 2026-07-22) and applied to
**Delaware** (pattern **2323808**, `MitigateNY_Delaware_Draft`, subdomain `delaware_draft`, 2026-07-23).

> Companion docs: [`mny-1.0-scraper/README.md`](./mny-1.0-scraper/README.md) (the source-scrape
> method), [`README.md`](./README.md) (the index), and the worked examples in
> [`worked-examples/`](./worked-examples/). Per-county status and the platform-model notes are in
> `references/mny-transcribe/CLAUDE.md` — git-ignored, local only; each county's source docs are in
> `references/mny-transcribe/<county>/`.

## The platform model (recap)

A 2.0 county pattern is ~48 pages; each page is an ordered list of components. The **only** fill target is
the **Annotation** component (`element-type:"lexical"`, `element-data.isCard === "Annotation"`) — the empty
"Local Context / …" rich-text boxes. Never touch **shared narrative** cards (statewide `LHMP_IA`), **Data**
components (Spreadsheet/Graph/Map — auto-filtered to the pattern geoid), or **Inline Guidance**
(`isCard:"Inline Guidance"`, hidden authoring hints — read them to place content, don't edit).

Edits write to **`draft_sections`** (the editor copy); the public view renders `sections`. **Do not publish**
as part of loading — leave drafts for owner review. Filled components get `status: "shmp_sourced_content"`.

## Access / API

Falcor over `https://dmsserver.availabs.org/graph` (see `scripts/<county>/fq.js`): `byIds()` to read component
rows, `listIds('<instance>|page')` to enumerate pages, `edit(id, data)` (calls `dms.data.edit`) to write.
The county pattern's page rows share an instance slug (e.g. `mitigateny_county_template_v2_copy|page`), so
**isolate one pattern's pages by `created_at` date** (all its pages are created together).

## Pipeline (reusable scripts in [`scripts/<county>/`](./scripts/))

1. **Enumerate pages** — `enumerate.mjs`: list the instance's pages, keep the ones created on the pattern's
   build date. → `<county>_pages.json`.
2. **Inventory slots** — `build_inventory.mjs`: for each page, walk `draft_sections`, capture every
   Annotation component `{id, title, guidance, filled?}` (guidance = the nearest preceding Inline Guidance —
   it tells you what the slot wants). → `inventory.json` + `inventory.md`.
3. **Crosswalk** — map the transcribed plan's narrative to slots. **Faithful/verbatim — invent nothing.**
   Record confidence and what was intentionally left empty (see the crosswalk reports in [`worked-examples/`](./worked-examples/)).
4. **Author fills** — one spec per slot `{id, md, status?}` where `md` is light markdown (see Formatting).
5. **Back up first** — dump each target component's pre-edit `element-data` to `backups/` before writing.
6. **Dry run** — `fill_md.mjs <spec> --dry` prints target/■counts without writing.
7. **Apply to draft** — `fill_md.mjs <spec> --apply`. Re-run the inventory to verify.

## Choices to replicate (established on Schenectady — keep consistent across counties)

- **Hazard taxonomy → 2.0 hazard pages:** Coldwave→**Extreme Cold**, Heat Wave→**Extreme Heat**, Snow
  Storm→**Snowstorm**; all others 1:1. **Tsunami/Seiche and Volcano are dropped** (no 2.0 page). Hazards that
  are *not a hazard of concern* for the county (typically Avalanche, Coastal Hazards, Hurricane) fill the
  **"Local Hazard Summary"** slot; hazards of concern fill **"County Assessment."**
- **Don't transcribe data or boilerplate.** Skip everything the 2.0 platform renders itself: all data tables
  (NFIP, inventories, storm events, disaster declarations, loss, capabilities/actions/problem-statement
  tables) — auto-filled by geoid — and generic FEMA/44-CFR/methodology framing — covered by shared `LHMP_IA`
  cards. Transcribe only the **county-specific authored prose**.
- **Leave a slot empty rather than forcing a fit.** If the source carries no matching county-specific prose,
  leave it empty (the plan is intentionally sparse; ~46 of ~255 slots filled for Schenectady).
- **Jurisdictional annexes are DEFERRED.** They are 2.0 *form* pages (a separate mechanism), not Annotation
  slots — not loaded during this pass.
- **Landing-page Executive Summaries** (The Risk / The Local Environment / The Plan) are auth-gated; skip.
- Everything writes to `draft_sections`, `status=shmp_sourced_content`, **unpublished**.

## Rich-text formatting for presentation (REQUIRED — applies to every filled Annotation box)

Author content as light markdown; `scripts/<county>/lexical.mjs` (`mdToRoot`) converts it to standard `@lexical`
`exportJSON` nodes with these rules baked in:

- **Blank line at the beginning and end of every rich-text box** (a leading and trailing empty paragraph).
- **A blank line between every paragraph and between paragraphs and bulleted/numbered "features"** (empty
  paragraph between blocks) — **exception:** a heading *hugs* the block immediately after it (no blank
  between a heading and its following paragraph/list).
- **Indent bullets and numbered lists** — the list node carries `indent: 1` so bullets/numbers sit indented
  from the body text. Markdown `- item` → bullet list; `1. item` → numbered list.
- **Link to hrefs** — markdown `[label](https://…)` → a `type:"link"` node (`rel:"noopener"`,
  `target:"_blank"`). Turn bare URLs and "click here"-style references from the source into real links.
- **Bold where appropriate** — markdown `**text**` → text node `format:1`. Bold defined terms, program
  names, and lead-in labels (e.g. **Flood of 2006 –**), not whole sentences.

Node shapes (standard Lexical): text `{type:"text",format,text,…}`; link
`{type:"link",url,rel,target,children:[text]}`; list `{type:"list",listType:"bullet|number",tag:"ul|ol",
indent:1,children:[listitem]}`; listitem `{type:"listitem",value,children}`; paragraph/heading with
`indent:0`. Empty paragraph = `{type:"paragraph",children:[],direction:null}`.

> The blank-line spacing rule was first applied to Schenectady via `reformat.mjs` (leading/trailing +
> between-block blanks, heading hugs next). The indent / link / bold rules were added for Delaware and are
> now the standard; `lexical.mjs` here supersedes the Schenectady `lexical.mjs`.
