#!/usr/bin/env node
/* =============================================================================
   Seed the TransportNY landing page into the `landing` pattern as DRAFT content.

   Source mockup: src/themes/transportny/.../dms_design_system_v2/pages/landing.html
   Target: app=npmrdsv5, pattern=dev2|landing:pattern (id 1700630), page 2173051
           ("Landing", base_url /), theme transportnyv2.

   Decision (user, 2026-06-03): build EVERYTHING as sections — topnav + hero +
   products + for-whom/audiences + footer — into the existing "Landing" page.

   Bands → layoutGroup styles (transportnyv2):
     topnav        → position 'top',    theme 'header'        (white, border-b)
     hero          → position 'content', theme 'hero'         (tny-hero-topo bg)
     products      → position 'content', theme 'content'      (#ECEEF2)
     for-whom      → position 'content', theme 'content_tint' (#E4E8EE)
     footer        → position 'bottom',  theme 'footer'

   Draft-only: never publishes. Writes draft_section_groups + draft_sections.

   Usage:
     node scripts/seed-landing-page.mjs            # seed (wipes prior drafts first)
     KEEP=1 node scripts/seed-landing-page.mjs     # don't wipe prior draft sections
   ============================================================================= */

import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const env = {
  ...process.env,
  DMS_HOST: process.env.DMS_HOST || 'http://localhost:3001',
  DMS_APP:  process.env.DMS_APP  || 'npmrdsv5',
  DMS_TYPE: process.env.DMS_TYPE || 'dev2',
};

const CLI       = ['node', 'src/dms/packages/dms/cli/bin/dms.js'];
const PAGE_ID   = '2173051';
const PATTERN   = '1700630';
const COMP_TYPE = 'landing|component';
const PARENT    = JSON.stringify({ id: PAGE_ID, ref: `${env.DMS_APP}+landing|page` });
const keep      = process.env.KEEP === '1';

const run = (args, { capture = false } = {}) => {
  try {
    return execFileSync(CLI[0], [...CLI.slice(1), ...args], {
      encoding: 'utf8', env, stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    });
  } catch (e) { if (capture) return null; throw e; }
};
const extractJSON = (out) => { if (!out) return null; const m = out.match(/\{[\s\S]*\}\s*$/); if (!m) return null; try { return JSON.parse(m[0]); } catch { return null; } };
const log = (...m) => console.log('•', ...m);

// ---- Lexical helpers --------------------------------------------------------
const text = (t, format = 0) => ({ type: 'text', version: 1, detail: 0, format, mode: 'normal', style: '', text: t });
const textS = (t, style, format = 0) => ({ type: 'text', version: 1, detail: 0, format, mode: 'normal', style, text: t });
const para = (...kids) => ({ type: 'paragraph', version: 1, direction: null, format: '', indent: 0, textFormat: 0, textStyle: '', children: kids.flat() });
const styled = (styleKey, ...kids) => ({ type: 'styled-paragraph', version: 1, direction: null, format: '', indent: 0, textFormat: 0, textStyle: '', styleKey, children: kids.flat() });
const button = (linkText, path, styleName = 'default', keepSearchParams = false) => ({ type: 'button', version: 1, linkText, path, style: styleName, keepSearchParams });
const hr = () => ({ type: 'horizontalrule', version: 1 });
const layout = (templateColumns, columns) => ({ type: 'layout-container', version: 1, direction: null, format: '', indent: 0, templateColumns, children: columns.map(col => ({ type: 'layout-item', version: 1, direction: null, format: '', indent: 0, children: col })) });
const icon = (iconName, styleKey) => ({ type: 'icon', version: 1, iconName, styleKey });
const head = (tag, t) => ({ type: 'heading', tag, version: 1, direction: null, format: '', indent: 0, children: [text(t)] });
const list = (ordered, items) => ({ type: 'list', listType: ordered ? 'number' : 'bullet', tag: ordered ? 'ol' : 'ul', version: 1, direction: null, format: '', indent: 0, start: 1, children: items.map(t => ({ type: 'listitem', version: 1, value: 1, direction: null, format: '', indent: 0, children: Array.isArray(t) ? t : [text(t)] })) });
const lexical = (children) => JSON.stringify({ bgColor: 'rgba(0,0,0,0)', isCard: '', showToolbar: false, text: { root: { type: 'root', version: 1, direction: null, format: '', indent: 0, children } } });

// amber period accent reused on hero h1 + section headings that want it
const AMBER = 'color:#CA8A04';
// inline NY brand box (no lexical node for a styled icon box of text)
const nyBox = (px = 28, fs = 11) => textS('NY', `display:inline-flex;align-items:center;justify-content:center;width:${px}px;height:${px}px;background:#1F3F8F;color:#fff;border-radius:4px;font-family:var(--font-display);font-weight:700;font-size:${fs}px;vertical-align:middle`);
const wordmark = (fs = 15) => textS('TransportNY', `font-family:var(--font-display);text-transform:uppercase;letter-spacing:0.06em;color:#0F1722;font-size:${fs}px;vertical-align:middle;margin-left:8px`);

// ---- Page inventory (bands → sections) -------------------------------------
const bands = [
  // ===== TOPNAV (white bar) =================================================
  {
    // position 'content' (not 'top') so the bar lives in the same column as the
    // rest of the page — with a sidenav present, a 'top' band renders full-viewport
    // width above the Layout and its left edge no longer lines up with the content.
    displayName: 'Top nav', theme: 'topbar', position: 'content',
    sections: [
      { title: '', size: '12', padding: 'p-0', data: lexical([
          // `w-full` is critical: theme.lexical.layoutContainer is `grid gap-3 mt-2`
          // (no width), so without it the grid shrink-wraps and the 1fr middle column
          // collapses — the actions cluster left instead of right-aligning. The
          // templateColumns string is appended verbatim as classes, so add it here.
          layout('w-full !mt-0 items-center grid-cols-[max-content_1fr_max-content]', [
            // brand — NY box + wordmark
            [ para(nyBox(36, 14), wordmark(15)) ],
            // primary nav links — centered in the 1fr middle column (matches the
            // mockup's justify-between middle group). Each is a navlink button (client-side
            // nav); unbuilt targets ('Products','About') point to '#'.
            [ { ...para(
                  button('Products', '#', 'navlink'),
                  button('Data', '/datasources', 'navlink'),
                  button('Documentation', '/docs/npmrds/overview', 'navlink'),
                  button('About', '#', 'navlink'),
                ), format: 'center' } ],
            // right-side actions — pushed to the right edge by the 1fr column
            [ para(button('Sign in', '/auth/login', 'plain'), button('Get started', '/docs/npmrds/quick_start', 'default')) ],
          ]),
      ]) },
    ],
  },

  // ===== HERO ===============================================================
  {
    displayName: 'Hero', theme: 'hero', position: 'content',
    sections: [
      { title: '', size: '8', data: lexical([
          styled('kicker', text('// nysdot · public release · 2026.Q2')),
          styled('displayMax', text("New York's transportation data, in the open"), textS('.', AMBER)),
          styled('proseLG', text('TransportNY is the public-sector data platform for NYSDOT, the State’s MPOs, academic partners, and anyone who wants travel-time data they can actually use. Travel-time reliability, freight movement, MAP-21 PM3 federal reporting, congestion, work zones — all from the National Performance Management Research Data Set, refreshed nightly.')),
          layout('grid-cols-[max-content_max-content_1fr] items-center', [
            [ para(button('Start exploring', '/docs/npmrds/quick_start', 'default')) ],
            [ para(button('Read the docs', '/docs/npmrds/overview', 'secondary')) ],
            [ para(text('')) ],
          ]),
          styled('metaSM', text('● data current      last refresh · 2026-05-08 · 04:12 EST      · 7 ingest feeds online')),
      ]) },
      { title: '', size: '4', border: 'full', data: lexical([
          styled('metaSM', text('CURRENT COVERAGE')),
          styled('statNum', text('42,108')),
          styled('metaXS', text('TMC SEGMENTS · NHS + TPF')),
          hr(),
          layout('grid-cols-3', [
            [ styled('displaySM', text('11')), styled('metaXS', text('regions')) ],
            [ styled('displaySM', text('62')), styled('metaXS', text('counties')) ],
            [ styled('displaySM', text('14')), styled('metaXS', text('MPOs')) ],
          ]),
      ]) },
    ],
  },

  // ===== PRODUCTS (#ECEEF2) =================================================
  {
    displayName: 'Products', theme: 'content', position: 'content',
    sections: [
      { title: '', size: '12', data: lexical([
          styled('kicker', text("// 01 · what's inside")),
          styled('displayLG', text('Products')),
          styled('prose', text('Five working surfaces. All run against the same NPMRDS / FHWA feeds. All free for public-read.')),
      ]) },
      { title: '', size: '4', border: 'full', data: lexical([
          para(icon('Activity', 'productChip')),
          styled('cardTitle', text('MAP-21 PM3')),
          styled('proseSM', text('Federal-reporting performance: travel-time reliability, freight reliability, peak-hour excessive delay. Per-year deep-dive + multi-year trend.')),
          para(button('View →', '/map_21', 'default')),
      ]) },
      { title: '', size: '4', border: 'full', data: lexical([
          para(icon('MapLayers', 'productChip')),
          styled('cardTitle', text('NPMRDS routes')),
          styled('proseSM', text('Speed, travel time, and reliability for any TMC corridor — by epoch, by day-of-week, by month. Save as templates, run against new routes.')),
          para(button('View →', '/docs/npmrds/route_analysis', 'default')),
      ]) },
      { title: '', size: '4', border: 'full', data: lexical([
          para(icon('Database', 'productChip')),
          styled('cardTitle', text('Freight atlas')),
          styled('proseSM', text('FAF5 commodity flows, truck travel-time reliability by corridor, port-of-entry counts. The standard kit for freight planners.')),
          para(button('View →', '/freight_atlas', 'default')),
      ]) },
      { title: '', size: '6', border: 'full', data: lexical([
          para(icon('MapPin', 'productChip')),
          styled('cardTitle', text('Work zones & congestion')),
          styled('proseSM', text('When delay happens, where it costs, and how much of it is recurrent versus event-driven. Stitched from 511NY incident feeds + NPMRDS travel-times.')),
          para(button('View →', '#', 'default')),
      ]) },
      { title: '', size: '6', border: 'full', data: lexical([
          para(icon('Pages', 'productChip')),
          styled('cardTitle', text('Documentation')),
          styled('proseSM', text('User guides, methodology, API reference, data dictionary. Read it before you build a report — every number on every page is documented.')),
          para(button('View →', '/docs/npmrds/overview', 'default')),
      ]) },
    ],
  },

  // ===== FOR WHOM (#E4E8EE) =================================================
  {
    displayName: 'For whom', theme: 'content_tint', position: 'content',
    sections: [
      { title: '', size: '7', rowspan: '3', data: lexical([
          styled('kicker', text("// 02 · who's it for")),
          styled('displayLG', text('For state planners. For MPOs. For the public.')),
          styled('prose', text('TransportNY started as an NYSDOT internal reporting tool and grew into a shared platform. The MPOs use it to draft their TIPs. NYSDOT uses it to file MAP-21 PM3 federal reports. Academics pull the same data for research. Journalists check the same dashboards before running a story. Public-read access requires no account.')),
      ]) },
      { title: '', size: '5', border: 'full', data: lexical([
          styled('nav', text('NYSDOT — REGIONS 1–11')),
          styled('proseSM', text('Federal reporting, internal TIP analysis, congestion mitigation.')),
      ]) },
      { title: '', size: '5', border: 'full', data: lexical([
          styled('nav', text('METROPOLITAN PLANNING ORGS')),
          styled('proseSM', text('All 14 NY MPOs draft and publish their TIP / UPWP reports here.')),
      ]) },
      { title: '', size: '5', border: 'full', data: lexical([
          styled('nav', text('ACADEMIC + PUBLIC')),
          styled('proseSM', text('Free public-read access. CSV export, REST + GraphQL APIs, GIS layers.')),
      ]) },
    ],
  },

  // ===== FOOTER =============================================================
  {
    // position 'content' (not 'bottom'): like the topnav, a 'bottom' band renders
    // outside the Layout (full-viewport) and misses the sidenav offset, so its left
    // gutter no longer lines up with the content bands. As the last 'content' band it
    // shares the offset and aligns.
    displayName: 'Footer', theme: 'footer', position: 'content',
    sections: [
      { title: '', size: '4', data: lexical([
          para(nyBox(28, 11), wordmark(13)),
          styled('proseSM', text('Public-sector data platform · A program of NYSDOT in partnership with AVAIL.')),
      ]) },
      { title: '', size: '2', data: lexical([
          styled('metaSM', text('Products')),
          para(button('NPMRDS', '#', 'footerlink')),
          para(button('MAP-21 PM3', '/map_21', 'footerlink')),
          para(button('Floating Car', '#', 'footerlink')),
          para(button('Congestion', '#', 'footerlink')),
          para(button('Work zones', '#', 'footerlink')),
      ]) },
      { title: '', size: '2', data: lexical([
          styled('metaSM', text('Resources')),
          para(button('User Guide', '/docs/npmrds/overview', 'footerlink')),
          para(button('API Guide', '#', 'footerlink')),
          para(button('Data Dictionary', '#', 'footerlink')),
          para(button("What's New", '#', 'footerlink')),
      ]) },
      { title: '', size: '4', data: lexical([
          styled('metaSM', text('Status')),
          styled('metaSM', textS('● All systems operational · 2026-05-08 04:12 EST', 'color:#047857')),
          styled('proseSM', text('All data is public domain. Source: NPMRDS, FAF5, NYSDOT 511NY.')),
      ]) },
      { title: '', size: '12', data: lexical([
          hr(),
          styled('metaSM', text('© 2026 NYSDOT · TransportNY · A program of New York State Department of Transportation        v2026.05 · public release')),
      ]) },
    ],
  },
];

// ---- Apply ------------------------------------------------------------------
log(`seeding landing page ${PAGE_ID} (pattern ${PATTERN})`);

// wipe prior draft sections (unless KEEP=1)
if (!keep) {
  const cur = extractJSON(run(['raw', 'get', PAGE_ID, '--app', env.DMS_APP], { capture: true }));
  const refs = cur?.data?.draft_sections || [];
  for (const ref of refs) { log(`  − delete prior draft section ${ref.id}`); run(['section', 'delete', String(ref.id), '--page', PAGE_ID]); }
}

// section groups
const groups = bands.map((b, i) => ({ name: randomUUID(), index: i, theme: b.theme, position: b.position, displayName: b.displayName }));
// Draft-only: write draft_section_groups ONLY. NEVER write section_groups — it is the
// PUBLISHED band array (twin of `sections`), owned solely by `dms page publish`. Overwriting
// it with these freshly-generated UUIDs orphans every already-published section (whose `group`
// still points at the prior groups), blanking the live page until the next publish.
run(['raw', 'update', PAGE_ID, '--set', `draft_section_groups=${JSON.stringify(groups)}`]);
log(`  ↳ wrote ${groups.length} section_group band(s)`);

// sections
for (let i = 0; i < bands.length; i++) {
  const band = bands[i], group = groups[i];
  log(`  ─ band "${band.displayName}" (theme=${band.theme}, position=${band.position})`);
  for (const s of band.sections) {
    const payload = {
      title: s.title, type: COMP_TYPE, group: group.name, parent: PARENT, trackingId: randomUUID(),
      element: { 'element-type': 'lexical', 'element-data': s.data },
    };
    payload.size = s.size || '12';
    if (s.padding != null) payload.padding = s.padding;
    if (s.border) payload.border = s.border;
    if (s.rowspan) payload.rowspan = s.rowspan;
    log(`      + section [size ${payload.size}${s.border ? ', border ' + s.border : ''}${s.rowspan ? ', rowspan ' + s.rowspan : ''}]`);
    run(['section', 'create', PAGE_ID, '--pattern', PATTERN, '--data', JSON.stringify(payload)]);
  }
}

log('done — sections landed in draft_sections (nothing published).');
