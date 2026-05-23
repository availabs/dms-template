/* eslint-disable */
// TransportNY card system — single-column composition.
//
// ─── Composition rule ────────────────────────────────────────
// Every section of a card lives on its own row, full-width. No section
// splits horizontally into two columns. The trend sparkline always
// takes the full width of the card. Holds even when cards shrink to
// ~150 px in narrow grids.
//
// One deliberate exception: MetricCard is horizontal by design
// (icon + content + delta). Use it knowingly when the row format IS
// the point — a list of metrics on a settings panel, etc.
//
// ─── Atomic primitives (compose your own) ────────────────────
//   Card           shell (tone: light | tint | dark)
//   CardStatus     meets/below/attention/no-data pill (own row)
//   CardKicker     Oswald uppercase eyebrow (use sparingly)
//   CardTitle      Oswald medium 15px label
//   CardScore      auto-sizing big tabular number + optional unit
//   CardMeta       mono caps helper line (e.g. "Target 80%")
//   CardDelta      ↑ / ↓ delta with sign-aware colour
//   CardHint       Proxima 12.5px slate-600 helper text
//   CardTrend      full-width sparkline (preserveAspectRatio=none)
//   CardTargetBar  value-vs-target bar with target marker
//
// ─── Composed cards (90% of cases) ───────────────────────────
//   KpiCard            status → title → score → meta → trend
//   KpiCardCompliance  KpiCard + target bar (federal reporting)
//   StatTile           compact dashboard tile
//   MetricCard         horizontal icon-led row (the exception)
//
// All exported via window.* so any page can use them.

/* ─── Primitives ────────────────────────────────────────────── */

function Card({ tone='light', interactive=false, className='', children, ...rest }) {
  const toneCls = tone === 'dark'
    ? 'bg-[#0a0e13] text-white border-[#2a3545]'
    : tone === 'tint'
      ? 'bg-[#fafbfc] border-zinc-950/08'
      : 'bg-white border-zinc-950/08';
  const interCls = interactive
    ? 'transition-all hover:shadow-lg hover:-translate-y-0.5 cursor-pointer'
    : '';
  return (
    <div className={`rounded-lg border ${toneCls} ${interCls} ${className}`} {...rest}>
      {children}
    </div>
  );
}

function CardKicker({ children, color='slate' }) {
  const colorCls = color === 'ochre' ? 'text-[#CA8A04]' : color === 'inherit' ? '' : 'text-slate-500';
  return (
    <div className={`font-oswald uppercase text-[10.5px] tracking-[0.18em] ${colorCls}`}>
      {children}
    </div>
  );
}

function CardTitle({ children }) {
  return (
    <div className="font-oswald font-medium text-[15px] text-[#0f1722] leading-tight">
      {children}
    </div>
  );
}

function CardMeta({ children }) {
  return (
    <div className="font-mono text-[10.5px] uppercase tracking-wider text-slate-500">
      {children}
    </div>
  );
}

function CardHint({ children }) {
  return (
    <div className="font-proxima text-[12.5px] text-slate-600 leading-snug">
      {children}
    </div>
  );
}

function CardStatus({ kind='good', label, compact=false }) {
  const map = {
    good:    { dot:'bg-emerald-500', text:'text-emerald-700', border:'border-emerald-300', bg:'bg-emerald-50', defaultLabel:'meets target' },
    bad:     { dot:'bg-red-500',     text:'text-red-700',     border:'border-red-300',     bg:'bg-red-50',     defaultLabel:'below target' },
    warn:    { dot:'bg-amber-500',   text:'text-amber-700',   border:'border-amber-300',   bg:'bg-amber-50',   defaultLabel:'attention' },
    neutral: { dot:'bg-slate-400',   text:'text-slate-600',   border:'border-slate-300',   bg:'bg-slate-50',   defaultLabel:'no data' },
  };
  const c = map[kind] || map.neutral;
  if (compact) return <span className={`size-2 rounded-full ${c.dot}`} title={label || c.defaultLabel}/>;
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border self-start ${c.text} ${c.border} ${c.bg}`}>
      <span className={`size-1.5 rounded-full ${c.dot}`}/>
      {label || c.defaultLabel}
    </span>
  );
}

// Auto-fitting tabular number with the unit stacked below as a quiet
// meta label. The number renders as SVG with a generous viewBox; the
// SVG element is width:100% capped at the natural size, so at standard
// widths it sits at its design size and at narrow widths it shrinks
// uniformly to fit. No overflow is possible — the SVG cannot exceed
// its container width.
function CardScore({ value, unit, size='auto', color='#0f1722' }) {
  const str = String(value);
  const len = str.length;
  let fontPx;
  if (size === 'auto') {
    fontPx = len <=  4 ? 56
           : len <=  6 ? 44
           : len <=  8 ? 36
           : len <= 10 ? 28
           : 22;
  } else {
    fontPx = { sm: 22, md: 32, lg: 44, xl: 56 }[size] || 32;
  }
  // Generous viewBox so glyphs never get clipped by the box itself.
  // preserveAspectRatio="xMinYMid meet" + width="100%" + max-width cap
  // means: wide container → text at natural size, narrow container →
  // both width and height of rendered text shrink uniformly.
  const naturalW = Math.ceil(len * 0.6 * fontPx);
  const naturalH = Math.round(fontPx * 1.1);
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <svg
        width="100%"
        viewBox={`0 0 ${naturalW} ${naturalH}`}
        style={{ maxWidth: naturalW + 'px', display: 'block', height: 'auto' }}
        preserveAspectRatio="xMinYMid meet">
        <text
          x="0"
          y={Math.round(fontPx * 0.95)}
          fontFamily="Oswald, sans-serif"
          fontWeight="600"
          fontSize={fontPx}
          fill={color}
          style={{ fontVariantNumeric: 'tabular-nums' }}>
          {value}
        </text>
      </svg>
      {unit && (
        <div className="font-mono text-[10.5px] uppercase tracking-wider text-slate-500">{unit}</div>
      )}
    </div>
  );
}

function CardDelta({ value, kind='auto', icon=true }) {
  let actual = kind;
  if (kind === 'auto') {
    const str = String(value);
    actual = str.startsWith('-') ? 'bad'
           : str.startsWith('+') || parseFloat(str) > 0 ? 'good'
           : 'neutral';
  }
  const cls = actual === 'good' ? 'text-emerald-700'
            : actual === 'bad'  ? 'text-red-700'
            : 'text-slate-500';
  const arrow = actual === 'good' ? '↑' : actual === 'bad' ? '↓' : '·';
  return (
    <div className={`inline-flex items-center gap-1 font-mono text-[11.5px] font-medium ${cls}`}>
      {icon && <span>{arrow}</span>}
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

// Full-width sparkline. Always 100% of its container — never sized
// inline. preserveAspectRatio=none stretches the path horizontally;
// vector-effect=non-scaling-stroke keeps the line crisp.
function CardTrend({ values, stroke='#37576B', fill, height=32 }) {
  if (!values || !values.length) return null;
  const max = Math.max(...values), min = Math.min(...values);
  const W = 200, H = height;
  const dx = W / (values.length - 1);
  const y = v => H - 2 - ((v - min) / (max - min || 1)) * (H - 4);
  let line = `M 0 ${y(values[0])}`;
  let area = `M 0 ${H} L 0 ${y(values[0])}`;
  values.forEach((v, i) => {
    if (i) {
      line += ` L ${i * dx} ${y(v)}`;
      area += ` L ${i * dx} ${y(v)}`;
    }
  });
  area += ` L ${W} ${H} Z`;
  const fillC = fill || `${stroke}22`;
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block">
      <path d={area} fill={fillC}/>
      <path d={line} fill="none" stroke={stroke} strokeWidth="1.5" vectorEffect="non-scaling-stroke"/>
    </svg>
  );
}

function CardTargetBar({ value, target, max=100, good=true }) {
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

/* ─── Composed cards ────────────────────────────────────────── */

// KpiCard — the default. Use this 80% of the time.
// Order (each on its own row): kicker → status → title → score → target → delta → hint → trend
function KpiCard({ kicker, status, title, value, unit, target, delta, deltaKind, trend, trendStroke, hint, size='auto' }) {
  return (
    <Card className="p-5 flex flex-col gap-3 h-full">
      {kicker && <CardKicker>{kicker}</CardKicker>}
      {status && status !== 'none' && <CardStatus kind={status}/>}
      {title && <CardTitle>{title}</CardTitle>}
      <CardScore value={value} unit={unit} size={size}/>
      {target !== undefined && (
        <CardMeta>target <span className="text-[#0f1722] font-medium normal-case tracking-normal font-proxima">{target}</span></CardMeta>
      )}
      {delta !== undefined && <CardDelta value={delta} kind={deltaKind || 'auto'}/>}
      {hint && <CardHint>{hint}</CardHint>}
      {trend && (
        <div className="mt-auto pt-3 border-t border-zinc-950/05">
          <CardTrend values={trend} stroke={trendStroke || '#37576B'}/>
        </div>
      )}
    </Card>
  );
}

// KpiCardCompliance — adds the prominent target bar. Use when target-vs-actual
// IS the story (MAP-21 PM3, SLA dashboards, agency-set goals).
function KpiCardCompliance({ kicker, status, title, value, unit, target, delta, deltaKind, trend, trendStroke, hint, size='auto', lowerIsBetter, max }) {
  const _val = parseFloat(String(value).replace(/[^0-9.\-]/g, ''));
  const _max = max || (lowerIsBetter ? Math.max(_val || 0, target || 0) * 1.3 : 100);
  return (
    <Card className="p-5 flex flex-col gap-3 h-full">
      {kicker && <CardKicker>{kicker}</CardKicker>}
      {status && <CardStatus kind={status}/>}
      {title && <CardTitle>{title}</CardTitle>}
      <CardScore value={value} unit={unit} size={size}/>
      {target !== undefined && (
        <CardMeta>target <span className="text-[#0f1722] font-medium normal-case tracking-normal font-proxima">{target}</span></CardMeta>
      )}
      {target !== undefined && !isNaN(_val) && (
        <CardTargetBar value={_val} target={target} max={_max} good={!lowerIsBetter}/>
      )}
      {delta !== undefined && <CardDelta value={delta} kind={deltaKind || 'auto'}/>}
      {hint && <CardHint>{hint}</CardHint>}
      {trend && (
        <div className="mt-auto pt-3 border-t border-zinc-950/05">
          <CardTrend values={trend} stroke={trendStroke || '#37576B'}/>
        </div>
      )}
    </Card>
  );
}

// StatTile — for dashboard tile-strips (Network status, etc).
// Status is pinned to the top-right corner so it doesn't share row space.
function StatTile({ kicker, value, unit, trend, trendStroke, sub, status }) {
  const dot = { good:'bg-emerald-500', bad:'bg-red-500', warn:'bg-amber-500', neutral:'bg-slate-400' };
  return (
    <Card className="p-4 flex flex-col gap-2 h-full relative">
      {status && <span className={`absolute top-3 right-3 size-2 rounded-full ${dot[status] || 'bg-slate-400'}`}/>}
      {kicker && <CardKicker>{kicker}</CardKicker>}
      <CardScore value={value} unit={unit} size="md"/>
      {sub && <CardMeta>{sub}</CardMeta>}
      {trend && (
        <div className="mt-auto pt-2">
          <CardTrend values={trend} stroke={trendStroke || '#37576B'} height={20}/>
        </div>
      )}
    </Card>
  );
}

// MetricCard — horizontal icon-led row. The ONE deliberate exception to
// the single-column rule. Use when a row format is the point (settings
// panels, inline metric lists). Don't reach for it as a default KPI.
function MetricCard({ icon, kicker, value, unit, delta, deltaKind, sub }) {
  const Icon = window.TNYIcon;
  return (
    <Card className="p-4 flex items-center gap-4">
      {icon && (
        <div className="size-11 rounded bg-[#0a0e13] flex items-center justify-center text-[#FACC15] flex-shrink-0">
          <Icon name={icon} className="size-5"/>
        </div>
      )}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        {kicker && <CardKicker>{kicker}</CardKicker>}
        <CardScore value={value} unit={unit} size="md"/>
        {sub && <CardMeta>{sub}</CardMeta>}
      </div>
      {delta !== undefined && <CardDelta value={delta} kind={deltaKind || 'auto'}/>}
    </Card>
  );
}

Object.assign(window, {
  Card, CardKicker, CardTitle, CardMeta, CardHint, CardStatus,
  CardScore, CardDelta, CardTrend, CardTargetBar,
  KpiCard, KpiCardCompliance, StatTile, MetricCard,
});
