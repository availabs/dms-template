# wcdb-migrate

Reshapes the three legacy WCDB DMS datasets into four external pgEnv datasets:
**`djs`**, **`shows`**, **`schedule`**, **`events`**.

Task: `project-planning/wcdb/tasks/current/migrate-wcdb-datasets-to-pgenv.md`
Schema: the Phase 1 output of `…/tasks/completed/design-wcdb-admin-system.md`

## Run

```bash
cd dms-template
node scripts/wcdb-migrate/extract.mjs      # legacy dumps  → out/raw-*.json
node scripts/wcdb-migrate/transform.mjs    # target CSVs   → out/*.csv + out/report.md
DMS_AUTH_TOKEN=… node scripts/wcdb-migrate/publish.mjs
```

`extract` and `transform` are safe to re-run — they only write to `out/`.
**`publish` writes to the pgEnv.** Read `out/report.md` first; that is what it
is for.

## Where it publishes

`http://localhost:3001/dama-admin/wcdb-dama/…` — the **local** dms-server.
`wcdb-dama` is a real pgEnv there (`dms-server/src/db/configs/wcdb-dama.config.json`)
and `GET /dama-admin/wcdb-dama/etl/new-context-id` returns 200.

## Editability — do not skip this

These datasets exist to be edited from the admin UI. An external source is only
writable once it has **a real single-column Postgres primary key** *and*
`isEditable` turned on — see `src/dms/planning/tasks/current/`
`set_primary_col_from_meta.md` and `external-source-editable-crud.md`.

`transform.mjs` asserts the PK candidate is unique and non-null before writing,
because the server rejects a PK that isn't:

| Dataset | PK | Why |
|---|---|---|
| `djs` | `dj_id` | legacy value, verified 891/891 distinct, 0 null |
| `shows` | `show_id` | **generated** — legacy `schedule_id` has 29 non-numeric values and 2 duplicates |
| `schedule` | `airing_id` | **generated** — the legacy data has no per-airing id |
| `events` | `event_id` | generated |

After publishing, per source: set the PK on the Metadata page, **then** flip
`isEditable`. Both are deliberate admin actions; neither happens automatically.

## Decisions baked in (2026-08-13)

- **Nine departments, not ten.** `Hip-Hop/R&B` stays one value — it is one value
  on 274 rows and no rule can split it. The public chips and icon registry match.
- **`student_status` is dropped.** Codes 1–5, no recorded meaning; the legacy
  source (dataset `1958637`) still has it if it ever needs recovering.
- **Strays fold into Specialty**: `Talk`, `Retro`, `Folk`, `Inspirational`,
  `Street Team` (38 rows).
- **`active` is the source of truth for status**, not the dates — 535 alumni have
  no `end_date` and 2 current DJs do.
- **29 corrupt schedule rows are dropped**: a CSV comma failure spilled
  description text across columns. 23 are otherwise empty; 6 hold fragments whose
  parent row is elsewhere. Nothing is reconstructible.
- **37 rows have a time but no day** — left unscheduled in `shows` rather than
  guessed onto a day. Placing them is the schedule editor's job.

## Published source ids (2026-08-13)

| Dataset | source_id | view_id | table |
|---|---|---|---|
| WCDB DJs | 8 | 8 | `gis_datasets.s8_v8_wcdb_djs` |
| WCDB Shows | 9 | 9 | `gis_datasets.s9_v9_wcdb_shows` |
| WCDB Schedule | 10 | 10 | `gis_datasets.s10_v10_wcdb_schedule` |
| WCDB Events | 11 | 11 | `gis_datasets.s11_v11_wcdb_events` |

**The upload pipeline declares its own PK.** Every table came out with
`PRIMARY KEY (ogc_fid)`, not the semantic key listed in the PK table above.
`ogc_fid` is added by the DAMA ingest. Repointing to the intended column means
removing that constraint first — see the task file for the decision and the
supported route.
