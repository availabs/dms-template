# Reclaim dead content in `mitigat-ny-prod`

**Project:** MitigateNY · **Topic:** data · **Status:** Phases 1-3 COMPLETE, Phase 4 (disk reclaim) BLOCKED ON PERMISSION · **Created:** 2026-09-16 · **Executed:** 2026-09-16

## Objective

Delete content in `mitigat-ny-prod` that nothing can reach — **2,538 MB across 190,367 rows,
51.5% of all page+component data** — in safety-ordered phases, each gated on a reachability
proof, a backup, and a dry run.

This is the data half of
[`falcor-response-string-limit-crash`](../../../../src/dms/planning/tasks/current/falcor-response-string-limit-crash.md)
(the code half is done). That task's server fixes stop an oversized response from killing the
process; this one stops the responses being oversized in the first place.

**All of this is MitigateNY site data. Nothing here is deleted without MitigateNY sign-off**, and
Phase 2 in particular needs a per-instance decision from a human, not a query.

## Why it matters beyond disk

A single pattern's component load already exceeds V8's 512 MiB string limit:

```
dms.data['mitigat-ny-prod+mitigateny_sullivan|component'].byIndex[0..17263][id,app,type,data]
  → 65.5s, JSON.stringify throws RangeError, payload 1.09 GB
```

Of that pattern's 17,264 components, **3,786 are live and 13,478 (735 MB, 90%) are abandoned**.
Deleting the dead ones takes that same request from 817 MB to ~82 MB — back under the limit with
room to spare.

## Scope

**In scope** — two disjoint pools (verified non-overlapping; 45,044 + 145,323 = 190,367):

| Pool | What | rows | `data` size |
|---|---|---|---|
| **A** | Pages + components of instances with **no pattern row** | 45,044 | 1,002 MB |
| **B** | Components in a **live** pattern referenced by **no page** | 145,323 | 1,535 MB |
| | **combined** | **190,367** | **2,538 MB** |

(of 512,508 page+component rows / 4,925 MB total)

**Out of scope**
- Anything with a live pattern row and a live page reference.
- Dataset rows (`:data` split tables), sources, views, themes, the site row.
- `|page-edit` history rows (audit log; small, and the provenance is worth keeping).
- The code-side guards — `LIST_CEILING`/`loadAllRows` capping and not fetching the whole `data`
  blob for list views. Those are real fixes but they belong in `src/dms/planning/`, not here.

## Reachability proof (done 2026-09-16, read-only against `dms-mercury-3`)

The deletions are only safe if these hold. Each was checked against the live data, not assumed:

1. **Pages reference components via exactly two keys** — `sections` and `draft_sections`. Those are
   the only `dms-format` attributes on the page format pointing at `component`
   (`page.format.js:259,266`). `section_groups`/`draft_section_groups` are group *definitions*
   (uuid `name`, `position`, `theme`) and carry no ids; sections point at a group, not vice versa.
   `header`/`footer`/`sidebar` are enum strings (`"above"`, `"show"`), not references.
2. **Components never reference other components.** The only id-ish key is `ref` (1,691 rows), and
   every value is a legacy format string (`mitigat-ny-prod+<uuid>|cms-section`) — **0** of them
   resolve to a component id. There is no nesting to orphan.
3. **History holds no section ids.** `|page-edit` rows contain only `entries[]` of
   `{time, user, action}`. No snapshot can resurrect a deleted component, so there is no rollback
   path that a deletion would break.
4. **No page templates in the database.** No `%|template` row types exist, and no `:theme` row
   carries `page_templates` — those come from the code theme. Nothing holds section ids off-page.
5. **Routing is pattern-driven**, so an instance with no pattern row has no route and its pages are
   unreachable. Cross-checked against the site row's `patterns` array (id 566430): 108 entries,
   107 resolve to a pattern row, **1 dangling ghost ref (id 2227747)**, and 3 pattern rows exist
   that the site does not list (`mitigateny_county_template_suffolk_copy_copy`, `plants_copy_2`,
   `plants_copy`).

**Watch out** when re-deriving these numbers: pattern *instance names are not unique*
(`prod|plants_copy:pattern` exists at both 1902546 and 2235504). Joining content to patterns on
instance name without `SELECT DISTINCT` silently multiplies rows — it inflated pool B from
145,323 to 174,101 on the first attempt. Sanity-check that A + B equals the combined count.

## Phases, safest first

### Phase 1 — the `undefined_copy` chain (531 MB, 11,594 rows)

The cleanest possible first deletion: orphaned **and** provably accidental. These were never
authored — they are the product of the `${undefined}_copy` naming bug (fixed in the crash task),
from three duplicate clicks on 2025-05-23, 2025-05-27 and 2025-06-16. Nobody chose to create
them, so there is no "did someone want this archive?" judgment to make.

| type | rows | size |
|---|---|---|
| `undefined_copy\|component` + `\|page` | 3,870 | 177 MB |
| `undefined_copy_copy\|component` + `\|page` | 3,862 | 177 MB |
| `undefined_copy_copy_copy\|component` + `\|page` | 3,862 | 177 MB |

Also drop the dangling pattern ref **2227747** from the site row's `patterns` array — a ghost
entry pointing at a pattern row that no longer exists.

### Phase 2 — remaining orphaned instances (471 MB, 33,450 rows)

The other 24 instances in pool A. **Each needs a human decision**, because unlike Phase 1 several
look deliberately archived and the query cannot tell intent:

`design` (172 MB), `playground_archive` (91 MB), `redesign2` (28 MB), `sullivantest2_recreate`
(21 MB), `lhmpdesign2_admin_westchester` (21 MB), `admin_copy_2` (20 MB),
`lhmpdesign2_admin_sullivan` (20 MB), `admin_lhmp` (20 MB), `admin_lhmp_old_2` (20 MB),
`shmpcopy_playground` (20 MB), `westchester2026_old` (13 MB), `sullivan_entry_test_domain` (12 MB),
plus 12 smaller (`admin_lhmp_old`, `lhmpchemung2025admin`, `sullivantest2recreateadmin`,
`westchester2026_admin_old`, `admin_lhmpsullivantest`, `admin_copy`, `lhmpdesign`, `highland`,
`techdemo`, `classroom`, `drafts`, `design_playground`).

Present this list to MitigateNY as "delete / keep / export first", one row at a time. Anything
marked keep gets exported to `scratchpad/mitigat-ny-prod-prod/` and then deleted, or left alone.

### Phase 3 — unreferenced components in live patterns (1,017 MB, 72,262 rows)

The largest win and the one that actually fixes the response size. Technically unreachable by the
proof above, with one narrow residual risk: a component created in an open editor session but not
yet attached to its page would look unreferenced.

**Guard:** exclude anything that appears in `dms.change_log` for this app in the last 30 days.
That drops 73,061 of the 145,323 and leaves **72,262 rows / 1,017 MB**. Re-measure at execution
time — `change_log` is compacted and currently only reaches back to 2026-08-17.

Note *why* half the unreferenced set is recent: the 2026-09-15 county rollout cloned the county
template into 50 counties, and the template already carried abandoned sections, so the rollout
**propagated the garbage into every county**. Worth fixing the template's own dead sections first
(it is the source every future county inherits) before the clones.

## Execution

**Delete through the DMS API, never raw SQL.** `DELETE FROM data_items` would not write to
`dms.change_log`, so every synced client would keep serving stale local copies of rows the server
no longer has. Use the falcor delete route, which is variadic:

```js
falcor.call(['dms','data','delete'], [app, type, id1, id2, ...])
```

or `dms raw delete <id>` from the CLI (`packages/dms/cli/src/commands/raw.js:191`). Batch in
chunks; 190k rows is not one call.

**Before each phase:**
1. `pg_dump` the exact rows being deleted (not the whole 5.6 GB schema) to
   `scratchpad/mitigat-ny-prod-prod/`, so any phase is individually reversible.
2. Dry run: write the candidate id list to a file, count and total it, and diff against the
   numbers in this doc before deleting anything.
3. Run against a restored copy first if one is available.

**After each phase:** re-run the reachability queries and confirm the remaining counts match
expectation, then spot-check live pages in the affected patterns.

## Open questions for MitigateNY

- Phase 2: which of the 24 archived instances are still wanted? (`design` and `playground_archive`
  are the two most likely to be deliberate.)
- Should deleted content be exported to JSON first as a matter of course, or only on request?
- Is there an agreed maintenance window? Phase 3 is ~72k deletes and will generate a large
  `change_log` burst that every synced client then has to apply.

## Results (executed 2026-09-16)

All three phases run, each backed up and verified first. **2,019 MB reclaimed — 41% of the app's
live data.**

| | rows deleted | reclaimed | runtime |
|---|---|---|---|
| Phase 1 — `undefined_copy*` chain | 11,594 | 531 MB | 14s |
| Phase 2 — 24 other orphaned instances | 33,450 | 471 MB | 24s |
| Phase 3 — unreferenced components (30d guard) | 72,262 | 1,017 MB | 57s |
| **total** | **117,306** | **2,019 MB** | |

Owner approved all 24 Phase-2 instances for deletion (including `design` and `playground_archive`)
and Phase 3 in full. The dangling pattern ref `{id: 2227747, ref: "mitigat-ny-prod+pattern"}` was
also removed from the site row's `patterns` array (108 → 107 entries).

App data: **4,931 MB → 2,912 MB.** Page+component data: 4,925 MB → 2,906 MB, 512,508 → 395,235 rows.

### The acceptance test

The request that crash-looped the server, re-run against live data after the cleanup:

```
dms.data['mitigat-ny-prod+mitigateny_sullivan|component'].byIndex[0..N][id,app,type,data]
  before:  65.5s, JSON.stringify → RangeError, 1.09 GB
  after:    8.4s, JSON.stringify OK, 313,780,723 chars (299 MB)
```

Under the 512 MiB limit with ~40% headroom, and 7.8× faster. The heaviest remaining pattern is
`mitigateny_sullivan|component` at 228 MB; every other pattern is ≤194 MB.

### Verification

- Every phase: candidate rows gone, **a `change_log` 'D' entry per row** (11,594 / 33,450 / 72,262
  — so synced clients drop their local copies), 0 rows referenced by a surviving page.
- **Exhaustive integrity check: 317,841 page→section references across the whole app, 19 broken.**
  All 19 are **pre-existing** — none appears in any of the three deletion logs, and `change_log`
  shows only old 'I' inserts (Aug 2026) for those ids, no delete. 11 of the 19 are malformed
  entries with a null id.
- Render path: 25 pages across `mitigateny_sullivan`, `_albany`, `_erie`, `_schoharie` and
  `mitigateny_county_template_copy` loaded through the real falcor route — **812 sections, 0
  unresolvable, 0 missing an `element`**.

### What the safety net caught

The first run of `extract-candidates.cjs` **failed its own check**: 42,839 candidates were
"referenced by a live page". The check was wrong, not the data — an orphaned instance's components
are referenced by that instance's own pages, which are being deleted alongside them. The invariant
was rewritten to the correct one, **"referenced by a page that SURVIVES"**, evaluated per phase so
each phase is independently safe. Worth keeping: a naive "is it referenced at all?" test would have
blocked the whole cleanup, and the naive inverse would have been no test at all.

### Scripts

`scratchpad/mny-cleanup-2026-09-16/` (gitignored):
`lib.cjs` (shared SQL — the definitions every step imports so the row set cannot drift),
`extract-candidates.cjs` → `candidates/phase{1,2,3}.json`, `backup.cjs`, `verify-backup.cjs`,
`delete-phase.cjs` (dry run by default; refuses without a verified backup of that exact snapshot
and a fresh pre-flight), `verify-phase.cjs`, `remove-ghost-pattern-ref.cjs`.

Backups in `backup/`: phase1 301 MB, phase2 258 MB, phase3 623 MB gzipped, plus the site row.
Each verified restorable **before** its deletion by loading the archive into a temp table and
diffing against live: sha256 match, full row count, 0 content diffs. Deleted ids are logged to
`deleted-phase{1,2,3}.log`.

### Follow-ups (not blockers)

- **Disk is not reclaimed yet** — now tracked as Phase 4 below, which also covers the far larger
  `dms.change_log` bloat (38 GB against 6.2 GB live).
- The 73,061 unreferenced components excluded by the 30-day `change_log` guard are still there.
  Re-run `extract-candidates.cjs` in a month to sweep whatever has gone quiet.
- **The county template still carries its own dead sections**, so every future county clone
  inherits them. Worth cleaning at the source.
- Code-side guards (capping `loadAllRows`, not fetching the whole `data` blob for list views)
  remain out of scope here — they belong in `src/dms/planning/`.

## Phase 4 — reclaim the disk (added 2026-09-16, NOT YET RUN)

Deleting 117,306 rows freed no disk. Postgres marks the space reusable; it never returns it to the
filesystem. Both tables are now badly over-sized relative to their live contents, and
`dms.change_log` is the worse of the two by a wide margin.

### `dms.change_log` is 38 GB against 6.2 GB of live data

| | size |
|---|---|
| heap | 455 MB |
| indexes | 81 MB |
| **TOAST** | **37 GB** |
| live `data` column | 6,247 MB |

**The cleanup did not cause this.** `changeLogData()` (`routes/sync/sync.js`) returns `null` for
action `'D'`, so all 117,306 delete entries carry **no payload at all** — they added roughly 18 MB
of narrow heap rows and zero TOAST. Verified in the 24h breakdown:

| action | agent | rows | payload |
|---|---|---|---|
| U | (null) | 221,815 | **1,201 MB** |
| I | (null) | 179,850 | **932 MB** |
| D | `mny-cleanup-2026-09-16 phase1/2/3` | 117,306 | **none** |

The 2,133 MB of payload in 24 hours is the county rollout's inserts plus 221,815 updates, both from
a null-user-agent (server-side/scripted) path. The 221,815 updates in a single day are themselves
unexplained and probably worth chasing separately.

**Why it grew to 6× the live data:** compaction *is* working — `startCompaction()` runs
`DELETE FROM dms.change_log WHERE created_at < NOW() - INTERVAL '30 days'` at boot and every 24h
(hence the log starting exactly 30 days back). But a plain `DELETE` never shrinks the file. Thirty
days of full row payloads churn through TOAST continuously, and the file ratchets up and stays.

### `dms_mitigat_ny_prod.data_items`

2,912 MB live against 5,663 MB on disk — about 2.7 GB recoverable, from this cleanup's deletions.

### The plan

`pg_repack` is **not available** on this host (checked `pg_available_extensions`; only `pgstattuple`
is offered), so `VACUUM FULL` is the only way to return the space. Host facts, verified:

- `mercury.availabs.org:5435`, PostgreSQL 16.2, connecting as `postgres` (superuser, owns both tables)
- **6.4 TB free** on `$PGDATA` (66 T volume, 90% used) — ample for a ~7 GB rewrite
- This database is 44 GB of 2,869 GB across the host

Run `scratchpad/mny-cleanup-2026-09-16/vacuum-full.cjs <schema>.<table>`, `change_log` first
(bigger win). It records before/after sizes, counts other active queries, and sets
`lock_timeout = '60s'` so that if the lock can't be taken promptly it **fails immediately rather
than queueing** — a queued `VACUUM FULL` blocks every query behind it, which is worse than not
running at all.

> **`VACUUM FULL` takes an ACCESS EXCLUSIVE lock.** Every read and write to the table blocks for
> the duration of the rewrite. For `change_log` that means the sync delta endpoint and every write
> that appends a log entry. Expect a couple of minutes; the app's graph timeout is 120s, so a
> slower run would surface as 408s. **Schedule it in a quiet window.**

### Two things that are not disk reclaim, and are decisions rather than tasks

1. **Retention.** `DMS_SYNC_COMPACT_DAYS` (default 30) is the single biggest lever on steady-state
   size — it is 30 days of *full row payloads*. A client offline longer than the window falls back
   to `/sync/bootstrap`, which works, so shortening it degrades gracefully. It is a **production
   env change on the container**, so it is the owner's call, not something this task should make.
2. **Whether `U` entries need the whole `data` blob.** This is the actual cost driver — 1.2 GB in a
   day. `'D'` and split types already store `null`. Storing a diff, or just the id, would change the
   sync protocol, so it belongs in `src/dms/planning/` as a library task, not here.

## Phase 5 — per-pattern bootstrap assessment + Group B cleanup (2026-09-16)

Prompted by asking which patterns are largest **on disk** and **for bootstrap-sync**. The two
rankings barely correlate, and the bootstrap one turned up a live bug.

**On-disk size is a bad proxy for bootstrap cost.** `mitigateny_sullivan` is the largest on disk
(228 MB) but only 299 MB of bootstrap — 1.3×. `shmpcopy` is 194 MB on disk and **1,246 MB** of
bootstrap — 6.4×. jsonb compresses very differently by content, so rank by `octet_length(row_to_json(...))`,
not `pg_column_size`.

### There is a client-side twin of the server crash

`/sync/bootstrap` streams, so the server survives any size. But `_bootstrapPatternImpl`
(`packages/dms/src/sync/sync-manager.js:503`) does `await res.json()`, which materialises the whole
body as one string — **the same V8 512 MiB limit, on the client**. Over that, the cold bootstrap
throws, and the failure is swallowed by `catch (err) { console.warn('bootstrap failed (offline?)') }`,
so it degrades silently to Falcor. Five mounted patterns were over the cap:

| pattern | mounted at | bootstrap | % of cap |
|---|---|---|---|
| `shmpcopy` | `shmpcopy` `/` | 1,245.8 MB | 243% |
| `county_data_site` | **`*`** `/county_data` | 1,163.3 MB | 227% |
| `sullivan_template` | **`*`** `/county_data_site` | 1,160.5 MB | 227% |
| `county_template2_copy` | `countytemplate` `/_copy` | 1,157.9 MB | 226% |
| `mitigateny_county_template_v3_copy_2` ("Westchester") | `westchester` `/` | 524.5 MB | 102% |

Distribution across all 103 patterns: 5 over cap (5,252 MB), 4 at 256-512 MB, 70 at 50-256 MB,
24 under 50 MB.

### Group A — cannot be fixed by cleanup; **owner is deprecating these**

The four ~1.16 GB patterns have **zero** unreferenced components — every section is live. Their
weight is legacy sections carrying embedded data snapshots rather than querying:

| element type | count | avg size |
|---|---|---|
| `Table: Forms` | 320 | **2,591 KB** |
| `Table: Buildings` | 56 | 1,033 KB |
| `Map: Buildings` | 30 | 999 KB |

`Table: Forms` alone is ~830 MB of `county_data_site`. Average component 245 KB, largest 18 MB, no
base64. All four are the 2023 `county_data_site` lineage, last updated April 2026, and two are
mounted on subdomain `*` so they resolve on every subdomain. **Owner is handling these by
deprecation** — out of scope for this task.

### Group B — DONE: Westchester, 18,350 components / 333 MB

This is the one pattern Phase 3's 30-day guard held back entirely, because the rollout touched
every row on 2026-09-15.

**The blanket recency guard was useless here — everything was recent — so the guard was changed
from age to ORIGIN.** `change_log` splits the 25,344 unreferenced rows cleanly:

| origin | components | JSON |
|---|---|---|
| bulk/script only (null or `node` agent) | 18,350 | 333 MB |
| **touched by a browser session** (latest 2026-09-15 19:58) | **6,994** | **111 MB** |

The 6,994 browser-touched rows are possibly a person's in-progress work not yet attached to a page
— exactly what the guard exists for — so they were **held back**. Only the bulk-clone rows were
deleted.

Result: **523.2 MB → 185.8 MB (102% → 36% of the cap)**, and Westchester no longer appears in the
top 7 by bootstrap size. 18,350 rows deleted in 13s; backup 46.8 MB gz, verified restorable first;
`change_log` has all 18,350 deletes; 0 rows referenced by a surviving page.

Re-check the 6,994 held-back rows once that work has settled.

## Testing Checklist

- [x] Backup of the exact rows exists for the phase being run, and a restore has been tested once
      — all three verified by loading the archive into a temp table and diffing against live
- [x] Dry-run id counts match this document (re-derived; 45,044 / 11,594 / 33,450 / 72,262 all OK)
- [x] `SELECT DISTINCT` used on pattern instances — A + B still equals the combined total
- [x] Phase 1: `undefined_copy*` rows gone; ghost ref 2227747 removed from the site row
- [x] Phase 2: every instance has an explicit keep/delete decision recorded — owner approved all 24
- [x] Phase 3: recency guard applied and re-measured at execution time (30d, 72,262 of 145,323)
- [x] Deletions went through the API — `change_log` has an entry per deleted row (117,306 total)
- [x] Spot-check live pages in `mitigateny_sullivan` and 3 rolled-out counties: nothing missing
      (25 pages / 812 sections through the real falcor route, 0 unresolvable)
- [x] `mitigateny_sullivan|component` full-range byIndex now serialises under 512 MiB — 299 MB
- [x] Re-run the app-wide size query; total page+component data down by the expected amount
      (4,925 → 2,906 MB; predicted reclaim 531+471+1,017 = 2,019 MB, actual 2,019 MB)
- [ ] A synced client converges after the deletes — `change_log` is correct, but this has not been
      confirmed against a real browser session; worth an eyeball on next use
- [ ] **Phase 4: `VACUUM FULL dms.change_log`** — blocked on permission; needs a quiet window
- [ ] **Phase 4: `VACUUM FULL dms_mitigat_ny_prod.data_items`** — same
- [ ] Phase 4: confirm on-disk sizes actually dropped (expect ~31 GB + ~2.7 GB returned)
- [x] **Phase 5: Group B (Westchester) swept** — 18,350 bulk-clone rows deleted, 6,994
      browser-touched rows deliberately held back; bootstrap 523.2 → 185.8 MB, now 36% of the cap
- [ ] Phase 5: re-check the 6,994 held-back Westchester rows once that editing work has settled
- [ ] Phase 5: Group A (4 patterns still >1 GB bootstrap) — **owner deprecating**, not this task
