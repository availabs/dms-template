/* eslint-disable */
// Grid system — TransportNY Design System documentation page.
//
// Goal: define the underlying grid + container system so every page in the
// product family lays out from the same primitives. Eliminates per-page
// custom width / padding math, and makes "is this a doc page or a workbench
// page?" answerable in one glance.

const { useState } = React;
const Icon = window.TNYIcon;

/* ─── Sidebar — uses shared TNYSidebar to match Theme/Components/Patterns ───
   The four design-system pages (Theme, Grid, Components, Patterns) share the
   same chrome and link to each other. Grid is active here. */
const DS_NAV = [
  { id:'theme',      label:'Theme',      icon:'Sections',  onClick:'theme.html' },
  { id:'grid',       label:'Grid',       icon:'Grid' },
  { id:'components', label:'Components', icon:'Pages',     onClick:'components.html' },
  { id:'patterns',   label:'Patterns',   icon:'MapLayers', onClick:'patterns.html' },
];

/* ─── (TopNav removed — breadcrumbs now live inside <TNYPageHeader>) ── */

/* ─── (PageHero removed — use <TNYPageHeader tone="hero"> in App) ── */

/* ─── Section header ───────────────────────────────────────── */
function SectionHead({ num, kicker, title, sub, right }) {
  return (
    <div className="flex items-end justify-between gap-8 mb-6">
      <div>
        <div className="flex items-center gap-3 mb-1.5">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-[#CA8A04]">{num}</span>
          <span className="font-oswald uppercase text-[11px] tracking-[0.18em] text-slate-500">{kicker}</span>
        </div>
        <h2 className="font-oswald font-medium text-[24px] text-[#0f1722] leading-tight">{title}</h2>
        {sub && <p className="font-proxima text-slate-600 text-[13.5px] leading-[1.6] mt-2 max-w-[680px]">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

/* ─── Section 1 — Foundations: container widths ─────────── */
const CONTAINERS = [
  { id: 'narrow',  px: 480,  cls: 'max-w-[480px]',  use: 'Sign-in, single-field forms, modals', archetype: 'Form' },
  { id: 'prose',   px: 720,  cls: 'max-w-[720px]',  use: 'Editorial, docs, changelogs, methodology pages', archetype: 'Editorial' },
  { id: 'split',   px: 1024, cls: 'max-w-[1024px]', use: 'Two-pane layouts (TOC + body, list + detail)', archetype: 'Split' },
  { id: 'marketing', px: 1280, cls: 'max-w-[1280px]', use: 'Landing page, marketing, public surfaces', archetype: 'Marketing' },
  { id: 'data',    px: 1480, cls: 'max-w-[1480px]', use: 'Dashboards, MAP-21 PM3, data-dense pages', archetype: 'Data dashboard' },
  { id: 'workbench', px: null, cls: 'w-full',       use: 'Map + inspector, full editor canvases', archetype: 'Workbench' },
];

function ContainerCatalog() {
  return (
    <div className="bg-white border border-zinc-950/08 rounded-lg overflow-hidden">
      <div className="px-5 py-3 border-b border-zinc-950/08 bg-slate-50 flex items-center justify-between">
        <div className="font-oswald uppercase text-[11px] tracking-[0.18em] text-slate-600">Container catalog · max-width tokens</div>
        <div className="font-mono text-[10.5px] uppercase tracking-wider text-slate-500">6 sizes</div>
      </div>
      <table className="w-full text-[13px]">
        <thead className="bg-white">
          <tr>
            {['Token','Max width','Tailwind class','Used for','Archetype'].map(h => (
              <th key={h} className="text-left font-oswald uppercase text-[10.5px] tracking-[0.12em] text-slate-500 px-5 py-2.5 border-b border-zinc-950/08">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CONTAINERS.map(c => (
            <tr key={c.id} className="border-b border-zinc-950/05 last:border-b-0 hover:bg-amber-50/30">
              <td className="px-5 py-3"><span className="font-mono text-[12px] text-[#0f1722]">--ds-container-{c.id}</span></td>
              <td className="px-5 py-3 font-mono tabular-nums text-[12px] text-[#0f1722]">{c.px ? c.px + ' px' : '100%'}</td>
              <td className="px-5 py-3 font-mono text-[12px] text-[#37576B]">{c.cls}</td>
              <td className="px-5 py-3 text-slate-600">{c.use}</td>
              <td className="px-5 py-3"><span className="font-oswald uppercase text-[11px] tracking-wide px-2 py-0.5 rounded bg-slate-100 text-slate-700">{c.archetype}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* Visual stack — each container drawn at scale, all left-aligned to the
   work-area edge so you can see they share an origin. */
function ContainerVisualizer() {
  // Main content area assumed at 1232px wide here (= max we can show, with some breathing).
  // Render each container's actual width relative to the parent box (max 1280 -> ~96%).
  const WORK = 1232;
  return (
    <div className="bg-white border border-zinc-950/08 rounded-lg p-6">
      <div className="flex items-end justify-between mb-4">
        <div className="font-oswald uppercase text-[11px] tracking-[0.18em] text-slate-600">Width comparison · all left-aligned</div>
        <div className="font-mono text-[10.5px] uppercase tracking-wider text-slate-500">main content area · {WORK}px ref</div>
      </div>
      <div className="relative diagram-light rounded border border-zinc-950/08 p-4 overflow-hidden">
        {/* work area baseline */}
        <div className="absolute left-4 right-4 top-0 bottom-0 border-l border-r border-dashed border-zinc-950/15"/>
        <div className="absolute -top-[1px] left-4 right-4 flex items-center justify-between font-mono text-[9.5px] uppercase tracking-wider text-slate-400">
          <span className="bg-white px-1 -mt-2">main content area</span>
          <span className="bg-white px-1 -mt-2">{WORK}px</span>
        </div>
        <div className="space-y-3 mt-3">
          {CONTAINERS.map(c => {
            const pct = c.px ? Math.min(100, (c.px / WORK) * 100) : 100;
            return (
              <div key={c.id} className="flex items-center gap-3">
                <div className="w-28 flex-shrink-0">
                  <div className="font-oswald uppercase text-[12px] tracking-wide text-[#0f1722]">{c.id}</div>
                  <div className="font-mono text-[10px] text-slate-500 tabular-nums">{c.px ? c.px + 'px' : 'fluid'}</div>
                </div>
                <div className="flex-1 relative h-8">
                  <div className="absolute inset-y-0 left-0 box-fill rounded-sm flex items-center px-2" style={{ width: pct + '%' }}>
                    <span className="font-mono text-[10px] text-[#37576B] tabular-nums">{pct.toFixed(0)}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3 font-mono text-[10.5px] uppercase tracking-wider text-slate-500">
        <span className="flex items-center gap-1.5"><span className="block w-3 h-3 box-fill"/>container width</span>
        <span className="flex items-center gap-1.5"><span className="block w-3 h-3 border border-dashed border-zinc-950/30"/>main content edge</span>
      </div>
    </div>
  );
}

/* ─── Scope diagram — sidebar (out of system) + main content (gridded) ──── */
function ScopeDiagram() {
  return (
    <div className="bg-white border border-zinc-950/08 rounded-lg p-6">
      <div className="flex items-end justify-between mb-4">
        <div className="font-oswald uppercase text-[11px] tracking-[0.18em] text-slate-600">Viewport anatomy</div>
        <div className="font-mono text-[10.5px] uppercase tracking-wider text-slate-500">sidebar · chrome | main content · grid</div>
      </div>
      <div className="relative diagram-light rounded border border-zinc-950/08 p-4">
        {/* viewport outer label */}
        <div className="absolute -top-2 left-3 px-1 bg-[#fbfbfc] font-mono text-[9.5px] uppercase tracking-wider text-slate-400">viewport</div>

        {/* Row 1 — compact sidebar */}
        <div className="mb-4">
          <div className="flex items-stretch gap-2">
            <div className="w-[60px] flex-shrink-0">
              <div className="border border-zinc-950/20 bg-[#0a0e13] rounded-sm h-[150px] flex items-center justify-center">
                <span className="font-mono text-[9px] uppercase tracking-wider text-white/70 [writing-mode:vertical-rl] rotate-180">sidebar · 60</span>
              </div>
              <div className="mt-1 font-mono text-[9px] uppercase tracking-wider text-slate-500 text-center">out of grid</div>
            </div>
            <div className="flex-1 relative">
              <div className="box-fill h-[150px] rounded-sm flex items-center justify-center relative overflow-hidden">
                {/* gridded fill */}
                <div className="absolute inset-0 grid grid-cols-12 gap-2 px-3">
                  {Array.from({length: 12}).map((_,i) => <div key={i} className="border-l border-r border-dashed border-[#37576B]/30 h-full"/>)}
                </div>
                <span className="relative font-oswald uppercase text-[12px] tracking-wider text-[#37576B] bg-white/80 px-2 py-0.5 rounded">main content area · 12-col grid applies</span>
              </div>
              <div className="mt-1 font-mono text-[9px] uppercase tracking-wider text-[#CA8A04] text-center">grid governs this region</div>
            </div>
          </div>
          <div className="mt-2 font-mono text-[10px] uppercase tracking-wider text-slate-500 text-right">sidebar compact · 60 px</div>
        </div>

        {/* Row 2 — expanded sidebar */}
        <div>
          <div className="flex items-stretch gap-2">
            <div className="w-[240px] flex-shrink-0">
              <div className="border border-zinc-950/20 bg-[#0a0e13] rounded-sm h-[150px] flex items-center justify-center">
                <span className="font-mono text-[10px] uppercase tracking-wider text-white/70">sidebar · 240</span>
              </div>
              <div className="mt-1 font-mono text-[9px] uppercase tracking-wider text-slate-500 text-center">out of grid</div>
            </div>
            <div className="flex-1 relative">
              <div className="box-fill h-[150px] rounded-sm flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 grid grid-cols-12 gap-2 px-3">
                  {Array.from({length: 12}).map((_,i) => <div key={i} className="border-l border-r border-dashed border-[#37576B]/30 h-full"/>)}
                </div>
                <span className="relative font-oswald uppercase text-[12px] tracking-wider text-[#37576B] bg-white/80 px-2 py-0.5 rounded">main content area · 12-col grid applies</span>
              </div>
              <div className="mt-1 font-mono text-[9px] uppercase tracking-wider text-[#CA8A04] text-center">grid governs this region</div>
            </div>
          </div>
          <div className="mt-2 font-mono text-[10px] uppercase tracking-wider text-slate-500 text-right">sidebar expanded · 240 px</div>
        </div>
      </div>

      {/* Rule box */}
      <div className="mt-4 grid grid-cols-3 gap-3 text-[12.5px]">
        {[
          { k: 'Sidebar', v: 'Takes 60 / 240 px. Owns its own colour, spacing, and density. The grid does not extend into it.' },
          { k: 'Main content', v: '100% of the remaining viewport. The 12-column grid, container tokens, and section padding all measure against this width.' },
          { k: 'Breakpoints', v: 'Measured against the main content area, not the viewport. A 1200 px viewport with a 240 px sidebar reads as 960 px content — the `sm` breakpoint.' },
        ].map(b => (
          <div key={b.k} className="border border-zinc-950/08 rounded p-3">
            <div className="font-oswald uppercase text-[11px] tracking-wide text-[#0f1722] mb-1">{b.k}</div>
            <p className="text-slate-600 leading-[1.5]">{b.v}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Section 2 — 12-column grid demo ─────────────────────── */
function ColumnGridDemo() {
  const N = 12;
  return (
    <div className="bg-white border border-zinc-950/08 rounded-lg p-6">
      <div className="flex items-end justify-between mb-4">
        <div>
          <div className="font-oswald uppercase text-[11px] tracking-[0.18em] text-slate-600">12-column grid</div>
          <div className="font-mono text-[10.5px] uppercase tracking-wider text-slate-500 mt-0.5">columns · gutter · margin</div>
        </div>
        <div className="font-mono text-[10.5px] uppercase tracking-wider text-slate-500 flex items-center gap-3">
          <span><span className="text-[#37576B] font-semibold">12</span> cols</span>
          <span><span className="text-[#CA8A04] font-semibold">24px</span> gutter</span>
          <span><span className="text-[#37576B] font-semibold">32px</span> margin</span>
        </div>
      </div>

      {/* the grid itself */}
      <div className="rounded border border-zinc-950/08 diagram-light p-0 overflow-hidden">
        {/* margin · gutter · 12-col strip */}
        <div className="grid items-stretch h-[120px]" style={{ gridTemplateColumns: '32px repeat(11, minmax(0,1fr) 24px) minmax(0,1fr) 32px' }}>
          {/* L margin */}
          <div className="hatch h-full relative">
            <div className="absolute top-1 left-1/2 -translate-x-1/2 tag-anno">M</div>
          </div>
          {Array.from({ length: N }).flatMap((_, i) => {
            const items = [
              <div key={'c'+i} className="box-fill flex items-center justify-center font-mono text-[11px] tabular-nums text-[#37576B] h-full">{i+1}</div>
            ];
            if (i < N - 1) items.push(<div key={'g'+i} className="hatch h-full"/>);
            return items;
          })}
          {/* R margin */}
          <div className="hatch h-full relative">
            <div className="absolute top-1 left-1/2 -translate-x-1/2 tag-anno">M</div>
          </div>
        </div>

        {/* example spans */}
        <div className="border-t border-zinc-950/08 p-4 space-y-2">
          {[
            { spans: [{ s:12, lbl:'12 / span-full · full width section' }] },
            { spans: [{ s:8, lbl:'8 · body' }, { s:4, lbl:'4 · sidebar' }] },
            { spans: [{ s:6, lbl:'6 · pane A' }, { s:6, lbl:'6 · pane B' }] },
            { spans: [{ s:4, lbl:'4 · card' }, { s:4, lbl:'4 · card' }, { s:4, lbl:'4 · card' }] },
            { spans: [{ s:3, lbl:'3' }, { s:3, lbl:'3' }, { s:3, lbl:'3' }, { s:3, lbl:'3' }] },
          ].map((row, ri) => (
            <div key={ri} className="grid items-stretch h-9" style={{ gridTemplateColumns: 'repeat(12, minmax(0,1fr))', columnGap: '24px' }}>
              {row.spans.map((sp, i) => (
                <div key={i} className="box-fill-3 flex items-center px-2 font-mono text-[11px] text-slate-600 rounded-sm" style={{ gridColumn: `span ${sp.s}` }}>
                  {sp.lbl}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* breakpoint reduction note */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="font-oswald uppercase text-[11px] tracking-[0.18em] text-slate-600">Breakpoints</span>
          <span className="font-mono text-[10.5px] uppercase tracking-wider text-slate-500">measured on the main content area, not the viewport</span>
        </div>
        <div className="grid grid-cols-4 gap-3">
        {[
          { bp:'xs', w:'< 720', cols:4,  gutter:16, margin:24 },
          { bp:'sm', w:'720–1024',  cols:8,  gutter:20, margin:24 },
          { bp:'md', w:'1024–1280', cols:12, gutter:24, margin:32 },
          { bp:'lg', w:'≥ 1280',    cols:12, gutter:32, margin:48 },
        ].map(b => (
          <div key={b.bp} className="border border-zinc-950/08 rounded p-3">
            <div className="flex items-center justify-between">
              <span className="font-oswald uppercase text-[12px] tracking-wide text-[#0f1722]">{b.bp}</span>
              <span className="font-mono text-[10px] text-slate-500">{b.w} px</span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-y-1 text-[11px]">
              <span className="text-slate-500">cols</span><span className="col-span-2 font-mono text-[#0f1722] tabular-nums text-right">{b.cols}</span>
              <span className="text-slate-500">gutter</span><span className="col-span-2 font-mono text-[#0f1722] tabular-nums text-right">{b.gutter} px</span>
              <span className="text-slate-500">margin</span><span className="col-span-2 font-mono text-[#0f1722] tabular-nums text-right">{b.margin} px</span>
            </div>
          </div>
        ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Section 3 — Vertical rhythm / section padding ──────── */
function SectionPaddingScale() {
  const scale = [
    { tok:'tight',     v:24,  use:'between list items, in dense tables' },
    { tok:'compact',   v:32,  use:'inner page sections, related blocks' },
    { tok:'comfortable',v:48, use:'default page sections (most pages)' },
    { tok:'roomy',     v:72,  use:'editorial / docs page sections' },
    { tok:'feature',   v:96,  use:'landing-style sections w/ breathing room' },
  ];
  return (
    <div className="bg-white border border-zinc-950/08 rounded-lg p-6">
      <div className="flex items-end justify-between mb-4">
        <div className="font-oswald uppercase text-[11px] tracking-[0.18em] text-slate-600">Vertical section padding</div>
        <div className="font-mono text-[10.5px] uppercase tracking-wider text-slate-500">y-axis breathing room between sections</div>
      </div>
      <div className="grid grid-cols-5 gap-3">
        {scale.map(s => (
          <div key={s.tok} className="border border-zinc-950/08 rounded overflow-hidden">
            <div className="diagram-light" style={{ paddingTop: s.v, paddingBottom: s.v }}>
              <div className="mx-3 h-8 box-fill rounded-sm flex items-center justify-center font-mono text-[11px] text-[#37576B]">content</div>
            </div>
            <div className="px-3 py-2 border-t border-zinc-950/08 bg-slate-50 flex items-center justify-between">
              <span className="font-oswald uppercase text-[11px] tracking-wide text-[#0f1722]">{s.tok}</span>
              <span className="font-mono text-[11px] tabular-nums text-slate-600">{s.v} px</span>
            </div>
            <div className="px-3 py-2 text-[11.5px] text-slate-600 leading-snug">{s.use}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── (Section 4 — Page archetypes — moved to patterns.html) ── */

/* ─── Section 4 — Surfaces (background + card rule) ──────── */
function SurfaceRule() {
  return (
    <div className="space-y-5">
      {/* Visual comparison */}
      <div className="grid grid-cols-2 gap-4">
        {/* WRONG */}
        <div>
          <div className="font-oswald uppercase text-[11px] tracking-[0.18em] text-rose-700 mb-2 flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-rose-500"/> wall-to-wall white
          </div>
          <div className="rounded-md border border-rose-300/60 overflow-hidden diagram-light">
            <div className="flex h-[280px]">
              <div className="w-14 bg-[#12181F] flex flex-col items-center pt-3 gap-2 flex-shrink-0">
                <div className="size-7 rounded bg-[#0a0e13]"/>
                <div className="w-8 h-6 rounded bg-[#1e2530] border-l-2 border-yellow-400 -ml-0.5 self-start mt-2"/>
                <div className="w-8 h-1 rounded bg-[#2a3545] mt-1"/>
                <div className="w-8 h-1 rounded bg-[#2a3545]"/>
              </div>
              <div className="flex-1 bg-white relative flex flex-col">
                <div className="px-5 py-4 border-b border-zinc-950/05 bg-white">
                  <div className="font-mono text-[8.5px] uppercase tracking-wider text-slate-400 mb-1">// 01 section</div>
                  <div className="h-3 w-32 bg-slate-200 rounded mb-1.5"/>
                  <div className="h-2 w-48 bg-slate-100 rounded"/>
                </div>
                <div className="px-5 py-4 border-b border-zinc-950/05 bg-white flex-1">
                  <div className="font-mono text-[8.5px] uppercase tracking-wider text-slate-400 mb-1">// 02 section</div>
                  <div className="h-3 w-28 bg-slate-200 rounded mb-1.5"/>
                  <div className="h-2 w-40 bg-slate-100 rounded"/>
                </div>
                <span className="absolute top-1.5 right-1.5 tag-anno-dark" style={{background:'#EF4444', color:'#fff'}}>NO SEAM · NO MASS</span>
              </div>
            </div>
          </div>
          <ul className="mt-3 text-[12.5px] text-slate-700 space-y-1 list-disc pl-4">
            <li>White touches the sidebar edge-to-edge — sections lose their shape</li>
            <li>Hairline borders alone can&apos;t carry hierarchy on a flat plane</li>
            <li>Cards stop reading as cards because they have nothing to float on</li>
          </ul>
        </div>

        {/* RIGHT */}
        <div>
          <div className="font-oswald uppercase text-[11px] tracking-[0.18em] text-emerald-700 mb-2 flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-emerald-500"/> cards float on the pane
          </div>
          <div className="rounded-md border border-emerald-300/50 overflow-hidden">
            <div className="flex h-[280px]">
              <div className="w-14 bg-[#12181F] flex flex-col items-center pt-3 gap-2 flex-shrink-0">
                <div className="size-7 rounded bg-[#0a0e13]"/>
                <div className="w-8 h-6 rounded bg-[#1e2530] border-l-2 border-yellow-400 -ml-0.5 self-start mt-2"/>
                <div className="w-8 h-1 rounded bg-[#2a3545] mt-1"/>
                <div className="w-8 h-1 rounded bg-[#2a3545]"/>
              </div>
              <div className="flex-1 relative flex flex-col gap-2.5 p-3" style={{background:'#ECEEF2'}}>
                <div className="rounded border border-zinc-950/10 bg-white px-4 py-3 shadow-sm">
                  <div className="font-mono text-[8.5px] uppercase tracking-wider text-[#CA8A04] mb-1">// 01 section</div>
                  <div className="h-3 w-32 bg-slate-200 rounded mb-1.5"/>
                  <div className="h-2 w-48 bg-slate-100 rounded"/>
                </div>
                <div className="rounded border border-zinc-950/10 bg-white px-4 py-3 shadow-sm flex-1">
                  <div className="font-mono text-[8.5px] uppercase tracking-wider text-[#CA8A04] mb-1">// 02 section</div>
                  <div className="h-3 w-28 bg-slate-200 rounded mb-1.5"/>
                  <div className="h-2 w-40 bg-slate-100 rounded"/>
                </div>
                <span className="absolute top-1.5 right-1.5 tag-anno">PANE · CARD · CARD</span>
              </div>
            </div>
          </div>
          <ul className="mt-3 text-[12.5px] text-slate-700 space-y-1 list-disc pl-4">
            <li>Section background is <code className="tny-mono">.tny-pane</code> (<code className="tny-mono">#ECEEF2</code>) — the pane wraps the main content area edge-to-edge</li>
            <li>Content lives in a <code className="tny-mono">.tny-card</code>: white fill, 8 px radius, 1 px hairline, soft shadow</li>
            <li>The gap between cards (12–24 px) is the pane showing through — that&apos;s the seam</li>
          </ul>
        </div>
      </div>

      {/* Surface tokens */}
      <div className="bg-white border border-zinc-950/08 rounded-lg overflow-hidden">
        <div className="bg-slate-50 border-b border-zinc-950/08 px-5 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-slate-500">Surface tokens</div>
        <table className="w-full text-[12.5px]">
          <thead>
            <tr>
              {['Surface','Class','Hex','Use','Where it appears'].map(h => (
                <th key={h} className="text-left font-oswald uppercase text-[10.5px] tracking-[0.12em] text-slate-500 px-5 py-2.5 border-b border-zinc-950/08">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { label:'Pane',       cls:'.tny-pane',      hex:'#ECEEF2', use:'Page background under every section. The default surface for the main content area.', where:'<body>, <section> backgrounds' },
              { label:'Pane tint',  cls:'.tny-pane-tint', hex:'#E4E8EE', use:'Alternating sections when you need rhythm without breaking the pane→card stack.', where:'Every other section on long pages' },
              { label:'Card',       cls:'.tny-card',      hex:'#FFFFFF', use:'Default content surface. Use for any meaningful unit of content inside a section.', where:'Section interiors, KPI cards, panels' },
              { label:'Card tint',  cls:'.tny-card-tint', hex:'#FAFBFC', use:'Inner panels inside a card — example surfaces, footer strips, ghost rows.', where:'Card sub-zones, secondary states' },
              { label:'Bone',       cls:'.tny-card-bone', hex:'#F5F1E8', use:'Editorial / printable narrative cards only — jurisdictional profile, methodology docs.', where:'Document templates, report card' },
            ].map(s => (
              <tr key={s.label} className="border-b border-zinc-950/05 last:border-b-0 hover:bg-amber-50/30">
                <td className="px-5 py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="size-5 rounded border border-zinc-950/10 flex-shrink-0" style={{background:s.hex}}/>
                    <span className="font-oswald uppercase text-[12.5px] tracking-[0.04em] text-[#0f1722] font-semibold">{s.label}</span>
                  </div>
                </td>
                <td className="px-5 py-2.5 font-mono text-[11.5px] text-[#37576B]">{s.cls}</td>
                <td className="px-5 py-2.5 font-mono text-[11.5px] tabular-nums text-slate-500">{s.hex}</td>
                <td className="px-5 py-2.5 text-slate-600 text-[12.5px] leading-[1.5] max-w-[420px]">{s.use}</td>
                <td className="px-5 py-2.5 text-slate-500 text-[11.5px] font-mono">{s.where}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Rules */}
      <div className="grid grid-cols-2 gap-6 pt-2">
        <div>
          <div className="font-oswald uppercase text-[11px] text-emerald-700 tracking-wider mb-2">Do</div>
          <ul className="text-[12.5px] text-slate-700 space-y-1.5 list-disc pl-4">
            <li>Set <code className="tny-mono">background</code> on every <code className="tny-mono">&lt;section&gt;</code> to <code className="tny-mono">.tny-pane</code> (or <code className="tny-mono">.tny-pane-tint</code>) — never white, never card</li>
            <li>Put content inside a card with a visible edge: 1 px hairline + 8 px radius + <code className="tny-mono">shadow-sm</code></li>
            <li>Use <code className="tny-mono">.tny-pane-tint</code> for alternating sections when you need rhythm without breaking the pane→card stack</li>
            <li>For lightweight summary strips (kicker + a row of inline stats), text directly on the pane is fine — no card needed if there&apos;s no body</li>
          </ul>
        </div>
        <div>
          <div className="font-oswald uppercase text-[11px] text-rose-700 tracking-wider mb-2">Don&apos;t</div>
          <ul className="text-[12.5px] text-slate-700 space-y-1.5 list-disc pl-4">
            <li>Set <code className="tny-mono">bg-white</code> on a section — that breaks the seam between sections and makes cards inside read as flat dividers</li>
            <li>Alternate sections white-then-pane — alternate pane-then-pane-tint instead</li>
            <li>Nest cards on cards (white-on-white). If you need a sub-surface, use <code className="tny-mono">.tny-card-tint</code></li>
            <li>Pull the card edge-to-edge with the sidebar — keep at least the section&apos;s page-margin gutter between them</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ─── Section 5 — Composition rules + anti-patterns ──────── */
function RulesPanel() {
  const rules = [
    { do: 'Pick a container token from the catalog — do not invent widths.', dont: 'A page using `max-w-[920px]` because "it looked right." That width is not in the system.' },
    { do: 'Sections stack vertically with one `section-padding` token per page.', dont: 'Mixing `py-8`, `py-12`, and `py-20` between sibling sections on the same page.' },
    { do: 'Below 720 px, collapse 12-col rows to 4-col stacks.', dont: 'Forcing a 4-col KPI row to keep 4 columns on mobile.' },
    { do: 'Page padding-x and section spacing are responsive — they shrink at smaller breakpoints (48 → 24).', dont: 'Hard-coding `px-12` everywhere.' },
    { do: 'Workbench pages (A5) get one container; everything inside hugs the edges.', dont: 'Adding `max-w-1280px` inside a workbench — re-introduces a gutter that fights the canvas.' },
    { do: 'Hero band can be full-bleed even on a `data` container page.', dont: 'A hero card with `rounded-lg` and a 32 px outer margin — it never looks anchored.' },
  ];
  return (
    <div className="bg-white border border-zinc-950/08 rounded-lg overflow-hidden">
      <div className="px-5 py-3 border-b border-zinc-950/08 bg-slate-50 flex items-center justify-between">
        <span className="font-oswald uppercase text-[11px] tracking-[0.18em] text-slate-600">Composition rules</span>
        <span className="font-mono text-[10.5px] uppercase tracking-wider text-slate-500">do · don&apos;t</span>
      </div>
      <div className="divide-y divide-zinc-950/05">
        {rules.map((r, i) => (
          <div key={i} className="grid grid-cols-2 gap-0">
            <div className="p-4 border-r border-zinc-950/05">
              <div className="flex items-start gap-2">
                <span className="size-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-mono text-[11px] flex-shrink-0">✓</span>
                <div>
                  <div className="font-mono text-[9.5px] uppercase tracking-wider text-emerald-700 mb-0.5">Do</div>
                  <p className="text-[13px] text-slate-700 leading-[1.55]">{r.do}</p>
                </div>
              </div>
            </div>
            <div className="p-4 bg-red-50/30">
              <div className="flex items-start gap-2">
                <span className="size-5 rounded-full bg-red-100 text-red-700 flex items-center justify-center font-mono text-[12px] flex-shrink-0">×</span>
                <div>
                  <div className="font-mono text-[9.5px] uppercase tracking-wider text-red-700 mb-0.5">Don&apos;t</div>
                  <p className="text-[13px] text-slate-700 leading-[1.55]">{r.dont}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── App ─────────────────────────────────────────────────── */
function App() {
  return (
    <div className="min-h-screen bg-[#f1f3f6]">
      <TNYSidebar product="DESIGN" active="grid" expanded={true} nav={DS_NAV}/>
      <main data-screen-label="Grid & layout" className="ml-60">
        <TNYPageHeader
          tone="hero"
          kicker="// design system"
          meta="v0.2 · grid & layout"
          title="Grid"
          accent="."
          desc="The container, column, and page-padding tokens every TransportNY page composes from. Pages are not pixel-by-pixel custom — they pick one container, one section-padding scale, and arrange children on the 12-column grid. The sidebar is out of scope; the grid lives in the main content area to the right of it."
        />

        <div className="px-8 py-7 space-y-10 max-w-[1480px]">
          {/* 00 — Scope */}
          <section>
            <SectionHead num="// 00" kicker="Scope" title={<>The grid governs the <span className="text-[#CA8A04]">main content area</span> only.</>}
              sub="The sidebar is fixed-width chrome and lives outside the system. Whatever its current width — 60 px compact, 240 px expanded, 0 px when hidden — the main content area takes the remaining viewport. Every container token below is measured against that area, not the viewport." />
            <ScopeDiagram/>
          </section>

          {/* 01 — Foundations */}
          <section>
            <SectionHead num="// 01" kicker="Foundations" title="Container catalog & width tokens"
              sub="Pick one of six containers per page; do not invent widths. The token name carries intent (`narrow` is for forms, `data` is for dashboards), so engineers and designers reach for the same one for the same job." />
            <div className="space-y-4">
              <ContainerCatalog/>
              <ContainerVisualizer/>
            </div>
          </section>

          {/* 02 — Grid */}
          <section>
            <SectionHead num="// 02" kicker="Columns" title="12-column grid · gutters · breakpoints"
              sub="Inside any container, the page composes on a 12-column grid with a 24 px gutter and a 32 px page margin (at the `lg` breakpoint). Lower breakpoints reduce the column count and gutter together — never independently." />
            <ColumnGridDemo/>
          </section>

          {/* 03 — Section padding */}
          <section>
            <SectionHead num="// 03" kicker="Vertical rhythm" title="Section-padding scale"
              sub="One token per page. Pick the scale that matches the page's reading vs scanning ratio: dashboards scan, so `comfortable` (48 px); editorial reads, so `roomy` (72 px); landings perform, so `feature` (96 px)." />
            <SectionPaddingScale/>
          </section>

          {/* 04 — Surfaces */}
          <section>
            <SectionHead num="// 04" kicker="Surfaces" title="Page pane, section background & cards"
              sub="The pane is the page background. Every section sits on it without changing it. Real content lives inside cards — that&apos;s where the white comes from. Get this wrong and the page reads as one undifferentiated white plane; get it right and every meaningful unit picks up a visible edge for free." />
            <SurfaceRule/>
          </section>

          {/* 05 — Composition rules */}
          <section>
            <SectionHead num="// 05" kicker="Composition" title="Rules & anti-patterns"
              sub="Page-level compositions — when to use which container, how to stack sections, how to keep the workbench from fighting the canvas — live on the Patterns page. The rules below are about the primitives themselves." />
            <RulesPanel/>
          </section>

          {/* 05 — Cross-ref */}
          <section>
            <div className="bg-white border border-zinc-950/08 rounded-lg p-6 flex items-center justify-between gap-6">
              <div>
                <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-[#CA8A04] mb-1">// next</div>
                <div className="font-oswald font-medium text-[20px] text-[#0f1722] leading-tight">Looking for page recipes?</div>
                <p className="text-[13px] text-slate-600 leading-[1.55] mt-1 max-w-[640px]">
                  Page archetypes — Form, Editorial, Marketing, Data dashboard, Workbench, Split — live on the Patterns page. Each one fixes a container, alignment, and section-padding scale from the tokens above.
                </p>
              </div>
              <a href="patterns.html" className="h-10 px-4 rounded-md bg-[#0a0e13] text-white font-proxima font-bold text-[11.5px] uppercase tracking-[0.12em] flex items-center gap-2 flex-shrink-0 hover:bg-[#1e2530]">
                Open Patterns <Icon name="ChevronRight" className="size-4"/>
              </a>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
