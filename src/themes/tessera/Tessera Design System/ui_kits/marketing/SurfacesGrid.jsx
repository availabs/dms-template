// SurfacesGrid.jsx — "One representation. Many renderings."
// Four template kinds from the brief: radio (wcdb.fm), civic dashboard,
// heavy analytics, documentation. Renders small thumb chrome inline so
// we don't need image assets.

function SurfacesGrid() {
  return (
    <section style={sgStyles.section}>
      <div style={sgStyles.inner}>
        <header style={sgStyles.header}>
          <div className="designator-mono">Surfaces</div>
          <h2 style={sgStyles.h2}>One representation. Many renderings.</h2>
          <p style={sgStyles.lede}>
            A page is a row. A chart is a row. A map is a row. A join is two rows
            pointing at each other. The four sites below are driven by the same
            engine — no template forks, no special cases.
          </p>
        </header>

        <div style={sgStyles.grid}>
          <Surface
            slug="wcdb.fm"
            kind="Radio station"
            note="Live now-playing, schedule grid, archive."
            thumb={<RadioThumb />}
          />
          <Surface
            slug="mitigate.ny.gov"
            kind="Civic dashboard"
            note="Watershed indicators, region drill-downs."
            thumb={<CivicThumb />}
          />
          <Surface
            slug="npmrds.tessera.io"
            kind="Analytics page"
            note="Freight corridor performance, last 30d."
            thumb={<AnalyticsThumb />}
          />
          <Surface
            slug="avail.docs.tessera.io"
            kind="Documentation"
            note="API reference and pattern guides."
            thumb={<DocsThumb />}
          />
        </div>
      </div>
    </section>
  );
}

function Surface({ slug, kind, note, thumb }) {
  return (
    <article style={sgStyles.tile}>
      <div style={sgStyles.thumbWrap}>{thumb}</div>
      <div style={sgStyles.tileMeta}>
        <div style={sgStyles.tileSlug}>
          <span>{slug}</span>
          <ArrowExternal />
        </div>
        <div style={sgStyles.tileKind}>{kind}</div>
        <p style={sgStyles.tileNote}>{note}</p>
      </div>
    </article>
  );
}

function ArrowExternal() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M5 11L11 5M6 5h5v5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="square"/>
    </svg>
  );
}

/* --- tiny iconographic thumbs (not screenshots; placeholders that obey the brand) --- */

function RadioThumb() {
  return (
    <svg viewBox="0 0 280 160" width="100%" height="100%" preserveAspectRatio="none">
      <rect width="280" height="160" fill="#FBF9F4"/>
      <rect x="0" y="0" width="280" height="20" fill="#2A2F36"/>
      <rect x="14" y="38" width="80" height="6" fill="#2A2F36"/>
      <rect x="14" y="50" width="40" height="3" fill="#A7ADB6"/>
      <rect x="14" y="72" width="120" height="60" fill="#B5532C"/>
      <rect x="140" y="72" width="120" height="14" fill="#E8E2D5"/>
      <rect x="140" y="92" width="120" height="14" fill="#E8E2D5"/>
      <rect x="140" y="112" width="100" height="14" fill="#E8E2D5"/>
    </svg>
  );
}

function CivicThumb() {
  return (
    <svg viewBox="0 0 280 160" width="100%" height="100%" preserveAspectRatio="none">
      <rect width="280" height="160" fill="#FBF9F4"/>
      <rect x="0" y="0" width="280" height="20" fill="#2A2F36"/>
      {/* KPIs */}
      <rect x="14" y="34" width="76" height="40" fill="#E8E2D5"/>
      <rect x="98" y="34" width="76" height="40" fill="#E8E2D5"/>
      <rect x="182" y="34" width="84" height="40" fill="#E8E2D5"/>
      {/* Map */}
      <rect x="14" y="82" width="160" height="62" fill="#D9D2C2"/>
      <polygon points="40,100 70,90 100,110 130,98 160,118 130,135 80,140 40,125" fill="#5D8A85" opacity=".7"/>
      {/* legend */}
      <rect x="182" y="82" width="84" height="6" fill="#5D8A85"/>
      <rect x="182" y="96" width="84" height="6" fill="#B5532C"/>
      <rect x="182" y="110" width="84" height="6" fill="#2A2F36"/>
    </svg>
  );
}

function AnalyticsThumb() {
  return (
    <svg viewBox="0 0 280 160" width="100%" height="100%" preserveAspectRatio="none">
      <rect width="280" height="160" fill="#FBF9F4"/>
      <rect x="0" y="0" width="280" height="20" fill="#2A2F36"/>
      {/* chart area */}
      <line x1="14" y1="130" x2="266" y2="130" stroke="#D9D2C2"/>
      <line x1="14" y1="98"  x2="266" y2="98"  stroke="#D9D2C2" strokeDasharray="2 3"/>
      <line x1="14" y1="66"  x2="266" y2="66"  stroke="#D9D2C2" strokeDasharray="2 3"/>
      {Array.from({length: 16}).map((_,i) => {
        const x = 18 + i * 16;
        const h = 16 + ((i * 7) % 60);
        return <rect key={i} x={x} y={130-h} width="10" height={h} fill="#B5532C"/>;
      })}
    </svg>
  );
}

function DocsThumb() {
  return (
    <svg viewBox="0 0 280 160" width="100%" height="100%" preserveAspectRatio="none">
      <rect width="280" height="160" fill="#FBF9F4"/>
      <rect x="0" y="0" width="280" height="20" fill="#2A2F36"/>
      {/* TOC sidebar */}
      <rect x="0" y="20" width="68" height="140" fill="#E8E2D5"/>
      <rect x="10" y="36" width="48" height="3" fill="#2A2F36"/>
      <rect x="10" y="46" width="40" height="3" fill="#A7ADB6"/>
      <rect x="10" y="56" width="44" height="3" fill="#A7ADB6"/>
      <rect x="10" y="66" width="40" height="3" fill="#A7ADB6"/>
      {/* content */}
      <rect x="84" y="38" width="120" height="8" fill="#2A2F36"/>
      <rect x="84" y="56" width="160" height="4" fill="#A7ADB6"/>
      <rect x="84" y="64" width="170" height="4" fill="#A7ADB6"/>
      <rect x="84" y="72" width="140" height="4" fill="#A7ADB6"/>
      <rect x="84" y="90" width="170" height="50" fill="#E8E2D5"/>
    </svg>
  );
}

const sgStyles = {
  section: { padding: "96px 0", borderBottom: "1px solid var(--rule)" },
  inner: { maxWidth: 1280, margin: "0 auto", padding: "0 32px" },
  header: { marginBottom: 56, maxWidth: 680 },
  h2: {
    fontFamily: "var(--font-display)",
    fontWeight: 500,
    fontSize: 44,
    letterSpacing: "-0.015em",
    margin: "12px 0 16px",
    color: "var(--fg)",
  },
  lede: {
    fontFamily: "var(--font-sans)",
    fontSize: 17,
    lineHeight: 1.55,
    color: "var(--fg-muted)",
    margin: 0,
    maxWidth: 620,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 1,
    background: "var(--rule)",
    border: "1px solid var(--rule)",
  },
  tile: {
    background: "var(--bg-raised)",
    padding: 32,
    display: "flex",
    flexDirection: "column",
    gap: 24,
  },
  thumbWrap: {
    aspectRatio: "280 / 160",
    border: "1px solid var(--rule)",
    background: "var(--bg-sunken)",
  },
  tileMeta: { display: "flex", flexDirection: "column", gap: 4 },
  tileSlug: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontFamily: "var(--font-mono)",
    fontSize: 13,
    color: "var(--fg)",
  },
  tileKind: {
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--fg-subtle)",
  },
  tileNote: {
    fontFamily: "var(--font-sans)",
    fontSize: 14,
    lineHeight: 1.5,
    color: "var(--fg-muted)",
    margin: "10px 0 0",
  },
};

Object.assign(window, { SurfacesGrid, RadioThumb, CivicThumb, AnalyticsThumb, DocsThumb });
