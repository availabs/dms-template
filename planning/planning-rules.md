# Planning Directory Structure

This document describes the structure and conventions for the **dms-template** planning directory.

This is a separate planning system from `src/dms/planning/`, which tracks work on the `@availabs/dms` library submodule itself. This directory (`planning/` at the repo root) tracks work on **dms-template** — the site: theming (`src/themes/`), data-type plugins (`data-types/`), deployment/config, and any site-specific content or integration work that isn't a change to the `@availabs/dms` library. If a task turns out to require a library change, do that work under `src/dms/planning/` instead (see its `planning-rules.md`).

## Directory Structure

```
planning/
├── roadmap.md               # High-level roadmap and vision (existing: ../roadmap.md)
├── todo.md                  # Active tasks organized by topic
├── completed.md             # Completed tasks organized by topic
├── planning-rules.md        # This file - structure documentation
└── tasks/
    ├── current/             # Detailed task documents for work in progress
    └── completed/           # Archived task documents for completed work
research/                    # Research documents — tech analysis, design exploration, options evaluation
└── **/*.md                  # One folder/file per topic (e.g., research/dms product/, research/now-playing/)
documentation/                # System documentation — how things work, schemas, reference material
└── *.md                     # One file per topic
```

### Where to put research vs. documentation

- **`research/`** (repo root) — Exploratory analysis, tech stack evaluations, design options, proof-of-concept code, recommendations. These inform decisions and task creation. They may become outdated as decisions are made.
- **`documentation/`** (repo root) — Factual reference material describing how things work (or worked). Schema docs, architecture overviews, operational guides. Create this folder when the first doc is written. These should be kept accurate as the system evolves.

## File Conventions

### todo.md

Active tasks organized by topic hierarchy:

```markdown
# DMS Template Todo

## Topic Name

### Subtopic Name (if applicable)

- [ ] Task description
- [ ] Another task
```

### completed.md

Completed tasks organized by the same topic hierarchy, with dates:

```markdown
# DMS Template Completed Tasks

## Topic Name

### Subtopic Name (if applicable)

- [task-name.md](./tasks/completed/task-name.md) - Brief description (YYYY-MM-DD)
```

### Task Files (tasks/current/ and tasks/completed/)

Detailed task documents should include:
- **Objective** - What the task accomplishes
- **Scope** - What's included/excluded
- **Current State** - How things work now
- **Proposed Changes** - What will change
- **Files Requiring Changes** - Specific files and modifications
- **Testing Checklist** - How to verify the changes work

## Topic Hierarchy

Tasks are organized under these high-level topics (add new ones as needed):

### themes
Theme definitions in `src/themes/` — layout, styling, navigation, component theming per brand/site.

### data-types
DataType plugins in `data-types/` and their server registration (`server/register-datatypes.js`).

### deployment
Netlify/Docker deployment config, build tooling, environment configuration.

### content
Site-specific page/pattern content authored through the DMS admin UI but tracked here when it requires coordinated developer work (e.g., a migration, a bulk content operation).

### dms (library escalation)
Tasks that started here but turned out to require a change in the `@availabs/dms` library — link to the corresponding task in `src/dms/planning/` rather than duplicating.

## Workflow

1. New tasks are added to `todo.md` under the appropriate topic
2. When starting work on a task, create a detailed task file in `tasks/current/`
3. **CRITICAL — Update the task document as you work (not just at the end):**
   - Convert plain list items (`-`) to checklists (`- [x]` / `- [ ]`) as items are completed
   - Add brief evidence or notes next to completed items (file paths, key decisions)
   - Record design decisions that deviated from the original spec with a **Design note**
   - Mark phase/section headers with status (e.g., `### Phase 1: Foundation — DONE`)
   - Update testing checklists to distinguish verified items from those still needing live testing
   - The task document is the **source of truth** for implementation status, not just the original plan
   - **After completing each phase or finishing a work session, update the task file BEFORE moving on.** This is non-negotiable — skipping this step causes duplicate work in future sessions.
4. When work is completed:
   - Move the task file to `tasks/completed/`
   - Move the task entry from `todo.md` to `completed.md` with the completion date
   - Link to the task file in `completed.md`

## Plans Must Be Written Into the Task File

When plan mode is used to design an implementation approach, the resulting plan **must be written in detail into the task file** in `tasks/current/`. The task file is the single source of truth — plans that only exist in conversation context are lost between sessions. Specifically:

- **Before implementing**: Write the full plan into the task file, including step-by-step implementation details, file paths, code patterns, and architectural decisions.
- **Plan granularity**: Plans should be detailed enough that a future session can pick up and implement without re-researching. Include specific function signatures, data flow descriptions, and integration points.
- **Plan updates**: If the plan changes during implementation (new discoveries, design pivots), update the plan in the task file to reflect the actual approach taken.

## Task Document as Source of Truth

The task file in `tasks/current/` must always reflect the actual state of work. When implementing a task (especially multi-phase tasks), **update the task document at the end of each phase or work session** before finishing. This is critical because:

- Future sessions (including AI agents) rely on the task document to know what has been done and what remains
- If the task doc says "Phase 2: NOT STARTED" but the code is done, the next session may redo the work

**Checklist for each work session:**
- [ ] Phase/section headers updated with status (DONE, IN PROGRESS, NOT STARTED)
- [ ] Individual items converted from `- ` to `- [x]` or `- [ ]`
- [ ] Design notes added for any deviations from the original spec
- [ ] Testing checklist updated with verified vs. unverified items
- [ ] New files listed with brief descriptions
