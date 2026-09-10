import { recencyScore, isOwnedByCurrentUser, LOOKS_INCOMPLETE_RE } from '../PickerModal/pickerScoring';

// Prominence-weighted default sort for the report picker (npmrds-picker-modals.html item 2,
// 2026-08-25) — same "Best match" shape as routeScore.js (RouteTagBrowserModal), built from the
// same shared primitives, weighing report-specific fields: yours ranks first (same ownership
// boost routeScore.js gives a route you created — client-side only, from CMSContext, never
// server-verified, same v1 scope call as the route picker's "mine" facet); a rebuilt (real DMS
// page exists) report ranks above a legacy admin2.reports row that was never converted; a
// described report (an author bothered to write a summary) ranks above a bare title; recency is
// a minor decay, not the deciding factor; a name that looks like a scratch/test row is penalized
// rather than hidden outright (the separate "hide incomplete-looking reports" facet chip is the
// explicit hide).
export function reportScore(row, { currentUserId } = {}) {
  let s = 0;
  if (isOwnedByCurrentUser(row?.created_by, currentUserId)) s += 30;
  // 2026-09-03: inert as of useReportSearch.js's unconditional `page_path notempty` filter —
  // every row reaching this function already has page_path set, so this is now a constant +25
  // on every row, not a real differentiator. Left in (harmless, not wrong) rather than removed;
  // the "Rebuilt" badge this used to justify was removed since it had the same problem visibly.
  if (row?.page_path) s += 25;
  if (row?.description) s += 20; // an author wrote a real summary
  s += recencyScore(row?.updated_at, 15);
  if (LOOKS_INCOMPLETE_RE.test(row?.name || '')) s -= 20;
  return s;
}

export function isMine(row, currentUserId) {
  return isOwnedByCurrentUser(row?.created_by, currentUserId);
}

export function looksIncomplete(row) {
  return LOOKS_INCOMPLETE_RE.test(row?.name || '');
}
