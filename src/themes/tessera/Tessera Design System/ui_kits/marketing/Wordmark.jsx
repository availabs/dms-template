// Wordmark.jsx — inline-SVG version of the Tessera wordmark.
// Uses currentColor so it inherits color from its parent.

function Wordmark({ size = 28, accent = "#B5532C", color = "currentColor" }) {
  // viewBox 460 96 — 4.79:1 ratio
  const w = size * 4.79;
  return (
    <svg
      viewBox="0 0 460 96"
      width={w}
      height={size}
      fill="none"
      aria-label="Tessera"
      role="img"
    >
      <rect x="20" y="32" width="32" height="32" fill={accent} />
      <text
        x="68"
        y="64"
        fontFamily='"Newsreader", "Tiempos Headline", Georgia, serif'
        fontWeight="500"
        fontSize="56"
        letterSpacing="-0.012em"
        fill={color}
      >
        Tessera
      </text>
    </svg>
  );
}

function Monogram({ size = 24, color = "currentColor", accent }) {
  return (
    <svg viewBox="0 0 96 96" width={size} height={size} fill="none" aria-hidden="true">
      <rect x="14" y="14" width="18" height="18" fill={color} />
      <rect x="34" y="14" width="18" height="18" fill={accent || color} />
      <rect x="54" y="14" width="18" height="18" fill={color} />
      <rect x="34" y="34" width="18" height="18" fill={color} />
      <rect x="34" y="54" width="18" height="18" fill={color} />
    </svg>
  );
}

Object.assign(window, { Wordmark, Monogram });
