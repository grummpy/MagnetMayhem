/** Screen flow, fixed-timestep loop, and the glue between input, sim, audio, and canvas. */

import { createMatch, step } from '../core/game.js';
import { DT } from '../core/constants.js';
import {
  ACTION_FIELDS,
  DEFAULT_BINDINGS,
  assignBinding,
  cloneBindings,
} from '../core/inputmap.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { createRenderer } from './render.js';
import { loadSettings, saveSettings } from './settings.js';
import { createRng } from '../core/rng.js';

const canvas = document.getElementById('c');
const renderer = createRenderer(canvas);
const audio = createAudio();
const settings = loadSettings();
const fxRng = createRng(99);

const ui = {
  screen: 'title',
  paused: false,
  settingsReturn: 'title',
  join: [{ control: 'bot' }, { control: 'bot' }, { control: 'bot' }, { control: 'bot' }],
  settings,
  menuIndex: 0,
  controlPlayer: 0,
  rebinding: null,
  goTimer: 0,
  lastCount: 0,
  shake: 0,
  particles: [],
  prevPlayers: [blank(), blank(), blank(), blank()],
  errors: [],
};

let match = null;
let acc = 0;
let last = performance.now();
let latestPlayers = ui.prevPlayers;

const input = createInput(() => ui.settings.bindings);

const cover = new Image();
cover.src = 'assets/cover.jpg';

window.addEventListener('error', (event) => {
  ui.errors.push(String(event.message || event.error || 'error'));
});
window.addEventListener('unhandledrejection', (event) => {
  ui.errors.push(String(event.reason || 'rejection'));
});

function blank() {
  return { moveX: 0, moveY: 0, action: false, secondary: false, pause: false, padConnected: false };
}

function axisPressed(prev, curr, dir) {
  const on = dir < 0 ? curr < -0.5 : curr > 0.5;
  const was = dir < 0 ? prev < -0.5 : prev > 0.5;
  return on && !was;
}

function navEdges(sample) {
  const binding = ui.settings.bindings[0];
  const prev = ui.prevPlayers[0] || blank();
  const player = sample.players[0];
  return {
    up: sample.pressed.has(binding.up) || sample.pressed.has('ArrowUp') || axisPressed(prev.moveY, player.moveY, -1),
    down: sample.pressed.has(binding.down) || sample.pressed.has('ArrowDown') || axisPressed(prev.moveY, player.moveY, 1),
    left: sample.pressed.has(binding.left) || sample.pressed.has('ArrowLeft') || axisPressed(prev.moveX, player.moveX, -1),
    right: sample.pressed.has(binding.right) || sample.pressed.has('ArrowRight') || axisPressed(prev.moveX, player.moveX, 1),
    confirm: sample.enterPressed || edge(player.action, prev.action),
  };
}

function edge(curr, prev) {
  return !!curr && !prev;
}

function startEdge(sample) {
  if (sample.enterPressed) return true;
  return pausePressed(sample);
}

function pausePressed(sample) {
  return sample.players.some((player, i) => edge(player.pause, ui.prevPlayers[i] && ui.prevPlayers[i].pause));
}

function leaveSettings() {
  if (ui.settingsReturn === 'pause') {
    ui.screen = 'match';
    ui.paused = true;
    ui.menuIndex = 1;
  } else {
    ui.screen = ui.settingsReturn;
    ui.menuIndex = 0;
  }
}

function freshSeed() {
  const t = (Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0;
  return t || 1;
}

function startMatch() {
  const active = ui.join.filter((slot) => slot.control !== 'off').length;
  if (active < 2) return;
  match = createMatch({
    seed: freshSeed(),
    slots: ui.join.map((slot) => ({ control: slot.control })),
    roundsToWin: ui.settings.roundsToWin,
  });
  ui.screen = 'match';
  ui.paused = false;
  ui.menuIndex = 0;
  ui.goTimer = 0;
  ui.lastCount = 0;
  ui.particles = [];
  acc = 0;
}

function buildInputs(players) {
  return players.map((player, i) => {
    const slot = ui.join[i];
    if (!slot || slot.control === 'off') return { human: false };
    if (player.padConnected || slot.control === 'human') return { ...player, human: true };
    return { human: false };
  });
}

function spark(x, y, color, count, speed, text) {
  for (let i = 0; i < count; i++) {
    const angle = fxRng.next() * Math.PI * 2;
    const vel = speed * (0.35 + fxRng.next());
    const life = 0.28 + fxRng.next() * 0.35;
    ui.particles.push({
      x, y,
      vx: Math.cos(angle) * vel,
      vy: Math.sin(angle) * vel,
      life,
      max: life,
      color,
      size: 2 + fxRng.next() * 2,
    });
  }
  if (text) {
    ui.particles.push({
      x, y: y - 8, vx: 0, vy: -28, life: 0.7, max: 0.7, color, size: 14, text,
    });
  }
}

function handleEvents(events) {
  for (const event of events) {
    if (event.type === 'hit' && event.cause === 'scrap') {
      audio.sfx('hit');
      ui.shake = Math.min(8, ui.shake + Math.min(5, event.amount / 10));
      spark(event.x, event.y, '#f2c014', 6, 90, String(Math.round(event.amount)));
    } else if (event.type === 'hit' && event.cause === 'wall') {
      audio.sfx('wall');
    } else if (event.type === 'capture') {
      audio.sfx('capture');
    } else if (event.type === 'fling') {
      audio.sfx('fling');
      spark(event.x, event.y, '#f4efe4', 4, 70);
    } else if (event.type === 'burst') {
      audio.sfx('burst');
      ui.shake = Math.min(8, ui.shake + 4);
      spark(event.x, event.y, '#ff2d3a', 10, 140);
    } else if (event.type === 'flip') {
      audio.sfx('flip');
    } else if (event.type === 'ko') {
      audio.sfx('ko');
      ui.shake = 8;
      spark(event.x, event.y, '#e23b3b', 16, 160, 'KO');
    } else if (event.type === 'go') {
      audio.sfx('go');
      ui.goTimer = 0.7;
    } else if (event.type === 'roundWin' || event.type === 'roundDraw') {
      audio.sfx('round');
    } else if (event.type === 'matchWin') {
      audio.sfx('match');
    } else if (event.type === 'roundStart') {
      ui.lastCount = 0;
    }
  }
}

function isModifier(code) {
  return code.startsWith('Meta') || code.startsWith('Alt') || code.startsWith('Control') || code.startsWith('Shift');
}

function cycleRounds(dir) {
  const options = [1, 3, 5];
  const index = Math.max(0, options.indexOf(ui.settings.roundsToWin));
  ui.settings.roundsToWin = options[(index + dir + options.length) % options.length];
  saveSettings(ui.settings);
}

function changeVolume(dir) {
  ui.settings.volume = Math.max(0, Math.min(1, Math.round((ui.settings.volume + dir * 0.1) * 10) / 10));
  saveSettings(ui.settings);
}

function openSettings(from) {
  ui.settingsReturn = from;
  ui.screen = 'settings';
  ui.menuIndex = 0;
}

function updateMenus(sample) {
  if (ui.rebinding) {
    if (sample.escapePressed) {
      ui.rebinding = null;
      return;
    }
    for (const code of sample.pressed) {
      if (isModifier(code) || code === 'Escape' || code === 'Tab') continue;
      assignBinding(ui.settings.bindings[ui.rebinding.player], ui.rebinding.field, code);
      ui.rebinding = null;
      saveSettings(ui.settings);
      break;
    }
    return;
  }

  const nav = navEdges(sample);

  if (ui.screen === 'title') {
    if (startEdge(sample)) ui.screen = 'join';
    else if (sample.tabPressed) openSettings('title');
    return;
  }

  if (ui.screen === 'join') {
    sample.players.forEach((player, i) => {
      const prev = ui.prevPlayers[i] || blank();
      if (edge(player.action, prev.action) && ui.join[i].control !== 'human') ui.join[i].control = 'human';
      if (edge(player.secondary, prev.secondary)) {
        const order = { human: 'bot', bot: 'off', off: 'bot' };
        ui.join[i].control = order[ui.join[i].control];
      }
    });
    if (startEdge(sample)) startMatch();
    else if (sample.escapePressed) ui.screen = 'title';
    else if (sample.tabPressed) openSettings('join');
    return;
  }

  if (ui.screen === 'settings') {
    const count = 4;
    if (nav.up) ui.menuIndex = (ui.menuIndex + count - 1) % count;
    if (nav.down) ui.menuIndex = (ui.menuIndex + 1) % count;
    if (nav.left || nav.right) {
      const dir = nav.right ? 1 : -1;
      if (ui.menuIndex === 0) changeVolume(dir);
      if (ui.menuIndex === 1) cycleRounds(dir);
    }
    if (nav.confirm) {
      if (ui.menuIndex === 2) {
        ui.screen = 'controls';
        ui.menuIndex = 0;
      } else if (ui.menuIndex === 3) leaveSettings();
    }
    if (sample.escapePressed) leaveSettings();
    return;
  }

  if (ui.screen === 'controls') {
    if (nav.left) ui.controlPlayer = (ui.controlPlayer + 3) % 4;
    if (nav.right) ui.controlPlayer = (ui.controlPlayer + 1) % 4;
    const count = ACTION_FIELDS.length + 3;
    if (nav.up) ui.menuIndex = (ui.menuIndex + count - 1) % count;
    if (nav.down) ui.menuIndex = (ui.menuIndex + 1) % count;
    if (nav.confirm) {
      if (ui.menuIndex < ACTION_FIELDS.length) {
        ui.rebinding = { player: ui.controlPlayer, field: ACTION_FIELDS[ui.menuIndex] };
      } else if (ui.menuIndex === ACTION_FIELDS.length) {
        ui.settings.bindings[ui.controlPlayer] = { ...DEFAULT_BINDINGS[ui.controlPlayer] };
        saveSettings(ui.settings);
      } else if (ui.menuIndex === ACTION_FIELDS.length + 1) {
        ui.settings.bindings = cloneBindings();
        saveSettings(ui.settings);
      } else {
        ui.screen = 'settings';
        ui.menuIndex = 2;
      }
    }
    if (sample.escapePressed) {
      ui.screen = 'settings';
      ui.menuIndex = 2;
    }
    return;
  }

  if (ui.screen === 'match' && ui.paused) {
    const count = 3;
    if (nav.up) ui.menuIndex = (ui.menuIndex + count - 1) % count;
    if (nav.down) ui.menuIndex = (ui.menuIndex + 1) % count;
    if (nav.confirm) {
      if (ui.menuIndex === 0) ui.paused = false;
      else if (ui.menuIndex === 1) openSettings('pause');
      else quitToTitle();
    } else if (sample.escapePressed || pausePressed(sample)) {
      ui.paused = false;
    }
    return;
  }

  if (ui.screen === 'match' && match && match.phase === 'matchEnd') {
    if (sample.enterPressed || startEdge(sample)) startMatch();
    else if (sample.escapePressed) quitToTitle();
  }
}

function quitToTitle() {
  ui.screen = 'title';
  ui.paused = false;
  ui.menuIndex = 0;
  match = null;
}

function maybePause(sample) {
  if (ui.screen !== 'match' || !match || match.phase === 'matchEnd') return;
  if (sample.escapePressed || pausePressed(sample)) {
    ui.paused = true;
    ui.menuIndex = 0;
  }
}

function updateParticles(dt) {
  for (const particle of ui.particles) {
    particle.life -= dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
  }
  if (ui.particles.length > 280) ui.particles.splice(0, ui.particles.length - 280);
  ui.particles = ui.particles.filter((particle) => particle.life > 0);
  ui.shake *= Math.exp(-3.5 * dt);
  if (ui.goTimer > 0) ui.goTimer -= dt;
}

function countdownBeep() {
  if (!match || match.phase !== 'countdown' || ui.paused) return;
  const n = Math.ceil(match.phaseTimer - 1e-4);
  if (n !== ui.lastCount && n > 0 && n <= 3) {
    ui.lastCount = n;
    audio.sfx('beep');
  }
}

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const sample = input.poll();
  latestPlayers = sample.players;

  if (sample.pressed.size || sample.players.some((p) => p.action || p.secondary || p.pause || p.padConnected)) {
    audio.unlock();
  }
  if (sample.mutePressed && !ui.rebinding) {
    ui.settings.muted = !ui.settings.muted;
    saveSettings(ui.settings);
  }
  audio.setVolume(ui.settings.volume);
  audio.setMuted(ui.settings.muted);

  const wasPaused = ui.paused;
  updateMenus(sample);
  if (!wasPaused) maybePause(sample);

  const simulating = ui.screen === 'match' && match && !ui.paused
    && (match.phase === 'countdown' || match.phase === 'playing' || match.phase === 'roundEnd');
  if (simulating) {
    acc += dt;
    let guard = 0;
    const playerInputs = buildInputs(sample.players);
    while (acc >= DT && guard < 5) {
      handleEvents(step(match, playerInputs));
      acc -= DT;
      guard += 1;
    }
    countdownBeep();
  } else {
    acc = 0;
  }

  updateParticles(dt);
  audio.update();
  renderer.draw({
    screen: ui.screen,
    paused: ui.paused,
    match,
    join: ui.join,
    players: sample.players,
    settings: ui.settings,
    bindings: ui.settings.bindings,
    menuIndex: ui.menuIndex,
    controlPlayer: ui.controlPlayer,
    rebinding: ui.rebinding,
    roundsToWin: ui.settings.roundsToWin,
    particles: ui.particles,
    shake: ui.shake,
    goTimer: ui.goTimer,
    now,
    cover,
  });

  ui.prevPlayers = sample.players.map((player) => ({ ...player }));
  input.endFrame();
  requestAnimationFrame(frame);
}

window.__MM__ = {
  errors: ui.errors,
  getState() {
    return {
      screen: ui.screen,
      paused: ui.paused,
      phase: match ? match.phase : null,
      tick: match ? match.tick : 0,
      round: match ? match.round : 0,
      scores: match ? match.scores.slice() : [0, 0, 0, 0],
      roundWinner: match ? match.roundWinner : null,
      matchWinner: match ? match.matchWinner : null,
      roundsToWin: match ? match.roundsToWin : ui.settings.roundsToWin,
      scraps: match ? match.scraps.length : 0,
      robots: match ? match.robots.map((robot) => ({
        id: robot.id,
        hp: robot.hp,
        alive: robot.alive,
        polarity: robot.polarity,
        x: robot.x,
        y: robot.y,
        orbit: robot.orbit.length,
        isBot: robot.isBot,
      })) : [],
      slots: ui.join.map((slot) => slot.control),
      pads: latestPlayers.map((player) => !!player.padConnected),
      muted: ui.settings.muted,
    };
  },
};

requestAnimationFrame(frame);
