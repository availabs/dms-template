/* Suggested additions to the consuming project's `tailwind.config.js`.
   v0.1 of `tessera-theme.js` uses Tailwind arbitrary values (`bg-[#F4F1EA]`)
   so the theme runs without these additions. A future pass should extend
   Tailwind with named brand colors and font families, then swap the
   arbitrary values for the names.

   To apply: merge the `theme.extend` block below into the project's
   existing `tailwind.config.js`, then update `tessera-theme.js` to use
   the named utilities (`bg-bone`, `text-slate-ink`, `font-display`,
   etc.).

   The font URLs assume the project loads fonts from
   `src/themes/tessera/Tessera Design System/fonts/` via `colors_and_type.css`
   (or the equivalent `@font-face` declarations injected via the global
   stylesheet). */

module.exports = {
  theme: {
    extend: {
      colors: {
        // Surfaces (≈85% of any composition)
        bone:        '#F4F1EA',
        limestone:   '#E8E2D5',
        parchment:   '#FBF9F4',

        // Ink — namespaced under `slate` to coexist with Tailwind's own
        // `slate` ramp. `slate-ink` is the brand primary ink.
        'slate-ink':      '#2A2F36',
        'slate-graphite': '#4A5160',
        'slate-fog':      '#A7ADB6',

        // Accents — ≤15% of any composition, emphasis only
        oxide:       '#B5532C',
        tile:        '#7F1D1D',
        verdigris:   '#5D8A85',
        ochre:       '#B45309',

        // Grout (dividers / frames)
        'grout-light': '#D9D2C2',
        'grout-dark':  '#1A1D22',
      },

      fontFamily: {
        // Display serif. Tiempos Headline is the licensed first choice;
        // Newsreader is the free substitute shipped in v0.1 (see
        // `Tessera Design System/README.md` "Font substitutions").
        display: [
          'Newsreader',
          'Tiempos Headline',
          'GT Sectra',
          'Recoleta',
          'Georgia',
          'Times New Roman',
          'serif',
        ],
        // Body / UI sans
        sans: [
          'IBM Plex Sans',
          'Söhne',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
        // Mono — data, code, tabular contexts. Used widely; not just for code.
        mono: [
          'IBM Plex Mono',
          'JetBrains Mono',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'monospace',
        ],
        // Specimen / long-form (reuses display family by default; can be
        // swapped for GT Alpina or Tiempos Text Italic when licensed).
        specimen: [
          'Newsreader',
          'GT Alpina',
          'Georgia',
          'serif',
        ],
      },

      // The brand's spacing scale aligns with Tailwind's defaults at the
      // small end. The extension only adds the very generous values the
      // brand brief calls for (96 / 128) — both are already in Tailwind's
      // default scale (`w-24`, `w-32`), so this is here for completeness
      // rather than necessity. Drop the block if you don't need it.
      spacing: {
        // 24 = 96px, 32 = 128px — both already exist in default Tailwind.
        // The brand brief recommends *using* these values often, not
        // adding new ones. Generous negative space is the rule.
      },

      // Tabular figures — apply globally where numbers render. The brand
      // calls this out as the single biggest tell of "data-serious" type.
      // Add `font-variant-numeric: tabular-nums slashed-zero` to any
      // numeric surface via Tailwind's `tabular-nums` utility (built in).

      // Box shadows — the brand has ONE lifted treatment. Keep this list
      // tiny on purpose; resist adding `xl`/`2xl` shadows.
      boxShadow: {
        lift: '0 1px 2px rgba(42, 47, 54, 0.04)',
      },

      // Square corners are the default. The only allowed radii:
      borderRadius: {
        // 0 = `rounded-none` (already in Tailwind)
        // 2 = `rounded-[2px]` (use arbitrary for buttons / inputs)
        // Full pill = `rounded-full` (already in Tailwind, for Pills)
      },

      // Motion — snap, don't ease. Brand max is 200ms; 80–120ms is the
      // preferred range for tile placement.
      transitionDuration: {
        snap: '100ms',
        move: '180ms',
      },
      transitionTimingFunction: {
        snap: 'cubic-bezier(0.2, 0, 0.1, 1)',
      },
    },
  },

  // No plugin entries beyond what the project already uses. The brand
  // doesn't need any of the heavier plugin families.
};
