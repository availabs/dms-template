// WCDB Design System — Shared shell
// Header, side nav, page wrapper used by all subpages

const { useState, useEffect } = React;

const PAGES = [
  { id: 'index.html',         num: '00', label: 'Overview' },
  { id: 'foundations.html',   num: '01', label: 'Foundations' },
  { id: 'components.html',    num: '02', label: 'Components' },
  { id: 'patterns.html',      num: '03', label: 'Patterns' },
  { id: 'home.html',          num: '04', label: 'Home / Now Playing' },
  { id: 'schedule.html',      num: '05', label: 'Schedule' },
  { id: 'show.html',          num: '06', label: 'Show Detail' },
  { id: 'djs.html',           num: '07', label: 'DJ Directory' },
  { id: 'spins.html',          num: '08', label: 'Recent Spins' },
  { id: 'blog.html',          num: '09', label: 'Blog' },
  { id: 'events.html',        num: '10', label: 'Events' },
  { id: 'listen.html',        num: '11', label: 'Listen' },
];

// ────────── WCDB wordmark ──────────
function WCDBMark({ size = 'md' }) {
  const sizes = { sm: { f: 18, c: 9 }, md: { f: 22, c: 11 }, lg: { f: 30, c: 13 } };
  const s = sizes[size] || sizes.md;
  return (
    <a href="index.html" className="wc-logo" style={{ fontSize: s.f }}>
      <span style={{ fontStyle: 'italic' }}>wcdb</span>
      <span className="wc-logo__call" style={{ fontSize: s.c }}>90.9 FM · ALBANY</span>
    </a>
  );
}

// ────────── Live ticker ──────────
function NowPlayingTicker() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '8px 14px',
      borderRadius: 999,
      border: '1px solid var(--line-2)',
      background: 'var(--bg-2)',
      fontSize: 12,
    }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--on-air)' }}>
        <span className="wc-eq" style={{ height: 10 }}>
          <span /><span /><span /><span />
        </span>
        <span className="mono" style={{ letterSpacing: '0.16em', textTransform: 'uppercase', fontSize: 10 }}>On Air</span>
      </span>
      <span style={{ color: 'var(--ink-3)' }}>·</span>
      <span className="serif" style={{ fontStyle: 'italic', fontSize: 14 }}>Stereolab</span>
      <span style={{ color: 'var(--ink-3)' }}>—</span>
      <span style={{ color: 'var(--ink-2)' }}>Lo Boob Oscillator</span>
    </div>
  );
}

// ────────── Site header ──────────
function SiteHeader({ current }) {
  const [open, setOpen] = useState(false);
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: 'rgba(14,16,17,0.85)',
      backdropFilter: 'blur(14px)',
      borderBottom: '1px solid var(--line-1)',
    }}>
      <div style={{
        maxWidth: 1480, margin: '0 auto',
        padding: '18px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 32,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <WCDBMark />
          <span className="uppercase-meta" style={{ borderLeft: '1px solid var(--line-2)', paddingLeft: 16 }}>
            Design System v1.0
          </span>
        </div>
        <NowPlayingTicker />
        <nav style={{ display: 'flex', alignItems: 'center', gap: 20, fontSize: 13 }}>
          <a href="components.html" style={{ color: current === 'components.html' ? 'var(--ink-1)' : 'var(--ink-3)' }}>Components</a>
          <a href="home.html" style={{ color: 'var(--ink-3)' }}>Mockups</a>
          <button className="wc-btn wc-btn--secondary wc-btn--sm" onClick={() => window.parent.postMessage({type:'__activate_edit_mode'},'*')}>
            Tweaks
          </button>
        </nav>
      </div>
    </header>
  );
}

// ────────── Side nav ──────────
function SideNav({ current }) {
  return (
    <aside style={{
      position: 'sticky', top: 80, alignSelf: 'flex-start',
      width: 240, flexShrink: 0,
      paddingTop: 32,
    }}>
      <div className="uppercase-meta" style={{ marginBottom: 18, paddingLeft: 4 }}>Index</div>
      <nav style={{ display: 'flex', flexDirection: 'column' }}>
        {PAGES.map(p => {
          const active = p.id === current;
          return (
            <a key={p.id} href={p.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              padding: '10px 4px',
              borderBottom: '1px solid var(--line-1)',
              color: active ? 'var(--ink-1)' : 'var(--ink-3)',
              fontSize: 13,
            }}>
              <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 12 }}>
                <span className="mono" style={{ fontSize: 10, letterSpacing: '0.10em', color: 'var(--ink-4)' }}>
                  {p.num}
                </span>
                <span>{p.label}</span>
              </span>
              {active && <span style={{ color: 'var(--ink-1)' }}>→</span>}
            </a>
          );
        })}
      </nav>
    </aside>
  );
}

// ────────── Page footer ──────────
function SiteFooter() {
  return (
    <footer style={{ borderTop: '1px solid var(--line-1)', marginTop: 96, padding: '48px 32px' }}>
      <div style={{
        maxWidth: 1480, margin: '0 auto',
        display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 48,
      }}>
        <div>
          <WCDBMark size="lg" />
          <p style={{ marginTop: 18, color: 'var(--ink-3)', maxWidth: 380, fontSize: 13, lineHeight: 1.6 }}>
            UAlbany's only student-run radio station. Broadcasting alternative music, talk, and sports
            since 1978. Streaming worldwide.
          </p>
        </div>
        <div>
          <div className="uppercase-meta" style={{ marginBottom: 14 }}>Listen</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 13, lineHeight: 2 }}>
            <li><a style={{ color: 'var(--ink-2)' }} href="#">Live stream</a></li>
            <li><a style={{ color: 'var(--ink-2)' }} href="#">Schedule</a></li>
            <li><a style={{ color: 'var(--ink-2)' }} href="#">Recent spins</a></li>
          </ul>
        </div>
        <div>
          <div className="uppercase-meta" style={{ marginBottom: 14 }}>Station</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 13, lineHeight: 2 }}>
            <li><a style={{ color: 'var(--ink-2)' }} href="#">DJs</a></li>
            <li><a style={{ color: 'var(--ink-2)' }} href="#">History</a></li>
            <li><a style={{ color: 'var(--ink-2)' }} href="#">Contact</a></li>
          </ul>
        </div>
        <div>
          <div className="uppercase-meta" style={{ marginBottom: 14 }}>Contact</div>
          <p className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.7 }}>
            Campus Center 316<br />
            1400 Washington Ave<br />
            Albany, NY 12222
          </p>
        </div>
      </div>
      <div style={{
        maxWidth: 1480, margin: '64px auto 0',
        display: 'flex', justifyContent: 'space-between',
        fontSize: 11, color: 'var(--ink-4)',
      }} className="mono">
        <span>© 2026 WCDB · 90.9 FM</span>
        <span>SUNY Albany</span>
      </div>
    </footer>
  );
}

// ────────── Page wrapper ──────────
function PageShell({ current, children }) {
  return (
    <>
      <SiteHeader current={current} />
      <div style={{
        maxWidth: 1480, margin: '0 auto',
        padding: '32px 32px 0',
        display: 'flex', gap: 64,
      }}>
        <SideNav current={current} />
        <main style={{ flex: 1, minWidth: 0, paddingTop: 32 }}>
          {children}
        </main>
      </div>
      <SiteFooter />
    </>
  );
}

function SectionHead({ num, title, kicker }) {
  return (
    <div className="wc-section-head">
      <div>
        <div className="wc-section-head__num">{num} — {kicker}</div>
        <h2 className="wc-section-head__title" style={{ marginTop: 12 }}>{title}</h2>
      </div>
    </div>
  );
}

Object.assign(window, { WCDBMark, SiteHeader, SideNav, SiteFooter, PageShell, SectionHead, NowPlayingTicker, PAGES });
