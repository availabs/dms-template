/* eslint-disable */
// TransportNY public landing page — composition.

const { useState: useStateApp, useEffect: useEffectApp } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "showPulse": true,
  "showChangelog": true
}/*EDITMODE-END*/;

/* ─────────────────────────────────────────────────────────────
   Pulse — live network strip. Combination of a corridor table,
   a live event feed, and a network status tile.
   ───────────────────────────────────────────────────────────── */
function PulseSection() {
  // pseudo-live events that update on a timer
  const [events, setEvents] = useStateApp([
    { t: '04:12:38', tag: 'CCS-014', route: 'I-87 N',  msg: 'ping 3,840 vph · 14.6% trucks',   delta: '+0.3%', up: true },
    { t: '04:11:51', tag: 'FAF5',    route: '—',       msg: 'Q4 2024 estimates merged · 142 rows', delta: 'sync', up: true },
    { t: '04:10:17', tag: 'CCS-027', route: 'I-90 E',  msg: 'congestion threshold breached',   delta: '-1.1%', up: false },
    { t: '04:08:02', tag: 'NPMRDS',  route: 'I-81 S',  msg: 'TTI 1.42 → 1.38 · Watertown seg', delta: '+2.8%', up: true },
    { t: '04:06:44', tag: 'CCS-088', route: 'NY-17',   msg: 'station offline · maintenance',   delta: 'stale', up: false },
    { t: '04:05:11', tag: 'CCS-049', route: 'I-86 E',  msg: 'classified counts uploaded',      delta: 'ok',    up: true },
  ]);
  useEffectApp(() => {
    const t = setInterval(() => {
      setEvents(prev => {
        const next = [...prev];
        next[0] = { ...next[0], t: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) };
        return next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const corridors = [
    { id: 'I-87',  num: 87,  name: 'Albany – Plattsburgh',     aadt: '38,420', delta: '+3.1', up: true,  spark: [10,11,9,12,14,13,15] },
    { id: 'I-90',  num: 90,  name: 'Buffalo – Albany',          aadt: '52,108', delta: '+1.4', up: true,  spark: [14,13,15,14,16,18,17] },
    { id: 'I-81',  num: 81,  name: 'Watertown – Syracuse',      aadt: '29,776', delta: '-0.6', up: false, spark: [12,14,13,12,11,11,10] },
    { id: 'I-95',  num: 95,  name: 'NYC – Connecticut',         aadt: '94,540', delta: '+2.0', up: true,  spark: [22,21,23,24,26,25,28] },
    { id: 'I-86',  num: 86,  name: 'Corning – Binghamton',      aadt: '21,330', delta: '+0.7', up: true,  spark: [8,9,8,10,9,11,10] },
    { id: 'NY-17', num: 17,  name: 'Catskills corridor',        aadt: '32,212', delta: '+2.6', up: true,  spark: [9,10,11,10,12,13,14], kind: 'ny' },
  ];

  return (
    <section data-screen-label="03 Pulse" className="relative py-24 bg-[#0a0e13] text-white overflow-hidden">
      <div className="absolute inset-0 grid-dark pointer-events-none"/>
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(250,204,21,0.06), transparent 60%), radial-gradient(ellipse 50% 60% at 100% 100%, rgba(55,87,107,0.4), transparent 70%)'
      }}/>
      <div className="relative max-w-[1280px] mx-auto px-8">
        <div className="flex items-end justify-between mb-10">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="font-mono text-[11px] text-[#FACC15]">// 03</span>
              <span className="font-oswald uppercase text-[11px] tracking-[0.2em] text-white/55">Pulse</span>
              <span className="h-px w-12 bg-[#FACC15]/60"/>
              <span className="inline-flex items-center gap-1.5 ml-2 px-2 py-0.5 rounded-full bg-[#FACC15]/15 border border-[#FACC15]/40">
                <span className="size-1.5 rounded-full bg-[#FACC15] dot-pulse"/>
                <span className="font-mono text-[10px] uppercase tracking-wider text-[#FACC15]">streaming</span>
              </span>
            </div>
            <h2 className="font-oswald font-semibold text-white text-[44px] leading-[1.02] tracking-tight max-w-[760px]">Today on the network<span className="text-[#FACC15]">.</span></h2>
            <p className="font-proxima text-white/65 text-[15px] leading-[1.6] mt-3 max-w-[620px]">
              Live throughput, reliability, and event feed across the New York State NHS. Sampled every 60 seconds from 1,204 continuous count stations.
            </p>
          </div>
          <div className="hidden md:flex flex-col items-end gap-1 font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/45 text-right">
            <span>region · NY-08 capital district</span>
            <span>cycle 4 / 4 · 60s ago</span>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-4">
          {/* corridor strip — 7 cols */}
          <div className="col-span-12 lg:col-span-7 rounded-xl bg-[#11161e] border border-[#2a3545] overflow-hidden">
            <div className="px-5 py-3 flex items-center justify-between border-b border-[#2a3545]">
              <div className="flex items-center gap-2">
                <Icon name="MapLayers" className="size-4 text-[#FACC15]"/>
                <span className="font-oswald uppercase text-[12px] tracking-[0.18em] text-white">Top corridors · live</span>
              </div>
              <span className="font-mono text-[10.5px] uppercase tracking-wider text-white/40">aadt · y/y · 7-day</span>
            </div>
            <div>
              {corridors.map((c, i) => (
                <div key={c.id} className="flex items-center gap-4 px-5 py-3 hover:bg-white/[0.03] transition-colors border-b border-[#1f262f] last:border-b-0">
                  <span className="font-mono text-[10px] text-white/35 w-6">{String(i+1).padStart(2,'0')}</span>
                  <RouteShield num={c.num} kind={c.kind || 'interstate'} size={32}/>
                  <div className="min-w-0 flex-1">
                    <div className="font-oswald uppercase text-[14px] text-white tracking-wide">{c.id}</div>
                    <div className="font-proxima text-[12px] text-white/55 truncate">{c.name}</div>
                  </div>
                  <div className="text-right hidden sm:block">
                    <div className="font-oswald font-semibold text-[17px] text-white tabular-nums">{c.aadt}</div>
                    <div className="font-mono text-[10px] uppercase tracking-wider text-white/35">aadt</div>
                  </div>
                  <div className="w-[110px] hidden md:block">
                    <Spark values={c.spark} w={110} h={28} stroke={c.up ? '#FACC15' : '#FB7185'} fill={c.up ? 'rgba(250,204,21,0.16)' : 'rgba(251,113,133,0.14)'} dot/>
                  </div>
                  <div className={`font-mono text-[12px] font-semibold w-14 text-right tabular-nums ${c.up ? 'text-[#FACC15]' : 'text-[#FB7185]'}`}>{c.delta}%</div>
                </div>
              ))}
            </div>
            <div className="px-5 py-2.5 border-t border-[#2a3545] flex items-center justify-between font-mono text-[10.5px] uppercase tracking-wider">
              <span className="text-white/45">6 of 142 · sample</span>
              <a href="#" className="text-[#FACC15] hover:text-[#FFD744] font-semibold inline-flex items-center gap-1">view all corridors <Icon name="ChevronRight" className="size-3"/></a>
            </div>
          </div>

          {/* event feed — 5 cols */}
          <div className="col-span-12 lg:col-span-5 rounded-xl bg-[#11161e] border border-[#2a3545] overflow-hidden flex flex-col">
            <div className="px-5 py-3 flex items-center justify-between border-b border-[#2a3545]">
              <div className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-[#FACC15] dot-pulse"/>
                <span className="font-oswald uppercase text-[12px] tracking-[0.18em] text-white">Activity stream</span>
              </div>
              <span className="font-mono text-[10.5px] uppercase tracking-wider text-white/40">8 / min</span>
            </div>
            <div className="flex-1 divide-y divide-[#1f262f] scroll-light overflow-y-auto" style={{ maxHeight: 360 }}>
              {events.map((e, i) => (
                <div key={i} className="flex items-start gap-3 px-5 py-3 hover:bg-white/[0.03] transition-colors">
                  <span className="font-mono text-[10.5px] text-white/40 pt-0.5 w-16 flex-shrink-0 tabular-nums">{e.t}</span>
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#FACC15]/15 text-[#FACC15] border border-[#FACC15]/30 flex-shrink-0">{e.tag}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-proxima text-[12.5px] text-white/85 leading-snug">{e.msg}</div>
                    {e.route !== '—' && <div className="font-mono text-[10px] text-white/40 mt-0.5">{e.route}</div>}
                  </div>
                  <span className={`font-mono text-[10.5px] font-semibold flex-shrink-0 ${e.up ? 'text-[#FACC15]' : 'text-[#FB7185]'}`}>{e.delta}</span>
                </div>
              ))}
            </div>
            <div className="px-5 py-2.5 border-t border-[#2a3545] flex items-center justify-between font-mono text-[10.5px] uppercase tracking-wider">
              <span className="text-white/45">buffer · 1.2k events</span>
              <a href="#" className="text-[#FACC15] hover:text-[#FFD744] font-semibold">view stream →</a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   Capabilities — triad of "what TransportNY does"
   ───────────────────────────────────────────────────────────── */
function CapabilitiesSection() {
  const caps = [
    {
      icon: 'Database',
      kicker: 'INGEST',
      title: 'Federal & in-state feeds, merged',
      body: 'FAF5, NPMRDS, HPMS, NYSDOT continuous count stations and 511NY incidents — normalized to a single corridor / segment graph and refreshed on a quarterly schedule.',
      meta: '7 active feeds',
    },
    {
      icon: 'Sections',
      kicker: 'AUTHOR',
      title: 'Pages built from sections, not screens',
      body: 'Spreadsheets, graphs, maps, filters, narrative blocks — composed by NYSDOT staff through a section CMS. No code path required; the same components serve view and edit.',
      meta: '142 pages live',
    },
    {
      icon: 'Download',
      kicker: 'PUBLISH',
      title: 'Open to MPOs and the public',
      body: 'View tables, export views, and link directly to corridor or station detail. NYSDOT credentials unlock authoring and bulk download; the rest is publicly readable.',
      meta: 'MPO + public read',
    },
  ];
  return (
    <section id="data" data-screen-label="04 Capabilities" className="relative py-24 bg-white">
      <div className="relative max-w-[1280px] mx-auto px-8">
        <SectionHeader
          num="// 04"
          kicker="What it does"
          title={<>A platform, not a portal<span className="text-[#CA8A04]">.</span></>}
          sub="TransportNY is the connective layer between NYSDOT's data and the people who plan, fund, and operate the state network. Three responsibilities — ingest, author, publish — running on one chrome."
          meta={<>updated quarterly<br/>v2026.2 · may 8</>}
        />

        <div className="grid grid-cols-3 gap-px bg-zinc-950/10 border border-zinc-950/10 rounded-xl overflow-hidden">
          {caps.map((c, i) => (
            <div key={i} className="bg-white p-7 relative">
              <div className="flex items-center gap-3 mb-5">
                <div className="size-10 rounded-md bg-[#0a0e13] flex items-center justify-center text-[#FACC15]">
                  <Icon name={c.icon} className="size-5"/>
                </div>
                <div>
                  <div className="font-mono text-[10px] text-slate-400 uppercase tracking-wider">step {i+1}</div>
                  <div className="font-oswald uppercase text-[11px] tracking-[0.2em] text-[#CA8A04]">{c.kicker}</div>
                </div>
              </div>
              <h3 className="font-oswald font-semibold text-[22px] leading-tight text-[#0f1722] tracking-tight mb-3">{c.title}</h3>
              <p className="font-proxima text-slate-600 text-[14px] leading-[1.6]">{c.body}</p>
              <div className="mt-6 pt-4 border-t border-zinc-950/10 flex items-center justify-between">
                <span className="font-mono text-[10.5px] uppercase tracking-wider text-slate-500">{c.meta}</span>
                <a href="#" className="text-[#37576B] text-[12.5px] font-medium inline-flex items-center gap-1">read more <Icon name="ChevronRight" className="size-3.5"/></a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   Marquee divider — Oswald banner between sections.
   ───────────────────────────────────────────────────────────── */
function MarqueeDivider() {
  const words = ['DATA', 'PUBLISHED', 'OPERATED BY NEW YORK STATE', 'SINCE 2014', 'NYSDOT'];
  return (
    <div className="relative bg-[#FACC15] border-y border-[#0a0e13]">
      <div className="max-w-[1280px] mx-auto px-8 py-5 flex flex-wrap items-center justify-center gap-x-10 gap-y-2 font-oswald font-semibold uppercase tracking-tight text-[#0a0e13]" style={{ fontSize: 24 }}>
        {words.map((w, i) => (
          <React.Fragment key={i}>
            <span>{w}</span>
            {i < words.length - 1 && <span className="text-[#0a0e13]/40">●</span>}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Changelog — "what's new", government-style.
   ───────────────────────────────────────────────────────────── */
function ChangelogSection() {
  const entries = [
    { date: '2026-05-08', ver: 'v2026.2', tag: 'FREIGHT', kind: 'release', title: 'Q1 2026 FAF5 estimates merged across 142 corridors', body: 'Annual tonnage refreshed; Long Island corridors regrouped under NY-Metro region. Truck-class shares updated to FHWA 13-class scheme.' },
    { date: '2026-04-19', ver: 'v2026.1', tag: 'NPMRDS',  kind: 'release', title: 'Reliability inspector for individual TMC segments', body: 'Click any segment on the map to open hour-of-day distributions and LOTTR percentiles for the trailing 12 months.' },
    { date: '2026-03-27', ver: '—',       tag: 'TSMO',    kind: 'beta',    title: 'Work zones dashboard — public beta', body: 'Live incident counts, queue lengths, and 511NY cross-referenced with NPMRDS reliability for affected segments.' },
    { date: '2026-02-14', ver: 'v2026.0', tag: 'PLATFORM',kind: 'release', title: 'Section CMS — drag-to-reorder, draft mode, audit log', body: 'NYSDOT authors can now stage page revisions, preview them in context, and roll back any section to any prior version.' },
    { date: '2026-01-30', ver: '—',       tag: 'SANDBOX', kind: 'note',    title: 'Open Sandbox prompts for the academic-partner cohort', body: 'Eight Cornell, Rensselaer, and SUNY Buffalo students onboarded; first projects target VMT and crash-data joins.' },
  ];
  const kindColor = k => k === 'release' ? '#37576B' : k === 'beta' ? '#CA8A04' : '#64748B';
  const kindLabel = k => k === 'release' ? 'Release' : k === 'beta' ? 'Beta' : 'Note';
  return (
    <section id="docs" data-screen-label="06 Changelog" className="py-24 bg-[#fafbfc] border-y border-zinc-950/05">
      <div className="max-w-[1280px] mx-auto px-8">
        <SectionHeader
          num="// 06"
          kicker="What&apos;s new"
          title={<>Quarterly releases, openly logged<span className="text-[#CA8A04]">.</span></>}
          sub="Every dataset refresh, schema change, and platform upgrade is recorded here. Subscribe to the RSS feed or follow the GitHub mirror for engineering notes."
          meta={<>5 most recent<br/>see archive →</>}
        />
        <div className="rounded-xl border border-zinc-950/10 bg-white overflow-hidden divide-y divide-zinc-950/05">
          {entries.map((e, i) => (
            <a href="#" key={i} className="cl-row flex items-start gap-5 px-6 py-5 transition-colors">
              <div className="flex-shrink-0 w-[110px] pt-1">
                <div className="font-mono text-[11px] tabular-nums text-[#0f1722]">{e.date}</div>
                <div className="font-mono text-[10px] text-slate-400 mt-0.5">{e.ver}</div>
              </div>
              <div className="flex-shrink-0 w-[88px] pt-1">
                <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border" style={{ color: kindColor(e.kind), borderColor: kindColor(e.kind) + '40' }}>
                  {e.tag}
                </span>
              </div>
              <div className="flex-shrink-0 w-[70px] pt-1">
                <span className="cl-tag font-mono text-[10.5px] uppercase tracking-wider text-slate-500">{kindLabel(e.kind)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-oswald font-medium text-[18px] text-[#0f1722] leading-snug tracking-tight">{e.title}</h3>
                <p className="font-proxima text-slate-600 text-[13.5px] leading-[1.55] mt-1.5 max-w-[760px]">{e.body}</p>
              </div>
              <Icon name="ChevronRight" className="size-4 text-slate-400 mt-2 flex-shrink-0"/>
            </a>
          ))}
        </div>
        <div className="flex items-center justify-between mt-6 font-mono text-[11px] uppercase tracking-wider">
          <a href="#" className="text-[#37576B] hover:text-[#1f3450] font-semibold inline-flex items-center gap-1">full archive (164 entries) <Icon name="ChevronRight" className="size-3"/></a>
          <div className="flex items-center gap-3 text-slate-500">
            <a href="#" className="hover:text-[#37576B]">RSS</a>
            <span>·</span>
            <a href="#" className="hover:text-[#37576B]">JSON feed</a>
            <span>·</span>
            <a href="#" className="hover:text-[#37576B]">GitHub mirror</a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   About / AVAIL credit
   ───────────────────────────────────────────────────────────── */
function AboutSection() {
  return (
    <section id="about" data-screen-label="07 About" className="py-24 bg-white">
      <div className="max-w-[1280px] mx-auto px-8 grid grid-cols-12 gap-10">
        <div className="col-span-12 lg:col-span-5">
          <SectionHeader
            num="// 07"
            kicker="About"
            title={<>Built and operated by AVAIL<span className="text-[#CA8A04]">.</span></>}
            sub="The Albany Visualization & Informatics Lab (AVAIL) at UAlbany builds TransportNY under contract with NYSDOT. The platform has run continuously since 2014."
          />
          <div className="flex flex-wrap gap-2 mb-6">
            {['NYSDOT', 'AVAIL', 'UAlbany', 'FHWA', 'I-95 Corridor Coalition', 'TRB'].map(t => (
              <span key={t} className="font-mono text-[10.5px] uppercase tracking-wider px-2.5 py-1 rounded border border-zinc-950/10 text-slate-600 bg-white">{t}</span>
            ))}
          </div>
          <a href="#" className="inline-flex items-center gap-2 h-11 px-5 rounded-md bg-[#37576B] hover:bg-[#1f3450] text-white font-proxima font-bold text-[12px] uppercase tracking-[0.12em] border-b-4 border-[#1f3450] tny-press">
            Contact the team <Icon name="ChevronRight" className="size-4"/>
          </a>
        </div>
        <div className="col-span-12 lg:col-span-7">
          <div className="grid grid-cols-2 gap-3">
            {[
              { k: 'Years operating',  v: '12',   sub: 'since 2014' },
              { k: 'Datasets ingested', v: '7',    sub: 'federal + state' },
              { k: 'Authoring users',  v: '184',  sub: 'NYSDOT · MPO' },
              { k: 'Pages published',  v: '142',  sub: 'CMS · all sites' },
            ].map((s, i) => (
              <div key={i} className="rounded-lg border border-zinc-950/10 bg-[#fafbfc] p-5 flex items-end justify-between">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">{s.k}</div>
                  <div className="font-oswald font-semibold text-[44px] leading-none tabular-nums text-[#0f1722] mt-2">{s.v}</div>
                  <div className="font-mono text-[10.5px] uppercase tracking-wider text-slate-500 mt-2">{s.sub}</div>
                </div>
                <span className="size-2 rounded-full bg-[#CA8A04]"/>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-zinc-950/10 bg-[#0a0e13] text-white p-6 flex items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <img src="../assets/nys_logo_white.svg" alt="NYS" className="h-12 w-auto opacity-95 flex-shrink-0"/>
              <div className="h-12 w-px bg-white/20 flex-shrink-0"/>
              <div>
                <div className="font-oswald uppercase text-[11px] tracking-[0.2em] text-[#FACC15] mb-1">In partnership</div>
                <div className="font-oswald font-semibold text-[20px] leading-tight tracking-tight">NYSDOT · AVAIL @ UAlbany.</div>
                <p className="font-proxima text-white/65 text-[13px] leading-snug mt-1">Hosting and authoring credentials are issued by NYSDOT. The platform code is maintained by AVAIL at the University at Albany.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   Products grid (4 sites)
   ───────────────────────────────────────────────────────────── */
function ProductsSection() {
  const products = [
    {
      id: 'npmrds', kind: 'npmrds', name: 'NPMRDS', accent: '#37576B', status: 'live',
      kicker: 'PROBE VEHICLE DATA',
      blurb: 'National Performance Management Research Data Set — travel times, planning time, LOTTR percentiles on the NHS.',
      count: '0.84',     countLabel: 'LOTTR p80 · 2024',
    },
    {
      id: 'freightatlas', kind: 'freightatlas', name: 'Freight Atlas', accent: '#CA8A04', status: 'live',
      kicker: 'FREIGHT MOVEMENT',
      blurb: 'Annual tonnage and truck flows across 142 corridors. FAF5 + NPMRDS + NYSDOT count stations.',
      count: '248.7M',   countLabel: 'tons / year · CY 2024',
    },
    {
      id: 'tsmo', kind: 'tsmo', name: 'TSMO', accent: '#37576B', status: 'beta',
      kicker: 'OPERATIONS',
      blurb: 'Transportation Systems Management & Operations — work zones, incidents, queue lengths against reliability.',
      count: '3,184',    countLabel: 'events · last 30 days',
    },
    {
      id: 'sandbox', kind: 'sandbox', name: 'Sandbox', accent: '#CA8A04', status: 'beta',
      kicker: 'EXPERIMENTAL',
      blurb: 'Internal experimentation surface for new sections, joins, and prototypes from the AVAIL team and partners.',
      count: '24',       countLabel: 'active prototypes',
    },
  ];
  return (
    <section id="products" data-screen-label="02 Products" className="relative py-24 bg-white">
      <div className="max-w-[1280px] mx-auto px-8">
        <SectionHeader
          num="// 02"
          kicker="The product family"
          title={<>Four data products, one chrome<span className="text-[#CA8A04]">.</span></>}
          sub="Each TransportNY site is an independent data product with its own audience, datasets, and editor. They share a single navigation chrome, type system, and CMS — so a planner moves between freight, reliability, and operations without re-learning the surface."
          meta={<>2 live · 2 beta<br/>v2026.2</>}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {products.map(p => <ProductCard key={p.id} {...p}/>)}
        </div>

        {/* footnote chip-row */}
        <div className="mt-10 pt-6 border-t border-zinc-950/10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.16em] text-slate-500">
            <Icon name="History" className="size-4 text-slate-400"/>
            <span>archive · npmrds 1.0 (2014–2019) · macro (2020–2023)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <a href="#" className="font-proxima text-[12px] text-[#37576B] underline underline-offset-2">Compare products</a>
            <span className="text-slate-300">·</span>
            <a href="#" className="font-proxima text-[12px] text-[#37576B] underline underline-offset-2">Request access</a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   Footer
   ───────────────────────────────────────────────────────────── */
function Footer() {
  const cols = [
    { h: 'Products',    items: ['NPMRDS', 'Freight Atlas', 'TSMO', 'Sandbox'] },
    { h: 'Data',        items: ['Sources', 'Methodology', 'Schema', 'Downloads'] },
    { h: 'Authoring',   items: ['CMS guide', 'Section reference', 'API tokens', 'Status'] },
    { h: 'Institution', items: ['AVAIL @ UAlbany', 'NYSDOT', 'Contact', 'Accessibility'] },
  ];
  return (
    <footer className="bg-[#0a0e13] text-white pt-20 pb-10 relative overflow-hidden">
      <div className="absolute inset-0 grid-dark pointer-events-none"/>
      <div className="relative max-w-[1280px] mx-auto px-8">
        <div className="grid grid-cols-12 gap-8 pb-12 border-b border-[#2a3545]">
          <div className="col-span-12 lg:col-span-5">
            <div className="flex items-center gap-3 mb-5">
              <img src="../assets/nys_logo_white.svg" alt="NYS" className="h-10 w-auto"/>
              <div className="h-10 w-px bg-white/20"/>
              <div>
                <div className="font-oswald uppercase text-white text-[24px] tracking-wide font-semibold leading-none">TransportNY</div>
                <div className="font-mono text-[10.5px] uppercase tracking-wider text-white/50 mt-1.5">nysdot · avail @ ualbany</div>
              </div>
            </div>
            <p className="font-proxima text-white/55 text-[13.5px] leading-[1.6] max-w-[400px]">
              Transportation data products for New York State. Operating continuously since 2014, with quarterly refreshes and an open public read tier.
            </p>
            <div className="mt-6 flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-emerald-400 dot-pulse"/>
              <span className="font-mono text-[10.5px] uppercase tracking-wider text-white/60">all systems normal · status.transportny.org</span>
            </div>
          </div>
          {cols.map(c => (
            <div key={c.h} className="col-span-6 lg:col-span-2">
              <div className="font-oswald uppercase text-[11px] tracking-[0.2em] text-[#FACC15] mb-4">{c.h}</div>
              <ul className="space-y-2.5">
                {c.items.map(it => (
                  <li key={it}>
                    <a href="#" className="font-proxima text-[13px] text-white/65 hover:text-white transition-colors">{it}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="pt-8 flex flex-wrap items-center justify-between gap-4 font-mono text-[10.5px] uppercase tracking-wider text-white/40">
          <div className="flex items-center gap-4">
            <span>© 2014–2026 New York State Department of Transportation</span>
            <span>·</span>
            <a href="#" className="hover:text-white/80">terms</a>
            <a href="#" className="hover:text-white/80">privacy</a>
            <a href="#" className="hover:text-white/80">accessibility</a>
          </div>
          <div className="flex items-center gap-3">
            <span>v2026.2</span>
            <span>·</span>
            <span>built {new Date().getFullYear()}-05-08</span>
            <span>·</span>
            <span className="text-[#FACC15]/80">↑ to top</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ─────────────────────────────────────────────────────────────
   App
   ───────────────────────────────────────────────────────────── */
function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  return (
    <div className="bg-white">
      <TopNav/>
      <Hero tweaks={t}/>
      <ProductsSection/>
      {t.showPulse && <PulseSection/>}
      <CapabilitiesSection/>
      {t.showChangelog && <ChangelogSection/>}
      <AboutSection/>
      <Footer/>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Sections"/>
        <TweakToggle label="Pulse band" value={t.showPulse} onChange={v => setTweak('showPulse', v)}/>
        <TweakToggle label="Changelog" value={t.showChangelog} onChange={v => setTweak('showChangelog', v)}/>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
