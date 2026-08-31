# Screenshots — capture convention

The design system had no image assets before 2026-08-27. These are the first, and this file is the
convention so a later capture matches.

**Where they are used:** `pages/npmrds-macro-guide.html` (6 figures) and `pages/npmrds-measures.html`
(1 figure).

## Rules

1. **Real tool only.** Every image is a capture of the running application. A mocked-up screenshot of
   a tool that exists is a fabrication, and these pages exist to be trustworthy about how numbers are
   made.
2. **Every figure names the state that produced it** — in the visible `<figcaption>` and in an HTML
   comment carrying the capture date and URL. That makes a screenshot reproducible *and*
   self-invalidating: paste the state, see whether the tool still looks like that, re-shoot if not.
3. **Annotate with HTML/CSS overlays, never baked into the PNG.** A callout positioned over the image
   survives a re-capture; one burned into the pixels does not.
4. **Relative paths, no base64.** These pages must open by double-clicking from the file system, and
   inlining would make already-large files un-diffable.
5. **Viewport 1920x1150, deviceScaleFactor 1.** Keeps files ~600-800 KB while staying readable at the
   ~700-900 px the pages display them at.

## How these were captured (2026-08-27)

The macro view is auth-gated, so a Playwright storage state is minted first. The token must be minted
against the API host the app actually talks to (`VITE_API_HOST`, `https://dmsserver.availabs.org`) —
minting against `localhost:3001` produces a token the app rejects, and every shot lands on the sign-in
page.

```bash
# a throwaway dev server for npmrdsv5 on a spare port, so the default-mode servers are untouched.
# a mode-specific env file is used because .env wins over a shell VITE_DMS_APP.
npx vite --mode npmrdsshot --port 5231 --strictPort

node src/dms/packages/dms/cli/bin/mint-token.mjs \
  --host https://dmsserver.availabs.org --project npmrdsv5 \
  --email availabs@gmail.com --password test123 \
  --origin http://npmrds.localhost:5231 \
  --out scratchpad/npmrdsv5-dev2/auth-shots.json
```

Then drive the UI with Playwright and shoot. **Do not try to set state through URL parameters** — the
first attempt did, and produced seven byte-identical files, because the params did not apply and every
shot was the default view. Click the controls, and verify the captures differ (`md5sum *.png`) before
trusting them.

The macro view lives at the **subdomain** origin `http://npmrds.localhost:<port>/macro`; the bare
`localhost:<port>/macro` path resolves to the platform landing page instead.

## Inventory

| file | state |
|---|---|
| `macro-01-overview.png` | default — LOTTR, AM peak, statewide, PM3 year 2025 |
| `macro-02-measure-menu.png` | measure select open, showing the 7 published measures in 4 groups |
| `macro-03-phed-controls.png` | measure = PHED — 4 conditional controls, 30,918 segments no-data |
| `macro-04-coverage.png` | measure = Coverage · data completeness |
| `macro-05-worst-segments.png` | worst-25 ranking panel open |
| `macro-06-download-builder.png` | download builder modal open |

## Porting to the live DMS build

Live docs pages embed images as lexical image nodes served from `/img/npmrdsv5/<sectionId>_<n>_<hash>.png`
(older ones sit on `avl-dms.s3.us-east-2.amazonaws.com`). The relative `<img src="../assets/screens/…">`
paths here swap to those on upload. They are kept together inside `<figure>` blocks so the swap is
mechanical.
