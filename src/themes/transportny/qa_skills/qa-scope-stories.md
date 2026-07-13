# qa-scope-stories — T1: propose stories, advance out of Proposed

Supersedes/extends `scope-user-stories.md` (whose `scope_stories.mjs` list/write helper still
works). For every page at `stage=Proposed` with no stories yet (check via
`qa_state.mjs state`).

## 1. Derive the stories

**Design-driven (page has `design_file`)** — read the mockup FILE (not the `design_html` blob):
`src/themes/transportny/TransportNY Design System/dms_design_system_v2/pages/<design_file>`.
Mockups carry an intent comment near the top and render from `sitemgmt-data.js`/inline JS —
enumerate every band and interaction: header/KPIs/filters/tables/charts/modals/links. Write
**4–8 element-level stories**, one per major band or behavior:

> As a user, I can filter the tickets table by severity and the table updates.
> As a manager, I see the resolution % with a progress bar in the summary band.

NOT "the page matches the design" — each story must be independently verifiable against the DOM.

**Live-driven (no design)** — derive from the page row's `description` + the rendered page
(load `/edit/<slug>` with auth and read the bands).

## 2. Write + advance (all via qa_state.mjs)

```bash
node src/themes/transportny/qa_skills/tools/qa_state.mjs add-story \
  '{"page_key":"tsmo2:home","story":"As a user, I can …"}'          # idempotent by text
# then advance the page:
#   design exists            → set-stage <page_key> Design
#   no design AND build ≠ "Not started" → set-stage <page_key> Implemented
#   no design AND not built  → leave Proposed; report as elevated (nothing to build against)
```

Stories are created `stage=proposed, source=ai`. **Humans** advance `proposed → accepted` (the
QA page's editable pills); the agent later verifies `accepted → verified` during assessment
(`qa-assess-page`). Never self-accept: assessment failures against unaccepted (`proposed`)
stories file at `severity=Minor` max.
