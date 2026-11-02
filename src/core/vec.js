export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function hypot(x, y) {
  return Math.hypot(x, y);
}

/** Unit vector, or a zero vector when the input is tiny. */
export function norm(x, y) {
  const l = Math.hypot(x, y);
  if (l < 1e-8) return { x: 0, y: 0, l: 0 };
  return { x: x / l, y: y / l, l };
}

export function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
