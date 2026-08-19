# wcdb-admin

Builds the WCDB **station admin** — a separate `station_admin` pattern at
`/admin` holding five draft pages bound to the migrated `wcdb-dama` datasets.

Task: `project-planning/wcdb/tasks/current/build-wcdb-admin-pages.md`
Design: `src/themes/wcdb/WCDB Design System/dms_design_system/pages/admin/*.html`

## Run

```bash
cd dms-template
export DMS_HOST=http://localhost:3001 DMS_APP=wcdb DMS_TYPE=prod
export DMS_AUTH_TOKEN=$(node src/dms/packages/dms/cli/bin/mint-token.mjs \
  --host "$DMS_HOST" --project wcdb --email … --password …)

node scripts/wcdb-admin/create-pattern.mjs            # once (idempotent)
node scripts/wcdb-admin/migrate-playlist-source.mjs   # once (idempotent)
WIPE=1 node scripts/wcdb-admin/seed-wcdb-admin-pages.mjs
```

All three are re-runnable. `--dry-run` on the first two prints what they would
do without writing.

| Script | What it does |
|---|---|
| `create-pattern.mjs` | Creates `prod\|station_admin:pattern` at `/admin` with the `app` layout + SideNav, attaches it to the site, and demotes the legacy `admin` pattern to `/admin_legacy`. |
| `migrate-playlist-source.mjs` | Brings the LIVE `now_playing` stream table to the provenance schema: columns, the mark-corrected trigger, `metadata.columns`, `isEditable`. |
| `seed-wcdb-admin-pages.mjs` | The five pages, their bands, their modal groups and their data bindings. |
| `lib.mjs` | Shared: CLI runner, lexical builders, section payload shape, the confirmed source bindings, the review threshold. |

## Draft only

`seed-wcdb-admin-pages.mjs` never publishes, and never writes `sections` /
`section_groups` (the published pair). After review, a human runs:

```bash
for p in playlist schedule djs dj_profile events; do
  node src/dms/packages/dms/cli/bin/dms.js page publish "$p" --pattern station_admin
done
```

**Until then, review in EDIT mode** (`/admin/edit/<slug>`): a draft page is
hidden from the nav in view mode, and a modal band renders inline in edit and
from `item.sections` in view — so a draft-only page cannot show a modal
behaving.

## Bindings (confirmed 2026-08-14)

| Page | Source | View |
|---|---|---|
| playlist | 7 `WCDB Stream Playlist` (live feed) | 7 |
| schedule | 10 `WCDB Schedule` ⋈ 9 `WCDB Shows` | 10 / 9 |
| djs · dj_profile | 8 `WCDB DJs` | 8 |
| events | 11 `WCDB Events` | 11 |

Editing any of them requires membership of the **`wcdb Admin`** group, which
holds `*` on every `wcdb-dama` source.

## Two gotchas this hit, worth keeping

- **`end` is a reserved word.** `schedule.end` emitted bare is a syntax error
  and the whole row returns as an error object. Every binding uses
  `"end" as end_at`.
- **The never-match filter sentinel must type-check.** `'__none__'` against an
  INTEGER primary key fails the cast before it can match nothing. These forms
  use `-1`.
