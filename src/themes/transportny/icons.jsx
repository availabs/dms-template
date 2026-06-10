// ⚠️ GENERATED FILE — do not edit by hand.
// Source of truth: src/themes/transportny/TransportNY Design System/dms_design_system_v2/theme/icons.js
// Regenerate: node scripts/icons-sync.mjs --brand transportny
// (CI: node scripts/icons-sync.mjs --brand transportny --check)

// TransportNY · icon registry (v2)
//
// Icons are looked up by name from the theme via the `Icon` component.
// Every name referenced inside theme.js must exist here, or the icon
// silently renders nothing.
//
// SVG sources are inline React components. Every icon is on a 24×24
// grid with stroke="currentColor" and strokeWidth=1.5, rounded caps
// and joins — consistent with the brand brief's "drawn at 24px,
// hairline, civic" directive.
//
// v2 additions over v1: Lock, Star, Trash, RefreshCw, ExternalLink,
// Folder, Tag, Info, AlertTriangle, Check (was missing), Drag (was
// missing). These show up in primitives the v1 components.html
// underspecified.

import React from "react";

const svg = (paths) => (props) =>
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
      ...props,
    },
    paths
  );

// ── Navigation / page glyphs ─────────────────────────────────────────
const Pages    = svg(<path d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"/>);
const Sections = svg(<path d="M6 6.878V6a2.25 2.25 0 0 1 2.25-2.25h7.5A2.25 2.25 0 0 1 18 6v.878M6 6.878A2.25 2.25 0 0 0 4.5 9v9a2.25 2.25 0 0 0 2.25 2.25h10.5A2.25 2.25 0 0 0 19.5 18V9A2.25 2.25 0 0 0 18 6.878"/>);
const Settings = svg(<path d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75"/>);
const History  = svg(<><path d="M12 22C6.477 22 2 17.523 2 12C2 6.477 6.477 2 12 2C16.478 2 20.226 4.943 21.5 9H19"/><path d="M12 8V12L14 14"/></>);
const Search   = svg(<><path d="M17.5 17.5L22 22"/><circle cx="11" cy="11" r="9"/></>);
const Database = svg(<><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M20 12C20 13.657 16.418 15 12 15C7.582 15 4 13.657 4 12"/><path d="M20 5V19C20 20.657 16.418 22 12 22C7.582 22 4 20.657 4 19V5"/></>);
const Folder   = svg(<path d="M3 7C3 5.343 4.343 4 6 4H9.586C10.116 4 10.625 4.211 11 4.586L12 6H18C19.657 6 21 7.343 21 9V17C21 18.657 19.657 20 18 20H6C4.343 20 3 18.657 3 17V7Z"/>);
const Menu     = svg(<path d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5"/>);

// ── Caret / chevron / arrow ─────────────────────────────────────────
const CaretDown    = svg(<path d="m19.5 8.25-7.5 7.5-7.5-7.5"/>);
const CaretUp      = svg(<path d="m4.5 15.75 7.5-7.5 7.5 7.5"/>);
const ChevronRight = svg(<path d="m8.25 4.5 7.5 7.5-7.5 7.5"/>);
const ChevronLeft  = svg(<path d="M15.75 19.5 8.25 12l7.5-7.5"/>);
const ChevronDown  = CaretDown;
const ChevronUp    = CaretUp;
const ArrowRight   = svg(<path d="M5 12h14M13 5l7 7-7 7"/>);
const ArrowLeft    = svg(<path d="M19 12H5M11 5l-7 7 7 7"/>);
const ArrowDown    = svg(<path d="M12 5v14M5 13l7 7 7-7"/>);
const ArrowUp      = svg(<path d="M12 19V5M5 11l7-7 7 7"/>);

// ── User / auth ─────────────────────────────────────────────────────
const User = svg(<><path d="M18.5 20V17.97C18.5 16.73 17.94 15.51 16.81 14.99C15.43 14.37 13.78 14 12 14C10.22 14 8.57 14.37 7.19 14.99C6.06 15.51 5.5 16.73 5.5 17.97V20"/><circle cx="12" cy="7.5" r="3.5"/></>);
const Lock = svg(<><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 1 1 8 0v3"/></>);

// ── Actions ─────────────────────────────────────────────────────────
const PencilEdit  = svg(<><path d="M16.21 4.98L17.62 3.58C18.39 2.81 19.65 2.81 20.42 3.58C21.19 4.35 21.19 5.61 20.42 6.38L19.02 7.79M16.21 4.98L10.98 10.22C9.93 11.26 9.41 11.78 9.06 12.42C8.7 13.06 8.34 14.56 8 16C9.44 15.66 10.94 15.3 11.58 14.94C12.22 14.59 12.74 14.07 13.78 13.02L19.02 7.79"/><path d="M21 12C21 16.24 21 18.36 19.68 19.68C18.36 21 16.24 21 12 21C7.76 21 5.64 21 4.32 19.68C3 18.36 3 16.24 3 12C3 7.76 3 5.64 4.32 4.32C5.64 3 7.76 3 12 3"/></>);
const View        = svg(<><path d="M21.54 11.05C21.85 11.47 22 11.68 22 12C22 12.32 21.85 12.53 21.54 12.96C20.18 14.87 16.69 19 12 19C7.31 19 3.82 14.87 2.46 12.96C2.15 12.53 2 12.32 2 12C2 11.68 2.15 11.47 2.46 11.05C3.82 9.13 7.31 5 12 5C16.69 5 20.18 9.13 21.54 11.05Z"/><circle cx="12" cy="12" r="3"/></>);
const Plus        = svg(<><path d="M12 4V20"/><path d="M4 12H20"/></>);
const Minus       = svg(<path d="M5 12h14"/>);
const XMark       = svg(<path d="M6 18 18 6M6 6l12 12"/>);
const Check       = svg(<path d="M4.5 12.75 9 17.25 19.5 6.75"/>);
const CircleCheck = svg(<><circle cx="12" cy="12" r="9"/><path d="M9 12l2 2 4-4"/></>);
const Trash       = svg(<><path d="M3 6h18"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><path d="M19 6l-1 14c-.1 1-1 2-2 2H8c-1 0-1.9-1-2-2L5 6"/></>);
const RefreshCw   = svg(<><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v6h-6"/></>);
const ExternalLink= svg(<><path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M19 14v5c0 1-1 2-2 2H5c-1 0-2-1-2-2V7c0-1 1-2 2-2h5"/></>);
const Star        = svg(<path d="M12 2l3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/>);
const Tag         = svg(<><path d="M3 12V5a2 2 0 0 1 2-2h7l9 9-9 9z"/><circle cx="8" cy="8" r="1.5" fill="currentColor"/></>);
const Info        = svg(<><circle cx="12" cy="12" r="9"/><path d="M12 8v.01"/><path d="M11 11h1v5h1"/></>);
const AlertTriangle = svg(<><path d="M12 4l9 16H3z"/><path d="M12 10v4"/><path d="M12 17v.01"/></>);

// ── Filter / sort / download / menu / drag ──────────────────────────
const Filter   = svg(<path d="M8.86 12.5C6.37 10.65 4.6 8.6 3.63 7.45C3.33 7.09 3.23 6.83 3.17 6.37C2.97 4.8 2.87 4.01 3.33 3.51C3.79 3 4.6 3 6.23 3H17.77C19.4 3 20.21 3 20.67 3.51C21.13 4.01 21.03 4.8 20.83 6.37C20.77 6.83 20.67 7.09 20.37 7.45C19.4 8.6 17.63 10.65 15.13 12.51C14.91 12.68 14.76 12.96 14.73 13.26C14.48 15.99 14.26 17.49 14.11 18.24C13.89 19.47 12.15 20.2 11.23 20.86C10.67 21.25 10 20.78 9.93 20.18C9.8 19.03 9.54 16.69 9.26 13.26C9.23 12.95 9.08 12.68 8.86 12.5Z"/>);
const Download = svg(<><path d="M3 17C3 17.93 3 18.4 3.1 18.78C3.38 19.81 4.19 20.62 5.22 20.9C5.6 21 6.07 21 7 21H17C17.93 21 18.4 21 18.78 20.9C19.81 20.62 20.62 19.81 20.9 18.78C21 18.4 21 17.93 21 17"/><path d="M16.5 11.5C16.5 11.5 13.19 16 12 16C10.81 16 7.5 11.5 7.5 11.5M12 15V3"/></>);
const More     = svg(<path d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z"/>);
const Drag     = svg(<><circle cx="9" cy="6" r="1.25" fill="currentColor"/><circle cx="15" cy="6" r="1.25" fill="currentColor"/><circle cx="9" cy="12" r="1.25" fill="currentColor"/><circle cx="15" cy="12" r="1.25" fill="currentColor"/><circle cx="9" cy="18" r="1.25" fill="currentColor"/><circle cx="15" cy="18" r="1.25" fill="currentColor"/></>);
const SortAsc  = svg(<><path d="M4 14h6m0 0L7 17M10 14L7 11"/><path d="M14 4h7m0 0-3 3m3-3-3-3"/></>);

// ── Maps / data viz ─────────────────────────────────────────────────
const MapLayers = svg(<path d="M6.43 9.75 2.25 12l4.18 2.25m0-4.5 5.57 3 5.57-3m-11.14 0L2.25 7.5 12 2.25l9.75 5.25-4.18 2.25m0 0L21.75 12l-4.18 2.25m0 0 4.18 2.25L12 21.75 2.25 16.5l4.18-2.25m11.14 0-5.57 3-5.57-3"/>);
const MapPin    = svg(<><path d="M12 21s7-5.5 7-12a7 7 0 1 0-14 0c0 6.5 7 12 7 12Z"/><circle cx="12" cy="9" r="2.5"/></>);
const Activity  = svg(<path d="M3 12h4l3-8 4 16 3-8h4"/>);
const Grid      = svg(<><rect x="3.5" y="3.5" width="7" height="7" rx="1"/><rect x="13.5" y="3.5" width="7" height="7" rx="1"/><rect x="3.5" y="13.5" width="7" height="7" rx="1"/><rect x="13.5" y="13.5" width="7" height="7" rx="1"/></>);
const ChartLine = svg(<><path d="M3 20V4"/><path d="M21 20H3"/><path d="M7 14l4-4 3 3 5-7"/></>);
const ChartBar  = svg(<><path d="M3 20V4"/><path d="M21 20H3"/><rect x="6" y="10" width="3" height="8"/><rect x="11" y="6" width="3" height="12"/><rect x="16" y="13" width="3" height="5"/></>);

// ── Notifications / media ───────────────────────────────────────────
const Bell  = svg(<><path d="M2.53 14.39C2.4 15.27 3 15.88 3.73 16.18C6.55 17.34 17.45 17.34 20.27 16.18C21 15.88 21.6 15.27 21.47 14.39C21.39 13.85 20.99 13.4 20.69 12.96C20.3 12.36 20.26 11.71 20.26 11C20.26 8.82 19.39 6.74 17.84 5.2C16.29 3.67 14.19 2.81 12 2.81C9.81 2.81 7.71 3.67 6.16 5.2C4.61 6.74 3.74 8.82 3.74 11C3.74 11.71 3.7 12.36 3.31 12.96C3.01 13.4 2.61 13.85 2.53 14.39Z"/><path d="M9 21C9.79 21.6 10.86 22 12 22C13.14 22 14.21 21.6 15 21"/></>);
const Play  = (props) => React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 24 24", fill: "currentColor", ...props }, React.createElement("path", { d: "M6 5v14l13-7z" }));
const Pause = svg(<><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></>);

// ── Brand mark ──────────────────────────────────────────────────────
const Logo = (props) => React.createElement(
  "svg",
  { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 24 24", fill: "currentColor", ...props },
  React.createElement("path", { d: "M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3Zm0 4 4.5 1.6V11c0 3.8-2 6.9-4.5 8.6-2.5-1.7-4.5-4.8-4.5-8.6V7.6L12 6Z" })
);

// ── Freight modes (Freight Atlas) ───────────────────────────────────
const Road     = svg(<path d="M3 12h18M6 12V7m12 5V7M9 12v5m6-5v5"/>);
const Rail     = svg(<><rect x="4" y="4" width="16" height="12" rx="2"/><path d="M4 11h16M8 20l2-4m6 4-2-4"/></>);
const Maritime = svg(<path d="M3 14h18l-2 5H5l-2-5ZM12 3v11M7 9h10"/>);
const Air      = svg(<path d="M2 16l20-7-9 13-2-5-9-1Z"/>);
const Pipeline = svg(<path d="M4 7h12v10H4zM16 10h3l2 3v4h-5M6.5 17a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0Zm10 0a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0Z"/>);
// ── Atlas surfaces (sidenav glyphs) ─────────────────────────────────
const House    = svg(<path d="m3 10.5 9-7 9 7M5 9v11h14V9"/>);
const Atlas    = svg(<path d="M9 20 3 17V4l6 3m0 13 6-3m-6 3V7m6 10 6 3V7l-6-3m0 13V4m0 0L9 7"/>);
const Book     = svg(<><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/></>);

// ── Documents / content (report library, embeds, map controls) ──────
const FileText = svg(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></>);
const Users    = svg(<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></>);
const Archive  = svg(<path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2z"/>);
const Mail     = svg(<><path d="M4 4h16v16H4z"/><path d="m4 6 8 6 8-6"/></>);
const Locate   = svg(<><circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/></>);
const Maximize = svg(<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/>);
const Code     = svg(<path d="m8 9-3 3 3 3m8-6 3 3-3 3M13.5 5l-3 14"/>);
// ── Places / data (legacy report + map pages) ───────────────────────
const Building = svg(<path d="M3 21h18M5 21V8l7-5 7 5v13M9 14h6M9 18h6"/>);
const Map      = svg(<path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>);
const Export   = svg(<path d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"/>);

const icons = {
  // Navigation
  Pages, Sections, Settings, History, Search, Database, Menu, Folder,
  // Freight Atlas — modes + surfaces
  Road, Rail, Maritime, Air, Pipeline, House, Atlas, Book,
  // Documents / content
  FileText, Users, Archive, Mail, Locate, Maximize, Code,
  // Places / data
  Building, Map, Export,
  // Direction
  CaretDown, CaretUp, ChevronRight, ChevronLeft, ChevronDown, ChevronUp,
  ArrowRight, ArrowLeft, ArrowDown, ArrowUp,
  // User / auth
  User, Lock, Logo,
  // Actions
  PencilEdit, View, Plus, Minus, XMark, Check, CircleCheck, Trash,
  RefreshCw, ExternalLink, Star, Tag, Info, AlertTriangle,
  Filter, Download, More, Drag, SortAsc,
  // Data viz
  MapLayers, MapPin, Activity, Grid, ChartLine, ChartBar,
  // Media
  Bell, Play, Pause,
};

export default icons;
