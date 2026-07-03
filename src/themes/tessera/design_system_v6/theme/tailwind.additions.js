/* ═══════════════════════════════════════════════════════════════════════
   Tessera Design System v6 — Tailwind additions

   The theme.extend block every mockup page carries inline via the Play
   CDN, and the block a production consumer merges into tailwind.config
   (v3) or expresses as @theme tokens (Tailwind v4).

   NOTE: every color maps to a CSS custom property from _shared.css —
   that is what makes light/dark a single set of utility classes
   ([data-theme="dark"] swaps the variables, not the markup). Because
   the values are var()s, Tailwind slash-opacity (bg-cobalt/10) does NOT
   work; use the dedicated soft tokens (cobaltSoft, markerSoft, …).

   Brand color names only (paper / ink / cobalt / …) — a numbered
   palette step (slate-500) in a v6 mockup is a bug.
   ═══════════════════════════════════════════════════════════════════════ */

export const tailwindAdditions = {
  theme: {
    extend: {
      colors: {
        paper: "var(--t-paper)",
        panel: "var(--t-panel)",
        well: "var(--t-well)",
        ink: "var(--t-ink)",
        graphite: "var(--t-graphite)",
        pencil: "var(--t-pencil)",
        rule: "var(--t-rule)",
        ruleStrong: "var(--t-rule-strong)",
        cobalt: "var(--t-cobalt)",
        cobaltDeep: "var(--t-cobalt-deep)",
        cobaltSoft: "var(--t-cobalt-soft)",
        accentInk: "var(--t-accent-ink)",
        marker: "var(--t-marker)",
        markerSoft: "var(--t-marker-soft)",
        go: "var(--t-go)",
        goSoft: "var(--t-go-soft)",
        amber: "var(--t-amber)",
        amberSoft: "var(--t-amber-soft)",
        brick: "var(--t-brick)",
        brickSoft: "var(--t-brick-soft)",
        board: "var(--t-board)",
        board2: "var(--t-board-2)",
        chalk: "var(--t-chalk)",
        chalkDim: "var(--t-chalk-dim)",
        scrim: "var(--t-scrim)",
      },
      fontFamily: {
        display: ['"IBM Plex Sans"', "system-ui", "sans-serif"],
        sans: ['"IBM Plex Sans"', "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
        note: ["Caveat", '"Segoe Print"', "cursive"],
      },
      boxShadow: {
        lift: "var(--t-shadow-lift)",
        drag: "var(--t-shadow-drag)",
      },
      maxWidth: {
        content: "1200px",
        measure: "640px",
      },
    },
  },
};

export default tailwindAdditions;
