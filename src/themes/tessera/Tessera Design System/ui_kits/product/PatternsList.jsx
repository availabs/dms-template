// PatternsList.jsx — list of section "patterns" composed in a site.
// Each pattern is a typed row; clicking opens the editor.

function PatternsList({ patterns, onOpen }) {
  return (
    <div style={plStyles.wrap}>
      <table className="tessera" style={{ background: "var(--bg-raised)" }}>
        <thead>
          <tr>
            <th style={{ width: 30 }}></th>
            <th>Pattern</th>
            <th>Renders as</th>
            <th>Dataset</th>
            <th className="num">Rows</th>
            <th className="num">Last placed</th>
            <th style={{ width: 30 }}></th>
          </tr>
        </thead>
        <tbody>
          {patterns.map((p, i) => (
            <tr key={p.id} onClick={() => onOpen && onOpen(p)} style={{ cursor: "pointer" }}>
              <td><span style={plStyles.ord}>{String(i + 1).padStart(2, "0")}</span></td>
              <td>
                <div style={plStyles.title}>{p.title}</div>
                <div style={plStyles.slug}>{p.slug}</div>
              </td>
              <td>
                <span className="badge" style={{ background: "transparent" }}>{p.renders}</span>
              </td>
              <td><span className="mono" style={{ fontSize: 12, color: "var(--fg-muted)" }}>{p.dataset || "—"}</span></td>
              <td className="num">{p.rows != null ? p.rows.toLocaleString("en-US") : "—"}</td>
              <td className="num"><span style={{ color: "var(--fg-muted)" }}>{p.placed}</span></td>
              <td>
                <i data-lucide="chevron-right" style={{ width: 14, height: 14, color: "var(--fg-subtle)" }}></i>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const plStyles = {
  wrap: { border: "1px solid var(--rule)", background: "var(--bg-raised)" },
  title: { fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--fg)", fontWeight: 500 },
  slug: { fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-muted)" },
  ord: {
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    color: "var(--fg-subtle)",
    fontVariantNumeric: "tabular-nums",
  },
};

Object.assign(window, { PatternsList });
