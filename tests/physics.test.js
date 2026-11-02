import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ARENA, ROBOT_RADIUS, SCRAP_DAMAGE_MIN_SPEED } from '../src/core/constants.js';
import { damageForSpeed, separatePair } from '../src/core/physics.js';

describe('scrap damage', () => {
  it('is zero below the speed threshold and grows with speed', () => {
    assert.equal(damageForSpeed(0), 0);
    assert.equal(damageForSpeed(SCRAP_DAMAGE_MIN_SPEED - 1), 0);
    const slow = damageForSpeed(SCRAP_DAMAGE_MIN_SPEED + 20);
    const fast = damageForSpeed(500);
    assert.ok(slow > 0);
    assert.ok(fast > slow);
    assert.ok(fast <= 58);
  });
});

describe('circle separation', () => {
  it('pushes overlapping robots out to the contact distance', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 10, y: 0 };
    assert.equal(separatePair(a, b, ROBOT_RADIUS, ROBOT_RADIUS), true);
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    assert.ok(Math.abs(d - ROBOT_RADIUS * 2) < 1e-6);
  });

  it('leaves separated circles alone', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 80, y: 0 };
    assert.equal(separatePair(a, b, ROBOT_RADIUS, ROBOT_RADIUS), false);
    assert.equal(a.x, 0);
    assert.equal(b.x, 80);
  });
});

describe('arena', () => {
  it('is large enough for four spawns inside the crusher walls', () => {
    assert.ok(ARENA.w > 400);
    assert.ok(ARENA.h > 300);
  });
});
