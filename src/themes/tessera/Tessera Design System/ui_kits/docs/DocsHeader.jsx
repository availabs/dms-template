// DocsHeader.jsx
function DocsHeader() {
  return (
    <header style={dhStyles.bar}>
      <div style={dhStyles.inner}>
        <a href="#" style={dhStyles.brand}>
          <Wordmark size={22} />
          <span style={dhStyles.docsLabel}>Docs</span>
        </a>
        <nav style={dhStyles.nav}>
          <a href="#" style={dhStyles.link}>Guides</a>
          <a href="#" style={{ ...dhStyles.link, color: "var(--fg)", borderBottom: "1px solid var(--fg)" }}>Reference</a>
          <a href="#" style={dhStyles.link}>Patterns</a>
          <a href="#" style={dhStyles.link}>Theory</a>
        </nav>
        <div style={dhStyles.right}>
          <span style={dhStyles.version}>v0.14.2</span>
          <a href="#" style={dhStyles.search}>
            <i data-lucide="search" style={{ width: 12, height: 12 }}></i>
            <span>Search&hellip;</span>
            <span style={dhStyles.kbd}>/</span>
          </a>
        </div>
      </div>
    </header>
  );
}

const dhStyles = {
  bar: {
    background: "var(--bg)",
    borderBottom: "1px solid var(--rule)",
    position: "sticky",
    top: 0,
    zIndex: 5,
  },
  inner: {
    maxWidth: 1280,
    margin: "0 auto",
    padding: "14px 32px",
    display: "grid",
    gridTemplateColumns: "auto 1fr auto",
    alignItems: "center",
    gap: 48,
  },
  brand: { display: "inline-flex", alignItems: "center", gap: 12, textDecoration: "none", color: "var(--fg)" },
  docsLabel: {
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    color: "var(--fg-muted)",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    paddingLeft: 12,
    borderLeft: "1px solid var(--rule)",
  },
  nav: { display: "flex", gap: 24 },
  link: {
    fontFamily: "var(--font-sans)",
    fontSize: 14,
    fontWeight: 500,
    color: "var(--fg-muted)",
    textDecoration: "none",
    padding: "4px 0",
  },
  right: { display: "flex", alignItems: "center", gap: 16 },
  version: {
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    color: "var(--fg-muted)",
    border: "1px solid var(--rule)",
    padding: "3px 8px",
    borderRadius: 2,
  },
  search: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    border: "1px solid var(--rule)",
    background: "var(--bg-raised)",
    padding: "5px 10px 5px 12px",
    width: 220,
    fontFamily: "var(--font-sans)",
    fontSize: 12,
    color: "var(--fg-subtle)",
    textDecoration: "none",
    borderRadius: 2,
  },
  kbd: {
    marginLeft: "auto",
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    border: "1px solid var(--rule)",
    padding: "0 5px",
    background: "var(--bg)",
    color: "var(--fg-muted)",
  },
};

Object.assign(window, { DocsHeader });
