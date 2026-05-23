// OnThisPage.jsx — right rail.
function OnThisPage({ items, active }) {
  return (
    <aside style={otpStyles.aside}>
      <div className="designator-mono">On this page</div>
      <ul style={otpStyles.ul}>
        {items.map((it) => (
          <li key={it.id} style={{ paddingLeft: (it.depth - 2) * 12 }}>
            <a href={`#${it.id}`} style={{
              ...otpStyles.link,
              color: it.id === active ? "var(--fg)" : "var(--fg-muted)",
              borderLeft: it.id === active ? "1px solid var(--fg)" : "1px solid transparent",
            }}>
              {it.label}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}

const otpStyles = {
  aside: { width: 200, flexShrink: 0, padding: "32px 0 32px 16px" },
  ul: { listStyle: "none", padding: 0, margin: "12px 0 0", display: "flex", flexDirection: "column", gap: 1 },
  link: {
    display: "block",
    fontFamily: "var(--font-sans)",
    fontSize: 12,
    color: "var(--fg-muted)",
    textDecoration: "none",
    padding: "5px 0 5px 12px",
    lineHeight: 1.4,
  },
};

Object.assign(window, { OnThisPage });
