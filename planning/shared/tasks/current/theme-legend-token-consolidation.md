# Theme `legend*` tokens — consolidate / standardize (SCOPING ONLY, not started)

**Project:** Shared · **Topic:** themes · **Status:** **NOT STARTED — scoping task, do not implement.**
· **Opened:** 2026-09-10

> **Do not investigate yet.** Ryan asked for this to be written down, explicitly deferring the
> investigation: *"Can you add to a TODO, to investigate and scope the consolidation /
> standardization of these tokens? Dont actually investigate now please."* Everything below is what
> was already on screen when the request was made — no extra digging was done for it.

## Why this exists — Ryan, 2026-09-10

> "these `legend` token locations, they vary slightly per project? Our implementation, and I guess
> the few before ours, feel like a 'landmine' for future devs... shouldn't all these legend token
> locations be in one place? Otherwise we end up with a bunch of nested or one-of conditionals that
> were added for specific theme things, right?"

This came directly out of a live break, which is the concrete evidence that the concern is real —
see "The incident" below.

## The evidence already in hand

One key name, `legend`, is authored inside **at least six different component blocks** across the
themes, meaning six different things. Found while checking the blast radius of wiring the avlGraph
legend tokens (`grep` over `src/themes/`, excluding `macroview`):

| where | block | what it actually styles |
|---|---|---|
| `transportny/themev2.js:1987` | **`avlGraph`** | the chart legend — the one just wired |
| `transportny/themev2.js:3110` | `dots` | something else entirely |
| `mny/theme.js:952` | `stackedBar` | a stacked-bar legend |
| `landbank/theme.js:1951-1958` | `stackedBar` | ditto, **plus** its own `legendSwatch` / `legendLabel` |
| `tessera/tessera-theme{,-v6}.js:935-984` | `sizes` / map | a map legend panel (absolute-positioned) |
| `wcdb/ScheduleGrid.theme.js:59` | `ScheduleGrid` | a schedule-grid key |

Plus `transportny/components/macroview/macroview.theme.js:160-194`, which has its own
`legendTick` / `legendTickFirst` / `legendSwatch` / `legendLabel` set — the same vocabulary again,
in a component-local theme file.

So `legendSwatch` and `legendLabel` already exist in **three unrelated places** with three
independent meanings, and nothing tells an author or a dev which one they are editing.

## The incident that prompted it (2026-09-10)

`transportny/themev2.js:1987` had carried
`legend: "flex items-center gap-4 font-mono text-[10.5px] uppercase tracking-wider text-slate-500"`
for a long time as **dead scaffolding** — authored, never read. The moment the avlGraph legend
gained a class-token layer, that value went **live with no code change to the theme**, landing
`flex` on the gradient legend's container. The ramp is a `width: 100%` block, so as a flex item it
shrink-wrapped and stopped spanning the box the absolutely-positioned tick labels are placed
against — the labels fell back on top of the colour, reintroducing the exact defect the geometry
pass had removed. Ryan caught it on the live client within minutes: *"specifically looking at the
legend since u are changing it, it now has the overlapping text onto color."*

Fixed on both sides (component no longer applies the row token to linear legends; the theme value
dropped its display classes) — see
`src/dms/planning/tasks/current/avlgraph-legend-and-padding-theming.md`, "Item 1". **The
generalisable lesson, and the reason this task exists: wiring a previously-dead theme token is a
silent, repo-wide behaviour change for every site that had already authored it.** There is
currently no way to ask "who has authored this token, and is anything reading it?"

## What a scoping pass should answer

1. **Inventory.** Every `legend*` token in every theme and component-local theme file, with the
   block it sits in and whether anything actually reads it. Distinguish *live* from *dead* — the
   dead ones are the landmines.
2. **Is one namespace even right?** A chart legend, a map legend panel and a schedule-grid key are
   genuinely different objects; the goal is probably *predictable, documented per-component
   namespaces* rather than one shared bag. Ryan's "nested or one-of conditionals" worry is about
   the alternative — special-casing accumulating inside the components.
3. **A dead-token story.** Either a naming convention that marks intent-not-yet-wired, or a check
   that fails when a theme authors a key no component reads. This is the piece that would have
   caught the incident above before it shipped.
4. **The structural-vs-look split**, which the avlGraph work had to invent ad hoc and which every
   other component will need too: a token may replace the *look* it names but never the
   *structural* classes around it, because a brand cannot know which variant its token reaches.
5. **Whether `Layer A / Layer B`** (class strings on the style vs. flat CSS/numeric keys under
   `chartDefaults`) should be a documented repo-wide convention rather than an avlGraph-local one.

## Related

- `src/dms/planning/tasks/current/avlgraph-legend-and-padding-theming.md` — where the incident and
  the structural-vs-look rule are written up.
- `src/dms/skills/translating-design-system-to-dms-theme.md` — already documents that invented theme
  keys silently no-op (the TopNav/SideNav gap). This task is the same failure mode from the other
  direction: a real key that nothing reads *yet*.
