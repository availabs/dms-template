# qa-assess-page — T3: find bugs, file tickets, verify stories

For pages at `stage=Implemented` (and re-assessment during T4 verification). Two layers: the
**harness** (machine checks) + **agent judgment** (stories, design comparison) over its artifacts.

## 1. Resolve URLs + auth

From the page row (`qa_state.mjs state --page <key>`): `url` is protocol-relative against the
DEPLOYED dev domain (e.g. `//tsmo2.devtny.org/home` — cr_sync hardcodes `devtny.org` because the
stored link must work off-box). Assessment runs against the LOCAL dev server: take the url's
subdomain and re-suffix it, `http://<subdomain>.localhost:5173`. Draft pages are assessed at
`http://<origin-host>/edit/<slug>`; published pages also at the view URL. Mint a storageState
FOR THAT ORIGIN (tokens are per-origin):

```bash
node src/dms/packages/dms/cli/bin/mint-token.mjs --host http://localhost:3001 \
  --project npmrdsv5 --email availabs@gmail.com --password test123 \
  --origin http://tsmo2.localhost:5173 --out scratchpad/npmrdsv5-dev2/auth_<surface>.json
```

## 2. Run the harness (machine checks)

```bash
node src/themes/transportny/qa_skills/tools/qa_assess.mjs \
  --url http://tsmo2.localhost:5173/edit/home \
  --storage scratchpad/npmrdsv5-dev2/auth_tsmo2.json \
  --design "src/themes/transportny/TransportNY Design System/dms_design_system_v2/pages/<design_file>" \
  --out /tmp/qa_assess/<page_key>
```

Emits `findings.json` (console/page errors, failed API requests, SQL-in-/graph, stuck
loading/NaN, nested `/edit/x/y` links, empty `?param=` links, mobile overflow — each with
severity + env) and artifacts: `desktop.png`, `mobile.png`, `design.png` (if given),
`page_text.txt`. An `auth` finding means the storageState is wrong — fix auth, rerun; don't
ticket it. **Harness findings are LEADS, not tickets** — probe before filing:
- `responsive` on an `/edit` URL: the edit toolbar (fixed `w-[500px]`) ALWAYS overflows 390px —
  probe which elements exceed the viewport and ticket only page-content culprits.
- `stuck`: re-probe with a longer settle (~15s) — a section that eventually settles is a
  slow-load `Minor`, not a stuck `Major`. (The harness already excludes the edit UI's
  fixed bottom-right "Loading… N" widget — anything inside `.fixed` chrome.)
- `link` empty-param (`?region=` etc.) on dashboard pages: the tone-bar facet links carry empty
  values BY DESIGN (empty = All/statewide). Dismiss unless the empty param lands somewhere that
  requires a value (e.g. a detail page's `?id=`).

## 3. Agent judgment checks (over the artifacts)

- **Stories as acceptance criteria** — for each story on the page (`state --page` includes
  rows): verify the behavior against `desktop.png`/`page_text.txt` (and live DOM interaction via
  Playwright when the story is interactive — filters, dropdowns, links). Story `accepted` +
  verified → `qa_state.mjs patch-story <row_id> '{"stage":"verified"}'`. Story fails → ticket
  (severity by impact; **Minor max if the story is still `proposed`**).
- **Design comparison** (when `design.png` exists) — band-by-band STRUCTURAL comparison against
  `desktop.png`: missing bands/elements/copy, gross layout divergence. Pixel deviation is NOT a
  bug (theme ≠ mockup by design). One ticket per concrete gap.
- **View-only behaviors** (modal groups, published-view rendering) on a draft page: do NOT
  ticket — note "verify after publish" for the run report.

## 4. File tickets (dedupe built in)

```bash
node src/themes/transportny/qa_skills/tools/qa_state.mjs add-ticket '{
  "page_key":"tsmo2:home","title":"<imperative, ≤80 chars>","severity":"Major","priority":"Now",
  "description":"…","steps":"1. …\n2. …","expected":"…","actual":"…","env":"/edit/home · Chromium · 1480×1100"}'
```

Defaults applied: `status=Triage, source=ai, reporter=QA-agent, opened/updated=today`;
`ticket_id` + target-page denorms land on the next sync. Severity heuristic: blank
page/crash/SQL/broken primary nav → Blocker · feature or data wrong → Major · visual divergence
→ Minor · copy/spacing → Polish. Priority: Blocker/Major→Now, Minor→Next, Polish→Later.

## 5. Advance the page

```bash
# findings filed → node tools/qa_state.mjs set-stage <key> QA '{"ai_reviewed":"yes"}'
# zero findings  → node tools/qa_state.mjs set-stage <key> "Dev Acceptance" '{"ai_reviewed":"yes","dev_ready":"yes"}'
```
