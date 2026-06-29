#!/usr/bin/env node
/**
 * mint-token.mjs — mint a fresh DMS session token HEADLESSLY and write the
 * Playwright storageState file that card-shot.mjs / diag scripts pass via
 * --storage. No browser, no manual login — just the dev credentials.
 *
 * The app stores its JWT in localStorage under `userToken` (see
 * patterns/auth/pages/authLogin.jsx). The login route is a plain POST on the
 * API host: `POST {API_HOST}/login {email, password, project}` → {user:{token}}.
 * This script calls it and writes a storageState seeding that one localStorage
 * key for the dev-server origin. Tokens expire ~6h; re-run when shots start
 * landing on /auth/login.
 *
 * USAGE
 *   node scripts/mint-token.mjs \
 *     --host http://localhost:3001 \
 *     --email availabs@gmail.com --password test123 \
 *     --project npmrdsv5 \
 *     --origin http://npmrds.localhost:5173 \
 *     --out scratchpad/npmrdsv5-dev2/auth.json
 *
 * Defaults match the npmrdsv5 dev2 site. Credentials are dev-only.
 */
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(`--${n}`); return i === -1 ? d : args[i + 1]; };

const host    = flag("host", "http://localhost:3001");
const email   = flag("email", "availabs@gmail.com");
const password= flag("password", "test123");
const project = flag("project", "npmrdsv5");
const origin  = flag("origin", "http://npmrds.localhost:5173");
const out     = flag("out", "scratchpad/npmrdsv5-dev2/auth.json");

const res = await fetch(`${host}/login`, {
  method: "POST",
  headers: { "Content-type": "application/json", Accept: "application/json" },
  body: JSON.stringify({ email, password, project }),
});
if (!res.ok) { console.error(`login failed: HTTP ${res.status}`); process.exit(1); }
const json = await res.json();
const token = json?.user?.token;
if (!token) { console.error("no token in response:", JSON.stringify(json).slice(0, 300)); process.exit(1); }

const state = { cookies: [], origins: [{ origin, localStorage: [{ name: "userToken", value: token }] }] };
await mkdir(path.dirname(out), { recursive: true });
await writeFile(out, JSON.stringify(state, null, 2));

const exp = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString()).exp;
console.log(`✓ ${out} — token for ${email}@${project}, expires ${new Date(exp * 1000).toISOString()}`);
