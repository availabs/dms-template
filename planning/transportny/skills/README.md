# TransportNY plugin skills

How-to guides and methodology references for the `routing` and `detour` MapEditor plugins
(app `transportny`).

> **Where these live and why.** Committed here, alongside the TransportNY project's task docs,
> rather than in [`src/dms/skills/`](../../../src/dms/skills/README.md) — that directory is the
> `@availabs/dms` **submodule**, and these two plugins (`src/themes/transportny/components/routing/`,
> `.../detour/`, `data-types/routing/`) are site content, not library capability. They sit outside
> `tasks/` because a skill has no completion state; `planning/planning-rules.md` allows project
> material that isn't a task to live directly in the project folder (see
> `planning/mitigateny/skills/` for the same pattern on a different project).

## The skills

| Skill | Use when |
|---|---|
| [`detour-and-routing-plugins.md`](./detour-and-routing-plugins.md) | Attaching/configuring the `routing` (point-to-point) or `detour` (avoid-segment) plugin on a map, or understanding/changing how either picks its start/end points and computes a route. **Start here.** |

## Related reference material (not skills, but load-bearing)

- [`documentation/detour-plugin-pipeline.md`](../../../documentation/detour-plugin-pipeline.md) —
  the full technical pipeline: segment matching across conflation years, endpoint derivation, route
  computation/measurement, closure-density mode. Read this before changing backend code.
- [`documentation/closure-density-point-selection.md`](../../../documentation/closure-density-point-selection.md) —
  the settled, detailed rules for closure-density candidate-point selection specifically. Read
  this before touching `selectClosureDensityCandidates`/`farthestToNearestNodes` in
  `data-types/routing/memoryGraph.js`.
- [`planning/transportny/tasks/current/point-to-point-routing-plugin.md`](../tasks/current/point-to-point-routing-plugin.md)
  and [`planning/transportny/tasks/current/detour-avoid-segment-routing-plugin.md`](../tasks/current/detour-avoid-segment-routing-plugin.md) —
  full chronological build history for each plugin: every bug found, every fix tried, every
  revert, in the user's own words. The skill and documentation files above are the SETTLED
  current state; these task files are the record of how it got there and what's still open.
