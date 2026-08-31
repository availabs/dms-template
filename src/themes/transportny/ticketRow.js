// Pure helpers for the QuickLinks "Report an issue" widget. No React, no I/O —
// unit-tested in ticketRow.test.js. buildTicketRow assembles a COMPLETE,
// immediately-coherent sitemgmt_tickets row so a ticket is valid without waiting
// for the next cr_sync run (sync hygiene stays an idempotent backstop).

// The sitemgmt_tickets internal dataset (npmrdsv5). Hardcoded per the source-lookup
// decision (2026-07-15); npmrdsv5-specific. If the dataset is ever re-provisioned, or
// this theme is reused by another app, update these values.
export const TICKETS_SOURCE = {
  app: "npmrdsv5",
  source_id: 2184923,
  view_id: 2184924,
  // dms.data.create type string for an internal-dataset row — mirrors
  // dataWrapper index.jsx:386 (`${instance}|${view_id}:data`).
  type: "sitemgmt_tickets|2184924:data",
  env: "npmrdsv5+sitemgmt_tickets",
  isDms: true,
};

export const SEVERITIES = ["Blocker", "Major", "Minor"];
export const DEFAULT_SEVERITY = "Minor";

// Map a live host to the control-room "surface" (pattern instance) used in page_key.
// Must match the subdomains cr_sync tracks (verified against `dms pattern list`:
// freightatlas/freightatlas2 → freightatlas2, tsmo2 → tsmo2, npmrds2 → npmrds2).
// Returns "" when unknown → the caller omits page_key and relies on page_route +
// page_name (which sync won't overwrite when page_key is absent).
export const surfaceFromHost = (host = "") => {
  const sub = String(host).toLowerCase().split(".")[0];
  if (sub.startsWith("freightatlas")) return "freightatlas2";
  if (sub.startsWith("tsmo")) return "tsmo2";
  if (sub.startsWith("npmrds")) return "npmrds2";
  return "";
};

// The products now live at PATHS on one origin, not on their own subdomains
// (subdomain-to-path-consolidation.md) — so the surface has to come from the URL
// path first, and only fall back to the host while the old hosts still resolve.
// The SURFACE NAMES are unchanged on purpose: sitemgmt_pages/_tickets/_stories are
// keyed `surface:slug`, so renaming one would orphan every existing row.
const SURFACE_MOUNTS = [
  { path: "/freightatlas", surface: "freightatlas2" },
  { path: "/tsmo", surface: "tsmo2" },
  { path: "/npmrds", surface: "npmrds2" },
];

// → { surface, slug }. `slug` is resolved RELATIVE to the product mount, so
// /tsmo/home gives "home" (matching the old tsmo2.host/home) and the bare mount
// root /tsmo gives "" — the same empty result the old "/" produced, rather than a
// bogus page_key of `tsmo2:tsmo`.
export const surfaceFromLocation = (host = "", pathname = "") => {
  const p = String(pathname || "");
  const mount = SURFACE_MOUNTS.find((m) => p === m.path || p.startsWith(`${m.path}/`));
  return mount
    ? { surface: mount.surface, slug: slugFromPathname(p.slice(mount.path.length)) }
    : { surface: surfaceFromHost(host), slug: slugFromPathname(p) };
};

// last non-empty path segment: "/a/b/home" -> "home", "/" -> ""
export const slugFromPathname = (pathname = "") =>
  String(pathname).split("/").filter(Boolean).pop() || "";

// asOf is "YYYY-MM-DD"; the caller passes new Date()... (a browser component can,
// so the row carries a real opened/updated date up front). Phase 2 fields
// (pathname/pageName/host) attribute the ticket to the current page with no user input.
export const buildTicketRow = ({ title, severity, description, asOf, pathname, pageName, host, reporterEmail, envString } = {}) => {
  const row = {
    title: (title || "").trim(),
    severity: severity || DEFAULT_SEVERITY,
    description: (description || "").trim(),
    status: "Triage",
    // widget reports are "client"-sourced (Control-room facet value: ai|dev|client)
    source: "client",
    opened: asOf,
    updated: asOf,
  };
  // Phase 2 — page attribution (no user input)
  if (pathname != null) row.page_route = pathname;
  if (pageName) row.page_name = pageName;
  // page_route above stays the VERBATIM pathname (where the reporter actually
  // was); surface/slug are resolved against the product mount so page_key keeps
  // its historical `tsmo2:home` shape on both the old host and the new path.
  const { surface, slug } = surfaceFromLocation(host, pathname);
  if (surface) {
    row.surface = surface;
    if (slug) row.page_key = `${surface}:${slug}`;
  }
  // Phase 3 — reporter (widget is logged-in-only, so present whenever it renders)
  if (reporterEmail) row.reporter = reporterEmail;
  // Phase 4 — environment (viewport + user agent, auto-captured; no user input)
  if (envString) row.env = envString;
  return row;
};
