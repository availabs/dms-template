# Weeks

Weekly planning documents. One file per week, created each **Monday**, used to set goals and decide what to work on during the week.

## What this is

Each week has a markdown file named by that week's Monday date (`YYYY-MM-DD.md`, e.g. `2026-06-08.md`). On Monday we discuss the week and write down a set of goals, generally **organized by project**, with any **deadlines** called out.

During the week the file is a reference: open it to choose what to work on next and to keep the week's plan in view.

## This is an interactive document

These week files are **living documents** — the agent (and human) should update them as the week progresses:

- **Break goals into sub-tasks** as they become clear, and check them off when done.
- **Record completed work** inline (mark items `- [x]`, add a one-line note with a date or evidence).
- **Link to planning tasks.** When a goal turns into real work it gets a detailed task document in the relevant project's planning folder. Reference that task file from the week file so the trail is traceable. Planning folders:
  - TransportNY → [`transportNY/planning`](../../../transportNY/planning) (tasks in `tasks/current/`, index in `todo.md`)
  - DMS / Tessera → [`dms-template/src/dms/planning`](../../src/dms/planning) (tasks in `tasks/current/`, index in `todo.md`)
  - WCDB → see [`dms-template/references/wcdb`](../../references/wcdb); add a planning home if/when work warrants it.
- **Note scope changes and carry-overs.** Goals that don't get finished should be noted and rolled into the next week's file on Monday.

The week file captures *intent and progress for the week*; the planning `tasks/` documents remain the source of truth for *implementation detail*. Keep the week file pointing at them rather than duplicating them.

## File conventions

```
weeks/
├── README.md          # this file
└── YYYY-MM-DD.md       # one per week, dated to that week's Monday
```

A week file is structured roughly as:

```markdown
# Week of YYYY-MM-DD

> One-line theme / focus for the week (optional)

## <Project>

### <Goal>
- **Deadline:** <date or "none">
- **Task:** [task-name.md](<path to planning task, once created>)
- [ ] sub-task
- [x] completed sub-task — note / date

## Carry-over / Next week
- ...
```

## Workflow

1. **Monday:** create `YYYY-MM-DD.md` for the new week. Pull forward unfinished goals from last week, add new ones, group by project, mark deadlines.
2. **During the week:** update the file as work happens — add sub-tasks, check items off, link new planning task documents.
3. **Following Monday:** review, move incomplete items into the new week's file, start fresh.
