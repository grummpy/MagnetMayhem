/** Tunable rules for Magnet Mayhem. Pure data — no DOM. */

export const TICK_HZ = 60;
export const DT = 1 / TICK_HZ;

export const VIEW_W = 960;
export const VIEW_H = 540;

/** Playfield inside the crusher walls. */
export const ARENA = Object.freeze({ x: 28, y: 66, w: 904, h: 432 });

export const ROBOT_RADIUS = 16;
export const ROBOT_ACCEL = 1100;
export const ROBOT_MAX_SPEED = 176;
export const ROBOT_FRICTION = 8;

export const SCRAP_RADIUS = 7;
export const MAX_HP = 100;

/** Passive magnet: robots pull opposite scrap and push same-polarity scrap. */
export const MAGNET_RADIUS = 170;
export const SCRAP_MAGNET_ACCEL = 520;

/** Robots tug on each other by polarity. */
export const ROBOT_MAGNET_RADIUS = 130;
export const ROBOT_MAGNET_ACCEL = 240;

/** Holding action snaps opposite scrap into orbit. */
export const PULL_RADIUS = 112;
export const ORBIT_RADIUS = 36;
export const ORBIT_SPIN = 2.8;
export const MAX_ORBIT = 3;

export const FLING_SPEED = 540;
export const BURST_SPEED = 480;

export const SCRAP_DAMAGE_MIN_SPEED = 145;
export const SCRAP_DAMAGE_SCALE = 0.11;
export const SCRAP_DAMAGE_MAX = 58;
export const HIT_COOLDOWN_TICKS = 14;
export const THROWER_IMMUNITY_TICKS = 28;

/** Damage per second while a robot is touching a crusher wall. */
export const WALL_DPS = 36;

export const SCRAP_MAX_SPEED = 760;
export const SCRAP_DAMP = 0.55;

export const INITIAL_SCRAP = 14;
export const MAX_SCRAP = 18;
export const SCRAP_RESPAWN_INTERVAL = 1.1;

export const ROUNDS_TO_WIN_DEFAULT = 3;
export const COUNTDOWN_SECONDS = 3;
export const ROUND_END_SECONDS = 2.6;

/** Poster colors — one body color per seat. Polarity is separate (red + / blue -). */
export const PLAYER_COLORS = Object.freeze(['#d6453d', '#3c7fd6', '#3fa34a', '#e0b23a']);
export const POLARITY_POS = '#ff2d3a';
export const POLARITY_NEG = '#2f7dff';

export function arenaCenter() {
  return { x: ARENA.x + ARENA.w / 2, y: ARENA.y + ARENA.h / 2 };
}

export function spawnPoint(index) {
  const inset = 76;
  const pts = [
    { x: ARENA.x + inset, y: ARENA.y + inset },
    { x: ARENA.x + ARENA.w - inset, y: ARENA.y + inset },
    { x: ARENA.x + inset, y: ARENA.y + ARENA.h - inset },
    { x: ARENA.x + ARENA.w - inset, y: ARENA.y + ARENA.h - inset },
  ];
  return pts[index] || pts[0];
}
