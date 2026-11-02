/** Collision, crusher walls, and scrap impact damage. No DOM. */

import { ARENA, SCRAP_DAMAGE_MAX, SCRAP_DAMAGE_MIN_SPEED, SCRAP_DAMAGE_SCALE } from './constants.js';

export function damageForSpeed(speed) {
  if (speed < SCRAP_DAMAGE_MIN_SPEED) return 0;
  return Math.min(SCRAP_DAMAGE_MAX, Math.round(speed * SCRAP_DAMAGE_SCALE));
}

export function separatePair(a, b, ra, rb) {
  let dx = b.x - a.x;
  let dy = b.y - a.y;
  let d = Math.hypot(dx, dy);
  const min = ra + rb;
  if (d >= min) return false;
  if (d < 1e-6) {
    dx = 1;
    dy = 0;
    d = 1;
  }
  const push = (min - d) / 2;
  const nx = dx / d;
  const ny = dy / d;
  a.x -= nx * push;
  a.y -= ny * push;
  b.x += nx * push;
  b.y += ny * push;
  return true;
}

export function separateRobots(robots) {
  const alive = robots.filter((r) => r.alive);
  for (let n = 0; n < 3; n++) {
    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        separatePair(alive[i], alive[j], alive[i].radius, alive[j].radius);
      }
    }
  }
}

/**
 * Keep a robot inside the arena. Touching the boundary (including resting on it)
 * counts as crusher contact so damage is continuous.
 */
export function clampRobot(robot) {
  const minX = ARENA.x + robot.radius;
  const maxX = ARENA.x + ARENA.w - robot.radius;
  const minY = ARENA.y + robot.radius;
  const maxY = ARENA.y + ARENA.h - robot.radius;
  let hit = false;
  if (robot.x <= minX) {
    robot.x = minX;
    if (robot.vx < 0) robot.vx = 0;
    hit = true;
  } else if (robot.x >= maxX) {
    robot.x = maxX;
    if (robot.vx > 0) robot.vx = 0;
    hit = true;
  }
  if (robot.y <= minY) {
    robot.y = minY;
    if (robot.vy < 0) robot.vy = 0;
    hit = true;
  } else if (robot.y >= maxY) {
    robot.y = maxY;
    if (robot.vy > 0) robot.vy = 0;
    hit = true;
  }
  return hit;
}

/** Bounce scrap off the inner edge so it stays in the junkyard. */
export function bounceScrap(scrap, restitution = 0.5) {
  const minX = ARENA.x + scrap.radius;
  const maxX = ARENA.x + ARENA.w - scrap.radius;
  const minY = ARENA.y + scrap.radius;
  const maxY = ARENA.y + ARENA.h - scrap.radius;
  if (scrap.x < minX) {
    scrap.x = minX;
    if (scrap.vx < 0) scrap.vx = -scrap.vx * restitution;
  } else if (scrap.x > maxX) {
    scrap.x = maxX;
    if (scrap.vx > 0) scrap.vx = -scrap.vx * restitution;
  }
  if (scrap.y < minY) {
    scrap.y = minY;
    if (scrap.vy < 0) scrap.vy = -scrap.vy * restitution;
  } else if (scrap.y > maxY) {
    scrap.y = maxY;
    if (scrap.vy > 0) scrap.vy = -scrap.vy * restitution;
  }
}
