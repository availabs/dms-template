// build_docs_pattern.mjs — OWNING build for the whole `platform_docs` pattern (2218952, */docs2).
//
// Source of truth for the page tree: `_docs-nav.js`'s DOCS_TREE in
//   src/themes/transportny/TransportNY Design System/dms_design_system_v2/pages/docs/
// Source of truth for each page's CONTENT: that page's own `<main>` in the same folder.
// This script transcribes the static docs mockups into DMS lexical sections. It is the only
// owner of these pages: edit the HTML (or this script's transcription rules) and re-run.
//
// Idempotent: find-or-create page by slug within THIS pattern, wipe the draft by PAGE ID
// (loud — every failed delete is reported and makes the run exit non-zero), recreate in order.
// DRAFT-ONLY: never publishes, never writes `sections`/`section_groups`, never touches the
// legacy `npmrds_docs` pattern (1411813, */docs).
//
// Usage (from the dms-template root):
//   DMS_AUTH_TOKEN=$(node src/dms/packages/dms/cli/bin/mint-token.mjs \
//     --host https://dmsserver.availabs.org --project npmrdsv5 \
//     --email <dev account email> --password <dev account password>   # dev creds: see the QA notes, never commit them) \
//   node src/themes/transportny/qa_skills/tools/builds/build_docs_pattern.mjs --all
//
//   --dry-run            print the plan (pages, slugs, parents, per-page section counts) and exit
//   --only <slug>        build one page by its DMS slug (e.g. npmrds/macro_view/download)
//   --hub <key>          build one hub and its pages (start|npmrds|tsmo|freight_atlas|
//                        measures_and_data|developers|admin|utilities|home)
//   --all                build every page in DOCS_TREE
//   --fidelity <path>    also write the per-page fidelity report (section counts + text
//                        similarity of the built lexical vs the source <main>)
//   --verify             read-only: pull every selected page back and re-score fidelity without
//                        writing anything (use after a change to the scoring rules)
//   STRICT_COUNTS=1      refuse to wipe a page whose live draft section count differs from
//                        the plan (drift guard; off by default because the HTML *is* the source
//                        and a legitimate content edit changes the count)
//
// ── the cutover constant ───────────────────────────────────────────────────────────────────
// Every internal link is rewritten to `${BASE_URL}/<slug>`. CUTOVER DONE 2026-09-09 (Phase 9b):
// the pattern's base_url is `/docs` (the old `npmrds_docs` pattern was moved aside to
// `/docs_legacy`), so BASE_URL is `/docs` and every built link is a final address. If the mount
// ever moves again, change BASE_URL here and the pattern's base_url, then re-run: one edit.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve, basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "../../../../../..");                      // dms-template root
const DOCS_DIR = resolve(HERE, "../../../TransportNY Design System/dms_design_system_v2/pages/docs");
const ASSETS_ROOT = resolve(DOCS_DIR, "../..");                        // dms_design_system_v2/
const IMAGE_CACHE = join(HERE, "build_docs_images.json");

const PATTERN = "platform_docs";
const PATTERN_ID = "2218952";
const BASE_URL = "/docs";         // ← the one-edit cutover constant (see header); cut over 2026-09-09
const ROOT_SLUG = "home";         // index.html → the pattern's root page (index 0, no parent)
const SECTION_SIZE = "12";        // full content column. Measured in /edit at 1440: the body
// band pays the 302px "on this page" rail, so its content column is ~688px — close to the
// mockup's 820px. Size 9 measured 516px, well under the design's measure.
const HEADER_SIZE = "8";          // the header band carries no rail, so its column is ~1048px;
// 8/12 of it (~690px) lines the title/lede up with the body column instead of overhanging it.

// Image upload (DMS file_upload route; see InlineImageComponent.tsx for the field set).
// dms-template AND transportNY both pass DAMA_HOST = API_HOST = dmsserver.availabs.org, so the
// upload goes there; the returned URL is absolute (S3) and host-independent.
const UPLOAD_HOST = process.env.DOCS_UPLOAD_HOST || "https://dmsserver.availabs.org";
const UPLOAD_PGENV = "npmrds2";
const UPLOAD_DIR = "img/npmrdsv5+dev2/platform_docs";
const UPLOAD_SOURCE_NAME = "npmrdsv5+dev2|platform_docs";
const UPLOAD_SOURCE_ID = "2184";  // created by the first upload; reused so only ONE dama source exists

const ENV = {
  ...process.env,
  NODE_NO_WARNINGS: "1",
  DMS_HOST: process.env.DMS_HOST || "https://dmsserver.availabs.org",
  DMS_APP: process.env.DMS_APP || "npmrdsv5",
  DMS_TYPE: process.env.DMS_TYPE || "dev2",
};
const CLI = existsSync(join(REPO, "src/dms/packages/dms/cli/bin/dms.js"))
  ? join(REPO, "src/dms/packages/dms/cli/bin/dms.js")
  : "src/dms/packages/dms/cli/bin/dms.js";

// A full --all run makes ~1,400 CLI calls over ~20 minutes, and dmsserver returns the odd
// transient nginx 502 / 504 / "socket hang up". One of those killed the 2026-09-09 cutover run
// 32 pages in, so retry a transient failure a few times with a backoff before giving up; a real
// error (a 4xx, a refusal, bad JSON) has none of those markers and still fails immediately.
const TRANSIENT = /50[0234] Bad Gateway|50[0234] Gateway|502|503|504|socket hang up|ECONNRESET|ETIMEDOUT|EAI_AGAIN/i;
const sleep = (ms) => { const t = Date.now(); while (Date.now() - t < ms); };
const cli = (...a) => {
  let last;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return execFileSync("node", [CLI, ...a], { env: ENV, encoding: "utf8", maxBuffer: 128 * 1024 * 1024 });
    } catch (e) {
      last = e;
      const msg = String(e.stderr || "") + String(e.message || "");
      if (!TRANSIENT.test(msg)) throw e;
      const wait = 2000 * (attempt + 1);
      console.log(`  transient CLI failure (attempt ${attempt + 1}/5), retrying in ${wait}ms: ${msg.split("\n")[0].slice(0, 120)}`);
      sleep(wait);
    }
  }
  throw last;
};
const clean = (s) =>
  s.split("\n").filter((l) => l.trim().startsWith("{") || l.trim().startsWith("[")).pop();
const cliJSON = (...a) => JSON.parse(clean(cli(...a)));

const WARN = [];
const warn = (m) => { if (!WARN.includes(m)) WARN.push(m); };

// ═══════════════════════════════════════════════════════════════════════════════════════════
// 1. A tolerant HTML parser (no DOM in node)
// ═══════════════════════════════════════════════════════════════════════════════════════════
// Only tags in KNOWN are treated as markup. Anything else — notably the literal "<month>" a
// glossary entry writes unescaped — falls through as TEXT, which is what the author meant.
const KNOWN = new Set([
  "html", "head", "body", "main", "header", "footer", "section", "article", "aside", "nav",
  "div", "p", "span", "a", "code", "pre", "ol", "ul", "li", "dl", "dt", "dd",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption",
  "h1", "h2", "h3", "h4", "h5", "h6", "figure", "figcaption", "img", "em", "i", "strong", "b",
  "small", "button", "br", "hr", "sup", "sub", "kbd", "mark", "blockquote", "script", "style",
  "link", "meta", "title", "label", "input", "svg", "path", "abbr", "time", "u", "s",
]);
const VOID = new Set(["img", "br", "hr", "input", "meta", "link", "source"]);

const NAMED = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", middot: "·", mdash: "—",
  ndash: "–", bull: "•", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", rarr: "→", larr: "←",
  sect: "§", plusmn: "±", times: "×", minus: "−", ge: "≥", le: "≤", copy: "©", deg: "°",
  hellip: "…", ne: "≠", divide: "÷", sup2: "²", frac12: "½", trade: "™", reg: "®",
};
function decodeEntities(s) {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (m, e) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return NAMED[e] !== undefined ? NAMED[e] : m;
  });
}

function parseAttrs(s) {
  const out = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m;
  while ((m = re.exec(s))) out[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? "");
  return out;
}

/** Parse an HTML string into a tree of {tag, attrs, children} / {text}. */
function parseHTML(html) {
  const root = { tag: "#root", attrs: {}, children: [] };
  const stack = [root];
  const tokre = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<!doctype[^>]*>|<\/([a-zA-Z][a-zA-Z0-9]*)\s*>|<([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/gi;
  let last = 0, m;
  const pushText = (raw) => {
    if (!raw) return;
    stack[stack.length - 1].children.push({ text: decodeEntities(raw) });
  };
  while ((m = tokre.exec(html))) {
    const [tok, closeTag, openTag, attrStr, selfClose] = m;
    if (tok.startsWith("<!--") || tok.startsWith("<![") || /^<!doctype/i.test(tok)) {
      pushText(html.slice(last, m.index)); last = tokre.lastIndex; continue;
    }
    const name = (closeTag || openTag || "").toLowerCase();
    if (!KNOWN.has(name)) continue;                       // leave the literal text in place
    pushText(html.slice(last, m.index));
    last = tokre.lastIndex;
    if (closeTag) {
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tag === name) { stack.length = i; break; }
      }
    } else {
      const node = { tag: name, attrs: parseAttrs(attrStr || ""), children: [] };
      stack[stack.length - 1].children.push(node);
      if (name === "script" || name === "style") {
        // swallow raw text content
        const end = html.toLowerCase().indexOf(`</${name}>`, last);
        last = end < 0 ? html.length : end + name.length + 3;
        tokre.lastIndex = last;
        continue;
      }
      if (!VOID.has(name) && !selfClose) stack.push(node);
    }
  }
  pushText(html.slice(last));
  return root;
}

const cls = (n) => (n.attrs?.class || "").split(/\s+/).filter(Boolean);
const hasCls = (n, c) => cls(n).includes(c);
const find = (n, pred) => {
  if (!n.children) return null;
  for (const c of n.children) {
    if (c.tag && pred(c)) return c;
    const d = find(c, pred);
    if (d) return d;
  }
  return null;
};
const rawText = (n) => {
  if (n.text !== undefined) return n.text;
  return (n.children || []).map(rawText).join("");
};
const flatText = (n) => rawText(n).replace(/\s+/g, " ").trim();

// ═══════════════════════════════════════════════════════════════════════════════════════════
// 2. Lexical builders
// ═══════════════════════════════════════════════════════════════════════════════════════════
const F_BOLD = 1, F_ITALIC = 2, F_CODE = 16;

const text = (t, format = 0) =>
  ({ type: "text", version: 1, detail: 0, format, mode: "normal", style: "", text: t });
const linebreak = () => ({ type: "linebreak", version: 1 });
const para = (kids) =>
  ({ type: "paragraph", version: 1, direction: "ltr", format: "", indent: 0, textFormat: 0, textStyle: "", children: kids });
const styled = (styleKey, kids) =>
  ({ type: "styled-paragraph", version: 1, styleKey, direction: "ltr", format: "", indent: 0, textFormat: 0, textStyle: "", children: kids });
const head = (tag, kids) =>
  ({ type: "heading", tag, version: 1, direction: "ltr", format: "", indent: 0, children: kids });
const quote = (kids) =>
  ({ type: "quote", version: 1, direction: "ltr", format: "", indent: 0, textFormat: 0, textStyle: "", children: kids });
const link = (url, kids) =>
  ({ type: "link", version: 1, direction: "ltr", format: "", indent: 0, rel: null, target: null, title: null, url, children: kids });
const listitem = (value, kids) =>
  ({ type: "listitem", version: 1, direction: "ltr", format: "", indent: 0, value, checked: undefined, children: kids });
const list = (ordered, items, start = 1) => ({
  type: "list", version: 1, direction: "ltr", format: "", indent: 0,
  listType: ordered ? "number" : "bullet", tag: ordered ? "ol" : "ul", start,
  children: items.map((kids, i) => listitem(start + i, kids)),
});
const code = (lines) => {
  const kids = [];
  lines.forEach((l, i) => { if (i) kids.push(linebreak()); if (l !== "") kids.push(text(l)); });
  return { type: "code", version: 1, direction: null, format: "", indent: 0, language: null, theme: null, children: kids };
};
const image = (src, altText, fileName) => ({
  type: "image", version: 1, src, altText, width: 0, height: 0, position: "full",
  showCaption: false, fileUploadInfo: null, fileName,
  caption: { editorState: { root: { type: "root", version: 1, direction: null, format: "", indent: 0, children: [] } } },
});
const tcell = (kids, header) => ({
  type: "tablecell", version: 1, direction: "ltr", format: "", indent: 0,
  colSpan: 1, rowSpan: 1, headerState: header ? 1 : 0, backgroundColor: null, children: kids,
});
const trow = (cells) =>
  ({ type: "tablerow", version: 1, direction: "ltr", format: "", indent: 0, children: cells });
const table = (rows) =>
  ({ type: "table", version: 1, direction: "ltr", format: "", indent: 0, children: rows });

const lexicalData = (children) => JSON.stringify({
  bgColor: "rgba(0,0,0,0)",
  isCard: "",
  showToolbar: false,
  text: { root: { type: "root", version: 1, direction: "ltr", format: "", indent: 0, children } },
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// 3. The docs tree → the DMS page plan
// ═══════════════════════════════════════════════════════════════════════════════════════════
const slugForFile = (f) =>
  f === "index.html" ? ROOT_SLUG : f.replace(/\.html$/, "").split("--").join("/");

async function loadTree() {
  await import(pathToFileURL(join(DOCS_DIR, "_docs-nav.js")).href);
  const tree = globalThis.DOCS_TREE;
  if (!Array.isArray(tree)) throw new Error("DOCS_TREE not found on globalThis after importing _docs-nav.js");
  return tree;
}

function buildPlan(tree) {
  const plan = [];
  let order = 0;
  for (const hub of tree) {
    const hubFile = hub.hub;
    if (hubFile) {
      plan.push({
        file: hubFile, slug: slugForFile(hubFile), title: hub.label, type: "hub",
        hubKey: hub.key, index: order++, parentFile: null, isRoot: hubFile === "index.html",
      });
    }
    for (const p of hub.pages || []) {
      plan.push({
        file: p.f, slug: slugForFile(p.f), title: p.t, type: p.type,
        hubKey: hub.key, index: order++,
        parentFile: hubFile || null,          // utilities have no hub page → top level
        hideInNav: hubFile ? undefined : false,
      });
    }
  }
  return plan;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// 4. Link rewriting
// ═══════════════════════════════════════════════════════════════════════════════════════════
const FILE_SET = new Set();  // filled from the plan

function mapHref(href, pageFile) {
  if (!href) return "#";
  if (/^(https?:|mailto:|tel:)/i.test(href)) return href;
  if (href.startsWith("#")) return href;
  const m = href.match(/^([^#?]*\.html)(#.*)?$/);
  if (m) {
    const f = basename(m[1]);
    if (!FILE_SET.has(f)) warn(`link to an unknown docs file: ${href} (in ${pageFile})`);
    return `${BASE_URL}/${slugForFile(f)}${m[2] || ""}`;
  }
  if (href.includes("assets/")) {
    warn(`asset link left verbatim (not a figure image): ${href} (in ${pageFile})`);
    return href;
  }
  warn(`unrecognised href left verbatim: ${href} (in ${pageFile})`);
  return href;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// 5. Images
// ═══════════════════════════════════════════════════════════════════════════════════════════
let imageCache = existsSync(IMAGE_CACHE) ? JSON.parse(readFileSync(IMAGE_CACHE, "utf8")) : {};
let uploadCount = 0;

function uploadImage(relSrc, altText, dryRun) {
  const key = relSrc.replace(/^(\.\.\/)+/, "");
  if (imageCache[key]) return imageCache[key];
  if (dryRun) return `PENDING_UPLOAD:${key}`;
  const abs = resolve(ASSETS_ROOT, key.replace(/^assets\//, "assets/"));
  if (!existsSync(abs)) { warn(`figure image missing on disk: ${relSrc}`); return null; }
  const name = basename(abs);
  const args = [
    "-s", "--fail", "-m", "300", "-X", "POST", `${UPLOAD_HOST}/dama-admin/${UPLOAD_PGENV}/file_upload`,
    "-F", `source_id=${UPLOAD_SOURCE_ID}`,
    "-F", `source_name=${UPLOAD_SOURCE_NAME}`,
    "-F", "type=file_upload",
    "-F", `file_name=${name}`,
    "-F", "file_type=image/png",
    "-F", `description=${(altText || name).slice(0, 240)}`,
    "-F", `directory=${UPLOAD_DIR}`,
    "-F", 'categories=[["Uploaded File"]]',
    "-F", `file=@${abs};type=image/png`,
  ];
  const out = execFileSync("curl", args, { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  const json = JSON.parse(out);
  if (!json.ok || !json.dl_url) throw new Error(`file_upload failed for ${name}: ${out.slice(0, 300)}`);
  imageCache[key] = json.dl_url;
  writeFileSync(IMAGE_CACHE, JSON.stringify(imageCache, null, 1));
  uploadCount++;
  console.log(`  uploaded ${name} → ${json.dl_url}`);
  return json.dl_url;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// 6. HTML → lexical
// ═══════════════════════════════════════════════════════════════════════════════════════════
// Inline conversion. `.ui` and `<kbd>` are bold (STYLE §2.7 — UI labels verbatim and bold);
// `.pathway` is italic with the design's "· " prefix; `<code>` is the lexical code mark.
function inlineRaw(node, ctx, format = 0) {
  const out = [];
  for (const c of node.children || []) {
    if (c.text !== undefined) {
      const t = c.text.replace(/\s+/g, " ");
      if (t) out.push(text(t, format));
      continue;
    }
    switch (c.tag) {
      case "strong": case "b":
        out.push(...inlineRaw(c, ctx, format | F_BOLD)); break;
      case "em": case "i":
        out.push(...inlineRaw(c, ctx, format | F_ITALIC)); break;
      case "code":
        out.push(...inlineRaw(c, ctx, format | F_CODE)); break;
      case "kbd":
        out.push(...inlineRaw(c, ctx, format | F_BOLD)); break;
      case "br":
        out.push(linebreak()); break;
      case "a": {
        const kids = inlineRaw(c, ctx, format);
        out.push(link(mapHref(c.attrs.href, ctx.file), kids.length ? kids : [text(flatText(c) || "link", format)]));
        break;
      }
      case "img": {
        const src = uploadImage(c.attrs.src || "", c.attrs.alt || "", ctx.dryRun);
        if (src) out.push(image(src, c.attrs.alt || "", basename(c.attrs.src || "")));
        break;
      }
      case "span": {
        if (hasCls(c, "ui")) { out.push(...inlineRaw(c, ctx, format | F_BOLD)); break; }
        if (hasCls(c, "pathway")) {
          // `.pathway` carries a CSS "· " prefix in the mockup; the trailing separator keeps a
          // glossary dd's closing link from reading as part of the pathway sentence.
          out.push(text(" · ", format));
          out.push(...inlineRaw(c, ctx, format | F_ITALIC));
          out.push(text(" · ", format));
          break;
        }
        out.push(...inlineRaw(c, ctx, format)); break;
      }
      case "button": break;                                  // feedback chrome — not content
      case "small": case "sup": case "sub": case "mark": case "abbr": case "time": case "u": case "s":
        out.push(...inlineRaw(c, ctx, format)); break;
      default:
        out.push(...inlineRaw(c, ctx, format)); break;        // transparent container
    }
  }
  return out;
}

// Trim/merge only at a BLOCK boundary. Trimming per child would eat the single space
// between "Select " and a <span class="ui">…</span> — which is how a first pass produced
// "selectdownload" in the fidelity diff.
const inlineNodes = (node, ctx, format = 0) => trimInline(mergeInline(inlineRaw(node, ctx, format)));

function mergeInline(nodes) {
  const out = [];
  for (const n of nodes) {
    const p = out[out.length - 1];
    if (n.type === "text" && p && p.type === "text" && p.format === n.format) p.text += n.text;
    else out.push(n);
  }
  return out;
}
function trimInline(nodes) {
  const out = nodes.slice();
  while (out.length && out[0].type === "text") {
    out[0].text = out[0].text.replace(/^\s+/, "");
    if (out[0].text === "") out.shift(); else break;
  }
  while (out.length && out[out.length - 1].type === "text") {
    const l = out[out.length - 1];
    l.text = l.text.replace(/\s+$/, "");
    if (l.text === "") out.pop(); else break;
  }
  return out;
}

const isBlockish = (n) =>
  n.tag && ["p", "ol", "ul", "pre", "table", "figure", "dl", "h2", "h3", "h4", "h5", "h6", "blockquote", "hr"].includes(n.tag)
  || (n.tag === "div" && !hasCls(n, "hubcard"));

/** A `<pre class="code">` → one lexical code node, verbatim. */
function preToCode(n) {
  const raw = rawText(n).replace(/^\n/, "").replace(/\s+$/, "");
  return code(raw.split("\n"));
}

/** `ol.steps` / `ol.refs` / `ol` / `ul`. Splits when an item carries a block child. */
function listBlocks(n, ctx) {
  const ordered = n.tag === "ol";
  const items = (n.children || []).filter((c) => c.tag === "li");
  const out = [];
  let bucket = [], start = 1, num = 1;
  const flush = () => { if (bucket.length) { out.push(list(ordered, bucket, start)); bucket = []; } };
  for (const li of items) {
    const inlineKids = [], blocks = [];
    for (const c of li.children || []) {
      if (c.tag === "pre") { blocks.push(preToCode(c)); continue; }
      if (c.tag === "div" && hasCls(c, "formula")) { blocks.push(...formulaBlocks(c, ctx)); continue; }
      if (c.tag === "span" && hasCls(c, "result")) {
        // fold the `.result` line into the same list item as a second sentence
        const r = inlineRaw(c, ctx);
        if (r.length) { inlineKids.push(text(" ")); inlineKids.push(...r); }
        continue;
      }
      if (isBlockish(c)) { blocks.push(...blockNodes(c, ctx)); continue; }
      inlineKids.push(...inlineRaw({ children: [c] }, ctx));
    }
    bucket.push(trimInline(mergeInline(inlineKids)));
    num++;
    // A step that carries a block child (a `pre.code`, a `.formula`) cannot hold it inside the
    // list item, so the list is SPLIT: flush what we have, emit the block, then continue the
    // numbering with a fresh list whose `start` is the next step number.
    if (blocks.length) { flush(); out.push(...blocks); start = num; }
  }
  flush();
  return out;
}

/** `.formula` → a mono equation paragraph plus one prose paragraph per `.var` line. */
function formulaBlocks(n, ctx) {
  const headKids = [], vars = [];
  for (const c of n.children || []) {
    if (c.tag === "span" && hasCls(c, "var")) { vars.push(inlineNodes(c, ctx)); continue; }
    headKids.push(...inlineRaw({ children: [c] }, ctx));
  }
  const out = [];
  const h = trimInline(mergeInline(headKids));
  if (h.length) out.push(styled("metaMD", h));
  for (const v of vars) if (v.length) out.push(styled("proseSM", v));
  return out;
}

/** `table.docs` → a lexical TableNode (registered: TableNode/TableRowNode/TableCellNode). */
function tableBlocks(n, ctx) {
  const rows = [];
  const walk = (node, header) => {
    for (const c of node.children || []) {
      if (c.tag === "tr") {
        const cells = [];
        for (const cc of c.children || []) {
          if (cc.tag !== "th" && cc.tag !== "td") continue;
          const kids = inlineNodes(cc, ctx);
          cells.push(tcell([para(kids.length ? kids : [text("")])], cc.tag === "th" || header));
        }
        if (cells.length) rows.push(trow(cells));
      } else if (c.tag === "thead") walk(c, true);
      else if (c.tag === "tbody" || c.tag === "tfoot") walk(c, false);
      else if (c.tag) walk(c, header);
    }
  };
  walk(n, false);
  return rows.length ? [table(rows)] : [];
}

/** `figure.shot` → image + italic caption, or (placeholder-only) a single italic caption line. */
function figureBlocks(n, ctx) {
  const img = find(n, (c) => c.tag === "img");
  const cap = find(n, (c) => c.tag === "figcaption");
  const capTxt = cap ? flatText(cap) : "";
  const out = [];
  if (img) {
    const src = uploadImage(img.attrs.src || "", img.attrs.alt || "", ctx.dryRun);
    if (src) out.push(para([image(src, img.attrs.alt || "", basename(img.attrs.src || ""))]));
    else out.push(styled("proseSM", [text(`[figure unavailable] ${img.attrs.alt || ""}`, F_ITALIC)]));
    if (capTxt) out.push(styled("proseSM", [text(capTxt, F_ITALIC)]));
  } else {
    ctx.figureNo = (ctx.figureNo || 0) + 1;
    const t = /^figure\b/i.test(capTxt) ? capTxt : `Figure ${ctx.figureNo} · ${capTxt}`;
    out.push(styled("proseSM", [text(t, F_ITALIC)]));
  }
  return out;
}

/** `dl.defs` → one paragraph per term: bold term — definition (links preserved). */
function defsBlocks(n, ctx) {
  const out = [];
  let pending = null;
  for (const c of n.children || []) {
    if (c.tag === "dt") { pending = flatText(c); continue; }
    if (c.tag === "dd") {
      const kids = [];
      if (pending) kids.push(text(pending, F_BOLD), text(" — "));
      kids.push(...inlineRaw(c, ctx));
      out.push(para(trimInline(mergeInline(kids))));
      pending = null;
    }
  }
  if (pending) out.push(para([text(pending, F_BOLD)]));
  return out;
}

/** `.hubgrid` → one paragraph per hub card: link(title) — description · N pages. */
function hubgridBlocks(n, ctx) {
  const out = [];
  for (const a of (n.children || []).filter((c) => c.tag === "a")) {
    const t = find(a, (c) => hasCls(c, "t"));
    const d = find(a, (c) => hasCls(c, "d"));
    const num = find(a, (c) => hasCls(c, "n"));
    const kids = [link(mapHref(a.attrs.href, ctx.file), [text(t ? flatText(t) : flatText(a), F_BOLD)])];
    if (d) kids.push(text(` — ${flatText(d)}`));
    if (num) kids.push(text(` · ${flatText(num)}`));
    out.push(para(kids));
  }
  return out;
}

/** Any block-level node → lexical nodes. */
function blockNodes(n, ctx) {
  switch (n.tag) {
    case "h2": case "h3": case "h4": case "h5": case "h6": {
      const kids = inlineNodes(n, ctx);
      return kids.length ? [head(n.tag, kids)] : [];
    }
    case "p": {
      // Eight measure pages write `<p><div class="callout">…</div></p>`. A browser auto-closes
      // the <p> before the div; this parser doesn't, so treat any paragraph that contains a
      // block child as a transparent wrapper — otherwise the callout flattens into prose.
      if ((n.children || []).some((c) => c.tag && isBlockish(c))) return blockNodes({ ...n, tag: "div", attrs: {} }, ctx);
      const kids = inlineNodes(n, ctx);
      return kids.length ? [para(kids)] : [];
    }
    case "ol": case "ul":
      return listBlocks(n, ctx);
    case "pre":
      return [preToCode(n)];
    case "table":
      return tableBlocks(n, ctx);
    case "figure":
      return figureBlocks(n, ctx);
    case "dl":
      return defsBlocks(n, ctx);
    case "blockquote":
      return [quote(inlineNodes(n, ctx))];
    case "hr":
      return [{ type: "horizontalrule", version: 1 }];
    case "div": {
      if (hasCls(n, "callout")) {
        const k = find(n, (c) => c.tag === "span" && hasCls(c, "k"));
        const label = k ? flatText(k) : "";
        const rest = { children: (n.children || []).filter((c) => c !== k) };
        const kids = [];
        if (label) kids.push(text(label, F_BOLD), text(" "));
        kids.push(...inlineRaw(rest, ctx));
        return [quote(trimInline(mergeInline(kids)))];
      }
      if (hasCls(n, "formula")) return formulaBlocks(n, ctx);
      if (hasCls(n, "where") || hasCls(n, "letter-index")) {
        const kids = [];
        for (const a of (n.children || []).filter((c) => c.tag === "a")) {
          if (kids.length) kids.push(text(" · "));
          kids.push(link(mapHref(a.attrs.href, ctx.file), [text(flatText(a))]));
        }
        return kids.length ? [para(kids)] : [];
      }
      if (hasCls(n, "hubgrid")) return hubgridBlocks(n, ctx);
      // tablewrap and any other wrapper: transparent. Consecutive INLINE children are
      // gathered into one paragraph so a wrapper's prose doesn't shatter into one
      // paragraph per span.
      const out = [];
      let run = [];
      const flushRun = () => {
        const kids = trimInline(mergeInline(run));
        run = [];
        if (kids.length) out.push(para(kids));
      };
      for (const c of n.children || []) {
        if (c.text !== undefined) { run.push(...inlineRaw({ children: [c] }, ctx)); continue; }
        if (isBlockish(c)) { flushRun(); out.push(...blockNodes(c, ctx)); continue; }
        run.push(...inlineRaw({ children: [c] }, ctx));
      }
      flushRun();
      return out;
    }
    case "a": {
      const kids = inlineNodes({ children: [n] }, ctx);
      return kids.length ? [para(kids)] : [];
    }
    case "script": case "style": case "button": case "nav":
      return [];
    default: {
      const kids = inlineNodes(n, ctx);
      return kids.length ? [para(kids)] : [];
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// 7. One docs page → its section plan
// ═══════════════════════════════════════════════════════════════════════════════════════════
const G_HEADER = "docs-header", G_BODY = "docs-body", G_FOOTER = "docs-footer";
const GROUPS = [
  { name: G_HEADER, index: 0, theme: "header", position: "content", displayName: "Page header" },
  { name: G_BODY, index: 1, theme: "content", position: "content", displayName: "Page body" },
  { name: G_FOOTER, index: 2, theme: "footer", position: "content", displayName: "Footer" },
];
const PAGE_ATTRS = { sidebar: "right" };   // turns on the theme's "On this page" rail

function transcribePage(entry) {
  const html = readFileSync(join(DOCS_DIR, entry.file), "utf8");
  const root = parseHTML(html);
  const main = find(root, (n) => n.tag === "main");
  if (!main) throw new Error(`no <main> in ${entry.file}`);
  const ctx = { file: entry.file, dryRun: entry.dryRun, figureNo: 0 };

  // ── header section: kicker · h1 · lede · stamps
  const hdr = find(main, (n) => n.tag === "header");
  const kicker = hdr && find(hdr, (n) => hasCls(n, "doc-kicker"));
  const h1 = hdr && find(hdr, (n) => n.tag === "h1");
  const lede = hdr && find(hdr, (n) => hasCls(n, "doc-lede"));
  const stampsEl = hdr && find(hdr, (n) => hasCls(n, "stamps"));
  const hdrKids = [];
  if (kicker) hdrKids.push(styled("kicker", [text(flatText(kicker))]));
  if (h1) hdrKids.push(head("h1", inlineNodes(h1, ctx)));
  if (lede) hdrKids.push(styled("proseLG", inlineNodes(lede, ctx)));
  if (stampsEl) {
    const parts = (stampsEl.children || []).filter((c) => c.tag === "span").map(flatText).filter(Boolean);
    if (parts.length) hdrKids.push(styled("metaSM", [text(parts.join(" · "))]));
  }

  // ── body: one section per H2 block (plus a leading intro section when a page has one)
  const body = find(main, (n) => hasCls(n, "doc-body"));
  if (!body) throw new Error(`no .doc-body in ${entry.file}`);
  const buckets = [];
  let cur = { navLabel: null, blocks: [] };
  for (const c of body.children || []) {
    if (c.text !== undefined) { if (c.text.trim()) cur.blocks.push({ text: c.text }); continue; }
    if (c.tag === "h2") {
      if (cur.blocks.length) buckets.push(cur);
      cur = { navLabel: flatText(c), blocks: [c] };
      continue;
    }
    cur.blocks.push(c);
  }
  if (cur.blocks.length) buckets.push(cur);

  const sections = [];
  if (hdrKids.length) {
    sections.push({ group: G_HEADER, size: HEADER_SIZE, children: hdrKids, label: "header" });
  }
  for (const b of buckets) {
    const children = [];
    for (const blk of b.blocks) {
      if (blk.text !== undefined) { const k = inlineNodes({ children: [blk] }, ctx); if (k.length) children.push(para(k)); continue; }
      children.push(...blockNodes(blk, ctx));
    }
    if (!children.length) continue;
    sections.push({ group: G_BODY, size: SECTION_SIZE, children, navLabel: b.navLabel || undefined, label: b.navLabel || "intro" });
  }
  return sections;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// 8. Fidelity — text similarity of the built lexical vs the source <main>
// ═══════════════════════════════════════════════════════════════════════════════════════════
function lexicalText(nodes) {
  let out = "";
  for (const n of nodes || []) {
    if (n.type === "text") out += n.text;
    else if (n.type === "linebreak") out += " ";
    else if (n.type === "image") out += " " + (n.altText || "");
    else out += " " + lexicalText(n.children) + " ";
  }
  return out;
}
function sourceText(entry) {
  const html = readFileSync(join(DOCS_DIR, entry.file), "utf8");
  const m = html.match(/<main\b[\s\S]*?<\/main>/);
  let s = m ? m[0] : html;
  s = s.replace(/<!--[\s\S]*?-->/g, "");                        // capture-provenance comments
  s = s.replace(/<footer[\s\S]*?<\/footer>/g, "");             // feedback footer + page history
  s = s.replace(/<div class="crumbs"[\s\S]*?<\/div>/g, "");     // JS-filled breadcrumb
  s = s.replace(/<div class="ph">[\s\S]*?<\/div>/g, "");        // capture-spec placeholder — dropped by design
  s = s.replace(/<script[\s\S]*?<\/script>/g, "");
  s = s.replace(/<img\b[^>]*\balt="([^"]*)"[^>]*>/g, " $1 ");   // alt text IS transcribed
  s = s.replace(/<[a-zA-Z/][^>]*>/g, " ");
  return decodeEntities(s);
}
// Trailing sentence punctuation is stripped: the source side turns `<code>gpkg</code>.`
// into " gpkg ." while the built side keeps "gpkg." as one run, and that is a tokenizer
// artefact, not a transcription loss.
const tokens = (s) => (s.toLowerCase().match(/[a-z0-9₀-₉%$.\-_/]+/g) || [])
  .map((t) => t.replace(/[.,;:!?]+$/, ""))
  .filter((t) => t.length > 1);
function similarity(a, b) {
  const A = tokens(a), B = tokens(b);
  const ca = new Map(), cb = new Map();
  for (const t of A) ca.set(t, (ca.get(t) || 0) + 1);
  for (const t of B) cb.set(t, (cb.get(t) || 0) + 1);
  let inter = 0, uni = 0;
  for (const t of new Set([...ca.keys(), ...cb.keys()])) {
    const x = ca.get(t) || 0, y = cb.get(t) || 0;
    inter += Math.min(x, y); uni += Math.max(x, y);
  }
  return uni ? inter / uni : 1;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// 9. Apply
// ═══════════════════════════════════════════════════════════════════════════════════════════
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };

const DRY = flag("dry-run");
const ONLY = opt("only");
const HUB = opt("hub");
const ALL = flag("all");
const FIDELITY_OUT = opt("fidelity");
const STRICT = process.env.STRICT_COUNTS === "1";

if (!ALL && !ONLY && !HUB) {
  console.error("usage: build_docs_pattern.mjs (--all | --only <slug> | --hub <key>) [--dry-run] [--fidelity <path>]");
  process.exit(2);
}

const tree = await loadTree();
const plan = buildPlan(tree);
for (const p of plan) FILE_SET.add(p.file);
const selected = plan.filter((p) => (ALL ? true : ONLY ? p.slug === ONLY : p.hubKey === HUB));
if (!selected.length) { console.error(`nothing selected (--only ${ONLY} --hub ${HUB})`); process.exit(2); }

// Transcribe first — an HTML/transcription error must abort before anything is written.
const built = new Map();
for (const p of selected) {
  p.dryRun = DRY;
  built.set(p.file, transcribePage(p));
}

// --dump <slug> prints the built lexical for one page and exits (offline, writes nothing).
const DUMP = opt("dump");
if (DUMP) {
  const p = selected.find((x) => x.slug === DUMP) || selected[0];
  console.log(JSON.stringify((built.get(p.file) || []).map((s) => ({
    group: s.group, size: s.size, navLabel: s.navLabel,
    element: { "element-type": "lexical", "element-data": lexicalData(s.children) },
  })), null, 1));
  process.exit(0);
}

console.log(`plan: pattern ${PATTERN} (${PATTERN_ID}) · base_url ${BASE_URL} · ${plan.length} pages in DOCS_TREE · ${selected.length} selected`);
const perHub = {};
for (const p of plan) perHub[p.hubKey] = (perHub[p.hubKey] || 0) + 1;
console.log("  pages per hub:", JSON.stringify(perHub));

let planTotal = 0;
for (const p of selected) {
  const s = built.get(p.file) || [];
  planTotal += s.length;
  console.log(`  ${String(p.index).padStart(2)} ${p.slug.padEnd(52)} parent=${p.parentFile ? slugForFile(p.parentFile) : "—"} sections=${String(s.length).padStart(2)} (${p.type})`);
}
console.log(`  total sections planned: ${planTotal}`);

if (DRY) {
  const pend = new Set();
  for (const [, secs] of built) {
    const t = lexicalText(secs.flatMap((s) => s.children));
    for (const m of t.matchAll(/PENDING_UPLOAD:(\S+)/g)) pend.add(m[1]);
  }
  const imgs = new Set();
  for (const p of selected) {
    const html = readFileSync(join(DOCS_DIR, p.file), "utf8");
    for (const m of html.matchAll(/<img[^>]+src="([^"]*assets\/[^"]*)"/g)) imgs.add(m[1].replace(/^(\.\.\/)+/, ""));
  }
  console.log(`  figure images referenced: ${imgs.size} · already uploaded: ${[...imgs].filter((i) => imageCache[i]).length}`);
  if (WARN.length) { console.log("  warnings:"); WARN.forEach((w) => console.log("   -", w)); }
  console.log("DRY RUN — nothing written.");
  process.exit(0);
}

const VERIFY = flag("verify");

// ── live: pages ────────────────────────────────────────────────────────────────────────────
const listOut = cliJSON("page", "list", "--pattern", PATTERN, "--limit", "1000");
const items = listOut.items || listOut;
const bySlug = new Map();
for (const it of items) {
  const d = it.data || it;
  if (d.url_slug) bySlug.set(d.url_slug, String(it.id));
}
console.log(`live pattern holds ${items.length} pages`);

const idByFile = new Map();
for (const p of plan) if (bySlug.has(p.slug)) idByFile.set(p.file, bySlug.get(p.slug));

/** Pull a live page back (one call) and score it against its source HTML. */
function scorePage(p, pageId, planned) {
  const back = cliJSON("page", "dump", String(pageId), "--pattern", PATTERN, "--sections");
  const refs = back.data.draft_sections || [];
  const byId = new Map((back._expanded_sections || []).map((x) => [String(x.id), x]));
  let liveTxt = "";
  for (const r of refs) {
    const ed = byId.get(String(r.id))?.data?.element?.["element-data"];
    if (!ed) continue;
    try { liveTxt += " " + lexicalText(JSON.parse(ed).text.root.children); } catch { /* ignore */ }
  }
  const sim = similarity(liveTxt, sourceText(p));
  const row = {
    page: p.title, slug: p.slug, id: String(pageId), type: p.type, hub: p.hubKey,
    sections_planned: planned, sections_built: refs.length,
    similarity: Math.round(sim * 10000) / 10000,
    notes: [
      refs.length !== planned ? "section count mismatch" : null,
      sim < 0.97 ? "similarity below 0.97" : null,
    ].filter(Boolean).join("; "),
  };
  console.log(`  fidelity: ${p.slug} sections ${refs.length}/${planned} · similarity ${sim.toFixed(4)}${sim < 0.97 ? "  ⚠" : ""}`);
  return row;
}

let deleteFailures = 0, createdSections = 0, createdPages = 0;
const fidelity = [];
const tmp = mkdtempSync(join(tmpdir(), "build_docs_"));

const byFile = new Map(plan.map((p) => [p.file, p]));

/** Find-or-create the page ROW for an entry (metadata only; sections are handled separately).
 *  Recurses into `parentFile` so `--only <child>` still lands under a real hub page. */
const ensured = new Set();
function ensurePageRow(p) {
  if (ensured.has(p.file)) return idByFile.get(p.file);
  ensured.add(p.file);
  const existing = idByFile.get(p.file);
  const parentId = p.parentFile ? ensurePageRow(byFile.get(p.parentFile)) : "";
  const pageData = {
    title: p.title,
    url_slug: p.slug,
    parent: parentId || "",
    index: String(p.index),
    published: "draft",
    ...(p.hideInNav !== undefined ? { hide_in_nav: p.hideInNav } : {}),
    ...PAGE_ATTRS,
  };
  if (existing) {
    cli("page", "update", existing, "--pattern", PATTERN, "--data", JSON.stringify(pageData));
    return existing;
  }
  const res = cliJSON("page", "create", "--pattern", PATTERN, "--data", JSON.stringify(pageData));
  const pageId = String(res.id);
  if (!pageId || pageId === "null") throw new Error(`page create failed for ${p.slug}`);
  idByFile.set(p.file, pageId);
  bySlug.set(p.slug, pageId);
  createdPages++;
  console.log(`created page ${p.slug} → ${pageId}`);
  return pageId;
}

if (VERIFY) {
  for (const p of selected) {
    const pageId = idByFile.get(p.file);
    if (!pageId) { console.log(`  MISSING page ${p.slug} — not built yet`); continue; }
    fidelity.push(scorePage(p, pageId, (built.get(p.file) || []).length));
  }
} else
try {
  for (const p of selected) {
    const sections = built.get(p.file) || [];
    const pageId = ensurePageRow(p);
    console.log(`page ${p.slug} → ${pageId}`);

    // wipe by PAGE ID — loud
    const raw = cliJSON("raw", "get", String(pageId));
    const existing = raw.data.draft_sections || [];
    if (existing.length && existing.length !== sections.length) {
      const msg = `${p.slug}: live draft has ${existing.length} sections, this build carries ${sections.length}`;
      if (STRICT) throw new Error(`REFUSING TO WIPE — ${msg} (unset STRICT_COUNTS to rebuild from the HTML anyway)`);
      console.log(`  ⚠ count drift — ${msg}`);
    }
    if (existing.length) {
      cli("page", "update", String(pageId), "--pattern", PATTERN, "--data", JSON.stringify({ draft_sections: [] }));
      let del = 0;
      for (const e of existing) {
        try { cli("section", "delete", String(e.id)); del++; }
        catch (err) { deleteFailures++; console.log("  DELETE FAILED for", e.id, String(err).slice(0, 160)); }
      }
      console.log(`  wiped ${existing.length} draft sections (${del} deleted, ${existing.length - del} orphaned)`);
    }

    cli("raw", "update", String(pageId), "--data", JSON.stringify({ draft_section_groups: GROUPS, ...PAGE_ATTRS }));

    sections.forEach((s, i) => {
      const payload = {
        size: s.size,
        group: s.group,
        title: "",
        element: { "element-data": lexicalData(s.children), "element-type": "lexical" },
        "element-type": "lexical",
        trackingId: randomUUID(),
        ...(s.navLabel ? { navLabel: s.navLabel } : {}),
      };
      const f = join(tmp, `s${i}.json`);
      writeFileSync(f, JSON.stringify(payload));
      cli("section", "create", String(pageId), "--pattern", PATTERN, "--data", f);
      createdSections++;
    });
    console.log(`  built ${sections.length} sections on ${BASE_URL}/${p.slug} (${pageId})`);

    fidelity.push(scorePage(p, pageId, sections.length));
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log(`\ndone: ${createdPages} pages created, ${createdSections} sections created, ${uploadCount} images uploaded`);
if (FIDELITY_OUT) {
  const mins = fidelity.map((f) => f.similarity).sort((a, b) => a - b);
  const summary = {
    generated: new Date().toISOString(), pattern: PATTERN, pattern_id: PATTERN_ID, base_url: BASE_URL,
    pages: fidelity.length,
    sections: fidelity.reduce((a, f) => a + f.sections_built, 0),
    similarity_min: mins[0], similarity_median: mins[Math.floor(mins.length / 2)],
    flagged: fidelity.filter((f) => f.notes).length,
    warnings: WARN,
    rows: fidelity,
  };
  writeFileSync(FIDELITY_OUT, JSON.stringify(summary, null, 1));
  console.log(`fidelity report → ${FIDELITY_OUT} (min ${summary.similarity_min} · median ${summary.similarity_median} · flagged ${summary.flagged})`);
}
if (WARN.length) { console.log("warnings:"); WARN.forEach((w) => console.log(" -", w)); }
if (deleteFailures) {
  console.error(`\n${deleteFailures} section deletes FAILED (orphaned rows) — is DMS_AUTH_TOKEN set?`);
  process.exit(1);
}
