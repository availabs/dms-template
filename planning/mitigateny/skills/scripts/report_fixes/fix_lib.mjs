/**
 * Shared helpers for the report-driven live-fix loop
 * (see ../../applying-report-fixes-to-a-live-site.md).
 *
 * Everything here reads through the DMS CLI's own falcor helpers, so a script
 * and a `dms ...` command see byte-identical rows. No credentials live here:
 * DMS_HOST / DMS_APP / DMS_AUTH_TOKEN come from the environment.
 */
import fs from 'fs';
import path from 'path';
import {
  makeClient, fetchById, parseData,
} from '../../../../../src/dms/packages/dms/cli/src/utils/data.js';

export function config() {
  const c = {
    host: process.env.DMS_HOST,
    app: process.env.DMS_APP,
    type: process.env.DMS_TYPE,
    authToken: process.env.DMS_AUTH_TOKEN,
  };
  for (const k of ['host', 'app', 'authToken']) {
    if (!c[k]) throw new Error(`missing env: DMS_${k === 'authToken' ? 'AUTH_TOKEN' : k.toUpperCase()}`);
  }
  return c;
}

export const client = (c) => makeClient(c);

const deepParse = (v) => {
  if (typeof v !== 'string') return v;
  const t = v.trim();
  if (!(t.startsWith('{') || t.startsWith('['))) return v;
  try { return JSON.parse(t); } catch { return v; }
};

/** Ids inside a page's `sections` / `draft_sections` (bare id, {id}, or $ref). */
export function refIds(val) {
  const arr = deepParse(val);
  if (!Array.isArray(arr)) return [];
  return arr.map((m) => {
    if (m == null) return null;
    if (typeof m === 'string' || typeof m === 'number') return String(m);
    if (m.id != null) return String(m.id);
    if (Array.isArray(m.value)) return String(m.value[m.value.length - 1]);
    return null;
  }).filter(Boolean);
}

/**
 * The full snapshot of one section: its own row plus the placement facts that
 * make the row meaningful (which page owns it, whether it is a DRAFT or a
 * PUBLISHED section, which section group it sits in).
 */
export async function snapshot(falcor, c, sectionId, expectedPageId = null) {
  const row = await fetchById(falcor, c.app, sectionId, [
    'id', 'app', 'type', 'data', 'created_at', 'updated_at',
  ]);
  if (!row) throw new Error(`section not found: ${sectionId}`);
  const data = parseData(row.data) || {};

  // `data.parent` is NOT authoritative. The hazard pages were cloned from
  // flooding and their sections still carry the ORIGINAL page's parent, so a
  // parent-derived placement reports a live section as an ORPHAN. The page's
  // own `draft_sections` array is the only real owner. Pass the page the report
  // names as `expectedPageId` and placement is resolved against that.
  const parentPageId = (deepParse(data.parent) || {}).id ?? null;
  const pageId = expectedPageId ?? parentPageId;
  let placement = { pageId: pageId ?? null, parentPageId, parentMatchesPage: String(parentPageId) === String(pageId) };
  if (pageId) {
    const page = await fetchById(falcor, c.app, pageId, ['id', 'data']);
    const pd = page ? parseData(page.data) || {} : {};
    const draft = refIds(pd.draft_sections);
    const pub = refIds(pd.sections);
    const groups = deepParse(pd.draft_section_groups) || [];
    const group = (Array.isArray(groups) ? groups : [])
      .find((g) => g && g.name === data.group) || null;
    placement = {
      pageId: String(pageId),
      parentPageId,
      parentMatchesPage: String(parentPageId) === String(pageId),
      pageTitle: pd.title ?? '',
      pageSlug: pd.url_slug ?? '',
      inDraftSections: draft.includes(String(sectionId)),
      draftIndex: draft.indexOf(String(sectionId)),
      draftSectionCount: draft.length,
      inPublishedSections: pub.includes(String(sectionId)),
      sectionGroupId: data.group ?? '',
      sectionGroupInDraftGroups: !!group,
      sectionGroupName: group ? (group.displayName || (group.name === 'default' ? 'Group 1' : '')) : '',
    };
  }

  return {
    id: String(row.id),
    app: row.app,
    type: row.type,
    created_at: row.created_at,
    updated_at: row.updated_at,
    data,
    placement,
  };
}

/** Stable JSON so two snapshots of an unchanged row compare byte-for-byte. */
export function canonical(v) {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical(v[k])]));
  }
  return v;
}

/** Flatten to `a.b[0].c` -> value so a diff can name exactly what moved. */
export function flatten(v, prefix = '', out = {}) {
  if (Array.isArray(v)) {
    if (!v.length) out[prefix] = '[]';
    v.forEach((x, i) => flatten(x, `${prefix}[${i}]`, out));
  } else if (v && typeof v === 'object') {
    const keys = Object.keys(v);
    if (!keys.length) out[prefix] = '{}';
    keys.forEach((k) => flatten(v[k], prefix ? `${prefix}.${k}` : k, out));
  } else {
    out[prefix] = v === undefined ? null : v;
  }
  return out;
}

/**
 * Every leaf path whose value differs. `element-data` is usually a JSON string
 * (lexical bodies, Card config); parse it first so a diff points at the node
 * that changed instead of reporting one giant opaque string.
 */
export function diffLeaves(before, after) {
  const prep = (o) => {
    const clone = JSON.parse(JSON.stringify(o));
    const ed = clone?.data?.element?.['element-data'];
    if (typeof ed === 'string') {
      const p = deepParse(ed);
      if (p !== ed) clone.data.element['element-data'] = p;
    }
    return flatten(canonical(clone));
  };
  const a = prep(before);
  const b = prep(after);
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  const changed = [];
  for (const k of keys) {
    const av = a[k], bv = b[k];
    if (JSON.stringify(av) !== JSON.stringify(bv)) changed.push({ path: k, before: av, after: bv });
  }
  return changed;
}

export function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 1));
}

export const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
