# qa-run — the orchestrator (dev entry point)

"Run the QA process [for <pattern> | <page_key>]" → this skill. It pulls live control-room
state, advances every actionable page one stage-appropriate step, and reports. Read
`qa-process.md` first (stage machine, guardrails, elevation contract).

## Scope + budgets (confirm with the invoker if not given)

`--pattern tsmo2` · `--page tsmo2:home` · `--assess-only` (skip T4 fixes) · `--dry` (report
what WOULD happen; no writes). Default budgets per run: **assess ≤ 5 pages, fix ≤ 10 tickets**,
one touch per page per stage. Say what was skipped for budget in the report.

## The run

1. **Auth** — mint `DMS_AUTH_TOKEN` (mint-token.mjs); mint per-origin `auth_<surface>.json`
   storageStates lazily as pages are assessed.
2. **T0 sync** — `qa-sync-inventory` (`cr_sync.mjs --app npmrdsv5 --apply`). Never
   `--reset/--prune/--clear-tickets` in a routine run.
3. **Read state** — `qa_state.mjs state [--pattern X]`.
4. **Dispatch, per page** (T5 first so re-entries get fixed in the same run):
   - stage ≥ Dev Acceptance + new open tickets → `qa-address-tickets` (page re-enters QA)
   - Proposed → `qa-scope-stories`
   - Design → `qa-implement-page`
   - Implemented → `qa-assess-page`
   - QA + open agent-actionable tickets → `qa-fix-ticket` per ticket (severity desc, oldest
     first); page advances to Dev Acceptance when clear per the advancement rule.
5. **Re-sync** (refresh counters/denorms/stage tuples).
6. **Report** — write `planning/transportny/qa-process/runs/YYYY-MM-DD[-n].md`:
   - **Elevated tickets first** (id · page · title · reason) — the human queue.
   - Per touched page: stage before → after; stories added/verified; tickets filed (id+title+sev)
     / fixed / attempted; artifacts folder.
   - Human-action queue: stories awaiting acceptance, designs awaiting review, pages at Dev
     Acceptance awaiting client, "verify after publish" notes, budget skips.

## Invariants (repeat of the hard guardrails)

Never publish · never delete · never edit `sitemgmt_patterns` · never set `client_approved` ·
stages only move forward except the T5 re-entry · all writes through `qa_state.mjs`/`cr_sync.mjs`.
