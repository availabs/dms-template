// Tessera v4 · icon registry — SOURCE OF TRUTH
//
// The live `src/themes/tessera/icons.jsx` is GENERATED from this file
// by scripts/icons-sync.mjs. Do not run the sync until the v4 theme
// translation lands — the current live registry belongs to the v2
// theme that production sites still consume.
//
// Drawing rules (the chisel, not the pen):
//   · 24×24 grid, strokeWidth 1.75
//   · strokeLinecap "square", strokeLinejoin "miter" — cut, not drawn
//   · no rounded corners; curves only where a glyph is unreadable
//     without them (User, Clock, Key)
//   · wherever another set would use a dot, use a small FILLED SQUARE
//     — the tessera cell is the brand's atom (Ellipsis, Grip, chart
//     points, indicator lights, the Eye's pupil)
//
// Naming: PascalCase, depicts the glyph, not the use site.

import React from "react";

const svg = (paths) => (props) =>
  React.createElement(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.75,
      strokeLinecap: "square",
      strokeLinejoin: "miter",
      ...props,
    },
    paths
  );

// A filled cell — the recurring atom. fill, no stroke.
const cell = (x, y, s = 2.5) => (
  <rect x={x} y={y} width={s} height={s} fill="currentColor" stroke="none" />
);

// ── Brand / console glyphs ───────────────────────────────────────────
const Terminal  = svg(<><rect x="3" y="4" width="18" height="16"/><path d="m6.5 9 3.5 3-3.5 3"/><rect x="12.5" y="14.25" width="4.5" height="1.75" fill="currentColor" stroke="none"/></>);
const Prompt    = svg(<><path d="m5 7 5 5-5 5"/><path d="M13 19h7"/></>);
const Cursor    = svg(<rect x="8" y="5" width="8" height="14" fill="currentColor" stroke="none"/>);
const Tessera   = svg(<><rect x="3" y="3" width="18" height="18"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/><rect x="15" y="9" width="6" height="6" fill="currentColor" stroke="none"/></>);
const Code      = svg(<><path d="m8 7-5 5 5 5"/><path d="m16 7 5 5-5 5"/></>);

// ── Navigation / chrome ──────────────────────────────────────────────
const Menu         = svg(<path d="M4 6h16M4 12h16M4 18h16"/>);
const Close        = svg(<path d="m6 6 12 12M18 6 6 18"/>);
const ChevronDown  = svg(<path d="m6 9 6 6 6-6"/>);
const ChevronUp    = svg(<path d="m6 15 6-6 6 6"/>);
const ChevronRight = svg(<path d="m9 6 6 6-6 6"/>);
const ChevronLeft  = svg(<path d="m15 6-6 6 6 6"/>);
const CaretDown    = svg(<path d="M6.5 9h11L12 16 6.5 9Z" fill="currentColor" stroke="none"/>);
const ArrowRight   = svg(<path d="M4 12h15m-5.5-5.5L19 12l-5.5 5.5"/>);
const ArrowLeft    = svg(<path d="M20 12H5m5.5-5.5L5 12l5.5 5.5"/>);
const ArrowUpRight = svg(<path d="M7 17 17 7M9.5 7H17v7.5"/>);
const Search       = svg(<><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/></>);
const Ellipsis     = svg(<>{cell(4.25, 10.75)}{cell(10.75, 10.75)}{cell(17.25, 10.75)}</>);
const EllipsisV    = svg(<>{cell(10.75, 4.25)}{cell(10.75, 10.75)}{cell(10.75, 17.25)}</>);
const Grip         = svg(<>{cell(8, 4.5)}{cell(13.5, 4.5)}{cell(8, 10.75)}{cell(13.5, 10.75)}{cell(8, 17)}{cell(13.5, 17)}</>);
const External     = svg(<><path d="M18 13.5V20H4V6h6.5"/><path d="M14 4h6v6"/><path d="M20 4 11 13"/></>);
const Home         = svg(<path d="M4 11 12 4l8 7v9h-5.5v-6h-5v6H4v-9Z"/>);
const LogOut       = svg(<><path d="M10 4H4v16h6"/><path d="m15 8 4 4-4 4M9 12h10"/></>);

// ── Renderings (the product's surfaces) ──────────────────────────────
const Page      = svg(<><path d="M6 3h8l4 4v14H6V3Z"/><path d="M14 3v4h4"/><path d="M9 12h6M9 16h6"/></>);
const Table     = svg(<><rect x="3" y="5" width="18" height="14"/><path d="M3 9.5h18M9 9.5V19M15 9.5V19"/></>);
const ChartBar  = svg(<><rect x="4" y="11" width="4" height="9"/><rect x="10" y="4" width="4" height="16"/><rect x="16" y="14" width="4" height="6"/></>);
const ChartLine = svg(<><path d="M4 16.5 9 10l4 3.5L19.5 6"/>{cell(3, 15.25)}{cell(7.75, 8.75)}{cell(11.75, 12.25)}{cell(18.25, 4.75)}</>);
const Map       = svg(<><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z"/><path d="M9 4v14M15 6v14"/></>);
const Lexical   = svg(<><path d="M4 6h16M4 11h16M4 16h9"/><rect x="15.5" y="15" width="4.5" height="1.75" fill="currentColor" stroke="none"/></>);

// ── Data / structure ─────────────────────────────────────────────────
const Database  = svg(<><rect x="5" y="3.5" width="14" height="4.5"/><rect x="5" y="9.75" width="14" height="4.5"/><rect x="5" y="16" width="14" height="4.5"/></>);
const Layers    = svg(<><path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="m3 12.5 9 5 9-5"/><path d="m3 17 9 5 9-5"/></>);
const Join      = svg(<><rect x="3" y="8" width="8" height="8"/><rect x="13" y="8" width="8" height="8"/><path d="M11 12h2"/></>);
const Folder    = svg(<path d="M3 19.5V5.5h7l2 3h9v11H3Z"/>);
const FolderOpen= svg(<><path d="M3 19.5V5.5h7l2 3h8v3"/><path d="M21 11.5 18.5 19.5H3l3-8h15Z"/></>);
const Filter    = svg(<path d="M4 5h16l-6 7v6.5l-4-2V12L4 5Z"/>);
const SortAsc   = svg(<><path d="M4 6h12M4 12h8M4 18h5"/><path d="M18 19V8m-3.5 3.5L18 8l3.5 3.5"/></>);
const SortDesc  = svg(<><path d="M4 6h5M4 12h8M4 18h12"/><path d="M18 5v11m-3.5-3.5L18 16l3.5-3.5"/></>);
const Branch    = svg(<><rect x="4.5" y="4.5" width="5" height="5"/><rect x="4.5" y="14.5" width="5" height="5"/><rect x="14.5" y="4.5" width="5" height="5"/><path d="M7 9.5v5M17 9.5V12a3 3 0 0 1-3 3h-2.5"/></>);
const Server    = svg(<><rect x="4" y="4" width="16" height="7"/><rect x="4" y="13" width="16" height="7"/>{cell(6.5, 6.5, 2)}{cell(6.5, 15.5, 2)}</>);
const Cloud     = svg(<path d="M7 18.5h10.5a3.5 3.5 0 0 0 .6-6.95A5.75 5.75 0 0 0 7 9.7a4.4 4.4 0 0 0 0 8.8Z"/>);

// ── Actions ──────────────────────────────────────────────────────────
const Plus     = svg(<path d="M12 5v14M5 12h14"/>);
const Minus    = svg(<path d="M5 12h14"/>);
const Check    = svg(<path d="m4.5 12.5 5 5L19.5 6.5"/>);
const Edit     = svg(<><path d="M4 20v-4L16 4l4 4L8 20H4Z"/><path d="m13 7 4 4"/></>);
const Trash    = svg(<><path d="M5 7h14M9.5 7V4h5v3M7 7l1 13h8l1-13"/><path d="M10.25 10.5v6M13.75 10.5v6"/></>);
const Copy     = svg(<><rect x="9" y="9" width="11" height="11"/><path d="M5 15V4h11"/></>);
const Download = svg(<><path d="M12 4v11m-4.5-4.5L12 15l4.5-4.5"/><path d="M4 20h16"/></>);
const Upload   = svg(<><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5"/><path d="M4 20h16"/></>);
const Link     = svg(<><path d="M10.5 7H5v10h5.5"/><path d="M13.5 7H19v10h-5.5"/><path d="M9 12h6"/></>);
const Play     = svg(<path d="M8 5v14l11-7L8 5Z"/>);
const Refresh  = svg(<><path d="M20 5v6h-6"/><path d="M20 11A8 8 0 1 0 17.7 16.7"/></>);

// ── State / feedback ─────────────────────────────────────────────────
const Info    = svg(<><rect x="4" y="4" width="16" height="16"/>{cell(10.75, 7)}<path d="M12 12v5"/></>);
const Warning = svg(<><path d="M12 3.5 22 20.5H2L12 3.5Z"/><path d="M12 10v4"/>{cell(10.9, 16, 2.2)}</>);
const Error   = svg(<><path d="M12 2.5 21.5 12 12 21.5 2.5 12 12 2.5Z"/><path d="m9.5 9.5 5 5m0-5-5 5"/></>);
const Eye     = svg(<><path d="M2.5 12S6.5 5.5 12 5.5 21.5 12 21.5 12 17.5 18.5 12 18.5 2.5 12 2.5 12Z"/>{cell(10.25, 10.25, 3.5)}</>);
const EyeOff  = svg(<><path d="M2.5 12S6.5 5.5 12 5.5c2 0 3.8.9 5.3 2M21.5 12s-4 6.5-9.5 6.5c-2 0-3.8-.9-5.3-2"/><path d="M4 20 20 4"/></>);
const Lock    = svg(<><rect x="5" y="11" width="14" height="9"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>{cell(10.75, 14.25)}</>);
const Key     = svg(<><circle cx="7.5" cy="16.5" r="3.75"/><path d="M10.5 13.5 20 4M15 9l3 3M17.5 6.5l2 2"/></>);

// ── People / time / meta ─────────────────────────────────────────────
const User     = svg(<><circle cx="12" cy="8" r="4"/><path d="M4.5 20c.5-4 3.5-6 7.5-6s7 2 7.5 6"/></>);
const Users    = svg(<><circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 19.5c.4-3.5 3-5.25 6.5-5.25s6.1 1.75 6.5 5.25"/><path d="M15.5 5.5a3.5 3.5 0 0 1 0 6.5M18 14.75c2 .8 3.2 2.4 3.5 4.75"/></>);
const Calendar = svg(<><rect x="4" y="5" width="16" height="15"/><path d="M4 10h16M8.5 3v4M15.5 3v4"/>{cell(13.75, 13.5)}</>);
const Clock    = svg(<><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/></>);
const Settings = svg(<><path d="M3 6.5h18M3 12h18M3 17.5h18"/>{cell(13.75, 5.25)}{cell(6.75, 10.75)}{cell(15.75, 16.25)}</>);
const Book     = svg(<><path d="M5 3.5h13.5a1.5 1.5 0 0 1 0 0V17H6.5A2.5 2.5 0 0 0 4 19.5V6a2.5 2.5 0 0 1 2.5-2.5"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22h13V17"/></>);

export const icons = {
  // brand / console
  Terminal, Prompt, Cursor, Tessera, Code,
  // navigation / chrome
  Menu, Close, ChevronDown, ChevronUp, ChevronRight, ChevronLeft,
  CaretDown, ArrowRight, ArrowLeft, ArrowUpRight, Search,
  Ellipsis, EllipsisV, Grip, External, Home, LogOut,
  // renderings
  Page, Table, ChartBar, ChartLine, Map, Lexical,
  // data / structure
  Database, Layers, Join, Folder, FolderOpen, Filter,
  SortAsc, SortDesc, Branch, Server, Cloud,
  // actions
  Plus, Minus, Check, Edit, Trash, Copy, Download, Upload,
  Link, Play, Refresh,
  // state / feedback
  Info, Warning, Error, Eye, EyeOff, Lock, Key,
  // people / time / meta
  User, Users, Calendar, Clock, Settings, Book,
};

export default icons;
