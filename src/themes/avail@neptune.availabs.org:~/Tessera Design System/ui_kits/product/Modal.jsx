// EmptyState.jsx, Modal.jsx, Tooltip.jsx — small shared bits

function EmptyState({ title, body, action }) {
  return (
    <div style={esStyles.wrap}>
      <div style={esStyles.tile}></div>
      <div style={esStyles.title}>{title}</div>
      {body && <div style={esStyles.body}>{body}</div>}
      {action && <div style={{ marginTop: 24 }}>{action}</div>}
    </div>
  );
}
const esStyles = {
  wrap: {
    border: "1px dashed var(--color-grout-light)",
    background: "var(--bg-raised)",
    padding: "64px 32px",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
  },
  tile: { width: 18, height: 18, background: "var(--color-fog)", marginBottom: 8 },
  title: {
    fontFamily: "var(--font-display)",
    fontSize: 22,
    fontWeight: 500,
    letterSpacing: "-0.008em",
    color: "var(--fg)",
  },
  body: {
    fontFamily: "var(--font-sans)",
    fontSize: 14,
    color: "var(--fg-muted)",
    maxWidth: 440,
    lineHeight: 1.55,
  },
};

function Modal({ open, onClose, title, kicker, children, footer }) {
  if (!open) return null;
  return (
    <div style={mStyles.scrim} onClick={onClose}>
      <div style={mStyles.sheet} onClick={(e) => e.stopPropagation()}>
        <div style={mStyles.head}>
          <div>
            {kicker && <div className="designator-mono">{kicker}</div>}
            <div style={mStyles.title}>{title}</div>
          </div>
          <button style={mStyles.close} onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.4"/></svg>
          </button>
        </div>
        <div style={mStyles.body}>{children}</div>
        {footer && <div style={mStyles.footer}>{footer}</div>}
      </div>
    </div>
  );
}
const mStyles = {
  scrim: {
    position: "fixed", inset: 0,
    background: "rgba(42, 47, 54, 0.40)",
    display: "flex", alignItems: "flex-start", justifyContent: "center",
    paddingTop: "10vh", zIndex: 100,
  },
  sheet: {
    background: "var(--color-parchment)",
    border: "1px solid var(--rule)",
    boxShadow: "0 1px 2px rgba(42,47,54,0.04)",
    width: "min(560px, 92vw)",
    display: "flex",
    flexDirection: "column",
  },
  head: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: "20px 24px",
    borderBottom: "1px solid var(--rule)",
  },
  title: {
    fontFamily: "var(--font-display)",
    fontWeight: 500,
    fontSize: 22,
    letterSpacing: "-0.008em",
    marginTop: 4,
  },
  close: {
    background: "transparent", border: 0,
    color: "var(--fg-muted)", padding: 6, cursor: "pointer",
  },
  body: { padding: "20px 24px" },
  footer: {
    padding: "16px 24px",
    borderTop: "1px solid var(--rule)",
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
  },
};

Object.assign(window, { EmptyState, Modal });
