/* eslint-disable */
// MAP-21 PM3 — OVERALL (multi-year trend) view.
// Counterpart to map-21.html, which is the per-year deep-dive.
// One full-width section per measure, with a Graph / Table / Cards view toggle
// and a global geography scope (NY State / Counties / MPOs / Urbanized Areas).

const { useState, useRef, useEffect } = React;
const Icon = window.TNYIcon;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "showGrid": false,
  "showSectionPadding": false
}/*EDITMODE-END*/;

/* ─── Sidebar ─────────────────────────────────────────────── */
function Sidebar() {
  return (
    <TNYSidebar product="NPMRDS" active="pm3" expanded={true}
      nav={[
        { id:'home',      label:'Home',           icon:'Pages' },
        { id:'routes',    label:'Route Analysis', icon:'MapLayers' },
        { id:'reports',   label:'Reports',        icon:'Sections' },
        { id:'pm3',       label:'MAP-21 PM3',     icon:'Activity', badge:'CY 25' },
        { id:'congestion',label:'Congestion',     icon:'Database' },
        { id:'work',      label:'Work Zones',     icon:'Settings' },
        { id:'history',   label:'History',        icon:'History' },
      ]}/>
  );
}

/* ─── Measure data (10-year series) ───────────────────────── */
const MEASURES = [
  {
    id:'lottr-i', kicker:'// 01', name:'Interstate reliability',
    measure:'LOTTR · Interstate', unit:'%',
    target:80, targetText:'≥ 80% reliable', higherBetter:true,
    desc:'Share of reporting Interstate TMCs with 80th/50th-percentile travel-time ratio ≤ 1.50, across all four time periods.',
    yMin:60, yMax:90,
    series:[
      {y:2016,v:72.1},{y:2017,v:75.2},{y:2018,v:77.4},{y:2019,v:79.5},
      {y:2020,v:82.1},{y:2021,v:81.4},{y:2022,v:80.8},{y:2023,v:82.6},
      {y:2024,v:83.5},{y:2025,v:84.2}
    ],
  },
  {
    id:'lottr-n', kicker:'// 02', name:'Non-Interstate NHS reliability',
    measure:'LOTTR · Non-Interstate', unit:'%',
    target:76, targetText:'≥ 76% reliable', higherBetter:true,
    desc:'Share of reporting non-Interstate NHS TMCs with 80th/50th-percentile LOTTR ≤ 1.50.',
    yMin:55, yMax:85,
    series:[
      {y:2016,v:65.0},{y:2017,v:67.2},{y:2018,v:68.4},{y:2019,v:69.0},
      {y:2020,v:73.0},{y:2021,v:72.5},{y:2022,v:73.4},{y:2023,v:75.1},
      {y:2024,v:74.5},{y:2025,v:73.8}
    ],
  },
  {
    id:'tttr', kicker:'// 03', name:'Truck travel-time reliability',
    measure:'TTTR · Interstate', unit:'',
    target:1.55, targetText:'≤ 1.55 TTTR', higherBetter:false,
    desc:'Length-weighted mean of the worst-of-five 95th/50th TTTR ratios. Lower is better.',
    yMin:1.30, yMax:1.85,
    series:[
      {y:2016,v:1.78},{y:2017,v:1.72},{y:2018,v:1.68},{y:2019,v:1.65},
      {y:2020,v:1.48},{y:2021,v:1.52},{y:2022,v:1.55},{y:2023,v:1.52},
      {y:2024,v:1.48},{y:2025,v:1.42}
    ],
  },
  {
    id:'phed', kicker:'// 04', name:'Peak-hour excessive delay',
    measure:'PHED · UA, hr/cap', unit:'',
    target:16, targetText:'≤ 16 hr/cap', higherBetter:false,
    desc:'Annual person-hours of excessive delay per capita in urbanized areas during peak periods. Reportable for UAs ≥ 1M only.',
    yMin:9, yMax:20,
    series:[
      {y:2016,v:16.2},{y:2017,v:16.8},{y:2018,v:17.5},{y:2019,v:18.1},
      {y:2020,v:10.2},{y:2021,v:13.5},{y:2022,v:15.2},{y:2023,v:15.8},
      {y:2024,v:16.1},{y:2025,v:15.3}
    ],
  },
];

/* ─── Geography selector ──────────────────────────────────── */
function GeographySelect({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState(value.kind); // 'state' | 'county' | 'mpo' | 'ua'
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const triggerLabel = (() => {
    if (value.kind === 'state') return 'NY State';
    if (value.items.length === 1) return value.items[0];
    return `${value.items.length} ${value.kind === 'county' ? 'counties' : value.kind === 'mpo' ? 'MPOs' : 'UAs'}`;
  })();
  const triggerKind = ({ state:'NY State', county:'County', mpo:'MPO', ua:'Urb. area' })[value.kind];

  const tabDefs = [
    { id:'state',  label:'NY State', meta:'no filter' },
    { id:'county', label:'Counties', meta:'62' },
    { id:'mpo',    label:'MPOs',     meta:'13' },
    { id:'ua',     label:'Urb. areas', meta:'25' },
  ];

  // Mocked option lists for each tab
  const OPTIONS = {
    county: ['Albany','Allegany','Bronx','Broome','Cattaraugus','Cayuga','Chautauqua','Chemung','Chenango','Clinton','Columbia','Cortland','Delaware','Dutchess','Erie','Essex','Franklin','Fulton','Genesee','Greene'],
    mpo: ['CDTC — Capital District','GBNRTC — Greater Buffalo','GTC — Genesee','HOCTS — Herkimer-Oneida','NYMTC — New York Metro','OCTC — Orange County','PDCTC — Poughkeepsie-Dutchess','UCTC — Ulster','BMTS — Binghamton','SMTC — Syracuse','A/GFTC — Adirondack','ITCTC — Ithaca-Tompkins','ECTC — Elmira-Chemung'],
    ua: ['New York–Newark NY-NJ-CT','Buffalo NY','Rochester NY','Albany–Schenectady NY','Syracuse NY','Poughkeepsie–Newburgh NY-NJ','Utica NY','Binghamton NY-PA','Kingston NY','Glens Falls NY','Saratoga Springs NY'],
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`h-8 inline-flex items-center gap-2 rounded-md bg-white border pl-2.5 pr-1.5 text-[12px] transition-colors
          ${open ? 'border-[#37576B] ring-2 ring-[#37576B]/15' : 'border-zinc-950/10 hover:border-zinc-950/20'}`}>
        <Icon name="MapLayers" className="size-3.5 text-slate-400"/>
        <span className="font-mono text-[10.5px] uppercase tracking-wider text-slate-500">{triggerKind}</span>
        <span className="text-[12px] text-[#0f1722] font-medium">{triggerLabel}</span>
        <span className="size-5 rounded hover:bg-slate-100 flex items-center justify-center text-slate-400 ml-0.5">
          <Icon name="CaretDown" className={`size-3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}/>
        </span>
      </button>

      {open && (
        <div role="dialog" className="absolute right-0 top-[calc(100%+4px)] z-30 w-[340px] rounded-md bg-white border border-zinc-950/10 shadow-lg ring-1 ring-black/5 overflow-hidden">
          <div className="px-3 pt-2.5 pb-2 border-b border-zinc-950/05">
            <div className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-slate-400 mb-2">Scope of analysis</div>
            <div className="flex gap-0.5 bg-slate-50 rounded p-0.5">
              {tabDefs.map(t => (
                <button key={t.id}
                  onClick={()=>setTab(t.id)}
                  className={`flex-1 h-7 px-1.5 rounded text-[10.5px] font-mono uppercase tracking-wider transition-colors flex items-center justify-center gap-1
                    ${tab === t.id ? 'bg-white text-[#0f1722] shadow-sm' : 'text-slate-500 hover:text-[#0f1722]'}`}>
                  <span>{t.label}</span>
                  <span className="text-slate-400 tabular-nums">{t.meta}</span>
                </button>
              ))}
            </div>
          </div>

          {tab === 'state' && (
            <div className="px-3 py-4">
              <button
                onClick={() => { onChange({ kind:'state', items:[] }); setOpen(false); }}
                className="w-full p-3 rounded-md border border-[#37576B] bg-slate-50 text-left">
                <div className="font-oswald uppercase text-[13px] tracking-[0.06em] text-[#0f1722] font-semibold">NY State</div>
                <div className="text-[11.5px] text-slate-600 mt-0.5">Statewide rollup · no geographic filter applied. All four PM3 measures shown as reported to FHWA.</div>
              </button>
            </div>
          )}

          {tab !== 'state' && (
            <>
              <div className="p-2 border-b border-zinc-950/05 bg-slate-50">
                <div className="h-8 px-2.5 rounded bg-white border border-zinc-950/10 flex items-center gap-2 text-[12.5px]">
                  <Icon name="Search" className="size-3.5 text-slate-400"/>
                  <span className="text-slate-400 flex-1">Search {tab === 'county' ? 'counties' : tab === 'mpo' ? 'MPOs' : 'urbanized areas'}…</span>
                  <span className="font-mono text-[10px] text-slate-400 tabular-nums">{OPTIONS[tab].length}</span>
                </div>
              </div>
              <div className="max-h-[240px] overflow-y-auto py-1">
                {OPTIONS[tab].map((opt, i) => (
                  <label key={opt} className="w-full flex items-center gap-2 px-3 h-8 text-[12.5px] text-slate-700 hover:bg-slate-50 cursor-pointer">
                    <input type="checkbox" defaultChecked={i < 2} className="accent-[#1F3F8F] size-3.5"/>
                    <span className="truncate">{opt}</span>
                  </label>
                ))}
              </div>
              <div className="border-t border-zinc-950/05 px-3 py-1.5 flex items-center justify-between bg-slate-50">
                <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">2 selected</span>
                <div className="flex gap-3">
                  <button className="font-mono text-[10px] uppercase tracking-wider text-slate-500 hover:text-[#0f1722]">Clear</button>
                  <button onClick={()=>setOpen(false)} className="font-mono text-[10px] uppercase tracking-wider text-[#37576B] hover:text-[#1f3450] font-semibold">Apply</button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Year-range selector — compact ───────────────────────── */
function YearRangeSelect({ range, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  const presets = [
    { id:'all', label:'All years', range:[2016, 2025] },
    { id:'5y',  label:'Last 5 yrs', range:[2021, 2025] },
    { id:'3y',  label:'Last 3 yrs', range:[2023, 2025] },
    { id:'pre', label:'Pre-COVID',  range:[2016, 2019] },
  ];
  return (
    <div ref={ref} className="relative">
      <button onClick={()=>setOpen(o=>!o)}
        className={`h-8 inline-flex items-center gap-2 rounded-md bg-white border pl-2.5 pr-1.5 text-[12px] transition-colors
          ${open ? 'border-[#37576B] ring-2 ring-[#37576B]/15' : 'border-zinc-950/10 hover:border-zinc-950/20'}`}>
        <Icon name="History" className="size-3.5 text-slate-400"/>
        <span className="font-mono text-[10.5px] uppercase tracking-wider text-slate-500">Years</span>
        <span className="font-mono tabular-nums text-[12px] text-[#0f1722] font-medium">{range[0]}–{range[1]}</span>
        <span className="size-5 rounded hover:bg-slate-100 flex items-center justify-center text-slate-400 ml-0.5">
          <Icon name="CaretDown" className={`size-3 transition-transform duration-200 ${open?'rotate-180':''}`}/>
        </span>
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+4px)] z-30 w-[180px] rounded-md bg-white border border-zinc-950/10 shadow-lg ring-1 ring-black/5 py-1">
          {presets.map(p => {
            const active = p.range[0] === range[0] && p.range[1] === range[1];
            return (
              <button key={p.id} onClick={()=>{ onChange(p.range); setOpen(false); }}
                className={`w-full flex items-center justify-between pl-3 pr-2 h-8 text-[12px] ${active?'bg-[#0a0e13] text-white':'text-slate-700 hover:bg-slate-50'}`}>
                <span>{p.label}</span>
                <span className="font-mono tabular-nums text-[10.5px] opacity-70">{p.range[0]}–{p.range[1]}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── View toggle — Graph / Table / Cards ────────────────── */
function ViewToggle({ value, onChange }) {
  const opts = [
    { id:'graph', icon:'MapLayers', label:'Graph' },
    { id:'table', icon:'Sections',  label:'Table' },
    { id:'cards', icon:'Pages',     label:'Cards' },
  ];
  return (
    <div className="h-8 inline-flex items-center rounded-md bg-white border border-zinc-950/10 p-0.5 gap-0.5">
      {opts.map(o => (
        <button key={o.id} onClick={()=>onChange(o.id)}
          className={`h-7 px-2.5 rounded text-[11px] font-mono uppercase tracking-wider flex items-center gap-1.5 ${value===o.id?'bg-[#0a0e13] text-white':'text-slate-500 hover:bg-slate-100'}`}>
          <Icon name={o.icon} className={`size-3 ${value===o.id?'text-yellow-400':'text-slate-400'}`}/>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ─── Trend line chart ────────────────────────────────────── */
function TrendChart({ m, range }) {
  const data = m.series.filter(p => p.y >= range[0] && p.y <= range[1]);
  const W = 1320, H = 280, PL = 56, PR = 20, PT = 28, PB = 36;
  const pw = W - PL - PR, ph = H - PT - PB;
  const xAt = i => PL + (data.length === 1 ? pw/2 : (i/(data.length-1))*pw);
  const yAt = v => PT + (1 - (v - m.yMin)/(m.yMax - m.yMin)) * ph;
  const path = data.map((p,i)=>(i===0?'M':'L')+xAt(i).toFixed(1)+','+yAt(p.v).toFixed(1)).join(' ');
  const area = `M ${xAt(0).toFixed(1)},${H-PB} L `+data.map((p,i)=>xAt(i).toFixed(1)+','+yAt(p.v).toFixed(1)).join(' L ')+` L ${xAt(data.length-1).toFixed(1)},${H-PB} Z`;

  // y-axis ticks
  const yTicks = (() => {
    const step = (m.yMax - m.yMin) / 5;
    return Array.from({length:6}, (_,i) => +(m.yMin + i*step).toFixed(2));
  })();

  const last = data[data.length-1];
  const lastY = yAt(last.v);
  const lastX = xAt(data.length-1);
  const meets = m.higherBetter ? last.v >= m.target : last.v <= m.target;
  const lineColor = meets ? '#10B981' : '#EF4444';
  const fillId = `g${m.id}`;

  return (
    <div className="p-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        <defs>
          <linearGradient id={fillId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.18"/>
            <stop offset="100%" stopColor={lineColor} stopOpacity="0"/>
          </linearGradient>
        </defs>

        {/* gridlines */}
        <g stroke="#e2e8f0" strokeWidth="1">
          {yTicks.map(v => (<line key={v} x1={PL} x2={W-PR} y1={yAt(v)} y2={yAt(v)}/>))}
        </g>

        {/* target rule */}
        <line x1={PL} x2={W-PR} y1={yAt(m.target)} y2={yAt(m.target)} stroke="#CA8A04" strokeWidth="1.25" strokeDasharray="5 4"/>
        <rect x={W-PR-128} y={yAt(m.target)-16} width="120" height="14" fill="#fff"/>
        <text x={W-PR-8} y={yAt(m.target)-4} fontFamily="ui-monospace" fontSize="10" fill="#CA8A04" textAnchor="end" letterSpacing="0.5">
          TARGET · {m.targetText}
        </text>

        {/* y axis labels */}
        <g fontFamily="ui-monospace" fontSize="10" fill="#94a3b8" textAnchor="end">
          {yTicks.map(v => (
            <text key={v} x={PL-8} y={yAt(v)+3}>
              {m.unit === '%' ? `${v.toFixed(0)}%` : v.toFixed(m.target < 10 ? 2 : 0)}
            </text>
          ))}
        </g>

        {/* x axis labels */}
        <g fontFamily="ui-monospace" fontSize="10.5" fill="#94a3b8" textAnchor="middle">
          {data.map((p,i)=>(<text key={p.y} x={xAt(i)} y={H-PB+18} className="tabular-nums">{p.y}</text>))}
        </g>

        {/* area + line */}
        <path d={area} fill={`url(#${fillId})`}/>
        <path d={path} fill="none" stroke={lineColor} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>

        {/* dots */}
        {data.map((p,i) => {
          const isLast = i === data.length - 1;
          const pointMeets = m.higherBetter ? p.v >= m.target : p.v <= m.target;
          return (
            <g key={p.y}>
              <circle cx={xAt(i)} cy={yAt(p.v)} r={isLast?5:3.5} fill="#fff" stroke={pointMeets?'#10B981':'#EF4444'} strokeWidth={isLast?2.5:1.5}/>
            </g>
          );
        })}

        {/* annotate latest value */}
        <g transform={`translate(${lastX}, ${lastY})`}>
          <rect x="10" y="-26" width="78" height="22" rx="3" fill="#0a0e13"/>
          <text x="49" y="-11" fontFamily="ui-monospace" fontSize="11" fontWeight="600" fill="#fff" textAnchor="middle" className="tabular-nums">
            {last.y} · {m.unit === '%' ? `${last.v.toFixed(1)}%` : last.v.toFixed(2)}
          </text>
        </g>

        {/* COVID annotation if 2020 in range */}
        {range[0] <= 2020 && range[1] >= 2020 && (() => {
          const ci = data.findIndex(p => p.y === 2020);
          if (ci < 0) return null;
          return (
            <g>
              <line x1={xAt(ci)} x2={xAt(ci)} y1={PT} y2={H-PB} stroke="#94a3b8" strokeWidth="1" strokeDasharray="2 3" opacity="0.5"/>
              <text x={xAt(ci)} y={PT-6} fontFamily="ui-monospace" fontSize="9" fill="#94a3b8" textAnchor="middle" letterSpacing="0.5">2020 · COVID</text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}

/* ─── Tabular view ────────────────────────────────────────── */
function TrendTable({ m, range }) {
  const data = m.series.filter(p => p.y >= range[0] && p.y <= range[1]);
  const fmt = v => m.unit === '%' ? `${v.toFixed(1)}%` : v.toFixed(2);
  return (
    <div className="p-4">
      <table className="w-full text-[12.5px] tbl">
        <thead>
          <tr className="bg-slate-50">
            <th className="text-left font-mono text-[10px] uppercase tracking-wider text-slate-500 px-4 py-2.5">Year</th>
            <th className="text-right font-mono text-[10px] uppercase tracking-wider text-slate-500 px-4 py-2.5">Value</th>
            <th className="text-right font-mono text-[10px] uppercase tracking-wider text-slate-500 px-4 py-2.5">Δ y/y</th>
            <th className="text-right font-mono text-[10px] uppercase tracking-wider text-slate-500 px-4 py-2.5">vs target</th>
            <th className="text-left font-mono text-[10px] uppercase tracking-wider text-slate-500 px-4 py-2.5">Status</th>
            <th className="text-left font-mono text-[10px] uppercase tracking-wider text-slate-500 px-4 py-2.5">Note</th>
          </tr>
        </thead>
        <tbody>
          {data.map((p, i) => {
            const prev = data[i-1];
            const dy = prev ? p.v - prev.v : null;
            const dt = p.v - m.target;
            const meets = m.higherBetter ? p.v >= m.target : p.v <= m.target;
            return (
              <tr key={p.y}>
                <td className="px-4 py-2 font-mono tabular-nums font-medium text-[#0f1722]">{p.y}</td>
                <td className="px-4 py-2 font-mono tabular-nums text-right text-[#0f1722]">{fmt(p.v)}</td>
                <td className={`px-4 py-2 font-mono tabular-nums text-right ${dy === null ? 'text-slate-400' : (dy > 0 === m.higherBetter ? 'text-emerald-700' : 'text-rose-700')}`}>
                  {dy === null ? '—' : `${dy > 0 ? '+' : ''}${m.unit === '%' ? dy.toFixed(1) : dy.toFixed(2)}`}
                </td>
                <td className="px-4 py-2 font-mono tabular-nums text-right text-slate-600">
                  {`${dt > 0 ? '+' : ''}${m.unit === '%' ? dt.toFixed(1) : dt.toFixed(2)}`}
                </td>
                <td className="px-4 py-2">
                  <span className="inline-flex items-center gap-1.5 text-[11.5px]">
                    <span className={`size-2 rounded-full ${meets?'bg-emerald-500':'bg-rose-500'}`}/>
                    <span className={meets?'text-emerald-700':'text-rose-700'}>{meets ? 'meets target' : 'misses'}</span>
                  </span>
                </td>
                <td className="px-4 py-2 text-[11.5px] text-slate-500">
                  {p.y === 2020 ? 'COVID demand shock' : p.y === 2018 ? 'NPMRDS v2 cutover' : p.y === 2022 ? 'TPM rules update' : ''}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Year cards view ─────────────────────────────────────── */
function TrendCards({ m, range }) {
  const data = m.series.filter(p => p.y >= range[0] && p.y <= range[1]);
  const fmt = v => m.unit === '%' ? `${v.toFixed(1)}` : v.toFixed(2);
  return (
    <div className="p-4">
      <div className="grid gap-3" style={{gridTemplateColumns: `repeat(${Math.min(data.length, 10)}, minmax(0,1fr))`}}>
        {data.map((p, i) => {
          const prev = data[i-1];
          const dy = prev ? p.v - prev.v : null;
          const meets = m.higherBetter ? p.v >= m.target : p.v <= m.target;
          const dyPos = dy === null ? null : (dy > 0) === m.higherBetter;
          return (
            <div key={p.y} className={`rounded border p-3 ${meets?'border-emerald-200 bg-emerald-50/40':'border-rose-200 bg-rose-50/30'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500 tabular-nums">{p.y}</span>
                <span className={`size-1.5 rounded-full ${meets?'bg-emerald-500':'bg-rose-500'}`}/>
              </div>
              <div className="font-oswald font-semibold text-[22px] leading-none tabular-nums text-[#0f1722]">
                {fmt(p.v)}<span className="text-[12px] text-slate-400 ml-0.5">{m.unit}</span>
              </div>
              {dy !== null && (
                <div className={`font-mono text-[10.5px] tabular-nums mt-1 ${dyPos?'text-emerald-700':'text-rose-700'}`}>
                  {dy > 0 ? '+' : ''}{m.unit === '%' ? dy.toFixed(1) : dy.toFixed(2)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Measure section ─────────────────────────────────────── */
function MeasureSection({ m, range }) {
  const [view, setView] = useState('graph');
  const last = m.series[m.series.length - 1];
  const first = m.series.find(p => p.y === range[0]) || m.series[0];
  const decadeDelta = last.v - first.v;
  const meets = m.higherBetter ? last.v >= m.target : last.v <= m.target;
  const fmt = v => m.unit === '%' ? `${v.toFixed(1)}%` : v.toFixed(2);
  const deltaImproved = (decadeDelta > 0) === m.higherBetter;

  return (
    <section data-section data-screen-label={`${m.kicker} ${m.name}`} className="bg-[#f1f3f6] border-b border-zinc-950/05">
      <div className="mx-auto max-w-[1480px] px-8 py-8">
        <div className="bg-white border border-zinc-950/08 rounded-lg shadow-sm p-7">

        {/* head */}
        <div className="flex items-end justify-between gap-8 mb-6">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 mb-1.5">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-[#CA8A04]">{m.kicker}</span>
              <span className="font-oswald uppercase text-[11px] tracking-[0.18em] text-slate-500">{m.measure}</span>
              <span className="font-mono text-[10px] text-slate-400 tabular-nums">· target {m.targetText}</span>
            </div>
            <h2 className="font-oswald font-medium text-[24px] text-[#0f1722] leading-tight">{m.name}</h2>
            <p className="font-proxima text-slate-600 text-[13px] leading-[1.55] mt-2 max-w-[760px]">{m.desc}</p>
          </div>

          {/* right rail KPI */}
          <div className="flex items-stretch gap-6 flex-shrink-0">
            <div className="text-right">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">CY {last.y}</div>
              <div className="font-oswald font-semibold text-[40px] leading-none tabular-nums text-[#0f1722]">{fmt(last.v)}</div>
              <div className="mt-1.5 inline-flex items-center gap-1.5 text-[11.5px]">
                <span className={`size-2 rounded-full ${meets?'bg-emerald-500':'bg-rose-500'}`}/>
                <span className={meets?'text-emerald-700':'text-rose-700'}>{meets?'meets':'misses'} target</span>
              </div>
            </div>
            <div className="w-px bg-zinc-950/08"/>
            <div className="text-right">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">Δ since {first.y}</div>
              <div className={`font-oswald font-semibold text-[40px] leading-none tabular-nums ${deltaImproved?'text-emerald-700':'text-rose-700'}`}>
                {decadeDelta > 0 ? '+' : ''}{m.unit === '%' ? decadeDelta.toFixed(1) : decadeDelta.toFixed(2)}
              </div>
              <div className="mt-1.5 font-mono text-[10.5px] text-slate-500 uppercase tracking-wider">{deltaImproved ? 'improved' : 'regressed'}</div>
            </div>
          </div>
        </div>

        {/* view toggle */}
        <div className="flex items-center justify-between mb-3">
          <div className="font-mono text-[10.5px] uppercase tracking-wider text-slate-500">
            10-year trend · {range[0]}–{range[1]}
          </div>
          <ViewToggle value={view} onChange={setView}/>
        </div>

        {/* body — sits directly inside the card, divided by a hairline */}
        <div className="border-t border-zinc-950/05 -mx-7 -mb-7 px-7 pt-2 pb-4 bg-slate-50/40 rounded-b-lg">
          {view === 'graph' && <TrendChart m={m} range={range}/>}
          {view === 'table' && <TrendTable m={m} range={range}/>}
          {view === 'cards' && <TrendCards m={m} range={range}/>}

          {/* legend / small note */}
          {view === 'graph' && (
            <div className="px-4 pb-2 flex items-center gap-4 font-mono text-[10px] uppercase tracking-wider text-slate-500">
              <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 bg-[#10B981]"/>annual value · {m.measure}</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-px w-4 border-t border-dashed border-[#CA8A04]"/>FHWA target</span>
              <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-emerald-500"/>meets</span>
              <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-rose-500"/>misses</span>
            </div>
          )}
        </div>

        </div>
      </div>
    </section>
  );
}

/* ─── Compact summary band ────────────────────────────────── */
function SummaryBand({ scope }) {
  const meet = MEASURES.filter(m => {
    const last = m.series[m.series.length-1];
    return m.higherBetter ? last.v >= m.target : last.v <= m.target;
  }).length;
  return (
    <section data-section data-screen-label="Summary" className="bg-[#f1f3f6] border-b border-zinc-950/05">
      <div className="mx-auto max-w-[1480px] px-8 py-8">
        <div className="grid grid-cols-12 gap-6 items-center">
          <div className="col-span-4">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-[#CA8A04] mb-1">// overall · CY 2025</div>
            <div className="flex items-baseline gap-3">
              <span className="font-oswald font-semibold text-[44px] leading-none tabular-nums text-[#0f1722]">{meet}/4</span>
              <span className="font-oswald uppercase text-[14px] tracking-wide text-slate-600">measures meeting target</span>
            </div>
            <div className="font-mono text-[11px] text-slate-500 mt-1.5">scope: <span className="text-[#0f1722]">{scope}</span></div>
          </div>
          {MEASURES.map(m => {
            const last = m.series[m.series.length-1];
            const meets = m.higherBetter ? last.v >= m.target : last.v <= m.target;
            const first = m.series[0];
            const delta = last.v - first.v;
            const improved = (delta > 0) === m.higherBetter;
            return (
              <a key={m.id} href={`#${m.id}`} className="col-span-2 group">
                <div className="font-mono text-[9.5px] uppercase tracking-wider text-slate-400 mb-1">{m.kicker.replace('// ','')}</div>
                <div className="font-oswald uppercase text-[11px] tracking-[0.06em] text-[#0f1722] font-semibold leading-tight mb-2 group-hover:text-[#1F3F8F]">{m.name}</div>
                <div className="flex items-baseline gap-1.5">
                  <span className={`size-2 rounded-full ${meets?'bg-emerald-500':'bg-rose-500'}`}/>
                  <span className="font-oswald font-semibold text-[20px] tabular-nums leading-none text-[#0f1722]">
                    {m.unit === '%' ? `${last.v.toFixed(1)}%` : last.v.toFixed(2)}
                  </span>
                </div>
                <div className={`font-mono text-[10px] tabular-nums mt-1 ${improved?'text-emerald-700':'text-rose-700'}`}>
                  {delta > 0 ? '+' : ''}{m.unit === '%' ? delta.toFixed(1) : delta.toFixed(2)} <span className="text-slate-400">since 2016</span>
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─── Methodology note (footer) ───────────────────────────── */
function MethodologyNote() {
  return (
    <section data-section className="bg-[#f1f3f6]">
      <div className="mx-auto max-w-[1480px] px-8 py-10">
        <div className="rounded-md border border-zinc-950/08 bg-white p-6">
          <div className="flex items-start gap-6">
            <div className="size-9 rounded bg-[#1F3F8F]/10 flex items-center justify-center flex-shrink-0">
              <Icon name="Pages" className="size-5 text-[#1F3F8F]"/>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-[#CA8A04] mb-1">// methodology</div>
              <div className="font-oswald uppercase text-[15px] tracking-[0.06em] text-[#0f1722] font-semibold mb-2">How these numbers are produced</div>
              <p className="text-[13px] text-slate-600 leading-[1.55] max-w-[820px]">
                Annual rollups are computed from NPMRDS probe data submitted to FHWA per 23 CFR § 490. Per-year values match FHWA-published targets within ±0.05 pp; small discrepancies stem from data-version cutoffs (NPMRDS v1 → v2 in 2017, v2 → v2.1 in 2022) which are noted in each table&apos;s y/y column.
              </p>
              <div className="mt-4 flex flex-wrap gap-6 font-mono text-[11px] uppercase tracking-wider">
                <a className="text-[#37576B] hover:text-[#1f3450] inline-flex items-center gap-1">FHWA 23 CFR 490 <Icon name="ChevronRight" className="size-3.5"/></a>
                <a className="text-[#37576B] hover:text-[#1f3450] inline-flex items-center gap-1">data dictionary <Icon name="ChevronRight" className="size-3.5"/></a>
                <a className="text-[#37576B] hover:text-[#1f3450] inline-flex items-center gap-1">switch to per-year view <Icon name="ChevronRight" className="size-3.5"/></a>
              </div>
            </div>
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

/* ─── App ─────────────────────────────────────────────────── */
function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [geography, setGeography] = useState({ kind:'state', items:[] });
  const [range, setRange] = useState([2016, 2025]);

  const scopeLabel = (() => {
    if (geography.kind === 'state') return 'NY State (all reportable TMCs)';
    if (geography.items.length === 1) return geography.items[0];
    return `${geography.items.length} ${geography.kind === 'county' ? 'counties' : geography.kind === 'mpo' ? 'MPOs' : 'urbanized areas'}`;
  })();

  return (
    <div className="min-h-screen bg-[#f1f3f6]">
      <Sidebar/>
      <main data-screen-label="MAP-21 PM3 Trend" className="ml-60">
        <TNYPageHeader
          breadcrumb={[
            {label:'NPMRDS', href:'#'},
            {label:'MAP-21 PM3', href:'map-21.html'},
            {label:'Overall trend'},
          ]}
          kicker="// federal reporting"
          meta="overall view · 10-yr"
          title="MAP-21 PM3 · Trend"
          accent="."
          desc="Multi-year trajectory of all four PM3 measures across a geographic scope of your choice. For drill-down on a single calendar year (TMC map, MPO leaderboard, route-class breakdown), use the per-year view."
          actions={
            <div className="flex items-center gap-2">
              <GeographySelect value={geography} onChange={setGeography}/>
              <YearRangeSelect range={range} onChange={setRange}/>
              <a href="map-21.html" className="h-8 inline-flex items-center gap-1.5 px-3 rounded-md border border-zinc-950/10 hover:bg-white text-slate-700 text-[11px] font-mono uppercase tracking-wider">
                Per-year view <Icon name="ChevronRight" className="size-3.5"/>
              </a>
            </div>
          }
          refresh="2026-05-08 04:12 EST"
        />

        <SummaryBand scope={scopeLabel}/>

        {MEASURES.map(m => (
          <div key={m.id} id={m.id}>
            <MeasureSection m={m} range={range}/>
          </div>
        ))}

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
