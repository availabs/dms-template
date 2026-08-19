#!/usr/bin/env node
/* Create (or update) the WCDB `station_admin` pattern and its layout config.
 *
 *   export DMS_AUTH_TOKEN=…            (authenticating-the-dms-cli.md)
 *   node scripts/wcdb-admin/create-pattern.mjs [--dry-run]
 *
 * Idempotent: re-running reconciles the pattern's data rather than creating a
 * second one, and re-writes the site's pattern list only if the ref is missing.
 *
 * WHY A SEPARATE PATTERN (task: build-wcdb-admin-pages.md)
 * The admin surface must not share a config with the public site: it uses the
 * brand's SECOND Layout style (`app` — a persistent SideNav) while the public
 * pattern keeps the cutaway. Layout style is per-PATTERN, stored on the pattern
 * row at `theme.layout.options` and merged over the theme by `getPatternTheme`,
 * so one theme serves both and no library change is needed.
 *
 * The legacy `admin` pattern (id 1472716) already sits at /admin. It is
 * legacy-typed (`type: "pattern"`, no theme) and holds only scratch pages, so it
 * is DEMOTED to /admin_legacy rather than deleted — reversible, and it stops
 * shadowing the real admin at /admin.
 */
import { execFileSync } from 'node:child_process';

const HOST = process.env.DMS_HOST || 'http://localhost:3001';
const APP = process.env.DMS_APP || 'wcdb';
const TYPE = process.env.DMS_TYPE || 'prod';
const DRY = process.argv.includes('--dry-run');

const SITE_ID = '1471743';
const LEGACY_PATTERN_ID = '1472716';
const PATTERN_NAME = 'station_admin';
const PATTERN_TYPE = `${TYPE}|${PATTERN_NAME}:pattern`;

const CLI = 'src/dms/packages/dms/cli/bin/dms.js';
const dms = (args) => {
  const out = execFileSync('node', [CLI, ...args, '--host', HOST, '--app', APP, '--type', TYPE], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return out.trim();
};
const dmsJson = (args) => JSON.parse(dms(args));

/* ── the pattern row ──────────────────────────────────────────────────────
 * `theme.layout.options` is the whole point of this file. Note `_replace` on
 * the menu arrays: mergeTheme merges arrays by index, so without it the base
 * theme's public topNav widgets would survive underneath ours.
 */
const patternData = {
  name: PATTERN_NAME,
  pattern_type: 'page',
  base_url: '/admin',
  subdomain: '*',
  html_title: 'WCDB Admin',
  filters: [],
  theme: {
    selectedTheme: 'wcdb',
    layout: {
      options: {
        // 1 = the `app` layout style (persistent rail, single dense column).
        activeStyle: 1,
        // No public notch on an editing surface.
        topNav: {
          nav: 'none',
          size: 'none',
          leftMenu: [],
          rightMenu: [],
          activeStyle: null,
          _replace: ['leftMenu', 'rightMenu'],
        },
        // The rail. Its ITEMS come from this pattern's pages (add a page, get a
        // rail item); topMenu/bottomMenu carry the chrome the mockup draws
        // around them. Draft pages only appear in the rail in edit mode —
        // expected until a human publishes.
        sideNav: {
          nav: 'main',
          size: 'compact',
          activeStyle: null,
          topMenu: [
            { type: 'Logo' },
            { type: 'SideNavHeading', options: { label: 'Station admin' } },
          ],
          bottomMenu: [
            { type: 'SideNavSiteLink', options: { heading: 'Public site', label: 'View site', to: '/' } },
            { type: 'UserMenu' },
            { type: 'ThemeModeToggle' },
          ],
          _replace: ['topMenu', 'bottomMenu'],
        },
      },
    },
  },
};

/* ── find or create ──────────────────────────────────────────────────────── */
const site = dmsJson(['raw', 'get', SITE_ID]);
const patternRefs = site.data.patterns || [];

let existing = null;
for (const ref of patternRefs) {
  const row = dmsJson(['raw', 'get', ref.id]);
  if (row.data?.type === PATTERN_TYPE || row.data?.name === PATTERN_NAME) {
    existing = row;
    break;
  }
}

if (DRY) {
  console.log(existing ? `would UPDATE pattern ${existing.data.id}` : 'would CREATE the pattern');
  console.log(JSON.stringify(patternData, null, 2));
  process.exit(0);
}

let patternId;
if (existing) {
  patternId = existing.data.id;
  dms(['raw', 'update', patternId, '--data', JSON.stringify(patternData)]);
  console.log(`updated pattern ${patternId} (${PATTERN_TYPE})`);
} else {
  const created = dmsJson(['raw', 'create', APP, PATTERN_TYPE, '--data', JSON.stringify(patternData)]);
  patternId = created.id || created.data?.id;
  console.log(`created pattern ${patternId} (${PATTERN_TYPE})`);

  // Attach it to the site. `--data` full-replaces the one key and preserves the
  // rest of the site row (`--set` would deep-merge the array BY INDEX).
  const patterns = [...patternRefs, { id: String(patternId), ref: `${APP}+pattern` }];
  dms(['raw', 'update', SITE_ID, '--data', JSON.stringify({ patterns })]);
  console.log(`attached to site ${SITE_ID} (${patterns.length} patterns)`);
}

/* ── demote the legacy /admin pattern ───────────────────────────────────── */
const legacy = dmsJson(['raw', 'get', LEGACY_PATTERN_ID]);
if (legacy.data?.base_url === '/admin') {
  dms(['raw', 'update', LEGACY_PATTERN_ID, '--data', JSON.stringify({ base_url: '/admin_legacy' })]);
  console.log(`demoted legacy pattern ${LEGACY_PATTERN_ID}: /admin → /admin_legacy`);
} else {
  console.log(`legacy pattern ${LEGACY_PATTERN_ID} already at ${legacy.data?.base_url}`);
}

console.log(`\npattern id: ${patternId}`);
