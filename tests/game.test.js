import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ARENA,
  BURST_SPEED,
  FLING_SPEED,
  MAX_HP,
  MAX_ORBIT,
  ROBOT_RADIUS,
  SCRAP_RADIUS,
  WALL_DPS,
} from '../src/core/constants.js';
import { addScrap, botInput, createMatch, step } from '../src/core/game.js';

const OFF = ['off', 'off', 'off', 'off'];

function solo(extra = {}) {
  return createMatch({
    seed: 1,
    phase: 'playing',
    autoSpawn: false,
    slots: ['human', 'off', 'off', 'off'],
    ...extra,
  });
}

function idle(partial = {}) {
  return { moveX: 0, moveY: 0, action: false, secondary: false, human: true, ...partial };
}

function place(robot, x, y) {
  robot.x = x;
  robot.y = y;
  robot.vx = 0;
  robot.vy = 0;
}

describe('movement and collision', () => {
  it('accelerates a robot in the input direction and faces that way', () => {
    const match = solo();
    const robot = match.robots[0];
    const start = robot.x;
    for (let i = 0; i < 60; i++) step(match, [idle({ moveX: 1 })]);
    assert.ok(robot.x > start + 40, `expected travel, x=${robot.x}`);
    assert.ok(Math.abs(robot.facing) < 0.25);
    assert.ok(robot.x >= ARENA.x + ROBOT_RADIUS - 0.01);
    assert.ok(robot.x <= ARENA.x + ARENA.w - ROBOT_RADIUS + 0.01);
  });

  it('does not move during the countdown', () => {
    const match = createMatch({
      seed: 2,
      autoSpawn: false,
      slots: ['human', 'off', 'off', 'off'],
    });
    assert.equal(match.phase, 'countdown');
    const start = match.robots[0].x;
    for (let i = 0; i < 20; i++) step(match, [idle({ moveX: 1 })]);
    assert.equal(match.robots[0].x, start);
    assert.equal(match.phase, 'countdown');
  });

  it('separates overlapping robots', () => {
    const match = createMatch({
      seed: 3,
      phase: 'playing',
      autoSpawn: false,
      slots: ['human', 'human', 'off', 'off'],
    });
    place(match.robots[0], 480, 280);
    place(match.robots[1], 490, 280);
    for (let i = 0; i < 8; i++) step(match, [idle(), idle()]);
    const d = Math.hypot(match.robots[0].x - match.robots[1].x, match.robots[0].y - match.robots[1].y);
    assert.ok(d >= ROBOT_RADIUS * 2 - 0.5, `distance ${d}`);
  });

  it('spawns nothing for an off seat', () => {
    const match = createMatch({
      phase: 'playing',
      autoSpawn: false,
      slots: ['human', 'off', 'off', 'bot'],
    });
    assert.deepEqual(match.robots.map((r) => r.id), [0, 3]);
    assert.equal(match.robots[1].isBot, true);
    assert.equal(match.robots.length, 2);
    assert.equal(OFF.length, 4);
  });
});

describe('polarity, orbit, fling, and burst', () => {
  it('attracts opposite scrap and repels matching scrap', () => {
    function gapAfter(polarity) {
      const match = solo();
      const robot = match.robots[0];
      place(robot, 480, 280);
      robot.polarity = 1;
      addScrap(match, { x: 560, y: 280, polarity });
      for (let i = 0; i < 50; i++) step(match, [idle()]);
      return Math.hypot(match.scraps[0].x - robot.x, match.scraps[0].y - robot.y);
    }
    const attracted = gapAfter(-1);
    const repelled = gapAfter(1);
    assert.ok(attracted < 70, `attract gap ${attracted}`);
    assert.ok(repelled > 90, `repel gap ${repelled}`);
  });

  it('pulls at most 3 opposite scraps into orbit while action is held', () => {
    const match = solo();
    const robot = match.robots[0];
    place(robot, 480, 280);
    robot.polarity = 1;
    for (let i = 0; i < 5; i++) {
      addScrap(match, { x: 480 + (i - 2) * 8, y: 300, polarity: -1 });
    }
    addScrap(match, { x: 488, y: 292, polarity: 1 });
    for (let i = 0; i < 20; i++) step(match, [idle({ action: true })]);
    assert.equal(robot.orbit.length, MAX_ORBIT);
    for (const id of robot.orbit) {
      const scrap = match.scraps.find((s) => s.id === id);
      assert.equal(scrap.polarity, -1);
      assert.equal(scrap.orbiting, robot.id);
    }
  });

  it('flings orbiting scrap along the facing direction when action is released', () => {
    const match = solo();
    const robot = match.robots[0];
    place(robot, 480, 280);
    robot.polarity = 1;
    robot.facing = 0;
    const scrap = addScrap(match, { x: 510, y: 280, polarity: -1 });
    step(match, [idle({ action: true })]);
    assert.equal(robot.orbit.length, 1);
    robot.facing = 0;
    step(match, [idle({ action: false })]);
    assert.equal(robot.orbit.length, 0);
    assert.equal(scrap.orbiting, null);
    assert.ok(scrap.vx > FLING_SPEED * 0.75, `vx ${scrap.vx}`);
    assert.ok(Math.abs(scrap.vy) < FLING_SPEED * 0.35, `vy ${scrap.vy}`);
  });

  it('flips polarity, and a flip with an orbit bursts the scrap outward', () => {
    const match = solo();
    const robot = match.robots[0];
    place(robot, 480, 280);
    robot.polarity = 1;
    const a = addScrap(match, { x: 500, y: 270, polarity: -1 });
    const b = addScrap(match, { x: 460, y: 300, polarity: -1 });
    step(match, [idle({ action: true })]);
    step(match, [idle({ action: true })]);
    assert.equal(robot.orbit.length, 2);
    const before = robot.polarity;
    step(match, [idle({ action: true, secondary: true })]);
    assert.equal(robot.polarity, -before);
    assert.equal(robot.orbit.length, 0);
    for (const scrap of [a, b]) {
      const speed = Math.hypot(scrap.vx, scrap.vy);
      assert.ok(speed > BURST_SPEED * 0.75, `speed ${speed}`);
      assert.equal(scrap.orbiting, null);
    }
    step(match, [idle({ secondary: false })]);
    step(match, [idle({ secondary: true })]);
    assert.equal(robot.polarity, before);
  });

  it('robots with opposite polarity close distance and matching polarity open it', () => {
    function separation(polarityB) {
      const match = createMatch({
        seed: 4,
        phase: 'playing',
        autoSpawn: false,
        slots: ['human', 'human', 'off', 'off'],
      });
      place(match.robots[0], 450, 280);
      place(match.robots[1], 530, 280);
      match.robots[0].polarity = 1;
      match.robots[1].polarity = polarityB;
      const start = Math.hypot(match.robots[0].x - match.robots[1].x, match.robots[0].y - match.robots[1].y);
      for (let i = 0; i < 40; i++) step(match, [idle(), idle()]);
      const end = Math.hypot(match.robots[0].x - match.robots[1].x, match.robots[0].y - match.robots[1].y);
      return end - start;
    }
    assert.ok(separation(-1) < -5, 'opposite robots should attract');
    assert.ok(separation(1) > 5, 'matching robots should repel');
  });
});

describe('damage, crushers, and elimination', () => {
  it('deals more damage from a faster scrap and none from a slow one', () => {
    function lost(speed) {
      const match = solo();
      const robot = match.robots[0];
      place(robot, 400, 280);
      addScrap(match, {
        x: robot.x + ROBOT_RADIUS + SCRAP_RADIUS - 1,
        y: robot.y,
        vx: -Math.abs(speed),
        vy: 0,
        polarity: 1,
      });
      step(match, [idle()]);
      return MAX_HP - robot.hp;
    }
    assert.equal(lost(30), 0);
    const mid = lost(220);
    const fast = lost(520);
    assert.ok(mid > 0, `mid ${mid}`);
    assert.ok(fast > mid, `fast ${fast} mid ${mid}`);
  });

  it('crusher walls damage on contact and can eliminate', () => {
    const match = solo();
    const robot = match.robots[0];
    place(robot, ARENA.x + ROBOT_RADIUS, 280);
    step(match, [idle()]);
    assert.ok(robot.hp < MAX_HP);
    const afterOne = MAX_HP - robot.hp;
    assert.ok(afterOne > WALL_DPS * (1 / 120) && afterOne < WALL_DPS * (1 / 20));
    for (let i = 0; i < 240; i++) step(match, [idle()]);
    assert.equal(robot.alive, false);
    assert.equal(robot.hp, 0);
  });

  it('does not let a thrown scrap immediately damage the thrower', () => {
    const match = solo();
    const robot = match.robots[0];
    place(robot, 480, 280);
    robot.polarity = 1;
    robot.facing = 0;
    addScrap(match, { x: 500, y: 280, polarity: -1 });
    step(match, [idle({ action: true })]);
    step(match, [idle({ action: false })]);
    const hp = robot.hp;
    for (let i = 0; i < 8; i++) step(match, [idle()]);
    assert.equal(robot.hp, hp);
    assert.equal(robot.alive, true);
  });
});

describe('rounds and matches', () => {
  it('awards the round to the last robot standing', () => {
    const match = createMatch({
      seed: 5,
      phase: 'playing',
      autoSpawn: false,
      slots: ['human', 'human', 'human', 'bot'],
    });
    for (const robot of match.robots) {
      if (robot.id !== 2) {
        robot.alive = false;
        robot.hp = 0;
      }
    }
    step(match, [idle(), idle(), idle(), idle()]);
    assert.equal(match.phase, 'roundEnd');
    assert.equal(match.roundWinner, 2);
    assert.deepEqual(match.scores, [0, 0, 1, 0]);
  });

  it('draws the round when everyone drops together', () => {
    const match = createMatch({
      seed: 6,
      phase: 'playing',
      autoSpawn: false,
      slots: ['human', 'human', 'off', 'off'],
    });
    for (const robot of match.robots) {
      robot.alive = false;
      robot.hp = 0;
    }
    const scores = match.scores.slice();
    step(match, [idle(), idle()]);
    assert.equal(match.phase, 'roundEnd');
    assert.equal(match.roundWinner, null);
    assert.deepEqual(match.scores, scores);
    assert.ok(match.events.some((e) => e.type === 'roundDraw'));
  });

  it('ends the match on the winning round and revives fighters between rounds', () => {
    const match = createMatch({
      seed: 8,
      phase: 'playing',
      autoSpawn: false,
      roundsToWin: 3,
      slots: ['human', 'bot', 'off', 'off'],
    });
    for (let round = 0; round < 3; round++) {
      for (const robot of match.robots) {
        if (robot.id !== 0) {
          robot.alive = false;
          robot.hp = 0;
        }
      }
      step(match, [idle(), idle()]);
      assert.equal(match.scores[0], round + 1);
      assert.equal(match.phase, 'roundEnd');
      if (round < 2) {
        match.phaseTimer = 0.001;
        step(match);
        assert.equal(match.phase, 'countdown');
        assert.ok(match.robots.every((r) => r.alive && r.hp === MAX_HP));
        match.phaseTimer = 0.001;
        step(match);
        assert.equal(match.phase, 'playing');
        assert.equal(match.round, round + 2);
      } else {
        assert.equal(match.matchWinner, 0);
        match.phaseTimer = 0.001;
        step(match);
        assert.equal(match.phase, 'matchEnd');
        assert.equal(match.round, 3);
      }
    }
  });

  it('respawns scrap over time up to the cap', () => {
    const match = createMatch({
      seed: 9,
      phase: 'playing',
      autoSpawn: true,
      slots: ['human', 'off', 'off', 'off'],
    });
    const initial = match.scraps.length;
    assert.ok(initial >= 8);
    match.scraps = [];
    match.scrapTimer = 0.001;
    for (let i = 0; i < 90; i++) step(match, [idle()]);
    assert.ok(match.scraps.length > 0);
  });
});

describe('bots and determinism', () => {
  it('a bot reaches for nearby opposite scrap', () => {
    const match = solo();
    const robot = match.robots[0];
    robot.isBot = true;
    place(robot, 400, 280);
    robot.polarity = 1;
    addScrap(match, { x: 450, y: 280, polarity: -1 });
    const input = botInput(match, robot);
    assert.equal(input.action, true);
    assert.ok(input.moveX > 0);
  });

  it('repeats a match exactly when the seed matches, and diverges otherwise', () => {
    function fingerprint(seed) {
      const match = createMatch({ seed, slots: ['bot', 'bot', 'bot', 'bot'] });
      for (let i = 0; i < 240; i++) step(match);
      return {
        phase: match.phase,
        scores: match.scores.slice(),
        robots: match.robots.map((r) => [round(r.x), round(r.y), round(r.hp), r.polarity, r.alive]),
        scraps: match.scraps.map((s) => [s.id, round(s.x), round(s.y), s.polarity]),
      };
    }
    const a = fingerprint(42);
    const b = fingerprint(42);
    const c = fingerprint(43);
    assert.deepEqual(a, b);
    assert.notDeepEqual(a.scraps, c.scraps);
  });

  it('four bots finish a round', () => {
    for (const seed of [1, 2, 3, 4]) {
      const match = createMatch({ seed, slots: ['bot', 'bot', 'bot', 'bot'] });
      let steps = 0;
      const limit = 60 * 90;
      while (match.phase !== 'roundEnd' && match.phase !== 'matchEnd' && steps < limit) {
        step(match);
        steps += 1;
        if (steps % 90 === 0) {
          for (const robot of match.robots) {
            assert.ok(Number.isFinite(robot.x) && Number.isFinite(robot.y) && Number.isFinite(robot.hp));
            assert.ok(robot.hp >= 0 && robot.hp <= MAX_HP);
          }
        }
      }
      assert.ok(steps < limit, `seed ${seed} did not finish a round`);
      assert.ok(match.phase === 'roundEnd' || match.phase === 'matchEnd');
    }
  });
});

function round(n) {
  return Math.round(n * 1000) / 1000;
}
