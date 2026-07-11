# qa-sync-inventory — T0: pull live state into the control room

First step of every `qa-run` (see `qa-process.md`). Wraps `tools/cr_sync.mjs`.

```bash
# DRY first when anything looks off; --apply to write
DMS_AUTH_TOKEN=… node src/themes/transportny/qa_skills/tools/cr_sync.mjs --app npmrdsv5 --apply
```

## What one apply does (in order)

1. **Schemas** — ensures `sitemgmt_pages` workflow columns + 6-stage select options and
   `sitemgmt_tickets` denorm columns (`page_name/page_route/page_stage`) exist. Idempotent.
2. **Pattern list** — from `sitemgmt_patterns` (enabled rows, sorted); `--patterns a,b` overrides.
3. **Pages upsert** (by `page_key`): refreshes inventory fields (`name, route, url, build,
   surface_label, updated`) from the live patterns; NEW pages start at
   `stage=Proposed`. PRESERVES author/process fields (`qa, data, owner, description, stage,
   gates`) unless `--reset` (forces everything back to Proposed — destructive, ask first).
4. **Design ingest** (skip with `--no-design`): resolves each page's mockup
   (`SURFACE_PREFIX`/`KEY_FILE_OVERRIDE` → `dms_design_system_v2/pages/*.html`), inlines
   `_shared.css`, strips `ds-nav.js`, writes `design_file` + `design_html`. Re-ingested every
   run so design edits propagate.
5. **Ticket hygiene**: missing `ticket_id` → max+1 (form-created tickets); empty `status` →
   `Triage`; empty `opened/updated` → today; denormalizes target-page `name/route/stage`.
6. **Page counters + stage-tuple reconcile**: recomputes `open_bugs/blockers/majors` (+`rag`
   red/amber/green) per page from open tickets, and reconciles `stage_order`/`next_step` from
   `stage` (the QA page's editable stage pill writes only `stage`).

## Flags to treat with care

- `--reset` — wipes process state to Proposed. `--prune` — deletes page rows not in live
  patterns (**kills design-first manual rows** — never use while any exist). `--clear-tickets` /
  `--clear-stories` — empty those datasets. None of these belong in a routine `qa-run`; together
  (`--reset --clear-tickets --clear-stories`) they are the GROUND-UP RESET (process state wiped;
  author inputs — descriptions/owners/patterns config — survive).

## Verify after apply

Re-run WITHOUT `--apply`: every section should report `0 to patch` / `already coherent`.
Overview page (2184939) "Open" column shows the recomputed counts.
