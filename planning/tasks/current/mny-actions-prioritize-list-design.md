# MNY — Action Prioritize (list view) redesign in the design system

**Status:** in progress — 2026-07-14
**Owner:** Alex
**Scope:** `src/themes/mny/design/` (design system only). No live-page or theme changes in this task.

## Objective

Take the content of the live page **Action Prioritize**
(`county_template.devmny.org/track_progress/actions_database/actions_index/action_prioritize`,
page id **2239721**, pattern `MitigateNY_County_Template` 1300890, app `mitigat-ny-prod`)
and produce a tighter, more polished design in the mny design system — same content, better
UX, with the stat boxes and the filters brought up to the DS's standard.

The design must pull the user toward **assessing and updating action prioritization**, which is
the page's entire job and the one thing the current page does not surface at all.

## What the live page is (audited 2026-07-14)

One `content` section group, five sections:

| # | Section | What it renders |
|---|---|---|
| 1 | `lexical` | H2 "PRIORITIZE ACTIONS" + a **BACK TO ACTIONS** button pushed right with ~40 literal tab characters |
| 2 | `Card` | 4 calculated cells — All **473**, # Proposed **391**, # In-Progress **21**, # Discontinued **4**. Each cell is `isLink` with `location: "?implementation_status=…"`. The "All" cell has a hardcoded `cellBgColor: #FCF6EC` — a *fake* active state that never moves. |
| 3 | `lexical` | LIST VIEW / CARD VIEW buttons (card view = sibling page `action_prioritize_cards`, 2248975) |
| 4 | `Filter` | `size: 1/3` left rail — Search (OR-`like` over action_name / problem / solution), Jurisdiction (`geoid_juris` meta select), Implementation Status (select) |
| 5 | `Spreadsheet` | `size: 2/3`, `allowEditInView` + `liveEdit`. Columns: Jurisdiction · Implementation Status · Action Name · **County Priority** (5-tier select, `allowEditInView`, `defaultValue: "Please Select…"`), plus `openOut` detail columns (problem, solution, cost_range, estimated time, primary hazard). Filters exclude `implementation_status = Completed` → 433 of 473 rows. Attribution shown. |

Source: `Actions_Revised` (source 1029065 / view 1074456, `mitigat-ny-prod+actions_revised`), county fixed to
Sullivan (geoid 36105).

The five priority tiers: `Tier 1 – Top Implementation Priority`, `Tier 2 – Significant Priority`,
`Tier 3 – Important but Secondary Priority`, `Tier 4 – Long-Term/Opportunistic`, `Not Prioritized`.

### Problems the redesign fixes

1. Stat boxes are tall, empty, and their active state is a lie (hardcoded tint on "All").
2. The filter rail takes 1/3 of the width and is ~80% empty; the table it starves wraps every action name.
3. Nothing on the page reports **prioritization progress** — the user cannot see how much of the job is done.
4. Setting a priority is a bare `Please Select…` dropdown repeated 433 times; assigned and unassigned rows look identical.
5. The header's right-aligned button is built from tab characters.

## Decisions (agreed with Alex, 2026-07-14)

- **Deliverable:** a new DS page, `pages/actions-prioritize.html`. The existing card-based
  `pages/actions-prioritization.html` stays as-is (it is the card-view cousin).
- **Stats:** keep all four status counts (still `?implementation_status=` links, but with a *real*
  active state) tightened into one strip, and **add** a prioritization progress meter as the page's
  lede. Additive only — no original content dropped.
- **Filters:** move from the left rail to a **horizontal filter bar** above a full-width table
  (the DS already has this language: `patterns.html` Pattern 03), extended with a *Needs priority*
  toggle, removable active-filter tokens, and *Clear all*.
- **Priority cell:** unset → dashed amber **Set priority** affordance; set → a tier pill (T1 amber →
  T4 pale steel), one click from the 5-tier menu.
- **Views:** redesign the list view; keep the LIST/CARD toggle (moved into the filter bar).

## Deliverables

- [x] Audit the live page (browser + CLI) — done, table above
- [x] `pages/actions-prioritize.html` — the new page mockup (work header, progress lede + linked
      stat strip, horizontal filter bar with Needs-priority toggle, full-width editable worklist
      table with tier pills / set-priority affordance / open menu / expanded detail, footer + attribution)
- [x] `design-system/components.html` — status pill + county-priority tier pill (set/unset/editing),
      toggle chip (filter-bar switch), linked stat chip (default/hover/active + progress lede)
- [x] `design-system/patterns.html` — Pattern 11 (Progress Lede + Linked Stat Strip) and
      Pattern 12 (Assign-a-Value Worklist Row) + reference-table rows
- [x] dsWidget link to the new page added on **every** page that carries the widget
      (12 pages; old "Prioritize Actions" relabeled "Prioritize (Cards)", new "Prioritize (List)" added)
- [x] README page list updated

## Notes for the eventual live build (NOT in this task)

Most of the design maps onto primitives that already exist:

- Tier cell → the existing **`status_pill`** column type
  (`src/dms/packages/dms/src/ui/columnTypes/statusPill.jsx`): pill in view, single-select dropdown on
  edit via `allowEditInView`, variants chosen by a per-column `pillColors` map. Needs new mny
  `theme.pill` tier styles (mny has no `theme.pill` override today).
- Status cell → same column type, dotted `status_*` variants.
- Stat strip → the Card it already is, restyled.
- Filter bar → the Filter section with a new `bar` activeStyle in the mny theme.

Two things the platform does **not** have yet, and would need before the live page can match the mockup:

1. **A cell that knows it is active.** `isLink` Card cells carry a `location` (`?implementation_status=Proposed`)
   but have no way to style themselves when the current search params already match. Today's page fakes it
   with a fixed `cellBgColor`. Smallest fix: an `activeOnSearchParam` cardHint / column flag that applies a
   named style when `location`'s params match the live `PageContext` filters.
2. **An is-empty filter leaf.** *Needs priority* = `county_priority IS NULL OR = ''`. The filter ops in use
   (`filter`, `like`, `exclude`) can't express it.

Both are backward-compatible additions, and both need their own task (see
`feedback_primitive_change_tasks_bc`) before any live build.
