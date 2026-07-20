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
    const et = s.et || "lexical";
    const payload = { size: s.size, group: s.group, title: "",
      element: { "element-data": s.data, "element-type": et }, "element-type": et };
    if (s.border) payload.border = s.border;
    // Multi-card rows → equal height (bordered, narrower than full-width). Default stays auto.
    if (s.border === "full" && s.size !== "12") payload.height = "fill";
    if (s.navLabel) payload.navLabel = s.navLabel;   // in-page-nav rail opt-in
    cli("section", "create", PAGE, "--pattern", PATTERN, "--data", JSON.stringify(payload));
  }
  console.log(`${SLUG}: wiped ${existing.length}, built ${sections.length}; now`, jget(PAGE).data.draft_sections.length);
}

// ════════ MAPS GALLERY (2174664) — data-driven per freight-atlas-gallery.html (2026-07-13) ════════
// One tile per LIVE map figure (status available/partial) of the 2024 State Freight Plan,
// grouped into the plan's 8 categories, from the `freightatlas_maps` dataset (2189815/v2189816).
// Tiles deep-link the map engine — name displays, href = "/freight_atlas?layers=" + the row's
// layers_on (searchParamsCol; map_dama reads it in view — see core task
// map-dama-shareable-layers-read.md). Header chips are LIVE aggregate counts; per-category
// "N maps" counts are baked at BUILD time from the dataset (refresh on rebuild). Blocked
// figures (pending/external) stay in the dataset as the work queue.
{
  const FAMAPS_SRC = { isDms: true, app: "npmrdsv5", type: "freightatlas_maps", name: "Freight Atlas — Gallery Maps",
    source_id: 2189815, view_id: 2189816, env: "npmrdsv5+freightatlas_maps", srcEnv: "npmrdsv5+freightatlas_maps", baseUrl: "/forms",
    columns: ["figure", "page", "fig_label", "name", "description", "category", "status", "symbology_ids", "layers_on", "layers_label", "url", "badge"].map(n => ({ name: n, display_name: n, type: "text" })) };
  const dwG = ({ columns, filters = [], display = {} }) => JSON.stringify({
    externalSource: FAMAPS_SRC, columns, filters: { op: "AND", groups: filters },
    // pageSize is REQUIRED even with usePagination:false — without it the fetch range never
    // resolves and the section silently renders nothing (no request, no error)
    display: { usePagination: false, pageSize: 33, readyToLoad: true, fetchMode: "smart", showAttribution: false, striped: false, ...display },
    data: [], join: { sources: {} } });
  // design order (freight-atlas-gallery.html §01–§08)
  const ALL_CATEGORIES = ["Freight Economy & Equity", "The Multimodal System", "Trade & Commodity Flows", "Rail",
    "Maritime, Air & Pipelines", "Performance & Investment", "Safety & Truck Parking", "2050 Outlook"];
  // baked per-category LIVE counts (status available/partial — matches what the tiles render;
  // from the dataset at build time, re-run this build after adding figures to refresh). Ticket
  // #2191404 (2026-07-15, Alex): categories with ZERO live maps are dropped entirely — the page
  // shows 7 themes today; 2050 Outlook reappears here automatically once its figures go live.
  const CAT_COUNTS = { "Freight Economy & Equity": 3, "The Multimodal System": 5, "Trade & Commodity Flows": 3,
    "Rail": 2, "Maritime, Air & Pipelines": 3, "Performance & Investment": 2, "Safety & Truck Parking": 4, "2050 Outlook": 0 };
  const CATEGORIES = ALL_CATEGORIES.filter((cat) => (CAT_COUNTS[cat] || 0) > 0);

  const G = { header: randomUUID(), content: randomUUID() };
  const groups = [
    { name: G.header,  index: 0, theme: "header",  position: "content", displayName: "Header" },
    { name: G.content, index: 1, theme: "content", position: "content", displayName: "Gallery" },
  ];
  // aggregate chip cell (fn:"exempt" — the one-row aggregate Card idiom)
  const chip = (sql, alias) => ({ name: sql, type: "calculated", normalName: alias, display_name: "",
    show: true, fn: "exempt", formatFn: " ", hideHeader: true, valueFontStyle: "chip" });
  const sections = [
    { group: G.header, size: "12", data: lexical(
      styled("metaSM", text("Freight Atlas  /  Maps Gallery")),
      styled("kicker", text("// the 2024 freight plan's maps · 33 figures · one map engine")),
      styled("displayLG", text("Maps Gallery"), text(".", 0, GOLD)),
      styled("prose", text("Every map from the 2024 State Freight Plan that is live in the Freight Atlas today — 22 of the plan's 33 map figures, each tile opening the single map engine preloaded with that figure's layers. The rest arrive as their data lands.")),
    )},
    // live status chips (aggregate over the whole dataset)
    { group: G.header, size: "12", et: "Card", data: dwG({
      columns: [
        chip(`((count(*) filter (where (data->>'status') in ('available','partial')))::text || ' live in the atlas') as chip_live`, "chip_live"),
        // NB: the copy "more as their data lands" contains " as " — the column-name parser
        // splits on the FIRST ' as ' (splitColNameOnAS), so the literal is assembled via
        // chr(32) to keep 'as' un-spaced in the raw SQL string
        chip(`((count(*) filter (where (data->>'status') in ('pending','external')))::text || ' more' || chr(32) || 'as their data lands') as chip_next`, "chip_next"),
      ],
      display: { usePagination: false, pageSize: 1, fetchMode: "smart", cardBorder: false,
        cellsTracksTemplate: "max-content max-content", cellsGridGap: 8, cellsPadding: 0, cardsPadding: 0 },
    }) },
    ...CATEGORIES.flatMap((cat, i) => [
      // category header — numbered kicker + h2 ("N maps" baked; the mockup's hairline+count line)
      { group: G.content, size: "12", data: lexical(
        styled("kicker", text(`// 0${i + 1} · ${CAT_COUNTS[cat] || 0} maps`)),
        head("h2", cat),
      )},
      // live tiles: one Card record per LIVE figure, 3-across, numeric figure order
      { group: G.content, size: "12", et: "Card", data: dwG({
        columns: [
          // numeric order helper (row-level calc, NO fn — mixed-fn trap) — no cell
          { name: `((data->>'figure'))::int as fig_order`, type: "calculated", normalName: "fig_order",
            display_name: "", show: true, selectOnly: true, formatFn: " ", sort: "asc" },
          { name: "fig_label", show: true, hideHeader: true, valueFontStyle: "metaXS", cellVAlign: "center" },
          // partial badge — amber pill only when status='partial' (NULL otherwise)
          { name: `(nullif(case when (data->>'status') = 'partial' then 'partial' else '' end, '')) as part_badge`,
            type: "status_pill", pillColors: { "partial": "amber" }, normalName: "part_badge", display_name: "",
            show: true, formatFn: " ", hideHeader: true, justify: "right", cellVAlign: "center" },
          { name: "name", show: true, hideHeader: true, valueFontStyle: "cardTitleSM", cellSpan: 2,
            isLink: true, location: "/freight_atlas?layers=", searchParamsCol: "layers_on" },
          { name: "description", show: true, hideHeader: true, valueFontStyle: "proseSM", cellSpan: 2 },
          // fetched for the link param only
          { name: "layers_on", show: true, selectOnly: true },
        ],
        filters: [
          { col: "category", op: "filter", value: [cat] },
          { col: "status", op: "filter", value: ["available", "partial"] },
        ],
        display: { usePagination: false, fetchMode: "smart", cardBorder: true, cardsGridSize: 3, cardsGridGap: 20,
          cardsPadding: 14, cellsGridSize: 2, cellsGridGap: 6, cellsRowGap: 4, cellsPadding: 0 },
      }) },
    ]),
    { group: G.content, size: "12", border: "full", data: lexical(
      styled("displaySM", text("Don't see your view? Build it.")),
      styled("proseSM", text("Open the full Atlas, toggle any of the 39 layers across all five modes, set your filters, then copy the share link to save your own preset.")),
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
    // Get involved — buttons removed (Alex 2026-07-16, closes ticket #134): the public-comment
    // map and dataset-request surfaces don't exist; dead '#' buttons only reset scroll. Route
    // everything to the Freight Planning inbox instead (mirrors the sandbox copy's card).
    { group: A.content, size: "4", border: "full", data: lexical(
      styled("kicker", text("get involved")),
      styled("displayXS", text("Have something to add?")),
      styled("proseSM", text("Public comments, dataset requests, corrections, or a source we should include — email the team below and they'll follow up.")),
      styled("metaSM", text("Freight Working Group & contacts via NYSDOT Freight Planning:")),
      styled("metaSM", text("dot.sm.mo.freightplan@dot.ny.gov")),
    )},
  ];
  build("2174665", "about", groups, sections); // slug swapped 2026-07-07 (#107): designed About & The Plan now lives at /about; legacy stub → about_deprecated (1479129)
}
