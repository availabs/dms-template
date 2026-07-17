// attach_screenshot.mjs — upload a screenshot to DMS and link it to a ticket's `screenshot` column.
// Part of the agent QA process (qa_skills/qa-fix-ticket.md step 3, qa-assess-page.md): when a fix
// is verified (or a finding is filed), attach the proof screenshot so the reporter can see it on
// the ticket detail page.
//
//   DMS_AUTH_TOKEN=… node src/themes/transportny/qa_skills/tools/attach_screenshot.mjs \
//     --ticket <row_id> --image <path.png> [--caption "..."] [--source-name "QA ticket screenshots"] [--source-id <id>]
//
// Uploads via POST /dms-admin/<app>/file_upload (server converts to .avif, returns a public dl_url),
// appending to a single reusable source (resolved by --source-id or --source-name, else created on
// first use). Then sets the ticket's `screenshot` column to the dl_url via the split-type edit.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { createFalcorClient } from "../../../../dms/packages/dms/cli/src/client.js";

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = opt("app", process.env.DMS_APP || "npmrdsv5");
const HOST = process.env.DMS_HOST || "http://localhost:3001";
const TOKEN = process.env.DMS_AUTH_TOKEN;
const TICKET = opt("ticket");
const IMAGE = opt("image");
const CAPTION = opt("caption", "");
const SOURCE_NAME = opt("source-name", "QA ticket screenshots");
// datasets_env owner (npmrdsv5 dev2) — see src/dms/skills/uploading-download-files.md
const OWNER_ID = opt("owner-id", process.env.QA_UPLOAD_OWNER_ID || "1676363");
const OWNER_INSTANCE = opt("owner-instance", "datasets_env");
const TICKETS_DT = opt("tickets-dt", "sitemgmt_tickets|2184924:data");
if (!TOKEN) { console.error("set DMS_AUTH_TOKEN"); process.exit(1); }
if (!TICKET || !IMAGE) { console.error("usage: --ticket <row_id> --image <path> [--caption ...]"); process.exit(1); }

const ENV = { ...process.env, DMS_HOST: HOST, DMS_APP: APP, DMS_TYPE: process.env.DMS_TYPE || "dev2" };
const cli = (...a) => execFileSync("node", ["src/dms/packages/dms/cli/bin/dms.js", ...a], { env: ENV, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const clean = (s) => s.split("\n").filter((l) => l.trim().startsWith("{")).pop();

// resolve-or-create the shared screenshots source
let sourceId = opt("source-id");
if (!sourceId) {
  const list = JSON.parse(clean(cli("dataset", "list")));
  const hit = (list.items || []).find((s) => (s.data?.name || "") === SOURCE_NAME);
  if (hit?.id) sourceId = String(hit.id);
}

const form = new FormData();
form.append("owner_id", OWNER_ID);
form.append("owner_instance", OWNER_INSTANCE);
form.append("owner_ref", `${APP}+${OWNER_INSTANCE}|source`);
if (sourceId) form.append("source_id", sourceId); else form.append("source_name", SOURCE_NAME);
form.append("file_name", basename(IMAGE));
form.append("file_type", "image/png");
form.append("description", CAPTION || `QA screenshot for ticket ${TICKET}`);
form.append("file", new Blob([readFileSync(IMAGE)]), basename(IMAGE));

const res = await fetch(`${HOST}/dms-admin/${APP}/file_upload`, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}` }, body: form });
const j = await res.json();
if (!j?.dl_url) { console.error("upload failed:", JSON.stringify(j).slice(0, 300)); process.exit(1); }
console.log(`uploaded → source ${j.source_id} view ${j.view_id}\n${j.dl_url}`);

const fc = createFalcorClient(HOST, TOKEN);
await fc.call(["dms", "data", "edit"], [APP, +TICKET, { screenshot: j.dl_url, updated: new Date().toISOString().slice(0, 10) }, TICKETS_DT]);
console.log(`linked to ticket ${TICKET} (screenshot column)`);
