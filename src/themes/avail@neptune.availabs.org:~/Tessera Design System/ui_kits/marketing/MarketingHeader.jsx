// MarketingHeader.jsx
// Slim top bar — wordmark on the left, sparse nav, two doors on the right.
// No search input (per brief, no in-page utilities cluttering marketing).

function MarketingHeader({ active = "product" }) {
  const items = [
    { id: "product",  label: "Product" },
    { id: "patterns", label: "Patterns" },
    { id: "hosted",   label: "Hosted" },
    { id: "theory",   label: "Theory" },
    { id: "docs",     label: "Docs" },
  ];
  return (
    <header style={mhStyles.bar}>
      <div style={mhStyles.inner}>
        <a href="#" style={mhStyles.brand} aria-label="Tessera home">
          <Wordmark size={26} />
        </a>
        <nav style={mhStyles.nav}>
          {items.map(i => (
            <a key={i.id} href="#" style={{
              ...mhStyles.link,
              color: i.id === active ? "var(--fg)" : "var(--fg-muted)",
              borderBottom: i.id === active ? "1px solid var(--fg)" : "1px solid transparent",
            }}>
              {i.label}
            </a>
          ))}
        </nav>
        <div style={mhStyles.actions}>
          <a href="#" style={mhStyles.linkPlain}>Sign in</a>
          <a href="#" className="btn btn-primary btn-sm" style={{ borderRadius: 2 }}>Get started</a>
        </div>
      </div>
    </header>
  );
}

const mhStyles = {
  bar: {
    background: "var(--bg)",
    borderBottom: "1px solid var(--rule)",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  inner: {
    maxWidth: 1280,
    margin: "0 auto",
    padding: "16px 32px",
    display: "grid",
    gridTemplateColumns: "auto 1fr auto",
    alignItems: "center",
    gap: 48,
  },
  brand: { display: "flex", textDecoration: "none", color: "var(--fg)" },
  nav: { display: "flex", gap: 28, justifyContent: "center" },
  link: {
    fontFamily: "var(--font-sans)",
    fontSize: 14,
    fontWeight: 500,
    color: "var(--fg-muted)",
    textDecoration: "none",
    padding: "4px 0",
    transition: "color 100ms",
  },
  linkPlain: {
    fontFamily: "var(--font-sans)",
    fontSize: 14,
    color: "var(--fg)",
    textDecoration: "none",
  },
  actions: { display: "flex", alignItems: "center", gap: 18 },
};

Object.assign(window, { MarketingHeader });
