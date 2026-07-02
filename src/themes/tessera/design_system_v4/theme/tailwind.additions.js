// Tessera v4 · theme.extend block
//
// The canonical Tailwind extension every mockup page inlines in its
// <head> (Play CDN config) and the theme translation mirrors into the
// production Tailwind config. Keep this file and the per-page inline
// blocks identical — grep the pages if you change a value here.

export const tailwindAdditions = {
  theme: {
    extend: {
      colors: {
        // stone
        basalt:    "#111417",   // page ground
        slab:      "#191E23",   // panel surface
        flint:     "#21272E",   // raised surface, wells
        mortar:    "#333B44",   // hairline rules
        // ink
        chalk:     "#E4E6DE",   // primary ink
        ash:       "#98A2A8",   // secondary ink
        smoke:     "#5C666D",   // tertiary ink, disabled
        // phosphors (ANSI as minerals)
        phosphor:  "#45D68C",   // green — primary accent, success
        amber:     "#E0A83C",   // warning
        oxide:     "#E06A4E",   // danger
        verdigris: "#5BC0B0",   // info, links
        lazuli:    "#6B9BD8",   // chart series only
        porphyry:  "#B287C9",   // chart series only
      },
      fontFamily: {
        mono:    ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
        display: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
        incise:  ["Cinzel", '"Trajan Pro"', "Georgia", "serif"],
      },
      boxShadow: {
        // phosphor halo — focus + hero moments only, never ambient
        glow:      "0 0 24px rgba(69, 214, 140, 0.22)",
        "glow-sm": "0 0 10px rgba(69, 214, 140, 0.28)",
      },
      maxWidth: {
        content: "1280px",   // the brand cap — layouts.centered
        measure: "68ch",     // prose measure (mono runs wide)
      },
    },
  },
};

export default tailwindAdditions;
