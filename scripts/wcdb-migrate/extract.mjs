#!/usr/bin/env node
/* 1/3 · Pull the three legacy DMS datasets to ./out/raw-*.json.
 *
 *   node scripts/wcdb-migrate/extract.mjs
 *
 * Uses the DMS CLI (never raw Falcor) per dms-template/CLAUDE.md. The dumps are
 * kept because they are the before-state every verification number is measured
 * against — re-running the transform must not require re-reading the server.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, 'out');
const CLI = resolve(HERE, '../../src/dms/packages/dms/cli/bin/dms.js');

const ENV = {
  ...process.env,
  DMS_HOST: process.env.DMS_HOST || 'https://dmsserver.availabs.org',
  DMS_APP: process.env.DMS_APP || 'wcdb',
  DMS_TYPE: process.env.DMS_TYPE || 'prod',
};

// `--view` is explicit for the schedule: v2 (the "latest") is EMPTY, v1 holds
// all 769 rows. Defaulting to latest here would silently migrate nothing.
const SOURCES = [
  { name: 'djs',            id: '1958637', view: null,       limit: 2000 },
  { name: 'schedule',       id: '1957812', view: '1957813',  limit: 2000 },
  { name: 'schedule_times', id: '1963488', view: null,       limit: 2000 },
];

mkdirSync(OUT, { recursive: true });
for (const s of SOURCES) {
  const args = [CLI, 'dataset', 'dump', s.id, '--limit', String(s.limit)];
  if (s.view) args.push('--view', s.view);
  const raw = execFileSync('node', args, { env: ENV, maxBuffer: 256 * 1024 * 1024 })
    .toString()
    .split('\n')
    .find((l) => l.trim().startsWith('{'));
  const parsed = JSON.parse(raw);
  writeFileSync(`${OUT}/raw-${s.name}.json`, JSON.stringify(parsed, null, 2));
  console.log(`${s.name.padEnd(16)} ${parsed.items.length} rows  (total ${parsed.total})`);
}
console.log(`\nwrote ${OUT}/raw-*.json`);
