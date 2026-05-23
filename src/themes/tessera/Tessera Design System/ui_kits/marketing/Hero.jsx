// Hero.jsx — homepage hero. Display serif headline; restrained eyebrow;
// two doors (See it run / Host your own) per the brief sample copy.

function Hero() {
  return (
    <section style={heroStyles.section}>
      <div style={heroStyles.inner}>
        <div style={heroStyles.eyebrow}>
          <Monogram size={14} color="var(--color-oxide)" />
          <span>Tessera · v0.1 preview</span>
        </div>

        <h1 style={heroStyles.h1}>
          The shape of your data <br />
          is the shape of your site.
        </h1>

        <p style={heroStyles.lede}>
          One typed row that can be a page, a section, a dataset, a query, or a
          theme — and every part of the system composes against it.
        </p>

        <p style={heroStyles.meta}>
          Open-source. Self-host or use the hosted service.
        </p>

        <div style={heroStyles.doors}>
          <a href="#" className="btn btn-primary">
            See it run · wcdb.fm
            <ArrowRight />
          </a>
          <a href="#" className="btn btn-secondary">
            Host your own
            <ArrowRight />
          </a>
        </div>
      </div>

      {/* End-cap frieze — ornament earns its place by being small */}
      <div style={heroStyles.frieze}>
        <img src="../../assets/patterns/cosmati-frieze.svg" alt="" style={{ display: "block", width: 240, height: 48 }} />
      </div>
    </section>
  );
}

function ArrowRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="square" strokeLinejoin="miter"/>
    </svg>
  );
}

const heroStyles = {
  section: {
    paddingTop: 96,
    paddingBottom: 96,
    borderBottom: "1px solid var(--rule)",
    position: "relative",
  },
  inner: {
    maxWidth: 1280,
    margin: "0 auto",
    padding: "0 32px",
  },
  eyebrow: {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    color: "var(--fg-muted)",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    paddingBottom: 22,
    borderBottom: "1px solid transparent",
  },
  h1: {
    fontFamily: "var(--font-display)",
    fontWeight: 500,
    fontSize: 76,
    lineHeight: 1.04,
    letterSpacing: "-0.02em",
    color: "var(--fg)",
    margin: 0,
    maxWidth: 920,
    textWrap: "balance",
  },
  lede: {
    fontFamily: "var(--font-sans)",
    fontSize: 20,
    lineHeight: 1.55,
    color: "var(--fg-muted)",
    maxWidth: 620,
    marginTop: 32,
    marginBottom: 0,
  },
  meta: {
    fontFamily: "var(--font-mono)",
    fontSize: 12,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--fg-muted)",
    marginTop: 32,
  },
  doors: {
    display: "flex",
    gap: 12,
    marginTop: 16,
  },
  frieze: {
    position: "absolute",
    right: 32,
    bottom: 24,
    opacity: 0.5,
  },
};

Object.assign(window, { Hero, ArrowRight });
