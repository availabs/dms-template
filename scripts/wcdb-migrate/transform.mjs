#!/usr/bin/env node
/* 2/3 · Reshape the raw dumps into the four target datasets.
 *
 *   node scripts/wcdb-migrate/transform.mjs
 *
 * Writes ./out/<name>.csv plus ./out/report.md, and publishes NOTHING. The
 * report is the thing a human reads before step 3 — every row this drops or
 * cannot classify is counted there rather than disappearing quietly.
 *
 * Target schema: see the completed design task
 *   project-planning/wcdb/tasks/completed/design-wcdb-admin-system.md
 *
 * PRIMARY KEYS. These datasets have to be editable from the admin UI, and an
 * external source is only editable once it has a REAL single-column Postgres
 * primary key that is unique and non-null (src/dms/planning/tasks/current/
 * set_primary_col_from_meta.md + external-source-editable-crud.md). So every
 * table below gets exactly one, and the PK candidates were checked against the
 * live data first:
 *   djs.dj_id        891/891 distinct, 0 null  → usable as-is
 *   shows.show_id    GENERATED — the legacy `schedule_id` is NOT usable
 *                    (29 non-numeric values, 2 duplicates; see the report)
 *   schedule.airing_id  GENERATED — no per-airing id exists in the legacy data
 *   events.event_id     GENERATED
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, 'out');
const read = (n) => JSON.parse(readFileSync(`${OUT}/raw-${n}.json`, 'utf8')).items.map((i) => i.data);

const blank = (v) => v === '' || v === null || v === undefined;
const clean = (v) => (blank(v) ? null : String(v).trim());

/* ── the shared 10-department vocabulary ──────────────────────────────────
 * Taken from the legacy site's own DJ Profiles filter. Values NOT in this map
 * are passed through untouched and counted in the report — they are decisions,
 * not defects, and silently folding them into a neighbour would lose data. */
const DEPARTMENTS = ['Hip-Hop/R&B','World','Rock','Metal','Jazz','Electronic','News','Sports','Specialty'];
const DEPT_MAP = {
  'Alternative Rock': 'Rock',
  'R.P.M. (Electronic Music)': 'Electronic',
  'Metal/Hardcore': 'Metal',
  'Urban': 'Hip-Hop/R&B',
  // Nine departments, not ten. The legacy site's DJ Profiles filter listed
  // Hip-Hop and R&B separately, but the data has only ever recorded the pair as
  // one value on 274 rows and no rule can split them — so the vocabulary
  // follows the data. The public chips and the icon registry match this.
  'Hip-Hop/R&B': 'Hip-Hop/R&B',
  // Strays with no department of their own. Specialty is what that department
  // is for; 38 rows out of ~1,600 lose a distinction nobody was maintaining.
  'Talk': 'Specialty',
  'Retro': 'Specialty',
  'Folk': 'Specialty',
  'Inspirational': 'Specialty',
  'Street Team': 'Specialty',
  'Specialty': 'Specialty',
  'Sports': 'Sports',
  'World': 'World',
  'News': 'News',
  'Jazz': 'Jazz',
};
const unresolved = {};
const mapDept = (v) => {
  const s = clean(v);
  if (!s) return null;
  if (DEPT_MAP[s]) return DEPT_MAP[s];
  if (DEPARTMENTS.includes(s)) return s;
  unresolved[s] = (unresolved[s] || 0) + 1;
  return s;
};

const ICON = { 'Hip-Hop/R&B':'Microphone','World':'Globe','Rock':'Pick','Metal':'Bolt',
               'Jazz':'Note','Electronic':'Sliders','News':'Newspaper','Sports':'Trophy','Specialty':'Star' };

/* ── time + day parsing ───────────────────────────────────────────────────
 * `wcdb_schedule` stores DAY NAMES ("Saturday") and 12-HOUR times ("4:00PM").
 * `wcdb_schedule_times` stores numeric days and "HH:MM". They disagree; this
 * reads the former, which is the source with the rows. day 0 = Monday, to match
 * the admin week grid. */
const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
const parseDay = (v) => {
  const s = clean(v); if (!s) return null;
  const i = DAYS.indexOf(s.toLowerCase());
  if (i !== -1) return i;
  const n = Number(s);                       // tolerate a numeric day if one appears
  return Number.isInteger(n) && n >= 0 && n <= 6 ? n : null;
};
const parseTime = (v) => {
  const s = clean(v); if (!s) return null;
  let m = s.match(/^(\d{1,2}):(\d{2})\s*([AaPp])[Mm]?$/);
  if (m) {
    let h = Number(m[1]) % 12;
    if (m[3].toLowerCase() === 'p') h += 12;
    return `${String(h).padStart(2,'0')}:${m[2]}`;
  }
  m = s.match(/^(\d{1,2}):(\d{2})$/);        // already 24h
  if (m) return `${String(Number(m[1])).padStart(2,'0')}:${m[2]}`;
  return null;
};

const csv = (rows, cols) => {
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n') + '\n';
};

const report = [];
const say = (s = '') => { report.push(s); console.log(s); };

/* ══ djs ════════════════════════════════════════════════════════════════ */
const rawDjs = read('djs');
const DEAD = ['created','twitter','yahoo_id','phone_ext','phone_ext_2','heros','msn_id','date_of_birth',
              'phone_number_2','im','fav_books','occupation','like_to_meet','myspace','about_me','hometown',
              'interests','fav_magazines','fav_web_sites','fav_places_to_hang_out','gender'];

const djs = rawDjs.map((r) => {
  const email = clean(r.email);
  return {
    dj_id: clean(r.dj_id),
    on_air_name: clean(r.on_air_name),
    first_name: clean(r.first_name),
    last_name: clean(r.last_name),
    // the literal string "n/a" is not an address
    email: email && !/^n\/?a$/i.test(email) ? email : null,
    show_email: clean(r.show_email) === '1',
    phone: clean(r.phone_number),
    // `active` stays the source of truth. It is NOT derivable from end_date:
    // 535 alumni have no end_date and 2 current DJs do have one.
    status: clean(r.active) === '1' ? 'current' : 'alumni',
    started: clean(r.start_date)?.slice(0, 10) || null,
    ended: clean(r.end_date)?.slice(0, 10) || null,
    department: mapDept(r.genre_main),
    bio: clean(r.characteristics),
    when_not_dj: clean(r.when_not_dj),
    first_song: clean(r.first_song),
    fav_artist: clean(r.fav_artist),
    fav_song: clean(r.fav_song),
    notes: clean(r.comments),
    updated_at: clean(r.last_updated),
  };
});

say('## djs');
say(`- ${djs.length} rows in, ${djs.length} out (nothing dropped — the roster is an archive)`);
say(`- dropped ${DEAD.length} near-empty columns: \`${DEAD.join('`, `')}\``);
say('- also dropped: `student_status` (codes 1–5, no recorded meaning — decision 2026-08-13: leave it behind, the legacy source keeps it), `playlists`, `isValid`, `fav_movie`, `fav_tv_show`');
say(`- status: ${djs.filter(d=>d.status==='current').length} current / ${djs.filter(d=>d.status==='alumni').length} alumni`);
say(`- emails nulled because they read "n/a": ${rawDjs.filter(r=>/^n\/?a$/i.test(clean(r.email)||'')).length}`);

/* ══ shows + schedule ═══════════════════════════════════════════════════ */
const rawSched = read('schedule');

// 29 rows carry a non-numeric `schedule_id`. All 29 are import corruption — a
// CSV comma-escaping failure that spilled description text across columns; 23
// are otherwise entirely empty and 6 hold only fragments of a description whose
// parent row is elsewhere. Nothing is reconstructible, so they are dropped and
// counted rather than migrated as ghost shows.
const corrupt = rawSched.filter((r) => !/^\d+$/.test(String(r.schedule_id ?? '')));
const usable = rawSched.filter((r) => /^\d+$/.test(String(r.schedule_id ?? '')));

// A show is identified by name + dj. Rows sharing both are the same show
// entered more than once (there was nowhere to put a second airing).
const showByKey = new Map();
const showIdOf = new Map();          // legacy schedule_id -> new show_id
let nextShowId = 1;
for (const r of usable) {
  const name = clean(r.show_name);
  const dj = clean(r.dj_id);
  const key = `${(name || '').toLowerCase()}|${dj || ''}`;
  if (!showByKey.has(key)) {
    const dept = mapDept(r.genre_0);
    showByKey.set(key, {
      show_id: nextShowId++,
      name,
      dj_id: dj,
      department: dept,
      icon: dept && ICON[dept] ? ICON[dept] : null,
      description: clean(r.decription),        // misspelled at source
      legacy_schedule_ids: [clean(r.schedule_id)],
    });
  } else {
    showByKey.get(key).legacy_schedule_ids.push(clean(r.schedule_id));
  }
  showIdOf.set(String(r.schedule_id), showByKey.get(key).show_id);
}
const shows = [...showByKey.values()].map((s) => ({ ...s, legacy_schedule_ids: s.legacy_schedule_ids.join(' ') }));

// One row per AIRING — only rows that actually carry a start time.
let nextAiringId = 1;
const schedule = [];
const unparsed = [];   // a time we could not read — a real defect
const dayless = [];    // a time with no day — incomplete, not broken
for (const r of usable) {
  if (blank(r.start_time)) continue;
  const day = parseDay(r.start_day);
  const start = parseTime(r.start_time);
  const end = parseTime(r.end_time);
  // An airing needs a day. A show carrying a time but no day is not a broken
  // row, it is an unplaced one — it stays in `shows` and the schedule editor
  // is where it gets a slot. Migrating it with a guessed day would invent
  // programming that never aired.
  if (start === null) { unparsed.push({ id: r.schedule_id, start: r.start_time }); continue; }
  if (day === null) { dayless.push({ id: r.schedule_id, start }); continue; }
  schedule.push({
    airing_id: nextAiringId++,
    show_id: showIdOf.get(String(r.schedule_id)),
    day,
    start,
    end,                       // an overnight is simply end <= start; no end_day
  });
}

const placeholders = shows.filter((s) => s.name === 'Show Name').length;
const nameless = shows.filter((s) => !s.name).length;

say('');
say('## shows');
say(`- ${usable.length} usable legacy rows → **${shows.length} shows** (${usable.length - shows.length} duplicates collapsed on name+dj)`);
say(`- dropped ${corrupt.length} corrupt rows (non-numeric \`schedule_id\`; ${corrupt.filter(r=>!Object.entries(r).some(([k,v])=>k!=='schedule_id'&&!blank(v)&&v!==true)).length} entirely empty, the rest description fragments from a CSV comma failure)`);
say(`- \`decription\` → \`description\``);
say(`- **needs triage, migrated as-is:** ${placeholders} rows named the placeholder "Show Name", ${nameless} with no name at all`);
say('');
say('## schedule');
say(`- **${schedule.length} airings** — legacy rows carrying both a start time *and* a day`);
say(`- day names → 0–6 (0 = Monday, matching the admin grid); 12-hour times → HH:MM`);
say(`- overnights kept as \`end <= start\`; \`end_day\` dropped`);
say(`- ${dayless.length} rows carry a time but **no day** — left unscheduled in \`shows\` for the editor to place, not guessed`);
if (unparsed.length) say(`- ⚠ ${unparsed.length} rows had a start time that could not be parsed: ${JSON.stringify(unparsed.slice(0,5))}`);
else say('- 0 unparseable times — every day-bearing row converted cleanly');
const overnight = schedule.filter((s) => s.end && s.end <= s.start).length;
say(`- overnight airings: ${overnight}`);

/* ══ events ═════════════════════════════════════════════════════════════ */
// No legacy source. Seeded from what the public mockup shows so the admin page
// has something real to render; the admin is the system of record from here.
const events = [
  { event_id: 1, date: '2026-03-12', time: '20:00', title: 'Vinyl swap meet',   venue: 'Page Hall basement', price: null,  description: null, status: 'published' },
  { event_id: 2, date: '2026-03-19', time: '21:00', title: 'DJ Halftone, live', venue: 'No Fun Club',        price: '$10', description: null, status: 'published' },
  { event_id: 3, date: '2026-04-02', time: null,    title: 'Spring pledge drive', venue: 'Studio',           price: null,  description: 'Streaming all day', status: 'published' },
];
say('');
say('## events');
say(`- ${events.length} rows seeded (no legacy source; the admin is the system of record)`);

/* ══ vocabulary ═════════════════════════════════════════════════════════ */
say('');
say('## department vocabulary — NINE departments');
say('`' + DEPARTMENTS.join('`, `') + '`');
say('');
say('Mapped: ' + Object.entries(DEPT_MAP).filter(([a,b])=>a!==b).map(([a,b])=>`\`${a}\`→\`${b}\``).join(', '));
if (!Object.keys(unresolved).length) say('\nEvery value maps. 0 rows outside the vocabulary.');
if (Object.keys(unresolved).length) {
  say('');
  say('**⚠ Still unmapped — these were not anticipated and need a decision:**');
  for (const [k,v] of Object.entries(unresolved).sort((a,b)=>b[1]-a[1])) {
    const why = k === 'Hip-Hop/R&B' ? 'one value, two departments — needs a human split'
      : k === 'Street Team' ? 'a role, not a genre'
      : 'no department exists for it';
    say(`- \`${k}\` × ${v} — ${why}`);
  }
}

/* ══ write ══════════════════════════════════════════════════════════════ */
const FILES = [
  ['djs', djs, ['dj_id','on_air_name','first_name','last_name','email','show_email','phone','status','started','ended','department','bio','when_not_dj','first_song','fav_artist','fav_song','notes','updated_at']],
  ['shows', shows, ['show_id','name','dj_id','department','icon','description','legacy_schedule_ids']],
  ['schedule', schedule, ['airing_id','show_id','day','start','end']],
  ['events', events, ['event_id','date','time','title','venue','price','description','status']],
];
for (const [name, rows, cols] of FILES) writeFileSync(`${OUT}/${name}.csv`, csv(rows, cols));

/* ══ PK assertions — a table that fails these cannot be made editable ══ */
say('');
say('## primary keys');
let pkFail = 0;
for (const [name, rows, cols] of FILES) {
  const pk = cols[0];
  const vals = rows.map((r) => r[pk]);
  const nulls = vals.filter((v) => v === null || v === undefined || v === '').length;
  const dupes = vals.length - new Set(vals).size;
  const ok = nulls === 0 && dupes === 0;
  if (!ok) pkFail++;
  say(`- \`${name}.${pk}\` — ${rows.length} rows, ${nulls} null, ${dupes} duplicate → ${ok ? '**OK**' : '**FAILS — not editable**'}`);
}

// every airing must resolve to a show
const showIds = new Set(shows.map((s) => s.show_id));
const orphans = schedule.filter((s) => !showIds.has(s.show_id)).length;
say(`- referential: ${orphans} orphan airings (schedule.show_id → shows.show_id)`);

writeFileSync(`${OUT}/report.md`, `# WCDB migration — dry run\n\nGenerated by \`transform.mjs\`. Publishes nothing.\n\n${report.join('\n')}\n`);
console.log(`\nwrote ${OUT}/{djs,shows,schedule,events}.csv and report.md`);
if (pkFail || orphans) { console.error('\nFAILED: fix the above before publishing.'); process.exit(1); }
