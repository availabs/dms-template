// ProofPoints.jsx — quiet proof. No logo wall, no rotating carousel.
// Three short statements set in display serif with mono attribution.
// "Considered, precise, slightly archaic vocabulary."

function ProofPoints() {
  const points = [
    {
      quote:
        "We replaced a hand-tooled CMS, an analytics dashboard, and a static-site\u00a0generator with a single Tessera instance. The data didn't move; only the\u00a0renderings did.",
      who:   "Maintainer · State of New York, environmental data",
    },
    {
      quote:
        "Our pages and our datasets used to drift. Now they're the same row,\u00a0read two ways.",
      who:   "Engineer · campus radio collective, Albany",
    },
    {
      quote:
        "The team that ships our reference site uses the same engine the\u00a0library uses to publish the archive. We compose against shared\u00a0primitives.",
      who:   "Research lead · municipal archives",
    },
  ];

  return (
    <section style={ppStyles.section}>
      <div style={ppStyles.inner}>
        <div className="designator-mono">In use</div>
        <div style={ppStyles.grid}>
          {points.map((p, i) => (
            <figure key={i} style={ppStyles.fig}>
              <blockquote style={ppStyles.quote}>
                <span style={ppStyles.mark}>&ldquo;</span>{p.quote}
              </blockquote>
              <figcaption style={ppStyles.cite}>{p.who}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

const ppStyles = {
  section: { padding: "96px 0", borderBottom: "1px solid var(--rule)" },
  inner: { maxWidth: 1280, margin: "0 auto", padding: "0 32px" },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 48,
    marginTop: 40,
  },
  fig: { margin: 0, display: "flex", flexDirection: "column", gap: 24 },
  quote: {
    fontFamily: "var(--font-display)",
    fontStyle: "italic",
    fontWeight: 400,
    fontSize: 20,
    lineHeight: 1.45,
    color: "var(--fg)",
    margin: 0,
    textWrap: "pretty",
    position: "relative",
  },
  mark: {
    color: "var(--color-oxide)",
    fontWeight: 400,
    paddingRight: 2,
  },
  cite: {
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--fg-muted)",
    borderTop: "1px solid var(--rule)",
    paddingTop: 14,
  },
};

Object.assign(window, { ProofPoints });
