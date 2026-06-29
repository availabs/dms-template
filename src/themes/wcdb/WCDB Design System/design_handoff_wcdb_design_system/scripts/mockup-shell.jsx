// WCDB mockup chrome.
// Layout pattern (matches wcdb.fm + the user's "image cutaway" variant):
//   - The TOP NAV is NOT full-width. It floats over the LEFT column only,
//     where the hero/episode image lives. The image extends UP under the nav,
//     creating an editorial "image cutaway" feel.
//   - The RIGHT column starts at top:0 with no nav above it — the content
//     simply runs from the top edge.
//   - The LEFT column is fixed (sticky to viewport) so the right column
//     scrolls past it, like wcdb.fm.
//   - On non-split pages the nav still spans the full content width.

const TOPNAV_H = 56; // h-14 from wcdb_theme
const PANEL_RADIUS = 18;

// ── Top nav (renders inline in a slot, not fixed at the body root) ──────────
function MockupTopNav({ active, variant = 'wide' }) {
  const links = [
    ['Listen', 'listen.html'],
    ['Schedule', 'schedule.html'],
    ['Shows', 'show.html'],
    ['DJs', 'djs.html'],
    ['Spins', 'spins.html'],
    ['Blog', 'blog.html'],
    ['Events', 'events.html'],
  ];
  const isLeftSlot = variant === 'left-slot';
  const isWide = variant === 'wide';
  return (
    <header className={isLeftSlot ? 'wc-topnav wc-topnav--left' : 'wc-topnav'} style={{
      height: TOPNAV_H,
      display: 'flex', alignItems: 'center',
      background: isLeftSlot ? 'transparent' : 'var(--page-bg)',
      gap: 0,
      padding: isLeftSlot ? '0 18px 0 18px' : 0,
    }}>
      {/* Logo block — shows in 'wide' AND 'left-slot'. Solid bg behind it. */}
      <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
        <div style={{
          paddingTop: 4,
          paddingLeft: isLeftSlot ? 0 : 16,
        }}><WCDBMark /></div>
      </div>
      <nav style={{
        display: 'flex', alignItems: 'center', flex: 1, height: '100%',
        gap: isLeftSlot ? 2 : 4, padding: isLeftSlot ? '0' : '0 12px', overflow: 'visible',
        justifyContent: isLeftSlot ? 'flex-end' : 'flex-start',
      }}>
        {links.map(([l, h]) => (
          <a key={l} href={h}
             className={'wc-topnav__item ' + (isLeftSlot ? 'wc-topnav__item--on-image' : '')}
             data-active={l === active ? 'true' : undefined}>
            {l}
          </a>
        ))}
      </nav>
      {isWide && (
        <div style={{
          display: 'flex', alignItems: 'center', height: '100%',
          paddingRight: 16, gap: 10,
        }}>
          <a href="index.html" className="wc-btn wc-btn--ghost wc-btn--sm">← System</a>
          <button className="wc-btn wc-btn--primary wc-btn--sm">▶ Live</button>
        </div>
      )}
    </header>
  );
}

// ── Single-column shell (used by schedule/shows/djs/spins/blog/events/listen) ──
function MockupShell({ active, children }) {
  return (
    <>
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        background: 'var(--page-bg)',
      }}>
        <MockupTopNav active={active} />
      </div>
      <main style={{
        paddingTop: TOPNAV_H,
        background: 'var(--page-bg)',
        minHeight: '100vh',
      }}>
        <div style={{ maxWidth: 1440, margin: '0 auto', padding: '0 8px 32px' }}>
          {children}
        </div>
      </main>
    </>
  );
}

// ── Split shell ─────────────────────────────────────────────────────────────
// Layout:
//   ┌─────────────────────────────────────────┐
//   │ TOP NAV (left only)  │                  │  ← nav over left column
//   ├──────────────────────│   RIGHT COLUMN   │     (image cuts under it)
//   │ LEFT COLUMN (fixed)  │   (scrolls)      │  ← right starts at top:0
//   │  (hero image,        │                  │
//   │   stays put while    │                  │
//   │   right scrolls)     │                  │
//   └─────────────────────────────────────────┘
function MockupShellSplit({ active, left, right }) {
  return (
    <main style={{
      background: 'var(--page-bg)',
      minHeight: '100vh',
    }}>
      <div className="wc-split">
        {/* LEFT — fixed/sticky to viewport. Nav floats over it at the top. */}
        <div className="wc-split__left">
          <div className="wc-split__left-sticky">
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, zIndex: 40,
              height: TOPNAV_H,
              background: 'transparent',
              pointerEvents: 'none',
            }}>
              <div style={{ pointerEvents: 'auto', height: '100%' }}>
                <MockupTopNav active={active} variant="left-slot" />
              </div>
            </div>
            {left}
          </div>
        </div>
        {/* RIGHT — scrolls; starts at top:0, no nav above it */}
        <div className="wc-split__right">{right}</div>
      </div>
    </main>
  );
}

Object.assign(window, {
  MockupTopNav, MockupShell, MockupShellSplit,
  MOCKUP_TOPNAV_H: TOPNAV_H, PANEL_RADIUS,
});
