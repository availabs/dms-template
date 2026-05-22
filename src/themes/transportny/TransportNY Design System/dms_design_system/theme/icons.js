// TransportNY · icon registry
//
// Icons are looked up by name from the theme via the `Icon` component
// (DMS contract: `<Icon icon={t.icon} className={t.iconWrapper}/>` resolves
// the name against `theme.Icons`). New icons added here automatically
// become available to every primitive whose theme entry references an
// `icon`/`*Icon` string.
//
// SVG sources are inline React components. Every icon is on a 24×24 grid
// with stroke="currentColor" and strokeWidth=1.5, rounded caps and joins
// — consistent with the brand brief's "drawn at 24px, hairline, civic"
// directive. Reference standalone SVGs live in ./icons/*.svg.

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

// Pages / sections / settings — navigation glyphs
const Pages = svg(<path d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"/>);
const Sections = svg(<path d="M6 6.878V6a2.25 2.25 0 0 1 2.25-2.25h7.5A2.25 2.25 0 0 1 18 6v.878m-12 0c.235-.083.487-.128.75-.128h10.5c.263 0 .515.045.75.128m-12 0A2.25 2.25 0 0 0 4.5 9v.878m13.5-3A2.25 2.25 0 0 1 19.5 9v.878m0 0a2.246 2.246 0 0 0-.75-.128H5.25c-.263 0-.515.045-.75.128m15 0A2.25 2.25 0 0 1 21 12v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6c0-.98.626-1.813 1.5-2.122"/>);
const Settings = svg(<path d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75"/>);
const History = svg(<><path d="M12 22C6.477 22 2 17.523 2 12C2 6.477 6.477 2 12 2C16.478 2 20.226 4.943 21.5 9H19"/><path d="M12 8V12L14 14"/></>);
const Search = svg(<><path d="M17.5 17.5L22 22"/><circle cx="11" cy="11" r="9"/></>);
const Database = svg(<><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M20 12C20 13.657 16.418 15 12 15C7.582 15 4 13.657 4 12"/><path d="M20 5V19C20 20.657 16.418 22 12 22C7.582 22 4 20.657 4 19V5"/></>);

// Caret / chevron / arrow — direction
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

// User / auth
const User = svg(<><path d="M18.5 20V17.97C18.5 16.73 17.94 15.51 16.81 14.99C15.43 14.37 13.78 14 12 14C10.22 14 8.57 14.37 7.19 14.99C6.06 15.51 5.5 16.73 5.5 17.97V20"/><circle cx="12" cy="7.5" r="3.5"/></>);

// Action icons
const PencilEdit  = svg(<><path d="M16.21 4.98L17.62 3.58C18.39 2.81 19.65 2.81 20.42 3.58C21.19 4.35 21.19 5.61 20.42 6.38L19.02 7.79M16.21 4.98L10.98 10.22C9.93 11.26 9.41 11.78 9.06 12.42C8.7 13.06 8.34 14.56 8 16C9.44 15.66 10.94 15.3 11.58 14.94C12.22 14.59 12.74 14.07 13.78 13.02L19.02 7.79"/><path d="M21 12C21 16.24 21 18.36 19.68 19.68C18.36 21 16.24 21 12 21C7.76 21 5.64 21 4.32 19.68C3 18.36 3 16.24 3 12C3 7.76 3 5.64 4.32 4.32C5.64 3 7.76 3 12 3"/></>);
const View        = svg(<><path d="M21.54 11.05C21.85 11.47 22 11.68 22 12C22 12.32 21.85 12.53 21.54 12.96C20.18 14.87 16.69 19 12 19C7.31 19 3.82 14.87 2.46 12.96C2.15 12.53 2 12.32 2 11.68 2.15 11.47 2.46 11.05C3.82 9.13 7.31 5 12 5C16.69 5 20.18 9.13 21.54 11.05Z"/><circle cx="12" cy="12" r="3"/></>);
const Plus        = svg(<><path d="M12 4V20"/><path d="M4 12H20"/></>);
const Minus       = svg(<path d="M5 12h14"/>);
const XMark       = svg(<path d="M6 18 18 6M6 6l12 12"/>);
const Check       = svg(<path d="M4.5 12.75 9 17.25 19.5 6.75"/>);
const CircleCheck = svg(<><circle cx="12" cy="12" r="9"/><path d="M9 12l2 2 4-4"/></>);

// Filter / sort / download / menu
const Filter   = svg(<path d="M8.86 12.5C6.37 10.65 4.6 8.6 3.63 7.45C3.33 7.09 3.23 6.83 3.17 6.37C2.97 4.8 2.87 4.01 3.33 3.51C3.79 3 4.6 3 6.23 3H17.77C19.4 3 20.21 3 20.67 3.51C21.13 4.01 21.03 4.8 20.83 6.37C20.77 6.83 20.67 7.09 20.37 7.45C19.4 8.6 17.63 10.65 15.13 12.51C14.91 12.68 14.76 12.96 14.73 13.26C14.48 15.99 14.26 17.49 14.11 18.24C13.89 19.47 12.15 20.2 11.23 20.86C10.67 21.25 10 20.78 9.93 20.18C9.8 19.03 9.54 16.69 9.26 13.26C9.23 12.95 9.08 12.68 8.86 12.5Z"/>);
const Download = svg(<><path d="M3 17C3 17.93 3 18.4 3.1 18.78C3.38 19.81 4.19 20.62 5.22 20.9C5.6 21 6.07 21 7 21H17C17.93 21 18.4 21 18.78 20.9C19.81 20.62 20.62 19.81 20.9 18.78C21 18.4 21 17.93 21 17"/><path d="M16.5 11.5C16.5 11.5 13.19 16 12 16C10.81 16 7.5 11.5 7.5 11.5M12 15V3"/></>);
const More     = svg(<path d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z"/>);
const Menu     = svg(<path d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5"/>);
const Drag     = svg(<><circle cx="9" cy="6" r="1.25"/><circle cx="15" cy="6" r="1.25"/><circle cx="9" cy="12" r="1.25"/><circle cx="15" cy="12" r="1.25"/><circle cx="9" cy="18" r="1.25"/><circle cx="15" cy="18" r="1.25"/></>);

// Maps / data viz
const MapLayers = svg(<path d="M6.43 9.75 2.25 12l4.18 2.25m0-4.5 5.57 3 5.57-3m-11.14 0L2.25 7.5 12 2.25l9.75 5.25-4.18 2.25m0 0L21.75 12l-4.18 2.25m0 0 4.18 2.25L12 21.75 2.25 16.5l4.18-2.25m11.14 0-5.57 3-5.57-3"/>);
const MapPin    = svg(<><path d="M12 21s7-5.5 7-12a7 7 0 1 0-14 0c0 6.5 7 12 7 12Z"/><circle cx="12" cy="9" r="2.5"/></>);
const Activity  = svg(<path d="M3 12h4l3-8 4 16 3-8h4"/>);
const Grid      = svg(<><rect x="3.5" y="3.5" width="7" height="7" rx="1"/><rect x="13.5" y="3.5" width="7" height="7" rx="1"/><rect x="3.5" y="13.5" width="7" height="7" rx="1"/><rect x="13.5" y="13.5" width="7" height="7" rx="1"/></>);
const SortAsc   = svg(<><path d="M4 14h6m0 0L7 17M10 14L7 11"/><path d="M14 4h7m0 0-3 3m3-3-3-3"/></>);

// Notifications / media
const Bell  = svg(<><path d="M2.53 14.39C2.4 15.27 3 15.88 3.73 16.18C6.55 17.34 17.45 17.34 20.27 16.18C21 15.88 21.6 15.27 21.47 14.39C21.39 13.85 20.99 13.4 20.69 12.96C20.3 12.36 20.26 11.71 20.26 11C20.26 8.82 19.39 6.74 17.84 5.2C16.29 3.67 14.19 2.81 12 2.81C9.81 2.81 7.71 3.67 6.16 5.2C4.61 6.74 3.74 8.82 3.74 11C3.74 11.71 3.7 12.36 3.31 12.96C3.01 13.4 2.61 13.85 2.53 14.39Z"/><path d="M9 21C9.79 21.6 10.86 22 12 22C13.14 22 14.21 21.6 15 21"/></>);
const Play  = (props) => React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 24 24", fill: "currentColor", ...props }, <path d="M6 5v14l13-7z"/>);
const Pause = svg(<><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></>);

// Brand mark — the NYS shield placeholder
const Logo = (props) => React.createElement(
  "svg",
  { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 24 24", fill: "currentColor", ...props },
  React.createElement("path", { d: "M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3Zm0 4 4.5 1.6V11c0 3.8-2 6.9-4.5 8.6-2.5-1.7-4.5-4.8-4.5-8.6V7.6L12 6Z" })
);

const icons = {
  // Navigation
  Pages, Sections, Settings, History, Search, Database, Menu,
  // Direction
  CaretDown, CaretUp, ChevronRight, ChevronLeft, ChevronDown, ChevronUp,
  ArrowRight, ArrowLeft, ArrowDown, ArrowUp,
  // User
  User, Logo,
  // Actions
  PencilEdit, View, Plus, Minus, XMark, Check, CircleCheck,
  Filter, Download, More, Drag,
  // Data viz
  MapLayers, MapPin, Activity, Grid, SortAsc,
  // Media
  Bell, Play, Pause,
};

export default icons;
