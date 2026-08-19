// ⚠️ GENERATED FILE — do not edit by hand.
// Source of truth: the #icons catalogue on
//   src/themes/wcdb/WCDB Design System/dms_design_system/design-system/theme.html
// Regenerate: node scripts/icons-sync.mjs        (from dms_design_system/)
// CI guard:   node scripts/icons-sync.mjs --check
//
// WCDB · icon registry (49 icons)
//
// Wired as `theme.Icons`, which is what the `Icon` component, the lexical
// `icon` node, SideNav glyphs and Card icon-chips all look names up in.
// A name that is not here renders NOTHING — no error, no fallback art in a
// themed context. `icons-audit.mjs` is what keeps the catalogue complete, and
// this file a faithful copy of it.
//
// Geometric, stroke-1.6, lucide-aligned, all on a 24×24 grid — the brand's
// icon brief (design-system/theme.html §03).

import React from "react";

const svg = (paths) => (props) =>
  React.createElement(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.6,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      ...props,
    },
    paths
  );

const Menu         = svg(<path d="M4 6h16M4 12h16M4 18h16"/>);
const XMark        = svg(<path d="M6 6l12 12M18 6L6 18"/>);
const ChevronDown  = svg(<path d="M6 9l6 6 6-6"/>);
const ChevronRight = svg(<path d="M9 6l6 6-6 6"/>);
const ArrowRight   = svg(<path d="M4 12h16M14 6l6 6-6 6"/>);
const Plus         = svg(<path d="M12 5v14M5 12h14"/>);
const Play         = svg(<path d="M7 5v14l12-7z"/>);
const Pause        = svg(<path d="M7 5h4v14H7zM13 5h4v14h-4z"/>);
const Search       = svg(<><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></>);
const Filter       = svg(<path d="M4 5h16l-6 8v6l-4-2v-4z"/>);
const Calendar     = svg(<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></>);
const Clock        = svg(<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>);
const ViewPage     = svg(<><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></>);
const EditPage     = svg(<path d="M4 20h4l11-11-4-4L4 16zM14 6l4 4"/>);
const Trash        = svg(<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>);
const Check        = svg(<path d="M5 12l5 5 9-11"/>);
const Download     = svg(<path d="M12 3v13M6 11l6 6 6-6M4 21h16"/>);
const User         = svg(<><circle cx="12" cy="9" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/></>);
const ChevronLeft  = svg(<path d="M15 6l-6 6 6 6"/>);
const ArrowLeft    = svg(<path d="M20 12H4M10 6l-6 6 6 6"/>);
const PlusCircle   = svg(<path d="M12 2a10 10 0 100 20 10 10 0 000-20zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>);
const Copy         = svg(<><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></>);
const Refresh      = svg(<path d="M21 12a9 9 0 1 1-3-6.7M21 4v5h-5"/>);
const Settings     = svg(<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>);
const Grip         = svg(<><circle cx="9" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="15" cy="18" r="1.5"/></>);
const Broadcast    = svg(<path d="M5 12a7 7 0 0114 0M8 12a4 4 0 018 0M12 12v9"/>);
const Waveform     = svg(<path d="M4 12h4l3-7 2 14 3-7h4"/>);
const Mobile       = svg(<><rect x="5" y="3" width="14" height="18" rx="3"/><path d="M11 18h2"/></>);
const SortLines    = svg(<path d="M3 6h18M6 12h12M10 18h4"/>);
const SortAsc      = svg(<path d="M7 14l5-5 5 5z"/>);
const Alert        = svg(<path d="M12 9v4M12 17h.01M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>);
const Dot          = svg(<circle cx="12" cy="12" r="4"/>);
const Square       = svg(<rect x="3" y="3" width="18" height="18" rx="2"/>);
const Globe        = svg(<><circle cx="12" cy="12" r="9"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/></>);
const Sun          = svg(<><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></>);
const Moon         = svg(<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>);
const SignIn       = svg(<><circle cx="12" cy="12" r="9"/><path d="M11 8l4 4-4 4M15 12H7"/></>);
const Microphone   = svg(<><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"/></>);
const Heart        = svg(<path d="M12 20s-7-4.35-7-9.5A3.5 3.5 0 0 1 12 8a3.5 3.5 0 0 1 7 2.5C19 15.65 12 20 12 20z"/>);
const Pick         = svg(<path d="M12 3c4 0 7 2.4 7 5.5 0 4-4.2 8.4-5.6 10.2a1.8 1.8 0 0 1-2.8 0C9.2 16.9 5 12.5 5 8.5 5 5.4 8 3 12 3z"/>);
const Bolt         = svg(<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>);
const Note         = svg(<><circle cx="7" cy="18" r="2.5"/><circle cx="17" cy="15" r="2.5"/><path d="M9.5 18V6l10-2v11"/></>);
const Sliders      = svg(<><path d="M6 3v18M12 3v18M18 3v18"/><circle cx="6" cy="8" r="2"/><circle cx="12" cy="15" r="2"/><circle cx="18" cy="10" r="2"/></>);
const Newspaper    = svg(<><path d="M4 5h13v15H5a1 1 0 0 1-1-1z"/><path d="M17 8h3v10a2 2 0 0 1-2 2M7 9h7M7 13h7M7 17h4"/></>);
const Trophy       = svg(<><path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5v1a3 3 0 0 0 3 3M16 6h3v1a3 3 0 0 1-3 3M10 17h4M12 13v4M9 20h6"/></>);
const Star         = svg(<path d="m12 3 2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-3-5.3 3 1.1-6L3.4 9.4l6-.8z"/>);
const Phone        = svg(<path d="M15.5 21A12.5 12.5 0 0 1 3 8.5 2.5 2.5 0 0 1 5.5 6h2a1 1 0 0 1 1 .8l.7 3a1 1 0 0 1-.3 1L7.6 12.4a11 11 0 0 0 4 4l1.6-1.3a1 1 0 0 1 1-.2l3 .7a1 1 0 0 1 .8 1v2A2.5 2.5 0 0 1 15.5 21z"/>);
const Pin          = svg(<><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/></>);
const Wave         = svg(<path d="M3 12h2l2-6 3 13 3-16 3 12 2-3h3"/>);

const icons = {
  Menu, XMark, ChevronDown, ChevronRight, ArrowRight, Plus, Play, Pause, Search, Filter, Calendar, Clock, ViewPage, EditPage, Trash, Check, Download, User, ChevronLeft, ArrowLeft, PlusCircle, Copy, Refresh, Settings, Grip, Broadcast, Waveform, Mobile, SortLines, SortAsc, Alert, Dot, Square, Globe, Sun, Moon, SignIn, Microphone, Heart, Pick, Bolt, Note, Sliders, Newspaper, Trophy, Star, Phone, Pin, Wave,
};

export default icons;
