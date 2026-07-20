# qa-fix-ticket — T4: fix one ticket, verify, resolve or elevate

For pages at `stage=QA`: work open agent-actionable tickets (status ∈ Triage/In progress/In
review, `assignee ≠ "HUMAN"`), most severe first, oldest first within severity.
**Never pick up `Needs decision` or `Needs data`** (added 2026-07-15): both are OPEN in every
counter but parked — `Needs decision` awaits a human product/design call (style/content changes),
`Needs data` awaits deliberate dataset/ETL work. Park a ticket by setting the status + writing
the options into `suggested_solution`; a human moves it back to Triage when the call is made.
During assessment (T3/T4), write the proposed fix into the ticket's **`suggested_solution`**
column — it renders on the ticket detail page. Per ticket:

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
| **Map symbology** | edit the Map section's embedded `element-data.symbologies` (read-modify-write) — NOT build-owned | see **`qa-fix-map-symbology-tickets.md`** — the repeatable process + the colour/legend/bin gotchas |

## 3. Targeted re-verify

Re-run the SPECIFIC check that filed the ticket (same URL/viewport/assertion — usually one
`qa_assess.mjs` run + checking that finding is gone, or a focused Playwright probe). Not the
whole catalog.

- **Pass** → `patch-ticket <row_id> '{"status":"Resolved","comments":"fixed: <what> (agent, <date>)"}'`
  then **attach the verify screenshot** so the reporter sees the proof on the ticket detail page:
  ```bash
  DMS_AUTH_TOKEN=… node src/themes/transportny/qa_skills/tools/attach_screenshot.mjs \
    --ticket <row_id> --image <the verify .png> --caption "<layer> after fix"
  ```
  (uploads via `/dms-admin/<app>/file_upload` → public `dl_url`, sets the ticket's `screenshot`
  column; appends to one reusable "QA ticket screenshots" source. The detail page renders it as a
  link.)

  **When a screenshot is warranted (owner guidance, 2026-07-16 — not every fix needs one):**
  - **YES — the fix is visible**: map/symbology changes, chart/axis/tooltip rendering, layout
    and styling, removed/added UI, option ordering, dead-control replacements. Shoot the exact
    thing the reporter complained about, after the fix, at a comparable viewport.
  - **NO — nothing visual to show**: publish-only resolutions, sort/order semantics you can't
    see in a still (write the observed ordering into `resolution` instead), console/hygiene
    fixes, could-not-reproduce closures, data/backfill edits, and absence-of-motion fixes
    (jitter/jiggle — a still can't prove stillness; describe the measurement in `resolution`).
  - When skipping, the `resolution` text carries the proof (what was verified, how, with
    numbers/values where possible). Don't attach filler screenshots that show nothing.
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
