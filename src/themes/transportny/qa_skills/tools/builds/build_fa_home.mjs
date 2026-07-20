// Build the Freight Atlas HOME page (2174663) to match freight-atlas-home.html,
// MIGRATED to qa_skills/tools/builds/ (2026-07-07, task qa-build-scripts-migration.md).
// Run from dms-template root. Wipe hardened: delete by PAGE ID with loud failures.
// against transportnyv2 (12-col). Draft-only. Idempotent: WIPES existing draft
// sections first, then rebuilds.
// Order: hero · §01 Explore (content) · §02 by the numbers (content_tint) · §03 What's in (content).
// Fonts: display stat tokens statXL/statLG/statMD + cardTitleSM (mockup-matching).
// Spacing: NO per-section padding overrides — cards use the theme default gutter (p-3 → 24px = gap-6).
// The two data charts (mode-split, growth) stay lexical depictions tagged [BACKFILL→Graph].
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";

import { mkdirSync as __mk } from "node:fs";
__mk("scratchpad/npmrdsv5-dev2", { recursive: true });

const ENV = { ...process.env, DMS_HOST: "http://localhost:3001", DMS_APP: "npmrdsv5", DMS_TYPE: "dev2" };
const CLI = "src/dms/packages/dms/cli/bin/dms.js";
const PAGE = "2174663", SLUG = "home", PATTERN = "freightatlas2";
const cli = (...a) => execFileSync("node", [CLI, ...a], { env: ENV, encoding: "utf8" });
const clean = s => s.split("\n").filter(l => l.trim().startsWith("{")).pop();
const jget = id => JSON.parse(clean(cli("raw", "get", id)));

// ── lexical builders ─────────────────────────────────────────────────────────
const text = (t, format = 0, style = "") => ({ type: "text", version: 1, detail: 0, format, mode: "normal", style, text: t });
const dot  = c => text("●", 0, `color:${c};font-size:0.8em;vertical-align:middle`);
const para = (...children) => ({ type: "paragraph", version: 1, direction: "ltr", format: "", indent: 0, textFormat: 0, textStyle: "", children });
const styled = (styleKey, ...children) => ({ type: "styled-paragraph", version: 1, direction: "ltr", format: "", indent: 0, textFormat: 0, textStyle: "", styleKey, children });
const head = (tag, t) => ({ type: "heading", tag, version: 1, direction: "ltr", format: "", indent: 0, children: [text(t)] });
const hr = () => ({ type: "horizontalrule", version: 1 });
const button = (linkText, path, style = "default") => ({ type: "button", version: 1, linkText, path, style, keepSearchParams: false });
const layout = (templateColumns, columns) => ({ type: "layout-container", version: 1, templateColumns,
  children: columns.map(col => ({ type: "layout-item", version: 1, children: col })) });
const lexical = (...nodes) => JSON.stringify({ bgColor: "rgba(0,0,0,0)", isCard: "", showToolbar: false,
  text: { root: { type: "root", version: 1, direction: "ltr", format: "", indent: 0, children: nodes } } });
const GOLD = "color:#CA8A04", MUTE = "font-size:0.5em;color:#64748b";

// ── bands (final order) ──────────────────────────────────────────────────────
const B = { hero: randomUUID(), explore: randomUUID(), numbers: randomUUID(), whatsin: randomUUID() };
const groups = [
  { name: B.hero,    index: 0, theme: "hero",         position: "content", displayName: "Hero" },
  { name: B.explore, index: 1, theme: "content",      position: "content", displayName: "Explore the Atlas" },
  { name: B.numbers, index: 2, theme: "content_tint", position: "content", displayName: "By the numbers" },
  { name: B.whatsin, index: 3, theme: "content",      position: "content", displayName: "What's in the Atlas" },
];

// ── card content helpers (new stat tokens; no padding overrides) ───────────────
const modeCard = (name, num, unit, desc) => lexical(
  styled("cardTitleSM", text(name)),
  styled("statMD", text(num), text(` ${unit}`, 0, MUTE)),
  styled("proseSM", text(desc)),
);
const statCard = (num, label) => lexical(styled("statLG", text(num)), styled("metaSM", text(label)));
const kpiCard = (label, big, unit, sub, foot) => lexical(
  styled("metaSM", text(label)),
  styled("statXL", text(big), text(unit ? ` ${unit}` : "", 0, MUTE)),
  styled("proseSM", text(sub)),
  hr(),
  styled("metaSM", text(foot)),
);
const surfaceCard = (eyebrow, title, desc, linkText, path) => lexical(
  styled("metaSM", text(eyebrow)),
  head("h4", title),
  styled("proseSM", text(desc)),
  para(button(linkText, path, "plain")),
);

const sections = [
  // ── HERO ──
  { group: B.hero, size: "12", data: lexical(
    styled("kicker", text("// nysdot · 2024 state freight plan · public atlas")),
    styled("displayHero", text("NYS Freight Atlas"), text(".", 0, GOLD)),
    // Copy edit (Alex 2026-07-16, ticket 2192553): "Start with the numbers below…" read as a
    // promise that the stat strip sits in the top banner (it lives further down the page).
    // Neutral wording — invite exploration without implying placement.
    styled("prose", text("The living, interactive companion to the 2024 New York State Freight Plan — every road, rail, port, airport, pipeline, and truck-parking layer the plan analyzes, the performance metrics behind them, and the underlying data to download. Dive into the map, the insights, or the catalog — or scroll on for the numbers that frame it all.")),
    layout("grid-cols-1 md:grid-cols-[max-content_max-content_1fr]", [
      [para(button("Explore the map →", "/freight_atlas", "default"))],
      [para(button("Browse & download the data →", "/about_the_plan", "secondary"))],
      [para(text(""))],
    ]),
  )},

  // ── §01 EXPLORE THE ATLAS ──
  { group: B.explore, size: "12", data: lexical(
    styled("kicker", text("// 01")),
    head("h2", "Explore the Atlas."),
  )},
  { group: B.explore, size: "6", border: "full", data: surfaceCard("interactive map · 56 layers", "Freight Atlas", "The flagship map — every mode and overlay on one canvas, with the 2021↔2050 vintage toggle, feature popups, and per-layer download.", "open the map →", "/freight_atlas") },
  { group: B.explore, size: "6", border: "full", data: surfaceCard("data & downloads · 24 datasets", "Data & Downloads", "The catalog — every layer to download in CSV, GeoJSON, Shapefile, or GeoPackage, with data dictionaries, vintages, and a Falcor API. No login.", "browse the catalog →", "/freight_data?cat=Freight%20Atlas") },
  { group: B.explore, size: "4", border: "full", data: surfaceCard("8 presets", "Maps Gallery", "Eight curated presets — Freight Network, Truck Parking, Flows, Bottlenecks, Equity — that open the map ready-made.", "8 presets →", "/maps_gallery") },
  { group: B.explore, size: "4", border: "full", data: surfaceCard("6 goals", "Freight Insights", "Dashboards and data stories organized by the plan's six goals — reliability, the parking crisis, flows to 2050, climate & equity.", "6 goals →", "#") },
  { group: B.explore, size: "4", border: "full", data: surfaceCard("the plan", "About & The Plan", "The six goals and 20 strategies, the full report library, what changed since 2019, and how to get involved.", "read the plan →", "/about_the_plan") },

  // ── §02 BY THE NUMBERS ──
  { group: B.numbers, size: "12", data: lexical(
    styled("kicker", text("// 02   New York freight · 2021 base year")),
    head("h2", "The system, by the numbers."),
  )},
  { group: B.numbers, size: "4", border: "full", data: kpiCard("Total freight moved", "936.5", "M tons", "across all five modes · S&P TRANSEARCH 2023", "↑ +34% forecast to 2050") },
  { group: B.numbers, size: "4", border: "full", data: kpiCard("Goods value", "$1.29", "trillion", "$1,293.7B · freight-reliant = >18% of state GDP", "↑ +57–67% forecast to 2050") },
  { group: B.numbers, size: "4", border: "full", data: kpiCard("Of all NY jobs", "25%", "", "are in freight-reliant industries · 3rd-largest state economy ($2.1T GDP)", "Economy goal") },
  { group: B.numbers, size: "8", border: "full", data: lexical(
    styled("metaSM", text("Mode share · tons vs value · 2021  ·  ■ tons   ■ value")),
    styled("proseSM", text("Truck — 68.6% tons · 75.9% value")),
    styled("proseSM", text("Water — 17.0% tons · 5.6% value")),
    styled("proseSM", text("Rail — 10.7% tons · 14.7% value")),
    styled("proseSM", text("Pipeline — 3.2% tons · 0.5% value")),
    styled("proseSM", text("Air — 0.3% tons · 3.0% value")),
    styled("proseSM", text("Truck dominates both tonnage and value. Air carries just 0.3% of tons but 3.0% of value — and is the fastest-growing mode.")),
    hr(),
    styled("metaSM", text("[BACKFILL→Graph · TRANSEARCH mode share over npmrds2]")),
  )},
  { group: B.numbers, size: "4", border: "full", data: lexical(
    styled("cardTitleSM", text("Growth to 2050")),
    styled("metaSM", text("2021 base → 2050 forecast")),
    styled("statLG", text("+34%"), text(" volume", 0, MUTE)),
    styled("statLG", text("+62%"), text(" value", 0, MUTE)),
    hr(),
    styled("metaSM", text("[BACKFILL→Graph · TRANSEARCH 2021↔2050]")),
  )},
  { group: B.numbers, size: "2", border: "full", data: statCard("56", "map layers") },
  { group: B.numbers, size: "2", border: "full", data: statCard("24", "datasets") },
  { group: B.numbers, size: "2", border: "full", data: statCard("1,145 mi", "PHFS routes") },
  { group: B.numbers, size: "2", border: "full", data: statCard("263", "parking sites") },
  { group: B.numbers, size: "2", border: "full", data: statCard("37", "bottlenecks") },
  { group: B.numbers, size: "2", border: "full", data: statCard("$304M", "NHFP 24–28") },

  // ── §03 WHAT'S IN THE ATLAS ──
  { group: B.whatsin, size: "12", data: lexical(
    styled("kicker", text("// 03   56 layers · 5 modes")),
    head("h2", "What's in the Atlas."),
  )},
  { group: B.whatsin, size: "2", border: "full", data: modeCard("Road", "8", "layers", "FCHN · PHFS · CUFC/CRFC · 37 bottlenecks") },
  { group: B.whatsin, size: "2", border: "full", data: modeCard("Rail", "5", "layers", "Class I/II/III · 78 facilities · crossings") },
  { group: B.whatsin, size: "2", border: "full", data: modeCard("Maritime", "8", "ports", "Core Maritime · marine highways · canal") },
  { group: B.whatsin, size: "2", border: "full", data: modeCard("Air", "6", "airports", "Core Air Cargo · JFK facilities") },
  { group: B.whatsin, size: "2", border: "full", data: modeCard("Pipeline", "3", "layers", "Hazardous-liquid · natural-gas · terminals") },
  { group: B.whatsin, size: "2", border: "full", data: lexical(
    styled("cardTitleSM", text("+ all modes")),
    styled("proseSM", text("Toggle every layer on one map")),
  )},
  { group: B.whatsin, size: "12", border: "full", data: lexical(
    styled("metaSM", text("cross-cutting overlays")),
    para(
      dot("#1F3F8F"), text(" Performance (TTTR · TED · IRI · crashes)    "),
      dot("#37576B"), text(" Commodity flows (2021 + 2050)    "),
      dot("#10B981"), text(" Truck parking (216+47)    "),
      dot("#E5A646"), text(" Investment (NHFP · PFRAP)    "),
      dot("#F43F5E"), text(" Equity & climate (ETC · CLCPA)    "),
      dot("#F59E0B"), text(" Geographies (REDC · MPO · county)"),
    ),
  )},
];

// ── apply ──────────────────────────────────────────────────────────────────
// 0) wipe existing draft sections (clean rebuild)
const existing = jget(PAGE).data.draft_sections || [];
for (const e of existing) { try { cli("section", "delete", String(e.id), "--page", String(PAGE)); } catch (err) { console.log("  DELETE FAILED for", e.id, String(err).slice(0, 120)); } }
console.log("wiped", existing.length, "existing draft sections");

// 1) set the bands
const gf = "scratchpad/npmrdsv5-dev2/fa_home_groups.json";
fs.writeFileSync(gf, JSON.stringify({ draft_section_groups: groups }));
cli("raw", "update", PAGE, "--data", gf);
console.log("bands:", groups.map(g => g.index + ":" + g.displayName).join(" · "));

// 2) create sections in order (NO padding key → default p-3 gutter)
let n = 0;
for (const s of sections) {
  const payload = { size: s.size, group: s.group, title: "",
    element: { "element-data": s.data, "element-type": "lexical" }, "element-type": "lexical" };
  if (s.border) payload.border = s.border;   // chrome only; padding intentionally omitted
  // Multi-card rows → equal height. Bordered cards narrower than full-width (size!=12) sit
  // beside siblings, so fill makes them match the tallest in the row. Default stays auto.
  if (s.border === "full" && s.size !== "12") payload.height = "fill";
  cli("section", "create", PAGE, "--pattern", PATTERN, "--data", JSON.stringify(payload));
  n++;
}
console.log(`created ${n} sections; page now has`, jget(PAGE).data.draft_sections.length, "draft sections");
