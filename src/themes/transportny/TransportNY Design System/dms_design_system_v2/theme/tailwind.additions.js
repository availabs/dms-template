// TransportNY · tailwind config additions (v2)
//
// Merge into the consuming project's tailwind.config.{js,ts} under
// `theme.extend`. Colors here back the literal hex values referenced
// in theme.js; if you change a token here, update the corresponding
// hex in theme.js or replace those hex strings with the Tailwind
// class (e.g. `bg-nys-blue`).
//
// NOTE on Tailwind v4: this file targets Tailwind v3+. If the consuming
// project is on v4 (as dms-template is), prefer the
// `{ type: 'tailwind' }` entry on `theme.fonts` for font-family
// registration; merge the color palette into the @theme block in
// index.css.additions or in a similar v4 CSS-only config block.

const transportnyTailwind = {
  theme: {
    extend: {
      colors: {
        // ── Core palette ──
        "nys-blue":         "#1F3F8F", // Primary brand. Tone-bars, primary CTAs, links.
        "blue-press":       "#16307A", // Hover/active for primary blue surfaces.
        "ink-navy":         "#0F2D4D", // Table headers, callouts, deep accents.
        "sidebar-ink":      "#12181F", // Persistent left rail. Always paired with white text.
        "logo-plate":       "#0A0E13", // Top of sidebar, behind NYS mark.
        "active-amber":     "#FACC15", // Selected nav, highlighted toolbar buttons.
        "underline-amber":  "#EAAD43", // Section heading underline, anchored TOC.
        "kicker-amber":     "#CA8A04", // Kicker text "// 01" labels.
        "slate-tag":        "#37576B", // Avatar gradient base, status chips, links.

        // ── Surfaces (cards-on-pane) ──
        "pane":             "#ECEEF2", // Page background — THE DEFAULT FOR <section>.
        "pane-tint":        "#E4E8EE", // Alternating sections.
        "card":             "#FFFFFF", // Default content surface.
        "card-tint":        "#FAFBFC", // Inner panel inside a card.
        "card-bone":        "#F5F1E8", // Editorial / printable narrative only.

        // ── Data viz: categorical (max 5) ──
        "cat-1": "#6F6F6F",
        "cat-2": "#E5A646",
        "cat-3": "#94C24E",
        "cat-4": "#E160A4",
        "cat-5": "#F2CB3D",

        // ── Data viz: sequential speed ramp (slowest → freeflow) ──
        "speed-0": "#D6453B",
        "speed-1": "#E8843F",
        "speed-2": "#F2E18A",
        "speed-3": "#A8D26B",
        "speed-4": "#3FA34D",

        // ── Status (only as dots/text, never as backgrounds) ──
        "good": "#10B981",
        "warn": "#F59E0B",
        "bad":  "#EF4444",
        "na":   "#94A3B8",
      },

      fontFamily: {
        display: ["Oswald", "Bebas Neue", "sans-serif"],
        sans:    ["Proxima Nova", "Source Sans 3", "system-ui", "sans-serif"],
        proxima: ["Proxima Nova", "Source Sans 3", "system-ui", "sans-serif"],
        mono:    ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },

      // Section-padding tokens — pick one per page (matches the
      // handoff's grid-system §03 Vertical Rhythm).
      spacing: {
        "section-dense":       "24px",
        "section-comfortable": "48px",
        "section-roomy":       "72px",
        "section-feature":     "96px",
      },

      // Container max-widths (the six handoff tokens).
      maxWidth: {
        "narrow":    "480px",
        "prose":     "720px",
        "split":     "1024px",
        "marketing": "1280px",
        "data":      "1480px",
      },

      // Brand shadow stack
      boxShadow: {
        card:    "0 1px 2px rgba(15,23,42,0.04), 0 1px 0 rgba(15,23,42,0.02)",
        popover: "0 10px 24px -4px rgba(0,0,0,0.18)",
        dock:    "0 8px 24px -2px rgba(0,0,0,0.20)",
      },

      borderRadius: {
        card:  "8px",
        input: "6px",
      },
    },
  },
};

export default transportnyTailwind;
