# ReportRouteList: manual cross-repo sync required

## The fact

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

## Why transportNY has its own copy at all

transportNY is where the routecreation plugin lives (dms-template has no equivalent),
so it's the only place an end-to-end test of "create a route with the routecreation
tool, then add it to a report" can run. transportNY's copy was introduced by a
different developer (`alex`, commit `055f86d`, 2026-07-08) via a straight copy/paste
of the file as it existed in dms-template at the time — not by the primary author of
this component, and not through any tooling. It has drifted independently since.

## One path difference to handle on every sync

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

## Last full sync

2026-07-24 — dms-template's hooks-split refactor + the `route_id` → DMS `id` migration
fix (commit `1199668 fix route table using legacy route id`) was copied wholesale into
transportNY, replacing transportNY's older monolithic version. Uncommitted in
transportNY as of that date — check `git -C /home/ryan/code/transportNY status` before
assuming it's landed. Not live-browser-tested after that copy, only verified by
byte-diffing against the source and a Babel parse check.

## How to apply

Before considering any ReportRouteList change in either repo "done":
1. Decide whether the other repo needs the same change (usually yes, if the user might
   test via transportNY's dev server, since that's the only place routecreation-tool
   routes exist to test against).
2. Port it manually — diff the two directories, apply the same edit, and re-check the
   submodule import path in any touched file.
3. Don't assume a "done" status in one repo's task file reflects the other repo's state.
