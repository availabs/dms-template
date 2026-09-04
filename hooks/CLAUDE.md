# hooks/

App-owned page-delete side effects for `dms-template`, loaded into `dms-server` at boot via
the `DMS_PAGE_DELETE_HOOK` env var. Same shape as `data-types/register-datatypes.js` +
`DMS_EXTRA_DATATYPES` (see `data-types/CLAUDE.md`) — a small, project-owned extension point that
keeps the `@availabs/dms` submodule agnostic of any single consumer's app-specific behavior.

## Why this exists

`dms.controller.js`'s `deleteData` already cascades a `:source`/`:view` delete to its structural
children (dmsEnv refs, child views, split tables). A deleted **page** has no such structural
children DMS itself knows about — but an app can still have its own side effect to run (e.g.
transportny's `reports_snap_2` catalog row, which mirrors a report page's existence but isn't a
DMS structural concept). Rather than teach the shared submodule about `reports_snap_2` by name,
`cascadePageDelete` just calls whatever optional hook this directory's bootstrap registers.

Full design history: `src/dms/planning/tasks/current/page-delete-lifecycle-hook.md`.

## Bootstrap

`register_page_delete_hooks.js` is the single entry point `dms-server` reads at boot via the
`DMS_PAGE_DELETE_HOOK` env var (Dockerfile sets it to `/app/hooks/register_page_delete_hooks.js`;
for local dev, set it in the repo-root `.env` — see `.env.example`). It `require()`s each handler
in `HANDLERS` independently and composes them into the one function `dms-server` calls:

```js
module.exports = async function onPageDeleted(row, ctx) {
  for (const [name, handler] of loaded) {
    try {
      await handler(row, ctx);
      console.log(`[page-delete-hook] ${name} ran for ${row.app}/${row.type}#${row.id}`);
    } catch (e) {
      console.error(`[page-delete-hook] ${name} failed for ${row.app}/${row.type}#${row.id}: ${e.message}`);
    }
  }
};
```

Each handler is invoked in its own try/catch — the same reasoning as
`register-datatypes.js`'s own header comment: one broken/throwing handler must not take another
down with it. `dms-server` itself wraps the WHOLE composed call in another try/catch
(`cascadePageDelete`), so a total require failure of this file (bad path, syntax error) is logged
and simply skipped — a page delete never fails or rolls back because of this mechanism, with or
without a registered hook.

**Logging.** At boot, `register_page_delete_hooks.js` logs each handler it loads
(`[page-delete-hook] Registered: <name>`) and a total (`Loaded N of M page-delete hook(s)`) —
mirrors `dama/datatypes/index.js`'s `Registered: <name>` / `Mounted routes for N datatype(s)`
pair. At call time, `cascadePageDelete` in `dms.controller.js` logs
`[page-delete-hook] dispatched for <app>/<type>#<id>` right after the composed hook returns
(next to its existing failure log), and the composed function itself logs
`[page-delete-hook] <name> ran for <app>/<type>#<id>` per handler. A concrete handler like
`npmrds_report_page_delete_hook.js` additionally logs what it actually did (e.g. how many
`reports_snap_2` rows it removed) — the dispatch-level logs only confirm the mechanism fired,
not that a given handler's business logic matched anything.

Zero behavior change for any deployment that doesn't set `DMS_PAGE_DELETE_HOOK` at all.

## Handler contract

```js
// hooks/<name>.js
module.exports = async function onPageDeleted(row, ctx) {
  // row: { id, app, type } — the deleted page row, already gone from the DB by this point
  // ctx: { userId, reqMeta, dms_db, resolveTable, jsonField, dbType, splitMode }
  if (row.app !== 'your-app') return; // called for every app's page deletes — self-filter
  // ... your cleanup, using ctx.dms_db / ctx.resolveTable / ctx.jsonField directly
};
```

`ctx.jsonField(column, field)` is the controller's own `dbType`-aware JSON-column-extraction
helper (Postgres `->>'field'` vs SQLite `json_extract`) — use it instead of hand-rolling
dialect-specific SQL. `ctx.resolveTable(app, type, dbType, splitMode, sourceId)` resolves a split
`:data` type to its physical table (same helper `cascadeSourceDelete`/`cascadeViewDelete` use).

## Adding a new handler

1. Write `hooks/<name>.js` exporting the contract above.
2. Add one line to `register_page_delete_hooks.js`'s `HANDLERS` list: `['<name>', './<name>']`.
3. If it needs constants that might drift (ids, app names), give it its own JSON config file next
   to it (see `reports_snap_ids.json` for the pattern) rather than hardcoding inline — especially
   if the same values are also needed by a dev-time script elsewhere in the repo.
4. Rebuild/redeploy `dms-server` (`./deploy.sh`) so the boot loader picks it up. Local dev needs
   `DMS_PAGE_DELETE_HOOK` set in `.env` and a server restart (`npm run dev`'s nodemon watches
   source files, but a freshly-set env var needs the process itself restarted, not just a file
   save).

## CommonJS subtree

Like `data-types/`, this directory's `package.json` declares `"type": "commonjs"` to override the
repo root's `"type": "module"` — `dms-server` loads everything here via `require()`.
