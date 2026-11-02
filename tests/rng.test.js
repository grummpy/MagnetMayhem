import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRng } from '../src/core/rng.js';

describe('seeded RNG', () => {
  it('repeats the same stream for the same seed', () => {
    const a = createRng(123456);
    const b = createRng(123456);
    const seqA = Array.from({ length: 8 }, () => a.next());
    const seqB = Array.from({ length: 8 }, () => b.next());
    assert.deepEqual(seqA, seqB);
    for (const n of seqA) {
      assert.ok(n >= 0 && n < 1);
    }
  });

  it('diverges for a different seed', () => {
    const a = createRng(1);
    const b = createRng(2);
    const seqA = Array.from({ length: 5 }, () => a.next());
    const seqB = Array.from({ length: 5 }, () => b.next());
    assert.notDeepEqual(seqA, seqB);
  });

  it('keeps int() inside the inclusive range', () => {
    const rng = createRng(99);
    for (let i = 0; i < 200; i++) {
      const n = rng.int(3, 7);
      assert.ok(n >= 3 && n <= 7);
      assert.equal(n, Math.floor(n));
    }
  });

  it('range() stays inside the requested span', () => {
    const rng = createRng(7);
    for (let i = 0; i < 50; i++) {
      const n = rng.range(-2, 4);
      assert.ok(n >= -2 && n < 4);
    }
  });
});
