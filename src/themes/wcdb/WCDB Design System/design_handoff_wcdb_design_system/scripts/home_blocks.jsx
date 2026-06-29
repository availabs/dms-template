// Home page blocks — two-column layout matching wcdb.fm with the
// "image cutaway" nav variant (left column extends up under the floating nav).
//
// Right-column composition mixes BARE sections (sit directly on page-bg)
// with CARDED sections (rounded panels) and one INVERTED card (footer).

const TOPNAV_OFFSET = 56;
const PANEL_RADIUS = 18;

// ──────────────────────────────────────────────────────────────────────────
// LEFT COLUMN — sticky, full viewport height, hero panel that goes UNDER nav
// ──────────────────────────────────────────────────────────────────────────

function HomeLeftColumn() {
  // The split shell wraps this in a sticky 100vh container. We just need to
  // fill it. The combined hero+player panel handles the rest.
  return (
    <div style={{
      flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
      height: '100%',
    }}>
      <ShowAndPlayerPanel />
    </div>
  );
}

// Combined "Featured Episode + Now Playing" — one big component, single
// rounded panel with two stacked regions sharing a chrome.
function ShowAndPlayerPanel() {
  return (
    <div style={{
      flex: 1, minHeight: 0,
      borderRadius: PANEL_RADIUS, overflow: 'hidden',
      background: 'var(--card-bg)',
      display: 'flex', flexDirection: 'column',
      position: 'relative',
    }}>
      {/* (Logo lives in the nav row above this panel.) */}

      {/* ── HERO IMAGE / EPISODE ART (flex 1, fills available space) ── */}
      <div className="wc-art" style={{
        flex: '1 1 auto', minHeight: 0, position: 'relative',
      }}>
        {/* Scan-line texture */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.06) 0 1px, transparent 1px 3px)',
          mixBlendMode: 'multiply', pointerEvents: 'none',
        }} />
        {/* Bottom-left glyph */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-start',
          padding: '0 0 0 24px',
        }}>
          <div className="serif" style={{
            fontStyle: 'italic', fontSize: 'clamp(140px, 18vw, 280px)',
            color: 'rgba(255,255,255,0.14)', letterSpacing: '-0.06em',
            fontWeight: 400, lineHeight: 0.8, mixBlendMode: 'overlay', userSelect: 'none',
            transform: 'translateY(15%)',
          }}>L.M.</div>
        </div>
        {/* Top-right meta — REMOVED. The nav sits here now and the pill
            was overlapping it. The "Featured Episode" framing is conveyed
            by the editorial caption below. */}
      </div>

      {/* ── EDITORIAL CAPTION + PLAYER (combined into one strip) ── */}
      <div style={{
        padding: '24px 28px 26px',
        background: 'var(--card-bg)',
        position: 'relative',
      }}>
        {/* Caption */}
        <div className="mono" style={{
          fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase',
          color: 'var(--ink-3)', marginBottom: 12,
        }}>
          LATE MODERNISM · W/ DJ HALFTONE · MAR 05
        </div>
        <h2 className="serif" style={{
          fontStyle: 'italic', fontSize: 'clamp(26px, 2.6vw, 36px)',
          letterSpacing: '-0.03em', lineHeight: 1.05,
          margin: 0, fontWeight: 400, textWrap: 'balance',
          color: 'var(--ink-1)',
        }}>
          Tape music & tape loops, an evening with the Radiophonic ghosts.
        </h2>

        {/* Hairline separator within the same panel */}
        <div style={{
          height: 1, background: 'var(--line-1)', margin: '24px 0 20px',
        }} />

        {/* Inline now-playing row — small album art + track + controls */}
        <div style={{
          display: 'grid', gridTemplateColumns: '64px 1fr auto',
          gap: 16, alignItems: 'center',
        }}>
          <div className="wc-art wc-art--ember" style={{
            width: 64, height: 64, borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div className="serif" style={{
              fontStyle: 'italic', fontSize: 30,
              color: 'rgba(255,255,255,0.85)', letterSpacing: '-0.04em',
              fontWeight: 400,
            }}>S</div>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span className="wc-pill wc-pill--onair" style={{ fontSize: 9, padding: '2px 7px' }}>On Air</span>
              <span className="mono" style={{ fontSize: 10, letterSpacing: '0.10em', color: 'var(--ink-3)', textTransform: 'uppercase' }}>NOW · 02:14</span>
            </div>
            <div className="serif" style={{
              fontStyle: 'italic', fontSize: 22, letterSpacing: '-0.02em',
              lineHeight: 1.15, fontWeight: 400,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>Stereolab — Lo Boob Oscillator</div>
            <div style={{
              fontSize: 12, color: 'var(--ink-3)', marginTop: 3,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>Refried Ectoplasm, Vol. 3 · 1995</div>
          </div>
          <button style={{
            width: 52, height: 52, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: 'var(--ink-1)', color: 'var(--bg-1)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', paddingLeft: 3,
            fontSize: 16,
          }} aria-label="Listen live">▶</button>
        </div>

        {/* Progress + listener count */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 16 }}>
          <div style={{
            height: 3, background: 'var(--line-1)', borderRadius: 2, overflow: 'hidden',
          }}>
            <div style={{ width: '34%', height: '100%', background: 'var(--ink-2)' }} />
          </div>
          <div className="mono" style={{
            fontSize: 9, letterSpacing: '0.10em', color: 'var(--ink-3)',
            display: 'flex', justifyContent: 'space-between', textTransform: 'uppercase',
          }}>
            <span>00:48</span><span>184 listeners worldwide</span><span>02:23</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// RIGHT COLUMN — mix of bare and carded sections + inverted footer
// ──────────────────────────────────────────────────────────────────────────

function HomeRightColumn() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <RightHeroBare />
      <ScheduleCard />
      <SpinsBare />
      <BlogCard />
      <EventsBare />
      <StatsCard />
      <FooterInverted />
    </div>
  );
}

// 1. Hero — BARE on page bg
function RightHeroBare() {
  return (
    <div className="wc-bare" style={{ padding: '48px 28px 24px' }}>
      <div className="uppercase-meta">90.9 FM · ALBANY · ON AIR NOW</div>
      <h1 className="serif" style={{
        fontStyle: 'italic',
        fontSize: 'clamp(56px, 6vw, 88px)',
        lineHeight: 0.95, letterSpacing: '-0.04em',
        margin: '20px 0 0', fontWeight: 400, textWrap: 'balance',
      }}>
        Stereolab,<br />
        <span style={{ color: 'var(--ink-3)' }}>somewhere in</span><br />
        Albany.
      </h1>
      <p style={{
        color: 'var(--ink-2)', fontSize: 15, lineHeight: 1.6,
        margin: '24px 0 0', maxWidth: 480,
      }}>
        Student-run college radio at SUNY Albany. Forty-eight years on a hairline of the FM band, plus a streaming signal anyone, anywhere can pick up.
      </p>
      <div style={{ display: 'flex', gap: 10, marginTop: 28, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="wc-btn wc-btn--primary">▶ Listen Live</button>
        <a href="schedule.html" className="wc-btn wc-btn--secondary">Tonight's schedule</a>
      </div>
    </div>
  );
}

// 2. Schedule — CARDED (grey card)
function ScheduleCard() {
  const rows = [
    ['LIVE NOW', '22:00 — 00:00', 'Late Modernism', 'DJ Halftone', true],
    ['UP NEXT', '00:00 — 02:00', 'The Quiet Hours', 'Marisol Ng', false],
    ['THEN', '02:00 — 04:00', 'Graveyard Shift', 'Ezra Park', false],
  ];
  return (
    <div style={{
      background: 'var(--card-bg)',
      borderRadius: PANEL_RADIUS,
      padding: '28px 32px 32px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 18 }}>
        <h2 className="serif" style={{ fontStyle: 'italic', fontSize: 28, margin: 0, fontWeight: 400, letterSpacing: '-0.03em' }}>On now & up next</h2>
        <a href="schedule.html" className="wc-btn wc-btn--link" style={{ fontSize: 12 }}>Full schedule →</a>
      </div>
      <div>
        {rows.map((r, i) => (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '90px 130px 1fr 120px',
            gap: 16, alignItems: 'baseline',
            padding: '18px 0', borderTop: i === 0 ? 'none' : '1px solid var(--line-1)',
          }}>
            <span className="mono" style={{
              fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase',
              color: r[4] ? 'var(--on-air)' : 'var(--ink-4)',
            }}>{r[0]}</span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.04em' }}>{r[1]} ET</span>
            <span className="serif" style={{ fontStyle: 'italic', fontSize: 22, letterSpacing: '-0.02em' }}>{r[2]}</span>
            <span style={{ fontSize: 12, color: 'var(--ink-3)', textAlign: 'right' }}>{r[3]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// 3. Spins — BARE on page bg
function SpinsBare() {
  const spins = [
    ['02:14', 'Stereolab', 'Lo Boob Oscillator', 3],
    ['02:09', 'Slowdive', 'Star Roving', 1],
    ['02:04', 'Cocteau Twins', 'Cherry-Coloured Funk', 11],
    ['02:00', 'Broadcast', 'Tears in the Typing Pool', 1],
    ['01:55', 'The Durutti Column', 'Sketch for Summer', 2],
  ];
  return (
    <div className="wc-bare" style={{ padding: '24px 28px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
        <h2 className="serif" style={{ fontStyle: 'italic', fontSize: 28, margin: 0, fontWeight: 400, letterSpacing: '-0.03em' }}>Latest spins</h2>
        <a href="spins.html" className="wc-btn wc-btn--link" style={{ fontSize: 12 }}>All spins →</a>
      </div>
      <div>
        {spins.map((s, i) => (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '60px 1fr 1.2fr 60px',
            gap: 16, alignItems: 'baseline',
            padding: '14px 0',
            borderTop: i === 0 ? 'none' : '1px solid var(--line-1)',
          }}>
            <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>{s[0]}</span>
            <span className="serif" style={{ fontStyle: 'italic', fontSize: 18, letterSpacing: '-0.02em' }}>{s[1]}</span>
            <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>{s[2]}</span>
            <span style={{ textAlign: 'right' }}>
              {s[3] > 1 ? (
                <span className="mono" style={{
                  fontSize: 9, letterSpacing: '0.08em', color: 'var(--ink-3)',
                  border: '1px solid var(--line-2)', padding: '2px 6px', borderRadius: 999,
                }}>×{s[3]}</span>
              ) : <span style={{ color: 'var(--ink-4)' }}>—</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// 4. Blog promo — CARDED
function BlogCard() {
  return (
    <a href="blog.html" style={{
      display: 'block', textDecoration: 'none',
      background: 'var(--card-bg)',
      borderRadius: PANEL_RADIUS,
      padding: '36px 32px 40px',
    }}>
      <div className="uppercase-meta">DISPATCH · MAR 03 · BY EDITORIAL BOARD</div>
      <h3 className="serif" style={{
        fontStyle: 'italic', fontSize: 'clamp(36px, 4vw, 50px)',
        lineHeight: 1.0, letterSpacing: '-0.03em',
        margin: '18px 0 16px', fontWeight: 400, textWrap: 'balance', maxWidth: 520,
      }}>Forty-eight years on a hairline.</h3>
      <p style={{ color: 'var(--ink-3)', fontSize: 14, lineHeight: 1.6, margin: 0, maxWidth: 480 }}>
        WCDB has been broadcasting from the basement of UAlbany's Campus Center since 1978. Here's what changed and what didn't.
      </p>
      <div style={{ marginTop: 24, color: 'var(--ink-2)', fontSize: 13 }}>Read →</div>
    </a>
  );
}

// 5. Events — BARE
function EventsBare() {
  const events = [
    ['MAR', '12', 'Modernism Live #4', 'Hangar on the Hudson · Troy'],
    ['MAR', '22', 'Vinyl Swap & Sale', 'Campus Center Atrium'],
    ['APR', '05', 'Pledge Drive Kickoff', 'WCDB Studio B'],
  ];
  return (
    <div className="wc-bare" style={{ padding: '24px 28px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 18 }}>
        <h2 className="serif" style={{ fontStyle: 'italic', fontSize: 28, margin: 0, fontWeight: 400, letterSpacing: '-0.03em' }}>Off the air</h2>
        <a href="events.html" className="wc-btn wc-btn--link" style={{ fontSize: 12 }}>All events →</a>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {events.map((e, i) => (
          <a key={i} href="events.html" style={{
            display: 'block', padding: '20px 18px',
            border: '1px solid var(--line-1)', borderRadius: 14,
            background: 'var(--card-bg-soft)',
          }}>
            <div className="mono" style={{
              fontSize: 9, letterSpacing: '0.18em', color: 'var(--ink-3)', textTransform: 'uppercase',
            }}>{e[0]}</div>
            <div className="serif" style={{
              fontStyle: 'italic', fontSize: 48, letterSpacing: '-0.04em', fontWeight: 400, lineHeight: 1, marginTop: 4,
            }}>{e[1]}</div>
            <div className="serif" style={{
              fontStyle: 'italic', fontSize: 18, letterSpacing: '-0.02em', marginTop: 14, fontWeight: 400, lineHeight: 1.15,
            }}>{e[2]}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 6 }}>{e[3]}</div>
          </a>
        ))}
      </div>
    </div>
  );
}

// 6. Stats — CARDED
function StatsCard() {
  const stats = [
    ['184', 'Listeners now'],
    ['412', 'Spins today'],
    ['48', 'Years on air'],
    ['52', 'Active DJs'],
  ];
  return (
    <div style={{
      background: 'var(--card-bg)',
      borderRadius: PANEL_RADIUS,
      padding: '28px 32px',
      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0,
    }}>
      {stats.map((s, i) => (
        <div key={i} style={{
          paddingLeft: i === 0 ? 0 : 20,
          borderLeft: i === 0 ? 'none' : '1px solid var(--line-1)',
        }}>
          <div className="serif" style={{
            fontStyle: 'italic', fontSize: 'clamp(36px, 4vw, 52px)',
            letterSpacing: '-0.03em', fontWeight: 400, lineHeight: 1,
          }}>{s[0]}</div>
          <div className="mono" style={{
            fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
            color: 'var(--ink-3)', marginTop: 10,
          }}>{s[1]}</div>
        </div>
      ))}
    </div>
  );
}

// 7. Footer — INVERTED card (white on dark, dark on light)
function FooterInverted() {
  return (
    <div className="wc-card-inv" style={{ padding: '40px 32px 32px' }}>
      {/* Top row: tagline + social */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        flexWrap: 'wrap', gap: 24, marginBottom: 36,
      }}>
        <div>
          <h3 className="serif" style={{
            fontStyle: 'italic', fontSize: 'clamp(30px, 3.6vw, 44px)',
            letterSpacing: '-0.03em', lineHeight: 1.0,
            margin: 0, fontWeight: 400, color: 'var(--inv-ink)', maxWidth: 360, textWrap: 'balance',
          }}>Stay tuned.</h3>
          <p style={{ color: 'var(--inv-ink-2)', fontSize: 13, lineHeight: 1.5, margin: '12px 0 0', maxWidth: 360 }}>
            Bi-weekly dispatch from the basement. New shows, new spins, the occasional opinion.
          </p>
        </div>
        <form style={{ display: 'flex', gap: 8 }} onSubmit={e => e.preventDefault()}>
          <input
            placeholder="you@email.com"
            style={{
              border: '1px solid var(--inv-line)',
              background: 'transparent',
              color: 'var(--inv-ink)',
              padding: '10px 14px', borderRadius: 999,
              fontSize: 13, fontFamily: 'var(--font-sans)',
              minWidth: 220, outline: 'none',
            }}
          />
          <button style={{
            background: 'var(--inv-ink)', color: 'var(--inv-bg)',
            border: 'none', padding: '10px 18px', borderRadius: 999,
            fontSize: 13, fontWeight: 500, cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
          }}>Subscribe</button>
        </form>
      </div>

      {/* Hairline */}
      <div style={{ height: 1, background: 'var(--inv-line)', margin: '0 0 28px' }} />

      {/* Link grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24, marginBottom: 32 }}>
        {[
          ['Listen', ['Live', 'Schedule', 'Recent spins']],
          ['Programming', ['Shows', 'DJs', 'Submit a demo']],
          ['Read', ['Blog', 'Reviews', 'Interviews']],
          ['Station', ['About', 'Pledge', 'Contact']],
        ].map(([title, items]) => (
          <div key={title}>
            <div className="mono" style={{
              fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase',
              color: 'var(--inv-ink-2)', marginBottom: 14,
            }}>{title}</div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map(it => (
                <li key={it}><a href="#" style={{ fontSize: 14, color: 'var(--inv-ink)' }}>{it}</a></li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Hairline */}
      <div style={{ height: 1, background: 'var(--inv-line)', margin: '0 0 16px' }} />

      {/* Bottom meta row */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: 12,
      }}>
        <span className="mono" style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--inv-ink-2)' }}>
          WCDB · 90.9 FM · ALBANY · EST. 1978
        </span>
        <span className="mono" style={{ fontSize: 10, color: 'var(--inv-ink-2)' }}>© 2026 SUNY Albany</span>
      </div>
    </div>
  );
}

Object.assign(window, {
  HomeLeftColumn, HomeRightColumn,
  ShowAndPlayerPanel,
  RightHeroBare, ScheduleCard, SpinsBare, BlogCard, EventsBare, StatsCard, FooterInverted,
});
