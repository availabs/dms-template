# Compact SideNav — outer content margin decoupled from rail width

**Project:** TransportNY · **Topic:** themes · **Status:** DONE, live-verified 2026-08-07. Real root
cause was `ReportRouteList`'s own "ROUTES" header bar sitting inside the generic section-cell's
`p-3` padding, not a SideNav/Layout margin mismatch (see "Correction" below for the wrong turn taken
first, and "Real fix" for what actually shipped). · **Started/finished:** 2026-08-07

## Correction (2026-08-07, same session): the original root-cause theory was incomplete

The section below ("Root cause") was written from reading `themev2.js`'s own internal defaults
only (`layout.options.activeStyle: 1`, `sideNav.options.activeStyle: 0`) — **without checking that
the live `npmrds_sub` *pattern* row (id `2100394`) carries its own theme override**:
`{"layout":{"options":{"activeStyle":0,"sideNav":{"activeStyle":null,...}}}}`. That pattern-level
override wins over `themev2.js`'s file-level defaults for every page under this pattern. Consequence:
`layout.options.activeStyle` is actually **0** ("default" layout style, `wrapper2` has **no margin
class at all**) for every npmrds_sub page unless a page explicitly overrides it — confirmed live via
`getBoundingClientRect()` on `/converted_reports/reports` (no page-level theme override): the
content column starts at x=256, exactly matching `SideNav`'s own `layoutContainer1` margin
(`lg:ml-64`, the "transportny-dark" expanded style) alone, with zero contribution from `Layout.jsx`'s
`wrapper2`. So on this pattern, **the SideNav's own margin is the sole, correct mechanism** — there
is no missing coupling to add.

**A real regression, introduced and reverted same session**: acting on the wrong theory, added a new
`layout.styles[]` entry (`"app_compact"`, `wrapper2: "...lg:ml-16"`) and set both pages that already
had `sideNav.activeStyle:1` (`2209200` Snapshot, `2195822` ny9d_beacon_spec_test) to also carry
`layout.options.activeStyle:3` pointing at it. Live-verified via `getBoundingClientRect()` that this
produced a genuine **double margin** — `layoutContainer1`'s own `lg:ml-16` (64px, a margin on a div
whose only child is `position:fixed` and so contributes nothing to flex layout, meaning the *margin*
still applies but nothing else does) **plus** the new `wrapper2`'s own `lg:ml-16` (64px) = 128px total
before content, an actual 64px blank gap that did not exist before this session touched anything.
**Reverted**: removed the `app_compact` style from `themev2.js` entirely, and `dms raw update`'d both
pages' `item.theme` back to their original `{"layout":{"options":{"sideNav":{"activeStyle":1}}}}`
shape (verified via direct DB read — title/other fields untouched). Live-verified after revert: the
white RRL panel's own box now starts at x=64, flush against the compact rail's own end (x=64) — no
gap, matches the pre-session state.

**Open question, not yet resolved**: given the corrected mechanism, it's unclear what Ryan's original
"blank space on the left, inconsistently applied" report was actually seeing — the two pages that
carry `sideNav.activeStyle:1` render correctly (single, non-doubled margin) once reverted, and every
other page uses the pattern's own default (also a single, correct margin). Screenshotted by Ryan
at `/edit/converted_reports/snapshot?routes=` same session; my own live check of that exact URL after
the revert showed no visible gap. Possible explanations not yet checked: (a) stale browser cache
showing the mid-session double-margin regression, now stale; (b) a different, smaller gap Ryan is
seeing that isn't explained by anything found so far — needs a fresh screenshot/description before
guessing further, per "don't spend forever trying to reproduce something stubborn." (c) the RRL
panel's own width class (`w-[340px]` "flush" vs `w-[302px]` "default", selected by the page's
`pages.sectionGroup` theme name) differing between pages — not yet checked as a source of visually
inconsistent spacing, distinct from the SideNav-margin mechanism investigated above.

## Rollout (2026-08-07): compact sidenav applied to all 16 template pages

Once the RRL header-bar fix above landed and the margin mechanism was fully understood (single
`sideNav.activeStyle:1` override, no `layout.options.activeStyle` needed — the `npmrds_sub` pattern's
own default already gives the no-margin "default" layout style), applied
`{"theme":{"layout":{"options":{"sideNav":{"activeStyle":1}}}}}` via `dms raw update` to all 16 real
template pages (the ones converted via `--template-id`, distinct from the 72 one-off `--report-id`
historical-report conversions — "template pages" has a precise meaning in this codebase, matching
Ryan's exact original wording): the 12 catalog templates (`converted_reports/{single_route,
one_week_study, annual_average_study, single_day_advanced, year_over_year, this_month_vs_last_month_
vs_last_year, monthly_congestion, monthly_speed_comparisons, snapshot, seasonality, bi_directional,
weekly_average}`) plus the 4 non-catalog templates (`covid_comparison`, `bottleneck_examples`,
`change_over_time_analysis_month_v1`, `weekly_averages`). Verified via direct DB read that every
write landed cleanly (titles/slugs untouched, only the `theme` key changed). Live-verified on two
pages that had never been touched before this rollout (`monthly_congestion`, plus the two pages
already fixed earlier this session) — compact rail flush against content, no gap, on a previously
untouched page too.

**Not included**: the 72 one-off `--report-id` conversions (individual historical client reports,
e.g. "Route 44 Incident Analysis April 2026") — out of scope per the precise "template pages" reading;
not something Ryan asked for and a much larger, separate blast radius if it turns out to be wanted
later.

## Real fix (2026-08-07): ReportRouteList's own header bar, not a Layout/SideNav margin

Once the pattern-level override was understood (see Correction above), Ryan pointed at the exact
visible artifact directly (screenshots) rather than the theory: a white sliver between the compact
rail and the RRL's dark "ROUTES" header pill — and, once found, the same sliver on the header's
right edge too ("same problem I assume" — correct guess).

**Root cause, confirmed via `getBoundingClientRect()`/`getComputedStyle()` at the exact pixel, not
guessed**: `ReportRouteList.jsx`'s whole render tree (`t.wrapper` → ... → `t.panelHead`, the dark
"ROUTES"/count/collapse bar) sits *inside* the generic SectionArray per-section grid-cell wrapper
(`pt-3 pr-3 pb-3 pl-3 relative group ... col-span-12` — the same wrapper every section on the page
gets, confirmed identical on a Route Map section). That wrapper's 12px padding is white/transparent,
sitting between the wrapper's true edges (flush with the rail on the left, flush with the RRL panel's
own `border-r` on the right) and `panelHead`'s own box. Because `panelHead` is styled dark
(`bg-[#12181F]`, closely matching the rail's own dark color), the 12px white padding strip reads as a
distinct "gap" even though it's the exact same padding every other section has — it only *looks* wrong
here because of the color coincidence, not because of a real layout defect. Confirmed present on BOTH
the compact-rail pages and the default expanded-rail pages equally — this was never a
compact-vs-expanded issue at all, contrary to the entire premise of the original bug report and this
task's own title.

**Fix**: `ReportRouteList.theme.js`'s `panelHead` gained `-mt-3 -mx-3`, canceling the ancestor's
top/left/right padding (bottom deliberately untouched — nothing sits flush below it, so there's no
matching visible seam there). `panelHead` already had its own `px-3` for icon/text spacing, which
now recreates the same 12px inset from the *true* edges instead of the ancestor's padded edges — so
the header's internal spacing is unchanged, only its outer position moved to bleed flush.

**Live-verified 2026-08-07**: zoomed screenshots of `converted_reports/snapshot`'s edit-mode RRL
panel, before/after — before: a ~12px white sliver on both the header's left (against the compact
rail) and right (against the panel's own border) edges, plus a smaller one on top; after: the dark
header bar bleeds flush to all three edges, matching the rail and panel border directly with zero
gap. No regression on the search box / route-list rows below it (untouched, still normally padded).
Regression-checked on `converted_reports/bi_directional` (default expanded 256px rail, no
`sideNav.activeStyle` override) — same fix, same clean flush result, confirming this was never
rail-width-dependent.

**Files touched**: `src/themes/transportny/components/ReportRouteList/ReportRouteList.theme.js`
(`panelHead` only — one line).

## Testing checklist

- [x] Compact-rail page (`converted_reports/snapshot`, `sideNav.activeStyle:1`): header bar flush on
      top/left/right, no white sliver — confirmed live 2026-08-07
- [x] Default expanded-rail page (`converted_reports/bi_directional`): same fix, same clean result —
      confirmed live 2026-08-07 (rules out any rail-width dependence)
- [x] No regression to the search box / route-list rows below the header bar
- [x] The earlier same-session regression (a genuine double-margin bug introduced by a wrong theory,
      `layout.styles[]`'s now-removed `app_compact` entry + `activeStyle:3` on 2 pages) was fully
      reverted before this real fix was found — confirmed via `git diff` showing zero diff on
      `themev2.js` and a direct DB read confirming both pages' `item.theme` back to their original
      `{"layout":{"options":{"sideNav":{"activeStyle":1}}}}` shape

## Original (incomplete) root-cause writeup, kept for the record — see correction above

Split out of Ryan's live triage of the reports catalog / template pages (2026-08-07): "sidebar still
has some blank space on the left, inconsistently applied. Also, all template pages should have the
compact sidenav." Investigated via a fresh Explore-agent pass; this is a distinct bug from the
`sidebarHideInView` rail-collapse fix already shipped in
`../completed/reports-page-template-catalog.md`'s hotfix section — that mechanism is confirmed correct
and not implicated here.

## Root cause (code-read, live DB check not yet done)

Two independent knobs currently drive different things and are never coupled:

1. **`sidenav.activeStyle`** (`src/themes/transportny/themev2.js:457-513`) picks which
   `sidenav.styles[]` entry renders the actual SideNav rail — controls `layoutContainer1`
   (content-side padding-equivalent) / `layoutContainer2` (the rail's own fixed width):
   - index 0 `"transportny-dark"`: `lg:ml-64` / `w-64` (256px) — **the default** (`sidenav.options.activeStyle: 0`)
   - index 1 `"compact"`: `lg:ml-16` / `w-16` (64px) — exists, unused by default anywhere found
2. **`layout.options.activeStyle`** (`themev2.js:239-254`) picks which `layout.styles[]` entry wraps
   the whole page — `styles[1]` ("app", the default for most pages per its own comment) hardcodes
   `wrapper2: "... lg:ml-60"` (240px), **independent of which `sidenav.styles[]` entry is active.**
   `Layout.jsx:49-50` resolves this via its own `layout.options.activeStyle`, entirely separate from
   `SideNav`/`DesktopSidebar`'s `sideNav.activeStyle` (`Layout.theme.jsx:78-90`).

`layout.options.sideNav.size: "compact"` (`themev2.js:239-254`) is a red herring — per
`Layout.theme.jsx:195` its only two values are `'none'`/`'compact'` meaning **hide/show the rail
entirely**, not a width variant. The actual width variant is `sideNav.activeStyle`.

**Mechanism**: `wrapper2`'s margin is a fixed per-Layout-style class, not reactive to the rail's real
rendered width. At the default (`sidenav.activeStyle: 0`, 256px rail) there's already a minor
16px mismatch (`ml-60`=240px vs a 256px rail) that's probably not visually obvious. But if any page or
pattern is switched to the compact rail (`sidenav.activeStyle: 1`, 64px) without also changing
`wrapper2`, the margin stays 240px — a **176px blank gap** between the 64px rail and where content
starts. This exactly matches "blank space on the left."

**"Inconsistently applied"**: `sideNav.activeStyle` has no pattern-wide override found (no grep hit in
`npmrds_sub`'s `siteConfig.jsx` or theme config) — the only existing override path is per-page, via the
page editor's Settings pane (`settingsPane.jsx:388-417`, `item.theme.layout.options.sideNav.activeStyle`).
If some report pages have had this hand-set to `1`/`"compact"` (by Ryan or a prior session) while most
haven't, that would directly produce the "some pages have the gap, most don't" symptom — **not yet
confirmed against the live DB**, see Next steps.

## Objective

1. Decouple no further — **couple** `wrapper2`'s margin to the sidenav's actual rendered width, so
   switching `sidenav.activeStyle` can never again leave a mismatched gap. Likely shape: move the
   content-margin class onto `sidenav.styles[]` itself (alongside `layoutContainer1`) and have
   `Layout.jsx` read it from there instead of (or in addition to) the separate `layout.styles[]`
   entry — needs a design look at `Layout.jsx`/`Layout.theme.jsx` before touching, since
   `layout.options.activeStyle` controls other things in `layout.styles[]` besides just this margin
   (per-style backgrounds, etc.) that a naive coupling could break.
2. Once decoupled and safe, set the **compact** rail (`sidenav.activeStyle: 1`) as the default for
   NPMRDS template/report pages specifically — Ryan: "all template pages should have the compact
   sidenav." Scope this to the `npmrds_sub` pattern (or the report-page template specifically), not a
   theme-wide flip — `transportny` theme serves other patterns (routes, home, macro) this shouldn't
   silently affect. Confirm with Ryan whether "template pages" means just the 12+4 converted
   report pages or the whole `npmrds_sub` pattern before applying broadly.

## Next steps (not yet done)

- [ ] Query the live DB: does any `npmrds_sub|page` row already carry
  `item.theme.layout.options.sideNav.activeStyle` set to `1`/`"compact"`? This would directly confirm
  (or rule out) the "inconsistently applied" hypothesis before writing any code.
- [ ] Read `Layout.jsx`/`Layout.theme.jsx` in full to design the coupling fix without breaking other
  `layout.styles[]`-driven behavior (this task's investigation did not read those files' full bodies,
  only located the relevant lines).
- [ ] Confirm scope of "all template pages should have the compact sidenav" with Ryan (pattern-wide
  vs. just the report/template pages) before applying.
- [ ] Implement the coupling fix, verify live on a page currently at the default (expanded) style —
  confirm no visual regression — then verify on a page switched to compact — confirm no gap.
- [ ] Live-verify via `report_probe.mjs`/screenshot on at least one converted_reports page before and
  after.

## Files likely touched

- `src/themes/transportny/themev2.js` (`sidenav`, `layout` theme objects)
- `src/dms/packages/dms/src/.../Layout.jsx` / `Layout.theme.jsx` (exact paths TBD — read fully before
  editing)
- Possibly `src/themes/transportny/patterns/npmrds_sub/siteConfig.jsx` or equivalent, if the fix is a
  per-pattern default rather than a theme-wide one

## Testing checklist

- [ ] No visual regression on a page using the current default (expanded) sidenav style
- [ ] No blank gap on a page switched to the compact sidenav style
- [ ] Compact sidenav applied to the intended scope of template/report pages, confirmed live
