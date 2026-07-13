# Tessera — Docs UI kit

Documentation site template. Narrow column, generous margins,
typographic emphasis on code samples (mono). Print-rooted —
this should read like a manual, not a SaaS doc-site.

## Files

- `index.html` — one representative page ("Patterns").
- Components:
  - `DocsHeader.jsx` — top bar, version pill, "Edit this page" link.
  - `DocsSidebar.jsx` — sectioned TOC, current-page indicator.
  - `DocsContent.jsx` — prose container, headings with permalinks.
  - `CodeBlock.jsx` — mono block with caption + line gutter.
  - `OnThisPage.jsx` — right rail in-page TOC.

## Cuts-corners

- Code samples are not syntax-highlighted; they use plain mono
  with token weight via wrapper spans only on key terms.
- The "Edit this page" link is decorative.
