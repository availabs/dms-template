#!/usr/bin/env node
/* =============================================================================
   Seed Tessera design-system pages into a DMS pattern as DRAFT content.

   Source: src/themes/tessera/design_system_v2/{design-system,pages}/*.html
   Target: app=tessera, pattern=main|main:pattern  (site: main:site)

   Key model — section groups drive LayoutGroup style
   --------------------------------------------------
   A page is made of *bands*, where each band is a `section_group` row on the
   page's `data.draft_section_groups` array. Each section_group has:

     - name        — UUID; sections reference it via `data.group`
     - position    — 'top' | 'content' | 'bottom'  (which Layout slot it goes in:
                     headerChildren / inside childWrapper / footerChildren)
     - theme       — the *name* of a layoutGroup style on theme.layoutGroup
                     ('content', 'header', 'auth', 'footer' in tessera)
     - displayName — shown in the page editor
     - index       — order within the position

   The chosen `theme` value selects the visual treatment of the band:
     - 'content' — boxed parchment card with hairline frame + lifted shadow
     - 'header'  — unboxed band on bone (hero, page title)
     - 'auth'    — boxed centred form surface
     - 'footer'  — full-bleed limestone band (theory bands, marketing footer)

   So a marketing page with a hero + several boxed sections + a limestone
   theory band + a limestone footer needs at least four section_groups,
   not one — see the `marketing-homepage` inventory below.

   Draft-only discipline
   ---------------------
   This script never publishes. It only writes to:
     - data.draft_section_groups (the editing band list)
     - data.draft_sections        (the editing section ref list)
   A human user runs `dms page publish <slug>` when ready.

   Usage:
     node scripts/seed-tessera-pages.mjs marketing-homepage     # only that page
     node scripts/seed-tessera-pages.mjs                        # all defined pages
     WIPE=1 node scripts/seed-tessera-pages.mjs <slug>          # wipe then reseed
   ============================================================================= */

import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

const env = {
  ...process.env,
  DMS_HOST: process.env.DMS_HOST || 'https://dmsserver.availabs.org',
  DMS_APP:  process.env.DMS_APP  || 'tessera',
  DMS_TYPE: process.env.DMS_TYPE || 'main',
};

const CLI = ['node', 'src/dms/packages/dms/cli/bin/dms.js'];
const slugFilter = process.argv[2] || '';
const wipe = process.env.WIPE === '1';

// ---------------------------------------------------------------------------
// CLI helpers
// ---------------------------------------------------------------------------

const run = (args, { capture = false } = {}) => {
  try {
    return execFileSync(CLI[0], [...CLI.slice(1), ...args], {
      encoding: 'utf8',
      env,
      stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    });
  } catch (e) {
    if (capture) return null;
    throw e;
  }
};

const extractJSON = (out) => {
  if (!out) return null;
  const m = out.match(/\{[\s\S]*\}\s*$/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
};

const pageIdForSlug = (slug) => extractJSON(run(['page', 'show', slug], { capture: true }))?.id ?? null;
const pageDataFor   = (slug) => extractJSON(run(['page', 'dump', slug], { capture: true }))?.data ?? null;

const log = (...m) => console.log('•', ...m);

// Delete all draft sections on a page (used for clean re-runs).
const wipeDrafts = (slug) => {
  const data = pageDataFor(slug);
  const refs = data?.draft_sections || [];
  for (const ref of refs) {
    log(`  − delete prior draft section ${ref.id}`);
    run(['section', 'delete', String(ref.id), '--page', slug]);
  }
};

// Replace the page's `draft_section_groups` (and live `section_groups`) with
// the supplied band list. Returns the band list with `name` UUIDs filled in.
const setSectionGroups = (slug, pageId, bands) => {
  const groups = bands.map((b, i) => ({
    name: randomUUID(),
    index: i,
    theme: b.theme,
    position: b.position,
    displayName: b.displayName,
  }));
  run(['raw', 'update', String(pageId),
        '--set', `draft_section_groups=${JSON.stringify(groups)}`,
        '--set', `section_groups=${JSON.stringify(groups)}`]);
  return groups;
};

// ---------------------------------------------------------------------------
// Lexical helpers — produce a JSON-string `element-data` for a lexical section
// ---------------------------------------------------------------------------

const text  = (t, format = 0) => ({
  type: 'text', version: 1, detail: 0, format, mode: 'normal', style: '', text: t,
});

const para  = (...kids) => ({
  type: 'paragraph', version: 1, direction: null, format: '',
  indent: 0, textFormat: 0, textStyle: '',
  children: kids.flat(),
});

/**
 * Styled paragraph — a paragraph carrying a brand textSettings token key.
 * Renders as the StyledParagraphNode in Lexical: the DMS editor resolves
 * the key to a class string from theme.textSettings.styles[0] at render
 * time. Use for tokens that the brand exposes (Tessera: displayHero,
 * proseLG, metaSM, etc.). See:
 *   src/dms/packages/dms/src/ui/components/lexical/editor/nodes/StyledParagraphNode.ts
 *   src/dms/skills/translating-design-system-to-dms-theme.md §3.1.4
 */
const styled = (styleKey, ...kids) => ({
  type: 'styled-paragraph', version: 1, direction: null, format: '',
  indent: 0, textFormat: 0, textStyle: '',
  styleKey,
  children: kids.flat(),
});

/**
 * Inline button — a Lexical ButtonNode with brand theme integration.
 * `styleName` matches one of the active theme's button.styles[].name
 * entries (Tessera: 'default' | 'plain' | 'active' | 'danger'). The
 * node resolves the style → className at render via theme.button.styles
 * (with a one-time fallback warning if the name doesn't match).
 *   - linkText: visible button text
 *   - path:     URL — internal paths use useNavigate, external (http://)
 *               opens in a new tab
 *   - styleName: theme button-style name (default 'default')
 *   - keepSearchParams: preserve `?…` on internal navigation
 */
const button = (linkText, path, styleName = 'default', keepSearchParams = false) => ({
  type: 'button', version: 1,
  linkText, path,
  style: styleName,
  keepSearchParams,
});

/** Horizontal rule — a HorizontalRuleNode. Renders as `<hr>`, styled by
 * `theme.lexical.styles[0].hr_base` + `hr_after` (Tessera uses a 1px
 * groutLight divider with my-6 vertical breathing room). */
const hr = () => ({ type: 'horizontalrule', version: 1 });

/**
 * Column layout — a LayoutContainerNode that places its children in a
 * CSS grid. `templateColumns` is a Tailwind grid-cols class (the
 * codebase ships 6 hardcoded templates; tessera should switch to
 * theme-driven templates per lexical-layout-templates-theme-driven.md).
 *
 * `columns` is an array of arrays — outer = one entry per column,
 * inner = the lexical nodes (paragraphs, buttons, etc.) in that column.
 * Wraps each column in a LayoutItemNode.
 */
const layout = (templateColumns, columns) => ({
  type: 'layout-container', version: 1, direction: null, format: '', indent: 0,
  templateColumns,
  children: columns.map(col => ({
    type: 'layout-item', version: 1, direction: null, format: '', indent: 0,
    children: col,
  })),
});

const head  = (tag, t) => ({
  type: 'heading', tag, version: 1, direction: null, format: '', indent: 0,
  children: [text(t)],
});

const list  = (ordered, items) => ({
  type: 'list',
  listType: ordered ? 'number' : 'bullet',
  tag: ordered ? 'ol' : 'ul',
  version: 1, direction: null, format: '', indent: 0, start: 1,
  children: items.map(t => ({
    type: 'listitem', version: 1, value: 1, direction: null,
    format: '', indent: 0,
    children: Array.isArray(t) ? t : [text(t)],
  })),
});

const quote = (t) => ({
  type: 'quote', version: 1, direction: null, format: '', indent: 0,
  children: [text(t)],
});

const lexical = (children) => JSON.stringify({
  bgColor: 'rgba(0,0,0,0)',
  isCard: '',
  showToolbar: false,
  text: {
    root: {
      type: 'root', version: 1, direction: null, format: '', indent: 0, children,
    },
  },
});

// ---------------------------------------------------------------------------
// Page inventory — each page declares its own bands; each band lists its
// sections. Sections inherit the band's chosen LayoutGroup theme.
// ---------------------------------------------------------------------------

const pages = [
  // ===== marketing-homepage =================================================
  // Source: src/themes/tessera/design_system_v2/pages/marketing-homepage.html
  //
  // The mockup has six visual bands:
  //   1. hero            — header layoutGroup (unboxed, on bone)
  //   2. surfaces        — content layoutGroup (boxed parchment)
  //   3. two doors       — content layoutGroup (boxed parchment)
  //   4. in use          — content layoutGroup (boxed parchment)
  //   5. theory          — footer layoutGroup (limestone full-bleed band)
  //   6. site footer     — footer layoutGroup (limestone full-bleed band)
  //
  // The hero uses `theme: 'header'` (unboxed). The middle three use the
  // boxed `content` style. The theory and footer bands reuse the limestone
  // `footer` style — same visual treatment, different content position.
  {
    slug: 'marketing-homepage',
    title: 'Marketing — Homepage',
    bands: [
      {
        displayName: 'Hero',
        theme: 'header',
        position: 'content',
        sections: [
          // Heading levels map to Tessera's display ladder via the theme:
          //   h1 → displayHero (76)   h2 → displayXL (48)   h3 → displayLG (36)
          //   h4 → displayMD  (28)   h5 → displaySM (22)   h6 → displayXS (18)
          // For each section we choose the heading level whose rendered size
          // matches the mockup's intended display token.
          // Hero section: no `title` (the rendered page shouldn't show "Hero"
          // as an editor-chrome string), `size: "8"` to constrain to ~67% of
          // the 12-col grid so the text reads left-aligned in a column, and
          // `padding: 'p-0'` so the text aligns with the LayoutGroup
          // wrapper's left edge (not the standard p-4 section gutter).
          //
          // Uses the new StyledParagraphNode (`styled(...)` helper) to apply
          // brand textSettings tokens at the paragraph level:
          //   - metaSM     → mono uppercase eyebrow ("TESSERA · v0.1 PREVIEW",
          //                  "Open-source. Self-host or use the hosted service.")
          //   - h1         → displayHero (76px Newsreader)
          //   - proseLG    → 20px Plex Sans graphite lede
          { title: '', size: '8', padding: 'p-0', data: lexical([
              styled('eyebrow', text('Tessera · v0.1 preview')),
              head('h1', 'The shape of your data is the shape of your site.'), // displayHero
              styled('proseLG', text('One typed row that can be a page, a section, a dataset, a query, or a theme — and every part of the system composes against it.')),
              styled('metaSM', text('Open-source. Self-host or use the hosted service.')),
              // Two side-by-side CTAs via Lexical's LayoutContainer (the
              // `/columns` slash command from LayoutPlugin). Uses tessera's
              // `2 buttons side-by-side` template — three columns sized
              // `[max-content_max-content_1fr]` so the two button columns
              // shrink to fit the buttons exactly and the third column
              // soaks up the leftover row width. Layout-item padding is
              // overridden to nothing in tessera's lexical theme, so the
              // buttons sit tight to the text above. Third column is
              // intentionally empty.
              layout('grid-cols-1 md:grid-cols-[max-content_max-content_1fr]', [
                [para(button('See it run · wcdb.fm →', '#', 'default'))],
                [para(button('Host your own →',          '#', 'plain'))],
                [para(text(''))],
              ]),
          ])},
        ],
      },
      {
        displayName: 'Surfaces',
        theme: 'content',
        position: 'content',
        sections: [
          // Sections-without-titles convention: title:'' so the editor
          // chrome doesn't show "Surfaces — intro" above the rendered
          // band. Eyebrows use styled('metaSM') — the token's
          // text-transform:uppercase auto-handles the case, so passing
          // sentence-case input is fine (renders as "SURFACES").
          // Intro section deliberately narrower than the band (size 9 of 12)
          // so the eyebrow / heading / body sit in a measure-controlled
          // column with empty space on the right — matches the design's
          // "intro copy is narrower than the full band" treatment. Adding
          // a filler section after it would balance the grid; instead we
          // let the row break and the tile section that follows fill its
          // own row at full width.
          { title: '', size: '9', data: lexical([
              styled('eyebrow', text('Surfaces')),
              head('h3', 'One representation. Many renderings.'), // displayLG (36)
              para(text('A page is a row. A chart is a row. A map is a row. A join is two rows pointing at each other. The four sites below are driven by the same engine — no template forks, no special cases.')),
          ])},
          // Surface tile titles use styled('displaySM') instead of h5 so
          // the slug above them (`metaSM`) and the body below (`proseSM`)
          // each get an appropriate token, matching the design's
          // title-slug-body stacking per tile.
          { title: '', data: lexical([
              styled('displaySM', text('wcdb.fm')),
              styled('metaSM', text('Radio station')),
              styled('proseSM', text('Live now-playing, schedule grid, archive.')),
              styled('displaySM', text('mitigate.ny.gov')),
              styled('metaSM', text('Civic dashboard')),
              styled('proseSM', text('Watershed indicators, region drill-downs.')),
              styled('displaySM', text('npmrds.tessera.io')),
              styled('metaSM', text('Analytics page')),
              styled('proseSM', text('Freight corridor performance, last 30d.')),
              styled('displaySM', text('avail.docs.tessera.io')),
              styled('metaSM', text('Documentation')),
              styled('proseSM', text('API reference and pattern guides.')),
              styled('proseXS', text('[Card placeholder] The live page renders these four as a dataCard grid bound to a `sites` source. Until that source exists, the Lexical above stands in.')),
          ])},
        ],
      },
      {
        displayName: 'Two doors',
        theme: 'content',
        position: 'content',
        sections: [
          // Intro: full-width section above the two-column row below.
          { title: '', data: lexical([
              styled('eyebrow', text('Two doors')),
              head('h3', 'Run it yourself, or let us run it.'), // displayLG (36)
          ])},
          // Side-by-side via per-section `size`: Self-host (6/12) +
          // Hosted (6/12). DMS-native pattern — uses the sectionArray
          // grid the LayoutGroup already provides. Cleaner than
          // wrapping these in a Lexical layout-container inside one
          // section, because each door is a self-contained editable
          // section with its own toolbar / move / delete affordances.
          //
          // `border: 'full'` draws the brand's hairline frame
          // (theme.pages.sectionArray.styles[0].border.full → tessera
          // ships `border border-[groutLight] rounded-none`) around each
          // door, giving the two sections distinct card surfaces inside
          // the parchment LayoutGroup. Cleanest divider for side-by-side
          // content of the same "kind."
          { title: '', size: '6', border: 'full', data: lexical([
              head('h4', 'Self-host — Tessera, open.'), // displayMD (28)
              para(text('Download the engine. Bring your own Postgres. Compose against the same primitives the hosted service uses — no feature gates.')),
              list(false, [
                'Engine — AGPL-3.0',
                'Themes — MIT',
                'DB — Postgres 14+',
                'Deploy — Docker / systemd',
              ]),
              para(button('Host your own →', '#', 'plain')),
          ])},
          { title: '', size: '6', border: 'full', data: lexical([
              head('h4', 'Hosted — Tessera, run.'),
              para(text("The same engine, on our infrastructure. Backups, CDN, edge caching, custom domains. For when you'd rather place tiles than configure servers.")),
              list(false, [
                'Plan — Starter / Civic / Press',
                'Region — US-EAST · EU-WEST',
                'Backups — Daily, 30d retention',
                'SLA — 99.9% · audit on request',
              ]),
              para(button('See pricing →', '#', 'plain')),
          ])},
        ],
      },
      {
        displayName: 'In use',
        theme: 'content',
        position: 'content',
        // Eyebrow section (full-width) then three quote sections side-by-side
        // at size 4 each (3 × 4 = 12 cols). Each quote is its own section so
        // the author can move/edit/delete them independently — matches the
        // DMS-native "section per editable thing" philosophy.
        sections: [
          { title: '', data: lexical([
              styled('eyebrow', text('In use')),
          ])},
          { title: '', size: '4', data: lexical([
              // Lexical Quote → displayItalicMD (26 italic) per the theme.
              quote("We replaced a hand-tooled CMS, an analytics dashboard, and a static-site generator with a single Tessera instance. The data didn't move; only the renderings did."),
              styled('metaSM', text('Maintainer · State of New York, environmental data')),
          ])},
          { title: '', size: '4', data: lexical([
              quote("Our pages and our datasets used to drift. Now they're the same row, read two ways."),
              styled('metaSM', text('Engineer · campus radio collective, Albany')),
          ])},
          { title: '', size: '4', data: lexical([
              quote('The team that ships our reference site uses the same engine the library uses to publish the archive. We compose against shared primitives.'),
              styled('metaSM', text('Research lead · municipal archives')),
          ])},
        ],
      },
      {
        displayName: 'Theory band',
        theme: 'footer', // reuse the limestone full-bleed treatment
        position: 'content',
        sections: [
          // DMS sectionArray doesn't support a `col-start` / offset
          // property today — sections fill the grid in source order.
          // To OFFSET a narrow section (so it sits centered or
          // right-aligned in its band), prepend an empty filler section
          // with the appropriate size. Here: empty (2) + theory (8) =
          // 10 of 12, leaving 2 cols empty on the right — theory sits
          // centered between cols 3-10. Cheap, declarative, no extension
          // to the section-array primitive needed.
          { title: '', size: '2', data: lexical([para(text(''))])},
          // Theory section sized 8/12 (narrow), offset by the empty (2)
          // before it. Matches the design mockup's centered limestone
          // band where "On placing" reads as a focused column.
          { title: '', size: '8', data: lexical([
              styled('eyebrow', text('Theory')),
              // Mirrors the design's marketing-homepage theory band:
              //
              //   <h2 class="t-displayItalicLG">
              //     <em>On placing</em> — an essay on why a typed row is the
              //     right primitive for a data-driven site.
              //   </h2>
              //
              // The whole h2 uses the displayItalicLG token (italic). The
              // <em> around "On placing" is a no-op visually here (italic
              // inside italic), but kept to mirror the design semantics so
              // an author who changes the surrounding token to a roman one
              // still gets "On placing" italicized. Lexical inline italic
              // is `format: 2` on the text run.
              styled('displayItalicLG',
                text('On placing', 2),
                text(' — an essay on why a typed row is the right primitive for a data-driven site.'),
              ),
              styled('proseLG', text('A long-form companion to the documentation. Roman and Byzantine craftsmen spent careers placing tesserae one at a time into floors that lasted millennia. We think the same care belongs in the construction of a public dashboard or a civic data site. Read the full argument.')),
              para(button('Read "On placing" →', 'marketing-theory', 'plain')),
          ])},
        ],
      },
      {
        displayName: 'Site footer',
        theme: 'footer',
        position: 'bottom', // renders below the Layout via footerChildren
        sections: [
          // Footer split into four side-by-side column sections at size 3
          // each (totaling 12 cols), then a full-width colophon below.
          // Each column is its own editable section — adding a new footer
          // link group is just "+ Add section, set size 3" in the editor.
          { title: '', size: '3', data: lexical([
              head('h4', 'Tessera'), // displayMD (28) — brand mark
              styled('proseSM', text('A typed row that can be a page, a section, a dataset, a query, or a theme.')),
          ])},
          // Footer column heads use metaXS (10px mono uppercase) per
          // the design — h6 would render at displayXS (18px serif),
          // which is too prominent for footer column labels.
          { title: '', size: '3', data: lexical([
              styled('metaXS', text('Product')),
              list(false, ['Overview', 'Surfaces', 'Two doors', 'Pricing']),
          ])},
          { title: '', size: '3', data: lexical([
              styled('metaXS', text('Docs')),
              list(false, ['Patterns', 'Theming', 'CLI', 'Site recipes']),
          ])},
          { title: '', size: '3', data: lexical([
              styled('metaXS', text('Project')),
              list(false, ['GitHub', 'Roadmap', 'Changelog', 'Sponsors']),
          ])},
          // Colophon — full-width row below the 4 columns. Lead with a
          // horizontal rule (Lexical HorizontalRuleNode → tessera styles
          // it as a 1px groutLight line with my-6 breathing room) so the
          // copyright reads as a distinct line under the footer columns,
          // matching the design's `.footer-bottom` separator.
          { title: '', size: '12', data: lexical([
              hr(),
              styled('metaSM', text('© 2026 Tessera contributors · AGPL-3.0 (engine) · MIT (themes)')),
          ])},
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

const filtered = pages.filter(p => !slugFilter || p.slug.startsWith(slugFilter));
log(slugFilter
  ? `filtering by slug prefix "${slugFilter}" → ${filtered.length} page(s)`
  : `seeding ${filtered.length} page(s)`);

for (const p of filtered) {
  let pageId = pageIdForSlug(p.slug);
  if (pageId) {
    log(`reusing page ${p.slug} (id=${pageId})`);
  } else {
    log(`creating page ${p.slug} — "${p.title}"`);
    run(['page', 'create', '--title', p.title, '--slug', p.slug]);
    pageId = pageIdForSlug(p.slug);
    if (!pageId) { console.error(`  ✗ failed to resolve id for ${p.slug}`); continue; }
  }

  if (wipe) wipeDrafts(p.slug);

  log(`  ↳ writing ${p.bands.length} section_group band(s) → ${p.slug}`);
  const groups = setSectionGroups(p.slug, pageId, p.bands);

  const parentRef = JSON.stringify({ id: String(pageId), ref: `${env.DMS_APP}+main|page` });

  for (let i = 0; i < p.bands.length; i++) {
    const band = p.bands[i];
    const group = groups[i];
    log(`  ─ band "${band.displayName}" (theme=${band.theme}, position=${band.position})`);
    for (const s of band.sections) {
      const payload = {
        title: s.title,
        type: 'main|component',
        group: group.name,
        parent: parentRef,
        trackingId: randomUUID(),
        element: {
          'element-type': 'lexical',
          'element-data': s.data,
        },
      };
      // Per-section knobs.
      //   size:    column span 1..12 on tessera's grid (default '12' = full).
      //   padding: Tailwind class that overrides the sectionArray's
      //            sectionPadding ('p-4' by default). Use 'p-0' to align
      //            the section's content with the LayoutGroup wrapper's
      //            left edge (the hero on the marketing page uses this).
      //   border:  key into theme.pages.sectionArray.styles[0].border —
      //            'none' (default), 'full', 'openLeft', 'openRight',
      //            'openTop', 'openBottom', 'borderX'. 'full' gives the
      //            section the brand's hairline card frame (used by
      //            self-host vs hosted to make them read as two distinct
      //            cards inside the same LayoutGroup).
      payload.size = s.size || '12';
      if (s.padding != null) payload.padding = s.padding;
      if (s.border) payload.border = s.border;
      const extras = [
        s.padding != null ? `padding ${s.padding || '(none)'}` : null,
        s.border ? `border ${s.border}` : null,
      ].filter(Boolean).join(', ');
      log(`      + section "${s.title || '(untitled)'}" [size ${payload.size}${extras ? `, ${extras}` : ''}] (draft)`);
      run(['section', 'create', String(pageId), '--data', JSON.stringify(payload)]);
    }
  }
}

log('done — all sections landed in draft_sections (nothing published).');
log('to publish a page (humans only): dms page publish <slug>');
