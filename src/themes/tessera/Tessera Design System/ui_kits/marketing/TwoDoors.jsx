// TwoDoors.jsx — the WordPress.org / WordPress.com fork. Two side-by-side
// surfaces, equal weight, square-cornered. The brief calls this "two doors."

function TwoDoors() {
  return (
    <section style={tdStyles.section}>
      <div style={tdStyles.inner}>
        <header style={tdStyles.header}>
          <div className="designator-mono">Two doors</div>
          <h2 style={tdStyles.h2}>Run it yourself, or let us run it.</h2>
        </header>

        <div style={tdStyles.grid}>
          <Door
            kind="Self-host"
            title="Tessera, open."
            blurb="Download the engine. Bring your own Postgres. Compose against the same primitives the hosted service uses — no feature gates."
            cta="Host your own"
            attrs={[
              ["Engine",    "AGPL-3.0"],
              ["Themes",    "MIT"],
              ["DB",        "Postgres 14+"],
              ["Deploy",    "Docker / systemd"],
            ]}
          />
          <Door
            kind="Hosted"
            title="Tessera, run."
            blurb="The same engine, on our infrastructure. Backups, CDN, edge caching, custom domains. For when you'd rather place tiles than configure servers."
            cta="See pricing"
            accent="oxide"
            attrs={[
              ["Plan",      "Starter / Civic / Press"],
              ["Region",    "US-EAST · EU-WEST"],
              ["Backups",   "Daily, 30d retention"],
              ["SLA",       "99.9% · audit on request"],
            ]}
          />
        </div>
      </div>
    </section>
  );
}

function Door({ kind, title, blurb, cta, attrs, accent }) {
  return (
    <div style={tdStyles.door}>
      <div style={tdStyles.doorHeader}>
        <span className={accent === "oxide" ? "badge badge-accent" : "badge"}>{kind}</span>
      </div>
      <h3 style={tdStyles.doorTitle}>{title}</h3>
      <p style={tdStyles.doorBlurb}>{blurb}</p>

      <dl style={tdStyles.dl}>
        {attrs.map(([k, v]) => (
          <div key={k} style={tdStyles.dlRow}>
            <dt style={tdStyles.dt}>{k}</dt>
            <dd style={tdStyles.dd}>{v}</dd>
          </div>
        ))}
      </dl>

      <a href="#" className="btn btn-secondary" style={{ borderRadius: 2, marginTop: 24, alignSelf: "flex-start" }}>
        {cta}
        <ArrowRight />
      </a>
    </div>
  );
}

const tdStyles = {
  section: { padding: "96px 0", borderBottom: "1px solid var(--rule)" },
  inner: { maxWidth: 1280, margin: "0 auto", padding: "0 32px" },
  header: { marginBottom: 48 },
  h2: {
    fontFamily: "var(--font-display)",
    fontWeight: 500,
    fontSize: 44,
    letterSpacing: "-0.015em",
    margin: "12px 0 0",
    color: "var(--fg)",
    maxWidth: 720,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 1,
    background: "var(--rule)",
    border: "1px solid var(--rule)",
  },
  door: {
    background: "var(--bg-raised)",
    padding: 48,
    display: "flex",
    flexDirection: "column",
    minHeight: 380,
  },
  doorHeader: { marginBottom: 20 },
  doorTitle: {
    fontFamily: "var(--font-display)",
    fontWeight: 500,
    fontSize: 36,
    letterSpacing: "-0.012em",
    margin: 0,
    color: "var(--fg)",
  },
  doorBlurb: {
    fontFamily: "var(--font-sans)",
    fontSize: 16,
    lineHeight: 1.55,
    color: "var(--fg-muted)",
    marginTop: 16,
    maxWidth: 460,
  },
  dl: {
    marginTop: 32,
    marginBottom: 0,
    paddingTop: 16,
    borderTop: "1px solid var(--rule)",
  },
  dlRow: {
    display: "grid",
    gridTemplateColumns: "120px 1fr",
    padding: "8px 0",
    borderBottom: "1px solid var(--rule)",
  },
  dt: {
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--fg-subtle)",
    margin: 0,
  },
  dd: {
    fontFamily: "var(--font-sans)",
    fontSize: 14,
    color: "var(--fg)",
    margin: 0,
  },
};

Object.assign(window, { TwoDoors });
