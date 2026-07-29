// STATIC fidelity check: does a regenerated build script's SECTIONS payload match the LIVE draft
// sections byte-for-byte (server-managed keys aside)? If yes, running it is provably content-neutral
// — the check that was missing when a stale script regressed workzones_v2 (2026-07-15/16) and again
// when it silently reverted an incidents_v2 graph fix (2026-07-27).
//
//   node src/themes/transportny/qa_skills/tools/builds/fidelity_static.mjs <script.mjs> <pageId>
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const SP = "/tmp/claude-1000/-home-alex-code-avail/b110b204-c942-45b7-abc1-21a2d9933483/scratchpad";
const ENV = { ...process.env, DMS_HOST: process.env.DMS_HOST || "http://localhost:3001",
  DMS_APP: "npmrdsv5", DMS_TYPE: "dev2" };
const cli = (...a) => execFileSync("node", ["src/dms/packages/dms/cli/bin/dms.js", ...a],
  { env: ENV, encoding: "utf8", maxBuffer: 128 * 1024 * 1024 });
const clean = (s) => s.split("\n").filter(l => l.trim().startsWith("{") || l.trim().startsWith("[")).pop();

// pull the SECTIONS literal out of the generated script (it is emitted as pure JSON)
const SCRIPT = process.argv[2];
if (!SCRIPT) { console.error("usage: fidelity_static.mjs <script.mjs> <pageId>"); process.exit(2); }
const src = readFileSync(SCRIPT, "utf8");
const start = src.indexOf("const SECTIONS = ");
const open = src.indexOf("[", start);
let depth = 0, end = -1;
for (let i = open; i < src.length; i++) {
  if (src[i] === "[") depth++;
  else if (src[i] === "]") { depth--; if (!depth) { end = i + 1; break; } }
}
const exported = JSON.parse(src.slice(open, end));
console.log(`exported sections in script: ${exported.length}`);

// live draft sections, in order
const PAGE_ID = process.argv[3];
if (!PAGE_ID) { console.error("usage: fidelity_static.mjs <script.mjs> <pageId>"); process.exit(2); }
const page = JSON.parse(clean(cli("page", "dump", String(PAGE_ID))));
let refs = page.data.draft_sections;
if (typeof refs === "string") refs = JSON.parse(refs);
const liveIds = refs.map(r => String(r.id));
console.log(`live draft sections:        ${liveIds.length}`);

// Keys the server/editor add, never authored in a builder.
const SERVER = new Set(["id", "createdAt", "updatedAt", "created_at", "updated_at", "type"]);

// EDITOR NOISE. Opening a build-owned page in /edit re-saves the sections it renders, and the
// editor writes three harmless variations the builder never contains. Normalising them keeps this
// check trustworthy — a guard that false-alarms on every page someone has viewed gets muted, and
// then the real drift (a reverted fix) sails through.
//   1. `"value": []` on an unset page-variable leaf comes back as `"value": [""]`. Behaviourally
//      identical: buildUdaConfig drops filter/exclude leaves whose values are all empty strings
//      (otherwise they would compile to `IN ('')` and blank the section).
//   2. an empty `join: {"sources": {}}` is added.
//   3. `element-data` is re-serialized compactly (whitespace only — column catalogs stay intact).
// (3) is inherent to comparing parsed objects. (1) and (2) are normalised here.
const denoise = (o) => {
    if (Array.isArray(o)) return o.map(denoise);
    if (o && typeof o === "object") {
        const out = {};
        for (const [k, v] of Object.entries(o)) {
            if (k === "join" && v && typeof v === "object" && !Object.keys(v.sources || {}).length
                && Object.keys(v).length <= 1) continue;
            if (k === "value" && Array.isArray(v) && v.length && v.every(x => x === "")) { out[k] = []; continue; }
            out[k] = denoise(v);
        }
        return out;
    }
    return o;
};

const strip = (o) => {
  if (Array.isArray(o)) return o.map(strip);
  if (o && typeof o === "object") {
    const out = {};
    for (const k of Object.keys(o).sort()) if (!SERVER.has(k)) out[k] = strip(o[k]);
    return out;
  }
  return o;
};

let mismatched = 0;
for (let i = 0; i < Math.max(exported.length, liveIds.length); i++) {
  const sid = liveIds[i];
  if (!sid) { console.log(`  [${i}] exported has no live counterpart`); mismatched++; continue; }
  if (!exported[i]) { console.log(`  [${i}] live section ${sid} missing from export`); mismatched++; continue; }
  const live = JSON.parse(clean(cli("raw", "get", sid))).data;
  const a = JSON.stringify(denoise(strip(exported[i])));
  const b = JSON.stringify(denoise(strip(live)));
  if (a !== b) {
    mismatched++;
    console.log(`  [${i}] MISMATCH vs live section ${sid} (export ${a.length}b vs live ${b.length}b)`);
    const ka = Object.keys(denoise(strip(exported[i]))), kb = Object.keys(denoise(strip(live)));
    console.log(`        export keys: ${ka.join(",")}`);
    console.log(`        live   keys: ${kb.join(",")}`);
    for (const k of new Set([...ka, ...kb])) {
      const va = JSON.stringify(denoise(strip(exported[i]))[k]), vb = JSON.stringify(denoise(strip(live))[k]);
      if (va !== vb) console.log(`        ≠ ${k}: export ${String(va).slice(0,80)} | live ${String(vb).slice(0,80)}`);
    }
  }
}
console.log(mismatched === 0
  ? `\nFIDELITY OK — all ${liveIds.length} sections identical to live; running the script is content-neutral.`
  : `\nFIDELITY FAILED — ${mismatched} section(s) differ. DO NOT RUN.`);
process.exit(mismatched === 0 ? 0 : 1);
