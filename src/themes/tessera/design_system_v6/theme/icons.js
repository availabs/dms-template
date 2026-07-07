/* ═══════════════════════════════════════════════════════════════════════
   Tessera Design System v6 — icon registry (SOURCE OF TRUTH)

   ~50 drawn glyphs. 24px grid, 1.5px stroke, ROUND caps and joins
   (v6 is friendlier than v3's lapidary butt-caps). Filled details use
   currentColor. Every <svg> in the v6 design pages must carry
   <!-- icon: Name --> where Name exists here, or <!-- decorative -->.

   Audit:  node scratchpad/scripts/icons-audit.mjs --brand tessera-v6
   Sync:   do NOT run icons-sync for v6 until the v6 theme translation
           lands (live icons.jsx still serves the active theme).
   ═══════════════════════════════════════════════════════════════════════ */

import React from "react";

const svg = (props, children) =>
  React.createElement(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.5,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": true,
      ...props,
    },
    children
  );
const P = (d, extra) => React.createElement("path", { d, ...extra });
const R = (x, y, w, h, extra) =>
  React.createElement("rect", { x, y, width: w, height: h, ...extra });
const C = (cx, cy, r, extra) => React.createElement("circle", { cx, cy, r, ...extra });

export const icons = {
  /* ── brand ─────────────────────────────────────────────────────────── */
  // the mark: graph paper with one cell claimed — a filled tessera set at −8°.
  // the only filled shape in the set; the fill is what makes it the logo.
  Tile: (p) =>
    svg(p, [
      P("M8 2.5v19M16 2.5v19M2.5 8h19M2.5 16h19", { key: "g", opacity: 0.45 }),
      R(9.2, 9.2, 5.6, 5.6, { key: "t", rx: 1.1, fill: "currentColor", stroke: "none", transform: "rotate(-8 12 12)" }),
    ]),
  Grid: (p) => svg(p, [P("M3.5 9h17M3.5 15h17M9 3.5v17M15 3.5v17", { key: "a" })]),

  /* ── structure / sections ──────────────────────────────────────────── */
  Layout: (p) => svg(p, [R(3.5, 3.5, 17, 17, { key: "a", rx: 2 }), P("M3.5 9h17M9.5 9v11.5", { key: "b" })]),
  Layers: (p) => svg(p, [P("M12 3.5l8.5 4.5L12 12.5 3.5 8 12 3.5Z", { key: "a" }), P("M3.5 12.5L12 17l8.5-4.5", { key: "b" }), P("M3.5 17L12 21.5 20.5 17", { key: "c" })]),
  Columns: (p) => svg(p, [R(3.5, 4.5, 5, 15, { key: "a", rx: 1.5 }), R(10.5, 4.5, 5, 15, { key: "b", rx: 1.5 }), R(17.5, 4.5, 3, 15, { key: "c", rx: 1.5 })]),
  Card: (p) => svg(p, [R(3.5, 4.5, 17, 15, { key: "a", rx: 2 }), P("M3.5 10h17M7 14.5h6", { key: "b" })]),
  Table: (p) => svg(p, [R(3.5, 4.5, 17, 15, { key: "a", rx: 2 }), P("M3.5 9.5h17M3.5 14.5h17M12 4.5v15", { key: "b" })]),
  Graph: (p) => svg(p, [P("M4 20V4", { key: "a" }), P("M4 20h16", { key: "b" }), P("M7.5 16v-4M12 16V8M16.5 16v-6.5", { key: "c" })]),
  Map: (p) => svg(p, [P("M9 4.5L4 6.5v13l5-2 6 2 5-2v-13l-5 2-6-2Z", { key: "a" }), P("M9 4.5v13M15 6.5v13", { key: "b" })]),
  Text: (p) => svg(p, [P("M5 6.5V5h14v1.5M12 5v14M9.5 19h5", { key: "a" })]),
  Image: (p) => svg(p, [R(3.5, 4.5, 17, 15, { key: "a", rx: 2 }), C(9, 10, 1.8, { key: "b" }), P("M6 19l5-5 3.5 3.5L17 15l3.5 3.5", { key: "c" })]),
  Filter: (p) => svg(p, [P("M4 5.5h16L14 12.5v5.5l-4 2v-7.5L4 5.5Z", { key: "a" })]),
  Database: (p) => svg(p, [P("M5 6.5C5 4.8 8.1 3.5 12 3.5s7 1.3 7 3-3.1 3-7 3-7-1.3-7-3Z", { key: "a" }), P("M5 6.5v11c0 1.7 3.1 3 7 3s7-1.3 7-3v-11", { key: "b" }), P("M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3", { key: "c" })]),
  GripVertical: (p) => svg(p, [C(9, 6, 1, { key: "a", fill: "currentColor", stroke: "none" }), C(9, 12, 1, { key: "b", fill: "currentColor", stroke: "none" }), C(9, 18, 1, { key: "c", fill: "currentColor", stroke: "none" }), C(15, 6, 1, { key: "d", fill: "currentColor", stroke: "none" }), C(15, 12, 1, { key: "e", fill: "currentColor", stroke: "none" }), C(15, 18, 1, { key: "f", fill: "currentColor", stroke: "none" })]),
  Cursor: (p) => svg(p, [P("M5.5 4.5l6 15 2-6.5 6.5-2-14.5-6.5Z", { key: "a" })]),

  /* ── actions ───────────────────────────────────────────────────────── */
  Plus: (p) => svg(p, [P("M12 5v14M5 12h14", { key: "a" })]),
  Minus: (p) => svg(p, [P("M5 12h14", { key: "a" })]),
  X: (p) => svg(p, [P("M6 6l12 12M18 6L6 18", { key: "a" })]),
  Check: (p) => svg(p, [P("M4.5 12.5l5 5L19.5 7", { key: "a" })]),
  Pencil: (p) => svg(p, [P("M4 20l.9-3.6L16.4 4.9a2 2 0 0 1 2.8 0l-.1-.1a2 2 0 0 1 0 2.8L7.6 19.1 4 20Z", { key: "a" }), P("M14.5 6.8l2.7 2.7", { key: "b" })]),
  Trash: (p) => svg(p, [P("M4.5 6.5h15M9.5 6V4.5h5V6M6.5 6.5l.8 13h9.4l.8-13M10 10.5v5M14 10.5v5", { key: "a" })]),
  Copy: (p) => svg(p, [R(8.5, 8.5, 12, 12, { key: "a", rx: 2 }), P("M5.5 15.5h-1a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1", { key: "b" })]),
  LinkIcon: (p) => svg(p, [P("M10 14a4 4 0 0 0 5.7 0l3.1-3.1a4 4 0 0 0-5.6-5.6L11.5 7", { key: "a" }), P("M14 10a4 4 0 0 0-5.7 0l-3.1 3.1a4 4 0 0 0 5.6 5.6l1.7-1.7", { key: "b" })]),
  Search: (p) => svg(p, [C(10.5, 10.5, 6, { key: "a" }), P("M15.5 15.5L20 20", { key: "b" })]),
  Settings: (p) => svg(p, [C(12, 12, 2.5, { key: "a" }), P("M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M18 6l-1.6 1.6M7.6 16.4L6 18M18 18l-1.6-1.6M7.6 7.6L6 6", { key: "b" })]),
  Publish: (p) => svg(p, [C(12, 12, 8.5, { key: "a" }), P("M12 16V8M8.5 11.5L12 8l3.5 3.5", { key: "b" })]),
  Upload: (p) => svg(p, [P("M12 15V4.5M8 8.5L12 4.5l4 4", { key: "a" }), P("M4.5 15.5v3a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-3", { key: "b" })]),
  Download: (p) => svg(p, [P("M12 4.5V15M8 11.5l4 4 4-4", { key: "a" }), P("M4.5 15.5v3a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-3", { key: "b" })]),
  Play: (p) => svg(p, [P("M8 5.5v13l10-6.5-10-6.5Z", { key: "a" })]),
  Eye: (p) => svg(p, [P("M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z", { key: "a" }), C(12, 12, 2.5, { key: "b" })]),
  EyeOff: (p) => svg(p, [P("M4 4l16 16", { key: "a" }), P("M9.9 5.9A9.4 9.4 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.7 3.4M6.6 6.6A16.4 16.4 0 0 0 2.5 12S6 18.5 12 18.5a9 9 0 0 0 3.4-.7", { key: "b" })]),

  /* ── navigation ────────────────────────────────────────────────────── */
  Menu: (p) => svg(p, [P("M4 6.5h16M4 12h16M4 17.5h10", { key: "a" })]),
  ChevronDown: (p) => svg(p, [P("M6 9.5l6 6 6-6", { key: "a" })]),
  ChevronUp: (p) => svg(p, [P("M6 14.5l6-6 6 6", { key: "a" })]),
  ChevronRight: (p) => svg(p, [P("M9.5 6l6 6-6 6", { key: "a" })]),
  ChevronLeft: (p) => svg(p, [P("M14.5 6l-6 6 6 6", { key: "a" })]),
  ArrowRight: (p) => svg(p, [P("M4.5 12h15M13.5 6l6 6-6 6", { key: "a" })]),
  ArrowLeft: (p) => svg(p, [P("M19.5 12h-15M10.5 6l-6 6 6 6", { key: "a" })]),
  ArrowUpRight: (p) => svg(p, [P("M6.5 17.5l11-11M8.5 6.5h9v9", { key: "a" })]),

  /* ── status / misc ─────────────────────────────────────────────────── */
  Info: (p) => svg(p, [C(12, 12, 8.5, { key: "a" }), P("M12 11v5", { key: "b" }), C(12, 8, 0.9, { key: "c", fill: "currentColor", stroke: "none" })]),
  Alert: (p) => svg(p, [P("M12 4L2.8 19.5h18.4L12 4Z", { key: "a" }), P("M12 10v4.5", { key: "b" }), C(12, 17, 0.9, { key: "c", fill: "currentColor", stroke: "none" })]),
  Bug: (p) => svg(p, [C(12, 13.5, 5, { key: "a" }), P("M9.5 9.5C9.5 8 10.5 6.5 12 6.5s2.5 1.5 2.5 3", { key: "b" }), P("M7 13.5H3.5M20.5 13.5H17M8.2 10.2L5.5 7.5M15.8 10.2l2.7-2.7M8.2 16.8L5.5 19.5M15.8 16.8l2.7 2.7M12 8.5v10", { key: "c" })]),
  Wrench: (p) => svg(p, [P("M14.5 6.5a4 4 0 0 1 5-1.4l-3 3 .4 3 3 .4 3-3a4 4 0 0 1-5.6 5.1L9 21.9a2 2 0 0 1-2.8-2.8l8.3-7.6a4 4 0 0 1 0-5Z", { key: "a" })]),
  Sparkle: (p) => svg(p, [P("M12 4l1.8 5.2L19 11l-5.2 1.8L12 18l-1.8-5.2L5 11l5.2-1.8L12 4Z", { key: "a" }), P("M19 17l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z", { key: "b" })]),
  Zap: (p) => svg(p, [P("M13 3.5L5 13.5h6l-1 7 8-10h-6l1-7Z", { key: "a" })]),
  Heart: (p) => svg(p, [P("M12 19.5S4 14.5 4 9.5a4.2 4.2 0 0 1 8-1.8A4.2 4.2 0 0 1 20 9.5c0 5-8 10-8 10Z", { key: "a" })]),
  Star: (p) => svg(p, [P("M12 4.5l2.2 4.9 5.3.5-4 3.6 1.2 5.2L12 16l-4.7 2.7 1.2-5.2-4-3.6 5.3-.5L12 4.5Z", { key: "a" })]),
  Bell: (p) => svg(p, [P("M6 16.5v-6a6 6 0 0 1 12 0v6l1.5 2h-15L6 16.5Z", { key: "a" }), P("M10.5 20.5a1.6 1.6 0 0 0 3 0", { key: "b" })]),
  Lock: (p) => svg(p, [R(5.5, 10.5, 13, 9.5, { key: "a", rx: 2 }), P("M8.5 10.5v-3a3.5 3.5 0 0 1 7 0v3", { key: "b" }), C(12, 15, 1.2, { key: "c", fill: "currentColor", stroke: "none" })]),
  User: (p) => svg(p, [C(12, 8.5, 3.5, { key: "a" }), P("M5 19.5c1.2-3 3.8-4.5 7-4.5s5.8 1.5 7 4.5", { key: "b" })]),
  Users: (p) => svg(p, [C(9.5, 9, 3.2, { key: "a" }), P("M3.5 19c1-2.7 3.2-4 6-4s5 1.3 6 4", { key: "b" }), P("M15.5 6.2a3.2 3.2 0 0 1 0 5.6M17.5 15.3c1.6.6 2.6 1.8 3 3.7", { key: "c" })]),
  Mail: (p) => svg(p, [R(3.5, 5.5, 17, 13, { key: "a", rx: 2 }), P("M4 6.5l8 6.5 8-6.5", { key: "b" })]),
  Calendar: (p) => svg(p, [R(3.5, 5.5, 17, 15, { key: "a", rx: 2 }), P("M3.5 10h17M8 3.5v4M16 3.5v4", { key: "b" })]),
  Clock: (p) => svg(p, [C(12, 12, 8.5, { key: "a" }), P("M12 7.5V12l3 2.5", { key: "b" })]),
  Terminal: (p) => svg(p, [R(3.5, 4.5, 17, 15, { key: "a", rx: 2 }), P("M7 9l3 3-3 3M12.5 15.5H17", { key: "b" })]),
  Globe: (p) => svg(p, [C(12, 12, 8.5, { key: "a" }), P("M3.5 12h17M12 3.5c2.4 2.3 3.6 5.1 3.6 8.5S14.4 18.2 12 20.5c-2.4-2.3-3.6-5.1-3.6-8.5S9.6 5.8 12 3.5Z", { key: "b" })]),
  Sun: (p) => svg(p, [C(12, 12, 4, { key: "a" }), P("M12 3v2M12 19v2M21 12h-2M5 12H3M18.4 5.6L17 7M7 17l-1.4 1.4M18.4 18.4L17 17M7 7L5.6 5.6", { key: "b" })]),
  Moon: (p) => svg(p, [P("M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z", { key: "a" })]),
  Rocket: (p) => svg(p, [P("M12 16.5c-1.5-.4-3-1.9-3.4-3.4C9.5 8 12.5 4.5 18 4c-.5 5.5-4 8.5-6 9.5v3Z", { key: "a" }), C(14.5, 7.5, 1.2, { key: "b" }), P("M8.5 13.5c-1.8.3-3 2.7-3 5 2.3 0 4.7-1.2 5-3", { key: "c" })]),
  Home: (p) => svg(p, [P("M4.5 11L12 4.5 19.5 11", { key: "a" }), P("M6.5 9.5v10h11v-10", { key: "b" })]),
  File: (p) => svg(p, [P("M6.5 3.5h7l4 4v13h-11v-17Z", { key: "a" }), P("M13.5 3.5v4h4", { key: "b" })]),
  Folder: (p) => svg(p, [P("M3.5 6.5a1 1 0 0 1 1-1h5l2 2.5h8a1 1 0 0 1 1 1v9.5a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1v-12Z", { key: "a" })]),
};

export default icons;
