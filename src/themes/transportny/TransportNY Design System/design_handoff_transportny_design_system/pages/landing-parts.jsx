/* eslint-disable */
// TransportNY public landing page — building blocks.
// All components are exported via window.* at the bottom so landing-app.jsx
// can compose them.

const { useState, useEffect, useRef, useMemo } = React;
const Icon = window.TNYIcon;

/* ─────────────────────────────────────────────────────────────
   Route shield — small SVG mark for interstate / NY route numbers.
   Variants: 'interstate' (NYS-blue shield), 'us' (white roundel),
             'ny' (NY State silhouette outline).
   ───────────────────────────────────────────────────────────── */
function RouteShield({ num, kind = 'interstate', size = 28, dim = false }) {
  const dimCls = dim ? 'opacity-70' : '';
  if (kind === 'interstate') {
    return (
      <span className={`inline-flex items-center justify-center ${dimCls}`} style={{ width: size, height: size }}>
        <svg viewBox="0 0 32 32" width={size} height={size}>
          <path d="M16 1 C 9 1 3 5 3 12 C 3 22 16 31 16 31 C 16 31 29 22 29 12 C 29 5 23 1 16 1 Z"
                fill="#37576B" stroke="#FACC15" strokeWidth="1.5"/>
          <text x="16" y="20" textAnchor="middle" fontFamily="Oswald, sans-serif" fontWeight="700"
                fontSize={String(num).length > 2 ? 10 : 12} fill="#fff" letterSpacing=".5">{num}</text>
        </svg>
      </span>
    );
  }
  // 'ny' route — black square, gold center
  return (
    <span className={`inline-flex items-center justify-center ${dimCls}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 32 32" width={size} height={size}>
        <rect x="2" y="2" width="28" height="28" rx="3" fill="#0a0e13" stroke="#FACC15" strokeWidth="1.5"/>
        <text x="16" y="20" textAnchor="middle" fontFamily="Oswald, sans-serif" fontWeight="700"
              fontSize={String(num).length > 2 ? 10 : 12} fill="#FACC15">{num}</text>
      </svg>
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────
   Spark — sparkline. Uses theme palette by class.
   ───────────────────────────────────────────────────────────── */
function Spark({ values, w = 120, h = 32, stroke = '#37576B', fill = 'rgba(55,87,107,0.12)', dot = false }) {
  const max = Math.max(...values), min = Math.min(...values);
  const dx = w / (values.length - 1);
  const y = v => h - 2 - ((v - min) / (max - min || 1)) * (h - 4);
  let line = `M 0 ${y(values[0])}`;
  let area = `M 0 ${h} L 0 ${y(values[0])}`;
  values.forEach((v, i) => { if (i) { line += ` L ${i * dx} ${y(v)}`; area += ` L ${i * dx} ${y(v)}`; } });
  area += ` L ${w} ${h} Z`;
  const last = values.length - 1;
  return (
    <svg width={w} height={h} className="block">
      <path d={area} fill={fill}/>
      <path d={line} fill="none" stroke={stroke} strokeWidth="1.5"/>
      {dot && <circle cx={last * dx} cy={y(values[last])} r="2.5" fill={stroke}/>}
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────
   TopNav — public marketing nav. Sits over the dark hero.
   ───────────────────────────────────────────────────────────── */
function TopNav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const items = [
    { id: 'products', label: 'Products' },
    { id: 'data',     label: 'Data sources' },
    { id: 'about',    label: 'About' },
    { id: 'docs',     label: 'Docs' },
  ];
  return (
    <nav className={`fixed top-0 inset-x-0 z-40 transition-all duration-300 ${scrolled ? 'bg-[#0a0e13]/95 backdrop-blur border-b border-[#2a3545]' : ''}`}>
      <div className="max-w-[1280px] mx-auto px-8 h-[64px] flex items-center justify-between">
        <a href="#top" className="flex items-center gap-3 group">
          <img src="../assets/nys_logo_white.svg" alt="NYS" className="h-7 w-auto opacity-95"/>
          <div className="h-6 w-px bg-white/20"/>
          <div className="font-oswald uppercase text-white text-[17px] tracking-wide font-semibold leading-none">TransportNY</div>
        </a>
        <div className="flex items-center gap-1">
          {items.map(it => (
            <a key={it.id} href={'#' + it.id}
              className="px-3 h-9 flex items-center font-oswald uppercase text-[12px] tracking-[0.16em] text-slate-300 hover:text-white transition-colors">
              {it.label}
            </a>
          ))}
          <div className="ml-3 flex items-center gap-1.5">
            <button className="h-9 w-9 flex items-center justify-center rounded-full text-slate-300 hover:text-white hover:bg-white/10 transition-colors">
              <Icon name="Search" className="size-4"/>
            </button>
            <a href="#" className="h-9 px-4 rounded-full bg-[#FACC15] text-[#0a0e13] font-proxima font-bold text-[11.5px] uppercase tracking-[0.15em] flex items-center gap-1.5 hover:bg-[#FFD744] transition-colors">
              Sign in <Icon name="ChevronRight" className="size-3.5"/>
            </a>
          </div>
        </div>
      </div>
    </nav>
  );
}

/* ─────────────────────────────────────────────────────────────
   Hero — photo background, big Oswald, live counters.
   ───────────────────────────────────────────────────────────── */
function Hero({ tweaks }) {
  // running NYC time
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) + ' EST';

  return (
    <section id="top" data-screen-label="01 Hero" className="relative overflow-hidden text-white hero-dark hero-vignette scan"
             style={{ minHeight: 580 }}>
      <div className="absolute inset-0 grid-dark pointer-events-none"/>

      {/* corner crosshair */}
      <div className="absolute top-[88px] left-8 z-10 flex items-center gap-2 font-mono text-[10px] text-white/60 tracking-[0.2em] uppercase">
        <span className="size-1 bg-[#FACC15]"/>
        <span>43.0°N · 74.5°W · NYS</span>
      </div>
      <div className="absolute top-[88px] right-8 z-10 flex items-center gap-2 font-mono text-[10.5px] text-white/85 bg-black/30 backdrop-blur px-2.5 py-1 rounded-full">
        <span className="size-1.5 rounded-full bg-[#FACC15] shadow-[0_0_6px_rgba(250,204,21,0.9)] dot-pulse"/>
        <span className="text-[#FACC15] font-semibold">LIVE</span>
        <span className="text-white/40">·</span>
        <span>1,204 STATIONS</span>
        <span className="text-white/40">·</span>
        <span className="tabular-nums">{time}</span>
      </div>

      <div className="relative z-10 max-w-[1280px] mx-auto px-8 pt-[140px] pb-16">
        {/* kicker */}
        <div className="flex items-center gap-3 mb-6">
          <span className="font-mono text-[10.5px] tracking-[0.25em] uppercase text-[#FACC15]">// the platform</span>
          <span className="h-px w-16 bg-[#FACC15]/40"/>
          <span className="font-mono text-[10.5px] tracking-[0.2em] uppercase text-white/50">est. 2014 · NYSDOT × AVAIL</span>
        </div>

        {/* big headline */}
        <h1 className="font-oswald font-semibold text-white tracking-tight leading-[0.98] uppercase"
            style={{ fontSize: 'clamp(40px, 5.2vw, 72px)' }}>
          New York&apos;s transportation<br/>
          data, <span className="text-[#FACC15]">published.</span>
        </h1>

        <p className="font-proxima text-white/85 text-[16px] leading-[1.55] mt-5 max-w-[600px]">
          Four data products — one chrome — for NYSDOT staff, MPOs, and the practitioners who plan, fund, and operate the New York State transportation network. Updated quarterly from federal and in-state feeds.
        </p>

        {/* action row */}
        <div className="flex flex-wrap items-center gap-3 mt-7">
          <a href="#products" className="h-11 px-5 rounded-md bg-[#EAAD43] hover:bg-[#F1CA87] text-[#37576B] font-proxima font-bold text-[12px] uppercase tracking-[0.12em] border-b-4 border-[#C68B1F] tny-press inline-flex items-center gap-2">
            Browse products <Icon name="ChevronRight" className="size-4"/>
          </a>
          <a href="#products" className="h-11 px-5 rounded-md bg-white/10 hover:bg-white/15 border border-white/20 text-white font-proxima font-bold text-[12px] uppercase tracking-[0.12em] inline-flex items-center gap-2 backdrop-blur">
            <Icon name="MapLayers" className="size-4 text-[#FACC15]"/>Open Freight Atlas
          </a>
          <div className="h-11 flex items-center gap-3 pl-3 border-l border-white/15 ml-1">
            <span className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-white/45">released</span>
            <span className="font-mono text-[11px] tabular-nums text-white/80">v2026.2 · May 8</span>
          </div>
        </div>

        {/* live counters row */}
        <div className="mt-10 grid grid-cols-4 gap-px bg-white/10 border border-white/10 rounded-lg overflow-hidden max-w-[860px]">
          {[
            { k: 'Corridors',      v: '142',   sub: 'NHS + TPF', trend: [120,124,128,132,136,140,142], col: '#FACC15' },
            { k: 'Count stations', v: '1,204', sub: '18 offline',   trend: [1180,1190,1196,1200,1203,1204,1204], col: '#FACC15' },
            { k: 'Tons / yr',      v: '248.7M',sub: '+1.9% y/y',    trend: [180,184,162,210,235,243,248], col: '#FACC15' },
            { k: 'Last update',    v: '04:12', sub: 'EST · today',  trend: [1,1,1,1,1,1,1], col: '#FACC15', solid: true },
          ].map((c, i) => (
            <div key={i} className="bg-[#0a0e13] px-4 py-3.5">
              <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-white/50">{c.k}</div>
              <div className="font-oswald font-semibold text-white text-[28px] leading-none mt-2 tabular-nums count-in" style={{ animationDelay: (i * 0.1) + 's' }}>{c.v}</div>
              <div className="flex items-end justify-between mt-2">
                <span className="font-mono text-[10.5px] text-white/55">{c.sub}</span>
                {!c.solid && <Spark values={c.trend} w={70} h={20} stroke="#FACC15" fill="rgba(250,204,21,0.18)" dot/>}
                {c.solid && <span className="size-1.5 rounded-full bg-[#FACC15] dot-pulse"/>}
              </div>
            </div>
          ))}
        </div>
      </div>

    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   Section eyebrow (kicker + Oswald title + meta)
   ───────────────────────────────────────────────────────────── */
function SectionHeader({ num, kicker, title, sub, meta }) {
  return (
    <div className="flex items-end justify-between gap-8 mb-10">
      <div>
        <div className="flex items-center gap-3 mb-3">
          {num && <span className="font-mono text-[11px] text-[#CA8A04]">{num}</span>}
          <span className="font-oswald uppercase text-[11px] tracking-[0.2em] text-slate-500">{kicker}</span>
          <span className="h-px w-12 bg-[#CA8A04]/60"/>
        </div>
        <h2 className="font-oswald font-semibold text-[44px] leading-[1.02] text-[#0f1722] tracking-tight max-w-[700px]">{title}</h2>
        {sub && <p className="font-proxima text-slate-600 text-[15px] leading-[1.6] mt-3 max-w-[620px]">{sub}</p>}
      </div>
      {meta && <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-slate-400 text-right">{meta}</div>}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Product card — one of NPMRDS, Freight Atlas, TSMO, Sandbox.
   Each gets a unique data-themed thumbnail.
   ───────────────────────────────────────────────────────────── */
function ProductThumb({ kind }) {
  if (kind === 'npmrds') {
    // Reliability sparklines stacked
    return (
      <div className="h-full w-full p-4 flex flex-col justify-end gap-1.5 topo">
        {[
          { v: [12,14,11,15,18,17,20,22,21,24,23,26], stroke: '#37576B' },
          { v: [18,16,19,17,21,20,18,22,24,22,25,27], stroke: '#37576B' },
          { v: [14,15,12,16,15,19,21,18,23,22,25,24], stroke: '#CA8A04' },
          { v: [10,12,13,11,14,15,16,17,16,18,19,20], stroke: '#37576B' },
        ].map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="font-mono text-[9px] text-slate-500 w-12 flex-shrink-0">I-{[87,90,81,95][i]} {['N','E','S','N'][i]}</span>
            <Spark values={s.v} w={170} h={14} stroke={s.stroke} fill={s.stroke === '#CA8A04' ? 'rgba(202,138,4,0.16)' : 'rgba(55,87,107,0.10)'}/>
            <span className="font-mono text-[9px] text-slate-500 ml-auto tabular-nums">{(1.2 + i * 0.08).toFixed(2)}</span>
          </div>
        ))}
      </div>
    );
  }
  if (kind === 'freightatlas') {
    // Mini NYS map with corridor lines + count station dots
    return (
      <div className="h-full w-full relative topo">
        <svg viewBox="0 0 280 160" className="absolute inset-0 w-full h-full">
          {/* NY State outline (rough) */}
          <path d="M 30 50 L 60 30 L 100 25 L 150 35 L 200 30 L 245 40 L 250 70 L 245 100 L 200 120 L 170 140 L 130 135 L 90 130 L 60 110 L 35 90 Z"
                fill="rgba(15,23,42,0.04)" stroke="rgba(15,23,42,0.18)" strokeWidth="1"/>
          {/* corridors */}
          <path d="M 80 40 C 110 50 150 60 220 70" stroke="#CA8A04" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
          <path d="M 200 35 L 210 80 L 200 120" stroke="#CA8A04" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
          <path d="M 120 30 L 130 90 L 140 135" stroke="#37576B" strokeWidth="2" fill="none" strokeLinecap="round"/>
          <path d="M 60 110 L 240 95" stroke="#37576B" strokeWidth="2" fill="none" strokeLinecap="round" strokeDasharray="2 6"/>
          {/* count stations */}
          {[[80,40],[150,55],[210,68],[200,35],[210,80],[200,120],[130,90],[140,135],[180,98],[100,80],[60,80],[240,95]].map((p,i) => (
            <g key={i}>
              <circle cx={p[0]} cy={p[1]} r="3" fill="#fff" stroke="#37576B" strokeWidth="1.2"/>
              {i % 3 === 0 && <circle cx={p[0]} cy={p[1]} r="6" fill="none" stroke="#FACC15" strokeWidth="1" className="dot-pulse"/>}
            </g>
          ))}
        </svg>
        <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between font-mono text-[9px] uppercase tracking-wider text-slate-500">
          <span>nys · freight corridors</span>
          <span className="text-[#CA8A04]">142 active</span>
        </div>
      </div>
    );
  }
  if (kind === 'tsmo') {
    // Incident / ops event bars by hour
    const bars = [4,6,3,5,7,9,11,14,18,22,19,16,17,21,24,28,26,22,17,12,9,7,5,4];
    const max = Math.max(...bars);
    return (
      <div className="h-full w-full p-4 flex flex-col justify-end topo">
        <div className="flex items-end gap-[3px] h-[110px]">
          {bars.map((b, i) => (
            <div key={i} className="flex-1 rounded-t-sm" style={{ height: ((b/max)*100) + '%', background: i >= 13 && i <= 17 ? '#CA8A04' : '#37576B' }}/>
          ))}
        </div>
        <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-wider text-slate-500 mt-2">
          <span>00:00</span><span className="text-[#CA8A04]">peak 14–17</span><span>23:59</span>
        </div>
      </div>
    );
  }
  if (kind === 'sandbox') {
    // grid of mini tiles — a chaotic but interesting thumbnail
    return (
      <div className="h-full w-full p-3 topo grid grid-cols-4 gap-1.5">
        {Array.from({ length: 12 }, (_, i) => {
          const fills = [
            <Spark values={[2,4,3,5,7,8,7,9]} w={50} h={22} stroke="#37576B"/>,
            <div className="h-full w-full flex items-end gap-[2px]">{[3,5,4,7,6,8].map((h,j) => <div key={j} className="flex-1 bg-[#37576B] rounded-sm" style={{ height: (h/8*100) + '%' }}/>)}</div>,
            <div className="h-full w-full flex items-center justify-center font-mono text-[10px] text-slate-500">{[42,'<>','π','σ','Δ','∑','—','‖'][i%8]}</div>,
            <Spark values={[4,3,5,4,6,5,7]} w={50} h={22} stroke="#CA8A04" fill="rgba(202,138,4,0.18)"/>,
          ];
          return (
            <div key={i} className="bg-white border border-slate-200 rounded p-1.5 h-[42px] overflow-hidden">
              {fills[i % fills.length]}
            </div>
          );
        })}
      </div>
    );
  }
}

function ProductCard({ id, name, kicker, blurb, count, countLabel, accent, kind, status }) {
  return (
    <a href="#" id={id} className="prod-card relative block rounded-[14px] bg-white border border-zinc-950/10 overflow-hidden">
      {/* thumbnail */}
      <div className="h-[170px] relative bg-[#f8f9fb] border-b border-zinc-950/10 overflow-hidden">
        <ProductThumb kind={kind}/>
        {/* status pill */}
        <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/95 border border-zinc-950/10 backdrop-blur">
          <span className={`size-1.5 rounded-full ${status === 'live' ? 'bg-emerald-500' : 'bg-amber-500'} ${status === 'live' ? 'dot-pulse' : ''}`}/>
          <span className="font-mono text-[10px] uppercase tracking-wider text-slate-700">{status === 'live' ? 'Live' : 'Beta'}</span>
        </div>
      </div>
      {/* body */}
      <div className="p-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="size-1.5 rounded-full" style={{ background: accent }}/>
          <span className="font-oswald uppercase text-[10.5px] tracking-[0.18em] text-slate-500">{kicker}</span>
        </div>
        <div className="font-oswald font-semibold text-[22px] uppercase tracking-tight text-[#0f1722] leading-none">{name}</div>
        <p className="font-proxima text-slate-600 text-[13.5px] leading-[1.5] mt-2 min-h-[58px]">{blurb}</p>
        <div className="mt-4 pt-3 border-t border-zinc-950/05 flex items-end justify-between">
          <div>
            <div className="font-oswald font-semibold text-[26px] tabular-nums leading-none text-[#0f1722]">{count}</div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500 mt-1">{countLabel}</div>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[#37576B] text-[12.5px] font-proxima font-medium prod-arrow">
            Open <Icon name="ChevronRight" className="size-3.5"/>
          </span>
        </div>
      </div>
    </a>
  );
}

Object.assign(window, { RouteShield, Spark, TopNav, Hero, SectionHeader, ProductThumb, ProductCard });
