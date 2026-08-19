# wcdb-public

Seeds the WCDB **public** site — eight pages on the `wcdb_main` pattern, every
data section bound to the migrated `wcdb-dama` sources.

Task: `project-planning/wcdb/tasks/current/build-wcdb-public-pages.md`
Design: `src/themes/wcdb/WCDB Design System/dms_design_system/pages/*.html`

## Run

```bash
cd dms-template
export DMS_HOST=http://localhost:3001 DMS_APP=wcdb DMS_TYPE=prod
export DMS_AUTH_TOKEN=$(node src/dms/packages/dms/cli/bin/mint-token.mjs \
  --host "$DMS_HOST" --project wcdb --email … --password …)

WIPE=1 node scripts/wcdb-public/seed-wcdb-public-pages.mjs
WIPE=1 node scripts/wcdb-public/seed-wcdb-public-pages.mjs --only home,blog
```

Shares `scripts/wcdb-admin/lib.mjs` — the same lexical builders, section
payloads, fused list card and confirmed source bindings the admin seed uses.

## Draft only — and this one is the LIVE SITE

The script writes `draft_sections` and never publishes. The public pages already
have published content, so nothing changes for a visitor until:

```bash
dms page publish <slug> --pattern wcdb_main
```

Review at `/edit/<slug>` first.

| Page | slug | Source |
|---|---|---|
| Home | `home` | 10 ⋈ 9 ⋈ 8 · 13 · 11 · 7 |
| Schedule | `schedule` | 10 ⋈ 9 ⋈ 8 |
| DJs | `djs` | 8 |
| Spins | `playlist` | 7 |
| Events | `events` | 11 |
| Station info | `station_info` | 12 |
| Show | `show` | 9 ⋈ 8, `?show_id=` |
| Blog | `blog` | 13 |

Every page carries the shared **live rail** (on air / now playing) in the sticky
`header` band and the shared **footer** at the end of `content`.

## Four gotchas this hit, all reusable

- **A filter leaf's `col` cannot carry `as <alias>`** — it lands in the WHERE
  clause verbatim (`syntax error at or near "as"`). Put the calc column in
  `columns`; reference it from the leaf by alias.
- **`ds.` only exists under a join.** The builder aliases the base table when it
  joins and not otherwise — otherwise `missing FROM-clause entry for table "ds"`.
  Under a join, qualify anything that exists on both sides (`department`).
- **A two-hop join needs a calculated join key.** `dsColumn: 'shows.dj_id'` is
  emitted as `ds.shows.dj_id`; `'shows.dj_id as host_dj_id'` is passed through.
- **A Card whose columns are all `static` still queries** and asks for a column
  named `data`, which external pg sources do not have. Seed one blank row and
  set `fetchMode: 'cache'`.
