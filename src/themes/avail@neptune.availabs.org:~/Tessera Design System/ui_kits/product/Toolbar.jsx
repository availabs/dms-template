// Toolbar.jsx — secondary bar under the page header. Filter, sort, view toggle.

function Toolbar({ tabs = [], active, onTab, search, onSearch, right }) {
  return (
    <div style={tbStyles.bar}>
      <div style={tbStyles.left}>
        {tabs.length > 0 && (
          <div style={tbStyles.tabs} role="tablist">
            {tabs.map(t => (
              <button
                key={t.id}
                role="tab"
                aria-selected={t.id === active}
                onClick={() => onTab && onTab(t.id)}
                style={{
                  ...tbStyles.tab,
                  color: t.id === active ? "var(--fg)" : "var(--fg-muted)",
                  borderBottom: t.id === active ? "1px solid var(--fg)" : "1px solid transparent",
                }}
              >
                {t.label}
                {t.count != null && <span style={tbStyles.tabCount}>{t.count}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
      <div style={tbStyles.right}>
        {onSearch && (
          <div style={tbStyles.search}>
            <i data-lucide="search" style={{ width: 12, height: 12, color: "var(--fg-subtle)" }}></i>
            <input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Search patterns" style={tbStyles.input} />
          </div>
        )}
        {right}
      </div>
    </div>
  );
}

const tbStyles = {
  bar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "stretch",
    borderBottom: "1px solid var(--rule)",
    background: "var(--bg)",
  },
  left: { display: "flex" },
  tabs: { display: "flex", gap: 4, padding: "0 16px" },
  tab: {
    background: "transparent",
    border: 0,
    fontFamily: "var(--font-sans)",
    fontSize: 13,
    color: "var(--fg-muted)",
    padding: "12px 4px",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    marginRight: 16,
    marginBottom: -1,
  },
  tabCount: {
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    color: "var(--fg-subtle)",
    fontVariantNumeric: "tabular-nums",
    background: "var(--bg-sunken)",
    padding: "1px 5px",
    borderRadius: 2,
  },
  right: { display: "flex", alignItems: "center", gap: 8, padding: "8px 16px" },
  search: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    border: "1px solid var(--rule)",
    background: "var(--bg-raised)",
    borderRadius: 2,
    padding: "5px 10px",
    width: 200,
  },
  input: {
    border: 0,
    outline: "none",
    background: "transparent",
    fontFamily: "var(--font-sans)",
    fontSize: 12,
    color: "var(--fg)",
    width: "100%",
  },
};

Object.assign(window, { Toolbar });
