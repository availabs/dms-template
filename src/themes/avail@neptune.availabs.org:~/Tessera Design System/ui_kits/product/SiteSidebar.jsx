// SiteSidebar.jsx — left rail listing the parts of a site:
// patterns (sections), datasets, themes, settings.
// The single source of truth for navigation inside a site.

function SiteSidebar({ active = "patterns" }) {
  const groups = [
    {
      label: "Compose",
      items: [
        { id: "patterns", label: "Patterns",  count: 18, icon: "table" },
        { id: "pages",    label: "Pages",     count: 42, icon: "file-text" },
        { id: "blocks",   label: "Blocks",    count:  7, icon: "square" },
      ],
    },
    {
      label: "Data",
      items: [
        { id: "datasets", label: "Datasets",  count:  9, icon: "database" },
        { id: "queries",  label: "Queries",   count: 14, icon: "filter" },
        { id: "joins",    label: "Joins",     count:  3, icon: "link-2" },
      ],
    },
    {
      label: "Render",
      items: [
        { id: "theme",    label: "Theme",     icon: "layout-grid" },
        { id: "maps",     label: "Map styles",  count:  2, icon: "map" },
        { id: "charts",   label: "Chart palette", icon: "bar-chart-3" },
      ],
    },
    {
      label: "Operate",
      items: [
        { id: "publish",  label: "Publish queue", count: 1, icon: "external-link", flag: "live" },
        { id: "history",  label: "History",    icon: "archive" },
        { id: "settings", label: "Settings",   icon: "settings" },
      ],
    },
  ];

  return (
    <aside style={ssStyles.aside}>
      <div style={ssStyles.inner}>
        {groups.map((g) => (
          <div key={g.label} style={ssStyles.group}>
            <div className="designator-mono" style={{ padding: "0 12px 8px" }}>{g.label}</div>
            {g.items.map((it) => (
              <a key={it.id} href="#" style={{
                ...ssStyles.item,
                background: it.id === active ? "var(--bg-sunken)" : "transparent",
                color: it.id === active ? "var(--fg)" : "var(--fg-muted)",
                fontWeight: it.id === active ? 500 : 400,
              }}>
                <i data-lucide={it.icon} style={{ width: 14, height: 14, strokeWidth: 1.5 }}></i>
                <span style={{ flex: 1 }}>{it.label}</span>
                {it.flag === "live" && <span className="badge badge-accent" style={{ fontSize: 9, padding: "2px 6px" }}>LIVE</span>}
                {it.count != null && (
                  <span style={ssStyles.count}>{it.count}</span>
                )}
              </a>
            ))}
          </div>
        ))}

        <div style={ssStyles.footer}>
          <div style={ssStyles.footerRow}>
            <i data-lucide="terminal" style={{ width: 12, height: 12 }}></i>
            <span>tessera 0.14.2</span>
          </div>
          <div style={ssStyles.footerRow}>
            <i data-lucide="database" style={{ width: 12, height: 12 }}></i>
            <span>pg 16.1 · idle</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

const ssStyles = {
  aside: {
    width: 240,
    background: "var(--bg)",
    borderRight: "1px solid var(--rule)",
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
  },
  inner: {
    flex: 1,
    padding: "20px 8px",
    display: "flex",
    flexDirection: "column",
    gap: 20,
    overflowY: "auto",
  },
  group: { display: "flex", flexDirection: "column", gap: 2 },
  item: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontFamily: "var(--font-sans)",
    fontSize: 13,
    color: "var(--fg-muted)",
    textDecoration: "none",
    padding: "6px 12px",
    borderRadius: 2,
    transition: "background 100ms",
  },
  count: {
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    color: "var(--fg-subtle)",
    fontVariantNumeric: "tabular-nums",
  },
  footer: {
    marginTop: "auto",
    padding: "16px 12px",
    borderTop: "1px solid var(--rule)",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  footerRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    color: "var(--fg-subtle)",
    letterSpacing: "0.04em",
  },
};

Object.assign(window, { SiteSidebar });
