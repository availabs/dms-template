/* ═══════════════════════════════════════════════════════════════════════
   Tessera Design System v3 — icon registry (SOURCE OF TRUTH)

   A custom drawn set (v2 shipped Lucide; the drawn set was v2's stated
   v0.2 intention). Rules of the hand:
     · 24×24 grid, 1.5px stroke, no fills except marked point-squares
     · butt caps + miter joins — terminals read drafted, not drawn
     · square corners; diamonds (rotated squares) where another set would
       use dots — the tessera is the set's recurring aperture
     · depict the glyph (Map, Quote), not the use site

   Lifecycle (see src/dms/skills/managing-design-system-icons.md):
     · every <svg> in the design pages carries <!-- icon: Name --> or
       <!-- decorative --> — audit with scratchpad/scripts/icons-audit.mjs
     · the live theme registry is GENERATED from this file by
       scratchpad/scripts/icons-sync.mjs — do not run the sync until the
       v3 theme translation lands (src/themes/tessera/icons.jsx currently
       belongs to the v2 Lucide registry).
   ═══════════════════════════════════════════════════════════════════════ */

import React from "react";

const svg = (children) => (props) =>
  React.createElement(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.5,
      strokeLinecap: "butt",
      strokeLinejoin: "miter",
      "aria-hidden": true,
      ...props,
    },
    children
  );

const p = (d, extra) => React.createElement("path", { d, ...extra });
const r = (x, y, w, h, extra) => React.createElement("rect", { x, y, width: w, height: h, ...extra });
const c = (cx, cy, rr, extra) => React.createElement("circle", { cx, cy, r: rr, ...extra });
const point = (x, y) => r(x, y, 1.4, 1.4, { fill: "currentColor", stroke: "none" });

/* ── chrome & navigation ─────────────────────────────────────────────── */
const Menu = svg([p("M3 6h18", { key: 1 }), p("M3 12h18", { key: 2 }), p("M3 18h18", { key: 3 })]);
const Close = svg([p("M5 5l14 14", { key: 1 }), p("M19 5 5 19", { key: 2 })]);
const ChevronDown = svg(p("M5 9l7 7 7-7"));
const ChevronUp = svg(p("M5 15l7-7 7 7"));
const ChevronRight = svg(p("M9 5l7 7-7 7"));
const ChevronLeft = svg(p("M15 5l-7 7 7 7"));
const ArrowRight = svg([p("M3 12h17", { key: 1 }), p("M14 6l6 6-6 6", { key: 2 })]);
const ArrowUpRight = svg([p("M6 18 18 6", { key: 1 }), p("M8 6h10v10", { key: 2 })]);
const ExternalLink = svg([p("M13 5h6v6", { key: 1 }), p("M19 5l-8.5 8.5", { key: 2 }), p("M16 13.5V19.5H4V7.5h6", { key: 3 })]);
const Search = svg([c(10.5, 10.5, 6, { key: 1 }), p("M15 15l6 6", { key: 2 })]);

/* ── actions ─────────────────────────────────────────────────────────── */
const Plus = svg([p("M12 4v16", { key: 1 }), p("M4 12h16", { key: 2 })]);
const Check = svg(p("M4 12.5l5.5 5.5L20 7.5"));
const Pencil = svg([p("M4 20l1.2-4.8L17 3.4l3.6 3.6L8.8 18.8 4 20Z", { key: 1 }), p("M14.5 5.9l3.6 3.6", { key: 2 })]);
const Trash = svg([p("M4 7h16", { key: 1 }), p("M9 7V4.5h6V7", { key: 2 }), p("M6.5 7l1 13h9l1-13", { key: 3 })]);
const Copy = svg([r(8.5, 8.5, 12, 12, { key: 1 }), p("M5.5 15.5h-2v-12h12v2", { key: 2 })]);
const Download = svg([p("M12 4v11", { key: 1 }), p("M7.5 11l4.5 4.5L16.5 11", { key: 2 }), p("M4 19.5h16", { key: 3 })]);
const Upload = svg([p("M12 15V4.5", { key: 1 }), p("M7.5 8.5 12 4l4.5 4.5", { key: 2 }), p("M4 19.5h16", { key: 3 })]);
const Settings = svg([p("M5 4v16", { key: 1 }), p("M12 4v16", { key: 2 }), p("M19 4v16", { key: 3 }), r(3.5, 8, 3, 3, { key: 4, fill: "#FBF9F4" }), r(10.5, 13, 3, 3, { key: 5, fill: "#FBF9F4" }), r(17.5, 5, 3, 3, { key: 6, fill: "#FBF9F4" })]);
const Filter = svg(p("M4 5h16l-6 7v6l-4 2v-8L4 5Z"));
const Sort = svg([p("M8 5v14", { key: 1 }), p("M4.5 15.5 8 19l3.5-3.5", { key: 2 }), p("M16 19V5", { key: 3 }), p("M12.5 8.5 16 5l3.5 3.5", { key: 4 })]);
const Eye = svg([p("M2.5 12S6 5.75 12 5.75 21.5 12 21.5 12 18 18.25 12 18.25 2.5 12 2.5 12Z", { key: 1 }), p("M12 9.5l2.5 2.5-2.5 2.5L9.5 12 12 9.5Z", { key: 2 })]);
const EyeOff = svg([p("M2.5 12S6 5.75 12 5.75c1.6 0 3 .45 4.3 1.1M21.5 12S18 18.25 12 18.25c-1.6 0-3-.45-4.3-1.1", { key: 1 }), p("M4 4l16 16", { key: 2 })]);
const Lock = svg([r(5.5, 10.5, 13, 9.5, { key: 1 }), p("M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3", { key: 2 })]);

/* ── people ──────────────────────────────────────────────────────────── */
const User = svg([c(12, 8, 3.5, { key: 1 }), p("M5 20c0-3.9 3.1-6 7-6s7 2.1 7 6", { key: 2 })]);
const Users = svg([c(9, 8, 3, { key: 1 }), p("M3 19c0-3.3 2.7-5 6-5s6 1.7 6 5", { key: 2 }), p("M15.5 5.2a3 3 0 0 1 0 5.6", { key: 3 }), p("M16.5 14.2c2.6.5 4.5 2 4.5 4.8", { key: 4 })]);

/* ── data ────────────────────────────────────────────────────────────── */
const Database = svg([p("M5 5.5c0-1.4 3.1-2.5 7-2.5s7 1.1 7 2.5-3.1 2.5-7 2.5-7-1.1-7-2.5Z", { key: 1 }), p("M5 5.5v13c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-13", { key: 2 }), p("M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5", { key: 3 })]);
const Table = svg([r(3, 4.5, 18, 15, { key: 1 }), p("M3 9.5h18", { key: 2 }), p("M9 9.5v10", { key: 3 }), p("M15 9.5v10", { key: 4 })]);
const Columns = svg([r(3, 4.5, 18, 15, { key: 1 }), p("M9.5 4.5v15", { key: 2 }), p("M15.5 4.5v15", { key: 3 })]);
const Rows = svg([r(3, 4.5, 18, 15, { key: 1 }), p("M3 9.5h18", { key: 2 }), p("M3 14.5h18", { key: 3 })]);
const Chart = svg([r(5, 12, 3.5, 7.5, { key: 1 }), r(10.25, 6, 3.5, 13.5, { key: 2 }), r(15.5, 9.5, 3.5, 10, { key: 3 })]);
const Map = svg([p("M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z", { key: 1 }), p("M9 4v14", { key: 2 }), p("M15 6v14", { key: 3 })]);
const MapPin = svg([p("M12 21s-6.5-5.4-6.5-10a6.5 6.5 0 0 1 13 0c0 4.6-6.5 10-6.5 10Z", { key: 1 }), p("M12 8.6l2.4 2.4-2.4 2.4-2.4-2.4L12 8.6Z", { key: 2 })]);
const Layers = svg([p("M12 3l8 4.5-8 4.5-8-4.5L12 3Z", { key: 1 }), p("M4 12.3 12 16.8l8-4.5", { key: 2 }), p("M4 16.3 12 20.8l8-4.5", { key: 3 })]);
const Globe = svg([c(12, 12, 8.25, { key: 1 }), p("M3.75 12h16.5", { key: 2 }), p("M12 3.75c-2.5 2.3-3.75 5.05-3.75 8.25s1.25 5.95 3.75 8.25c2.5-2.3 3.75-5.05 3.75-8.25S14.5 6.05 12 3.75Z", { key: 3 })]);

/* ── content ─────────────────────────────────────────────────────────── */
const Page = svg([p("M6 3h9l4 4v14H6V3Z", { key: 1 }), p("M15 3v4h4", { key: 2 }), p("M9 12h6", { key: 3 }), p("M9 16h6", { key: 4 })]);
const Code = svg([p("M8.5 7 4 12l4.5 5", { key: 1 }), p("M15.5 7 20 12l-4.5 5", { key: 2 })]);
const LinkIcon = svg([p("M10 14a4 4 0 0 1 0-5.6l3-3a4 4 0 0 1 5.6 5.6L17 12.6", { key: 1 }), p("M14 10a4 4 0 0 1 0 5.6l-3 3a4 4 0 0 1-5.6-5.6L7 11.4", { key: 2 })]);
const Image = svg([r(3.5, 4.5, 17, 15, { key: 1 }), p("M8 8.2l1.4 1.4L8 11 6.6 9.6 8 8.2Z", { key: 2 }), p("M3.5 16.5l5-5 4 4 3.5-3.5 4.5 4.5", { key: 3 })]);
const List = svg([p("M9 6h12", { key: 1 }), p("M9 12h12", { key: 2 }), p("M9 18h12", { key: 3 }), r(3.5, 5, 2.5, 2.5, { key: 4 }), r(3.5, 11, 2.5, 2.5, { key: 5 }), r(3.5, 17, 2.5, 2.5, { key: 6 })]);
const Quote = svg([p("M9.5 7.5c-2.5.8-4 2.8-4 6v3h5v-5h-3", { key: 1 }), p("M18.5 7.5c-2.5.8-4 2.8-4 6v3h5v-5h-3", { key: 2 })]);
const Calendar = svg([r(3.5, 5.5, 17, 15, { key: 1 }), p("M3.5 10h17", { key: 2 }), p("M8 3.5v4", { key: 3 }), p("M16 3.5v4", { key: 4 })]);
const Clock = svg([c(12, 12, 8.25, { key: 1 }), p("M12 7v5.5l3.5 2", { key: 2 })]);

/* ── status ──────────────────────────────────────────────────────────── */
const Alert = svg([p("M12 3.5 22 20H2L12 3.5Z", { key: 1 }), p("M12 10v4.5", { key: 2 }), point(11.3, 16.6)]);
const Info = svg([c(12, 12, 8.25, { key: 1 }), p("M12 11v5.5", { key: 2 }), point(11.3, 7.4)]);
const Loader = svg(p("M12 3.75a8.25 8.25 0 1 0 8.25 8.25"));
const Moon = svg(p("M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"));

/* ── the brand's own glyphs ──────────────────────────────────────────── */
const Grid = svg([r(4, 4, 6.5, 6.5, { key: 1 }), r(13.5, 4, 6.5, 6.5, { key: 2 }), r(4, 13.5, 6.5, 6.5, { key: 3 }), r(13.5, 13.5, 6.5, 6.5, { key: 4 })]);
const Tessera = svg(p("M12 4.5 19.5 12 12 19.5 4.5 12 12 4.5Z"));
const TileMark = svg([r(4, 4, 16, 16, { key: 1 }), p("M12 8.5l3.5 3.5-3.5 3.5L8.5 12 12 8.5Z", { key: 2 })]);

const icons = {
  /* chrome & navigation */
  Menu, Close, ChevronDown, ChevronUp, ChevronRight, ChevronLeft,
  ArrowRight, ArrowUpRight, ExternalLink, Search,
  /* actions */
  Plus, Check, Pencil, Trash, Copy, Download, Upload, Settings,
  Filter, Sort, Eye, EyeOff, Lock,
  /* people */
  User, Users,
  /* data */
  Database, Table, Columns, Rows, Chart, Map, MapPin, Layers, Globe,
  /* content */
  Page, Code, Link: LinkIcon, Image, List, Quote, Calendar, Clock,
  /* status */
  Alert, Info, Loader, Moon,
  /* brand */
  Grid, Tessera, TileMark,
};

export default icons;
