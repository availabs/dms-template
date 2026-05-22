// MarketingFooter.jsx — broad index of the site, set in mono.

function MarketingFooter() {
  const groups = [
    {
      label: "Product",
      links: ["Overview", "Patterns", "Themes", "Datasets", "Roadmap"],
    },
    {
      label: "Hosted",
      links: ["Pricing", "Civic plan", "Press plan", "Status", "Security"],
    },
    {
      label: "Open source",
      links: ["GitHub", "Releases", "Contributing", "License", "Acknowledgements"],
    },
    {
      label: "Theory",
      links: ["On placing", "Representation primacy", "Durability", "Field notes"],
    },
    {
      label: "Community",
      links: ["Forum", "Office hours", "Showcase", "Letters", "Mastodon"],
    },
  ];

  return (
    <footer style={fStyles.footer}>
      <div style={fStyles.inner}>
        <div style={fStyles.top}>
          <div style={fStyles.brandCol}>
            <Wordmark size={26} />
            <p style={fStyles.tag}>
              A typed row that can be a page, a section, a dataset, a query,
              or a theme.
            </p>
          </div>

          <div style={fStyles.linkGrid}>
            {groups.map((g) => (
              <div key={g.label}>
                <div className="designator-mono" style={{ marginBottom: 14 }}>{g.label}</div>
                <ul style={fStyles.list}>
                  {g.links.map((l) => (
                    <li key={l} style={{ marginBottom: 8 }}>
                      <a href="#" style={fStyles.link}>{l}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div style={fStyles.frieze}>
          <img src="../../assets/patterns/cosmati-frieze.svg" alt="" style={{ display: "block", width: "100%", height: 36 }} />
        </div>

        <div style={fStyles.bottom}>
          <div style={fStyles.colophon}>
            Tessera is open source, AGPL-3.0. The hosted service is operated
            by an independent cooperative.
          </div>
          <div style={fStyles.meta}>
            <span>v0.1 preview</span>
            <span>·</span>
            <span>2026</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

const fStyles = {
  footer: {
    background: "var(--bg)",
    borderTop: "1px solid var(--rule)",
    paddingTop: 80,
    paddingBottom: 48,
  },
  inner: { maxWidth: 1280, margin: "0 auto", padding: "0 32px" },
  top: {
    display: "grid",
    gridTemplateColumns: "1fr 2.2fr",
    gap: 64,
    marginBottom: 64,
  },
  brandCol: { display: "flex", flexDirection: "column", gap: 16, maxWidth: 280 },
  tag: {
    fontFamily: "var(--font-display)",
    fontStyle: "italic",
    fontSize: 16,
    lineHeight: 1.5,
    color: "var(--fg-muted)",
    margin: 0,
  },
  linkGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: 32,
  },
  list: { listStyle: "none", padding: 0, margin: 0 },
  link: {
    fontFamily: "var(--font-sans)",
    fontSize: 14,
    color: "var(--fg)",
    textDecoration: "none",
  },
  frieze: { marginBottom: 32, opacity: 0.45 },
  bottom: {
    display: "flex",
    justifyContent: "space-between",
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    color: "var(--fg-muted)",
    letterSpacing: "0.04em",
  },
  colophon: { maxWidth: 480 },
  meta: { display: "flex", gap: 8 },
};

Object.assign(window, { MarketingFooter });
