/**
 * Magnet Mayhem match simulation.
 * Fixed 60 Hz step. Rendering and browser APIs stay outside this module.
 * Randomness comes from the seeded RNG.
 */

import {
  ARENA,
  BURST_SPEED,
  COUNTDOWN_SECONDS,
  DT,
  FLING_SPEED,
  HIT_COOLDOWN_TICKS,
  INITIAL_SCRAP,
  MAGNET_RADIUS,
  MAX_HP,
  MAX_ORBIT,
  MAX_SCRAP,
  ORBIT_RADIUS,
  ORBIT_SPIN,
  PULL_RADIUS,
  ROBOT_ACCEL,
  ROBOT_FRICTION,
  ROBOT_MAGNET_ACCEL,
  ROBOT_MAGNET_RADIUS,
  ROBOT_MAX_SPEED,
  ROBOT_RADIUS,
  ROUND_END_SECONDS,
  ROUNDS_TO_WIN_DEFAULT,
  SCRAP_DAMP,
  SCRAP_MAGNET_ACCEL,
  SCRAP_MAX_SPEED,
  SCRAP_RADIUS,
  SCRAP_RESPAWN_INTERVAL,
  THROWER_IMMUNITY_TICKS,
  WALL_DPS,
  arenaCenter,
  spawnPoint,
} from './constants.js';
import { createRng } from './rng.js';
import { dist, norm } from './vec.js';
import { bounceScrap, clampRobot, damageForSpeed, separatePair, separateRobots } from './physics.js';

export function normalizeSlots(slots) {
  const out = [];
  for (let i = 0; i < 4; i++) {
    const src = slots && slots[i];
    let control = 'bot';
    if (typeof src === 'string') control = src;
    else if (src && typeof src.control === 'string') control = src.control;
    if (control !== 'human' && control !== 'bot' && control !== 'off') control = 'bot';
    out.push({ control });
  }
  return out;
}

function makeRobot(id, isBot) {
  const p = spawnPoint(id);
  const polarity = id % 2 === 0 ? 1 : -1;
  return {
    id,
    isBot,
    x: p.x,
    y: p.y,
    vx: 0,
    vy: 0,
    facing: 0,
    radius: ROBOT_RADIUS,
    polarity,
    basePolarity: polarity,
    hp: MAX_HP,
    alive: true,
    orbit: [],
    orbitHold: 0,
    actionPrev: false,
    secondaryPrev: false,
    slowTicks: 0,
  };
}

function scrapById(match, id) {
  for (const scrap of match.scraps) if (scrap.id === id) return scrap;
  return null;
}

export function addScrap(match, props = {}) {
  const scrap = {
    id: match.nextScrapId++,
    x: ARENA.x + ARENA.w / 2,
    y: ARENA.y + ARENA.h / 2,
    vx: 0,
    vy: 0,
    polarity: 1,
    radius: SCRAP_RADIUS,
    orbiting: null,
    orbitAngle: 0,
    immuneRobot: -1,
    immuneTicks: 0,
    hitCooldown: 0,
    captureLock: 0,
    ...props,
  };
  match.scraps.push(scrap);
  return scrap;
}

function spawnScrap(match) {
  let x = ARENA.x + ARENA.w / 2;
  let y = ARENA.y + ARENA.h / 2;
  for (let attempt = 0; attempt < 12; attempt++) {
    x = ARENA.x + 36 + match.rng.next() * (ARENA.w - 72);
    y = ARENA.y + 36 + match.rng.next() * (ARENA.h - 72);
    let clear = true;
    for (const robot of match.robots) {
      if (Math.hypot(robot.x - x, robot.y - y) < 72) {
        clear = false;
        break;
      }
    }
    if (clear) break;
  }
  return addScrap(match, {
    x,
    y,
    polarity: match.rng.next() < 0.5 ? 1 : -1,
  });
}

function setupRound(match) {
  const center = arenaCenter();
  for (const robot of match.robots) {
    const p = spawnPoint(robot.id);
    robot.x = p.x;
    robot.y = p.y;
    robot.vx = 0;
    robot.vy = 0;
    robot.hp = MAX_HP;
    robot.alive = true;
    robot.polarity = robot.basePolarity;
    robot.facing = Math.atan2(center.y - p.y, center.x - p.x);
    robot.orbit = [];
    robot.orbitHold = 0;
    robot.actionPrev = false;
    robot.secondaryPrev = false;
    robot.slowTicks = 0;
  }
  match.scraps = [];
  match.nextScrapId = 1;
  match.scrapTimer = SCRAP_RESPAWN_INTERVAL;
  if (match.autoSpawn) {
    for (let i = 0; i < INITIAL_SCRAP; i++) spawnScrap(match);
  }
}

export function createMatch(opts = {}) {
  const slots = normalizeSlots(opts.slots);
  const robots = [];
  slots.forEach((slot, i) => {
    if (slot.control === 'off') return;
    robots.push(makeRobot(i, slot.control === 'bot'));
  });

  const match = {
    seed: opts.seed ?? 1,
    rng: createRng(opts.seed ?? 1),
    roundsToWin: opts.roundsToWin ?? ROUNDS_TO_WIN_DEFAULT,
    scores: [0, 0, 0, 0],
    round: 1,
    phase: 'countdown',
    phaseTimer: COUNTDOWN_SECONDS,
    robots,
    scraps: [],
    slots,
    nextScrapId: 1,
    scrapTimer: SCRAP_RESPAWN_INTERVAL,
    autoSpawn: opts.autoSpawn !== false,
    events: [],
    tick: 0,
    roundWinner: null,
    matchWinner: null,
    pendingMatchEnd: false,
  };
  setupRound(match);
  if (opts.phase === 'playing') {
    match.phase = 'playing';
    match.phaseTimer = 0;
  }
  return match;
}

function nearestAlive(match, robot) {
  let best = null;
  let bestD = Infinity;
  for (const other of match.robots) {
    if (!other.alive || other.id === robot.id) continue;
    const d = dist(robot, other);
    if (d < bestD) {
      bestD = d;
      best = other;
    }
  }
  return best;
}

function nearestFreeScrap(match, robot, pred) {
  let best = null;
  let bestD = Infinity;
  for (const scrap of match.scraps) {
    if (scrap.orbiting != null) continue;
    if (!pred(scrap)) continue;
    const d = dist(robot, scrap);
    if (d < bestD) {
      bestD = d;
      best = scrap;
    }
  }
  return best;
}

function incomingScrap(match, robot) {
  let best = null;
  let bestD = 78;
  for (const scrap of match.scraps) {
    if (scrap.orbiting != null) continue;
    const speed = Math.hypot(scrap.vx, scrap.vy);
    if (speed < 200) continue;
    const dx = robot.x - scrap.x;
    const dy = robot.y - scrap.y;
    const d = Math.hypot(dx, dy);
    if (d > bestD || d < 1) continue;
    const toward = (scrap.vx * dx + scrap.vy * dy) / (speed * d);
    if (toward > 0.65) {
      best = scrap;
      bestD = d;
    }
  }
  return best;
}

/** Simple free-for-all bot. Decisions read state only — they do not consume the RNG. */
export function botInput(match, robot) {
  const input = { moveX: 0, moveY: 0, action: false, secondary: false, human: false };
  if (!robot.alive) return input;

  const enemy = nearestAlive(match, robot);
  const scrap = nearestFreeScrap(match, robot, (s) => s.polarity !== robot.polarity);
  const scrapDist = scrap ? dist(robot, scrap) : Infinity;
  const orbitCount = robot.orbit.length;

  let mx = 0;
  let my = 0;
  const margin = 86;
  if (robot.x < ARENA.x + margin) mx += 1.15;
  if (robot.x > ARENA.x + ARENA.w - margin) mx -= 1.15;
  if (robot.y < ARENA.y + margin) my += 1.15;
  if (robot.y > ARENA.y + ARENA.h - margin) my -= 1.15;

  if (robot.slowTicks > 20) {
    const wobble = robot.slowTicks * 0.37 + robot.id * 1.7;
    mx += Math.cos(wobble);
    my += Math.sin(wobble);
  }

  const wantFling = orbitCount > 0 && enemy && (
    orbitCount >= 2 || scrapDist > PULL_RADIUS || robot.orbitHold > 0.55
  );

  if (wantFling) {
    const lead = 0.2;
    const dx = enemy.x + enemy.vx * lead - robot.x;
    const dy = enemy.y + enemy.vy * lead - robot.y;
    const aim = norm(dx, dy);
    mx += aim.x;
    my += aim.y;
    const n = norm(mx, my);
    input.moveX = n.x;
    input.moveY = n.y;
    const dot = Math.cos(robot.facing) * aim.x + Math.sin(robot.facing) * aim.y;
    input.action = !(dot > 0.45 || robot.orbitHold > 0.95);
    return input;
  }

  if (scrap) {
    const aim = norm(scrap.x - robot.x, scrap.y - robot.y);
    mx += aim.x;
    my += aim.y;
    const n = norm(mx, my);
    input.moveX = n.x;
    input.moveY = n.y;
    input.action = scrapDist < PULL_RADIUS + 10;
  } else if (enemy) {
    const aim = norm(enemy.x - robot.x, enemy.y - robot.y);
    mx += aim.x * 0.55;
    my += aim.y * 0.55;
    const n = norm(mx, my);
    input.moveX = n.x;
    input.moveY = n.y;
    const same = nearestFreeScrap(match, robot, (s) => s.polarity === robot.polarity);
    if (same && orbitCount === 0 && match.tick % 36 === robot.id * 7) input.secondary = true;
  } else {
    const n = norm(mx, my);
    input.moveX = n.x;
    input.moveY = n.y;
  }

  if (orbitCount === 0) {
    const threat = incomingScrap(match, robot);
    if (threat) {
      const side = norm(-(threat.y - robot.y), threat.x - robot.x);
      const n = norm(input.moveX + side.x, input.moveY + side.y);
      input.moveX = n.x;
      input.moveY = n.y;
    }
  }

  return input;
}

function releaseScrap(robot, scrap, vx, vy) {
  scrap.orbiting = null;
  scrap.vx = vx;
  scrap.vy = vy;
  scrap.immuneRobot = robot.id;
  scrap.immuneTicks = THROWER_IMMUNITY_TICKS;
  scrap.captureLock = THROWER_IMMUNITY_TICKS;
  scrap.hitCooldown = 4;
}

function dropOrbit(match, robot, scatter) {
  for (const id of robot.orbit) {
    const scrap = scrapById(match, id);
    if (!scrap) continue;
    scrap.orbiting = null;
    if (scatter) {
      const ang = scrap.orbitAngle;
      scrap.vx = Math.cos(ang) * 80;
      scrap.vy = Math.sin(ang) * 80;
    } else {
      scrap.vx = robot.vx;
      scrap.vy = robot.vy;
    }
  }
  robot.orbit = [];
  robot.orbitHold = 0;
}

function hurt(match, robot, amount, cause, x, y, quiet = false) {
  if (!robot.alive || amount <= 0) return;
  const prev = robot.hp;
  robot.hp = Math.max(0, robot.hp - amount);
  const died = prev > 0 && robot.hp <= 0;
  if (!quiet) match.events.push({ type: 'hit', robotId: robot.id, amount, x, y, cause });
  if (died) {
    robot.hp = 0;
    robot.alive = false;
    dropOrbit(match, robot, true);
    match.events.push({ type: 'ko', robotId: robot.id, x: robot.x, y: robot.y });
  }
}

function applyMovement(robot, input) {
  robot.vx += input.moveX * ROBOT_ACCEL * DT;
  robot.vy += input.moveY * ROBOT_ACCEL * DT;
  if (input.moveX === 0 && input.moveY === 0) {
    const f = Math.exp(-ROBOT_FRICTION * DT);
    robot.vx *= f;
    robot.vy *= f;
  }
  const mag = Math.hypot(input.moveX, input.moveY);
  if (mag > 0.2) robot.facing = Math.atan2(input.moveY, input.moveX);
}

function applyRobotMagnets(robots) {
  const alive = robots.filter((r) => r.alive);
  for (let i = 0; i < alive.length; i++) {
    for (let j = i + 1; j < alive.length; j++) {
      const a = alive[i];
      const b = alive[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d < 1 || d > ROBOT_MAGNET_RADIUS) continue;
      const falloff = 1 - d / ROBOT_MAGNET_RADIUS;
      const dir = a.polarity === b.polarity ? -1 : 1;
      const acc = dir * ROBOT_MAGNET_ACCEL * falloff * DT;
      const nx = dx / d;
      const ny = dy / d;
      a.vx += nx * acc;
      a.vy += ny * acc;
      b.vx -= nx * acc;
      b.vy -= ny * acc;
    }
  }
}

function clampSpeed(entity, max) {
  const s = Math.hypot(entity.vx, entity.vy);
  if (s > max) {
    entity.vx = (entity.vx / s) * max;
    entity.vy = (entity.vy / s) * max;
  }
}

function applyScrapMagnets(match) {
  for (const scrap of match.scraps) {
    if (scrap.orbiting != null) continue;
    for (const robot of match.robots) {
      if (!robot.alive) continue;
      const dx = robot.x - scrap.x;
      const dy = robot.y - scrap.y;
      const d = Math.hypot(dx, dy);
      if (d < 1 || d > MAGNET_RADIUS) continue;
      if (scrap.immuneTicks > 0 && scrap.immuneRobot === robot.id) continue;
      const falloff = 1 - d / MAGNET_RADIUS;
      const dir = scrap.polarity === robot.polarity ? -1 : 1;
      const acc = dir * SCRAP_MAGNET_ACCEL * falloff * DT;
      scrap.vx += (dx / d) * acc;
      scrap.vy += (dy / d) * acc;
    }
    const damp = Math.exp(-SCRAP_DAMP * DT);
    scrap.vx *= damp;
    scrap.vy *= damp;
    clampSpeed(scrap, SCRAP_MAX_SPEED);
    scrap.x += scrap.vx * DT;
    scrap.y += scrap.vy * DT;
    bounceScrap(scrap);
  }
}

function captureOne(match, robot) {
  if (robot.orbit.length >= MAX_ORBIT) return;
  let best = null;
  let bestD = PULL_RADIUS;
  for (const scrap of match.scraps) {
    if (scrap.orbiting != null) continue;
    if (scrap.captureLock > 0) continue;
    if (scrap.polarity === robot.polarity) continue;
    const d = dist(robot, scrap);
    if (d <= bestD) {
      bestD = d;
      best = scrap;
    }
  }
  if (!best) return;
  best.orbiting = robot.id;
  best.orbitAngle = robot.orbit.length * ((Math.PI * 2) / MAX_ORBIT);
  best.vx = 0;
  best.vy = 0;
  robot.orbit.push(best.id);
  match.events.push({ type: 'capture', robotId: robot.id, x: best.x, y: best.y });
}

function flingOrbit(match, robot) {
  if (!robot.orbit.length) return;
  const vx = Math.cos(robot.facing) * FLING_SPEED + robot.vx;
  const vy = Math.sin(robot.facing) * FLING_SPEED + robot.vy;
  for (const id of robot.orbit) {
    const scrap = scrapById(match, id);
    if (!scrap) continue;
    releaseScrap(robot, scrap, vx, vy);
    match.events.push({ type: 'fling', robotId: robot.id, x: scrap.x, y: scrap.y });
  }
  robot.orbit = [];
  robot.orbitHold = 0;
}

function burstOrbit(match, robot) {
  const n = robot.orbit.length;
  if (!n) return;
  robot.orbit.forEach((id, i) => {
    const scrap = scrapById(match, id);
    if (!scrap) return;
    const ang = robot.facing + (Math.PI * 2 * i) / n;
    releaseScrap(robot, scrap, Math.cos(ang) * BURST_SPEED, Math.sin(ang) * BURST_SPEED);
  });
  match.events.push({ type: 'burst', robotId: robot.id, x: robot.x, y: robot.y });
  robot.orbit = [];
  robot.orbitHold = 0;
}

function updateOrbits(match) {
  for (const robot of match.robots) {
    if (!robot.alive) continue;
    let i = 0;
    for (const id of robot.orbit) {
      const scrap = scrapById(match, id);
      if (!scrap) continue;
      scrap.orbitAngle += ORBIT_SPIN * DT;
      const ang = scrap.orbitAngle + i * ((Math.PI * 2) / Math.max(1, robot.orbit.length));
      scrap.x = robot.x + Math.cos(ang) * ORBIT_RADIUS;
      scrap.y = robot.y + Math.sin(ang) * ORBIT_RADIUS;
      scrap.vx = robot.vx;
      scrap.vy = robot.vy;
      i += 1;
    }
  }
}

function scrapHits(match) {
  for (const scrap of match.scraps) {
    if (scrap.orbiting != null) continue;
    const speed = Math.hypot(scrap.vx, scrap.vy);
    const dmg = damageForSpeed(speed);
    for (const robot of match.robots) {
      if (!robot.alive) continue;
      const d = dist(scrap, robot);
      const reach = robot.radius + scrap.radius;
      if (d >= reach) continue;
      if (dmg <= 0 || scrap.hitCooldown > 0) {
        if (d > 0 && d < reach) {
          const nx = (scrap.x - robot.x) / (d || 1);
          const ny = (scrap.y - robot.y) / (d || 1);
          scrap.x = robot.x + nx * reach;
          scrap.y = robot.y + ny * reach;
        }
        continue;
      }
      if (scrap.immuneTicks > 0 && scrap.immuneRobot === robot.id) continue;
      hurt(match, robot, dmg, 'scrap', scrap.x, scrap.y);
      scrap.hitCooldown = HIT_COOLDOWN_TICKS;
      const nx = (scrap.x - robot.x) / (d || 1);
      const ny = (scrap.y - robot.y) / (d || 1);
      scrap.vx = nx * Math.max(80, speed * 0.35);
      scrap.vy = ny * Math.max(80, speed * 0.35);
      scrap.x = robot.x + nx * (reach + 1);
      scrap.y = robot.y + ny * (reach + 1);
    }
  }
}

function checkRoundEnd(match) {
  if (match.phase !== 'playing') return;
  if (match.robots.length < 2) return;
  const alive = match.robots.filter((r) => r.alive);
  if (alive.length > 1) return;
  match.phase = 'roundEnd';
  match.phaseTimer = ROUND_END_SECONDS;
  if (alive.length === 1) {
    const winner = alive[0];
    match.roundWinner = winner.id;
    match.scores[winner.id] += 1;
    match.events.push({ type: 'roundWin', robotId: winner.id });
    if (match.scores[winner.id] >= match.roundsToWin) {
      match.matchWinner = winner.id;
      match.pendingMatchEnd = true;
    }
  } else {
    match.roundWinner = null;
    match.events.push({ type: 'roundDraw' });
  }
}

/**
 * Advance the match by one 60 Hz tick.
 * `inputs` is a length-4 list indexed by seat. Bot seats ignore it unless `human` is set
 * (gamepad hot-plug take over).
 */
export function step(match, inputs = []) {
  match.events = [];
  match.tick += 1;

  if (match.phase === 'countdown') {
    match.phaseTimer -= DT;
    if (match.phaseTimer <= 0) {
      match.phase = 'playing';
      match.phaseTimer = 0;
      match.events.push({ type: 'go' });
    }
    return match.events;
  }

  if (match.phase === 'roundEnd') {
    match.phaseTimer -= DT;
    if (match.phaseTimer <= 0) {
      if (match.pendingMatchEnd) {
        match.phase = 'matchEnd';
        match.events.push({ type: 'matchWin', robotId: match.matchWinner });
      } else {
        match.round += 1;
        match.phase = 'countdown';
        match.phaseTimer = COUNTDOWN_SECONDS;
        setupRound(match);
        match.events.push({ type: 'roundStart', round: match.round });
      }
    }
    return match.events;
  }

  if (match.phase !== 'playing') return match.events;

  for (const scrap of match.scraps) {
    if (scrap.hitCooldown > 0) scrap.hitCooldown -= 1;
    if (scrap.immuneTicks > 0) scrap.immuneTicks -= 1;
    if (scrap.captureLock > 0) scrap.captureLock -= 1;
  }

  for (const robot of match.robots) {
    if (!robot.alive) continue;
    const raw = inputs[robot.id] || {};
    const useBot = robot.isBot && !raw.human;
    const input = useBot ? botInput(match, robot) : raw;
    const actionHeld = !!input.action;
    const secondaryHeld = !!input.secondary;
    const actionReleased = !actionHeld && robot.actionPrev;
    const secondaryPressed = secondaryHeld && !robot.secondaryPrev;

    applyMovement(robot, input);

    if (secondaryPressed) {
      robot.polarity *= -1;
      match.events.push({ type: 'flip', robotId: robot.id, polarity: robot.polarity, x: robot.x, y: robot.y });
      if (robot.orbit.length) burstOrbit(match, robot);
    }
    if (actionReleased) flingOrbit(match, robot);
    if (actionHeld) captureOne(match, robot);

    robot.actionPrev = actionHeld;
    robot.secondaryPrev = secondaryHeld;
  }

  applyRobotMagnets(match.robots);
  for (const robot of match.robots) {
    if (!robot.alive) continue;
    clampSpeed(robot, ROBOT_MAX_SPEED);
    robot.x += robot.vx * DT;
    robot.y += robot.vy * DT;
  }

  applyScrapMagnets(match);
  separateRobots(match.robots);

  for (const robot of match.robots) {
    if (!robot.alive) continue;
    const crushed = clampRobot(robot);
    if (crushed) {
      hurt(match, robot, WALL_DPS * DT, 'wall', robot.x, robot.y, match.tick % 10 !== 0);
    }
  }

  updateOrbits(match);
  scrapHits(match);

  // A second clamp in case a hit response nudged someone out.
  for (const robot of match.robots) {
    if (robot.alive) clampRobot(robot);
  }

  for (const robot of match.robots) {
    if (!robot.alive) {
      robot.orbitHold = 0;
      robot.slowTicks = 0;
      continue;
    }
    if (robot.orbit.length) robot.orbitHold += DT;
    else robot.orbitHold = 0;
    if (Math.hypot(robot.vx, robot.vy) < 14) robot.slowTicks += 1;
    else robot.slowTicks = 0;
  }

  // Soft-separate free scraps so piles don't freeze in one spot.
  for (let i = 0; i < match.scraps.length; i++) {
    const a = match.scraps[i];
    if (a.orbiting != null) continue;
    for (let j = i + 1; j < match.scraps.length; j++) {
      const b = match.scraps[j];
      if (b.orbiting != null) continue;
      separatePair(a, b, a.radius * 0.85, b.radius * 0.85);
    }
  }

  if (match.autoSpawn) {
    match.scrapTimer -= DT;
    if (match.scrapTimer <= 0) {
      match.scrapTimer = SCRAP_RESPAWN_INTERVAL;
      if (match.scraps.length < MAX_SCRAP) spawnScrap(match);
    }
  }

  checkRoundEnd(match);
  return match.events;
}

export { DT, damageForSpeed };
