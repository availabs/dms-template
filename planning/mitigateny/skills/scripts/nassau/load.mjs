/**
 * Phase 7e - the Nassau loader. One script, all six datasets, inserts and updates.
 *
 * Replaces Suffolk's three separate writers. Suffolk's `insert_rows.mjs` is close in shape --
 * the payloads were deliberately built to match it -- but it is INSERT-ONLY and ignores `_op`,
 * so pointing it at Nassau would insert the 131 matched Actions rows as 131 duplicates. That is
 * precisely the failure the whole match step exists to prevent, so the two paths live together
 * here and are driven by the payload.
 *
 * ============================================================================================
 * WHAT IT REFUSES TO DO
 * ============================================================================================
 * Every one of these is a hard stop, not a warning, because the failure mode of each is a
 * silent partial load that looks like success:
 *
 *   - no DMS_AUTH_TOKEN                     -> writes would be rejected row by row
 *   - a token that has expired mid-run      -> detected on the first `no-access`, then STOP.
 *                                              Otherwise a 6h token expiring at row 400 of 896
 *                                              produces 496 silent failures.
 *   - an UPDATE with no backup entry         -> the row's pre-state is unknown, so the write is
 *                                              irreversible. Refuse rather than proceed.
 *   - INSERTing into a jurisdiction that     -> the double-insert guard. Overridable only with
 *     already has rows                         --force, and --force is never used to "get past"
 *                                              a guard; it is for deliberately adding alongside.
 *   - a read-back diff                       -> reported per field and counted; a non-zero count
 *                                              fails the run's exit code.
 *
 * ============================================================================================
 * ORDER OF OPERATIONS PER INSERTED ROW
 * ============================================================================================
 *   1. `raw create`            -> new id
 *   2. append the id to runs/<run>/created.json   BEFORE the fill
 *   3. `dataset update --data` -> fill it
 * Step 2 is not optional. Gate 2 proved why: `raw delete` takes <app> <type> <id> and a wrong
 * signature failed AFTER the row existed. The id on disk turned a stranded production row into
 * a thirty-second fix.
 *
 * Usage:
 *   node load.mjs <dataset> <geoid|--all> [--dry] [--inserts-only|--updates-only]
 *                 [--limit=N] [--force]
 *
 *   dataset: actions | capabilities | roles | participation | hoc | jurisdictions
 *   --dry    do everything except the two write calls; still runs the guards and prints the plan
 *
 * Writes runs/<timestamp>_<dataset>_<geoid>/  created.json, log.txt, result.json
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const CTX = path.resolve(HERE, '..');
const CLI = path.resolve(CTX, '../../../../src/dms/packages/dms/cli/bin/dms.js');
const PAY = path.join(CTX, 'payloads');
const BAK = path.join(CTX, 'backups');
const APP = process.env.DMS_APP || 'mitigat-ny-prod';

// `matched` says whether this dataset's insert/update split comes from match_existing.py.
// Only those need match provenance before inserting. HOC decides its split structurally --
// the 17 named hazards are a pre-seeded grid joined by row id, and its only inserts are
// Freeport's 6 `other` rows, which come from the owner-decided freeport-hazard-map.csv.
// Demanding provenance there skipped Freeport entirely on the first HOC batch: 17 updates and
// 6 inserts silently not written, reported only as one "skip" line among 52.
const DATASETS = {
  actions:       { source: '1029065', view: '1074456', instance: 'actions_revised',
                   prefix: 'act',   label: 'action_name', matched: true },
  capabilities:  { source: '1068273', view: '1172519', instance: 'capabilities_catalogue',
                   prefix: 'cap',   label: 'capability_name', matched: true },
  roles:         { source: '1473295', view: '1473296', instance: 'roles',
                   prefix: 'roles', label: 'name', matched: true },
  participation: { source: '1473468', view: '1473469', instance: 'participation',
                   prefix: 'part',  label: 'meeting_name', matched: true },
  hoc:           { source: '1473470', view: '1473471', instance: 'hazards_of_concern',
                   prefix: 'hoc',   label: 'hazard', split: true, matched: false },
  jurisdictions: { source: '1346449', view: '1346450', instance: 'jurisdictions',
                   prefix: 'juris', label: 'jurisdiction', single: '_juris_updates.json',
                   matched: false },
};

// ---------------------------------------------------------------------------- args
const which = process.argv[2];
const target = process.argv[3];
const DRY = process.argv.includes('--dry');
const FORCE = process.argv.includes('--force');
const ONLY_I = process.argv.includes('--inserts-only');
const ONLY_U = process.argv.includes('--updates-only');
const LIMIT = Number((process.argv.find(a => a.startsWith('--limit=')) || '').split('=')[1] || 0);
const DS = DATASETS[which];
if (!DS || !target) {
  console.error(`Usage: node load.mjs <${Object.keys(DATASETS).join('|')}> <geoid|--all> ` +
    `[--dry] [--inserts-only|--updates-only] [--limit=N] [--force]`);
  process.exit(2);
}
process.env.DMS_HOST ||= 'https://dmsserver.availabs.org';
process.env.DMS_TYPE ||= 'prod';
if (!process.env.DMS_AUTH_TOKEN && !DRY) {
  console.error('REFUSING: DMS_AUTH_TOKEN is not set. Every write would be rejected.');
  process.exit(2);
}

// ---------------------------------------------------------------------------- cli
class NoAccess extends Error {}
const dms = (args) => {
  let out;
  try {
    out = execFileSync(process.execPath, [CLI, ...args], {
      encoding: 'utf8', env: process.env, stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 128 * 1024 * 1024,
    });
  } catch (e) {
    const blob = `${e.stdout || ''}${e.stderr || ''}${e.message || ''}`;
    if (/no-access|Unexpected token 'o'/.test(blob)) throw new NoAccess('no-access');
    throw new Error(blob.slice(0, 400));
  }
  if (/no-access/.test(out)) throw new NoAccess('no-access');
  const i = out.search(/[[{]/);
  if (i < 0) throw new Error(`no JSON in CLI output: ${out.slice(0, 300)}`);
  return JSON.parse(out.slice(i));
};

const sortKeys = (x) => Array.isArray(x) ? x.map(sortKeys)
  : (x && typeof x === 'object'
     ? Object.keys(x).sort().reduce((a, k) => (a[k] = sortKeys(x[k]), a), {}) : x);
const norm = (x) => (x === null || x === undefined || x === ''
  ? '' : (typeof x === 'object' ? JSON.stringify(sortKeys(x)) : String(x)));

// ---------------------------------------------------------------------------- payload
/** -> [{op, data, existingId, tag}] */
function loadPayload(geoid) {
  const out = [];
  if (DS.single) {
    const all = JSON.parse(fs.readFileSync(path.join(PAY, DS.single), 'utf8'));
    for (const r of all) {
      if (geoid !== '--all' && String(r.geoid) !== String(geoid)) continue;
      out.push({ op: 'update', data: r.data, existingId: String(r.row_id),
                 tag: r.jurisdiction, geoid: String(r.geoid) });
    }
    return out;
  }
  const geoids = geoid === '--all'
    ? [...new Set(fs.readdirSync(PAY)
        .filter(f => f.startsWith(DS.prefix + '_') && f.endsWith('.json'))
        .map(f => f.slice(DS.prefix.length + 1).replace(/(_updates|_inserts)?\.json$/, '')))]
        .sort()
    : [String(geoid)];

  for (const g of geoids) {
    if (DS.split) {
      const u = path.join(PAY, `hoc_${g}_updates.json`);
      const i = path.join(PAY, `hoc_${g}_inserts.json`);
      if (fs.existsSync(u)) {
        for (const r of JSON.parse(fs.readFileSync(u, 'utf8'))) {
          out.push({ op: 'update', data: r.data, existingId: String(r.id),
                     tag: r.hazard, geoid: g });
        }
      }
      if (fs.existsSync(i)) {
        for (const r of JSON.parse(fs.readFileSync(i, 'utf8'))) {
          out.push({ op: 'insert', data: r.data,
                     tag: r.data.hazard_name_if_other || r.data.hazard, geoid: g });
        }
      }
      continue;
    }
    const p = path.join(PAY, `${DS.prefix}_${g}.json`);
    if (!fs.existsSync(p)) continue;
    for (const r of JSON.parse(fs.readFileSync(p, 'utf8'))) {
      out.push({ op: r._op || 'insert', data: r.data,
                 existingId: r._existing_id ? String(r._existing_id) : null,
                 tag: String(r.data[DS.label] || '').slice(0, 60), geoid: g });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------- backup
/** row id -> the rollback patch, for the CURRENT backup. Updates without one are refused. */
function loadBackup() {
  const label = fs.readFileSync(path.join(BAK, 'LATEST'), 'utf8').trim();
  const f = path.join(BAK, label, `${which}_rollback.json`);
  if (!fs.existsSync(f)) return { label, byId: null };
  const byId = new Map(JSON.parse(fs.readFileSync(f, 'utf8')).map(r => [String(r.id), r.data]));
  return { label, byId };
}

// ---------------------------------------------------------------------------- run dir
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z');
const runDir = path.join(CTX, 'runs', `${stamp}_${which}_${target.replace('--', '')}`);
fs.mkdirSync(runDir, { recursive: true });
const logLines = [];
const say = (s) => { console.log(s); logLines.push(s); };
const flush = () => fs.writeFileSync(path.join(runDir, 'log.txt'), logLines.join('\n') + '\n');

// ---------------------------------------------------------------------------- main
const rows = loadPayload(target);
const planned = rows
  .filter(r => !(ONLY_I && r.op === 'update') && !(ONLY_U && r.op === 'insert'))
  .slice(0, LIMIT || undefined);
const nIns = planned.filter(r => r.op === 'insert').length;
const nUpd = planned.length - nIns;

say(`${which}  target=${target}  ${planned.length} row(s): ${nIns} insert, ${nUpd} update`);
say(`  source ${DS.source} view ${DS.view}${DRY ? '   [--dry: no writes]' : ''}`);

// -- guard 1: every update must have a backup entry
const { label: bakLabel, byId } = loadBackup();
say(`  backup: ${bakLabel}${byId ? '' : '  (no rollback file for this dataset)'}`);
if (nUpd) {
  if (!byId) {
    say(`REFUSING: ${nUpd} update(s) planned but no ${which}_rollback.json in backups/${bakLabel}.`);
    say(`  An update with no recorded pre-state is irreversible. Re-run backup_before_write.py.`);
    flush(); process.exit(1);
  }
  const missing = planned.filter(r => r.op === 'update' && !byId.has(r.existingId));
  if (missing.length) {
    say(`REFUSING: ${missing.length} update(s) have no backup entry, e.g. id ` +
        `${missing.slice(0, 5).map(m => m.existingId).join(', ')}`);
    flush(); process.exit(1);
  }
  say(`  all ${nUpd} update target(s) have a recorded pre-state`);
}

// -- guard 2: the double-insert guard
//
// WHAT THE RISK ACTUALLY IS. The first version of this refused whenever a jurisdiction had more
// existing rows than the payload claimed as updates. That is the wrong test, and dry-running
// Long Beach showed why: it has 15 existing Actions and 14 matched, so it refused -- but an
// UNMATCHED existing row is entirely normal. The 2020 plan does not have to mention every action
// already in the system; county-wide, 41 of the 172 in-scope rows have no counterpart in it.
//
// A payload row marked `insert` has, by construction, already been compared against every
// existing row for its jurisdiction and found no match. So the real duplication risks are the
// two ways that construction can be invalid:
//
//   1. the live dump the matcher used is older than the payloads   -> decisions are stale
//   2. this dataset+target has already been loaded once            -> re-running duplicates
//
// Unmatched existing rows are reported, because they are worth knowing about, not refused.
if (nIns) {
  const dumpPath = path.join(CTX, 'extracted', `live_${which}_nassau.json`);
  if (!fs.existsSync(dumpPath)) {
    say(`REFUSING: no live dump for ${which}. The insert/update split cannot be trusted ` +
        `without one. Run: node fetch_live.mjs ${which} --verify`);
    flush(); process.exit(1);
  }
  // Has the dump CHANGED since the match? Compare the content hash the matcher recorded,
  // not file mtimes -- the matcher writes payloads after reading the dump, so payloads are
  // always newer on a correct run and an mtime test refuses every legitimate load.
  if (DS.matched) {
    const provPath = path.join(PAY, '_match_provenance.json');
    if (!fs.existsSync(provPath)) {
      say(`REFUSING: no payloads/_match_provenance.json. Cannot tell which live dump the ` +
          `insert/update split was decided against. Re-run: ` +
          `python match_existing.py ${which} --apply`);
      flush(); process.exit(1);
    }
    const prov = JSON.parse(fs.readFileSync(provPath, 'utf8'))[which];
    if (!prov) {
      say(`REFUSING: _match_provenance.json has no entry for ${which}. Re-run the matcher.`);
      flush(); process.exit(1);
    }
    const nowSha = crypto.createHash('sha256').update(fs.readFileSync(dumpPath)).digest('hex');
    if (nowSha !== prov.live_sha256 && !FORCE) {
      say(`REFUSING: the live ${which} dump has CHANGED since the match was computed.`);
      say(`  matched against sha256 ${String(prov.live_sha256).slice(0, 16)}… (${prov.live_rows} rows, ${prov.matched_at})`);
      say(`  dump on disk now       ${nowSha.slice(0, 16)}…`);
      say(`  Re-run: python match_existing.py ${which} --apply    then retry.`);
      flush(); process.exit(1);
    }
    say(`  match provenance ok: decided against ${prov.live_rows} existing row(s) ` +
        `at ${prov.matched_at}`);
  } else {
    say(`  ${which} is not matcher-driven; its insert/update split is structural, so no ` +
        `match provenance is required`);
  }

  // Prior-run detection keys on `created.json` -- evidence that rows were MADE -- not on
  // `result.json`, which only exists if the run reached its end.
  //
  // WHY: the first version checked result.json with wrote>0. A run killed partway leaves
  // created rows and NO result.json, so the guard was blind to exactly the case that most
  // needs catching. That happened: a loader invocation was terminated mid-insert after 7 of 28
  // rows, the next invocation saw no completed run, and Long Beach ended up with 35 capability
  // rows and 7 duplicates. An incomplete run is MORE dangerous than a complete one, and it was
  // the only kind the guard ignored.
  const priorRuns = [];
  const runsRoot = path.join(CTX, 'runs');
  if (fs.existsSync(runsRoot)) {
    for (const d of fs.readdirSync(runsRoot)) {
      const dir = path.join(runsRoot, d);
      const cf = path.join(dir, 'created.json');
      const rf = path.join(dir, 'result.json');
      const sf = path.join(dir, 'started.json');
      // A run whose rows have been reconciled (deleted, or accepted as already present) stops
      // blocking. Without this an aborted run blocks its dataset forever and the only way past
      // is --force, which is the wrong tool: it means "add alongside", not "I cleaned up".
      if (fs.existsSync(path.join(dir, 'reconciled.json'))) continue;
      let meta = null;
      if (fs.existsSync(rf)) meta = JSON.parse(fs.readFileSync(rf, 'utf8'));
      else if (fs.existsSync(sf)) meta = JSON.parse(fs.readFileSync(sf, 'utf8'));
      // Fall back to the directory name (`<stamp>_<dataset>_<target>`) when neither marker
      // exists. A run killed before started.json was introduced has only created.json, which
      // records ids but not which dataset they belong to -- and that is precisely the run that
      // must not be invisible.
      if (!meta) {
        const m = d.match(/^[^_]+_(.+)_([^_]+)$/);
        if (!m) continue;
        meta = { dataset: m[1], target: m[2], planned: null };
      }
      if (meta.dataset !== which || String(meta.target) !== String(target)) continue;
      const nCreated = fs.existsSync(cf)
        ? JSON.parse(fs.readFileSync(cf, 'utf8')).length : 0;
      if (nCreated > 0 || (meta.wrote || 0) > 0) {
        priorRuns.push({ dir: d, created: nCreated,
                         complete: fs.existsSync(rf), planned: meta.planned });
      }
    }
  }
  if (priorRuns.length && !FORCE) {
    say(`REFUSING: ${which} / ${target} has already been written to:`);
    for (const p of priorRuns) {
      say(`    ${p.dir}  created ${p.created} row(s)` +
          (p.complete ? '  [completed]'
                      : `  [INCOMPLETE - no result.json; planned ${p.planned}]`));
    }
    const partial = priorRuns.filter(p => !p.complete);
    if (partial.length) {
      say(`  An INCOMPLETE run means rows exist that were never verified. Reconcile before`);
      say(`  re-running: the ids are in that run's created.json. Delete them, or finish the run`);
      say(`  with --force once you know which rows are already present.`);
    } else {
      say(`  Re-running would insert a second copy. Roll back first if rows need replacing;`);
      say(`  pass --force only to deliberately add alongside what is there.`);
    }
    flush(); process.exit(1);
  }

  const dump = JSON.parse(fs.readFileSync(dumpPath, 'utf8'));
  const geoids = [...new Set(planned.filter(r => r.op === 'insert').map(r => r.geoid))];
  let unmatched = 0;
  for (const g of geoids) {
    const claimedIds = new Set(planned.filter(r => r.op === 'update' && r.geoid === g)
      .map(r => r.existingId));
    unmatched += (dump[g] || []).filter(r => !claimedIds.has(String(r.id))).length;
  }
  say(`  double-insert guard passed: dump is current, no prior load of ${which}/${target}`);
  if (unmatched) {
    say(`  note: ${unmatched} existing ${which} row(s) across these jurisdictions have no ` +
        `counterpart in the 2020 plan. They are left untouched, which is expected.`);
  }
}

if (DRY) {
  say(`\n--dry: stopping before any write. First 5 planned rows:`);
  for (const r of planned.slice(0, 5)) {
    say(`   ${r.op.toUpperCase().padEnd(6)} ${(r.existingId || 'new').padEnd(9)} ` +
        `${Object.keys(r.data).length} col  ${r.tag}`);
  }
  flush(); process.exit(0);
}

// ---------------------------------------------------------------------------- write
// A marker written BEFORE the first write, so a run that is killed before it can produce
// result.json is still identifiable as "this dataset/target was touched". created.json alone
// would miss an update-only run, which creates no rows but still changes them.
fs.writeFileSync(path.join(runDir, 'started.json'), JSON.stringify({
  dataset: which, target, source: DS.source, view: DS.view,
  planned: planned.length, inserts: nIns, updates: nUpd,
  started_at: new Date().toISOString(),
}, null, 1));

const createdPath = path.join(runDir, 'created.json');
const created = [];
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nassauload-'));
const DATA_TYPE = `${DS.instance}|${DS.view}:data`;
let failed = 0, wrote = 0;

for (const [n, r] of planned.entries()) {
  const pos = `${String(n + 1).padStart(4)}/${planned.length}`;
  try {
    let id = r.existingId;
    if (r.op === 'insert') {
      const c = dms(['raw', 'create', APP, DATA_TYPE, '--format', 'json']);
      id = String(c.id || '');
      if (!id) throw new Error(`create returned no id`);
      // `row` is the planned index, so read-back can match by position rather than by name.
      // Matching on the tag would collide wherever two rows share a name -- and they do:
      // Village of Hempstead has eight near-identically-named fire-house generator projects.
      created.push({ row: n, id, geoid: r.geoid, tag: r.tag });
      fs.writeFileSync(createdPath, JSON.stringify(created, null, 1));  // BEFORE the fill
    }
    const f = path.join(tmpDir, `row_${id}.json`);
    fs.writeFileSync(f, JSON.stringify(r.data));
    const u = dms(['dataset', 'update', DS.source, id, '--view', DS.view,
      '--data', f, '--format', 'json']);
    if (!u.ok) throw new Error('dataset update returned ok=false');
    wrote++;
    say(`  ${pos} ${r.op.toUpperCase().padEnd(6)} ${String(id).padEnd(9)} ${r.tag}`);
  } catch (e) {
    if (e instanceof NoAccess) {
      say(`\nSTOPPING at ${pos}: the server returned no-access.`);
      say(`  The token has almost certainly expired (~6h). Re-mint and re-run; rows already`);
      say(`  written are in log.txt and any created ids are in created.json.`);
      failed++;
      break;
    }
    failed++;
    say(`  ${pos} FAILED  ${r.tag} — ${String(e.message).slice(0, 160)}`);
  }
}
say(`\nwrote ${wrote}/${planned.length}; ${failed} failure(s)`);
if (created.length) say(`created ids -> ${path.relative(CTX, createdPath)}`);

// ---------------------------------------------------------------------------- read back
say(`\nread-back verification`);
let diffs = 0, missing = 0;
const attempted = planned.slice(0, wrote + failed);
for (const [n, r] of attempted.entries()) {
  const id = r.op === 'insert'
    ? (created.find(c => c.row === n) || {}).id
    : r.existingId;
  if (!id) { missing++; continue; }
  let got;
  try {
    const q = dms(['dataset', 'query', DS.source, '--view', DS.view,
      '--filter', `id=${id}`, '--limit', '2', '--format', 'json']);
    got = (q.items || []).find(x => String(x.id) === String(id))?.data;
  } catch { /* fall through to missing */ }
  if (!got) { missing++; say(`  MISSING  ${id} ${r.tag}`); continue; }
  for (const [k, v] of Object.entries(r.data)) {
    if (norm(got[k]) !== norm(v)) {
      diffs++;
      say(`  DIFF ${id} ${k}\n       sent: ${norm(v).slice(0, 120)}\n       got : ${norm(got[k]).slice(0, 120)}`);
    }
  }
}
say(diffs || missing
  ? `  ${diffs} field diff(s), ${missing} row(s) not found`
  : `  all ${attempted.length} row(s) verified field-for-field`);

fs.writeFileSync(path.join(runDir, 'result.json'), JSON.stringify({
  dataset: which, target, source: DS.source, view: DS.view, backup: bakLabel,
  planned: planned.length, inserts: nIns, updates: nUpd,
  wrote, failed, diffs, missing, created: created.length,
}, null, 1));
flush();
say(`\n-> ${path.relative(CTX, runDir)}`);
process.exit(failed || diffs || missing ? 1 : 0);
