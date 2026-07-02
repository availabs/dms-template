/* ═══════════════════════════════════════════════════════════════════════
   Tessera Design System v3 — Tailwind additions

   The theme.extend block every mockup page carries inline via the Play
   CDN, and the block a production consumer merges into tailwind.config
   (v3) or expresses as @theme tokens (Tailwind v4).

   NOTE: `slate` deliberately REPLACES Tailwind's built-in slate scale —
   Tessera pages use brand color names only (bone / slate / oxide / …),
   never numbered palette steps. If a numbered step appears in a mockup,
   it's a bug.
   ═══════════════════════════════════════════════════════════════════════ */

export const tailwindAdditions = {
  theme: {
    extend: {
      colors: {
        bone: "#F4F1EA",
        limestone: "#E8E2D5",
        parchment: "#FBF9F4",
        slate: "#2A2F36",
        graphite: "#4A5160",
        fog: "#A7ADB6",
        oxide: "#B5532C",
        tile: "#7F1D1D",
        verdigris: "#3F8F7F",
        ochre: "#C7910F",
        lapis: "#3B5BA5",
        grout: { light: "#D9D2C2", dark: "#1A1D22" },
      },
      fontFamily: {
        display: ['"Tiempos Headline"', "Newsreader", "Georgia", "serif"],
        fine: ['"Tiempos Fine"', '"Tiempos Headline"', "Newsreader", "Georgia", "serif"],
        sans: ['"IBM Plex Sans"', "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
      boxShadow: {
        lift: "0 1px 2px rgba(42, 47, 54, 0.04)",
      },
      maxWidth: {
        content: "1280px",
        measure: "620px",
      },
    },
  },
};

export default tailwindAdditions;
