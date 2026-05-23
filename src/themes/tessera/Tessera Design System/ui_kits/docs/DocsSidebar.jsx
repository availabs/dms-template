// DocsSidebar.jsx
function DocsSidebar({ active = "ref-patterns" }) {
  const tree = [
    {
      label: "Getting started",
      items: [
        ["intro",       "Introduction"],
        ["install",     "Install"],
        ["first-site",  "Your first site"],
        ["concepts",    "Core concepts"],
      ],
    },
    {
      label: "Reference",
      items: [
        ["ref-rows",     "Rows"],
        ["ref-patterns", "Patterns"],
        ["ref-datasets", "Datasets"],
        ["ref-themes",   "Themes"],
        ["ref-queries",  "Queries"],
      ],
    },
    {
      label: "Renderings",
      items: [
        ["ren-table",     "Table"],
        ["ren-calendar",  "Calendar"],
        ["ren-prose",     "Prose"],
        ["ren-chart",     "Chart"],
        ["ren-map",       "Map"],
      ],
    },
    {
      label: "Operations",
      items: [
        ["ops-deploy",   "Deploy"],
        ["ops-backup",   "Backup & restore"],
        ["ops-audit",    "Audit log"],
      ],
    },
  ];
  return (
    <aside style={dsStyles.aside}>
      <nav style={dsStyles.nav}>
        {tree.map((g) => (
          <div key={g.label} style={{ marginBottom: 20 }}>
            <div className="designator-mono" style={{ padding: "0 0 8px" }}>{g.label}</div>
            <ul style={dsStyles.ul}>
              {g.items.map(([id, label]) => (
                <li key={id}>
                  <a href="#" style={{
                    ...dsStyles.link,
                    color: id === active ? "var(--fg)" : "var(--fg-muted)",
                    fontWeight: id === active ? 500 : 400,
                    background: id === active ? "var(--bg-sunken)" : "transparent",
                  }}>
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}

const dsStyles = {
  aside: { width: 240, flexShrink: 0, padding: "32px 16px 32px 0" },
  nav: { position: "sticky", top: 80 },
  ul: { listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 1 },
  link: {
    display: "block",
    fontFamily: "var(--font-sans)",
    fontSize: 13,
    color: "var(--fg-muted)",
    textDecoration: "none",
    padding: "5px 10px",
    borderRadius: 2,
  },
};

Object.assign(window, { DocsSidebar });
