// Build Freight Atlas MAPS GALLERY (2174664) + ABOUT & THE PLAN (2174665) to match
// MIGRATED to qa_skills/tools/builds/ (2026-07-07, task qa-build-scripts-migration.md).
// Run from dms-template root. Wipe hardened: delete by PAGE ID with loud failures.
// freight-atlas-gallery.html / freight-atlas-about.html, on transportnyv2 (12-col).
// Draft-only, idempotent (wipes each page first). Default padding (no overrides); border:'full' chrome.
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";

import { mkdirSync as __mk } from "node:fs";
__mk("scratchpad/npmrdsv5-dev2", { recursive: true });

const ENV = { ...process.env, DMS_HOST: "http://localhost:3001", DMS_APP: "npmrdsv5", DMS_TYPE: "dev2" };
const CLI = "src/dms/packages/dms/cli/bin/dms.js", PATTERN = "freightatlas2";
const cli = (...a) => execFileSync("node", [CLI, ...a], { env: ENV, encoding: "utf8" });
const clean = s => s.split("\n").filter(l => l.trim().startsWith("{")).pop();
const jget = id => JSON.parse(clean(cli("raw", "get", id)));

const text = (t, format = 0, style = "") => ({ type: "text", version: 1, detail: 0, format, mode: "normal", style, text: t });
const dot  = c => text("● ", 0, `color:${c};font-size:0.8em;vertical-align:middle`);
const para = (...children) => ({ type: "paragraph", version: 1, direction: "ltr", format: "", indent: 0, textFormat: 0, textStyle: "", children });
const styled = (styleKey, ...children) => ({ type: "styled-paragraph", version: 1, direction: "ltr", format: "", indent: 0, textFormat: 0, textStyle: "", styleKey, children });
const head = (tag, t) => ({ type: "heading", tag, version: 1, direction: "ltr", format: "", indent: 0, children: [text(t)] });
const hr = () => ({ type: "horizontalrule", version: 1 });
const button = (linkText, path, style = "default") => ({ type: "button", version: 1, linkText, path, style, keepSearchParams: false });
const lexical = (...nodes) => JSON.stringify({ bgColor: "rgba(0,0,0,0)", isCard: "", showToolbar: false,
  text: { root: { type: "root", version: 1, direction: "ltr", format: "", indent: 0, children: nodes } } });
const GOLD = "color:#CA8A04", MUTE = "font-size:0.5em;color:#64748b";

function build(PAGE, SLUG, groups, sections) {
  const existing = jget(PAGE).data.draft_sections || [];
  for (const e of existing) { try { cli("section", "delete", String(e.id), "--page", String(PAGE)); } catch (err) { console.log("  DELETE FAILED for", e.id, String(err).slice(0, 120)); } }
  const gf = `scratchpad/npmrdsv5-dev2/grp_${SLUG}.json`;
  fs.writeFileSync(gf, JSON.stringify({ draft_section_groups: groups }));
  cli("raw", "update", PAGE, "--data", gf);
  for (const s of sections) {
    const payload = { size: s.size, group: s.group, title: "",
      element: { "element-data": s.data, "element-type": "lexical" }, "element-type": "lexical" };
    if (s.border) payload.border = s.border;
    // Multi-card rows → equal height (bordered, narrower than full-width). Default stays auto.
    if (s.border === "full" && s.size !== "12") payload.height = "fill";
    if (s.navLabel) payload.navLabel = s.navLabel;   // in-page-nav rail opt-in
    cli("section", "create", PAGE, "--pattern", PATTERN, "--data", JSON.stringify(payload));
  }
  console.log(`${SLUG}: wiped ${existing.length}, built ${sections.length}; now`, jget(PAGE).data.draft_sections.length);
}

// ════════ MAPS GALLERY (2174664) ════════
{
  const G = { header: randomUUID(), content: randomUUID() };
  const groups = [
    { name: G.header,  index: 0, theme: "header",  position: "content", displayName: "Header" },
    { name: G.content, index: 1, theme: "content", position: "content", displayName: "Gallery" },
  ];
  const tile = (name, desc, layers) => lexical(
    styled("cardTitle", text(name)),
    styled("proseSM", text(desc)),
    styled("metaSM", text(layers)),
    para(button("open in atlas →", "/freight_atlas", "plain")),
  );
  const tiles = [
    ["Freight Network", "FCHN · PHFS · CUFC/CRFC · key corridors", "8 layers"],
    ["Intermodal & Facilities", "78 rail-served facilities · ports · airports", "6 layers"],
    ["Commodity Flows", "TRANSEARCH OD · 2021 + 2050 · by mode", "4 layers"],
    ["Truck Parking", "216+47 sites · hourly use · ATRI clusters", "3 layers · new"],
    ["Bottlenecks & Reliability", "37 bottlenecks · TTTR · excessive delay", "5 layers"],
    ["Safety", "Truck crashes · rail crossings · blocked-crossing hotspots", "4 layers"],
    ["Investment", "NHFP $304M · PFRAP $111.1M · by PIN/region", "2 layers"],
    ["Climate & Equity", "ETC equity index · CLCPA · border-buffer", "3 layers"],
  ];
  const sections = [
    { group: G.header, size: "12", data: lexical(
      styled("metaSM", text("Freight Atlas  /  Maps Gallery")),
      styled("kicker", text("// curated front door · 8 presets · one map engine")),
      styled("displayLG", text("Maps Gallery"), text(".", 0, GOLD)),
      styled("prose", text("Eight ways into the freight system. Each tile opens the single Freight Atlas map preloaded with a theme's layers and symbology — pick a starting point instead of building a view from scratch.")),
    )},
    ...tiles.map(([n, d, l]) => ({ group: G.content, size: "3", border: "full", data: tile(n, d, l) })),
    { group: G.content, size: "12", border: "full", data: lexical(
      styled("displaySM", text("Don't see your view? Build it.")),
      styled("proseSM", text("Open the full Atlas, toggle any of the 56 layers across all five modes, set your symbology and vintage, then copy the share link to save your own preset.")),
      para(button("Open full Atlas →", "/freight_atlas", "default")),
    )},
  ];
  build("2174664", "maps_gallery", groups, sections);
}

// ════════ ABOUT & THE PLAN (2174665) ════════
{
  const A = { header: randomUUID(), content: randomUUID() };
  const groups = [
    { name: A.header,  index: 0, theme: "hero",    position: "content", displayName: "Header" },
    { name: A.content, index: 1, theme: "content", position: "content", displayName: "Content" },
  ];
  const goalCard = (color, name, desc) => lexical(
    styled("cardTitleSM", dot(color), text(name)),
    styled("proseSM", text(desc)),
  );
  const goals = [
    ["#F43F5E", "Safety", "Reduce freight-related fatalities & serious injuries"],
    ["#1F3F8F", "Mobility", "Reliable, efficient movement of goods"],
    ["#F59E0B", "Condition", "State of good repair across modes"],
    ["#10B981", "Environment", "Cut emissions; build resilience (CLCPA)"],
    ["#37576B", "Economy", "Competitiveness & freight-reliant jobs"],
    ["#E5A646", "Stewardship", "Sound investment, partnership & data"],
  ];
  const libRow = (title, meta, action) => para(text(title, 1), text("  —  "), text(meta, 0, "color:#64748b"), text("   "), text(action, 0, "color:#1F3F8F"));
  const changedRow = (dim, y19, y24) => para(text(dim, 1), text("   2019: "), text(y19), text("   →   2024: "), text(y24, 0, "color:#0F1722"));
  const sections = [
    { group: A.header, size: "12", data: lexical(
      styled("metaSM", text("Freight Atlas  /  About & The Plan")),
      styled("kicker", text("// the living version of the plan")),
      styled("displayXL", text("About & The Plan"), text(".", 0, GOLD)),
      styled("prose", text("The Atlas is the interactive companion to the 2024 New York State Freight Plan. Here's the plan itself — six goals, twenty strategies — the full report library, what changed since 2019, and how to get involved.")),
    )},
    // §01 Six goals
    { group: A.content, size: "12", navLabel: "Six goals", data: lexical(styled("kicker", text("// 01")), head("h2", "Six goals")) },
    ...goals.map(([c, n, d]) => ({ group: A.content, size: "4", border: "full", data: goalCard(c, n, d) })),
    { group: A.content, size: "12", data: lexical(
      styled("proseSM", text("20 strategies across 5 focus areas — Planning & Information Sharing, Operations & Maintenance, Technology, System Investment, and Engagement & Collaboration — implement the goals, each mapped to the six in a matrix. The Atlas itself is Strategy 3 (centralized data platform) and Strategy 18 (public education).")),
    )},
    // §02 Report library
    { group: A.content, size: "12", navLabel: "The report library", data: lexical(styled("kicker", text("// 02")), head("h2", "The report library")) },
    { group: A.content, size: "12", border: "full", data: lexical(
      libRow("2024 NYS Freight Plan — main report", "PDF · 130 pp · Aug 2024 · CPCS", "download"),
      libRow("Executive Summary", "PDF · 20 pp", "download"),
      libRow("Appendix C–F · Asset inventory · FCHN · Truck Parking · Investment", "PDF · 4 appendices · the Atlas catalog backbone", "download"),
      libRow("Freight Working Group — 4 meeting decks", "PDF · Oct 2023 – Feb 2024", "download"),
      libRow("2019 NYS Freight Plan — archive", "PDF · superseded · + Tech White Paper", "archive"),
      hr(),
      styled("metaSM", text("[BACKFILL → upload report-library PDFs to DMS (file_upload); see freight-atlas-content-pages task]")),
    )},
    // §03 What changed
    { group: A.content, size: "12", navLabel: "What changed, 2019 → 2024", data: lexical(styled("kicker", text("// 03")), head("h2", "What changed, 2019 → 2024")) },
    { group: A.content, size: "12", border: "full", data: lexical(
      changedRow("Data vintage", "TRANSEARCH 2012 / 2040", "TRANSEARCH 2021 / 2050"),
      changedRow("Networks", "FCHN/FCRN created", "FCHN +4,497 mi · Core Maritime/Air"),
      changedRow("Truck parking", "Named as an issue", "Full study (216+47 · ATRI clusters)"),
      changedRow("Equity / climate", "GHG goals", "CLCPA + ETC index overlays"),
      changedRow("The Atlas", "“Web portal” aspiration", "AVAIL build mandate (this site)"),
    )},
    // §04 About
    { group: A.content, size: "12", navLabel: "About", data: lexical(styled("kicker", text("// 04")), head("h2", "About")) },
    { group: A.content, size: "8", border: "full", data: lexical(
      styled("prose", text("The NYS Freight Atlas is produced by the New York State Department of Transportation in partnership with the University at Albany's Albany Visualization and Informatics Lab (AVAIL), which the 2024 plan names as the team modernizing the Freight Web Atlas. The Atlas turns the plan's analysis into an interactive, downloadable, metadata-rich public platform for the state's MPOs, researchers, and residents.")),
    )},
    // Get involved
    { group: A.content, size: "4", border: "full", data: lexical(
      styled("kicker", text("get involved")),
      styled("displayXS", text("Have something to add?")),
      para(button("Public comment map", "#", "plain")),
      para(button("Request a dataset", "#", "plain")),
      para(button("Subscribe to updates", "#", "plain")),
      styled("metaSM", text("Freight Working Group & contacts via NYSDOT Freight Planning.")),
    )},
  ];
  build("2174665", "about", groups, sections); // slug swapped 2026-07-07 (#107): designed About & The Plan now lives at /about; legacy stub → about_deprecated (1479129)
}
