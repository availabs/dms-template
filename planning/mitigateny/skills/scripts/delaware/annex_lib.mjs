// Shared helpers for the Delaware jurisdictional-annex load.
// Same statewide Jurisdictions dataset as Schenectady (source 1346449 / view
// 1346450); only the county geoid differs (Delaware = 36025). Auth: reads
// DMS_AUTH_TOKEN from the environment (mint it with the CLI — see
// src/dms/skills/authenticating-the-dms-cli.md). No credentials in this file.
// Reads: split-table rows are NOT readable via byId — the only route that
// returns split-row data is the `edit` call's RETURNING, so we read with an
// empty merge (a no-op write that bumps updated_at + one changelog entry).
// Writes: go through the `dms dataset update` CLI command (edit call with the
// 4th `type` arg for split-table routing).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const HOST = process.env.DMS_HOST || 'https://dmsserver.availabs.org';
export const APP = process.env.DMS_APP || 'mitigat-ny-prod';
export const SOURCE_ID = 1346449;
export const VIEW_ID = 1346450;
export const DATA_TYPE = 'jurisdictions|1346450:data';
export const COUNTY_GEOID = '36025'; // Delaware County, NY
// Repo-relative so this works on any checkout; override with DMS_CLI if needed.
const CLI = process.env.DMS_CLI
  || path.resolve(new URL('../../../../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'),
                  'src/dms/packages/dms/cli/bin/dms.js');

/**
 * Returns the session token. Auth is the CLI's job, not this script's — mint a
 * token with `src/dms/skills/authenticating-the-dms-cli.md` and export it as
 * DMS_AUTH_TOKEN before running. No credentials live in this file.
 */
export async function login() {
  const token = process.env.DMS_AUTH_TOKEN;
  if (!token) throw new Error(
    'DMS_AUTH_TOKEN is not set. Mint a token per src/dms/skills/authenticating-the-dms-cli.md '
    + 'and export it before running this script.');
  return token;
}

function atom(v) { return v && v.$type === 'atom' ? v.value : v; }

async function editCall(token, id, data) {
  const args = [APP, Number(id), data, DATA_TYPE];
  const body = 'method=call&callPath=' + encodeURIComponent(JSON.stringify(['dms', 'data', 'edit']))
    + '&arguments=' + encodeURIComponent(JSON.stringify(args));
  const r = await fetch(HOST + '/graph', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: 'Bearer ' + token },
    body,
  });
  if (!r.ok) throw new Error('edit HTTP ' + r.status + ' ' + await r.text());
  const j = await r.json();
  let d = atom(j?.jsonGraph?.dms?.data?.[APP]?.byId?.[String(id)]?.data);
  if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { /* keep string */ } }
  return d;
}

/** Read a split-table row by doing a no-op (empty) merge; returns parsed data. */
export async function readRow(token, id) { return editCall(token, id, {}); }

/** Enumerate the county's jurisdiction row ids via the filtered `opts` route. */
export async function countyRowIds(token) {
  const optKey = JSON.stringify({ filter: { [`data->>'county_geoid'`]: [COUNTY_GEOID] } });
  const body = 'method=get&paths=' + encodeURIComponent(JSON.stringify([[
    'dms', 'data', `${APP}+${DATA_TYPE}`, 'opts', [optKey], 'byIndex', { from: 0, to: 99 },
  ]]));
  const r = await fetch(HOST + '/graph', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: 'Bearer ' + token },
    body,
  });
  const j = await r.json();
  const bi = j?.jsonGraph?.dms?.data?.[`${APP}+${DATA_TYPE}`]?.opts?.[optKey]?.byIndex || {};
  const ids = [];
  for (const k of Object.keys(bi)) { const ref = bi[k]; if (ref && ref.$type === 'ref') ids.push(ref.value[ref.value.length - 1]); }
  return ids;
}

/** Write columns into a row via the `dms dataset update` CLI (split-table aware).
 * Payload is written to a temp file and passed as `--data <path>` — lexical
 * columns are large and would blow the Windows command-line length limit inline. */
export function cliUpdate(token, rowId, dataObj) {
  const env = { ...process.env, DMS_HOST: HOST, DMS_APP: APP, DMS_TYPE: 'prod', DMS_AUTH_TOKEN: token };
  const tmp = path.resolve(`./.payload_${rowId}.json`);
  fs.writeFileSync(tmp, JSON.stringify(dataObj));
  try {
    const out = execFileSync('node', [CLI, 'dataset', 'update', String(SOURCE_ID), String(rowId),
      '--data', tmp, '--compact'], { env, encoding: 'utf8' });
    const line = out.trim().split('\n').filter(Boolean).pop();
    return JSON.parse(line);
  } finally { fs.unlinkSync(tmp); }
}
