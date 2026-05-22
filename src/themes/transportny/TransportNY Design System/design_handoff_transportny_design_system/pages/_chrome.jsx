/* eslint-disable */
// TransportNY shared chrome — sidebar + page headers + breadcrumbs + cards
// Provides: window.TNYSidebar, window.TNYHero (legacy), window.TNYPageHeader,
//           window.TNYBreadcrumb, window.TNYFilterBar, window.TNYTopBlue,
//           window.TNYPillBar, window.TNYFooter, window.TNYCard
const { useState } = React;

function NavItem({ icon, label, active, expanded, onClick, badge, indent }) {
  const Icon = window.TNYIcon;
  return (
    <a href={onClick || '#'} onClick={e=>{ if(!onClick) e.preventDefault(); }}
      className={`relative w-full flex items-center transition-colors
        ${active ? 'bg-[#1e2530] text-white tny-active-bar' : 'border-l-[3px] border-transparent text-slate-300 hover:text-white hover:bg-[#1e2530]'}
        ${expanded ? `justify-start ${indent?'pl-9':'pl-4'} pr-3 py-2 gap-3` : 'justify-center py-2.5'}`}>
      {icon && <Icon name={icon} className={`flex-shrink-0 ${expanded?'size-[18px]':'size-5'} ${active?'text-yellow-400':'text-slate-400'}`}/>}
      {expanded && <span className="font-proxima text-[13.5px] flex-1 text-left">{label}</span>}
      {expanded && badge && <span className="text-[10px] font-mono text-yellow-400/90 bg-yellow-400/10 px-1.5 py-0.5 rounded">{badge}</span>}
    </a>
  );
}

function TNYSidebar({ product='NPMRDS', active='home', expanded=true, nav, showSearch=true, showSubsection, subsection, user }) {
  const Icon = window.TNYIcon;
  // user: undefined → default Alex Muro avatar (signed-in demo)
  //       null      → signed-out state, shows Sign in pill
  //       object    → custom { initials, name, role }
  const u = user === undefined ? { initials:'AM', name:'Alex Muro', role:null } : user;
  const items = nav || [
    { id:'home', label:'Home', icon:'Pages' },
    { id:'routes', label:'Routes', icon:'MapLayers' },
    { id:'reports', label:'Reports', icon:'Sections' },
    { id:'macro', label:'Macro', icon:'MapPin' },
    { id:'pm3', label:'PM3', icon:'Activity' },
    { id:'batch', label:'Batch Report', icon:'Database' },
    { id:'schedules', label:'Schedules', icon:'History' },
  ];
  return (
    <aside data-screen-label="Sidebar" className={`fixed inset-y-0 left-0 z-30 bg-[#12181F] flex flex-col border-r border-[#2a3545] transition-all ${expanded?'w-60':'w-16'}`}>
      {/* logo block */}
      <div className="relative h-16 bg-[#0a0e13] border-b border-[#2a3545] flex items-center px-3">
        <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
          <img src="../assets/nys_logo_white.svg" alt="NYS" className="w-9 h-9 object-contain"/>
        </div>
        {expanded && (
          <div className="flex-1 flex items-center gap-2 ml-3 min-w-0">
            <span className="font-oswald uppercase text-white text-[15px] tracking-wide truncate flex-1">{product}</span>
            <Icon name="CaretDown" className="size-4 text-slate-400"/>
          </div>
        )}
        {expanded && (
          <button className="w-7 h-7 rounded-md hover:bg-[#2a3545] text-slate-400 hover:text-white flex items-center justify-center" title="Collapse">
            <Icon name="ChevronLeft" className="size-3.5"/>
          </button>
        )}
      </div>

      {/* search */}
      {expanded && showSearch && (
        <div className="px-3 pt-3">
          <button className="w-full h-9 px-3 rounded-full bg-[#1a2029] border border-[#2a3545] hover:border-[#3a4555] flex items-center gap-2 text-slate-400 hover:text-slate-300">
            <Icon name="Search" className="size-4"/>
            <span className="font-proxima text-[13px] flex-1 text-left">Search</span>
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto py-2">
        {items.map(n => (
          <React.Fragment key={n.id}>
            <NavItem {...n} active={active===n.id} expanded={expanded}/>
            {showSubsection && active===n.id && subsection && (
              <div className="bg-[#0d1117]">
                {subsection.map(s => (
                  <NavItem key={s.id} {...s} expanded={expanded} indent active={active+':'+s.id===(window.TNY_SUB||'')}/>
                ))}
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      <div className="border-t border-[#2a3545] py-2">
        <NavItem icon="Pages" label="Docs" expanded={expanded}/>
        <NavItem icon="Database" label="Data Sources" expanded={expanded}/>
        <div className={`mt-2 pt-2 border-t border-[#2a3545] ${expanded?'px-4':'px-0'}`}>
          {u ? (
            <div className={`flex items-center ${expanded?'gap-3':'justify-center'}`}>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#37576B] to-[#1f3450] flex items-center justify-center text-white text-[11px] font-medium flex-shrink-0 ring-1 ring-yellow-400/20">{u.initials}</div>
              {expanded && (<div className="flex-1 min-w-0 flex items-center justify-between gap-1">
                <div>
                  <div className="text-white text-[12px] font-oswald uppercase tracking-wide truncate">{u.name}</div>
                  {u.role && <div className="text-slate-400 text-[10px] font-mono uppercase tracking-wider truncate">{u.role}</div>}
                </div>
                <Icon name="CaretDown" className="size-3.5 text-slate-400"/>
              </div>)}
            </div>
          ) : (
            <a href="login.html" className={`flex items-center ${expanded?'gap-3':'justify-center'} hover:bg-[#1e2530] -mx-1 px-1 py-1 rounded transition-colors`}>
              <div className="w-8 h-8 rounded-full bg-[#1a2029] border border-[#2a3545] flex items-center justify-center text-slate-500 flex-shrink-0">
                <Icon name="User" className="size-4"/>
              </div>
              {expanded && (
                <div className="flex-1 min-w-0">
                  <div className="text-white text-[12px] font-oswald uppercase tracking-wide truncate">Sign in</div>
                  <div className="text-slate-500 text-[10px] font-mono uppercase tracking-wider truncate">Public-read access</div>
                </div>
              )}
            </a>
          )}
        </div>
      </div>
    </aside>
  );
}

/* Page hero — light topo background with title + subtitle + optional actions */
function TNYHero({ title, subtitle, desc, actions, height=260 }) {
  return (
    <div data-screen-label="Hero" className="relative tny-hero-topo border-b border-zinc-950/10" style={{minHeight:height}}>
      <div className="px-10 pt-10 pb-8 flex items-start justify-between gap-8">
        <div className="max-w-2xl">
          <h1 className="font-oswald font-semibold text-[44px] leading-[1.05] tracking-tight text-[#0F1722]">{title}</h1>
          {subtitle && <div className="font-oswald font-medium text-[22px] text-[#0F1722] mt-1">{subtitle}</div>}
          {desc && <p className="font-proxima text-[14px] text-slate-600 leading-relaxed mt-4 max-w-xl">{desc}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 pt-2">{actions}</div>}
      </div>
    </div>
  );
}

/* ─── TNYBreadcrumb ──────────────────────────────────────────────
   Reusable breadcrumb. items: [{ label, href? }]. Last item is shown
   as the current page (non-link). Renders independently of TNYPageHeader
   so it can be used on its own or composed in. */
function TNYBreadcrumb({ items = [], className = '' }) {
  const Icon = window.TNYIcon;
  return (
    <nav className={`flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-[0.16em] ${className}`} aria-label="Breadcrumb">
      {items.map((it, i) => {
        const isLast = i === items.length - 1;
        return (
          <React.Fragment key={i}>
            {i > 0 && <span className="text-slate-300 px-1">/</span>}
            {it.href && !isLast
              ? <a href={it.href} className="text-slate-500 hover:text-[#0f1722] transition-colors">{it.label}</a>
              : <span className={isLast ? 'text-[#0f1722]' : 'text-slate-500'} aria-current={isLast ? 'page' : undefined}>{it.label}</span>}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

/* ─── TNYPageHeader ──────────────────────────────────────────────
   Canonical page-top header. Lives at the top of every product/DS page.

   Composes from grid-system tokens (container=data 1480 + px-8). Tone
   varies the visual weight but the surface area is uniform.

   Tones:
     • data       — compact, white, kicker + actions + refresh meta. Default.
     • hero       — taller, topo background, bigger title. For DS/catalog tops.
     • editorial  — white, amber underline below title (printable-document feel).

   Props: tone, kicker, meta, title, accent ('.', '!'…), desc, actions,
          refresh, breadcrumb [{label, href?}]. */
function TNYPageHeader({ tone = 'data', kicker, meta, title, accent = '.', desc, actions, refresh, breadcrumb }) {
  const isHero = tone === 'hero';
  const isEditorial = tone === 'editorial';
  const wrapper = isHero
    ? 'border-b border-zinc-950/10 tny-hero-topo'
    : 'border-b border-zinc-950/05 bg-white';
  const inner = isHero ? 'py-14' : isEditorial ? 'py-12' : 'py-10';

  // accent: if title is a string, colour its trailing accent char
  let titleNode = title;
  if (typeof title === 'string' && accent) {
    const ends = title.endsWith(accent);
    const main = ends ? title.slice(0, -accent.length) : title;
    titleNode = <>{main}<span className="text-[#CA8A04]">{accent}</span></>;
  }

  const titleCls = isHero
    ? 'font-oswald font-semibold text-[#0f1722] text-[52px] leading-[1.02] tracking-tight'
    : isEditorial
      ? 'font-oswald font-semibold text-[#0f1722] text-[40px] leading-[1.05] tracking-wide uppercase inline-block border-b-[3px] border-[#CA8A04] pb-2'
      : 'font-oswald font-semibold text-[#0f1722] text-[38px] leading-[1.05] tracking-tight uppercase';

  return (
    <section data-section data-screen-label="Page header" className={wrapper}>
      <div className={`mx-auto max-w-[1480px] px-8 ${inner}`}>
        {breadcrumb && <div className="mb-4"><TNYBreadcrumb items={breadcrumb}/></div>}
        {(kicker || meta) && (
          <div className="flex items-center gap-3 mb-2">
            {kicker && <span className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-[#CA8A04]">{kicker}</span>}
            {kicker && meta && <span className="h-px w-10 bg-[#CA8A04]/50"/>}
            {meta && <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-slate-500">{meta}</span>}
          </div>
        )}
        <div className={`flex ${isHero ? 'flex-col gap-5' : 'items-end justify-between gap-8'}`}>
          <div className={isHero ? 'max-w-[800px]' : 'max-w-[760px]'}>
            <h1 className={titleCls}>{titleNode}</h1>
            {desc && <p className="font-proxima text-slate-600 text-[14.5px] leading-[1.6] mt-3 max-w-[680px]">{desc}</p>}
          </div>
          {(actions || refresh) && (
            <div className={`flex ${isHero ? 'items-center' : 'flex-col items-end'} gap-2 flex-shrink-0`}>
              {actions && <div className="flex items-center gap-2">{actions}</div>}
              {refresh && (
                <div className="font-mono text-[10.5px] uppercase tracking-wider text-slate-500 flex items-center gap-2">
                  <span>last refresh</span><span className="text-[#0f1722]">{refresh}</span>
                  <span className="text-slate-300">·</span>
                  <span className="text-emerald-700 inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-emerald-500"/>data current</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* Saturated blue filter bar — Region / Month / Road Class */
function TNYFilterBar({ items, right }) {
  const Icon = window.TNYIcon;
  return (
    <div className="tny-bluebar h-12 flex items-center px-10 gap-8 text-white border-b border-black/10">
      {items.map((it,i) => (
        <div key={i} className="flex items-center gap-2 font-proxima text-[13px]">
          <span className="text-white/70">{it.label}:</span>
          <button className="flex items-center gap-1.5 font-semibold">
            {it.value} <Icon name="CaretDown" className="size-3.5 text-white/70"/>
          </button>
        </div>
      ))}
      <div className="flex-1"/>
      {right}
    </div>
  );
}

/* Top blue toolbar (Templates / Routes / Chart Colors / Add Chart) */
function TNYTopBlue({ left, right }) {
  return (
    <div className="tny-bluebar text-white">
      <div className="h-12 flex items-center px-8 gap-8 border-b border-white/10">
        {left}
        <div className="flex-1"/>
        {right}
      </div>
    </div>
  );
}

/* Sub-strip with route pills */
function TNYPillBar({ pills }) {
  const Icon = window.TNYIcon;
  return (
    <div className="tny-bluebar-dark h-14 flex items-center px-8 gap-2 overflow-x-auto border-b border-black/20">
      {pills.map((p,i) => (
        <div key={i} className="h-8 px-3 pr-2 rounded-full bg-white text-slate-700 flex items-center gap-2 font-proxima text-[12.5px] whitespace-nowrap shadow-sm">
          <span className="size-2 rounded-full" style={{background:p.color}}/>
          <span className="font-medium">{p.label}</span>
          <Icon name="CaretDown" className="size-3 text-slate-500"/>
        </div>
      ))}
    </div>
  );
}

function TNYFooter() {
  return (
    <footer className="mt-10 px-8 py-4 border-t border-zinc-950/10 flex items-center justify-between text-[13px]">
      <div className="flex gap-6">
        <a className="tny-link">User Guide</a>
        <a className="tny-link">API Guide</a>
        <a className="tny-link">Data Dictionary</a>
        <a className="tny-link">What's New</a>
      </div>
      <span className="text-slate-500 font-mono text-[11px]">© NYSDOT</span>
    </footer>
  );
}

/* Section card title bar */
function TNYCard({ title, drag, displayMenu, children, right }) {
  const Icon = window.TNYIcon;
  return (
    <div className="rounded-[8px] border border-zinc-950/10 bg-white shadow-sm overflow-hidden">
      <div className="h-11 px-3 flex items-center gap-2 border-b border-zinc-950/10 bg-slate-50/60">
        {drag !== false && <Icon name="Drag" className="size-3.5 text-slate-400 cursor-grab"/>}
        <span className="font-oswald font-medium text-[14px] text-[#2D3E4C] flex-1">{title}</span>
        {right}
        {displayMenu !== false && (
          <button className="h-7 px-2.5 flex items-center gap-1.5 rounded border border-zinc-950/10 hover:bg-slate-50 text-slate-700 text-[12px] font-proxima">
            Display <Icon name="CaretDown" className="size-3 text-slate-500"/>
          </button>
        )}
        <button className="h-7 w-7 flex items-center justify-center rounded hover:bg-slate-50 text-slate-500"><Icon name="More" className="size-3.5"/></button>
      </div>
      {children}
    </div>
  );
}

Object.assign(window, { TNYSidebar, TNYHero, TNYPageHeader, TNYBreadcrumb, TNYFilterBar, TNYTopBlue, TNYPillBar, TNYFooter, TNYCard });
