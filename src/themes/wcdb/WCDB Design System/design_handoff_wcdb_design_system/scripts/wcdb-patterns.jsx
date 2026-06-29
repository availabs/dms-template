// WCDB pattern building blocks — reusable across mockup pages

const { useState: usePatState } = React;

function NowPlayingBar() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 22,
      background: 'var(--bg-2)', border: '1px solid var(--line-1)', borderRadius: 999,
      padding: '12px 14px 12px 22px',
    }}>
      <span className="wc-pill wc-pill--onair">On Air</span>
      <span className="mono" style={{ fontSize: 11, letterSpacing: '0.16em', color: 'var(--ink-3)', textTransform: 'uppercase' }}>02:14</span>
      <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', gap: 12, minWidth: 0 }}>
        <span className="serif" style={{ fontStyle: 'italic', fontSize: 22, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>Stereolab</span>
        <span style={{ color: 'var(--ink-3)' }}>—</span>
        <span style={{ color: 'var(--ink-2)', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Lo Boob Oscillator · Refried Ectoplasm</span>
      </div>
      <button className="wc-btn wc-btn--ghost wc-btn--sm">Spins</button>
      <button className="wc-btn wc-btn--primary wc-btn--sm">▶ Listen</button>
    </div>
  );
}

function ScheduleCell({ time, show, host, tags = [], live, faded }) {
  return (
    <div style={{
      background: live ? 'var(--bg-3)' : 'var(--bg-2)',
      border: '1px solid ' + (live ? 'rgba(255,59,47,0.3)' : 'var(--line-1)'),
      borderRadius: 14, padding: 22,
      opacity: faded ? 0.55 : 1,
      position: 'relative',
      minHeight: 168,
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      {live && <span className="wc-pill wc-pill--onair" style={{ position: 'absolute', top: 16, right: 16 }}>Live</span>}
      <span className="mono" style={{ fontSize: 11, letterSpacing: '0.10em', color: 'var(--ink-3)', textTransform: 'uppercase' }}>{time}</span>
      <h4 className="serif" style={{ fontStyle: 'italic', fontSize: 26, letterSpacing: '-0.02em', margin: '4px 0 4px', fontWeight: 400 }}>{show}</h4>
      <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>w/ {host}</span>
      <div style={{ marginTop: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {tags.map(t => <span key={t} className="wc-pill" style={{ fontSize: 10, padding: '2px 8px' }}>{t}</span>)}
      </div>
    </div>
  );
}

function SpinRow({ time, artist, track, album, count }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '70px 1.4fr 2fr 1.4fr 60px',
      gap: 16, alignItems: 'baseline',
      padding: '16px 22px', borderTop: '1px solid var(--line-1)',
    }}>
      <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>{time}</span>
      <span className="serif" style={{ fontStyle: 'italic', fontSize: 18, letterSpacing: '-0.01em' }}>{artist}</span>
      <span style={{ fontSize: 14 }}>{track}</span>
      <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>{album}</span>
      <span style={{ textAlign: 'right' }}>
        {count > 1 && <span className="mono" style={{ fontSize: 10, letterSpacing: '0.10em', color: 'var(--ink-3)', border: '1px solid var(--line-2)', padding: '2px 6px', borderRadius: 999 }}>×{count}</span>}
      </span>
    </div>
  );
}

function DJCard({ name, handle, tagline, since, hue = 0.5 }) {
  // procedural placeholder portrait — diagonal gradient + initials
  const c1 = `oklch(0.30 0.04 ${hue * 360})`;
  const c2 = `oklch(0.55 0.08 ${hue * 360 + 60})`;
  return (
    <div className="wc-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{
        height: 200,
        background: `linear-gradient(135deg, ${c1}, ${c2})`,
        display: 'flex', alignItems: 'flex-end', padding: 22,
        position: 'relative',
      }}>
        <span className="serif" style={{ fontStyle: 'italic', fontSize: 88, letterSpacing: '-0.04em', color: 'rgba(255,255,255,0.92)', lineHeight: 0.9 }}>
          {name.split(' ').map(s => s[0]).join('')}
        </span>
        <span className="mono" style={{ position: 'absolute', top: 18, right: 18, fontSize: 10, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' }}>SINCE {since}</span>
      </div>
      <div style={{ padding: 22 }}>
        <h4 className="serif" style={{ fontStyle: 'italic', fontSize: 24, letterSpacing: '-0.02em', margin: 0, fontWeight: 400 }}>{name}</h4>
        <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4, letterSpacing: '0.04em' }}>@{handle}</div>
        <div style={{ marginTop: 14, fontSize: 13, color: 'var(--ink-2)' }}>{tagline}</div>
      </div>
    </div>
  );
}

function ShowHero() {
  return (
    <div style={{
      background: 'var(--bg-2)', border: '1px solid var(--line-1)', borderRadius: 18,
      padding: 48, position: 'relative', overflow: 'hidden',
    }}>
      <div className="uppercase-meta">SHOW · 0184 · S03E22</div>
      <h2 className="serif" style={{ fontStyle: 'italic', fontSize: 'clamp(56px, 7vw, 96px)', lineHeight: 0.95, letterSpacing: '-0.04em', margin: '20px 0 24px', fontWeight: 400, textWrap: 'balance' }}>
        Late Modernism
      </h2>
      <p style={{ color: 'var(--ink-2)', fontSize: 18, lineHeight: 1.5, maxWidth: 620, margin: 0 }}>
        Two hours of post-punk, no-wave, and minimal synth. Recorded live at the WCDB studios. Hosted by DJ Halftone since 2021.
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 32 }}>
        <button className="wc-btn wc-btn--primary">▶ Latest episode</button>
        <button className="wc-btn wc-btn--secondary">Subscribe</button>
        <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.10em', textTransform: 'uppercase', marginLeft: 'auto' }}>WED · 22:00 — 00:00 ET</span>
      </div>
    </div>
  );
}

function PlayerChip() {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 14,
      background: 'var(--bg-4)', border: '1px solid var(--line-2)', borderRadius: 999,
      padding: '8px 18px 8px 8px',
      boxShadow: 'var(--shadow-2)',
    }}>
      <button style={{
        width: 38, height: 38, borderRadius: '50%', background: 'var(--ink-1)', color: 'var(--bg-1)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
      }}>▶</button>
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span className="serif" style={{ fontStyle: 'italic', fontSize: 14, letterSpacing: '-0.01em' }}>Stereolab — Lo Boob Oscillator</span>
        <span className="mono" style={{ fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.10em', textTransform: 'uppercase' }}>Live · Late Modernism</span>
      </div>
      <div className="wc-eq" style={{ color: 'var(--on-air)', marginLeft: 6 }}>
        <span/><span/><span/><span/>
      </div>
    </div>
  );
}

function DayStrip() {
  const [active, setActive] = usePatState(2);
  const days = ['MON 03', 'TUE 04', 'WED 05', 'THU 06', 'FRI 07', 'SAT 08', 'SUN 09'];
  return (
    <div style={{ display: 'flex', gap: 0, borderTop: '1px solid var(--line-1)', borderBottom: '1px solid var(--line-1)' }}>
      {days.map((d, i) => (
        <button key={d} onClick={() => setActive(i)} style={{
          flex: 1, padding: '20px 0',
          borderLeft: i === 0 ? 'none' : '1px solid var(--line-1)',
          color: i === active ? 'var(--ink-1)' : 'var(--ink-3)',
          background: i === active ? 'var(--bg-2)' : 'transparent',
          borderTop: i === active ? '2px solid var(--ink-1)' : '2px solid transparent',
          transition: 'all 160ms ease',
        }}>
          <div className="mono" style={{ fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase' }}>{d.split(' ')[0]}</div>
          <div className="serif" style={{ fontStyle: 'italic', fontSize: 24, letterSpacing: '-0.02em', marginTop: 4 }}>{d.split(' ')[1]}</div>
        </button>
      ))}
    </div>
  );
}

function EditorialIntro() {
  return (
    <article style={{ maxWidth: 720 }}>
      <div className="uppercase-meta">DISPATCH · MAR 03 · 2026</div>
      <h2 className="serif" style={{ fontStyle: 'italic', fontSize: 56, letterSpacing: '-0.03em', lineHeight: 1.0, margin: '24px 0 28px', fontWeight: 400, textWrap: 'balance' }}>
        Forty-eight years on a hairline.
      </h2>
      <p style={{ fontSize: 18, lineHeight: 1.6, color: 'var(--ink-2)', margin: '0 0 18px' }}>
        WCDB has been broadcasting from the basement of UAlbany's Campus Center since 1978. We've outlasted four formats, three antennas, and roughly nineteen iterations of <em>this exact website</em>.
      </p>
      <p style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--ink-3)', margin: 0 }}>
        The 20th iteration is committed to one idea: the music does the heavy lifting, and the chrome stays out of the way.
      </p>
    </article>
  );
}

function FreqStat({ label, value, sub }) {
  return (
    <div style={{ background: 'var(--bg-1)', padding: '28px 28px 32px' }}>
      <div className="uppercase-meta" style={{ marginBottom: 14 }}>{label}</div>
      <div className="serif" style={{ fontStyle: 'italic', fontSize: 56, letterSpacing: '-0.03em', lineHeight: 1, fontWeight: 400 }}>{value}</div>
      <div style={{ marginTop: 10, color: 'var(--ink-3)', fontSize: 12 }}>{sub}</div>
    </div>
  );
}

function Crumb() {
  return (
    <div className="mono" style={{ fontSize: 11, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--ink-3)', display: 'flex', gap: 10, alignItems: 'center' }}>
      <span style={{ color: 'var(--ink-1)' }}>WCDB</span>
      <span>/</span>
      <span>Shows</span>
      <span>/</span>
      <span>Late Modernism</span>
      <span>/</span>
      <span style={{ color: 'var(--ink-1)' }}>S03E22</span>
    </div>
  );
}

function SearchPallet() {
  return (
    <div style={{
      background: 'var(--bg-4)', border: '1px solid var(--line-2)', borderRadius: 14,
      width: '100%', maxWidth: 640,
      boxShadow: '0 24px 64px rgba(0,0,0,0.5)', overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 22px', borderBottom: '1px solid var(--line-1)' }}>
        <span className="mono" style={{ color: 'var(--ink-3)', fontSize: 13 }}>⌘K</span>
        <input style={{
          flex: 1, background: 'transparent', border: 0, outline: 'none',
          color: 'var(--ink-1)', fontSize: 16,
        }} placeholder="Search shows, DJs, tracks…" defaultValue="late mod" />
        <span className="mono" style={{ fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.10em', textTransform: 'uppercase' }}>esc</span>
      </div>
      <div style={{ padding: 6 }}>
        <div className="uppercase-meta" style={{ padding: '12px 18px 6px' }}>Shows</div>
        {['Late Modernism · DJ Halftone', 'Mid-90s Modernism · Various'].map((r, i) => (
          <div key={r} style={{
            padding: '12px 18px', borderRadius: 8, fontSize: 14,
            background: i === 0 ? 'var(--bg-3)' : 'transparent',
            display: 'flex', justifyContent: 'space-between',
          }}>
            <span>{r}</span>
            {i === 0 && <span className="mono" style={{ fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.10em', textTransform: 'uppercase' }}>↵ open</span>}
          </div>
        ))}
        <div className="uppercase-meta" style={{ padding: '14px 18px 6px' }}>DJs</div>
        <div style={{ padding: '12px 18px', fontSize: 14 }}>DJ Halftone</div>
      </div>
    </div>
  );
}

function CompactSpinList() {
  const rows = [
    ['02:14', 'Stereolab', 'Lo Boob Oscillator'],
    ['02:09', 'Slowdive', 'Star Roving'],
    ['02:04', 'Cocteau Twins', 'Cherry-Coloured Funk'],
    ['02:00', 'Broadcast', 'Tears in the Typing Pool'],
    ['01:55', 'The Durutti Column', 'Sketch for Summer'],
    ['01:49', 'Galaxie 500', 'Tugboat'],
    ['01:44', 'Beach House', 'Walk in the Park'],
    ['01:40', 'Slint', 'Good Morning, Captain'],
  ];
  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line-1)', borderRadius: 12, overflow: 'hidden' }}>
      {rows.map((r, i) => (
        <div key={i} style={{
          display: 'grid', gridTemplateColumns: '60px 180px 1fr',
          padding: '8px 18px', alignItems: 'baseline', gap: 12,
          borderTop: i === 0 ? 'none' : '1px solid var(--line-1)',
        }}>
          <span className="mono" style={{ fontSize: 10, color: 'var(--ink-4)' }}>{r[0]}</span>
          <span className="serif" style={{ fontStyle: 'italic', fontSize: 14, letterSpacing: '-0.01em' }}>{r[1]}</span>
          <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>{r[2]}</span>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, {
  NowPlayingBar, ScheduleCell, SpinRow, DJCard, ShowHero, PlayerChip,
  DayStrip, EditorialIntro, FreqStat, Crumb, SearchPallet, CompactSpinList,
});
