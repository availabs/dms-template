#!/usr/bin/env node
/**
 * report_page_template_build.mjs — write the master "Report Page" page_template row
 * (npmrdsv5+npmrds_sub|page_template, id 2187021) from page_template_specs/report_page.json,
 * instead of a fresh `dms raw update` scratch script each time it needs to change.
 *
 *   node scripts/npmrds-reports/report_page_template_build.mjs [--dry-run|--apply]
 *
 * The template has exactly two sections, both flagged `templateRole: 'framework'` (the flag
 * report_build.mjs's own templateFrameworkSections() reads to decide what to clone into a
 * spec-built report):
 *   1. ReportPageHeader — real authored copy, the only thing the spec actually varies.
 *   2. ReportRouteList (sidebar) — a fixed reports_snap_2⋈routes_data join every report needs
 *      identically; its element-data lives verbatim in report_page_route_list_element_data.json
 *      (a fixture, not a spec field) since nobody hand-edits it.
 * See planning/transportny/tasks/current/report-page-template-editorial-slots.md for why.
 */

import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SPECS_DIR = resolve(REPO, 'scripts/npmrds-reports/page_template_specs');

const APP = process.env.DMS_APP || 'npmrdsv5';
const SITE_TYPE = process.env.DMS_TYPE || 'dev2';
const HOST = process.env.DMS_HOST || 'http://localhost:3001';
const PATTERN = 'npmrds_sub';
const COMPONENT_TYPE = `${PATTERN}|component`;
const PAGE_TEMPLATE_ID = 2187021; // same id report_build.mjs's own PAGE_TEMPLATE_ID points at

// Fixed identities, preserved across rebuilds so re-running with an unchanged spec writes a
// byte-identical row.
const HEADER_TRACKING_ID = '4f0fff8e-63b8-4300-b6d3-516ac10ae535';
const ROUTE_LIST_TRACKING_ID = 'd0ad83fd-48ed-406b-8458-b3d68db83fd6';
// Vestigial: points at page id 2187164, which no longer exists — harmless (a template row is
// never itself rendered, so this ref is never resolved), preserved verbatim rather than "fixed".
const ROUTE_LIST_PARENT_REF = { id: '2187164', ref: `${APP}+${PATTERN}|page` };

const RRL_ELEMENT_DATA = readFileSync(resolve(SPECS_DIR, 'report_page_route_list_element_data.json'), 'utf8').trim();

function dms(args) {
  const out = execFileSync('dms', ['--host', HOST, '--app', APP, '--type', SITE_TYPE, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const trimmed = out.trim();
  if (!trimmed) return null;
  try { return JSON.parse(trimmed); } catch { return trimmed; }
}

const APPLY = process.argv.includes('--apply');
const DRY_RUN = process.argv.includes('--dry-run');
if (!APPLY && !DRY_RUN) {
  console.error('usage: node scripts/npmrds-reports/report_page_template_build.mjs [--dry-run|--apply]');
  process.exit(2);
}

const spec = JSON.parse(readFileSync(resolve(SPECS_DIR, 'report_page.json'), 'utf8'));
const h = spec.header || {};
const headerElementData = {
  filters: { op: 'AND', groups: [] },
  display: {
    kickerLabel: h.kickerLabel ?? '', metaLine: h.metaLine ?? '', purpose: h.purpose ?? '',
  },
  columns: [], data: [], externalSource: { columns: [] },
};

const composed = {
  id: String(PAGE_TEMPLATE_ID),
  name: spec.name,
  slug: spec.slug,
  theme: spec.theme,
  sidebar: spec.sidebar,
  description: spec.description ?? '',
  sidebarHideInView: spec.sidebarHideInView,
  draft_section_groups: spec.sectionGroups,
  draft_sections: [
    {
      type: COMPONENT_TYPE, group: 'default', level: '0', title: '',
      element: { 'element-data': JSON.stringify(headerElementData), 'element-type': 'ReportPageHeader' },
      trackingId: HEADER_TRACKING_ID, templateRole: 'framework',
    },
    {
      type: COMPONENT_TYPE, group: 'sidebar', level: '0', title: '', parent: ROUTE_LIST_PARENT_REF,
      element: { 'element-data': RRL_ELEMENT_DATA, 'element-type': 'ReportRouteList' },
      padding: { top: '0', left: '0', right: '0', bottom: '0' },
      trackingId: ROUTE_LIST_TRACKING_ID, templateRole: 'framework',
    },
  ],
};

if (DRY_RUN) {
  console.log(JSON.stringify(composed, null, 2));
  process.exit(0);
}

const tmpPath = resolve(REPO, `scratchpad/npmrds-sub/tmp/report_page_template_build_${Date.now()}.json`);
writeFileSync(tmpPath, JSON.stringify(composed));
dms(['raw', 'update', String(PAGE_TEMPLATE_ID), '--data', tmpPath]);
unlinkSync(tmpPath);
console.log(`Applied — template row ${PAGE_TEMPLATE_ID} updated.`);
