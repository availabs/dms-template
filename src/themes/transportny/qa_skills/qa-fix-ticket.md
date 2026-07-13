# qa-fix-ticket — T4: fix one ticket, verify, resolve or elevate

For pages at `stage=QA`: work open agent-actionable tickets (status ∈ Triage/In progress/In
review, `assignee ≠ "HUMAN"`), most severe first, oldest first within severity. Per ticket:

## 1. Claim

```bash
node src/themes/transportny/qa_skills/tools/qa_state.mjs patch-ticket <row_id> \
  '{"status":"In progress","assignee":"QA-agent"}'
```

## 2. Reproduce, then classify the fix surface

Reproduce first (the ticket's `steps`/`env` — same URL + viewport via Playwright/`qa_assess.mjs`).
Can't reproduce → `status=Resolved`, comment `"could not reproduce (agent, <date>)"`. Then fix on
the smallest surface:

| Surface | How | Rules |
|---|---|---|
| **Section config** | patch the page's OWNING build script (`tools/builds/`, see its README) and RE-RUN it | no owner yet → generate via `tools/page_to_build.mjs` + fidelity gate first; never hand-edit sections a script owns |
| **Theme** | `src/themes/transportny/themev2.js` | additive/BC (new tokens/styles over widened APIs); joins the transportNY sync batch |
| **Core dms** | `src/dms/packages/dms/src/…` | BC ONLY + its own task file in `src/dms/planning/tasks/current/` (per `feedback_primitive_change_tasks_bc`). Non-BC ⇒ ELEVATE |
| **Data** | dataset rows via `qa_state.mjs` / a `cr_sync.mjs` enrichment | script-owned columns stay script-owned |

## 3. Targeted re-verify

Re-run the SPECIFIC check that filed the ticket (same URL/viewport/assertion — usually one
`qa_assess.mjs` run + checking that finding is gone, or a focused Playwright probe). Not the
whole catalog.

- **Pass** → `patch-ticket <row_id> '{"status":"Resolved","comments":"fixed: <what> (agent, <date>)"}'`
- **Fail** → ONE retry with a different approach. Second fail → **elevate**.

## 4. Elevation (see qa-process.md contract)

Triggers: 2 failed verifies · non-BC core change needed · missing data/credentials · product
judgment · requires publish.

```bash
node …/qa_state.mjs patch-ticket <row_id> \
  '{"assignee":"HUMAN","priority":"Now","comments":"ELEVATED (agent, <date>): <reason>"}'
```

## 5. Advance the page when clear

No open agent-actionable tickets AND no open elevated Blocker/Major →
`qa_state.mjs set-stage <key> "Dev Acceptance" '{"dev_ready":"yes"}'`. Elevated Minor/Polish
ride along to the human queue.
