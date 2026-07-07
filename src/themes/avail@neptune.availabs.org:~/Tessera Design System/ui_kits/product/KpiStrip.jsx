// KpiStrip.jsx — a row of small KPIs. Tabular figures, mono labels.

function KpiStrip({ kpis }) {
  return (
    <div style={ksStyles.strip}>
      {kpis.map((k, i) => (
        <div key={i} style={ksStyles.kpi}>
          <div style={ksStyles.label}>{k.label}</div>
          <div style={ksStyles.value}>{k.value}</div>
          {k.delta != null && (
            <div style={{
              ...ksStyles.delta,
              color: k.delta.startsWith("-") ? "var(--color-tile)" : "var(--color-verdigris)",
            }}>
              {k.delta}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const ksStyles = {
  strip: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    border: "1px solid var(--rule)",
    background: "var(--bg-raised)",
  },
  kpi: {
    padding: "20px 24px",
    borderRight: "1px solid var(--rule)",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  label: {
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    color: "var(--fg-muted)",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  },
  value: {
    fontFamily: "var(--font-display)",
    fontWeight: 500,
    fontSize: 32,
    letterSpacing: "-0.01em",
    color: "var(--fg)",
    fontVariantNumeric: "tabular-nums slashed-zero",
    lineHeight: 1.05,
  },
  delta: {
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    fontVariantNumeric: "tabular-nums",
    letterSpacing: "0.02em",
  },
};

Object.assign(window, { KpiStrip });
