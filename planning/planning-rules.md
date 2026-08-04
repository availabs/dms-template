# Planning Directory Structure

This document describes the structure and conventions for the **dms-template** planning directory.

This directory is **shared among many users**. Multiple people (and agents) work in it at once, on
unrelated client projects. The conventions below exist so that two people working on different
projects never collide, and so anyone can tell at a glance which project a piece of work belongs to.

This is a separate planning system from `src/dms/planning/`, which tracks work on the
`@availabs/dms` library submodule itself. This directory (`planning/` at the repo root) tracks work
on **dms-template** — the sites: theming (`src/themes/`), data-type plugins (`data-types/`),
deployment/config, and any site-specific content or integration work that isn't a change to the
`@availabs/dms` library. If a task turns out to require a library change, do that work under
`src/dms/planning/` instead (see its `planning-rules.md`).

## Rule 1: every task belongs to exactly one project

**No task file lives outside a project folder, and no `todo.md` / `completed.md` entry sits outside a
project section.** A task without a project has no owner and no context, so it must not exist here.

- Task files live in `planning/<project>/tasks/current/` and `planning/<project>/tasks/completed/`.
- Every task file starts with a `**Project:**` line in its header block (see
  [Task Files](#task-files-projecttaskscurrent-and-projecttaskscompleted)).
- If a task genuinely serves more than one project (platform-level dms-template work — shared theme
  infrastructure, deployment, a data-type plugin used by several sites), it goes in the
  **`shared`** project. `shared` is the only home for cross-project work; don't file the same task
  under two projects.
- If you can't tell which project a task belongs to, ask the requester before creating the file.

## Project registry

The two main projects are **mitigateNY** and **transportNY**. The full list:

| Project | Folder | Scope |
|---|---|---|
| **MitigateNY** | `mitigateny/` | MitigateNY 1.0/2.0 — hazard mitigation plans, county templates, actions data, county/jurisdiction migrations (`mitigat-ny-prod`, `mny` theme) |
| **TransportNY** | `transportny/` | NPMRDS reports & route creation, Freight Atlas / TSMO surfaces and their QA process (`transportny` theme) |
| **Tessera** | `tessera/` | tessera.so product site — landing/features/docs pages, `tessera*` design systems and themes |
| **Landbank** | `landbank/` | Albany County Land Bank site + admin panel (`landbank` theme, `landbank` app) |
| **Shared** | `shared/` | Cross-project dms-template work: shared theme infrastructure, `data-types/`, deployment/build config, CLI/tooling used by every site |

### Adding a project

Projects are cheap; add one as soon as a second task shows up for the same client or site.

1. `mkdir -p planning/<project>/tasks/current planning/<project>/tasks/completed`
2. Add a row to the registry table above (project name, folder, one-line scope).
3. Add a `## <Project>` section to `todo.md` and `completed.md`.
4. Use the lowercase, no-punctuation folder name (`mitigateny`, `transportny`) even where the
   display name is camel-cased (MitigateNY, TransportNY).

Project-specific material that isn't a task (QA process docs, run logs, reference captures) can live
directly in the project folder outside `tasks/` — e.g. `transportny/qa-process/runs/`.

## Directory Structure

```
planning/
├── planning-rules.md            # This file — structure documentation + project registry
├── todo.md                      # Shared active-task index, grouped by project
├── completed.md                 # Shared completed-task index, grouped by project
├── mitigateny/
│   └── tasks/
│       ├── current/             # Detailed task documents for work in progress
│       └── completed/           # Archived task documents for completed work
├── transportny/
│   ├── qa-process/              # Project material that isn't a task (process docs, run logs)
│   └── tasks/{current,completed}/
├── tessera/tasks/{current,completed}/
├── landbank/tasks/{current,completed}/
└── shared/tasks/{current,completed}/
roadmap.md                       # High-level roadmap and vision (repo root)
research/                        # Research documents — tech analysis, design exploration, options evaluation
└── **/*.md                      # One folder/file per topic (e.g., research/npmrds-reports/)
documentation/                   # System documentation — how things work, schemas, reference material
└── *.md                         # One file per topic
```

`todo.md` and `completed.md` are deliberately **shared, single files** — one place to see everything
in flight across all projects. The per-project folders hold the detailed task documents.

### Where to put research vs. documentation

- **`research/`** (repo root) — Exploratory analysis, tech stack evaluations, design options, proof-of-concept code, recommendations. These inform decisions and task creation. They may become outdated as decisions are made.
- **`documentation/`** (repo root) — Factual reference material describing how things work (or worked). Schema docs, architecture overviews, operational guides. Create this folder when the first doc is written. These should be kept accurate as the system evolves.

## File Conventions

### todo.md

Active tasks grouped **by project first**, then by topic:

```markdown
# DMS Template Todo

## TransportNY

### themes

- [ ] [Task title](./transportny/tasks/current/task-name.md) — description

## MitigateNY

### content

- [ ] [Task title](./mitigateny/tasks/current/task-name.md) — description
```

Link paths are always project-qualified (`./<project>/tasks/current/…`).

### completed.md

Completed tasks under the same project → topic hierarchy, with dates:

```markdown
# DMS Template Completed Tasks

## TransportNY

### themes

- [task-name.md](./transportny/tasks/completed/task-name.md) - Brief description (YYYY-MM-DD)
```

### Task Files (`<project>/tasks/current/` and `<project>/tasks/completed/`)

Every task file opens with a header block naming the project:

```markdown
# Task title

**Project:** TransportNY · **Topic:** themes · **Status:** IN PROGRESS · **Started:** YYYY-MM-DD
```

Then the body:
- **Objective** - What the task accomplishes
- **Scope** - What's included/excluded
- **Current State** - How things work now
- **Proposed Changes** - What will change
- **Files Requiring Changes** - Specific files and modifications
- **Testing Checklist** - How to verify the changes work

A task that grows too long to read gets split into a live status doc plus a
`<task-name>-archive.md` beside it (see `transportny/tasks/current/report-page-redesign.md` and its
archive for the pattern). Both files stay in the same project folder.

## Topic Hierarchy

Within a project, tasks are organized under these topics (add new ones as needed):

### themes
Theme definitions in `src/themes/` — layout, styling, navigation, component theming per brand/site.

### data-types
DataType plugins in `data-types/` and their server registration (`server/register-datatypes.js`).

### deployment
Netlify/Docker deployment config, build tooling, environment configuration.

### content
Site-specific page/pattern content authored through the DMS admin UI but tracked here when it requires coordinated developer work (e.g., a migration, a bulk content operation).

### data
Dataset loads, backfills, and data-quality work against a project's sources.

### dms (library escalation)
Tasks that started here but turned out to require a change in the `@availabs/dms` library — link to the corresponding task in `src/dms/planning/` rather than duplicating.

## Workflow

1. **Assign the project first.** Decide which project the task belongs to before writing anything.
2. New tasks are added to `todo.md` under that project's section, and its topic subsection.
3. When starting work on a task, create a detailed task file in `<project>/tasks/current/` with the
   `**Project:**` header line.
4. **CRITICAL — Update the task document as you work (not just at the end):**
   - Convert plain list items (`-`) to checklists (`- [x]` / `- [ ]`) as items are completed
   - Add brief evidence or notes next to completed items (file paths, key decisions)
   - Record design decisions that deviated from the original spec with a **Design note**
   - Mark phase/section headers with status (e.g., `### Phase 1: Foundation — DONE`)
   - Update testing checklists to distinguish verified items from those still needing live testing
   - The task document is the **source of truth** for implementation status, not just the original plan
   - **After completing each phase or finishing a work session, update the task file BEFORE moving on.** This is non-negotiable — skipping this step causes duplicate work in future sessions.
5. When work is completed:
   - Move the task file to `<project>/tasks/completed/`
   - Move the task entry from `todo.md` to `completed.md` (same project section) with the completion date
   - Link to the task file in `completed.md`

## Working in a shared directory

- **Stay inside your project's folder.** Don't reorganize, rename, or delete another project's task
  files. If a task looks mis-filed, move it and say so in your summary rather than deleting it.
- **Don't rewrite history you didn't write.** Append status updates and dates; leave prior notes in
  place even when they turn out to be wrong (mark them corrected/retracted instead).
- **Date everything.** Absolute dates (`2026-08-04`), never "today" or "last week" — someone else
  reads this months later.
- **Renaming or moving a task file means fixing its inbound links.** `todo.md`/`completed.md`,
  sibling task files, `research/`, `src/dms/skills/`, and build scripts all cross-reference these
  paths by full path (`planning/<project>/tasks/current/<file>.md`); grep for the filename before
  and after a move.

## Plans Must Be Written Into the Task File

When plan mode is used to design an implementation approach, the resulting plan **must be written in detail into the task file** in `<project>/tasks/current/`. The task file is the single source of truth — plans that only exist in conversation context are lost between sessions. Specifically:

- **Before implementing**: Write the full plan into the task file, including step-by-step implementation details, file paths, code patterns, and architectural decisions.
- **Plan granularity**: Plans should be detailed enough that a future session can pick up and implement without re-researching. Include specific function signatures, data flow descriptions, and integration points.
- **Plan updates**: If the plan changes during implementation (new discoveries, design pivots), update the plan in the task file to reflect the actual approach taken.

## Task Document as Source of Truth

The task file in `<project>/tasks/current/` must always reflect the actual state of work. When implementing a task (especially multi-phase tasks), **update the task document at the end of each phase or work session** before finishing. This is critical because:

- Future sessions (including AI agents) rely on the task document to know what has been done and what remains
- If the task doc says "Phase 2: NOT STARTED" but the code is done, the next session may redo the work

**Checklist for each work session:**
- [ ] Project + status in the header block still accurate
- [ ] Phase/section headers updated with status (DONE, IN PROGRESS, NOT STARTED)
- [ ] Individual items converted from `- ` to `- [x]` or `- [ ]`
- [ ] Design notes added for any deviations from the original spec
- [ ] Testing checklist updated with verified vs. unverified items
- [ ] New files listed with brief descriptions
