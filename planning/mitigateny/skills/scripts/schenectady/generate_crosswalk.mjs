import fs from 'fs';
const inv=JSON.parse(fs.readFileSync(new URL('./inventory.json',import.meta.url)));
const pages=JSON.parse(fs.readFileSync(new URL('./pages_all.json',import.meta.url)));
const title=id=>{const p=pages.find(x=>x.id===id);return p?p.title:id;};
const slug=id=>{const p=pages.find(x=>x.id===id);return p?p.slug:'';};

// slotId -> {src (1.0 section), conf, note}
const M={
 // About the Process
 "2266702":{src:"Planning Process › Planning Context / Local Orientation",conf:"High"},
 "2266704":{src:"Planning Process › Pre-Planning / Planning Teams",conf:"High"},
 "2266717":{src:"Planning Process › Pre-Planning / Outreach Strategy",conf:"High"},
 "2266731":{src:"Planning Process › Engagement / Public Participation",conf:"High"},
 "2266740":{src:"Planning Process › Plan Review and Submittal",conf:"Medium",note:"Source titled 'Plan Review & Submittal'; placed in the Public Comment slot (closest intent)."},
 "2266712":{src:"Planning Process › Local Resources (Technical Data + Existing Resources)",conf:"High"},
 "2266724":{src:"Planning Process › Plan Maintenance / Monitoring & Evaluating + Updating",conf:"High"},
 "2266722":{src:"Planning Process › Plan Maintenance (routine-meeting integration, LEPC, stormwater)",conf:"High"},
 "2266725":{src:"Planning Process › Plan Maintenance / Continued Public Engagement",conf:"High"},
 // People & Communities
 "2271041":{src:"Home / Plan Overview › Schenectady County Context (Location, History, Industries, Climate)",conf:"High"},
 "2266842":{src:"Home / Plan Overview › County Context / Governing Body Format",conf:"High"},
 "2266833":{src:"Risk › Vulnerability / Social Vulnerability (incl. survey comments)",conf:"High"},
 // Built Environment
 "2266850":{src:"Risk › Vulnerability / Built Environment (+ land use, flood risk)",conf:"High"},
 "2266866":{src:"Risk › Vulnerability / Critical Infrastructure",conf:"High"},
 // Natural Environment
 "2266764":{src:"Risk › Vulnerability / Natural Environment (intro)",conf:"High"},
 "2266785":{src:"Risk › Vulnerability / Natural Environment (Mohawk R., Normans Kill, Great Flats Aquifer)",conf:"High"},
 // NFIP
 "2267136":{src:"Risk › Floodplain Management / NFIP Statistics (snapshot)",conf:"High"},
 "2267142":{src:"Risk › Floodplain Management / NFIP Problem Areas (per-jurisdiction)",conf:"Medium",note:"Slot guidance asks about FIRM status; used the per-jurisdiction NFIP policy/claim narrative (best available)."},
 // HHD
 "2266726":{src:"Risk › Dam Safety / High Hazard Dams (County's Class C & B dams + classification)",conf:"High"},
 // Capabilities Assessment
 "2267039":{src:"Strategies › Capabilities / Capacity to Address Risk (CEMP, LEPC, SIMS, RTIM, MS4)",conf:"Medium",note:"Chapter has 4 category-specific Local Context slots (planning/admin/education/financial); the source narrative is not split that way, so the whole capacity narrative was placed in the first slot."},
 // Climate Change
 "2266732":{src:"Strategies › Capacity to Address Risk / Climate Smart Community",conf:"Medium",note:"Repurposed the Climate Smart Community capability narrative as the locally-grounded climate summary."},
 // Strategies
 "2267087":{src:"Strategies › Purpose / Local Orientation (county impact profile)",conf:"High"},
 "2267082":{src:"Strategies › Objectives / Goals & Objectives (Goals 1–4)",conf:"High"},
 "2267162":{src:"Risk › Vulnerability / Problem Areas (methodology + per-jurisdiction risk analysis)",conf:"High"},
 "2267053":{src:"Strategies › Objectives / Changes in Priorities",conf:"High"},
 "2267146":{src:"Strategies › Response / Displaced Residents",conf:"High"},
 "2267150":{src:"Strategies › Response / Evacuation Procedures",conf:"High"},
 "2267152":{src:"Strategies › Response / Shelters (Mass Care & Sheltering Annex)",conf:"High"},
 // Natural Hazards
 "2266803":{src:"Hazard profiles › All Hazards (hazards of concern by jurisdiction, probability, community input)",conf:"High"},
};
// hazard County Assessment / Local Hazard Summary ids -> source
const HZ={
 "2267684":"Flooding › Local Impacts","2267672":"Flooding › Featured event (Aug 29 2011, Western Gateway Bridge)",
 "2271721":"Avalanche › Local Impacts (not a hazard of concern)","2271961":"Coastal Hazards › Local Impacts (not a hazard of concern)",
 "2273532":"Hurricane › Local Impacts (not a hazard of concern)","2268427":"Drought › Local Impacts","2267914":"Earthquake › Local Impacts",
 "2267964":"Coldwave → Extreme Cold › Local Impacts","2268027":"Heat Wave → Extreme Heat › Local Impacts (+ NYSDOH HVI)",
 "2268371":"Hail › Local Impacts","2268855":"Ice Storm › Local Impacts","2268719":"Landslide › Local Impacts","2268781":"Lightning › Local Impacts",
 "2269243":"Snow Storm → Snowstorm › Local Impacts","2269080":"Tornado › Local Impacts","2269138":"Wildfire › Local Impacts","2269185":"Wind › Local Impacts",
};
for(const [id,src] of Object.entries(HZ)) M[id]={src, conf:"High"};

// build report
const order=[
 ["The Local Environment",["2265634","2265636","2265670","2265660","2265668"]],
 ["The Plan",["2265653","2265652","2265635"]],
 ["The Risk",["2265650","2265649","2265639","2265664"]],
 ["Natural Hazards (per-hazard pages)",["2265683","2265682","2265676","2265675","2265667","2265677","2265678","2265679","2265685","2265647","2265691","2265680","2265673","2265681","2265674","2265672"]],
 ["Track Progress",["2265690","2265663","2265659","2265656"]],
];
let filled=0,empty=0,pre=0;
let md=`# Schenectady County HMP → MitigateNY 2.0 — Crosswalk & Coverage Report\n\n`;
md+=`**Pattern:** 2275239 ("MitigateNY Schenectady Draft") · app \`mitigat-ny-prod\` · geoid 36093\n`;
md+=`**Generated:** 2026-07-21 · **Source:** MitigateNY 1.0 capture (\`references/schenectady/\`)\n`;
md+=`**State:** all fills written to \`draft_sections\` (unpublished); filled components carry \`status=shmp_sourced_content\`.\n\n`;
md+=`Confidence key — **High**: verbatim 1:1 block clearly matching the slot's intent. **Medium**: reasonable but the slot intent is broader/different than the source, or content placed in a best-available slot. **Low**: weak/indirect (none used).\n\n---\n\n## Part 1 — MNY 2.0 slots POPULATED (crosswalk)\n\n`;

const secBody=[];
for(const [sec,pids] of order){
  let sb=`\n### ${sec}\n`;
  for(const pid of pids){
    const e=inv[pid]; if(!e) continue;
    const fslots=e.slots.filter(s=>s.filled);
    if(!fslots.length) continue;
    sb+=`\n**${e.title}** — \`${e.slug}\`\n\n`;
    sb+=`| Slot | Source (MNY 1.0) | Confidence |\n|---|---|---|\n`;
    for(const s of fslots){
      const m=M[s.id];
      if(m){filled++;}else{pre++;}
      const src=m?m.src:"_(pre-existing fill — not from this task)_";
      const conf=m?m.conf:"—";
      sb+=`| ${s.title||"(untitled)"} | ${src}${m&&m.note?` — _${m.note}_`:""} | ${conf} |\n`;
    }
  }
  secBody.push(sb);
}
md+=secBody.join("");

// Part 2 — empty slots per page
md+=`\n---\n\n## Part 2 — MNY 2.0 slots LEFT EMPTY\n\nLeft empty because the MNY 1.0 source carries no matching county-specific prose (strict/faithful — invent nothing).\n\n`;
const allPages=[...order.flatMap(o=>o[1])];
for(const pid of allPages){
  const e=inv[pid]; if(!e)continue;
  const es=e.slots.filter(s=>!s.filled);
  empty+=es.length;
  if(es.length) md+=`- **${e.title}** (${es.length} empty): ${es.map(s=>s.title||"(untitled)").join(", ")}\n`;
}

// Part 3 — 1.0 sections not carried over
md+=`\n---\n\n## Part 3 — MNY 1.0 content NOT carried into 2.0\n\n`;
md+=`### A. Data-driven content (intentionally not transcribed — rendered by 2.0 data components auto-filtered to geoid 36093)\n`;
md+=`- Home/Overview: Hazard Loss, Annual Average Loss by Hazard, Hazard Events counts, NFIP Claims, Critical Assets in Floodplain.\n`;
md+=`- Capabilities table, Proposed/Additional Actions tables, Problem Statements table, Mitigation & Planning Participants tables, Meetings table, Adoption table, Previous Actions, NFIP Compliance table, Shelter table, Open Space Statistics.\n`;
md+=`- Per-hazard Built Environment / Critical Facilities / Hazards-of-Concern / Highest-Loss tables, and all interactive maps.\n\n`;
md+=`### B. Boilerplate / generic framing (not transcribed — covered by the 2.0 template's shared "LHMP_IA" narrative cards)\n`;
md+=`- Risk › Purpose / About Risk & Vulnerability; Strategies › About Strategies; Capabilities › Overview (generic definition); Environmental & Historic Preservation (generic FEMA EHP text); Dam Safety generic dam framing; Open Space generic definitions & CRS explanation; About the Plan › Disclaimer.\n\n`;
md+=`### C. Empty in the 1.0 source (heading present, no body)\n`;
md+=`- Planning Process: Federal/State/County Representation, Regional Representation, Jurisdictional Representation, Jurisdictional Engagement.\n`;
md+=`- About the Plan: Public Participation Survey, Public Comment, Appendices.\n`;
md+=`- Strategies › Response: Temporary Housing and Relocation (heading only).\n\n`;
md+=`### D. No matching 2.0 page (dropped)\n`;
md+=`- Hazard profiles **Tsunami/Seiche** and **Volcano** — no template hazard page (both "not a hazard of concern").\n\n`;
md+=`### E. Candidates left empty that MAY warrant follow-up (source prose exists but wasn't a clean slot fit)\n`;
md+=`- NFIP page › **Community Rating System** slot — 1.0 has no dedicated CRS narrative (CRS is discussed generically under Open Space).\n`;
md+=`- Strategies › **Funding Sources**, **Capabilities Highlights**, and the "implementation over last 5 years" Local Context — 1.0 has an Implementation Resources / NFIP Continued Compliance & Repetitive Loss Strategy section (Strategies › Implementation) that was NOT transcribed; could feed these.\n`;
md+=`- Built Environment sub-topic Local Contexts (water/transportation/energy/communications infrastructure, Historic Properties, Codes Enforcement, What's Changed) — 1.0 has no topic-specific prose.\n`;
md+=`- People & Communities: Transient/Seasonal Populations, Population Change, Special Districts, Economic/Neighboring Local Contexts — no distinct 1.0 prose.\n\n`;
md+=`### F. Deferred scope\n`;
md+=`- **7 jurisdictional annexes** (Delanson, Duanesburg, Glenville, Niskayuna, Princetown, Rotterdam, Scotia) — 2.0 form pages, separate mechanism.\n`;
md+=`- **Top-level landing pages** (The Risk / The Local Environment / The Plan) — auth-gated over read access; their Executive-Summary slots could not be filled.\n\n`;

// full-inventory totals (all 41 content pages, not just the grouped ones above)
let totAll=0, filledAll=0;
for(const pid of Object.keys(inv)){ for(const s of inv[pid].slots){ totAll++; if(s.filled) filledAll++; } }
const preAll=filledAll-filled;
md+=`---\n\n## Totals (all ${Object.keys(inv).length} content pages)\n\n`;
md+=`- MNY 2.0 Annotation slots total: **${totAll}**\n`;
md+=`- Populated by this task: **${filled}** (verbatim from 1.0, \`status=shmp_sourced_content\`)\n`;
md+=`- Pre-existing fills (not this task): **${preAll}**\n`;
md+=`- Left empty: **${totAll-filledAll}**\n`;

fs.writeFileSync(new URL('../CROSSWALK_REPORT.md',import.meta.url), md);
console.log(`crosswalk written. populated(this task)=${filled} pre-existing=${pre} empty=${empty}`);
