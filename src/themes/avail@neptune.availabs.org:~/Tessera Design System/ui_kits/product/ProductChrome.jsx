// ProductChrome.jsx — top bar shared by every product surface.
// Wordmark (small), site switcher, command, account.

function ProductChrome({ site = "wcdb.fm", section, children }) {
  return (
    <div style={pcStyles.shell}>
      <header style={pcStyles.top}>
        <div style={pcStyles.left}>
          <a href="#" style={pcStyles.brand} aria-label="Tessera">
            <Wordmark size={20} />
          </a>
          <div style={pcStyles.sep} />
          <SiteSwitcher site={site} />
          {section && (
            <>
              <ChevronRight />
              <div style={pcStyles.section}>{section}</div>
            </>
          )}
        </div>
        <div style={pcStyles.right}>
          <button style={pcStyles.iconBtn} aria-label="Search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.5"/><path d="M16 16l4 4" stroke="currentColor" strokeWidth="1.5"/></svg>
          </button>
          <button style={pcStyles.iconBtn} aria-label="Notifications">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 9a6 6 0 1 1 12 0v4l2 3H4l2-3V9z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="miter"/><path d="M10 19a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.5"/></svg>
          </button>
          <div style={pcStyles.who}>
            <div style={pcStyles.avatar}>MT</div>
          </div>
        </div>
      </header>
      <div style={pcStyles.main}>{children}</div>
    </div>
  );
}

function SiteSwitcher({ site }) {
  return (
    <button style={pcStyles.switcher}>
      <Monogram size={12} color="var(--color-oxide)" />
      <span>{site}</span>
      <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="square"/></svg>
    </button>
  );
}

function ChevronRight() {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" style={{ color: "var(--fg-subtle)" }}>
      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="square" strokeLinejoin="miter"/>
    </svg>
  );
}

const pcStyles = {
  shell: { minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)" },
  top: {
    height: 52,
    background: "var(--bg-raised)",
    borderBottom: "1px solid var(--rule)",
    padding: "0 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexShrink: 0,
  },
  left: { display: "flex", alignItems: "center", gap: 12 },
  right: { display: "flex", alignItems: "center", gap: 4 },
  brand: { display: "flex", color: "var(--fg)", textDecoration: "none", padding: "0 4px" },
  sep: { width: 1, height: 18, background: "var(--rule)", margin: "0 4px" },
  switcher: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    background: "transparent",
    border: "1px solid var(--rule)",
    borderRadius: 2,
    padding: "5px 10px",
    fontFamily: "var(--font-mono)",
    fontSize: 12,
    color: "var(--fg)",
    cursor: "pointer",
  },
  section: {
    fontFamily: "var(--font-sans)",
    fontSize: 13,
    color: "var(--fg)",
    fontWeight: 500,
  },
  iconBtn: {
    background: "transparent",
    border: 0,
    color: "var(--fg-muted)",
    padding: 8,
    cursor: "pointer",
    borderRadius: 2,
  },
  who: { paddingLeft: 8, marginLeft: 4, borderLeft: "1px solid var(--rule)" },
  avatar: {
    width: 28,
    height: 28,
    background: "var(--color-slate)",
    color: "var(--color-parchment)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    letterSpacing: "0.04em",
  },
  main: { flex: 1, display: "flex", minHeight: 0 },
};

Object.assign(window, { ProductChrome, ChevronRight });
