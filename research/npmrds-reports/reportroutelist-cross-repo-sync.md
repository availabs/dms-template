# ReportRouteList (and friends): manual cross-repo sync required

## The fact

This started as a `ReportRouteList`-specific note but the same problem is broader:
transportNY keeps its **own separate copy** of both the `transportny` theme AND the
`@availabs/dms` library submodule, pinned to a different (older) commit than
dms-template's. Any dms-template feature built after that fork point — theme file or
library primitive — does not exist in transportNY until someone manually ports it.
Confirmed so far for `ReportRouteList` (theme-only) and, as of 2026-07-24, for the
Measure Picker / Quick Controls (theme **and** library primitives) — see "Second
instance" below.

### First instance: `ReportRouteList`

`ReportRouteList` exists as two **separate, independent files** in two separate git
repositories, with no submodule link, build step, package dependency, or any other
mechanism keeping them in sync:

- **dms-template**: `src/themes/transportny/components/ReportRouteList/` — the actively
  developed copy (hooks split: `useReportRow.js`, `useGraphPublish.js`, subcomponents
  `RouteRow.jsx`/`AddRouteBanner.jsx`/`utils.js`, theme in `ReportRouteList.theme.js`).
- **transportNY** (`/home/ryan/code/transportNY`):
  `src/dms_themes/transportny/components/ReportRouteList/` — a full copy of the same
  file set.

**A change to one does not propagate to the other.** Every fix, refactor, or feature
added to ReportRouteList in dms-template must be manually re-applied (or the whole
directory re-copied) into transportNY for it to take effect there, and vice versa.

#### Why transportNY has its own copy at all

transportNY is where the routecreation plugin lives (dms-template has no equivalent),
so it's the only place an end-to-end test of "create a route with the routecreation
tool, then add it to a report" can run. transportNY's copy was introduced by a
different developer (`alex`, commit `055f86d`, 2026-07-08) via a straight copy/paste
of the file as it existed in dms-template at the time — not by the primary author of
this component, and not through any tooling. It has drifted independently since.

#### One path difference to handle on every sync

The `@availabs/dms` submodule lives at a different path in each repo:

| Repo | Submodule path |
|---|---|
| dms-template | `src/dms` |
| transportNY | `src/modules/dms` |

So any relative import in the copied files of the form
`../../../../dms/packages/dms/src/...` must be rewritten to
`../../../../modules/dms/packages/dms/src/...` when copying dms-template → transportNY
(and the reverse when copying the other direction). This is the *only* systematic edit
needed — everything else has copied byte-for-byte cleanly as of the last full sync
(both repos' submodule checkouts, though pinned to different commits, have exposed the
same exports for every path ReportRouteList imports).

#### Last full sync (ReportRouteList)

2026-07-24 — dms-template's hooks-split refactor + the `route_id` → DMS `id` migration
fix (commit `1199668 fix route table using legacy route id`) was copied wholesale into
transportNY, replacing transportNY's older monolithic version. Uncommitted in
transportNY as of that date — check `git -C /home/ryan/code/transportNY status` before
assuming it's landed. Not live-browser-tested after that copy, only verified by
byte-diffing against the source and a Babel parse check.

### Second instance: Measure Picker / Quick Controls (2026-07-24)

Discovered while trying to switch a live report's graph from Speed to Travel Time
against transportNY's dev server: the Settings drawer had no "Measure" entry at all,
and no Quick Controls pill row — not because of any UI-state gate, but because
**transportNY's `@availabs/dms` submodule checkout predates the entire
`sectionMenuExtensions` / `sectionHeaderExtensions` extension-point mechanism**, not
just the theme components that use it. Confirmed by grepping transportNY's submodule
copy for `sectionMenuExtensions.js` / `sectionHeaderExtensions.js` — neither file
exists there, and neither `sectionMenu.jsx` nor `section.jsx` has the splice-in code
that reads them. This is a bigger gap than the ReportRouteList case: it's not just a
theme file missing, it's a **library-level extension point** the theme feature depends
on.

Ported (all as plain additive copies + the same submodule-path rewrite as above — no
submodule version bump attempted, since transportNY's `@availabs/dms` checkout is many
commits behind and a real bump risks pulling in a lot of unrelated, unverified change):

- **Library** (`transportNY/src/modules/dms/packages/dms/src/patterns/page/`):
  - New files: `components/sections/sectionMenuExtensions.js`,
    `components/sections/sectionHeaderExtensions.js` (copied verbatim from
    dms-template — no submodule-path imports in either file).
  - `components/sections/section.jsx`: added `siblingSections` derivation +
    `headerExtensions` computation/render block to **both** `SectionEdit` and
    `SectionView` (transportNY's `section.jsx` predates this pattern in both
    branches).
  - `components/sections/sectionMenu.jsx`: added the `extensionMenus` splice between
    the built-in `columns` and `filter` groups, and `siblingSections` to
    `getSectionMenuItems`'s destructured params.
  - `siteConfig.jsx`: added the two `if (theme.sectionMenuExtensions)` /
    `if (theme.sectionHeaderExtensions)` auto-registration blocks (same pattern as
    the existing `theme.pageComponents`/`theme.columnTypes` blocks already there).
  - `index.js`: added the two `register*Extensions` re-exports (parity with
    dms-template; not load-bearing since `siteConfig.jsx` imports them by relative
    path, not through the barrel).
- **Theme** (`transportNY/src/dms_themes/transportny/`):
  - New dirs: `components/QuickControls/` (`index.jsx` + `QuickControls.theme.js`),
    `components/MeasurePicker/` (`index.js` + `composeMeasureConfig.js`) — copied
    verbatim from dms-template except the one submodule-path import in
    `QuickControls/index.jsx` (`../../../../dms/...` → `../../../../modules/dms/...`).
  - `themev2.js` (the theme actually in use on this site — confirmed by checking
    which of `theme.js`/`themev2.js` already had `ReportRouteList` registered;
    `theme.js` didn't and appears dead): added the two imports, a
    `sectionMenuExtensions`/`sectionHeaderExtensions` const block (same shape as
    dms-template's), and both keys added to the final exported theme object. Also
    added `headerExtensionsRow: "px-3 pb-2"` to `pages.section.styles[0]` for
    padding (dms-template's version already had this; transportNY's didn't have the
    key at all, harmless either way since it's an optional className).
  - `theme.js` (v1) was **not** touched — it doesn't have `ReportRouteList` registered
    either, and nothing observed in this session suggested it's the active theme for
    any live site.
  - **Repo root**: `src/themes/transportny/components/MeasurePicker/{README.md,vocabulary.json}`
    copied wholesale (transportNY had no `data-types/` directory at all) —
    `composeMeasureConfig.js` imports this by a repo-root-relative path
    (`../../../../../data-types/...`), and since both copies sit at the same relative
    depth under their respective repo roots, no path rewrite was needed for this one.

**A real bug found and fixed in the vocabulary itself while verifying this port** (not
a sync issue — same bug exists in dms-template's own copy until this fix, since it was
never actually exercised end-to-end there either): the `travelTime` measure's
expression used `ds.`-prefixed columns (`ds.tmc`, `ds.travel_time_all_vehicles`) but
declares `requiresJoin: []`. The query engine only aliases the base table as `ds` when
a join is present — with no join, `ds.tmc` is an unresolvable identifier and the graph
fails silently downstream (blank chart; the actual ClickHouse "Unknown expression
identifier" error only surfaces if you go looking in the network tab). Fixed in
**both** copies of `vocabulary.json` by using bare column names
(`tmc`/`travel_time_all_vehicles`) for that one expression — see
`src/themes/transportny/components/MeasurePicker/vocabulary.json`'s `measures.travelTime`.

### Third instance — REVERSE drift: `RouteComparison` lives only in transportNY (found 2026-07-27)

Unlike the two cases above (dms-template → transportNY), this one goes the other way.
**`RouteComparison`** — a page section component described by its own README as "the DMS
replacement for the legacy npmrds *Batch Reports* tool" (the left builder rail: Scope · Routes ·
Periods · Metrics, driving a sibling native pivoted Spreadsheet) — exists **only** in transportNY:

- `transportNY/src/dms_themes/transportny/components/RouteComparison/` —
  `RouteComparison.jsx` (~28KB), `RouteComparison.theme.js`, `parseTmcArray.js`, `index.jsx`,
  `README.md`. Registered at `themev2.js:39,2449`. Committed in transportNY (`218f5f1`,
  `3c7bc80`), dated 2026-07-22.
- **dms-template has no trace of it** — a repo-wide grep is empty, and
  `git log --all -- src/themes/transportny/components/RouteComparison` returns nothing, so it was
  never here and then removed; it was authored in transportNY directly.
- Its own README documents its home as `src/themes/transportny/components/RouteComparison/`
  (dms-template's path convention, not transportNY's `src/dms_themes/...`), suggesting the
  dms-template layout was the intent.

**Status: flagged only, no action taken** (user decision 2026-07-27 — "you can flag it / mark it").
Per the standing rule the same day, the only code that *must* live in transportNY is **plugins**
(transportNY is a separately-deployed production frontend, and plugins like `routecreation` are one
of the reasons it has to be deployed at all). `RouteComparison` is not a plugin, so dms-template is
its canonical home whenever someone picks this up — but it is deliberately not blocking any
in-flight work.

**Do not** treat this as "reports parity is broken." Route Comparison is a distinct page type
(Batch Reports), not a section of a report page, and is explicitly out of scope for the report-spec
work (`planning/tasks/current/report-spec-and-build-script.md`).

### Verified in sync (2026-07-28)

User noticed the two-copy situation and asked (a) are they currently in sync, (b)
could dms-template become the real source of truth with transportNY reduced to just
the routecreation plugin.

(a) Diffed all 9 files in both `ReportRouteList/` directories byte-for-byte: identical
except the expected submodule import-path rewrite (`../../../../dms/...` vs
`../../../../modules/dms/...`) and one stale comment referencing an old script path.
Both repos' trees were clean and today's commits (`b6b3039 peak time reports` /
`81158df RRL updates`) landed the same content. Not diverged as of this date.

(b) Confirmed there is genuinely zero dependency mechanism between the repos (no
submodule, no npm reference, nothing — checked `.gitmodules` and `package.json` in
both). Getting to "transportNY only runs the plugin" for real would mean either an
automated sync script or extracting the shared theme into its own repo/package.
**User's decision: neither — keep the existing manual-copy discipline (dms-template is
authored, transportNY's copy is never hand-edited independently) with no new tooling.**
Scope of the fix was also explicitly limited to `ReportRouteList` only, not the rest of
the theme tree or the library-level extension-point gap (Measure Picker/QuickControls,
`sectionMenuExtensions`/`sectionHeaderExtensions`) documented above — those remain
open/unaddressed by this decision.

## How to apply (either instance)

Before considering any ReportRouteList / Measure Picker / Quick Controls (or future
theme-extension) change in either repo "done":
1. Decide whether the other repo needs the same change (usually yes, if the user might
   test via transportNY's dev server, since that's the only place routecreation-tool
   routes exist to test against).
2. Check whether the change depends on a **library-level** primitive, not just a theme
   file — if so, confirm the primitive actually exists in transportNY's
   `@availabs/dms` submodule checkout first (grep for it) rather than assuming theme
   parity implies library parity. The two submodules are pinned to different commits;
   theme-only features (ReportRouteList) happened to only need already-shared APIs,
   but that won't always be true.
3. Port it manually — diff the two directories/files, apply the same edit, and
   re-check the submodule import path in any touched file.
4. Don't assume a "done" status in one repo's task file reflects the other repo's
   state.
