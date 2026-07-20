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
  const surface = surfaceFromHost(host);
  if (surface) {
    row.surface = surface;
    const slug = slugFromPathname(pathname);
    if (slug) row.page_key = `${surface}:${slug}`;
  }
  // Phase 3 — reporter (widget is logged-in-only, so present whenever it renders)
  if (reporterEmail) row.reporter = reporterEmail;
  // Phase 4 — environment (viewport + user agent, auto-captured; no user input)
  if (envString) row.env = envString;
  return row;
};
