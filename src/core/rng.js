/**
 * mulberry32 — small seeded generator. Same seed, same stream.
 * All gameplay randomness goes through this generator.
 */
export function createRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range(min, max) {
      return min + (max - min) * next();
    },
    int(min, maxInclusive) {
      const span = maxInclusive - min + 1;
      return min + Math.floor(next() * span);
    },
    sign() {
      return next() < 0.5 ? -1 : 1;
    },
    pick(items) {
      return items[Math.floor(next() * items.length)];
    },
  };
}
