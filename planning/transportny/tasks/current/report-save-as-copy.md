# Report "Save as" — copy / convert a report page

**Project:** TransportNY · **Topic:** themes · **Status:** BUILT + LIVE-VERIFIED · **Started:** 2026-09-15 · **Shipped:** 2026-09-15

## Objective

Give a report viewer/author a "Save as…" action on the report canvas header that creates a NEW
report page from the one they're looking at, with three outcomes:

1. **Copy** — same kind as the source (static→static, dynamic→dynamic).
2. **Save as Dynamic Report** — from a static report: routes become slots, viewers pick their own.
3. **Save as Static Report** — from a dynamic report: the currently-resolved routes freeze in.

Scoped strictly to NPMRDS reports. Explicitly NOT the core DMS `{pattern}|page_template` system
(`settingsPane.jsx`'s "Save as Template" / `PageTemplatePicker`) — that stays untouched.

## Scope

**In:** a copy button in `ReportPageHeader`'s action row (view AND edit mode) — labelled
**`Save as` in edit mode, `Save a copy` in view mode** — a modal with name + report-kind choice,
page duplication (sections/section groups/filters/sidebar/dataSources), a fresh `reports_snap_2`
catalog row, and the user/agency tag rewrite.

**Out:** core `page_template` rows, the `/reports` 12-card catalog binding, folders/permissions,
any change to the 12 curated Dynamic Report template pages.

## Current State

- Core DMS has **no** page-duplicate path. `newPage()` (`editFunctions.jsx:62`) only materializes a
  template and hardcodes `title: 'Page {N}'`.
- Core's "Save as Template" (`settingsPane.jsx:167` → `buildPageTemplatePayload`,
  `patterns/utils.js:46`) stores `draft_sections`/`draft_section_groups`/`sidebar` and **drops
  `filters`** — so it cannot represent a Dynamic Report. Not used here.
- RRL already converts a report between kinds **in place**: `convertStaticToDynamic`
  (`ReportRouteList.jsx:355`) and `convertDynamicToStatic` (`:441`), behind the "Dynamic Report"
  Switch (`:875`). Both fuse a pure transform with a write against the CURRENT page.
- The report's routes/tags live in one `reports_snap_2` row keyed `report_id` = page id
  (`useReportRow.js:40`). `ReportPageHeader` already reads/writes that row binding-free via
  `useReportCatalogRow.js` + `buildReportCatalogSource(app)`.

## Load-bearing findings (verified in code, not assumed)

1. **View mode renders `item.sections` only** — `const sections = edit ? item?.draft_sections :
   item?.sections` (`pages/_utils/index.js:258`). A copy written with only `draft_sections` (the
   `newPage`/template path) renders BLANK in view mode. `CreateReportButton` never hits this
   because it lands on `/edit/...`. → **the copy writes both arrays**, id-stripped, and creates the
   page clean (`published: ''`), which is exactly the shape `publish()` already produces
   (`editFunctions.jsx:178`).
2. **`apiUpdate` returns the new row's id on create** — `if(!data.id) return resData`
   (`dms-manager/wrapper.jsx:130`). Needed for the catalog row's `report_id`. Omitting `newPath`
   means it does not navigate, so the sequence can create → write catalog → then navigate.
3. **View mode's PageContext carries `apiUpdate`/`apiLoad`/`dataItems`/`format`**
   (`view.jsx:210`), so view-mode save-as is possible. It does NOT carry `updateAttribute` — fine,
   we navigate away rather than optimistically patching local state.
4. **Route ids need no remapping.** `route_comp_id` is page-local (`comp-N`,
   `useReportRow.js:423`) and graph↔route binding is `_measurePick.routeIds`. `routes[].graphIds`
   is documented stale/write-once (`ReportRouteList.jsx:306`) and is ignored.
5. **dynamic→static also rewrites SECTION content**, not just routes: `freezeSectionDisplayText`
   (`ReportRouteList.jsx:49`) freezes `%n`/`%y` tokens baked into graph titles/captions. RRL can
   only do this to `draft_sections` (a published-row overwrite is a silent no-op in place) — but a
   COPY mints fresh published rows, so the copy path can and should freeze BOTH arrays.
6. **The tag rule is already encoded**: `isTagAllowedForUser` (`tagCategories.js`) returns true for
   county/region/category/difficulty and, for `agency:` tags, only when the copier is in that
   group. No new logic needed.

## Proposed Changes

### Title / slug

`url_slug` derives from `title` (`getUrlSlug` → `toSnakeCase`), so the copied title must differ.
Follows the repo's existing duplicate idiom, `"<name> Copy <n>"` (`controls_utils.js:131`):
`"<title> Copy"`, then `"<title> Copy 2"`, `"Copy 3"`… deduped against **sibling titles** up front
so the slug stays clean (`foo_copy`, `foo_copy_2`) instead of falling through to `getUrlSlug`'s
`_<index>` collision escape hatch. Pre-filled in an editable field; the author can override.

### Tags

```js
const tags = [
  makeUserTag(user.id),
  ...sourceTags.filter(t => !isUserTag(t) && isTagAllowedForUser(t, user)),
];
```
Plus `dynamic_report_template` and `auto_generated` are dropped — they're "curated, shown to
everyone" provenance markers a personal copy must not claim (confirmed with Ryan 2026-09-15).

### Landing

Same mode you started in: view → the copy's view URL, edit → the copy's `/edit/` URL.

### Unresolved dynamic→static

Converting to static needs resolved routes. In view mode the button is unreachable without them.
In edit mode the Static option is disabled with a "pick routes first" tooltip, rather than chaining
a second route-picker modal (confirmed with Ryan 2026-09-15).

## Files Requiring Changes

| File | Change |
|---|---|
| `ReportRouteList/reportKindConversion.js` | **NEW** — pure transforms extracted from RRL: `routesToSlots`, `slotsToStaticRoutes`, `dynamicReportFilters`/`staticReportFilters`, `catalogFromResolvedRoutes`, `freezeSectionDisplayText`, `CATALOG_SNAPSHOT_FIELDS` |
| `ReportPageHeader/SaveAsReportModal.jsx` + `.theme.js` | **NEW** — name field, kind radios, tag preview |
| `ReportPageHeader/useSaveAsReport.js` | **NEW** — create page → write catalog row → navigate |
| `ReportPageHeader/useReportCatalogRow.js` | expose `routes`/`graphCount`/`countsLabel`; add create-for-new-page write |
| `ReportPageHeader/ReportPageHeader.jsx` + `.theme.js` | the button + modal wiring |
| `ReportRouteList/ReportRouteList.jsx` | consume the extracted transforms (one definition of "what dynamic means") |

Zero `src/dms` changes.

## Testing Checklist

All verified live 2026-09-15 on the local dev stack (Vite 5173 + dms-server 3001), user 993.

- [x] Copy a plain static report → new sibling page, routes intact, **renders in VIEW mode** (finding 1)
- [x] Copy a dynamic report as dynamic → slots + `routeSlots`/`baseDate` filters intact
- [x] Static → Dynamic: routes become `%n (%y)` slots, entry gate appears for a viewer
- [x] Dynamic → Static: resolved routes freeze, real route id + `tmc_array` baked in
- [x] Tags: user tag swapped; agency tags kept only for the copier's groups; special tags dropped
- [x] Title/slug: `Copy` suffix, clean derived slug, no collision
- [x] Landing mode matches the mode you started in (view→view, edit→edit)
- [x] **The 12 curated dynamic reports are untouched** — all still `updated_at` 2026-09-11
- [x] Golden-corpus probe suite after the RRL extraction, in isolation — 10/10 PASS
- [x] 24 unit tests on the pure logic (`saveAsReport.test.js`)
- [x] Zero console errors across the whole live session

### What was exercised, end to end

| Step | Source | Result | Verified |
|---|---|---|---|
| Copy (static→static) | `reports/menands_test` (view mode) | `reports/menands_test_copy` (2224538) | Renders in view mode with graph + route pill; 6 brand-new component rows, **disjoint** from the source's; catalog row 2224539 with routes copied verbatim |
| Static → Dynamic | `menands_test_copy` (view mode) | `reports/claude_save_as_dynamic_fixture` (2224546) | Landed on the **route-selection entry gate**; slot name `"%n (%y)"`; catalog-snapshot fields stripped; `comp-0`/color kept; both dynamic filters written |
| Dynamic → Static | the fixture, routes resolved to `?routes=2216791` | `reports/claude_save_as_frozen_static` (2224554) | Route name frozen to literal `Route 5 Part (2026)`; real id `2216791` + `tmc_array` baked in; `catalogRouteName` dropped; `filters` back to `[]`; no `?routes=` in URL |
| Copy from EDIT mode | `claude_save_as_frozen_static` | `..._copy` (2224562) | Stayed in `/edit/`; both section arrays written (proves `pickHydrated` works off `draft_sections` too) |
| Tag scoping (drop path) | `reports/787_nb_5_12_2026` (6 agency tags) | dialog preview only, not saved | Kept You/AVAIL/NYSDOT; struck through MHV, NPMRDS New Users, NYSDOT Admin, SMTC, UCTC |

### Fixture pages left behind (intentionally, per Ryan 2026-09-15)

`reports/menands_test_copy`, `reports/claude_save_as_dynamic_fixture`,
`reports/claude_save_as_frozen_static`, `reports/claude_save_as_frozen_static_copy`.
All siblings under `converted_reports` (2188366). Safe to delete whenever.

## Notes for whoever picks this up next

**Design change made during the build.** The plan said `useReportCatalogRow.js` would be widened to
expose `routes`. It wasn't: `buildReportCatalogSource` deliberately omits `routes` because it's a
large JSON blob no list view needs, and that hook runs on **every** report header render. Save-as
got its own on-demand fetch in `useSaveAsReport.js` instead, fired only when the dialog opens —
same reasoning `useReportCatalogRow` itself gives for not sharing RRL's fetch.

**Why dynamic→static resolves routes through `useDynamicReportRoutes` rather than the broadcast
catalog.** The header already has `routeCatalog` (RRL's `ROUTE_CATALOG_PARAM_KEY` broadcast) and it
looks like the resolved route list, but it is a deliberately **lossy subset** — no
`route_slot_group`, `description`, `metadata`, `conflation_array`/`conflation_version`,
`created_by`/`created_at`. Freezing from it would silently degrade every route it wrote. The header
therefore reproduces RRL's own `effectiveRoutes` from the same inputs. Confirmed live: the frozen
route came out with `tmc_array` and the real catalog id present.

### Out of scope, found while verifying

A stored route object carries junk keys written at add time by the route picker —
`alreadyAdded`, a route-`tags` snapshot, and two raw SQL rank expressions as literal JSON keys
(`"case when (data->>'name') ~* '^(i|us|ny)-[0-9]' then 0 else 1 end as road_rank"`). **Pre-existing,
not introduced here** — verified present on the untouched source report 2224508, and the copy's key
set is identical to the source's. Harmless today (they're inert passengers) but they ride along into
every copy, and `routesToSlots` keeps them since they aren't catalog-snapshot fields.

### Retracted: the "three header icons render nothing" claim

An earlier draft of this doc claimed `LinkSquare`/`Printer`/`PencilEditSquare` render nothing
because they're absent from `src/themes/transportny/icons.jsx`. **That was wrong** (Ryan, same day:
"I see a printer in the header"). `Icon.jsx:29` resolves
`theme?.Icons?.[icon] || icons[icon] || DefaultIcon` — a three-tier chain, so a name missing from
the BRAND registry falls back to the **core** set at
`src/dms/packages/dms/src/ui/icons/`, where all three are defined. A name missing from both still
renders `DefaultIcon` (a shield), never nothing.

The method error worth remembering: the claim was made by grepping ONE registry file, not by
reading the component that resolves the name. The "an unregistered icon renders nothing" rule from
`managing-design-system-icons.md` is about a different layer (a name referenced in `theme.js` that
the design-system registry never defined), and does not describe `Icon`'s runtime fallback.

Consequence for this build: the Save as button was originally given `Pages` on that false premise.
Since the whole core set is actually reachable, it now uses **`Copy`** (core `icon_defs.jsx`), which
is both semantically right and in the same visual family as the header's other three. Verified live
— all four glyphs render.

### Label is mode-dependent (2026-09-15, Ryan)

The action-row button reads **`Save as` in edit mode** and **`Save a copy` in view mode**. Ryan's
reasoning, which overrode the original single-label decision: *"`save as` doesn't make sense when
you are `viewing` a report, there's no 'vanilla save' to contrast to."* "Save as" is a contrastive
label — it needs a plain Save beside it to mean anything. Edit mode has one (Done, which
publishes); a viewer has none, so they get the literal action.

Only the action-row label varies. The dialog itself is unchanged in both modes ("Save a copy"
header, "Save copy" confirm), and so is every behavior. Verified live: view mode renders
`SHARE · PRINT · SAVE A COPY · EDIT`, edit mode renders `SHARE · PRINT · SAVE AS · DONE`.
