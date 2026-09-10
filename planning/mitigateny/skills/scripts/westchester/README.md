# `scripts/westchester/` — the IEM pipeline (Westchester 2026)

Two independent pipelines, kept in separate folders because **both contain a
`build_crosswalk.py`, a `gen_report.py` and an `fq.js`** with different contents:

| Folder | Job |
|---|---|
| [`baseplan/`](./baseplan/) | the county base plan → the pattern's **Annotation slots** (`draft_sections`) |
| [`annexes/`](./annexes/) | the 45 jurisdictional annexes → the **Jurisdictions dataset** columns |

Working scripts from a real run, not maintained tooling. County constants are inside
them — read before running. Both expect a git-ignored working folder at
`references/mny-transcribe/westchester/{final-plan-work,annex-work}/` with an `out/`
sibling; every path in them is relative to `scripts/`, so run them from there.

```bash
export DMS_HOST=https://dmsserver.availabs.org DMS_APP=mitigat-ny-prod DMS_TYPE=prod
```

**Neither pipeline needed a token.** Component reads, component writes (`dms.data.edit`
via `fq.js`) and `dms dataset update` all succeeded anonymously on this app. Do not add
credentials here — see the parent README's auth note.

---

## `baseplan/` — run order

| # | Command | Output |
|--:|---|---|
| 1 | `node enumerate.mjs mitigateny_county_template_v3_copy_2` | `out/pages.json` — the 49 pages |
| 2 | `node build_inventory.mjs` | `out/inventory.{json,md}`, `out/all_components.json` — the 256 Annotation slots + their Inline Guidance |
| 3 | `python docx_dump.py "<baseplan>.docx" ../out/baseplan` | `blocks.json`, `full.txt`, `outline.txt` |
| 4 | `python section_map.py` | `out/baseplan/sections.json` — 722 headings, 197 with content |
| 5 | `python hazard_matrix.py` | `out/baseplan/hazard_matrix.json` — hazard × subsection char counts |
| 6 | `python build_crosswalk.py` | `out/crosswalk.json` + `.csv` — **the mapping lives here** |
| 7 | `python gen_report.py` | `out/crosswalk_tables.md` (pasted into the task doc), `out/stats.json` |
| 8 | `python gen_html.py` | `out/westchester-crosswalk.html` (uses `template.html`) |
| 9 | `python build_fill_spec.py` | `out/fill_spec.json` + `out/fill_spec.md` — per-slot blocks |
| 10 | `node backup_slots.mjs` | `out/backups/slots_PRE.json` — **read-only, always run it** |
| 11 | `node fill_slots.mjs` | dry run |
| 12 | `node fill_slots.mjs --apply` | writes; `out/fill_results.json` |
| 13 | `node verify_slots.mjs` | independent re-fetch; `out/verify_results.json` |

`fill_slots.mjs` takes slot ids to scope a run: `node fill_slots.mjs --apply 2449714`.
**Use that to canary one slot** — see the gotcha below.

### Where the decisions live

- **`build_crosswalk.py`** — the `M` list (county pages, one hand-authored row per doc
  section) and `SLOTMAP` (hazard pages, applied to all 16 profiles). Edit here, re-run 6→8.
  **M-list order is load order**: when two doc sections land in one slot, their position in
  `M` decides which is prepended and which appended. Moving a row is how you fix sequence.
- **`build_fill_spec.py`** — `PARA_RULES` (restrict a section→slot pair to named
  paragraphs), `SENT_RULES` (split a paragraph at its first sentence boundary),
  `LEAD_INS` (h3 above a merged block), and `check_lead_ins()`.

### Helpers

- `python sec.py <block> [<block>…]` — print a section's full text by block number.
  **The single most useful command when authoring fills.**
- `node probe_comps.mjs <id>…` — a component's `element-type`, title, tags,
  `element-data` keys, `isCard`. Use it before assuming something is an Annotation.
- `node pattern_probe.mjs <pattern-id>` — dump a pattern row's `data`.
- `node pattern_diff.mjs` — diff the county pattern against `county_template`. This is what
  found the three pattern-level fields that did not survive duplication.
- `node enum_template.mjs` — the same slot inventory for `county_template`.
- `node list_patterns.mjs` — find a pattern id by name.

---

## `annexes/` — run order

| # | Command | Output |
|--:|---|---|
| 1 | `node discover.mjs [page-id]` | `out/annex_page_components.json` — all 91 annex-page components with their column bindings |
| 2 | `python build_crosswalk.py` | `out/crosswalk.{json,csv}`, `out/annex_sections.json` |
| 3 | `python gen_report.py` | `out/per_jurisdiction.md`, `out/per_column.md`, `out/discrepancies.json` |
| 4 | `python build_payloads.py` | `out/payloads/` — one file per row |
| 5 | `node write_annexes.mjs --dry-run` | dry run |
| 6 | `node write_annexes.mjs [row-id]` | writes; `out/write_results.json` |

`node parents.mjs` dumps each annex-page component's claimed `parent` — that is what
surfaced the 86 mispointed parents and the two `county_template` page ids.

---

## The one gotcha that will cost you a load

**`lexical.mjs`'s `buildRootBlocks2()` returns the bare ROOT NODE.** The two write paths
want it wrapped differently:

| Target | Shape |
|---|---|
| **Page component** `element-data` | **`{text: {root: <node>}}`** |
| **Dataset column** value | **`{root: <node>}`** |

Assigning the node straight to `ed.text` — the habit you pick up from the annex path —
stores it **one level too shallow**. The write returns success. `status` and `isCard` are
set correctly. Every character is present. **And the box renders empty**, because nothing
resolves `text.root`.

A dry run cannot catch it: the dry run measures the node it built, not the shape it stores.

**So: write one slot, read it back, then write the rest.**

```bash
node fill_slots.mjs --apply 2449714     # canary
node verify_slots.mjs                    # or probe_comps.mjs 2449714
```

On the Westchester run the canary read back `ed.text.type === 'root'`, `chars: 0`,
`children: undefined` — unmistakable once you look, invisible if you don't.

## Other things worth knowing

- **`docx_dump.py` walks `body.iterchildren()`, not `body.iter()`.** The older
  `context/scripts/docx_extract.py` double-counts table paragraphs and emits text boxes
  2–4×. This one doesn't, so block numbers are stable and safe to cite.
- **The document's `toc 1/2/3` styles mirror `Heading 2/3/4`** almost exactly (456 of each).
  Filter on `Heading *` or every heading appears twice.
- **Author fills from `blocks.json`, not a terminal transcript** — Windows consoles mangle
  the document's smart quotes and en dashes.
- **`fill_slots.mjs` merges into the existing `element-data`**, it never replaces it.
  Replacing drops `isCard` / `bgColor` / `showToolbar` and the grey box stops being a grey
  box. It also refuses to write anything whose `isCard !== 'Annotation'`.
- **Writing a draft component does not touch the published view.** Draft and published are
  separate component rows; verified on this run by checking that none of the 177 written ids
  appears in any page's published `sections` list.
