/* eslint-disable */
// MAP-21 PM3 Performance — NPMRDS page redesign for TransportNY.
//
// Composes from the design-system grid:
//   • Container: `data` (1480 px, left-aligned, page padding 32 px)
//   • 12-col grid, 24 px gutter (gap-6) across all sections
//   • Section padding: comfortable (48 px) — uniform `py-12` between sections
//
// Inspector pattern:
//   • Map (span-8) + inspector summary (span-4) in the workbench row
//   • When a TMC is selected, a full-width (span-12) detail band drops below
//     so the hourly travel-time-index chart gets room to breathe (Tufte-style).
//
// Tweaks: a `Grid overlay` toggle visualises the 12-col grid against the
// content so engineers can verify alignment without dev-tools.

const { useState, useRef, useEffect } = React;
const Icon = window.TNYIcon;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "showGrid": false,
  "showSectionPadding": false
}/*EDITMODE-END*/;

/* ─── reusable bits ──────────────────────────────────────────── */
function Spark({ values, w=140, h=34, stroke='#37576B', fill='rgba(55,87,107,0.12)', dot=false }) {
  const max = Math.max(...values), min = Math.min(...values);
  const dx = w / (values.length - 1);
  const y = v => h - 2 - ((v - min) / (max - min || 1)) * (h - 4);
  let line = `M 0 ${y(values[0])}`;
  let area = `M 0 ${h} L 0 ${y(values[0])}`;
  values.forEach((v,i)=>{ if(i){ line += ` L ${i*dx} ${y(v)}`; area += ` L ${i*dx} ${y(v)}`; }});
  area += ` L ${w} ${h} Z`;
  return (<svg width={w} height={h} className="block">
    <path d={area} fill={fill}/>
    <path d={line} fill="none" stroke={stroke} strokeWidth="1.5"/>
    {dot && <circle cx={(values.length-1)*dx} cy={y(values[values.length-1])} r="3" fill={stroke}/>}
  </svg>);
}

/* Tiny target gauge — current vs target with the gap visualized. */
function TargetBar({ value, target, max=100, good=true }) {
  const pct = Math.min(100, (value / max) * 100);
  const tpct = Math.min(100, (target / max) * 100);
  const meets = good ? value >= target : value <= target;
  return (
    <div className="relative h-2 rounded-full bg-slate-100 overflow-hidden">
      <div className={`absolute inset-y-0 left-0 ${meets ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: pct + '%' }}/>
      <div className="absolute top-0 bottom-0 w-px bg-[#0f1722]" style={{ left: tpct + '%' }}/>
      <div className="absolute -top-1 size-3 rounded-full bg-white border-2 border-[#0f1722]" style={{ left: `calc(${tpct}% - 6px)` }}/>
    </div>
  );
}

/* ─── Sidebar (NPMRDS site selected) ──────────────────────── */
function Sidebar() {
  const nav = [
    { id:'overview',   label:'Overview',     icon:'Pages',     active: false },
    { id:'map_21',     label:'MAP-21 PM3',   icon:'MapLayers', active: true,  badge:'live' },
    { id:'reliability',label:'Reliability',  icon:'Sections',  active: false },
    { id:'corridors',  label:'Corridors',    icon:'MapLayers', active: false, badge:'142' },
    { id:'segments',   label:'TMC inspector',icon:'Database',  active: false },
    { id:'reports',    label:'Reports',      icon:'Sections',  active: false },
    { id:'history',    label:'Activity',     icon:'History',   active: false },
  ];
  const quick = [
    { id:'sources', label:'Data sources', icon:'Database' },
    { id:'docs',    label:'Docs',         icon:'Pages' },
  ];
  return (
    <aside data-screen-label="Sidebar" className="fixed inset-y-0 left-0 z-30 bg-[#12181F] flex flex-col border-r border-[#2a3545] w-60">
      {/* logo block */}
      <div className="relative h-16 bg-[#0a0e13] border-b border-[#2a3545] flex items-center px-3">
        <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
          <img src="../assets/nys_logo_white.svg" alt="NYS" className="w-9 h-9 object-contain"/>
        </div>
        <div className="flex-1 ml-3 min-w-0">
          <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-slate-500 leading-none">TransportNY</div>
          <button className="font-oswald uppercase text-white text-[16px] tracking-wide truncate text-left flex items-center gap-1.5 mt-1">
            NPMRDS <Icon name="CaretDown" className="size-3.5 text-slate-400"/>
          </button>
        </div>
      </div>

      {/* workspace meta */}
      <div className="px-4 py-3 border-b border-[#2a3545]">
        <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1.5">Workspace</div>
        <div className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-emerald-400 dot-pulse"/>
          <span className="text-[12px] text-slate-200 font-mono">nysdot/npmrds</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        <div className="px-4 mb-1.5 text-[10px] font-oswald uppercase tracking-[0.18em] text-slate-500">Navigate</div>
        {nav.map(n => (
          <button key={n.id}
            className={`w-full flex items-center transition-colors relative px-4 py-2 gap-3
              ${n.active ? 'bg-[#1e2530] text-white tny-active-bar' : 'border-l-[3px] border-transparent text-slate-300 hover:text-white hover:bg-[#1e2530]'}`}>
            <Icon name={n.icon} className={`size-[18px] flex-shrink-0 ${n.active?'text-yellow-400':'text-slate-400'}`}/>
            <span className="font-proxima text-[13.5px] flex-1 text-left">{n.label}</span>
            {n.badge && <span className="text-[9.5px] font-mono text-yellow-400/90 bg-yellow-400/10 px-1.5 py-0.5 rounded uppercase">{n.badge}</span>}
          </button>
        ))}
      </div>

      <div className="border-t border-[#2a3545] py-2">
        <div className="px-4 mb-1 text-[10px] font-oswald uppercase tracking-[0.18em] text-slate-500">Quick links</div>
        {quick.map(n => (
          <button key={n.id} className="w-full flex items-center px-4 py-2 gap-3 border-l-[3px] border-transparent text-slate-300 hover:text-white hover:bg-[#1e2530]">
            <Icon name={n.icon} className="size-[18px] flex-shrink-0 text-slate-400"/>
            <span className="font-proxima text-[13.5px] flex-1 text-left">{n.label}</span>
          </button>
        ))}
        <div className="mt-2 pt-2 border-t border-[#2a3545] px-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#37576B] to-[#1f3450] flex items-center justify-center text-white text-xs font-medium flex-shrink-0 ring-1 ring-yellow-400/20">JM</div>
            <div className="flex-1 min-w-0">
              <div className="text-white text-[12px] truncate">J. Maron</div>
              <div className="text-slate-400 text-[10.5px] font-mono truncate">NYSDOT · admin</div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

/* ─── Top nav removed — breadcrumbs live inside <TNYPageHeader> ─ */

/* ─── Page hero (legacy local) removed — see <TNYPageHeader> below ─ */

/* ─── Compliance band — four measures, target-first ───── */
function ComplianceBand({ year }) {
  const cards = [
    { title:"Interstate reliable",          status:"good", value:"84.2",      unit:"%",      target:80,      delta:"+4.2",      trend:[76,79,80,81,82,83,84.2],          trendStroke:"#10B981", hint:"On track" },
    { title:"Non-Interstate NHS reliable",  status:"bad",  value:"73.8",      unit:"%",      target:76,      delta:"-2.2",      trend:[71,72,71,72,73,73.5,73.8],        trendStroke:"#EF4444", hint:"Slowing — flag for action" },
    { title:"Truck TT reliability index",   status:"good", value:"1.42",      unit:"",       target:1.55,    delta:"-0.13",     trend:[1.55,1.51,1.48,1.46,1.44,1.43,1.42], trendStroke:"#10B981", lowerIsBetter:true, hint:"Improving y/y" },
    { title:"Peak-hour excessive delay",    status:"bad",  value:"4,424,124", unit:"hr/yr",  target:4000000, delta:"+10.6%", deltaKind:"bad", trend:[3.8,3.9,3.7,4.0,4.2,4.3,4.4],     trendStroke:"#EF4444", lowerIsBetter:true, hint:"Urban pressure — see MPOs" },
  ];
  return (
    <section data-section data-screen-label="01 Compliance" className="bg-[#f1f3f6] border-b border-zinc-950/05">
      <div className="mx-auto max-w-[1480px] px-8 py-12">
        <div className="flex items-end justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-[#CA8A04]">// 01</span>
              <span className="font-oswald uppercase text-[11px] tracking-[0.18em] text-slate-500">Compliance summary · CY {year}</span>
            </div>
            <h2 className="font-oswald font-medium text-[22px] text-[#0f1722]">Are we meeting our 4-yr FHWA targets?</h2>
          </div>
          <a className="font-mono text-[11px] uppercase tracking-wider text-[#37576B] hover:text-[#1f3450] inline-flex items-center gap-1">methodology <Icon name="ChevronRight" className="size-3.5"/></a>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {cards.map((c, i) => (
            <div key={i} className="col-span-12 md:col-span-6 lg:col-span-3">
              <KpiCardCompliance {...c}/>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Map workbench ─────────────────────────────────────────── */

// Measures available for the map
const MEASURES = [
  { id: 'lottr-i',  label: 'LOTTR — Interstate',    sub: 'Level of TT reliability', short: 'LOTTR · INT' },
  { id: 'lottr-ni', label: 'LOTTR — Non-Interstate',sub: 'Level of TT reliability', short: 'LOTTR · N-INT' },
  { id: 'tttr',     label: 'TTTR — Truck',          sub: 'Truck TT reliability index', short: 'TTTR' },
  { id: 'phed',     label: 'PHED — Excessive Delay',sub: 'Peak-hour excessive delay',  short: 'PHED' },
];

// A pretend palette: emerald / amber / red / slate based on score bucket
const BUCKETS = [
  { lbl: 'Reliable',     range: '≥ 0.80', color: '#10B981', dark: '#047857' },
  { lbl: 'Borderline',   range: '0.50–0.79', color: '#F59E0B', dark: '#B45309' },
  { lbl: 'Unreliable',   range: '< 0.50', color: '#EF4444', dark: '#B91C1C' },
  { lbl: 'No data',      range: '—',      color: '#94A3B8', dark: '#475569' },
];

// 24 fake TMC segments along NY interstate skeleton
const TMC_SEGMENTS = [
  { id:'120P04567', route:'I-87 N',  from:'Albany',     to:'Saratoga',   d:'M 480 380 L 460 290 L 440 200', score:0.86, bucket:0, aadt:'38,420', truck:'14.2%', length:'21.4 mi' },
  { id:'120P04568', route:'I-87 N',  from:'Saratoga',   to:'Plattsburgh',d:'M 440 200 L 470 100 L 510 60',  score:0.91, bucket:0, aadt:'29,116', truck:'11.7%', length:'94.8 mi' },
  { id:'120P04569', route:'I-90 E',  from:'Buffalo',    to:'Rochester',  d:'M 80 360 L 200 340 L 290 330',  score:0.78, bucket:1, aadt:'52,108', truck:'17.8%', length:'72.1 mi' },
  { id:'120P04570', route:'I-90 E',  from:'Rochester',  to:'Syracuse',   d:'M 290 330 L 380 335 L 460 340', score:0.82, bucket:0, aadt:'45,200', truck:'15.4%', length:'85.6 mi' },
  { id:'120P04571', route:'I-90 E',  from:'Syracuse',   to:'Albany',     d:'M 460 340 L 530 365 L 590 380', score:0.81, bucket:0, aadt:'41,330', truck:'13.0%', length:'148.3 mi' },
  { id:'120P04572', route:'I-81 S',  from:'Watertown',  to:'Syracuse',   d:'M 420 130 L 450 230 L 470 310', score:0.46, bucket:2, aadt:'29,776', truck:'15.4%', length:'68.0 mi' },
  { id:'120P04573', route:'I-81 S',  from:'Syracuse',   to:'Binghamton', d:'M 470 310 L 460 410 L 450 510', score:0.61, bucket:1, aadt:'25,540', truck:'13.2%', length:'76.5 mi' },
  { id:'120P04574', route:'I-86 E',  from:'Corning',    to:'Binghamton', d:'M 270 520 L 360 515 L 450 510', score:0.74, bucket:1, aadt:'21,330', truck:'13.0%', length:'81.0 mi' },
  { id:'120P04575', route:'I-86 E',  from:'Binghamton', to:'Newburgh',   d:'M 450 510 L 520 520 L 580 530', score:0.83, bucket:0, aadt:'19,140', truck:'12.5%', length:'92.4 mi' },
  { id:'120P04576', route:'I-95 N',  from:'NYC',        to:'New Rochelle',d:'M 660 600 L 680 575 L 700 550',score:0.42, bucket:2, aadt:'94,540', truck:'11.6%', length:'8.2 mi' },
  { id:'120P04577', route:'I-95 N',  from:'New Rochelle',to:'CT line',   d:'M 700 550 L 720 530',          score:0.55, bucket:1, aadt:'88,200', truck:'10.9%', length:'12.6 mi' },
  { id:'120P04578', route:'I-78 W',  from:'Holland Tn', to:'NJ line',    d:'M 620 600 L 640 615',          score:0.39, bucket:2, aadt:'76,221', truck:'12.9%', length:'4.1 mi' },
  { id:'120P04579', route:'I-684',   from:'Brewster',   to:'White Pl',   d:'M 660 480 L 670 540 L 670 595',score:0.79, bucket:1, aadt:'24,902', truck:'10.4%', length:'28.4 mi' },
  { id:'120P04580', route:'I-287',   from:'White Pl',   to:'Tappan Zee', d:'M 670 595 L 640 600',          score:0.66, bucket:1, aadt:'69,400', truck:'9.8%',  length:'7.2 mi' },
  { id:'120P04581', route:'I-190 N', from:'Buffalo',    to:'Niagara',    d:'M 80 360 L 60 290 L 50 230',   score:0.88, bucket:0, aadt:'34,110', truck:'13.4%', length:'25.0 mi' },
  { id:'120P04582', route:'I-390 S', from:'Rochester',  to:'Corning',    d:'M 290 330 L 280 430 L 270 520',score:0.85, bucket:0, aadt:'31,500', truck:'14.7%', length:'76.0 mi' },
  { id:'120P04583', route:'I-490',   from:'Buffalo loop',to:'(I-90)',    d:'M 280 320 L 285 330',          score:0.71, bucket:1, aadt:'40,900', truck:'9.6%',  length:'4.2 mi' },
  { id:'120P04584', route:'I-481',   from:'Syr beltway',to:'I-81',       d:'M 480 320 L 472 320',          score:0.92, bucket:0, aadt:'38,000', truck:'11.0%', length:'2.0 mi' },
  { id:'120P04585', route:'I-787',   from:'Albany spur',to:'I-90',       d:'M 595 378 L 590 372',          score:0.69, bucket:1, aadt:'53,200', truck:'8.9%',  length:'9.5 mi' },
  { id:'120P04586', route:'I-87 S',  from:'NYC bound',  to:'New Paltz',  d:'M 590 380 L 620 470 L 640 530',score:0.58, bucket:1, aadt:'62,400', truck:'12.5%', length:'62.3 mi' },
  { id:'120P04587', route:'I-87 S',  from:'New Paltz',  to:'Tappan Zee', d:'M 640 530 L 650 580 L 640 600',score:0.49, bucket:2, aadt:'71,200', truck:'13.1%', length:'48.0 mi' },
  { id:'120P04588', route:'NY-17',   from:'Binghamton', to:'Catskills',  d:'M 450 510 L 540 540 L 600 555',score:0.77, bucket:1, aadt:'32,212', truck:'12.4%', length:'95.0 mi' },
  { id:'120P04589', route:'I-495',   from:'Long Island',to:'(NYC)',      d:'M 720 615 L 770 620 L 820 625',score:0.31, bucket:2, aadt:'112,000',truck:'8.4%',  length:'72.0 mi' },
  { id:'120P04590', route:'I-678',   from:'Bronx',      to:'JFK',        d:'M 680 615 L 700 625',          score:null,bucket:3, aadt:'89,100', truck:'9.2%',  length:'14.0 mi' },
];

function MeasureTabs({ active, onChange }) {
  return (
    <div className="flex items-stretch border border-zinc-950/08 rounded-lg bg-slate-50/60 p-1 gap-1">
      {MEASURES.map(m => (
        <button key={m.id} onClick={() => onChange(m.id)}
          className={`m-tab flex-1 relative rounded-md px-3 py-2 text-left border border-transparent ${active === m.id ? 'active' : 'hover:bg-white/50'}`}>
          <div className="flex items-center gap-2">
            <span className="font-oswald uppercase text-[11px] tracking-[0.16em] text-slate-500">{m.short}</span>
            {active === m.id && <span className="ml-auto text-[9.5px] font-mono uppercase tracking-wider text-[#CA8A04]">viewing</span>}
          </div>
          <div className="font-oswald font-medium text-[14px] text-[#0f1722] mt-0.5 leading-tight">{m.label.split(' — ')[1] || m.label}</div>
          <div className={`m-tab-bar absolute left-0 right-0 -bottom-px h-[3px] rounded-b bg-transparent`}/>
        </button>
      ))}
    </div>
  );
}

function FilterChip({ label, value, icon, onClear }) {
  return (
    <div className="h-8 inline-flex items-center gap-2 rounded-md bg-white border border-zinc-950/10 pl-2.5 pr-1.5 text-[12px]">
      {icon && <Icon name={icon} className="size-3.5 text-slate-400"/>}
      <span className="font-mono text-[10.5px] uppercase tracking-wider text-slate-500">{label}</span>
      <span className="text-[#0f1722] font-medium">{value}</span>
      <button className="size-5 rounded hover:bg-slate-100 flex items-center justify-center text-slate-400 ml-1"><Icon name="CaretDown" className="size-3"/></button>
    </div>
  );
}

function YearScrubber({ year, onYear }) {
  // NPMRDS coverage runs 2016 → current reporting year. List is reverse-chrono so
  // the most recent compliance year is the first thing in the menu.
  const years = [2025,2024,2023,2022,2021,2020,2019,2018,2017,2016];
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`h-8 inline-flex items-center gap-2 rounded-md bg-white border pl-2.5 pr-1.5 text-[12px] transition-colors
          ${open ? 'border-[#37576B] ring-2 ring-[#37576B]/15' : 'border-zinc-950/10 hover:border-zinc-950/20'}`}>
        <span className="font-mono text-[10.5px] uppercase tracking-wider text-slate-500">Year</span>
        <span className="font-mono tabular-nums text-[12px] text-[#0f1722] font-medium">{year}</span>
        <span className="size-5 rounded hover:bg-slate-100 flex items-center justify-center text-slate-400 ml-0.5">
          <Icon name="CaretDown" className={`size-3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}/>
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          tabIndex={-1}
          className="absolute right-0 top-[calc(100%+4px)] z-30 w-[112px] rounded-md bg-white border border-zinc-950/10 shadow-lg ring-1 ring-black/5 py-1 max-h-[260px] overflow-y-auto">
          <div className="px-3 pt-1 pb-1.5 font-mono text-[9.5px] uppercase tracking-[0.18em] text-slate-400 border-b border-zinc-950/05 mb-1">
            CY · NPMRDS
          </div>
          {years.map(y => {
            const isActive = y === year;
            return (
              <button
                key={y}
                role="option"
                aria-selected={isActive}
                onClick={() => { onYear(y); setOpen(false); }}
                className={`w-full flex items-center justify-between pl-3 pr-2 h-7 text-[12px] font-mono tabular-nums transition-colors
                  ${isActive
                    ? 'bg-[#0a0e13] text-white'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-[#0f1722]'}`}>
                <span>{y}</span>
                {isActive && <span className="size-1.5 rounded-full bg-yellow-400"/>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-3 font-mono text-[10.5px] uppercase tracking-wider">
      <span className="text-slate-400">score</span>
      {BUCKETS.map(b => (
        <div key={b.lbl} className="flex items-center gap-1.5">
          <span className="block w-4 h-1 rounded-full" style={{ background: b.color }}/>
          <span className="text-slate-600">{b.lbl}</span>
          <span className="text-slate-400">{b.range}</span>
        </div>
      ))}
    </div>
  );
}

/* The map itself */
function StateMap({ selectedId, onSelect }) {
  // NY state outline approximation
  const stateOutline = "M 50 230 L 60 170 L 110 130 L 160 110 L 200 130 L 250 130 L 320 100 L 380 95 L 430 110 L 480 100 L 530 70 L 540 60 L 540 100 L 530 130 L 540 175 L 560 200 L 600 220 L 610 230 L 700 250 L 720 320 L 720 380 L 700 420 L 680 470 L 670 530 L 660 600 L 700 620 L 770 625 L 820 630 L 820 650 L 670 660 L 610 660 L 580 640 L 530 600 L 480 530 L 430 510 L 380 525 L 310 530 L 240 525 L 180 510 L 130 480 L 90 440 L 60 380 L 40 320 Z";

  return (
    <div className="relative h-[640px] rounded-lg border border-zinc-950/08 overflow-hidden map-canvas">
      <div className="absolute inset-0 map-grid pointer-events-none"/>

      {/* corner ribbon — region selector + scale */}
      <div className="absolute top-3 left-3 z-10 bg-white/95 backdrop-blur rounded-md border border-zinc-950/08 px-2.5 py-1.5 flex items-center gap-3 font-mono text-[10.5px] uppercase tracking-wider">
        <Icon name="MapLayers" className="size-3.5 text-slate-500"/>
        <span className="text-slate-500">layer</span>
        <span className="text-[#0f1722]">TMC reliability (LOTTR · int)</span>
      </div>
      <div className="absolute top-3 right-3 z-10 bg-white/95 backdrop-blur rounded-md border border-zinc-950/08 px-2.5 py-1.5 flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-wider">
        <span className="text-slate-500">basemap</span>
        <button className="text-[#0f1722]">Light</button>
        <span className="text-slate-300">/</span>
        <button className="text-slate-400">Dark</button>
        <span className="text-slate-300">/</span>
        <button className="text-slate-400">Satellite</button>
      </div>

      {/* SVG map */}
      <svg viewBox="0 0 870 700" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid meet">
        {/* state outline */}
        <path d={stateOutline} fill="rgba(255,255,255,0.5)" stroke="rgba(15,23,42,0.18)" strokeWidth="1.2" strokeLinejoin="round"/>

        {/* great lake / hudson hints */}
        <ellipse cx="180" cy="290" rx="120" ry="22" fill="rgba(186,213,232,0.55)" opacity="0.7"/>
        <path d="M 595 380 L 605 470 L 615 560 L 625 640" stroke="rgba(186,213,232,0.7)" strokeWidth="3" fill="none"/>

        {/* faint county hatching */}
        <g opacity="0.15">
          {[140,230,320,410,500,590].map(x => <line key={'vx'+x} x1={x} y1={120} x2={x} y2={620} stroke="#0f1722" strokeWidth="0.5" strokeDasharray="2 6"/>)}
          {[220,300,380,460,540].map(y => <line key={'hy'+y} x1={50} y1={y} x2={820} y2={y} stroke="#0f1722" strokeWidth="0.5" strokeDasharray="2 6"/>)}
        </g>

        {/* city dots + labels */}
        {[
          { x: 80, y: 360, label: 'BUFFALO',    sub: 'GBNRTC' },
          { x: 290, y: 330, label: 'ROCHESTER', sub: 'GTC' },
          { x: 460, y: 340, label: 'SYRACUSE',  sub: 'SMTC' },
          { x: 420, y: 130, label: 'WATERTOWN', sub: '—' },
          { x: 595, y: 380, label: 'ALBANY',    sub: 'CDTC' },
          { x: 450, y: 510, label: 'BINGHAMTON',sub: 'BMTS' },
          { x: 660, y: 615, label: 'NEW YORK',  sub: 'NYMTC' },
        ].map(c => (
          <g key={c.label}>
            <circle cx={c.x} cy={c.y} r="3.5" fill="#0f1722"/>
            <circle cx={c.x} cy={c.y} r="6" fill="none" stroke="rgba(15,23,42,0.25)" strokeWidth="1"/>
            <text x={c.x+10} y={c.y-2} fontFamily="Oswald, sans-serif" fontWeight="600" fontSize="10.5" fill="#0f1722" letterSpacing="0.5">{c.label}</text>
            <text x={c.x+10} y={c.y+9} fontFamily="ui-monospace, monospace" fontSize="8" fill="rgba(15,23,42,0.5)">{c.sub}</text>
          </g>
        ))}

        {/* TMC segments — colored by bucket */}
        {TMC_SEGMENTS.map(seg => (
          <g key={seg.id}>
            {/* casing for legibility */}
            <path d={seg.d} stroke="white" strokeWidth="6.5" fill="none" strokeLinecap="round" opacity="0.6"/>
            {/* the colored stroke */}
            <path d={seg.d}
              stroke={BUCKETS[seg.bucket].color}
              strokeWidth={selectedId === seg.id ? 7 : 4.5}
              fill="none"
              strokeLinecap="round"
              className={`tmc-seg ${selectedId === seg.id ? 'selected' : ''}`}
              onClick={() => onSelect(seg)}/>
          </g>
        ))}

        {/* scale bar */}
        <g transform="translate(40 660)">
          <line x1="0" y1="0" x2="120" y2="0" stroke="#0f1722" strokeWidth="2"/>
          <line x1="0" y1="-4" x2="0" y2="4" stroke="#0f1722" strokeWidth="2"/>
          <line x1="60" y1="-3" x2="60" y2="3" stroke="#0f1722" strokeWidth="1"/>
          <line x1="120" y1="-4" x2="120" y2="4" stroke="#0f1722" strokeWidth="2"/>
          <text x="0" y="16" fontFamily="ui-monospace, monospace" fontSize="9" fill="rgba(15,23,42,0.6)">0</text>
          <text x="60" y="16" fontFamily="ui-monospace, monospace" fontSize="9" fill="rgba(15,23,42,0.6)" textAnchor="middle">25 mi</text>
          <text x="120" y="16" fontFamily="ui-monospace, monospace" fontSize="9" fill="rgba(15,23,42,0.6)" textAnchor="middle">50 mi</text>
        </g>
        {/* north arrow */}
        <g transform="translate(820 100)">
          <polygon points="0,0 7,18 -7,18" fill="#0f1722"/>
          <text x="0" y="32" fontFamily="Oswald, sans-serif" fontWeight="600" fontSize="11" fill="#0f1722" textAnchor="middle">N</text>
        </g>
      </svg>

      {/* bottom legend */}
      <div className="absolute bottom-3 left-3 right-3 bg-white/95 backdrop-blur rounded-md border border-zinc-950/08 px-3 py-2 flex items-center justify-between">
        <Legend/>
        <div className="font-mono text-[10.5px] uppercase tracking-wider text-slate-500 flex items-center gap-3">
          <span>{TMC_SEGMENTS.length} of 4,210 TMCs shown</span>
          <span className="text-slate-300">·</span>
          <button className="text-[#37576B] hover:text-[#1f3450] font-semibold">show all</button>
        </div>
      </div>
    </div>
  );
}

/* Inspector — TMC summary OR MPO leaderboard.
   When a TMC is selected, this is the compact summary that lives in the
   col-span-4 slot beside the map. The wide Tufte hourly chart lives in a
   separate full-width band below — see SegmentDetailBand. */
function Inspector({ selected, onClear }) {
  if (selected) return <SegmentSummary seg={selected} onClear={onClear}/>;
  return <MPOLeaderboard/>;
}

function SegmentSummary({ seg, onClear }) {
  return (
    <div className="bg-white border border-zinc-950/08 rounded-lg flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-950/08 bg-slate-50 flex items-center justify-between">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-[#CA8A04]">// segment · summary</span>
        <button onClick={onClear} className="size-6 rounded hover:bg-white text-slate-500 flex items-center justify-center"><Icon name="XMark" className="size-4"/></button>
      </div>

      <div className="p-4 border-b border-zinc-950/08">
        <div className="flex items-center gap-3 mb-3">
          <RouteShield route={seg.route}/>
          <div>
            <div className="font-oswald font-semibold text-[16px] text-[#0f1722] leading-tight">{seg.route}</div>
            <div className="font-proxima text-[12px] text-slate-600">{seg.from} → {seg.to}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-slate-500">
          <span>TMC</span><span className="text-[#0f1722]">{seg.id}</span>
          <span className="text-slate-300">·</span>
          <span>{seg.length}</span>
        </div>
      </div>

      <div className="p-4 border-b border-zinc-950/08">
        <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500 mb-2">LOTTR score · 2024</div>
        <div className="flex items-end gap-3">
          <div className="font-oswald font-semibold text-[44px] leading-none tabular-nums text-[#0f1722]">{seg.score == null ? '—' : seg.score.toFixed(2)}</div>
          <div className="flex flex-col gap-1 pb-1">
            <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded text-white" style={{ background: BUCKETS[seg.bucket].dark }}>
              {BUCKETS[seg.bucket].lbl}
            </span>
            <span className="font-mono text-[10px] text-slate-500">vs target 0.80</span>
          </div>
        </div>
      </div>

      <div className="p-4 border-b border-zinc-950/08">
        <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500 mb-2">Attributes</div>
        <div className="grid grid-cols-2 gap-y-1.5 gap-x-3 text-[12.5px]">
          <span className="text-slate-500">AADT</span><span className="font-mono tabular-nums text-right text-[#0f1722]">{seg.aadt}</span>
          <span className="text-slate-500">Truck %</span><span className="font-mono tabular-nums text-right text-[#0f1722]">{seg.truck}</span>
          <span className="text-slate-500">Length</span><span className="font-mono tabular-nums text-right text-[#0f1722]">{seg.length}</span>
          <span className="text-slate-500">Functional class</span><span className="font-mono text-right text-[#0f1722]">Interstate (1)</span>
          <span className="text-slate-500">F-system</span><span className="font-mono text-right text-[#0f1722]">NHS</span>
          <span className="text-slate-500">Region</span><span className="font-mono text-right text-[#0f1722]">Region 1</span>
          <span className="text-slate-500">MPO</span><span className="font-mono text-right text-[#0f1722]">CDTC</span>
          <span className="text-slate-500">County</span><span className="font-mono text-right text-[#0f1722]">Albany</span>
        </div>
      </div>

      <div className="p-4 mt-auto flex items-center gap-2 border-t border-zinc-950/05">
        <button className="flex-1 h-9 rounded-md bg-[#EAAD43] hover:bg-[#F1CA87] text-[#37576B] font-proxima font-bold text-[11.5px] uppercase tracking-[0.12em] border-b-4 border-[#C68B1F] tny-press flex items-center justify-center gap-2">
          <Icon name="Pages" className="size-3.5"/>Open report
        </button>
        <button className="h-9 px-3 rounded-md border border-zinc-950/10 hover:bg-slate-50 text-slate-700 text-[11.5px] flex items-center gap-1.5">
          <Icon name="Download" className="size-3.5"/>CSV
        </button>
      </div>
    </div>
  );
}

/* ─── Full-width Tufte chart band — only when a TMC is selected ── */
function SegmentDetailBand({ seg }) {
  // 24 hours of TTI (1.0 = free flow), seeded by seg.id so it's stable per segment
  const seed = seg.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const rand = (i) => {
    const x = Math.sin(seed + i * 13.7) * 10000;
    return x - Math.floor(x);
  };
  const hours = Array.from({ length: 24 }, (_, i) => {
    // morning peak ~ 7-9, evening peak ~ 16-19, baseline ~ 1.0
    const am = Math.exp(-Math.pow((i - 8) / 1.6, 2)) * 0.55;
    const pm = Math.exp(-Math.pow((i - 17) / 1.8, 2)) * 0.70;
    return 1.0 + am + pm + (rand(i) - 0.5) * 0.12;
  });
  // 80th percentile (just a slightly higher version for the band)
  const p80 = hours.map((h, i) => h + 0.18 + rand(i + 30) * 0.08);
  const p50 = hours.map((h, i) => h - 0.04 - rand(i + 60) * 0.04);

  // 7-day × 24-hour heatmap (stable per segment)
  const dow = ['MON','TUE','WED','THU','FRI','SAT','SUN'];
  const heatmap = dow.map((_, d) =>
    Array.from({ length: 24 }, (_, h) => {
      const wk = d < 5;
      const am = Math.exp(-Math.pow((h - 8) / 1.7, 2)) * (wk ? 0.55 : 0.10);
      const pm = Math.exp(-Math.pow((h - 17) / 2.0, 2)) * (wk ? 0.70 : 0.20);
      return 1.0 + am + pm + (rand(d * 24 + h) - 0.5) * 0.10;
    })
  );

  return (
    <div className="bg-white border border-zinc-950/08 rounded-lg overflow-hidden">
      {/* header */}
      <div className="px-5 py-3 border-b border-zinc-950/08 bg-slate-50 flex items-center gap-4">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-[#CA8A04]">// segment · profile</span>
        <span className="font-mono text-[10.5px] uppercase tracking-wider text-slate-500">{seg.id}</span>
        <span className="text-slate-300">·</span>
        <span className="font-oswald uppercase text-[12px] tracking-wide text-[#0f1722]">{seg.route} <span className="text-slate-500 font-normal normal-case">{seg.from} → {seg.to}</span></span>
        <div className="ml-auto flex items-center gap-3 font-mono text-[10.5px] uppercase tracking-wider text-slate-500">
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-[#37576B]"/>median (p50)</span>
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-[#CA8A04]"/>p80 (LOTTR num.)</span>
          <span className="flex items-center gap-1.5"><span className="block w-3 h-px border-t border-dashed border-red-400"/>congestion threshold</span>
        </div>
      </div>

      {/* ── Chart 1 · hourly TTI ───── full width across container */}
      <div className="px-5 pt-5 pb-2">
        <div className="flex items-baseline justify-between mb-1.5">
          <div>
            <div className="font-oswald uppercase text-[11px] tracking-[0.18em] text-slate-600">Travel-time index by hour of day</div>
            <div className="font-mono text-[10.5px] text-slate-500 uppercase tracking-wider mt-0.5">2024 · weekday avg · 5-min readings, binned hourly</div>
          </div>
        </div>
        <HourlyTufte p50={p50} p80={p80} hours={hours}/>
      </div>

      {/* ── Chart 2 · 7-day heatmap ── full width across container */}
      <div className="px-5 pt-3 pb-5 border-t border-zinc-950/05">
        <div className="flex items-baseline justify-between mb-1.5">
          <div>
            <div className="font-oswald uppercase text-[11px] tracking-[0.18em] text-slate-600">Reliability heatmap · day of week × hour</div>
            <div className="font-mono text-[10.5px] text-slate-500 uppercase tracking-wider mt-0.5">TTI · darker = worse · cells are weekday × hour means</div>
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-slate-500">
            <span>1.0</span>
            <div className="flex items-center">
              {[0.0,0.2,0.4,0.6,0.8,1.0].map(t => (
                <span key={t} className="block w-5 h-2" style={{ background: heatColor(1.0 + t) }}/>
              ))}
            </div>
            <span>2.0</span>
          </div>
        </div>
        <DowHeatmap rows={heatmap} days={dow}/>
      </div>
    </div>
  );
}

/* helpers for the tufte band */
function heatColor(v) {
  // v from 1.0 to 2.0 → light to deep red
  const t = Math.max(0, Math.min(1, (v - 1.0) / 1.0));
  const r = Math.round(247 - t * 60);
  const g = Math.round(247 - t * 180);
  const b = Math.round(247 - t * 180);
  return `rgb(${r}, ${g}, ${b})`;
}

function HourlyTufte({ p50, p80, hours }) {
  const W = 1280, H = 220, padL = 36, padR = 12, padT = 12, padB = 24;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const yMin = 0.8, yMax = Math.max(2.2, Math.max(...p80) + 0.1);
  const y = v => padT + innerH - ((v - yMin) / (yMax - yMin)) * innerH;
  const x = i => padL + (i / 23) * innerW;
  const barW = innerW / 24 - 4;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" style={{ maxHeight: 240 }}>
      {/* y-axis gridlines + labels */}
      {[1.0, 1.5, 2.0].map(v => (
        <g key={v}>
          <line x1={padL} y1={y(v)} x2={W - padR} y2={y(v)} stroke="rgba(15,23,42,0.08)" strokeWidth="1"/>
          <text x={padL - 6} y={y(v) + 3} textAnchor="end" fontFamily="ui-monospace, monospace" fontSize="10" fill="rgba(15,23,42,0.5)">{v.toFixed(1)}</text>
        </g>
      ))}
      {/* free-flow baseline */}
      <line x1={padL} y1={y(1.0)} x2={W - padR} y2={y(1.0)} stroke="rgba(15,23,42,0.25)" strokeWidth="1"/>
      <text x={W - padR} y={y(1.0) - 4} textAnchor="end" fontFamily="ui-monospace, monospace" fontSize="9" fill="rgba(15,23,42,0.5)">FREE FLOW · 1.0</text>
      {/* congestion threshold */}
      <line x1={padL} y1={y(1.5)} x2={W - padR} y2={y(1.5)} stroke="#EF4444" strokeWidth="1" strokeDasharray="3 4"/>
      <text x={W - padR} y={y(1.5) - 4} textAnchor="end" fontFamily="ui-monospace, monospace" fontSize="9" fill="#B91C1C">CONGESTION · 1.5</text>

      {/* bars: p80 stacked on p50 */}
      {p80.map((v, i) => {
        const xi = x(i);
        const yTop = y(v), yMid = y(p50[i]);
        const colTop = v > 1.5 ? '#CA8A04' : v > 1.2 ? '#D5A52E' : '#E0B95C';
        return (
          <g key={i}>
            {/* p80 segment (top) */}
            <rect x={xi - barW/2} y={yTop} width={barW} height={Math.max(0, yMid - yTop)} fill={colTop} opacity="0.85"/>
            {/* p50 segment (bottom) */}
            <rect x={xi - barW/2} y={yMid} width={barW} height={Math.max(0, y(1.0) - yMid)} fill="#37576B"/>
          </g>
        );
      })}

      {/* p50 line on top */}
      <polyline points={p50.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke="#0f1722" strokeWidth="1" opacity="0.7"/>
      {p50.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r="1.8" fill="#0f1722"/>
      ))}

      {/* x-axis labels every 3 hours */}
      {[0,3,6,9,12,15,18,21].map(h => (
        <text key={h} x={x(h)} y={H - 6} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="10" fill="rgba(15,23,42,0.55)">{String(h).padStart(2,'0')}:00</text>
      ))}

      {/* peak annotations */}
      <text x={x(8)} y={padT + 10} textAnchor="middle" fontFamily="Oswald, sans-serif" fontWeight="600" fontSize="10" fill="#B45309" letterSpacing="0.5">AM PEAK</text>
      <text x={x(17)} y={padT + 10} textAnchor="middle" fontFamily="Oswald, sans-serif" fontWeight="600" fontSize="10" fill="#B45309" letterSpacing="0.5">PM PEAK</text>
    </svg>
  );
}

function DowHeatmap({ rows, days }) {
  const W = 1280, padL = 36, padR = 12, padT = 6, padB = 22;
  const cellW = (W - padL - padR) / 24;
  const cellH = 22;
  const H = padT + cellH * 7 + padB;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" style={{ maxHeight: 220 }}>
      {/* day labels */}
      {days.map((d, di) => (
        <text key={d} x={padL - 6} y={padT + di * cellH + cellH/2 + 3} textAnchor="end" fontFamily="ui-monospace, monospace" fontSize="10" fill="rgba(15,23,42,0.55)">{d}</text>
      ))}
      {/* cells */}
      {rows.map((row, di) => row.map((v, hi) => (
        <rect key={di + '-' + hi}
          x={padL + hi * cellW + 0.5}
          y={padT + di * cellH + 0.5}
          width={cellW - 1}
          height={cellH - 1}
          fill={heatColor(v)}/>
      )))}
      {/* weekday/weekend divider */}
      <line x1={padL} y1={padT + 5 * cellH} x2={W - padR} y2={padT + 5 * cellH} stroke="rgba(15,23,42,0.5)" strokeWidth="1.5"/>
      {/* hour labels */}
      {[0,3,6,9,12,15,18,21].map(h => (
        <text key={h} x={padL + h * cellW + cellW/2} y={H - 6} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="10" fill="rgba(15,23,42,0.55)">{String(h).padStart(2,'0')}:00</text>
      ))}
    </svg>
  );
}

function RouteShield({ route }) {
  // parse "I-87 N" or "NY-17"
  const m = route.match(/(I|US|NY)-?(\d+)/);
  if (!m) return null;
  const [, kind, num] = m;
  if (kind === 'I') {
    return (
      <svg width="40" height="40" viewBox="0 0 40 40">
        <path d="M20 1 C 11 1 4 5 4 14 C 4 26 20 39 20 39 C 20 39 36 26 36 14 C 36 5 29 1 20 1 Z"
              fill="#37576B" stroke="#FACC15" strokeWidth="1.5"/>
        <text x="20" y="25" textAnchor="middle" fontFamily="Oswald, sans-serif" fontWeight="700"
              fontSize={String(num).length > 2 ? 12 : 15} fill="#fff">{num}</text>
      </svg>
    );
  }
  return (
    <svg width="40" height="40" viewBox="0 0 40 40">
      <rect x="3" y="3" width="34" height="34" rx="4" fill="#0a0e13" stroke="#FACC15" strokeWidth="1.5"/>
      <text x="20" y="25" textAnchor="middle" fontFamily="Oswald, sans-serif" fontWeight="700" fontSize="14" fill="#FACC15">{num}</text>
    </svg>
  );
}

function MPOLeaderboard() {
  const mpos = [
    { code: 'NYMTC',  name: 'New York Metropolitan TC', score: 71.8, target: 76, region: 'NYC Metro',     trend: [70,69,71,70,71,71.5,71.8] },
    { code: 'CDTC',   name: 'Capital District TC',      score: 88.2, target: 80, region: 'Capital',       trend: [82,84,85,86,87,88,88.2] },
    { code: 'GBNRTC', name: 'Greater Buffalo–Niagara',  score: 84.4, target: 80, region: 'Western',       trend: [78,80,81,82,83,84,84.4] },
    { code: 'GTC',    name: 'Genesee TC',               score: 81.1, target: 80, region: 'Finger Lakes',  trend: [78,79,80,80,81,81,81.1] },
    { code: 'SMTC',   name: 'Syracuse Metro TC',        score: 79.6, target: 80, region: 'Central',       trend: [76,77,78,78,79,79.5,79.6] },
    { code: 'BMTS',   name: 'Binghamton Metro TS',      score: 76.0, target: 80, region: 'Southern Tier', trend: [73,74,75,75,76,76,76.0] },
    { code: 'A/GFTC', name: 'Adirondack–Glens Falls',   score: 91.4, target: 80, region: 'North Country', trend: [89,90,90,91,91,91,91.4] },
    { code: 'ITCTC',  name: 'Ithaca–Tompkins',          score: 83.5, target: 80, region: 'Central',       trend: [81,82,82,83,83,83,83.5] },
    { code: 'OCTC',   name: 'Orange County TC',         score: 70.2, target: 76, region: 'Hudson Valley', trend: [72,71,70,70,70,70.5,70.2] },
    { code: 'PDCTC',  name: 'Poughkeepsie–Dutchess',    score: 82.1, target: 80, region: 'Hudson Valley', trend: [78,79,80,81,82,82,82.1] },
  ];
  return (
    <div className="bg-white border border-zinc-950/08 rounded-lg flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-950/08 bg-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-[#CA8A04]">// MPO leaderboard</span>
        </div>
        <span className="font-mono text-[10px] text-slate-500">LOTTR · Interstate · 2024</span>
      </div>
      <div className="p-3 text-[12.5px] text-slate-600 border-b border-zinc-950/05">
        Click any TMC segment on the map to inspect a single TMC. Below: state-wide MPO compliance, ranked.
      </div>
      <div className="flex-1 overflow-y-auto">
        <table className="w-full tbl">
          <thead className="bg-white sticky top-0 z-10">
            <tr>
              {['MPO','Region','Score','Target','7-yr'].map((h, i) => (
                <th key={h} className={`font-oswald uppercase text-[10px] tracking-[0.1em] text-slate-500 px-3 py-2 ${i>=2?'text-right':'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mpos.map(m => {
              const meets = m.score >= m.target;
              return (
                <tr key={m.code} className="hover:bg-amber-50/40 cursor-pointer">
                  <td className="px-3 py-2 text-[12.5px]">
                    <div className="flex items-center gap-2">
                      <span className={`size-1.5 rounded-full ${meets?'bg-emerald-500':'bg-red-500'}`}/>
                      <span className="font-oswald uppercase text-[12px] tracking-wide text-[#0f1722]">{m.code}</span>
                    </div>
                    <div className="font-proxima text-[11px] text-slate-500 ml-3.5 mt-0.5">{m.name}</div>
                  </td>
                  <td className="px-3 py-2 text-[11.5px] text-slate-600 font-mono uppercase tracking-wide">{m.region}</td>
                  <td className="px-3 py-2 text-[12.5px] text-right tabular-nums font-mono">{m.score.toFixed(1)}<span className="text-slate-400">%</span></td>
                  <td className="px-3 py-2 text-[12px] text-right tabular-nums font-mono text-slate-500">{m.target}<span className="text-slate-400">%</span></td>
                  <td className="px-3 py-2"><Spark values={m.trend} w={70} h={20} stroke={meets?'#10B981':'#EF4444'} fill={meets?'rgba(16,185,129,0.14)':'rgba(239,68,68,0.12)'}/></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-3 py-2 border-t border-zinc-950/05 bg-slate-50 flex items-center justify-between font-mono text-[10.5px] uppercase tracking-wider text-slate-500">
        <span>10 MPOs · 2 below target</span>
        <button className="text-[#37576B] hover:text-[#1f3450] font-semibold">open ranking →</button>
      </div>
    </div>
  );
}

function MapWorkbench({ year }) {
  const [measure, setMeasure] = useState('lottr-i');
  const [selected, setSelected] = useState(null);
  return (
    <section data-section data-screen-label="02 Workbench" className="bg-[#f1f3f6] border-b border-zinc-950/05">
      <div className="mx-auto max-w-[1480px] px-8 py-12">
        <div className="flex items-end justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-[#CA8A04]">// 02</span>
              <span className="font-oswald uppercase text-[11px] tracking-[0.18em] text-slate-500">Map workbench · CY {year}</span>
            </div>
            <h2 className="font-oswald font-medium text-[22px] text-[#0f1722]">Drill down by segment, route, or MPO.</h2>
          </div>
        </div>

        {/* measure tabs — full container width */}
        <MeasureTabs active={measure} onChange={setMeasure}/>

        {/* filter bar — year moved to the page header */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <FilterChip label="period" value="AM peak (6–10)" icon="History"/>
          <FilterChip label="vehicle" value="All vehicles"   icon="MapLayers"/>
          <FilterChip label="region"  value="All NYS"        icon="MapLayers"/>
          <FilterChip label="f-class" value="Interstate"     icon="Sections"/>
          <button className="h-8 ml-auto inline-flex items-center gap-1.5 px-3 rounded-md border border-zinc-950/10 hover:bg-white text-slate-700 text-[11.5px] font-mono uppercase tracking-wider">
            <Icon name="XMark" className="size-3.5"/>Reset
          </button>
        </div>

        {/* map + inspector + (when selected) full-width detail band */}
        <div className="mt-6 grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-8">
            <StateMap selectedId={selected?.id} onSelect={setSelected}/>
          </div>
          <div className="col-span-12 lg:col-span-4">
            <Inspector selected={selected} onClear={() => setSelected(null)}/>
          </div>
          {selected && (
            <div className="col-span-12">
              <SegmentDetailBand seg={selected}/>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ─── MPO small multiples ─────────────────────────────────────── */
function MPOSmallMultiples({ year }) {
  const mpos = [
    { code: 'NYMTC',  score: 71.8, target: 76, meets: false },
    { code: 'CDTC',   score: 88.2, target: 80, meets: true  },
    { code: 'GBNRTC', score: 84.4, target: 80, meets: true  },
    { code: 'GTC',    score: 81.1, target: 80, meets: true  },
    { code: 'SMTC',   score: 79.6, target: 80, meets: false },
    { code: 'BMTS',   score: 76.0, target: 80, meets: false },
    { code: 'A/GFTC', score: 91.4, target: 80, meets: true  },
    { code: 'ITCTC',  score: 83.5, target: 80, meets: true  },
    { code: 'OCTC',   score: 70.2, target: 76, meets: false },
    { code: 'PDCTC',  score: 82.1, target: 80, meets: true  },
  ];
  const Tile = ({ m }) => {
    const pct = Math.min(100, m.score);
    const tpct = Math.min(100, m.target);
    return (
      <div className="col-span-12 sm:col-span-6 md:col-span-3 bg-white border border-zinc-950/08 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="font-oswald uppercase text-[12px] tracking-wide text-[#0f1722]">{m.code}</div>
          <span className={`size-2 rounded-full ${m.meets?'bg-emerald-500':'bg-red-500'}`}/>
        </div>
        <div className="flex items-end justify-between mb-1.5">
          <span className="font-oswald font-semibold text-[22px] text-[#0f1722] tabular-nums leading-none">{m.score.toFixed(1)}<span className="text-[11px] text-slate-500 ml-0.5">%</span></span>
          <span className="font-mono text-[10px] text-slate-500">tgt {m.target}</span>
        </div>
        <div className="relative h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div className={`absolute inset-y-0 left-0 ${m.meets?'bg-emerald-500':'bg-red-500'}`} style={{ width: pct + '%' }}/>
          <div className="absolute top-0 bottom-0 w-px bg-[#0f1722]" style={{ left: tpct + '%' }}/>
        </div>
      </div>
    );
  };
  return (
    <section data-section data-screen-label="03 By region" className="bg-[#f1f3f6] border-b border-zinc-950/05">
      <div className="mx-auto max-w-[1480px] px-8 py-12">
        <div className="flex items-end justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-[#CA8A04]">// 03</span>
              <span className="font-oswald uppercase text-[11px] tracking-[0.18em] text-slate-500">By region</span>
            </div>
            <h2 className="font-oswald font-medium text-[22px] text-[#0f1722]">Compliance by MPO, at a glance.</h2>
          </div>
          <div className="flex items-center gap-3 font-mono text-[10.5px] uppercase tracking-wider text-slate-500">
            <span className="flex items-center gap-1.5"><span className="size-2 bg-emerald-500 rounded-full"/>meets target</span>
            <span className="flex items-center gap-1.5"><span className="size-2 bg-red-500 rounded-full"/>below target</span>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {mpos.map(m => <Tile key={m.code} m={m}/>)}
          {/* trailing span-6 CTA fills the row cleanly (10 tiles + 6-col CTA = 36 spans = 3 rows of 12) */}
          <a href="#" className="col-span-12 md:col-span-6 bg-white border border-dashed border-zinc-950/15 rounded-lg p-3 flex items-center justify-between hover:bg-amber-50/40 hover:border-[#CA8A04]/40 transition-colors">
            <div>
              <div className="font-oswald uppercase text-[12px] tracking-wide text-[#0f1722]">Open MPO ranking</div>
              <div className="font-mono text-[10.5px] text-slate-500 uppercase tracking-wider mt-1">all 10 MPOs · sortable · with 7-yr trends</div>
            </div>
            <Icon name="ChevronRight" className="size-5 text-slate-400"/>
          </a>
        </div>
      </div>
    </section>
  );
}

/* ─── Methodology note ────────────────────────────────────────── */
function MethodologyNote() {
  return (
    <section data-section data-screen-label="04 Methodology" className="bg-[#f1f3f6]">
      <div className="mx-auto max-w-[1480px] px-8 py-12">
        <div className="bg-[#fafbfc] border border-zinc-950/08 rounded-lg p-6 grid grid-cols-12 gap-6">
          <div className="col-span-12 md:col-span-3">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-[#CA8A04] mb-2">// methodology</div>
            <div className="font-oswald font-medium text-[18px] text-[#0f1722] leading-tight">How these scores are computed.</div>
          </div>
          <div className="col-span-12 md:col-span-6 text-[13px] text-slate-600 leading-[1.6]">
            <p>
              LOTTR is computed for AM peak (6–10), midday (10–16), PM peak (16–20), and weekend (8–20). A segment is <strong>reliable</strong> if the 80th-percentile travel time divided by the 50th-percentile travel time is below 1.5 across all four periods. Person-miles are weighted by AADT × occupancy factor per the FHWA PM3 final rule.
            </p>
            <p className="mt-2">
              TTTR uses truck-only NPMRDS travel times across five periods. PHED uses the FHWA HPMS profile factors with NYSDOT 2023 urbanized-area population for the per-capita conversion.
            </p>
          </div>
          <div className="col-span-12 md:col-span-3 flex flex-col gap-2 text-[12.5px]">
            <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500 mb-1">Data lineage</div>
            {[
              ['NPMRDS', 'INRIX · 2017–'],
              ['HPMS',   'NYSDOT 2023 submission'],
              ['Pop.',   'ACS 2023 5-year urb. area'],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between border-b border-zinc-950/05 pb-1">
                <span className="font-oswald uppercase text-[11px] tracking-wide text-slate-500">{k}</span>
                <span className="font-mono text-[11px] text-[#0f1722]">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Grid overlay — mirrors the section container exactly ─────── */
function GridOverlay({ show }) {
  if (!show) return null;
  return (
    <div className="fixed inset-y-0 left-60 right-0 z-50 pointer-events-none">
      <div className="mx-auto max-w-[1480px] px-8 h-full">
        <div className="grid grid-cols-12 gap-6 h-full">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="relative h-full bg-[#CA8A04]/8 border-l border-r border-[#CA8A04]/35 border-dashed">
              <div className="sticky top-[58px] text-center">
                <span className="inline-block px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[#CA8A04] bg-[#0a0e13] rounded-sm">{String(i+1).padStart(2,'0')}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────── */
function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [year, setYear] = useState(2025);
  return (
    <div className="min-h-screen bg-[#f1f3f6]">
      <Sidebar/>
      <main data-screen-label="MAP-21 PM3 Performance" className="ml-60">
        <TNYPageHeader
          breadcrumb={[{label:'NPMRDS', href:'#'}, {label:'MAP-21 PM3'}]}
          kicker="// federal reporting"
          meta="23 CFR 490 · subparts e–g"
          title="MAP-21 PM3 performance"
          accent="."
          desc="Travel-time reliability, freight reliability, and peak-hour excessive delay for the New York State NHS. Scores are computed from NPMRDS probe data and reported annually to FHWA against agency-set targets."
          actions={<YearScrubber year={year} onYear={setYear}/>}
          refresh="2026-05-08 04:12 EST"
        />
        <ComplianceBand year={year}/>
        <MapWorkbench year={year}/>
        <MPOSmallMultiples year={year}/>
        <MethodologyNote/>
      </main>
      <GridOverlay show={t.showGrid}/>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Grid system"/>
        <TweakToggle label="Show 12-col overlay" value={t.showGrid} onChange={v => setTweak('showGrid', v)}/>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
