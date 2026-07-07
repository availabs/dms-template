// CodeBlock.jsx
function CodeBlock({ caption, language, children }) {
  return (
    <figure style={cbStyles.fig}>
      <pre style={cbStyles.pre}><code>{children}</code></pre>
      {(caption || language) && (
        <figcaption style={cbStyles.cap}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-subtle)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {language || "code"}
          </span>
          {caption && <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--fg-muted)" }}>{caption}</span>}
        </figcaption>
      )}
    </figure>
  );
}

const cbStyles = {
  fig: { margin: "16px 0 24px" },
  pre: {
    fontFamily: "var(--font-mono)",
    fontSize: 13,
    lineHeight: 1.55,
    background: "var(--bg-sunken)",
    border: "1px solid var(--rule)",
    padding: "16px 20px",
    margin: 0,
    overflowX: "auto",
    fontVariantNumeric: "tabular-nums",
    color: "var(--fg)",
    whiteSpace: "pre",
  },
  cap: {
    marginTop: 8,
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
  },
};

Object.assign(window, { CodeBlock });
