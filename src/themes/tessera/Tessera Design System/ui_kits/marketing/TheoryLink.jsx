// TheoryLink.jsx — invitation block pointing to the long-form "Theory" page.
// Single column, generous space, no image.

function TheoryLink() {
  return (
    <section style={tlStyles.section}>
      <div style={tlStyles.inner}>
        <div className="designator-mono">Theory</div>
        <h2 style={tlStyles.h2}>
          <em>On placing</em> &mdash; an essay on why a typed row is
          the right primitive for a data-driven site.
        </h2>
        <p style={tlStyles.lede}>
          A long-form companion to the documentation. Roman and Byzantine
          craftsmen spent careers placing tesserae one at a time into floors
          that lasted millennia. We think the same care belongs in the
          construction of a public dashboard or a civic data site. Read the
          full argument.
        </p>
        <a href="theory.html" style={tlStyles.cta}>
          Read &ldquo;On placing&rdquo;
          <ArrowRight />
        </a>
      </div>
    </section>
  );
}

const tlStyles = {
  section: {
    padding: "96px 0",
    borderBottom: "1px solid var(--rule)",
    background: "var(--color-limestone)",
  },
  inner: { maxWidth: 720, margin: "0 auto", padding: "0 32px" },
  h2: {
    fontFamily: "var(--font-display)",
    fontWeight: 400,
    fontSize: 40,
    lineHeight: 1.18,
    letterSpacing: "-0.012em",
    margin: "12px 0 24px",
    color: "var(--fg)",
    textWrap: "balance",
  },
  lede: {
    fontFamily: "var(--font-specimen)",
    fontStyle: "normal",
    fontSize: 19,
    lineHeight: 1.55,
    color: "var(--fg)",
    margin: 0,
    maxWidth: 620,
  },
  cta: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    marginTop: 28,
    fontFamily: "var(--font-sans)",
    fontSize: 14,
    fontWeight: 500,
    color: "var(--fg)",
    textDecoration: "none",
    borderBottom: "1px solid var(--fg)",
    paddingBottom: 2,
  },
};

Object.assign(window, { TheoryLink });
