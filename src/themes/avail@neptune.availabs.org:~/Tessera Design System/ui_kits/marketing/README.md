# Tessera — Marketing UI kit

The marketing surface. Print-rooted, generous margins, restrained ornament.

## Layout philosophy

- ~85% bone surface, ~15% considered ornament — the Cosmati ratio.
- Long-form measure ~620px even on wide layouts.
- One column for the "Theory" surface, set in Newsreader Italic.
- No hero illustrations, no people photography, no full-bleed imagery
  behind text. The only ornament is the Cosmati frieze in end caps and
  footer.

## Files

- `index.html` — homepage (full assembly).
- `theory.html` — long-form essay page.
- `comparison.html` — hosted vs self-host fork.
- Components:
  - `Wordmark.jsx`
  - `MarketingHeader.jsx`
  - `Hero.jsx`
  - `TwoDoors.jsx`
  - `SurfacesGrid.jsx`
  - `ProofPoints.jsx`
  - `TheoryLink.jsx`
  - `MarketingFooter.jsx`

Load order in `index.html`: React → Babel → components → app.

## What's missing / cuts-corners

- Real product screenshots in the "Surfaces" section — placeholders only.
- Theory page contains lorem-style placeholder paragraphs in the brand
  voice; replace with real essay copy.
- The Header search input is decorative.
