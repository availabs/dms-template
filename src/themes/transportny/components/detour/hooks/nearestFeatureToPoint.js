// Plain helper (no React) - among a set of LineString features (already matched by a tolerance-
// box queryRenderedFeatures call), finds the one whose geometry passes closest to `point` in
// SCREEN PIXELS (not map/geo distance - this is what makes the pick tolerance zoom-independent).
// `project` is map.project bound to the caller's map instance.
const pointToSegmentDistSq = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return (px - ax) ** 2 + (py - ay) ** 2;
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx, cy = ay + t * dy;
  return (px - cx) ** 2 + (py - cy) ** 2;
};

export function nearestFeatureToPoint(features, point, project) {
  let best = null;
  let bestDistSq = Infinity;
  for (const feature of features) {
    const coords = feature.geometry.coordinates;
    for (let i = 0; i < coords.length - 1; i++) {
      const a = project(coords[i]);
      const b = project(coords[i + 1]);
      const d = pointToSegmentDistSq(point.x, point.y, a.x, a.y, b.x, b.y);
      if (d < bestDistSq) { bestDistSq = d; best = feature; }
    }
  }
  return best;
}
